import { ovrLabelOf } from '@/utils/useOfficialOvr';
import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent as RTouchEvent } from 'react';
import { Clock, CornerDownLeft, Search, Shield, Star, X } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import { isHallOfFamer } from '@/config/stats';
import { useSkillRatings } from '@/utils/useSkillRatings';
import { useJerseyNumbers } from '@/utils/jerseys';
import { bannerTeamOf, usePlayerExtras } from '@/utils/playerExtras';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { searchTeams } from '@/utils/teamSearch';
import { buildSearchIndex, keyOfPlayer, pushRecent, readRecent, searchPlayers } from '@/utils/playerSearch';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { warmPlayerCard } from '@/components/player/warmPlayerCard';
import { PEEK_ACTION_EVENT, peekProps } from '@/components/peek/peekProps';
import GameSprite from '@/components/GameSprite';
import InLeague from '@/components/InLeague';
import TeamLogo from '@/components/brand/TeamLogo';
import './searchSheet.css';

/*
 * The phone player search: a full-screen sheet, like a native app's search.
 *
 *   Opening   the caller opens it inside the tap (flushSync), and the input is focused in this commit's layout
 *             effect, so iOS raises the keyboard with it. The sheet sizes itself to the visual viewport, so results
 *             end above the keyboard, and respects the safe areas.
 *   Typing    the index is built once per player pool (utils/playerSearch.ts, cached by the pool), results follow a
 *             deferred copy of the query, and only the top 20 render (rows memoised by player). Enter or the
 *             keyboard's Go picks the first result (marked GO).
 *   Empty     recent players (shared localStorage list), then the caller's suggestions.
 *   Closing   Cancel, Escape, or a swipe down on the header (or on the list from its top); scrolling the list drops
 *             the keyboard. A quick-look action closes it too.
 *
 * Rows are the site's search rows: his sprite on a floor, position and number, LAST NAME in condensed italics, the
 * club line, OVR; the row wears his club colours (edge and tint). Desktop never shows this (the dropdowns stay).
 */

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
const LIMIT = 20;

export interface SheetGroup {
  id: string;
  label: string;
  players: Player[];
}

export interface PlayerSearchSheetProps {
  open: boolean;
  onClose: () => void;
  /** Everyone who can be picked */
  players: Player[];
  ovrMap?: Map<string, number>;
  onPick: (p: Player) => void;
  /** Pixel kicker over the title word */
  title?: string;
  /** The marquee word (gold, condensed italic) */
  word?: string;
  placeholder?: string;
  /** OVR and skill grade on the rows (off in guessing games) */
  showOvr?: boolean;
  /** The Active tag (off in guessing games: never a clue) */
  showActive?: boolean;
  /** Press and hold a row for the quick look */
  peek?: boolean;
  /** Shown under the recent players while the field is empty */
  suggestions?: SheetGroup[];
  selectedKey?: string;
  /** A footer note (the header search's pool size) */
  footer?: ReactNode;
  /** Clubs matching the query lead the results (the header search); picking one calls this */
  onPickTeam?: (team: NFLTeam) => void;
}

const teamVars = (team?: string): CSSProperties => {
  const t = findNFLTeam(team);
  return {
    '--ss-1': t ? `hsl(${t.primaryColor})` : 'hsl(var(--line))',
    '--ss-2': t ? `hsl(${t.secondaryColor})` : 'hsl(var(--muted-foreground))',
  } as CSSProperties;
};

const splitName = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? { first: '', last: name } : { first: name.slice(0, i), last: name.slice(i + 1) };
};

interface RowProps {
  player: Player;
  number: number;
  ovr?: number;
  grade?: { grade: string; color: string };
  showActive: boolean;
  peek: boolean;
  first: boolean;
  selected: boolean;
  onPick: (p: Player) => void;
}

const Row = memo(({ player: p, number, ovr, grade, showActive, peek, first, selected, onPick }: RowProps) => {
  const { first: firstName, last } = splitName(p.name);
  const club = bannerTeamOf(p);
  const team = findNFLTeam(club);
  return (
    <li>
      <button
        type="button"
        className="ss-row"
        style={teamVars(club)}
        data-first={first ? '' : undefined}
        aria-current={selected ? 'true' : undefined}
        onPointerDown={() => warmPlayerCard(p)}
        onClick={() => onPick(p)}
        aria-label={`${p.name}, ${p.position}${team ? `, ${team.fullName}` : ''}${ovr != null ? `, ${ovrLabelOf(p)} ${ovr}` : ''}`}
        {...(peek ? peekProps(p) : {})}
      >
        <span className="ss-logo" aria-hidden="true">
          {club && <TeamLogo team={club} size={72} decorative />}
        </span>
        <span className="ss-fig" aria-hidden="true">
          <span className="ss-floor" />
          <GameSprite player={p} kind="figure" size="s" legend={p.isRealLegend} />
        </span>
        <span className="ss-id">
          <span className="ss-line1">
            <span className="ss-pos">{p.position}</span>
            <span className="ss-num">#{number}</span>
            {firstName && <span className="ss-first">{firstName}</span>}
            {!p.isRealLegend && isHallOfFamer(p) && <Star className="ss-star" aria-label="Hall of Famer" />}
            {p.isRealLegend && <span className="ss-nfl">NFL</span>}
          </span>
          <span className="ss-last">{last}</span>
          <span className="ss-club">
            {team ? team.name : p.isRealLegend ? 'Real NFL' : 'Free agent'}
            {p.nickname ? <i> · "{p.nickname}"</i> : null}
            {showActive && <InLeague player={p} />}
          </span>
        </span>
        <span className="ss-right">
          {first && (
            <span className="ss-go" aria-hidden="true">
              <CornerDownLeft className="h-2.5 w-2.5" />
              Go
            </span>
          )}
          {grade && (
            <span className="ss-grade" style={{ background: grade.color }}>
              {grade.grade}
            </span>
          )}
          {ovr != null && (
            <span className="ss-ovr">
              <b>{ovr}</b>
              <i>{ovrLabelOf(p)}</i>
            </span>
          )}
        </span>
      </button>
    </li>
  );
});
Row.displayName = 'SearchSheetRow';

interface ListProps {
  query: string;
  pos: Position | 'ALL';
  players: Player[];
  ovrMap?: Map<string, number>;
  showOvr: boolean;
  showActive: boolean;
  peek: boolean;
  suggestions?: SheetGroup[];
  selectedKey?: string;
  onPick: (p: Player) => void;
  onPickTeam?: (team: NFLTeam) => void;
  /** Reports the Enter target (the first row) */
  firstRef: { current: Player | null };
}

/** Results for the deferred query: re-renders only when the deferred query, filter or pool change */
const Results = memo(({ query, pos, players, ovrMap, showOvr, showActive, peek, suggestions, selectedKey, onPick, onPickTeam, firstRef }: ListProps) => {
  const extras = usePlayerExtras();
  const skills = useSkillRatings();
  const { numberFor } = useJerseyNumbers();
  const index = useMemo(() => buildSearchIndex(players, { ovr: ovrMap, formerNames: extras.formerNames }), [players, ovrMap, extras]);
  const keep = useMemo(() => (pos === 'ALL' ? undefined : (p: Player) => p.position === pos), [pos]);
  const groups = useMemo((): SheetGroup[] => {
    if (query.trim()) return [{ id: 'results', label: 'Results', players: searchPlayers(index, query, LIMIT, keep).map((e) => e.p) }];
    const recent = readRecent()
      .map((k) => index.byKey.get(k)?.p)
      .filter((p): p is Player => !!p && (!keep || keep(p)));
    const seen = new Set(recent.map(keyOfPlayer));
    const more = (suggestions ?? []).map((g) => {
      const ps = g.players.filter((p) => !seen.has(keyOfPlayer(p)) && (!keep || keep(p))).slice(0, LIMIT);
      ps.forEach((p) => seen.add(keyOfPlayer(p)));
      return { ...g, players: ps };
    });
    return [{ id: 'recent', label: 'Recent', players: recent }, ...more].filter((g) => g.players.length);
  }, [query, index, keep, suggestions]);
  const clubs = useMemo(() => (onPickTeam && pos === 'ALL' ? searchTeams(query) : []), [onPickTeam, pos, query]);
  const firstPlayer = query.trim() ? groups[0]?.players[0] ?? null : null;
  useLayoutEffect(() => {
    firstRef.current = firstPlayer;
  }, [firstPlayer, firstRef]);

  const clubList = clubs.length > 0 && (
    <section aria-label="Teams">
      <h3 className="ss-head">
        <span className="lamp">
          <Shield className="h-3 w-3" aria-hidden="true" />
          Teams
        </span>
      </h3>
      <ul className="ss-list">
        {clubs.map((t) => (
          <li key={t.id}>
            <button type="button" className="ss-team" style={teamVars(t.name)} onClick={() => onPickTeam?.(t)}>
              <TeamLogo team={t.name} size={34} decorative />
              <span className="ss-team__text">
                <span className="ss-team__name">{t.name}</span>
                <span className="ss-team__sub">
                  {t.city} · {t.conference} {t.division}
                </span>
              </span>
              <span className="ss-team__go">Team page</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  if (!groups.length && !clubList)
    return (
      <p className="ss-empty">
        {query.trim() ? (
          <>
            No player matches <b>{query.trim()}</b>
            {pos !== 'ALL' ? ` at ${pos}` : ''}.
          </>
        ) : (
          'Type a name, nickname, club or position.'
        )}
      </p>
    );
  return (
    <>
      {clubList}
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className="ss-head">
            <span className="lamp">
              {g.id === 'recent' ? <Clock className="h-3 w-3" aria-hidden="true" /> : <Search className="h-3 w-3" aria-hidden="true" />}
              {g.label}
              {g.id === 'results' && <b>{g.players.length >= LIMIT ? `Top ${LIMIT}` : g.players.length}</b>}
            </span>
          </h3>
          <ul className="ss-list">
            {g.players.map((p, i) => {
              const k = keyOfPlayer(p);
              return (
                <Row
                  key={k}
                  player={p}
                  number={numberFor(p)}
                  ovr={showOvr ? ovrMap?.get(k) : undefined}
                  grade={showOvr ? skills.get(k)?.grade : undefined}
                  showActive={showActive}
                  peek={peek}
                  first={!!query.trim() && g === groups[0] && i === 0}
                  selected={selectedKey === k}
                  onPick={onPick}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
});
Results.displayName = 'SearchSheetResults';

const PlayerSearchSheet = (props: PlayerSearchSheetProps) => {
  // Mounted while open and through its exit
  const [shown, setShown] = useState(props.open);
  if (props.open && !shown) setShown(true);
  if (!shown) return null;
  return <Sheet {...props} onGone={() => setShown(false)} />;
};

const Sheet = ({
  open,
  onClose,
  players,
  ovrMap,
  onPick,
  title = 'Retro Vault',
  word = 'Scout',
  placeholder = 'Name, nickname, club or position',
  showOvr = true,
  showActive = true,
  peek = true,
  suggestions,
  selectedKey,
  footer,
  onPickTeam,
  onGone,
}: PlayerSearchSheetProps & { onGone: () => void }) => {
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const deferredQuery = useDeferredValue(query);
  const deferredPos = useDeferredValue(pos);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const firstRef = useRef<Player | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const swipeRef = useSwipeToDismiss<HTMLDivElement>({ onDismiss: () => closeRef.current(), enabled: open, backdrop: () => backdropRef.current });

  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const pick = useRef((p: Player) => {
    pushRecent(keyOfPlayer(p));
    pickRef.current(p);
  }).current;

  // Focus in the opening commit (the caller opened us inside the tap: iOS raises the keyboard)
  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      if (prev && prev !== document.body && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [open]);

  // Fit the visual viewport: with the keyboard up, the sheet ends at the keyboard (no result hides behind it).
  // Written straight to the element: no React render per viewport change.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      el.style.height = `${Math.round(vv.height)}px`;
      el.style.transform = vv.offsetTop ? `translateY(${Math.round(vv.offsetTop)}px)` : '';
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    return () => {
      vv.removeEventListener('resize', on);
      vv.removeEventListener('scroll', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // The page under the sheet doesn't scroll
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // A quick-look action (open card, Deep Dive...) takes over: close
  useEffect(() => {
    const on = () => closeRef.current();
    window.addEventListener(PEEK_ACTION_EVENT, on);
    return () => window.removeEventListener(PEEK_ACTION_EVENT, on);
  }, []);

  // Closing: slide away (or, after a swipe, just go: the swipe already moved it out)
  useEffect(() => {
    if (open) return;
    inputRef.current?.blur();
    const panel = panelRef.current;
    if (!panel || panel.dataset.swiped !== undefined || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onGone();
      return;
    }
    const t = window.setTimeout(onGone, 600);
    const end = (e: AnimationEvent) => {
      if (e.target === panel) onGone();
    };
    panel.addEventListener('animationend', end);
    return () => {
      window.clearTimeout(t);
      panel.removeEventListener('animationend', end);
    };
  }, [open, onGone]);

  // Scrolling the results drops the keyboard, like a native search
  const touchY = useRef(0);
  const onListTouchStart = (e: RTouchEvent) => {
    touchY.current = e.touches[0]?.clientY ?? 0;
  };
  const onListTouchMove = (e: RTouchEvent) => {
    const y = e.touches[0]?.clientY ?? 0;
    if (Math.abs(y - touchY.current) > 12 && document.activeElement === inputRef.current) inputRef.current?.blur();
  };

  const stale = query !== deferredQuery || pos !== deferredPos;

  return (
    <div ref={rootRef} className="ss-root" data-state={open ? 'open' : 'closed'}>
      <div ref={backdropRef} className="ss-backdrop" aria-hidden="true" />
      <div
        ref={(n) => {
          panelRef.current = n;
          swipeRef(n);
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Search players"
        data-peek-ok
        className="ss-panel"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="ss-top" data-swipe-handle>
          <span className="ss-grab" aria-hidden="true" />
          <div className="ss-kicker">
            <span className="ss-brand">
              <i>{title}</i>
              <b>{word}</b>
            </span>
            <button type="button" className="ss-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
          <form
            role="search"
            className="ss-field"
            onSubmit={(e) => {
              e.preventDefault();
              // The first result of what was typed (computed now if the deferred list is a frame behind)
              const p = stale ? searchPlayers(buildSearchIndex(players, { ovr: ovrMap }), query, 1, pos === 'ALL' ? undefined : (x) => x.position === pos)[0]?.p : firstRef.current;
              if (p) pick(p);
            }}
          >
            <Search className="ss-field__icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Search players"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="ss-clear"
                aria-label="Clear"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </form>
          <div role="group" aria-label="Filter by position" className="ss-chips" data-no-swipe>
            {(['ALL', ...POSITIONS] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={pos === k}
                className="ss-chip"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setPos(pos === k && k !== 'ALL' ? 'ALL' : k)}
              >
                {k === 'ALL' ? 'All' : k}
              </button>
            ))}
          </div>
        </div>
        <div className={cn('ss-scroll', stale && 'is-stale')} onTouchStart={onListTouchStart} onTouchMove={onListTouchMove}>
          <Results
            query={deferredQuery}
            pos={deferredPos}
            players={players}
            ovrMap={ovrMap}
            showOvr={showOvr}
            showActive={showActive}
            peek={peek}
            suggestions={suggestions}
            selectedKey={selectedKey}
            onPick={pick}
            onPickTeam={onPickTeam}
            firstRef={firstRef}
          />
          {footer && <p className="ss-foot">{footer}</p>}
        </div>
      </div>
    </div>
  );
};

export default PlayerSearchSheet;
