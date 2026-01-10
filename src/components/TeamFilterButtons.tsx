import { useMemo } from 'react';
import { NFL_TEAMS, findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface TeamFilterButtonsProps {
  players: { team?: string }[];
  selectedTeam: string | null;
  onSelectTeam: (teamId: string | null) => void;
}

const TeamFilterButtons = ({ players, selectedTeam, onSelectTeam }: TeamFilterButtonsProps) => {
  // Get unique teams from players
  const availableTeams = useMemo(() => {
    const teamNames = new Set<string>();
    players.forEach(p => {
      if (p.team) teamNames.add(p.team);
    });
    
    const teams: NFLTeam[] = [];
    teamNames.forEach(name => {
      const team = findNFLTeam(name);
      if (team && !teams.find(t => t.id === team.id)) {
        teams.push(team);
      }
    });
    
    // Sort by conference then division then name
    return teams.sort((a, b) => {
      if (a.conference !== b.conference) return a.conference.localeCompare(b.conference);
      if (a.division !== b.division) return a.division.localeCompare(b.division);
      return a.name.localeCompare(b.name);
    });
  }, [players]);

  if (availableTeams.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Filter by Team</h4>
        {selectedTeam && (
          <button
            onClick={() => onSelectTeam(null)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-primary/10"
          >
            <X className="w-3 h-3" />
            Clear filter
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {availableTeams.map((team) => {
          const isSelected = selectedTeam === team.id;
          return (
            <button
              key={team.id}
              onClick={() => onSelectTeam(isSelected ? null : team.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all duration-200",
                "hover:scale-105 active:scale-95 min-w-[72px]",
                isSelected
                  ? "shadow-lg"
                  : "border-border/30 hover:border-border/60"
              )}
              style={{
                borderColor: isSelected ? `hsl(${team.primaryColor})` : undefined,
                background: isSelected 
                  ? `linear-gradient(135deg, hsl(${team.primaryColor} / 0.25) 0%, hsl(${team.secondaryColor} / 0.15) 100%)`
                  : `linear-gradient(135deg, hsl(${team.primaryColor} / 0.08) 0%, hsl(${team.secondaryColor} / 0.04) 100%)`,
                boxShadow: isSelected ? `0 0 0 2px hsl(${team.primaryColor} / 0.3)` : undefined,
              }}
            >
              <div 
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                  isSelected ? "scale-110" : ""
                )}
                style={{
                  backgroundColor: isSelected 
                    ? `hsl(${team.primaryColor} / 0.2)` 
                    : `hsl(${team.primaryColor} / 0.1)`,
                }}
              >
                <img 
                  src={team.logoUrl} 
                  alt={team.name}
                  className="w-8 h-8 object-contain"
                  loading="lazy"
                />
              </div>
              <span 
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide text-center leading-tight",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
                style={{
                  color: isSelected ? `hsl(${team.primaryColor})` : undefined,
                }}
              >
                {team.abbreviation}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TeamFilterButtons;