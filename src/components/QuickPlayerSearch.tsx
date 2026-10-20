import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Clock, Radar, Search, Sparkles, Star } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { playerKey } from '@/config/ovr';
import { isHallOfFamer } from '@/config/stats';
import { useGamePool } from '@/utils/useOfficialOvr';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useSkillRatings } from '@/utils/useSkillRatings';
import { getTeamColors } from '@/utils/teamColors';
import { findNFLTeam } from '@/utils/nflTeams';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import PlayerDetailCard from './PlayerDetailCard';
import TeamLogo from './brand/TeamLogo';
import { matchPlayer } from './PlayerSearchSelect';
import { openInCompFinder } from './stats/comps/compFinderLink';
import './quickSearch.css';

/** Fired by the header's search button (and anything else) to open the quick search. */
export const QUICK_SEARCH_EVENT = 'retrovault:quick-search';
export const openQuickSearch = () => window.dispatchEvent(new Event(QUICK_SEARCH_EVENT));

const RECENT_KEY = 'retroVault:search:recent';
const CURRENT_CLUB = 'Jets';
const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];

const readRecent = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
};
const pushRecent = (key: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, 6)));
  } catch {
    /* storage unavailable */
  }
};

/** True when the key press happens inside something the user is typing in. */
const typingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

const teamVars = (team?: string): CSSProperties => {
  const c = getTeamColors(team);
  return {
    '--qs-1': c ? `hsl(${c.primary})` : 'hsl(var(--line))',
    '--qs-2': c ? `hsl(${c.secondary})` : 'hsl(var(--muted-foreground))',
  } as CSSProperties;
};

const splitName = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? { first: '', last: name } : { first: name.slice(0, i), last: name.slice(i + 1) };
};

type GradeLike = { grade: string; color: string };

/**
 * One result as a broadcast lower-third in the player's team colours. Highlighted, the whole row fills with his
 * primary colour and the text turns white, so the name always stays readable (no low-contrast highlight).
 */
const ResultRow = ({ player, number, ovr, grade }: { player: Player; number: number; ovr?: number; grade?: GradeLike }) => {
  const { first, last } = splitName(player.name);
  const hof = !player.isRealLegend && isHallOfFamer(player);
  return (
    <span className="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden py-1.5 pl-1.5 pr-2">
      {player.team && (
        <span className="qs-watermark pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2" aria-hidden="true">
          <TeamLogo team={player.team} size={64} decorative />
        </span>
      )}
      <span
        aria-hidden="true"
        className="qs-plate relative flex h-10 w-12 shrink-0 items-center justify-center font-display text-xl font-extrabold italic tabular-nums [clip-path:polygon(14%_0,100%_0,86%_100%,0_100%)]"
      >
        {number}
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col items-start text-left leading-none">
        <span className="flex items-center gap-1.5">
          <span className="qs-pos rounded px-1 py-px font-pixel text-[8px]">{player.position}</span>
          {first && <span className="qs-sub truncate font-pixel text-[9px] uppercase">{first}</span>}
          {hof && <Star className="qs-star h-3 w-3 shrink-0 fill-current" aria-label="Hall of Famer" />}
          {player.isRealLegend && <span className="qs-nfl shrink-0 rounded px-1 py-px font-pixel text-[8px]">NFL</span>}
        </span>
        <span className="qs-name mt-1 max-w-full truncate font-display text-xl font-extrabold uppercase italic tracking-wide">{last}</span>
        {player.nickname && <span className="qs-sub mt-0.5 max-w-full truncate text-[11px] italic">"{player.nickname}"</span>}
      </span>
      <span className="relative flex shrink-0 items-center gap-2">
        {grade && (
          <span className="rounded px-1.5 font-display text-sm font-extrabold text-[#0b1020]" style={{ background: grade.color }} title="Skill grade">
            {grade.grade}
          </span>
        )}
        {ovr != null && (
          <span className="qs-ovr flex min-w-[2.4rem] flex-col items-center rounded-md px-1.5 py-1">
            <span className="font-display text-lg font-extrabold leading-none tabular-nums">{ovr}</span>
            <span className="font-pixel text-[6px] uppercase">OVR</span>
          </span>
        )}
      </span>
    </span>
  );
};

/**
 * Site-wide player lookup ("scouting terminal"): ⌘K / Ctrl+K or "/" from any page (⌘T belongs to the browser),
 * or the header's search button. Enter opens his card (league cards link to the Deep Dive); Shift+Enter goes
 * straight to the Deep Dive.
 */
const QuickPlayerSearch = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const [active, setActive] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const { league, legends, ovrMap } = useGamePool();
  const { numberFor } = useJerseyNumbers();
  const skills = useSkillRatings();
  const extras = usePlayerExtras();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(QUICK_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(QUICK_SEARCH_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setRecent(readRecent());
    else {
      setQuery('');
      setPos('ALL');
    }
  }, [open]);

  // Search text per player (what cmdk filters on); the item value maps back to the player
  const searchText = useMemo(() => {
    const m = new Map<string, Player>();
    [...league, ...legends].forEach((p) => {
      const text = `${p.name} ${p.nickname ?? ''} ${extras.formerNames[normalizeName(p.name)] ?? ''} ${p.position} ${p.team || ''} ${findNFLTeam(p.team)?.fullName ?? ''} ${playerKey(p)}`;
      m.set(text, p);
    });
    return m;
  }, [league, legends, extras]);
  const textOf = useMemo(() => new Map([...searchText.entries()].map(([t, p]) => [playerKey(p), t])), [searchText]);
  const byKey = useMemo(() => new Map([...searchText.values()].map((p) => [playerKey(p), p])), [searchText]);

  // Empty query: recently scouted, the current club, the Hall's best. With a query: everyone, league first.
  const groups = useMemo(() => {
    const ovrOf = (p: Player) => ovrMap.get(playerKey(p)) ?? 0;
    const byOvr = (a: Player, b: Player) => ovrOf(b) - ovrOf(a) || a.name.localeCompare(b.name);
    const inPos = (p: Player) => pos === 'ALL' || p.position === pos;
    if (!query.trim()) {
      const rec = recent.map((k) => byKey.get(k)).filter((p): p is Player => !!p && inPos(p));
      const club = league.filter((p) => findNFLTeam(p.team)?.name === CURRENT_CLUB && p.status !== 'Retired' && inPos(p)).sort(byOvr);
      const hof = league
        .filter((p) => isHallOfFamer(p) && inPos(p))
        .sort((a, b) => b.careerLegacy - a.careerLegacy)
        .slice(0, pos === 'ALL' ? 8 : 20);
      return [
        { id: 'recent', label: 'Recently scouted', Icon: Clock, players: rec },
        { id: 'club', label: `Your ${CURRENT_CLUB}`, Icon: Sparkles, players: club },
        { id: 'hof', label: 'Hall of Fame', Icon: Star, players: hof },
      ].filter((g) => g.players.length);
    }
    return [
      { id: 'league', label: 'League players', Icon: Search, players: league.filter(inPos).sort(byOvr) },
      { id: 'nfl', label: 'Real NFL players', Icon: Star, players: legends.filter(inPos).sort(byOvr) },
    ].filter((g) => g.players.length);
  }, [query, pos, recent, byKey, league, legends, ovrMap]);

  const activePlayer = searchText.get(active) ?? [...searchText.entries()].find(([t]) => t.toLowerCase() === active.toLowerCase())?.[1] ?? groups[0]?.players[0] ?? null;

  const choose = (p: Player, deepDive = false) => {
    pushRecent(playerKey(p));
    setOpen(false);
    if (deepDive && !p.isRealLegend) openInCompFinder(p);
    else setSelected(p);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="qs-root top-[6%] max-h-[calc(var(--safe-h)-3rem)] w-[calc(100vw-1rem)] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[8%]">
          <DialogTitle className="sr-only">Look up a player</DialogTitle>
          <Command
            filter={matchPlayer}
            value={active}
            onValueChange={setActive}
            className="bg-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey && activePlayer) {
                e.preventDefault();
                choose(activePlayer, true);
              }
            }}
          >
            {/* Header: broadcast-style search bar */}
            <div className="qs-head border-b border-line">
              <div className="flex items-center gap-2 px-4 pr-12 pt-3">
                <span className="font-pixel text-[9px] uppercase text-gold">Retro Vault · Scouting desk</span>
                <span className="ml-auto hidden font-pixel text-[8px] uppercase text-muted-foreground sm:inline">
                  {league.length} league · {legends.length} NFL
                </span>
              </div>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Who are we scouting?"
                className="h-12 font-display text-lg tracking-wide placeholder:font-sans placeholder:text-sm"
              />
              <div role="group" aria-label="Filter by position" className="flex gap-1 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
                {(['ALL', ...POSITIONS] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={pos === k}
                    onClick={() => setPos(k)}
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 font-pixel text-[9px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                      pos === k ? 'bg-gold text-black' : 'bg-panel-2 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {k === 'ALL' ? 'All' : k}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <CommandList className="max-h-[min(26rem,calc(var(--dvh)*0.55))] overscroll-contain p-1.5">
                <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">No player by that name in the vault.</CommandEmpty>
                {groups.map((g) => (
                  <CommandGroup
                    key={g.id}
                    heading={
                      <span className="flex items-center gap-1.5">
                        <g.Icon className="h-3 w-3 text-gold" aria-hidden="true" />
                        {g.label}
                      </span>
                    }
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:font-pixel [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {g.players.map((p) => {
                      const key = playerKey(p);
                      return (
                        <CommandItem
                          key={`${g.id}:${key}`}
                          value={textOf.get(key) ?? key}
                          keywords={[p.name]}
                          onSelect={() => choose(p)}
                          className="qs-item my-1 cursor-pointer overflow-hidden rounded-lg p-0"
                          style={teamVars(p.team)}
                        >
                          <ResultRow player={p} number={numberFor(p)} ovr={ovrMap.get(key)} grade={skills.get(key)?.grade} />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-night/60 px-3 py-2 text-[11px] text-muted-foreground">
              <span>
                <kbd className="rounded border border-line px-1">⌘K</kbd> or <kbd className="rounded border border-line px-1">/</kbd> anywhere
              </span>
              <span>
                <kbd className="rounded border border-line px-1">↵</kbd> card
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-line px-1">⇧↵</kbd> <Radar className="h-3 w-3" aria-hidden="true" /> Deep Dive
              </span>
              <span className="ml-auto">
                <kbd className="rounded border border-line px-1">Esc</kbd> close
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
      <PlayerDetailCard player={selected} onClose={() => setSelected(null)} />
    </>
  );
};

export default QuickPlayerSearch;
