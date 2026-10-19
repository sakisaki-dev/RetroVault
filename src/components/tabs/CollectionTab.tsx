import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Gift, Layers, Lock, Trophy } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import TeamLogo from '@/components/brand/TeamLogo';
import CollectibleCard from '@/components/collection/CollectibleCard';
import { RARITY_ICON } from '@/components/collection/rarityIcons';
import PackOpening from '@/components/collection/PackOpening';
import { byRarityDesc, useCardPool, type CardInfo } from '@/components/collection/useCardPool';
import { matchPlayerByName, useLeagueContent } from '@/utils/leagueContent';
import { RARITIES, msUntilNextPack, openDailyPack, useCollection, type Rarity } from '@/utils/collection';

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
type Own = 'all' | 'owned' | 'missing';
type Sort = 'set' | 'rarity' | 'recent';

const MIN_CARD = 158;
const PAGE = 48;

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const RARITY_TEXT: Record<Rarity, string> = {
  base: 'text-muted-foreground',
  silver: 'text-slate-200',
  gold: 'text-gold',
  hof: 'text-fuchsia-300',
  legend: 'text-amber-300',
};

const fmtCountdown = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};

/**
 * Columns for the card grid: as many as fit at MIN_CARD, or a few fewer when that leaves fewer
 * empty spots in the last row (the last row is centered, so there are no holes either way).
 */
const useColumns = (count: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = width < 480 ? 10 : 14;
  const fit = Math.max(1, Math.floor((width + gap) / (MIN_CARD + gap)));
  const holes = (c: number) => (c - (count % c)) % c;
  const max = Math.min(fit, Math.max(1, count));
  // Short lists (two rows or fewer) may drop to about half the columns to even out the rows
  const min = count <= fit * 2 ? Math.max(2, Math.ceil(fit * 0.55)) : Math.max(2, fit - 1);
  let cols = max;
  for (let c = max - 1; c >= min; c--) if (holes(c) < holes(cols)) cols = c;
  return { ref, cols, gap };
};

const Chip = ({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={label}
    onClick={onClick}
    className={cn(
      'inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition-colors',
      active ? 'border-gold bg-gold/15 text-gold' : 'border-line bg-panel text-muted-foreground hover:text-foreground',
    )}
  >
    {children}
  </button>
);

const Select = ({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="font-pixel text-[9px] uppercase text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 min-w-0 rounded-md border border-line bg-panel px-2 text-sm text-foreground"
    >
      {children}
    </select>
  </label>
);

const Bar = ({ value, className }: { value: number; className?: string }) => (
  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-black/40" aria-hidden="true">
    <span className={cn('block h-full rounded-full bg-gold transition-[width] duration-500', className)} style={{ width: `${value}%` }} />
  </span>
);

const CollectionTab = () => {
  const { cards, byKey, rarityOf, loaded } = useCardPool();
  const { cards: owned, packReady } = useCollection();
  const { content } = useLeagueContent();

  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [pos, setPos] = useState<Position | 'all'>('all');
  const [team, setTeam] = useState('all');
  const [own, setOwn] = useState<Own>('all');
  const [sort, setSort] = useState<Sort>('set');
  const [limit, setLimit] = useState(PAGE);
  const [allTeams, setAllTeams] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const [packOpen, setPackOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => setLimit(PAGE), [rarity, pos, team, own, sort]);

  const isOwned = (c: CardInfo) => !!owned[c.key];
  const ownedCount = cards.filter(isOwned).length;

  const rarityStats = useMemo(
    () =>
      RARITIES.map((r) => {
        const list = cards.filter((c) => c.rarity === r.key);
        return { ...r, total: list.length, have: list.filter((c) => !!owned[c.key]).length };
      }),
    [cards, owned],
  );

  const franchises = useMemo(() => {
    const map = new Map<string, { name: string; team: string | null; total: number; have: number }>();
    cards.forEach((c) => {
      const e = map.get(c.franchise) ?? { name: c.franchise, team: c.player.isRealLegend ? null : c.player.team ?? null, total: 0, have: 0 };
      e.total++;
      if (owned[c.key]) e.have++;
      map.set(c.franchise, e);
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [cards, owned]);

  const achievements = useMemo(() => {
    const players = cards.map((c) => c.player);
    const eras = (content?.eras ?? [])
      .map((era) => {
        const members = [
          ...new Map(
            era.keyPlayers
              .map((n) => matchPlayerByName(n, players))
              .filter((p): p is CardInfo['player'] => !!p)
              .map((p) => [`${p.position}:${p.name}`, p] as const),
          ).values(),
        ];
        const name = /dynasty|run|era|years/i.test(era.name) ? era.name : `${era.name} era`;
        return { id: era.id, title: `Complete the ${name}`, sub: `Y${era.startYear}–${era.endYear}`, members };
      })
      .filter((a) => a.members.length > 0);
    const hof = cards.filter((c) => c.rarity === 'hof').map((c) => c.player);
    const legends = cards.filter((c) => c.rarity === 'legend').map((c) => c.player);
    const extra = [
      { id: 'hof-wing', title: 'Fill the Hall of Fame wing', sub: 'Every HOF Holo', members: hof },
      { id: 'legends-room', title: 'Open the Legends room', sub: 'Every NFL Legend', members: legends },
    ].filter((a) => a.members.length > 0);
    return [...eras, ...extra].map((a) => ({ ...a, have: a.members.filter((p) => !!owned[`${p.position}:${p.name}`]).length }));
  }, [cards, content, owned]);

  const teamOptions = useMemo(() => [...new Set(cards.map((c) => c.franchise))].sort(), [cards]);

  const filtered = useMemo(() => {
    const list = cards.filter(
      (c) =>
        (rarity === 'all' || c.rarity === rarity) &&
        (pos === 'all' || c.player.position === pos) &&
        (team === 'all' || c.franchise === team) &&
        (own === 'all' || (own === 'owned') === !!owned[c.key]),
    );
    if (sort === 'rarity') return [...list].sort(byRarityDesc);
    if (sort === 'recent') return [...list].sort((a, b) => (owned[b.key]?.at ?? 0) - (owned[a.key]?.at ?? 0) || a.setNo - b.setNo);
    return list;
  }, [cards, rarity, pos, team, own, sort, owned]);

  const { ref: gridRef, cols, gap } = useColumns(filtered.length);
  // Whole rows only while paging, so the grid never ends on a ragged row until the last page
  const shownCount = Math.min(filtered.length, Math.max(cols, Math.ceil(limit / cols) * cols));
  const shown = filtered.slice(0, shownCount);

  const tear = () =>
    openDailyPack(
      cards.map((c) => c.player),
      rarityOf,
    );

  const resetFilters = () => {
    setRarity('all');
    setPos('all');
    setTeam('all');
    setOwn('all');
  };

  return (
    <div className="container space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Progress header */}
      <section aria-labelledby="col-title" className="glass-card overflow-hidden">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0 space-y-3">
            <p className="font-pixel text-[10px] uppercase tracking-wider text-gold">Card binder</p>
            <h1 id="col-title" className="font-display text-4xl uppercase italic sm:text-5xl">
              Collection
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Every player in the vault has a card. Win them in the Arcade, or pull three from the free daily pack.
            </p>
            <div className="space-y-1.5">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-3xl tabular-nums text-chalk">{ownedCount}</span>
                <span className="text-muted-foreground">/ {cards.length} collected</span>
                <span className="ml-auto font-mono text-sm text-gold">{pct(ownedCount, cards.length)}%</span>
              </p>
              <div
                role="progressbar"
                aria-label="Collection progress"
                aria-valuemin={0}
                aria-valuemax={cards.length}
                aria-valuenow={ownedCount}
                aria-valuetext={`${ownedCount} of ${cards.length} cards`}
              >
                <Bar value={pct(ownedCount, cards.length)} className="bg-gradient-to-r from-turf to-gold" />
              </div>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Cards by rarity">
              {rarityStats.map((r) => {
                const Icon = RARITY_ICON[r.key];
                return (
                  <li key={r.key} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-xs">
                    <Icon className={cn('h-3.5 w-3.5', RARITY_TEXT[r.key])} aria-hidden="true" />
                    <span className="font-semibold">{r.short}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {r.have}/{r.total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Daily pack */}
          <div className="flex items-center gap-4 rounded-xl border border-gold/40 bg-gold/5 p-4 lg:w-72 lg:flex-col lg:text-center">
            <Gift className={cn('h-10 w-10 shrink-0 text-gold', packReady && 'motion-safe:animate-bounce')} aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-display text-xl uppercase">Daily pack</p>
              <p className="text-xs text-muted-foreground">
                {packReady ? '3 cards, weighted by rarity. Free once a day.' : `Opened today. Next pack in ${fmtCountdown(msUntilNextPack(new Date(now)))}.`}
              </p>
              <button
                type="button"
                onClick={() => setPackOpen(true)}
                disabled={!packReady || !loaded || !cards.length}
                className="inline-flex h-9 w-full items-center justify-center rounded-md bg-gold px-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {packReady ? 'Open pack' : 'Come back tomorrow'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Achievements */}
      {achievements.length > 0 && (
        <section aria-labelledby="col-ach">
          <h2 id="col-ach" className="section-title mb-3">
            <Trophy className="h-5 w-5 text-gold" aria-hidden="true" /> Sets
          </h2>
          <ul className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" aria-label="Set achievements">
            {achievements.map((a) => {
              const done = a.have === a.members.length;
              return (
                <li
                  key={a.id}
                  className={cn(
                    'w-64 shrink-0 space-y-2 rounded-xl border p-3',
                    done ? 'border-gold bg-gold/10' : 'border-line bg-panel',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', done ? 'bg-gold text-primary-foreground' : 'bg-black/40 text-muted-foreground')}
                      aria-hidden="true"
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-base uppercase leading-tight">{a.title}</p>
                      <p className="font-pixel text-[9px] uppercase text-muted-foreground">
                        {a.sub} · {a.have}/{a.members.length}
                        <span className="sr-only">{done ? ', complete' : ''}</span>
                      </p>
                    </div>
                  </div>
                  <Bar value={pct(a.have, a.members.length)} />
                  {a.members.length <= 10 && (
                    <p className="text-xs leading-snug text-muted-foreground">
                      {a.members.map((p, i) => (
                        <span key={`${p.position}:${p.name}`} className={owned[`${p.position}:${p.name}`] ? 'text-chalk' : 'opacity-60'}>
                          {i > 0 && ', '}
                          {p.name}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Franchise completion */}
      <section aria-labelledby="col-fr">
        <h2 id="col-fr" className="section-title mb-3">
          <Layers className="h-5 w-5 text-gold" aria-hidden="true" /> By franchise
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(allTeams ? franchises : franchises.slice(0, 8)).map((f) => (
            <li key={f.name}>
              <button
                type="button"
                onClick={() => setTeam(team === f.name ? 'all' : f.name)}
                aria-pressed={team === f.name}
                aria-label={`${f.name}: ${f.have} of ${f.total} cards, ${pct(f.have, f.total)}%. Filter the binder`}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors',
                  team === f.name ? 'border-gold bg-gold/10' : 'border-line bg-panel hover:border-gold/50',
                )}
              >
                {f.team ? <TeamLogo team={f.team} size={28} decorative /> : <span className="grid h-7 w-7 place-items-center text-gold" aria-hidden="true">★</span>}
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{f.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct(f.have, f.total)}%</span>
                  </span>
                  <Bar value={pct(f.have, f.total)} className={f.have === f.total ? 'bg-turf' : undefined} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {franchises.length > 8 && (
          <button type="button" onClick={() => setAllTeams((v) => !v)} className="mt-2 text-sm font-semibold text-gold hover:underline" aria-expanded={allTeams}>
            {allTeams ? 'Show fewer' : `Show all ${franchises.length} franchises`}
          </button>
        )}
      </section>

      {/* Binder */}
      <section aria-labelledby="col-binder" className="space-y-4">
        <h2 id="col-binder" className="section-title">
          Binder
        </h2>
        <div className="space-y-3 rounded-xl border border-line bg-panel/60 p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Rarity">
            <Chip active={rarity === 'all'} onClick={() => setRarity('all')}>
              All rarities
            </Chip>
            {RARITIES.map((r) => {
              const Icon = RARITY_ICON[r.key];
              return (
                <Chip key={r.key} active={rarity === r.key} onClick={() => setRarity(rarity === r.key ? 'all' : r.key)}>
                  <Icon className={cn('h-3.5 w-3.5', RARITY_TEXT[r.key])} aria-hidden="true" />
                  {r.short}
                </Chip>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select label="Show" value={own} onChange={(v) => setOwn(v as Own)}>
              <option value="all">All cards</option>
              <option value="owned">Collected</option>
              <option value="missing">Missing</option>
            </Select>
            <Select label="Position" value={pos} onChange={(v) => setPos(v as Position | 'all')}>
              <option value="all">All positions</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select label="Team" value={team} onChange={setTeam}>
              <option value="all">All teams</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)}>
              <option value="set">Set number</option>
              <option value="rarity">Rarity</option>
              <option value="recent">Recently pulled</option>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {!loaded && !cards.length
            ? 'Loading cards…'
            : `${filtered.length} card${filtered.length === 1 ? '' : 's'} · ${filtered.filter(isOwned).length} collected`}
        </p>

        <div ref={gridRef}>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
              {cards.length ? (
                <>
                  No cards match.{' '}
                  <button type="button" className="font-semibold text-gold hover:underline" onClick={resetFilters}>
                    Clear filters
                  </button>
                </>
              ) : (
                'Load league data to start a collection.'
              )}
            </div>
          ) : (
            <ul className="cc-grid" style={{ ['--cc-cols' as string]: cols, ['--cc-gap' as string]: `${gap}px` }} aria-label="Cards">
              {shown.map((c) => {
                const have = isOwned(c);
                return (
                  <li key={c.key}>
                    <CollectibleCard
                      player={byKey.get(c.key)!.player}
                      rarity={c.rarity}
                      owned={have}
                      ovr={c.ovr}
                      number={c.number}
                      retiredBy={c.retiredBy}
                      setNo={c.setNo}
                      setTotal={cards.length}
                      hint={c.hint}
                      onOpen={have ? () => setSelected(c.player) : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {shownCount < filtered.length && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="h-10 rounded-md border border-line bg-panel px-4 text-sm font-semibold hover:border-gold/60"
            >
              Show more ({filtered.length - shownCount} left)
            </button>
          </div>
        )}
      </section>

      <PackOpening
        open={packOpen}
        onOpenChange={setPackOpen}
        onTear={tear}
        describe={(pc) => byKey.get(`${pc.player.position}:${pc.player.name}`)!}
        total={cards.length}
      />
      <PlayerDetailCard player={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default CollectionTab;
