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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Filter by Team</h4>
        {selectedTeam && (
          <button
            onClick={() => onSelectTeam(null)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear filter
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {availableTeams.map((team) => {
          const isSelected = selectedTeam === team.id;
          return (
            <button
              key={team.id}
              onClick={() => onSelectTeam(isSelected ? null : team.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
                "hover:scale-105 active:scale-95",
                isSelected
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-border"
              )}
              style={{
                borderColor: isSelected ? `hsl(${team.primaryColor})` : undefined,
                backgroundColor: isSelected ? `hsl(${team.primaryColor} / 0.15)` : undefined,
              }}
            >
              <img 
                src={team.logoUrl} 
                alt={team.name}
                className="w-6 h-6 object-contain"
                loading="lazy"
              />
              <span 
                className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
                style={{
                  color: isSelected ? `hsl(${team.primaryColor})` : undefined,
                }}
              >
                {team.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TeamFilterButtons;
