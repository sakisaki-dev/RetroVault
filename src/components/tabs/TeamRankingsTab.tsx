import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Building2, Trophy, TrendingUp, Users, Crown, Star } from 'lucide-react';
import { getTeamColors } from '@/utils/teamColors';
import type { Player } from '@/types/player';

interface TeamRanking {
  team: string;
  totalLegacy: number;
  avgLegacy: number;
  playerCount: number;
  rings: number;
  mvps: number;
  topPlayer: { name: string; legacy: number };
  activePlayers: number;
}

const TeamRankingsTab = () => {
  const { careerData, previousData, currentSeason } = useLeague();

  const teamRankings = useMemo((): TeamRanking[] => {
    if (!careerData) return [];

    const allPlayers: Player[] = [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ];

    const teamMap = new Map<string, {
      players: Player[];
      totalLegacy: number;
      rings: number;
      mvps: number;
    }>();

    allPlayers.forEach((p) => {
      const team = p.team || 'Unknown';
      if (!teamMap.has(team)) {
        teamMap.set(team, { players: [], totalLegacy: 0, rings: 0, mvps: 0 });
      }
      const entry = teamMap.get(team)!;
      entry.players.push(p);
      entry.totalLegacy += p.careerLegacy || 0;
      entry.rings += p.rings || 0;
      entry.mvps += p.mvp || 0;
    });

    const rankings: TeamRanking[] = [];
    teamMap.forEach((data, team) => {
      const topPlayer = data.players.reduce((a, b) => 
        (a.careerLegacy || 0) > (b.careerLegacy || 0) ? a : b
      );
      rankings.push({
        team,
        totalLegacy: data.totalLegacy,
        avgLegacy: data.players.length > 0 ? Math.round(data.totalLegacy / data.players.length) : 0,
        playerCount: data.players.length,
        rings: data.rings,
        mvps: data.mvps,
        topPlayer: { name: topPlayer.name, legacy: topPlayer.careerLegacy || 0 },
        activePlayers: data.players.filter((p) => p.status === 'Active').length,
      });
    });

    return rankings.sort((a, b) => b.totalLegacy - a.totalLegacy);
  }, [careerData]);

  const seasonComparison = useMemo(() => {
    if (!careerData || !previousData) return null;

    const getCurrentLegacy = (data: typeof careerData) => {
      const all: Player[] = [
        ...data.quarterbacks,
        ...data.runningbacks,
        ...data.widereceivers,
        ...data.tightends,
        ...data.offensiveline,
        ...data.linebackers,
        ...data.defensivebacks,
        ...data.defensiveline,
      ];
      const teamMap = new Map<string, number>();
      all.forEach((p) => {
        const team = p.team || 'Unknown';
        teamMap.set(team, (teamMap.get(team) || 0) + (p.careerLegacy || 0));
      });
      return teamMap;
    };

    const current = getCurrentLegacy(careerData);
    const previous = getCurrentLegacy(previousData);

    const changes: { team: string; change: number; current: number }[] = [];
    current.forEach((val, team) => {
      const prev = previous.get(team) || 0;
      changes.push({ team, change: val - prev, current: val });
    });

    return changes.sort((a, b) => b.change - a.change);
  }, [careerData, previousData]);

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-4xl font-bold mb-4 text-primary">TEAM POWER RANKINGS</h2>
          <p className="text-muted-foreground text-lg">Upload your league data to view team rankings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="glass-card-glow p-8 text-center">
        <Building2 className="w-14 h-14 text-primary mx-auto mb-4" />
        <h2 className="font-display text-5xl font-bold tracking-wider text-primary mb-2">
          TEAM POWER RANKINGS
        </h2>
        <p className="text-muted-foreground">Combined Career Legacy Across All Players</p>
      </div>

      {/* Season Change Highlights */}
      {seasonComparison && seasonComparison.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 border-b border-border/30 pb-3 mb-4">
            <TrendingUp className="w-5 h-5 text-chart-4" />
            <h3 className="font-display text-xl font-bold text-chart-4">
              SEASON {currentSeason} TEAM MOVEMENT
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {seasonComparison.slice(0, 4).map((item, idx) => {
              const teamColors = getTeamColors(item.team);
              const isPositive = item.change > 0;
              return (
                <div 
                  key={item.team}
                  className="p-4 rounded-lg bg-secondary/30 border border-border/30"
                  style={teamColors ? { borderLeftColor: `hsl(${teamColors.primary})`, borderLeftWidth: '3px' } : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span 
                      className="text-sm font-bold"
                      style={teamColors ? { color: `hsl(${teamColors.primary})` } : undefined}
                    >
                      {item.team}
                    </span>
                    {idx === 0 && <Crown className="w-4 h-4 text-chart-4" />}
                  </div>
                  <p className={`font-mono text-xl font-bold ${isPositive ? 'text-metric-elite' : 'text-destructive'}`}>
                    {isPositive ? '+' : ''}{item.change.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">legacy change</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Rankings */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border/30 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="font-display text-xl font-bold">ALL-TIME FRANCHISE RANKINGS</h3>
          <span className="text-muted-foreground text-sm">({teamRankings.length} teams)</span>
        </div>
        <div className="divide-y divide-border/30">
          {teamRankings.map((team, idx) => {
            const teamColors = getTeamColors(team.team);
            const isTop3 = idx < 3;
            
            return (
              <div 
                key={team.team}
                className="flex items-center gap-6 p-5 hover:bg-secondary/20 transition-colors"
                style={teamColors ? { borderLeft: `4px solid hsl(${teamColors.primary})` } : undefined}
              >
                {/* Rank */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-display text-xl font-bold ${
                  isTop3 ? 'bg-chart-4/20 text-chart-4' : 'bg-secondary/50 text-muted-foreground'
                }`}>
                  {idx + 1}
                </div>

                {/* Team Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span 
                      className="font-display text-2xl tracking-wide"
                      style={teamColors ? { color: `hsl(${teamColors.primary})` } : undefined}
                    >
                      {team.team}
                    </span>
                    {idx === 0 && <Crown className="w-5 h-5 text-chart-4" />}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {team.playerCount} players ({team.activePlayers} active)
                    </span>
                    <span>Top: {team.topPlayer.name}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-6 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Total Legacy</p>
                    <p className="font-mono text-xl font-bold text-primary">{team.totalLegacy.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Avg Legacy</p>
                    <p className="font-mono text-lg font-bold text-foreground">{team.avgLegacy.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Rings</p>
                    <p className="font-mono text-lg font-bold text-chart-4">{team.rings}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">MVPs</p>
                    <p className="font-mono text-lg font-bold text-accent">{team.mvps}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeamRankingsTab;
