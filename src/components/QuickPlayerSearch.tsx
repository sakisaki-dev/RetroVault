import { useEffect, useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { playerKey } from '@/config/ovr';
import { useGamePool } from '@/utils/useOfficialOvr';
import { useJerseyNumbers } from '@/utils/jerseys';
import { getTeamColors } from '@/utils/teamColors';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import PlayerDetailCard from './PlayerDetailCard';
import PositionBadge from './PositionBadge';
import TeamLogo from './brand/TeamLogo';
import { matchPlayer } from './PlayerSearchSelect';
import { openInCompFinder } from './stats/comps/compFinderLink';

/** Fired by the header's search button (and anything else) to open the quick search. */
export const QUICK_SEARCH_EVENT = 'retrovault:quick-search';
export const openQuickSearch = () => window.dispatchEvent(new Event(QUICK_SEARCH_EVENT));

/** True when the key press happens inside something the user is typing in. */
const typingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

const Row = ({ player, number, ovr }: { player: Player; number: number; ovr?: number }) => {
  const c = getTeamColors(player.team);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-7 w-9 shrink-0 items-center justify-center font-display text-sm font-extrabold italic tabular-nums text-white [clip-path:polygon(14%_0,100%_0,86%_100%,0_100%)]"
        style={{ background: c ? `hsl(${c.primary})` : 'hsl(var(--line))' }}
      >
        {number}
      </span>
      <PositionBadge position={player.position} />
      <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
      {player.isRealLegend && <span className="shrink-0 rounded bg-red-500/15 px-1 font-pixel text-[8px] uppercase text-red-300 ring-1 ring-red-400/40">NFL</span>}
      {player.team && <TeamLogo team={player.team} size={20} decorative />}
      {ovr != null && <span className="w-7 shrink-0 text-right font-display text-sm font-extrabold tabular-nums text-gold">{ovr}</span>}
    </span>
  );
};

/**
 * Site-wide player lookup: ⌘K / Ctrl+K or "/" from any page (⌘T belongs to the browser and can't be used),
 * or the header's search button. Picking a league player opens his Deep Dive; a real NFL player opens his card.
 */
const QuickPlayerSearch = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const { league, legends, ovrMap } = useGamePool();
  const { numberFor } = useJerseyNumbers();
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

  const groups = useMemo(() => {
    const byOvr = (a: Player, b: Player) => (ovrMap.get(playerKey(b)) ?? 0) - (ovrMap.get(playerKey(a)) ?? 0) || a.name.localeCompare(b.name);
    return [
      { label: 'League players', players: [...league].sort(byOvr) },
      { label: 'Real NFL players', players: [...legends].sort(byOvr) },
    ].filter((g) => g.players.length);
  }, [league, legends, ovrMap]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12%] max-w-xl translate-y-0 overflow-hidden border-line p-0 sm:top-[15%]">
          <DialogTitle className="sr-only">Look up a player</DialogTitle>
          <Command filter={matchPlayer} className="bg-popover">
            <CommandInput placeholder="Look up a player: name, nickname, position or team…" className="h-12" />
            <CommandList className="max-h-[60vh] overscroll-contain">
              <CommandEmpty>No player found.</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.label} heading={g.label}>
                  {g.players.map((p) => {
                    const key = playerKey(p);
                    return (
                      <CommandItem
                        key={key}
                        keywords={[p.name]}
                        value={`${p.name} ${p.nickname ?? ''} ${extras.formerNames[normalizeName(p.name)] ?? ''} ${p.position} ${p.team || ''} ${key}`}
                        onSelect={() => {
                          setOpen(false);
                          // League players go to their Deep Dive; real NFL players (no Deep Dive) open their card
                          if (p.isRealLegend) setSelected(p);
                          else openInCompFinder(p);
                        }}
                        className="cursor-pointer rounded-md px-2 py-1.5 data-[selected=true]:bg-panel-2 data-[selected=true]:ring-1 data-[selected=true]:ring-gold/70"
                      >
                        <Row player={p} number={numberFor(p)} ovr={ovrMap.get(key)} />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
            <p className="border-t border-line px-3 py-2 text-[11px] text-muted-foreground">
              <kbd className="rounded border border-line px-1">⌘K</kbd> or <kbd className="rounded border border-line px-1">/</kbd> from any page ·{' '}
              <kbd className="rounded border border-line px-1">↵</kbd> opens his Deep Dive · <kbd className="rounded border border-line px-1">Esc</kbd> closes
            </p>
          </Command>
        </DialogContent>
      </Dialog>
      <PlayerDetailCard player={selected} onClose={() => setSelected(null)} />
    </>
  );
};

export default QuickPlayerSearch;
