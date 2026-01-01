import { useState, useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import FileUpload from '../FileUpload';
import QBTable from '../tables/QBTable';
import RBTable from '../tables/RBTable';
import ReceiverTable from '../tables/ReceiverTable';
import OLTable from '../tables/OLTable';
import DefenseTable from '../tables/DefenseTable';
import LeagueOverview from './LeagueOverview';
import TeamFilterButtons from '../TeamFilterButtons';
import { Trophy, Users, Award, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { findNFLTeam } from '@/utils/nflTeams';
import type { Player } from '@/types/player';

const CareerTab = () => {
  const { careerData, loadCareerData, isLoading } = useLeague();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const handleFileLoad = (content: string, filename: string) => {
    loadCareerData(content);
  };

  // All players for team filtering
  const allPlayers = useMemo(() => {
    if (!careerData) return [];
    return [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ];
  }, [careerData]);

  // Team filter function
  const matchesTeamFilter = (player: Player): boolean => {
    if (!selectedTeam) return true;
    const playerTeam = findNFLTeam(player.team);
    return playerTeam?.id === selectedTeam;
  };

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4 glow-text">
            Welcome to Retro Vault
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload your league CSV file to begin tracking career stats, 
            analyzing player performance, and discovering statistical leaders.
          </p>
        </div>
        <div className="max-w-md mx-auto">
          <FileUpload onFileLoad={handleFileLoad} label="Upload Career Data CSV" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <LeagueOverview data={careerData} />
          
          {/* Filter Controls */}
          <div className="glass-card p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="active-only"
                  checked={activeOnly}
                  onCheckedChange={setActiveOnly}
                />
                <Label htmlFor="active-only" className="text-sm text-muted-foreground cursor-pointer">
                  Active players only
                </Label>
              </div>
            </div>
            
            {/* Team Filter Buttons */}
            <TeamFilterButtons 
              players={allPlayers}
              selectedTeam={selectedTeam}
              onSelectTeam={setSelectedTeam}
            />
          </div>
          
          <div className="space-y-6">
            {/* Offense */}
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold tracking-wide text-primary flex items-center gap-2">
                <Award className="w-5 h-5" />
                OFFENSE
              </h2>
              
              {careerData.quarterbacks.length > 0 && (
                <QBTable 
                  players={careerData.quarterbacks.filter(matchesTeamFilter)} 
                  searchQuery={searchQuery} 
                  activeOnly={activeOnly} 
                />
              )}
              
              {careerData.runningbacks.length > 0 && (
                <RBTable 
                  players={careerData.runningbacks.filter(matchesTeamFilter)} 
                  searchQuery={searchQuery} 
                  activeOnly={activeOnly} 
                />
              )}
              
              {careerData.widereceivers.length > 0 && (
                <ReceiverTable 
                  players={careerData.widereceivers.filter(matchesTeamFilter)} 
                  position="WR" 
                  title="Wide Receivers"
                  searchQuery={searchQuery}
                  activeOnly={activeOnly}
                />
              )}
              
              {careerData.tightends.length > 0 && (
                <ReceiverTable 
                  players={careerData.tightends.filter(matchesTeamFilter)} 
                  position="TE" 
                  title="Tight Ends"
                  searchQuery={searchQuery}
                  activeOnly={activeOnly}
                />
              )}
              
              {careerData.offensiveline.length > 0 && (
                <OLTable 
                  players={careerData.offensiveline.filter(matchesTeamFilter)} 
                  searchQuery={searchQuery} 
                  activeOnly={activeOnly} 
                />
              )}
            </div>

            {/* Defense */}
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold tracking-wide text-accent flex items-center gap-2">
                <Users className="w-5 h-5" />
                DEFENSE
              </h2>
              
              {careerData.linebackers.length > 0 && (
                <DefenseTable 
                  players={careerData.linebackers.filter(matchesTeamFilter)} 
                  position="LB" 
                  title="Linebackers"
                  searchQuery={searchQuery}
                  activeOnly={activeOnly}
                />
              )}
              
              {careerData.defensivebacks.length > 0 && (
                <DefenseTable 
                  players={careerData.defensivebacks.filter(matchesTeamFilter)} 
                  position="DB" 
                  title="Defensive Backs"
                  searchQuery={searchQuery}
                  activeOnly={activeOnly}
                />
              )}
              
              {careerData.defensiveline.length > 0 && (
                <DefenseTable 
                  players={careerData.defensiveline.filter(matchesTeamFilter)} 
                  position="DL" 
                  title="Defensive Line"
                  searchQuery={searchQuery}
                  activeOnly={activeOnly}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CareerTab;
