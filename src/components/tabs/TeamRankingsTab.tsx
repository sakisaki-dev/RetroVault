import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Building2, Trophy, TrendingUp, Users, Crown, Star, Medal, Target, ArrowUp, ArrowDown } from 'lucide-react';
import { getTeamColors } from '@/utils/teamColors';
import { findNFLTeam } from '@/utils/nflTeams';
import type { Player } from '@/types/player';

interface TeamRanking {
  team: string;
  totalLegacy: number;
  avgLegacy: number;
  playerCount: number;
  rings: number;
  mvps: number;
  topPlayer: { name: string; legacy: number; position: string };
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
        topPlayer: { name: topPlayer.name, legacy: topPlayer.careerLegacy || 0, position: topPlayer.position },
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

  // Get podium teams (top 3)
  const podiumTeams = teamRankings.slice(0, 3);

  return (
    <div className="container mx-auto px-6 py-6 space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl p-8 border border-border/30">
        <div 
          className="absolute inset-0"
          style={{
            background: podiumTeams.length >= 3 
              ? `linear-gradient(135deg, 
                  hsl(${findNFLTeam(podiumTeams[1]?.team)?.primaryColor || 'var(--secondary)'} / 0.1) 0%, 
                  hsl(${findNFLTeam(podiumTeams[0]?.team)?.primaryColor || 'var(--primary)'} / 0.15) 50%, 
                  hsl(${findNFLTeam(podiumTeams[2]?.team)?.primaryColor || 'var(--accent)'} / 0.1) 100%)`
              : 'linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--secondary) / 0.1) 100%)'
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-chart-4/10 via-transparent to-transparent" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-chart-4/20 to-primary/20 border-2 border-chart-4/30 mb-4 shadow-xl shadow-chart-4/10">
            <Building2 className="w-10 h-10 text-chart-4" />
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl font-bold bg-gradient-to-r from-chart-4 via-primary to-accent bg-clip-text text-transparent mb-2">
            FRANCHISE POWER RANKINGS
          </h1>
          <p className="text-muted-foreground text-lg">Combined Career Legacy Across All Players</p>
          
          <div className="flex justify-center gap-4 flex-wrap mt-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/50 border border-border/30">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-display text-xl font-bold text-primary">{teamRankings.length}</span>
              <span className="text-sm text-muted-foreground">Teams</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-chart-4/10 border border-chart-4/30">
              <Trophy className="w-5 h-5 text-chart-4" />
              <span className="font-display text-xl font-bold text-chart-4">{teamRankings.reduce((sum, t) => sum + t.rings, 0)}</span>
              <span className="text-sm text-muted-foreground">Rings</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30">
              <Star className="w-5 h-5 text-primary" />
              <span className="font-display text-xl font-bold text-primary">{teamRankings.reduce((sum, t) => sum + t.mvps, 0)}</span>
              <span className="text-sm text-muted-foreground">MVPs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Podium - Top 3 */}
      {podiumTeams.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 items-end">
          {/* 2nd Place */}
          {(() => {
            const team = podiumTeams[1];
            const nflTeam = findNFLTeam(team.team);
            const teamColors = getTeamColors(team.team);
            return (
              <div 
                className="relative rounded-2xl p-5 pt-10 border-2 h-[220px]"
                style={{
                  borderColor: `hsl(${nflTeam?.primaryColor || 'var(--border)'} / 0.4)`,
                  background: `linear-gradient(180deg, hsl(${nflTeam?.primaryColor || 'var(--secondary)'} / 0.15) 0%, transparent 100%)`
                }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center font-display text-xl font-bold text-white shadow-lg">
                  2
                </div>
                {nflTeam && (
                  <div className="absolute top-4 right-4 opacity-20">
                    <img src={nflTeam.logoUrl} alt="" className="w-16 h-16" />
                  </div>
                )}
                <div className="text-center relative z-10">
                  {nflTeam && (
                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: `hsl(${nflTeam.primaryColor} / 0.2)` }}>
                      <img src={nflTeam.logoUrl} alt={team.team} className="w-10 h-10 object-contain" />
                    </div>
                  )}
                  <p className="font-display text-lg font-bold" style={{ color: `hsl(${nflTeam?.primaryColor || 'var(--foreground)'})` }}>{team.team}</p>
                  <p className="font-mono text-2xl font-bold text-foreground mt-2">{team.totalLegacy.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Legacy</p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <span className="flex items-center gap-1 text-sm"><Trophy className="w-3 h-3 text-chart-4" />{team.rings}</span>
                    <span className="flex items-center gap-1 text-sm"><Star className="w-3 h-3 text-primary" />{team.mvps}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 1st Place */}
          {(() => {
            const team = podiumTeams[0];
            const nflTeam = findNFLTeam(team.team);
            return (
              <div 
                className="relative rounded-2xl p-6 pt-12 border-2 h-[280px]"
                style={{
                  borderColor: `hsl(${nflTeam?.primaryColor || 'var(--chart-4)'} / 0.5)`,
                  background: `linear-gradient(180deg, hsl(${nflTeam?.primaryColor || 'var(--chart-4)'} / 0.2) 0%, hsl(${nflTeam?.secondaryColor || 'var(--chart-4)'} / 0.1) 50%, transparent 100%)`,
                  boxShadow: `0 20px 40px -20px hsl(${nflTeam?.primaryColor || 'var(--chart-4)'} / 0.3)`
                }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                </div>
                {nflTeam && (
                  <div className="absolute top-4 right-4 opacity-20">
                    <img src={nflTeam.logoUrl} alt="" className="w-20 h-20" />
                  </div>
                )}
                <div className="text-center relative z-10">
                  {nflTeam && (
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${nflTeam.primaryColor} / 0.3) 0%, hsl(${nflTeam.secondaryColor} / 0.2) 100%)` }}>
                      <img src={nflTeam.logoUrl} alt={team.team} className="w-14 h-14 object-contain" />
                    </div>
                  )}
                  <p className="font-display text-xl font-bold" style={{ color: `hsl(${nflTeam?.primaryColor || 'var(--chart-4)'})` }}>{team.team}</p>
                  <p className="font-mono text-3xl font-bold text-foreground mt-2">{team.totalLegacy.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Legacy</p>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <div className="text-center">
                      <Trophy className="w-5 h-5 text-chart-4 mx-auto" />
                      <p className="font-bold text-chart-4">{team.rings}</p>
                    </div>
                    <div className="text-center">
                      <Star className="w-5 h-5 text-primary mx-auto" />
                      <p className="font-bold text-primary">{team.mvps}</p>
                    </div>
                    <div className="text-center">
                      <Users className="w-5 h-5 text-accent mx-auto" />
                      <p className="font-bold text-accent">{team.playerCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3rd Place */}
          {(() => {
            const team = podiumTeams[2];
            const nflTeam = findNFLTeam(team.team);
            return (
              <div 
                className="relative rounded-2xl p-5 pt-10 border-2 h-[200px]"
                style={{
                  borderColor: `hsl(${nflTeam?.primaryColor || 'var(--border)'} / 0.4)`,
                  background: `linear-gradient(180deg, hsl(${nflTeam?.primaryColor || 'var(--secondary)'} / 0.12) 0%, transparent 100%)`
                }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center font-display text-xl font-bold text-white shadow-lg">
                  3
                </div>
                {nflTeam && (
                  <div className="absolute top-4 right-4 opacity-20">
                    <img src={nflTeam.logoUrl} alt="" className="w-14 h-14" />
                  </div>
                )}
                <div className="text-center relative z-10">
                  {nflTeam && (
                    <div className="w-12 h-12 mx-auto mb-2 rounded-lg flex items-center justify-center" style={{ background: `hsl(${nflTeam.primaryColor} / 0.2)` }}>
                      <img src={nflTeam.logoUrl} alt={team.team} className="w-8 h-8 object-contain" />
                    </div>
                  )}
                  <p className="font-display text-base font-bold" style={{ color: `hsl(${nflTeam?.primaryColor || 'var(--foreground)'})` }}>{team.team}</p>
                  <p className="font-mono text-xl font-bold text-foreground mt-1">{team.totalLegacy.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Legacy</p>
                  <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-sm"><Trophy className="w-3 h-3 text-chart-4" />{team.rings}</span>
                    <span className="flex items-center gap-1 text-sm"><Star className="w-3 h-3 text-primary" />{team.mvps}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Season Change Highlights */}
      {seasonComparison && seasonComparison.length > 0 && (
        <div className="rounded-2xl border border-border/30 p-6 bg-gradient-to-br from-chart-2/5 to-transparent">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-chart-2/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Season {currentSeason} Movement</h3>
              <p className="text-sm text-muted-foreground">Biggest legacy changes this season</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {seasonComparison.slice(0, 4).map((item, idx) => {
              const nflTeam = findNFLTeam(item.team);
              const isPositive = item.change > 0;
              return (
                <div 
                  key={item.team}
                  className="relative p-4 rounded-xl border overflow-hidden"
                  style={{
                    borderColor: `hsl(${nflTeam?.primaryColor || 'var(--border)'} / 0.3)`,
                    background: `linear-gradient(135deg, hsl(${nflTeam?.primaryColor || 'var(--secondary)'} / 0.1) 0%, transparent 100%)`
                  }}
                >
                  {nflTeam && (
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <img src={nflTeam.logoUrl} alt="" className="w-20 h-20" />
                    </div>
                  )}
                  <div className="relative z-10 flex items-center justify-between mb-2">
                    {nflTeam && <img src={nflTeam.logoUrl} alt={item.team} className="w-8 h-8" />}
                    {idx === 0 && <Medal className="w-5 h-5 text-chart-4" />}
                  </div>
                  <p className="font-bold text-sm" style={{ color: `hsl(${nflTeam?.primaryColor || 'var(--foreground)'})` }}>{item.team}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {isPositive ? <ArrowUp className="w-4 h-4 text-chart-2" /> : <ArrowDown className="w-4 h-4 text-destructive" />}
                    <span className={`font-mono text-xl font-bold ${isPositive ? 'text-chart-2' : 'text-destructive'}`}>
                      {isPositive ? '+' : ''}{item.change.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Rankings */}
      <div className="rounded-2xl border border-border/30 overflow-hidden">
        <div className="p-5 border-b border-border/30 bg-gradient-to-r from-secondary/50 to-transparent flex items-center gap-3">
          <Target className="w-6 h-6 text-primary" />
          <h3 className="font-display text-xl font-bold">Complete Franchise Rankings</h3>
          <span className="text-sm text-muted-foreground">({teamRankings.length} teams)</span>
        </div>
        <div className="divide-y divide-border/20">
          {teamRankings.slice(3).map((team, idx) => {
            const nflTeam = findNFLTeam(team.team);
            const rank = idx + 4;
            
            return (
              <div 
                key={team.team}
                className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors relative overflow-hidden"
              >
                {/* Team gradient background */}
                {nflTeam && (
                  <div 
                    className="absolute inset-0 opacity-[0.03]"
                    style={{ background: `linear-gradient(90deg, hsl(${nflTeam.primaryColor}) 0%, transparent 50%)` }}
                  />
                )}
                
                {/* Rank */}
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center font-display text-lg font-bold text-muted-foreground relative z-10">
                  {rank}
                </div>

                {/* Team Logo & Info */}
                <div className="flex items-center gap-3 flex-1 relative z-10">
                  {nflTeam && (
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `linear-gradient(135deg, hsl(${nflTeam.primaryColor} / 0.2) 0%, hsl(${nflTeam.secondaryColor} / 0.1) 100%)` }}
                    >
                      <img src={nflTeam.logoUrl} alt={team.team} className="w-8 h-8 object-contain" />
                    </div>
                  )}
                  <div>
                    <p 
                      className="font-display text-lg font-bold"
                      style={{ color: `hsl(${nflTeam?.primaryColor || 'var(--foreground)'})` }}
                    >
                      {team.team}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {team.playerCount} players • Top: {team.topPlayer.name}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 text-center relative z-10">
                  <div>
                    <p className="font-mono text-lg font-bold text-primary">{team.totalLegacy.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Legacy</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-foreground">{team.avgLegacy.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Avg</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-chart-4">{team.rings}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Rings</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-accent">{team.mvps}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">MVPs</p>
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