import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getTeamColors } from '@/utils/teamColors';
import type { Player, Position } from '@/types/player';

interface PlayerSearchSelectProps {
  players: Player[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

const getPositionColor = (position: Position): string => {
  switch (position) {
    case 'QB': return 'text-red-400';
    case 'RB': return 'text-emerald-400';
    case 'WR': return 'text-blue-400';
    case 'TE': return 'text-purple-400';
    case 'OL': return 'text-amber-400';
    case 'LB': return 'text-orange-400';
    case 'DB': return 'text-cyan-400';
    case 'DL': return 'text-pink-400';
    default: return 'text-muted-foreground';
  }
};

const PlayerSearchSelect = ({ players, value, onValueChange, placeholder = "Search players..." }: PlayerSearchSelectProps) => {
  const [open, setOpen] = useState(false);

  const selectedPlayer = value ? players.find(p => `${p.position}:${p.name}` === value) : null;
  const teamColors = selectedPlayer ? getTeamColors(selectedPlayer.team) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-11 bg-background/50 hover:bg-background/70 border-border/50"
          style={teamColors ? {
            borderColor: `hsl(${teamColors.primary} / 0.4)`,
            background: `linear-gradient(90deg, hsl(${teamColors.primary} / 0.1), transparent)`
          } : undefined}
        >
          {selectedPlayer ? (
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-bold", getPositionColor(selectedPlayer.position))}>
                {selectedPlayer.position}
              </span>
              <span className="font-medium">{selectedPlayer.name}</span>
              {selectedPlayer.team ? (
                <span 
                  className="text-xs"
                  style={teamColors ? { color: `hsl(${teamColors.primary})` } : undefined}
                >
                  {selectedPlayer.team}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Retired</span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <Search className="w-4 h-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-background border border-border/50 shadow-2xl z-50" align="start">
        <Command className="bg-background">
          <CommandInput placeholder="Type to search..." className="h-10 border-b border-border/30" />
          <CommandList className="max-h-72">
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup>
              {players.map((player) => {
                const playerKey = `${player.position}:${player.name}`;
                const playerTeamColors = getTeamColors(player.team);
                const isSelected = value === playerKey;
                
                return (
                  <CommandItem
                    key={playerKey}
                    value={`${player.name} ${player.position} ${player.team || 'retired'}`}
                    onSelect={() => {
                      onValueChange(playerKey === value ? '' : playerKey);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 cursor-pointer py-2.5 px-3 mx-1 my-0.5 rounded-lg transition-all",
                      isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                    )}
                    style={playerTeamColors ? {
                      borderLeft: `3px solid hsl(${playerTeamColors.primary} / 0.6)`
                    } : {
                      borderLeft: '3px solid hsl(var(--muted-foreground) / 0.3)'
                    }}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <span className={cn("text-xs font-bold w-6", getPositionColor(player.position))}>
                      {player.position}
                    </span>
                    <span className="font-medium flex-1 truncate">{player.name}</span>
                    {player.team ? (
                      <span 
                        className="text-xs font-medium"
                        style={playerTeamColors ? { color: `hsl(${playerTeamColors.primary})` } : undefined}
                      >
                        {player.team}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Retired</span>
                    )}
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