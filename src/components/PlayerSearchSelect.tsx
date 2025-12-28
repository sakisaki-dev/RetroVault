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
import type { Player, Position } from '@/types/player';

interface PlayerSearchSelectProps {
  players: Player[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

const getPositionColors = (position: Position): { bg: string; text: string; border: string } => {
  switch (position) {
    case 'QB':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    case 'RB':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'WR':
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' };
    case 'TE':
      return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' };
    case 'OL':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'LB':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
    case 'DB':
      return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' };
    case 'DL':
      return { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' };
    default:
      return { bg: 'bg-secondary', text: 'text-muted-foreground', border: 'border-border' };
  }
};

const PlayerSearchSelect = ({ players, value, onValueChange, placeholder = "Search players..." }: PlayerSearchSelectProps) => {
  const [open, setOpen] = useState(false);

  const selectedPlayer = value ? players.find(p => `${p.position}:${p.name}` === value) : null;
  const selectedColors = selectedPlayer ? getPositionColors(selectedPlayer.position) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-background/50 hover:bg-background/70 h-11",
            selectedColors && `${selectedColors.bg} ${selectedColors.border}`
          )}
        >
          {selectedPlayer ? (
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", selectedColors?.bg, selectedColors?.text)}>
                {selectedPlayer.position}
              </span>
              <span>{selectedPlayer.name}</span>
              {selectedPlayer.team && (
                <span className="text-xs text-muted-foreground">({selectedPlayer.team})</span>
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
      <PopoverContent className="w-[400px] p-0 bg-background border border-border shadow-xl z-50" align="start">
        <Command className="bg-background">
          <CommandInput placeholder="Type to search..." className="h-11" />
          <CommandList className="max-h-80">
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup>
              {players.map((player) => {
                const colors = getPositionColors(player.position);
                const playerKey = `${player.position}:${player.name}`;
                
                return (
                  <CommandItem
                    key={playerKey}
                    value={`${player.name} ${player.position} ${player.team || ''}`}
                    onSelect={() => {
                      onValueChange(playerKey === value ? '' : playerKey);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer my-0.5 rounded-lg border",
                      colors.bg,
                      colors.border,
                      "hover:opacity-80 transition-opacity"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === playerKey ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", colors.bg, colors.text)}>
                      {player.position}
                    </span>
                    <span className="font-medium flex-1">{player.name}</span>
                    {player.team && (
                      <span className="text-xs text-muted-foreground">{player.team}</span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">
                      {player.careerLegacy.toFixed(0)}
                    </span>
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