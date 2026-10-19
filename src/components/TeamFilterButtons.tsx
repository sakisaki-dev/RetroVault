import { useMemo } from 'react';
import { X } from 'lucide-react';
import { getUniqueTeamsFromPlayers } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { cn } from '@/lib/utils';
import TeamLogo from './brand/TeamLogo';

interface TeamFilterButtonsProps {
  players: { team?: string }[];
  selectedTeam: string | null;
  onSelectTeam: (teamId: string | null) => void;
}

const TeamFilterButtons = ({ players, selectedTeam, onSelectTeam }: TeamFilterButtonsProps) => {
  const availableTeams = useMemo(() => getUniqueTeamsFromPlayers(players), [players]);

  if (availableTeams.length === 0) return null;

  return (
    <div className="space-y-2" role="group" aria-labelledby="team-filter-label">
      <div className="flex items-center justify-between gap-2">
        <h4 id="team-filter-label" className="font-pixel text-[10px] uppercase text-muted-foreground">
          Filter by team
        </h4>
        {selectedTeam && (
          <button
            type="button"
            onClick={() => onSelectTeam(null)}
            className="flex items-center gap-1 text-xs font-medium text-gold hover:text-gold/80 px-2 py-1 rounded"
          >
            <X className="w-3 h-3" aria-hidden="true" />
            Clear filter
          </button>
        )}
      </div>
      <ul className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:flex-wrap sm:overflow-visible">
        {availableTeams.map((team) => {
          const isSelected = selectedTeam === team.id;
          return (
            <li key={team.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelectTeam(isSelected ? null : team.id)}
                aria-pressed={isSelected}
                title={team.fullName}
                className={cn(
                  'flex items-center gap-1.5 h-9 pl-1.5 pr-2.5 rounded-md border transition-colors',
                  isSelected ? 'border-transparent' : 'border-border bg-secondary/40 hover:bg-secondary',
                )}
                style={
                  isSelected
                    ? { background: `hsl(${team.primaryColor})`, boxShadow: `inset 0 -3px 0 hsl(${team.secondaryColor})` }
                    : undefined
                }
              >
                <TeamLogo team={team} size={24} decorative />
                <span
                  className="font-display text-sm font-bold uppercase tracking-wide"
                  style={{ color: isSelected ? getReadableTextOn(team.primaryColor) : undefined }}
                >
                  {team.abbreviation}
                </span>
                <span className="sr-only">{team.fullName}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TeamFilterButtons;
