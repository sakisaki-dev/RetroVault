import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getTeamColors } from '@/utils/teamColors';
import { findNFLTeam } from '@/utils/nflTeams';
import type { Player } from '@/types/player';
import PositionBadge from './PositionBadge';
import TeamLogo from './brand/TeamLogo';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';

interface PlayerSearchSelectProps {
  players: Player[];
  /** Selected player key: `${position}:${name}` */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name for the trigger when the visible placeholder is not descriptive enough */
  ariaLabel?: string;
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

const TeamTag = ({ team }: { team?: string }) => {
  if (!team) return <span className="text-xs italic text-muted-foreground">No team</span>;
  const nfl = findNFLTeam(team);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <TeamLogo team={team} size={18} decorative />
      <span className="hidden sm:inline">{nfl?.abbreviation ?? team}</span>
    </span>
  );
};

/** Searchable player combobox (name, nickname, position or team), with team logos. */
const PlayerSearchSelect = ({
  players,
  value,
  onValueChange,
  placeholder = 'Search players...',
  ariaLabel,
}: PlayerSearchSelectProps) => {
  const [open, setOpen] = useState(false);
  const extras = usePlayerExtras();

  const selectedPlayer = value ? players.find((p) => playerKey(p) === value) ?? null : null;
  const teamColors = selectedPlayer ? getTeamColors(selectedPlayer.team) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ? `${ariaLabel}${selectedPlayer ? `: ${selectedPlayer.name}` : ''}` : undefined}
          className="h-12 w-full justify-between gap-2 border-line bg-night/60 px-3 hover:bg-panel-2"
          style={
            teamColors
              ? {
                  boxShadow: `inset 3px 0 0 hsl(${teamColors.primary})`,
                  background: `linear-gradient(90deg, hsl(${teamColors.primary} / 0.18), transparent 70%)`,
                }
              : undefined
          }
        >
          {selectedPlayer ? (
            <span className="flex min-w-0 items-center gap-2">
              <PositionBadge position={selectedPlayer.position} />
              <span className="truncate font-semibold text-foreground">{selectedPlayer.name}</span>
              <TeamTag team={selectedPlayer.team} />
            </span>
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
        className="z-[70] w-[min(420px,calc(100vw-2rem))] border-line bg-popover p-0 shadow-elevated"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
      >
        <Command className="bg-popover" filter={matchPlayer}>
          <CommandInput placeholder="Name, nickname, position or team..." className="h-11" />
          <CommandList className="h-72 max-h-[50vh] overscroll-contain">
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup>
              {players.map((player) => {
                const key = playerKey(player);
                const colors = getTeamColors(player.team);
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
                    className={cn(
                      'mx-1 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground',
                      // Readable highlight: dark panel + gold edge instead of the green accent fill
                      'data-[selected=true]:bg-panel-2 data-[selected=true]:text-foreground data-[selected=true]:ring-1 data-[selected=true]:ring-gold/70',
                      isSelected && 'bg-panel',
                    )}
                    style={{ boxShadow: `inset 3px 0 0 ${colors ? `hsl(${colors.primary})` : 'hsl(var(--line))'}` }}
                  >
                    <Check
                      className={cn('h-4 w-4 shrink-0 text-gold', isSelected ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <PositionBadge position={player.position} className="min-w-[2.25rem]" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{player.name}</span>
                      </span>
                      {player.nickname && (
                        <span className="truncate text-[11px] italic text-muted-foreground">"{player.nickname}"</span>
                      )}
                    </span>
                    <TeamTag team={player.team} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default PlayerSearchSelect;
