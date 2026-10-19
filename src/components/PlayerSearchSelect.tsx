import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getTeamColors } from '@/utils/teamColors';
import type { Player, Position } from '@/types/player';
import TeamLogo from './brand/TeamLogo';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { POSITION_NAMES } from '@/utils/playerMeta';

interface PlayerSearchSelectProps {
  players: Player[];
  /** Selected player key: `${position}:${name}` */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name for the trigger when the visible placeholder is not descriptive enough */
  ariaLabel?: string;
  /** Show each player's official OVR (off in guessing games, where it would give the answer away) */
  showOvr?: boolean;
}

const playerKey = (p: Pick<Player, 'position' | 'name'>) => `${p.position}:${p.name}`;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '');

/** Word-based match instead of cmdk's fuzzy scoring (which matched "Ian F" to anyone on SF).
 * Every typed word must start a word of the entry; name prefixes rank highest. */
export const matchPlayer = (value: string, search: string, keywords?: string[]) => {
  const q = fold(search).trim();
  if (!q) return 1;
  const name = fold(keywords?.[0] ?? value);
  const tokens = fold(value).split(/[\s.:"()-]+/).filter(Boolean);
  const words = q.split(/\s+/);
  // Each typed word must start some word of the player's name, nickname, position or team.
  if (!words.every((w) => tokens.some((t) => t.startsWith(w)))) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/\s+/).some((part) => part.startsWith(words[0]))) return 0.8;
  return 0.4;
};


const POSITION_ORDER: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];

/** Team colour vars for the mini banner (falls back to the site's line colour for free agents / legends without a team). */
const bannerVars = (team?: string): CSSProperties => {
  const c = getTeamColors(team);
  return {
    '--pss-1': c ? `hsl(${c.primary})` : 'hsl(var(--line))',
    '--pss-2': c ? `hsl(${c.secondary})` : 'hsl(var(--muted-foreground))',
  } as CSSProperties;
};

const splitName = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? { first: '', last: name } : { first: name.slice(0, i), last: name.slice(i + 1) };
};

/** One player as a mini version of his card banner: team gradient, jersey number plate, name, logo. */
const MiniBanner = ({ player, number, ovr, compact = false }: { player: Player; number: number; ovr?: number; compact?: boolean }) => {
  const { first, last } = splitName(player.name);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center font-display font-extrabold italic tabular-nums text-white [clip-path:polygon(14%_0,100%_0,86%_100%,0_100%)]',
          compact ? 'h-7 w-9 text-sm' : 'h-9 w-11 text-lg',
        )}
        style={{ background: 'linear-gradient(135deg, var(--pss-1), color-mix(in srgb, var(--pss-1) 70%, black))', textShadow: '0 1px 0 rgb(0 0 0 / 0.5)' }}
      >
        {number}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start text-left leading-none">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {first && <span className="shrink-0 font-pixel text-[8px] uppercase text-muted-foreground">{first}</span>}
          {player.nickname && !compact && <span className="truncate text-[10px] italic text-muted-foreground">"{player.nickname}"</span>}
        </span>
        <span className={cn('max-w-full truncate text-left font-display font-extrabold uppercase italic tracking-wide text-foreground', compact ? 'text-base' : 'mt-0.5 text-lg')}>{last}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {player.team ? <TeamLogo team={player.team} size={compact ? 20 : 24} decorative /> : <span className="text-[10px] italic text-muted-foreground">FA</span>}
        {ovr != null && (
          <span className="flex min-w-[2.1rem] flex-col items-center rounded border border-[color:var(--pss-1)] bg-black/50 px-1 py-0.5">
            <span className="font-display text-sm font-extrabold leading-none tabular-nums text-chalk">{ovr}</span>
            <span className="font-pixel text-[6px] uppercase text-muted-foreground">OVR</span>
          </span>
        )}
      </span>
    </span>
  );
};

/**
 * Searchable player picker (name, nickname, position or team). Results are grouped by position under small
 * position tags, each player drawn as a mini banner in his team colours with his jersey number.
 */
const PlayerSearchSelect = ({
  players,
  value,
  onValueChange,
  placeholder = 'Search players...',
  ariaLabel,
  showOvr = false,
}: PlayerSearchSelectProps) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const extras = usePlayerExtras();
  const { numberFor } = useJerseyNumbers();
  const ovrMap = useOfficialOvr();

  const selectedPlayer = value ? players.find((p) => playerKey(p) === value) ?? null : null;

  // Position groups in football order; best players first inside each (by OVR, then name)
  const groups = useMemo(() => {
    const by = new Map<Position, Player[]>();
    players.forEach((p) => by.set(p.position, [...(by.get(p.position) ?? []), p]));
    const ovrOf = (p: Player) => ovrMap.get(playerKey(p)) ?? 0;
    return POSITION_ORDER.filter((k) => by.has(k)).map((k) => ({
      pos: k,
      players: by.get(k)!.sort((a, b) => ovrOf(b) - ovrOf(a) || a.name.localeCompare(b.name)),
    }));
  }, [players, ovrMap]);
  const shown = pos === 'ALL' ? groups : groups.filter((g) => g.pos === pos);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPos('ALL');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ? `${ariaLabel}${selectedPlayer ? `: ${selectedPlayer.name}` : ''}` : undefined}
          className="h-12 w-full justify-between gap-2 border-line bg-night/60 px-2.5 hover:bg-panel-2"
          style={
            selectedPlayer
              ? {
                  ...bannerVars(selectedPlayer.team),
                  boxShadow: 'inset 3px 0 0 var(--pss-1), inset 0 0 0 1px color-mix(in srgb, var(--pss-1) 45%, transparent)',
                  background: 'linear-gradient(100deg, color-mix(in srgb, var(--pss-1) 30%, transparent), transparent 70%)',
                }
              : undefined
          }
        >
          {selectedPlayer ? (
            <MiniBanner
              player={selectedPlayer}
              number={numberFor(selectedPlayer)}
              ovr={showOvr ? ovrMap.get(playerKey(selectedPlayer)) : undefined}
              compact
            />
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" aria-hidden="true" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      {/* Fixed list height + above the sticky header (z-50): the popover no longer flips or hides while typing. */}
      <PopoverContent
        className="z-[70] w-[min(520px,calc(100vw-1.5rem))] overflow-hidden border-line bg-popover p-0 shadow-elevated"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
      >
        <Command className="bg-popover" filter={matchPlayer}>
          <CommandInput placeholder="Name, nickname, position or team..." className="h-11" />
          {groups.length > 1 && (
            <div role="group" aria-label="Filter by position" className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5 [scrollbar-width:none]">
              {(['ALL', ...groups.map((g) => g.pos)] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={pos === k}
                  onClick={() => setPos(k)}
                  className={cn(
                    'shrink-0 rounded px-2 py-0.5 font-pixel text-[9px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                    pos === k ? 'bg-gold text-black' : 'bg-panel-2 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {k === 'ALL' ? 'All' : k}
                </button>
              ))}
            </div>
          )}
          <CommandList className="h-80 max-h-[55vh] overscroll-contain">
            <CommandEmpty>No player found.</CommandEmpty>
            {shown.map((g) => (
              <CommandGroup
                key={g.pos}
                heading={
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 font-pixel text-[9px] text-gold ring-1 ring-gold/40">{g.pos}</span>
                    <span className="font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{POSITION_NAMES[g.pos]}s</span>
                  </span>
                }
                className="overflow-visible px-1.5 pb-1 pt-0 [&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-10 [&_[cmdk-group-heading]]:-mx-1.5 [&_[cmdk-group-heading]]:bg-popover/95 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:backdrop-blur"
              >
                {g.players.map((player) => {
                  const key = playerKey(player);
                  const isSelected = value === key;
                  return (
                    <CommandItem
                      key={key}
                      keywords={[player.name]}
                      value={`${player.name} ${player.nickname ?? ''} ${extras.formerNames[normalizeName(player.name)] ?? ''} ${player.position} ${player.team || 'no team'} ${key}`}
                      onSelect={() => {
                        onValueChange(isSelected ? '' : key);
                        setOpen(false);
                      }}
                      aria-label={`${player.name}${player.team ? `, ${player.team}` : ''}, number ${numberFor(player)}`}
                      className={cn(
                        'my-1 cursor-pointer overflow-hidden rounded-md px-2 py-1.5 text-foreground transition-[box-shadow,transform] motion-safe:data-[selected=true]:translate-x-0.5',
                        'data-[selected=true]:bg-transparent data-[selected=true]:text-foreground',
                        'shadow-[inset_3px_0_0_var(--pss-1),inset_0_0_0_1px_hsl(var(--line)/0.6)]',
                        'data-[selected=true]:shadow-[inset_3px_0_0_var(--pss-1),inset_0_0_0_2px_hsl(var(--gold))]',
                        isSelected && 'shadow-[inset_3px_0_0_var(--pss-1),inset_0_0_0_2px_hsl(var(--gold)/0.7)]',
                      )}
                      style={{
                        ...bannerVars(player.team),
                        background: 'linear-gradient(100deg, color-mix(in srgb, var(--pss-1) 28%, transparent), color-mix(in srgb, var(--pss-1) 6%, transparent) 55%, transparent 80%)',
                      }}
                    >
                      <MiniBanner player={player} number={numberFor(player)} ovr={showOvr ? ovrMap.get(key) : undefined} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default PlayerSearchSelect;
