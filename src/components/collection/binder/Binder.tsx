import { startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Coins, GalleryHorizontal, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Position } from '@/types/player';
import { cn } from '@/lib/utils';
import { reducedMotion } from '@/utils/motion';
import { FINISHES, TIERS, type DisplayChoice, type OwnedCard, type Tier } from '@/utils/collection';
import { findNFLTeam } from '@/utils/nflTeams';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import PixelLoader from '@/components/ui/PixelLoader';
import { peekProps } from '@/components/peek/peekProps';
import CollectibleCard from '../CollectibleCard';
import VariantBadges from '../VariantBadges';
import { displayWithKit } from '../kits';
import { FINISH_ICON, FINISH_TEXT } from '../rarityIcons';
import type { CardInfo } from '../useCardPool';
import { BINDER_DEFAULTS, POSITIONS, SORTS, SORT_FIRST, matchesQuery, writeMinePref, type BinderFilterState } from './filters';
import './binder.css';

/*
 * The binder (owner, 2026-11-17: "the binder itself isn't very immersive its hard to see my own cards without
 * scrolling"): a ring binder of sleeve pages, nine pockets a page on a phone (3 × 3) and twelve from 640px (4 × 3),
 * a two-page spread from 1100px. Pages turn sideways (scroll snap: a swipe, the arrows, the page slider, ← → keys),
 * so a whole page of cards is on screen at once. It opens on the owner's own cards ("My cards"); "Full set" adds the
 * missing ones as locked pockets. Search, one Filters sheet (tier, finish, position, club, sort) and removable pills
 * for whatever is on. Only the pages near the one on show mount their cards; the rest are empty sleeves of the same
 * size, so a 500-card full set stays light.
 */

/** Pockets per page and whether two pages sit side by side, by the viewport width */
const useLayout = () => {
  const read = () => {
    if (typeof window === 'undefined') return { cols: 3, rows: 3, spread: false };
    const w = window.innerWidth;
    return w >= 1100 ? { cols: 4, rows: 3, spread: true } : w >= 640 ? { cols: 4, rows: 3, spread: false } : { cols: 3, rows: 3, spread: false };
  };
  const [layout, setLayout] = useState(read);
  useEffect(() => {
    const on = () => {
      const next = read();
      setLayout((l) => (l.cols === next.cols && l.rows === next.rows && l.spread === next.spread ? l : next));
    };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return layout;
};

const Pill = ({ children, onClear, label }: { children: ReactNode; onClear: () => void; label: string }) => (
  <button type="button" className="bk-pill" onClick={onClear} aria-label={`Remove filter: ${label}`}>
    {children}
    <X className="h-3 w-3 opacity-70" aria-hidden="true" />
  </button>
);

const Opt = ({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) => (
  <button type="button" className={cn('bk-opt', on && 'is-on')} aria-pressed={on} aria-label={label} onClick={onClick}>
    {children}
  </button>
);

interface BinderProps {
  loaded: boolean;
  /** Every card in the set */
  cards: CardInfo[];
  /** The cards the filters let through, in sort order */
  filtered: CardInfo[];
  owned: Record<string, OwnedCard>;
  display?: Record<string, DisplayChoice>;
  fresh?: Set<string> | null;
  filters: BinderFilterState;
  setFilters: (f: BinderFilterState) => void;
  teamOptions: string[];
  ownedCount: number;
  /** Milestone binder skin (economy cosmetics), the binder's cover */
  skin?: string | null;
  onOpen: (c: CardInfo, from?: DOMRect) => void;
  onSwipe: () => void;
  swipeCount: number;
  onSellDupes: () => void;
}

const Binder = ({
  loaded,
  cards,
  filtered,
  owned,
  display,
  fresh,
  filters,
  setFilters,
  teamOptions,
  ownedCount,
  skin,
  onOpen,
  onSwipe,
  swipeCount,
  onSellDupes,
}: BinderProps) => {
  const f = filters;
  const set = useCallback((patch: Partial<BinderFilterState>) => setFilters({ ...f, ...patch }), [f, setFilters]);
  const [sheet, setSheet] = useState(false);
  const { cols, rows, spread } = useLayout();
  const per = cols * rows;
  const n = filtered.length;
  const pages = Math.max(1, Math.ceil(n / per) + (spread && Math.ceil(n / per) % 2 ? 1 : 0));
  const step = spread ? 2 : 1;
  const views = Math.ceil(pages / step);

  const trackRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  // `view` follows the scroll (the page counter); `mounted` is the page whose neighbours carry real cards, and it only
  // moves once a swipe has settled, so no card mounts mid-swipe (that was the stutter). A button turn mounts first.
  const [view, setView] = useState(0);
  const [mounted, setMounted] = useState(0);
  const viewRef = useRef(0);
  const raf = useRef(0);
  const settle = useRef(0);
  const settleNow = useCallback(() => {
    window.clearTimeout(settle.current);
    const v = viewRef.current;
    startTransition(() => setMounted(v));
  }, []);
  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(settleNow, 140);
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const t = trackRef.current;
      if (!t || !t.clientWidth) return;
      const v = Math.max(0, Math.min(views - 1, Math.round(t.scrollLeft / t.clientWidth)));
      viewRef.current = v;
      setView(v);
    });
  };
  useEffect(() => {
    const t = trackRef.current;
    if (!t || !('onscrollend' in t)) return;
    t.addEventListener('scrollend', settleNow);
    return () => t.removeEventListener('scrollend', settleNow);
  });
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(settle.current);
    },
    [],
  );
  const goTo = (v: number, instant = false) => {
    const t = trackRef.current;
    if (!t) return;
    const to = Math.max(0, Math.min(views - 1, v));
    if (to === viewRef.current && !instant) return;
    viewRef.current = to;
    setView(to);
    // the destination's cards mount now, the turn starts once they are painted
    setMounted(to);
    const smooth = !instant && !reducedMotion();
    requestAnimationFrame(() => requestAnimationFrame(() => t.scrollTo({ left: to * t.clientWidth, behavior: smooth ? 'smooth' : 'auto' })));
  };

  // A new filter, search or sort opens the binder at its first page, with a short fade (opacity and transform only)
  const filterKey = `${f.q}|${f.mine}|${f.tier}|${f.finish}|${f.pos}|${f.team}|${f.sort}|${f.rev}|${per}|${spread}`;
  const firstKey = useRef(filterKey);
  useLayoutEffect(() => {
    trackRef.current?.scrollTo({ left: 0 });
    viewRef.current = 0;
    setView(0);
    setMounted(0);
    if (firstKey.current === filterKey) return;
    firstKey.current = filterKey;
    if (reducedMotion()) return;
    bookRef.current?.animate?.([{ opacity: 0.35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }, [filterKey]);

  // The chosen sort stays in view in its sideways row (never scrolls the page itself)
  const sortRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = sortRef.current;
    const on = row?.querySelector<HTMLElement>('.is-on');
    if (!row || !on) return;
    const left = on.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + on.offsetWidth > row.scrollLeft + row.clientWidth - 18)
      row.scrollTo({ left: Math.max(0, left - 24), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [f.sort]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(view + (e.key === 'ArrowRight' ? 1 : -1));
    }
  };

  const active = (f.tier !== 'all' ? 1 : 0) + (f.finish !== 'all' ? 1 : 0) + (f.pos !== 'all' ? 1 : 0) + (f.team !== 'all' ? 1 : 0);
  const anyFilter = active > 0 || !!f.q.trim();
  const clearKeepSort = { sort: f.sort, rev: f.rev };
  const clearAll = () => setFilters({ ...BINDER_DEFAULTS, mine: f.mine, ...clearKeepSort });
  const setMine = (mine: boolean) => {
    writeMinePref(mine);
    set({ mine });
  };

  // Counts for the sheet: how many cards each choice would show with the other filters as they are
  const dq = useDeferredValue(f.q); // typing never waits for the binder
  const pool = useMemo(() => cards.filter((c) => (!f.mine || !!owned[c.key]) && matchesQuery(c, dq)), [cards, owned, f.mine, dq]);
  const tierCount = (t: Tier) => pool.filter((c) => c.tier === t).length;
  const posCount = (p: Position) => pool.filter((c) => c.player.position === p).length;

  const first = view * step * per;
  const shownTo = Math.min(n, first + step * per);

  const renderPocket = (c: CardInfo | undefined, i: number, live: boolean) => {
    if (!c) return <li key={`empty-${i}`} className="bk-pocket bk-pocket--empty" aria-hidden="true" />;
    const entry = owned[c.key];
    if (!live)
      return (
        <li key={c.key} className="bk-pocket" aria-hidden="true">
          <span className="bk-pocket__ghost" />
        </li>
      );
    const d = entry ? displayWithKit(entry, display?.[c.key], c.player) : undefined;
    return (
      <li key={c.key} className={cn('bk-pocket', fresh?.has(c.key) && 'fut-tile--fresh', !entry && 'bk-pocket--locked')} {...peekProps(entry ? c.player : null)}>
        <CollectibleCard
          player={c.player}
          tier={c.tier}
          finish={d?.finish ?? 'base'}
          variant={d?.variant}
          kit={d?.kit}
          prizm={d?.prizm}
          pinned={d?.pinned}
          owned={!!entry}
          ovr={c.ovr}
          number={c.number}
          stats={c.stats}
          setNo={c.setNo}
          setTotal={cards.length}
          hint={c.hint}
          marks={entry?.marks}
          onOpen={entry ? (from) => openRef.current(c, from) : undefined}
        />
        <VariantBadges entry={entry} />
      </li>
    );
  };

  // The pages (memoized on the settled page, so the counter and the range slider never re-render the cards)
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const pageEls = useMemo(
    () =>
      Array.from({ length: pages }, (_, p) => {
        const live = p >= (mounted - 1) * step && p < (mounted + 2) * step;
        const slice = filtered.slice(p * per, p * per + per);
        return (
          <div key={p} className={cn('bk__page', spread && (p % 2 ? 'bk__page--right' : 'bk__page--left'))}>
            <ul className="bk__pockets" aria-label={`Page ${p + 1}`}>
              {Array.from({ length: per }, (_, i) => renderPocket(slice[i], p * per + i, live))}
            </ul>
            <span className="bk__folio" aria-hidden="true">
              {p + 1}
            </span>
          </div>
        );
      }),
    // renderPocket reads owned / display / fresh / cards from this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, mounted, step, per, spread, filtered, owned, display, fresh, cards.length],
  );

  return (
    <section aria-labelledby="col-binder" className="bk-section scroll-mt-20" id="col-binder-section">
      {/* Header: title, the two views, swipe and sell */}
      <div className="bk-head">
        <h2 id="col-binder" className="section-title">
          Binder
        </h2>
        <div className="bk-seg" role="group" aria-label="Which cards">
          <button type="button" className={cn('bk-seg__b', f.mine && 'is-on')} aria-pressed={f.mine} onClick={() => setMine(true)}>
            My cards <span className="bk-seg__n">{ownedCount}</span>
          </button>
          <button type="button" className={cn('bk-seg__b', !f.mine && 'is-on')} aria-pressed={!f.mine} onClick={() => setMine(false)}>
            Full set <span className="bk-seg__n">{cards.length}</span>
          </button>
        </div>
      </div>

      {/* Toolbar: search and the filters sheet */}
      <div className="bk-tools">
        <label className="bk-search">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={f.mine ? 'Find a card' : 'Find a player'}
            aria-label="Find a player"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
          />
          {f.q && (
            <button type="button" className="bk-search__x" onClick={() => set({ q: '' })} aria-label="Clear the search">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </label>
        <button type="button" className={cn('bk-filter-btn', active > 0 && 'is-on')} onClick={() => setSheet(true)} aria-label={`Filters${active ? `, ${active} on` : ''}`}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>Filters</span>
          {active > 0 && <span className="bk-filter-btn__n">{active}</span>}
        </button>
        <div className="bk-tools__acts">
          {loaded && cards.length > 0 && (
            <button type="button" className="col-swipe-btn" onClick={onSwipe} aria-label={`Swipe through your cards (${swipeCount} in this filter)`}>
              <GalleryHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="bk-lbl">Swipe</span>
            </button>
          )}
          {loaded && ownedCount > 0 && (
            <button type="button" className="col-swipe-btn ec-dupes-btn" onClick={onSellDupes} aria-label="Sell duplicate cards to the market">
              <Coins className="h-4 w-4" aria-hidden="true" />
              <span className="bk-lbl">Sell duplicates</span>
            </button>
          )}
        </div>
      </div>

      {/* Sort: one tap, always in view (owner, 2026-11-17: "give me the ability to sort the cards in the binder") */}
      <div className="bk-sort" role="group" aria-label="Sort the binder">
        <span className="bk-sort__k" aria-hidden="true">
          Sort
        </span>
        <div className="bk-sort__chips" ref={sortRef}>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={cn('bk-sort__c', f.sort === s.key && 'is-on')}
              aria-pressed={f.sort === s.key}
              onClick={() => set({ sort: s.key, rev: f.sort === s.key ? f.rev : false })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={cn('bk-sort__rev', f.rev && 'is-on')}
          aria-pressed={f.rev}
          onClick={() => set({ rev: !f.rev })}
          aria-label={`Order: ${SORT_FIRST[f.sort][f.rev ? 1 : 0]}. Tap to reverse.`}
          title={SORT_FIRST[f.sort][f.rev ? 1 : 0]}
        >
          <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
          <span className="bk-sort__dir">{SORT_FIRST[f.sort][f.rev ? 1 : 0]}</span>
        </button>
      </div>

      {anyFilter && (
        <div className="bk-pills" aria-label="Filters on">
          {f.q.trim() && <Pill label={`search ${f.q}`} onClear={() => set({ q: '' })}>“{f.q.trim()}”</Pill>}
          {f.tier !== 'all' && (
            <Pill label={f.tier} onClear={() => set({ tier: 'all' })}>
              <span className={cn('col-dot', `col-gem--${f.tier}`)} aria-hidden="true" />
              {TIERS.find((t) => t.key === f.tier)?.label}
            </Pill>
          )}
          {f.finish !== 'all' && (
            <Pill label={`${f.finish} finish`} onClear={() => set({ finish: 'all' })}>
              {(() => {
                const Icon = FINISH_ICON[f.finish];
                return <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[f.finish])} aria-hidden="true" />;
              })()}
              {FINISHES.find((x) => x.key === f.finish)?.label}
            </Pill>
          )}
          {f.pos !== 'all' && <Pill label={f.pos} onClear={() => set({ pos: 'all' })}>{f.pos}</Pill>}
          {f.team !== 'all' && (
            <Pill label={f.team} onClear={() => set({ team: 'all' })}>
              {findNFLTeam(f.team)?.logoUrl && <img src={findNFLTeam(f.team)!.logoUrl} alt="" className="h-4 w-4" loading="lazy" />}
              {f.team}
            </Pill>
          )}
          <button type="button" className="bk-pills__clear" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}

      {/* The book */}
      {!loaded ? (
        <PixelLoader label="Binder" what="cards" minHeight={420} className="justify-start pt-16" />
      ) : !cards.length ? (
        <div className="bk-empty" role="status">No league data yet.</div>
      ) : n === 0 ? (
        <div className={cn('bk', 'bk--empty', skin && `ec-skin ec-skin--${skin}`)} role="status">
          <span className="bk__rings" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div className="bk-empty">
            {f.mine && ownedCount === 0 ? (
              <>
                <p className="font-display text-2xl uppercase italic">An empty binder</p>
                <p>Open a pack above and your first cards slide into these sleeves.</p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl uppercase italic">No cards match</p>
                <p>{f.mine ? 'None of your cards fit these filters.' : 'No player fits these filters.'}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {anyFilter && (
                    <button type="button" className="bk-filter-btn" onClick={clearAll}>
                      Clear filters
                    </button>
                  )}
                  {f.mine && (
                    <button type="button" className="bk-filter-btn" onClick={() => setMine(false)}>
                      Search the full set
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div ref={bookRef} className={cn('bk', spread && 'bk--spread', skin && `ec-skin ec-skin--${skin}`)} style={{ ['--bk-cols' as string]: cols }}>
          <span className="bk__rings" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div
            ref={trackRef}
            className="bk__track"
            onScroll={onScroll}
            onKeyDown={onKey}
            tabIndex={0}
            role="region"
            aria-roledescription="binder"
            aria-label={`Binder pages, page ${view * step + 1} of ${pages}. Left and right arrows turn the page.`}
          >
            {pageEls}
          </div>
        </div>
      )}

      {loaded && n > 0 && (
        <div className="bk-nav">
          <button type="button" className="bk-nav__b" onClick={() => goTo(view - 1)} disabled={view === 0} aria-label="Previous page">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="bk-nav__mid">
            <p className="bk-nav__where" aria-live="polite">
              {spread && pages > 1 ? `Pages ${view * 2 + 1}–${Math.min(pages, view * 2 + 2)}` : `Page ${view + 1}`} <span className="opacity-60">of {pages}</span>
              <span className="bk-nav__cards">
                {' '}
                · cards {first + 1}–{shownTo} of {n}
              </span>
            </p>
            {views > 1 && (
              <input
                type="range"
                className="bk-nav__range"
                min={0}
                max={views - 1}
                value={view}
                onChange={(e) => goTo(Number(e.target.value), true)}
                aria-label="Turn to page"
                style={{ ['--p' as string]: views > 1 ? view / (views - 1) : 0 }}
              />
            )}
          </div>
          <button type="button" className="bk-nav__b" onClick={() => goTo(view + 1)} disabled={view >= views - 1} aria-label="Next page">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Filters sheet */}
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="bk-sheet max-h-[calc(var(--dvh,1vh)*85)] overflow-y-auto">
          <SheetTitle className="font-display text-2xl uppercase italic">Filter the binder</SheetTitle>
          <SheetDescription>{f.mine ? 'Your cards only.' : 'Every card in the set, missing ones locked.'}</SheetDescription>

          <h3 className="bk-sheet__h">Tier</h3>
          <div className="bk-sheet__row">
            {TIERS.map((t) => (
              <Opt key={t.key} on={f.tier === t.key} onClick={() => set({ tier: f.tier === t.key ? 'all' : t.key })}>
                <span className={cn('col-dot', `col-gem--${t.key}`)} aria-hidden="true" />
                {t.label}
                <span className="bk-opt__n">{tierCount(t.key)}</span>
              </Opt>
            ))}
          </div>

          <h3 className="bk-sheet__h">Best finish</h3>
          <div className="bk-sheet__row">
            {FINISHES.map((x) => {
              const Icon = FINISH_ICON[x.key];
              return (
                <Opt key={x.key} on={f.finish === x.key} onClick={() => set({ finish: f.finish === x.key ? 'all' : x.key })} label={`${x.label} finish`}>
                  <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[x.key])} aria-hidden="true" />
                  {x.label}
                </Opt>
              );
            })}
          </div>

          <h3 className="bk-sheet__h">Position</h3>
          <div className="bk-sheet__row bk-sheet__row--pos">
            {POSITIONS.map((p) => (
              <Opt key={p} on={f.pos === p} onClick={() => set({ pos: f.pos === p ? 'all' : p })}>
                {p}
                <span className="bk-opt__n">{posCount(p)}</span>
              </Opt>
            ))}
          </div>

          <h3 className="bk-sheet__h">Club</h3>
          <div className="bk-clubs">
            {teamOptions.map((t) => {
              const team = findNFLTeam(t);
              const on = f.team === t;
              return (
                <button
                  key={t}
                  type="button"
                  className={cn('bk-club', on && 'is-on')}
                  aria-pressed={on}
                  onClick={() => set({ team: on ? 'all' : t })}
                  style={team ? { ['--club' as string]: team.primaryColor } : undefined}
                  title={t}
                >
                  {team?.logoUrl ? <img src={team.logoUrl} alt="" loading="lazy" /> : <span className="bk-club__fa">FA</span>}
                  <span className="bk-club__name">{team?.abbreviation ?? t}</span>
                </button>
              );
            })}
          </div>

          <div className="bk-sheet__foot">
            {active > 0 && (
              <button type="button" className="bk-filter-btn" onClick={clearAll}>
                Clear
              </button>
            )}
            <button type="button" className="bk-sheet__go" onClick={() => setSheet(false)}>
              Show {n} {n === 1 ? 'card' : 'cards'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};

export default Binder;
