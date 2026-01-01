import { useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import FileUpload from '../FileUpload';
import { 
  Calendar, TrendingUp, TrendingDown, Star, Zap, Trophy, Crown, Newspaper, Target,
  UserMinus, Medal, Award, Users, Sparkles, Shield
} from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import { findNFLTeam } from '@/utils/nflTeams';
import { isRookiePlayer } from '@/utils/seasonDiff';
import PlayerDetailCard from '../PlayerDetailCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

type SeasonTier = 'legendary' | 'great' | 'good' | 'average' | 'poor';

interface SeasonPerformance {
  player: Player;
  seasonStats: Partial<Player>;
  tier: SeasonTier;
  keyStats: { label: string; value: number }[];
}

const getTierInfo = (tier: SeasonTier) => {
  switch (tier) {
    case 'legendary':
      return { label: 'LEGENDARY', color: 'text-chart-4', icon: Crown };
    case 'great':
      return { label: 'GREAT', color: 'text-metric-elite', icon: Star };
    case 'good':
      return { label: 'GOOD', color: 'text-primary', icon: TrendingUp };
    case 'average':
      return { label: 'AVERAGE', color: 'text-muted-foreground', icon: Zap };
    case 'poor':
      return { label: 'DOWN', color: 'text-destructive', icon: TrendingDown };
  }
};

const SeasonTab = () => {
  const { careerData, seasonData, previousData, currentSeason, loadSeasonData, dataVersion } = useLeague();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const handleFileLoad = (content: string, filename: string, seasonNumber?: number) => {
    const seasonName = seasonNumber ? `Y${seasonNumber}` : 'New Season';
    loadSeasonData(content, seasonName);
  };

  // Calculate retirements (players in previousData but not active in careerData, or status changed)
  const retirements = useMemo(() => {
    if (!previousData || !careerData) return [];
    
    const prevPlayers = [
      ...previousData.quarterbacks,
      ...previousData.runningbacks,
      ...previousData.widereceivers,
      ...previousData.tightends,
      ...previousData.offensiveline,
      ...previousData.linebackers,
      ...previousData.defensivebacks,
      ...previousData.defensiveline,
    ].filter(p => p.status === 'Active');

    const currentPlayers = [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ];

    const retired: Player[] = [];
    prevPlayers.forEach(prev => {
      const current = currentPlayers.find(c => c.name === prev.name && c.position === prev.position);
      if (current && current.status === 'Retired') {
        retired.push(current);
      }
    });

    return retired.sort((a, b) => b.careerLegacy - a.careerLegacy);
  }, [previousData, careerData, dataVersion]);

  // Find championship winner (player who gained a ring this season)
  const championshipWinner = useMemo(() => {
    if (!seasonData) return null;
    
    const allSeasonPlayers = [
      ...seasonData.quarterbacks,
      ...seasonData.runningbacks,
      ...seasonData.widereceivers,
      ...seasonData.tightends,
      ...seasonData.offensiveline,
      ...seasonData.linebackers,
      ...seasonData.defensivebacks,
      ...seasonData.defensiveline,
    ];

    const ringWinners = allSeasonPlayers.filter(p => (p as any).rings > 0);
    if (ringWinners.length === 0) return null;

    // Get the team from the first ring winner
    const winnerTeam = ringWinners[0]?.team;
    return {
      team: winnerTeam,
      players: ringWinners,
    };
  }, [seasonData, dataVersion]);

  // Find award winners (including rookies who won awards this season)
  const awardWinners = useMemo(() => {
    if (!seasonData) return { mvp: null, opoy: null, dpoy: null, sbmvp: null, roty: null };
    
    const allSeasonPlayers = [
      ...seasonData.quarterbacks,
      ...seasonData.runningbacks,
      ...seasonData.widereceivers,
      ...seasonData.tightends,
      ...seasonData.offensiveline,
      ...seasonData.linebackers,
      ...seasonData.defensivebacks,
      ...seasonData.defensiveline,
    ];

    const mvpWinner = allSeasonPlayers.find(p => (p as any).mvp > 0);
    const opoyWinner = allSeasonPlayers.find(p => (p as any).opoy > 0 && !['LB', 'DB', 'DL'].includes(p.position));
    const dpoyWinner = allSeasonPlayers.find(p => (p as any).opoy > 0 && ['LB', 'DB', 'DL'].includes(p.position));
    const sbmvpWinner = allSeasonPlayers.find(p => (p as any).sbmvp > 0);
    const rotyWinner = allSeasonPlayers.find(p => (p as any).roty > 0);

    // Get career versions for display
    const allCareerPlayers = careerData ? [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ] : [];

    const getCareerPlayer = (p: Player | undefined) => {
      if (!p) return null;
      return allCareerPlayers.find(c => c.name === p.name && c.position === p.position) || p;
    };

    return {
      mvp: getCareerPlayer(mvpWinner),
      opoy: getCareerPlayer(opoyWinner),
      dpoy: getCareerPlayer(dpoyWinner),
      sbmvp: getCareerPlayer(sbmvpWinner),
      roty: getCareerPlayer(rotyWinner),
    };
  }, [seasonData, careerData, dataVersion]);

  // Find rookies for this season (players with <=21 games who have stats this season)
  const rookies = useMemo(() => {
    if (!seasonData || !careerData) return [];
    
    const allCareerPlayers = [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ];

    return allCareerPlayers
      .filter(p => isRookiePlayer(p) && p.games > 0)
      .sort((a, b) => b.careerLegacy - a.careerLegacy);
  }, [seasonData, careerData, dataVersion]);

  const performances = useMemo((): SeasonPerformance[] => {
    if (!seasonData || !careerData) return [];

    const getPerformances = <T extends Player>(
      seasonPlayers: T[],
      careerPlayers: T[],
      getKeyStats: (p: T) => { label: string; value: number }[],
      getPrimaryStat: (p: T) => number,
      thresholds: { legendary: number; great: number; good: number; average: number },
    ): SeasonPerformance[] => {
      return seasonPlayers
        .filter((sp) => getPrimaryStat(sp) > 0)
        .map((sp) => {
          const careerPlayer = careerPlayers.find((c) => c.name === sp.name);
          const primaryStat = getPrimaryStat(sp);
          
          let tier: SeasonTier;
          if (primaryStat >= thresholds.legendary) tier = 'legendary';
          else if (primaryStat >= thresholds.great) tier = 'great';
          else if (primaryStat >= thresholds.good) tier = 'good';
          else if (primaryStat >= thresholds.average) tier = 'average';
          else tier = 'poor';

          return {
            player: careerPlayer || sp,
            seasonStats: sp,
            tier,
            keyStats: getKeyStats(sp),
          };
        })
        .sort((a, b) => {
          const tierOrder = { legendary: 0, great: 1, good: 2, average: 3, poor: 4 };
          if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
          return b.keyStats[0]?.value - a.keyStats[0]?.value;
        });
    };

    const allPerformances: SeasonPerformance[] = [];

    allPerformances.push(
      ...getPerformances(
        seasonData.quarterbacks as QBPlayer[],
        careerData.quarterbacks,
        (p) => [
          { label: 'Pass Yds', value: p.passYds },
          { label: 'Pass TDs', value: p.passTD },
          { label: 'Rush Yds', value: p.rushYds },
        ],
        (p) => p.passYds,
        { legendary: 4500, great: 3500, good: 2500, average: 1500 },
      ),
    );

    allPerformances.push(
      ...getPerformances(
        seasonData.runningbacks as RBPlayer[],
        careerData.runningbacks,
        (p) => [
          { label: 'Rush Yds', value: p.rushYds },
          { label: 'Rush TDs', value: p.rushTD },
          { label: 'Rec Yds', value: p.recYds },
        ],
        (p) => p.rushYds,
        { legendary: 1500, great: 1000, good: 700, average: 400 },
      ),
    );

    allPerformances.push(
      ...getPerformances(
        seasonData.widereceivers as WRPlayer[],
        careerData.widereceivers,
        (p) => [
          { label: 'Rec Yds', value: p.recYds },
          { label: 'Rec', value: p.receptions },
          { label: 'TDs', value: p.recTD },
        ],
        (p) => p.recYds,
        { legendary: 1400, great: 1000, good: 700, average: 400 },
      ),
    );

    allPerformances.push(
      ...getPerformances(
        seasonData.tightends as TEPlayer[],
        careerData.tightends,
        (p) => [
          { label: 'Rec Yds', value: p.recYds },
          { label: 'Rec', value: p.receptions },
          { label: 'TDs', value: p.recTD },
        ],
        (p) => p.recYds,
        { legendary: 1000, great: 700, good: 500, average: 300 },
      ),
    );

    const defSeason = [
      ...seasonData.linebackers,
      ...seasonData.defensivebacks,
      ...seasonData.defensiveline,
    ] as (LBPlayer | DBPlayer | DLPlayer)[];
    const defCareer = [
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ] as (LBPlayer | DBPlayer | DLPlayer)[];

    allPerformances.push(
      ...getPerformances(
        defSeason,
        defCareer,
        (p) => [
          { label: 'Tackles', value: p.tackles },
          { label: 'INTs', value: p.interceptions },
          { label: 'Sacks', value: p.sacks },
        ],
        (p) => p.tackles,
        { legendary: 100, great: 70, good: 50, average: 30 },
      ),
    );

    return allPerformances;
  }, [seasonData, careerData, dataVersion]);

  const topPerformers = useMemo(() => {
    const legendary = performances.filter((p) => p.tier === 'legendary');
    const great = performances.filter((p) => p.tier === 'great');
    return { legendary, great };
  }, [performances]);

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-6">
            <Calendar className="w-10 h-10 text-accent" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4 text-accent">Season Overview</h2>
          <p className="text-muted-foreground text-lg">
            First, upload your career data in the Career tab to establish a baseline.
          </p>
        </div>
      </div>
    );
  }

  const hasSeasonData = performances.length > 0;

  return (
    <div className="container mx-auto px-6 py-6 space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 p-8 border border-emerald-500/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMDUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-60" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 mb-4 shadow-lg shadow-emerald-500/20">
            <Calendar className="w-8 h-8 text-emerald-400" />
          </div>
          
          <p className="text-sm text-emerald-400 uppercase tracking-widest font-medium mb-1">Current Season</p>
          <h1 className="font-display text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent mb-3">
            {currentSeason}
          </h1>
          
          {hasSeasonData && (
            <div className="flex justify-center gap-4 flex-wrap mt-4">
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-sm">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400 font-bold">{topPerformers.legendary.length}</span>
                <span className="text-muted-foreground">Legendary</span>
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-sm">
                <Star className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">{topPerformers.great.length}</span>
                <span className="text-muted-foreground">Great</span>
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-sm">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-bold">{performances.length}</span>
                <span className="text-muted-foreground">Total</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {!hasSeasonData && (
        <div className="max-w-xl mx-auto">
          <FileUpload onFileLoad={handleFileLoad} label="Upload Season CSV" askForSeason />
        </div>
      )}

      {hasSeasonData && (
        <>
          {/* Championship & Awards Section */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Championship Winner */}
            {championshipWinner && (() => {
              const champTeam = findNFLTeam(championshipWinner.team);
              return (
                <div className="glass-card p-6 border-2 border-chart-4/30 bg-gradient-to-br from-chart-4/10 to-transparent">
                  <div className="flex items-center gap-3 mb-4">
                    {champTeam ? (
                      <img src={champTeam.logoUrl} alt={champTeam.name} className="w-16 h-16 object-contain" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-chart-4/20 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-chart-4" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-display text-xl font-bold text-chart-4">CHAMPIONS</h3>
                      <p className="text-muted-foreground text-sm">{currentSeason} Super Bowl Winners</p>
                    </div>
                  </div>
                  {championshipWinner.team && (
                    <div 
                      className="text-2xl font-display font-bold mb-3"
                      style={{
                        color: champTeam ? `hsl(${champTeam.primaryColor})` : undefined
                      }}
                    >
                      {champTeam?.fullName || championshipWinner.team}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {championshipWinner.players.slice(0, 5).map((p) => (
                      <span 
                        key={p.name} 
                        className="text-xs px-2 py-1 rounded bg-chart-4/20 text-chart-4 cursor-pointer hover:bg-chart-4/30"
                        onClick={() => setSelectedPlayer(p)}
                      >
                        {p.name} ({p.position})
                      </span>
                    ))}
                    {championshipWinner.players.length > 5 && (
                      <span className="text-xs px-2 py-1 rounded bg-secondary/50 text-muted-foreground">
                        +{championshipWinner.players.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Award Winners */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-primary">AWARD WINNERS</h3>
                  <p className="text-muted-foreground text-sm">{currentSeason} Individual Honors</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {awardWinners.mvp && (
                  <div 
                    className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-colors"
                    onClick={() => setSelectedPlayer(awardWinners.mvp)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-amber-400 font-bold">MVP</span>
                    </div>
                    <p className="font-medium text-foreground text-sm">{awardWinners.mvp.name}</p>
                    <p className="text-xs text-muted-foreground">{awardWinners.mvp.position} • {awardWinners.mvp.team}</p>
                  </div>
                )}
                {awardWinners.opoy && (
                  <div 
                    className="p-3 rounded-lg bg-primary/10 border border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => setSelectedPlayer(awardWinners.opoy)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs text-primary font-bold">OPOY</span>
                    </div>
                    <p className="font-medium text-foreground text-sm">{awardWinners.opoy.name}</p>
                    <p className="text-xs text-muted-foreground">{awardWinners.opoy.position} • {awardWinners.opoy.team}</p>
                  </div>
                )}
                {awardWinners.dpoy && (
                  <div 
                    className="p-3 rounded-lg bg-accent/10 border border-accent/30 cursor-pointer hover:bg-accent/20 transition-colors"
                    onClick={() => setSelectedPlayer(awardWinners.dpoy)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-accent" />
                      <span className="text-xs text-accent font-bold">DPOY</span>
                    </div>
                    <p className="font-medium text-foreground text-sm">{awardWinners.dpoy.name}</p>
                    <p className="text-xs text-muted-foreground">{awardWinners.dpoy.position} • {awardWinners.dpoy.team}</p>
                  </div>
                )}
                {awardWinners.sbmvp && (
                  <div 
                    className="p-3 rounded-lg bg-chart-4/10 border border-chart-4/30 cursor-pointer hover:bg-chart-4/20 transition-colors"
                    onClick={() => setSelectedPlayer(awardWinners.sbmvp)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Medal className="w-4 h-4 text-chart-4" />
                      <span className="text-xs text-chart-4 font-bold">SB MVP</span>
                    </div>
                    <p className="font-medium text-foreground text-sm">{awardWinners.sbmvp.name}</p>
                    <p className="text-xs text-muted-foreground">{awardWinners.sbmvp.position} • {awardWinners.sbmvp.team}</p>
                  </div>
                )}
                {awardWinners.roty && (
                  <div 
                    className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                    onClick={() => setSelectedPlayer(awardWinners.roty)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-bold">ROTY</span>
                    </div>
                    <p className="font-medium text-foreground text-sm">{awardWinners.roty.name}</p>
                    <p className="text-xs text-muted-foreground">{awardWinners.roty.position} • {awardWinners.roty.team}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Retirements Section */}
          {retirements.length > 0 && (
            <div className="glass-card p-6 border border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                  <UserMinus className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-destructive">RETIREMENTS</h3>
                  <p className="text-muted-foreground text-sm">{retirements.length} player{retirements.length !== 1 ? 's' : ''} hung up the cleats</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {retirements.slice(0, 6).map((player) => {
                  const teamColors = getTeamColors(player.team);
                  return (
                    <div 
                      key={`${player.position}:${player.name}`}
                      className="p-3 rounded-lg bg-secondary/30 border border-border/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                      style={teamColors ? { borderLeftColor: `hsl(${teamColors.primary})`, borderLeftWidth: '3px' } : undefined}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">{player.name}</span>
                        <PositionBadge position={player.position} className="text-xs" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{player.games} games</span>
                        <span>•</span>
                        <span>{player.rings} 🏆</span>
                        <span>•</span>
                        <span className="text-primary">{player.careerLegacy.toLocaleString()} legacy</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {retirements.length > 6 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  +{retirements.length - 6} more retirements
                </p>
              )}
            </div>
          )}

          {/* Breaking News Section */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4 mb-6">
              <Newspaper className="w-6 h-6 text-chart-4" />
              <h3 className="font-display text-2xl font-bold text-chart-4">SEASON {currentSeason} HEADLINES</h3>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top Story */}
              {topPerformers.legendary.length > 0 && (
                <div className="lg:col-span-2 p-6 rounded-xl bg-gradient-to-r from-chart-4/20 via-chart-4/10 to-transparent border border-chart-4/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-5 h-5 text-chart-4" />
                    <span className="text-xs font-bold uppercase tracking-wider text-chart-4">Historic Season Alert</span>
                  </div>
                  <h4 className="font-display text-3xl font-bold text-foreground mb-3">
                    {topPerformers.legendary.length === 1 
                      ? `${topPerformers.legendary[0].player.name} Posts Career-Defining Year`
                      : `${topPerformers.legendary.length} Players Put Up Legendary Numbers`}
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {topPerformers.legendary.map((p, i) => (
                      <span key={p.player.name}>
                        <span 
                          className="text-foreground font-semibold cursor-pointer hover:text-primary"
                          onClick={() => setSelectedPlayer(p.player)}
                        >
                          {p.player.name}
                        </span>
                        {' ('}{p.player.position}{p.player.team ? `, ${p.player.team}` : ''}{') '}
                        recorded {p.keyStats[0]?.value.toLocaleString()} {p.keyStats[0]?.label.toLowerCase()}
                        {i < topPerformers.legendary.length - 1 ? '. ' : '.'}
                      </span>
                    ))}
                    {' '}These are the kind of seasons that define careers and cement legacies.
                  </p>
                </div>
              )}

              {/* Position Leaders */}
              {['QB', 'RB', 'WR', 'TE', 'DEF'].map((pos) => {
                const posPlayers = performances.filter((p) => 
                  pos === 'DEF' 
                    ? ['LB', 'DB', 'DL'].includes(p.player.position)
                    : p.player.position === pos
                );
                const leader = posPlayers[0];
                if (!leader) return null;
                const tierInfo = getTierInfo(leader.tier);
                const teamColors = getTeamColors(leader.player.team);
                
                return (
                  <div 
                    key={pos} 
                    className="p-4 rounded-xl bg-secondary/30 border border-border/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                    style={teamColors ? { borderLeftColor: `hsl(${teamColors.primary})`, borderLeftWidth: '3px' } : undefined}
                    onClick={() => setSelectedPlayer(leader.player)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {pos === 'DEF' ? 'Defensive' : pos} Leader
                      </span>
                      <span className={`text-xs font-bold ${tierInfo.color}`}>{tierInfo.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{leader.player.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <PositionBadge position={leader.player.position} className="text-xs" />
                          {leader.player.team && (
                            <span className="text-xs text-muted-foreground">{leader.player.team}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-xl text-primary">{leader.keyStats[0]?.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{leader.keyStats[0]?.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Season Spreadsheet */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border/30 flex items-center gap-3">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-display text-xl font-bold">SEASON {currentSeason} PLAYER PERFORMANCES</h3>
              <span className="text-muted-foreground text-sm">({performances.length} players)</span>
            </div>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 sticky top-0 bg-secondary/90">#</TableHead>
                    <TableHead className="sticky left-0 top-0 bg-secondary/90 backdrop-blur z-10">Player</TableHead>
                    <TableHead className="sticky top-0 bg-secondary/90">Team</TableHead>
                    <TableHead className="sticky top-0 bg-secondary/90">Pos</TableHead>
                    <TableHead className="text-center sticky top-0 bg-secondary/90">Tier</TableHead>
                    <TableHead className="text-right sticky top-0 bg-secondary/90">Stat 1</TableHead>
                    <TableHead className="text-right sticky top-0 bg-secondary/90">Stat 2</TableHead>
                    <TableHead className="text-right sticky top-0 bg-secondary/90">Stat 3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performances.map((perf, idx) => {
                    const tierInfo = getTierInfo(perf.tier);
                    const TierIcon = tierInfo.icon;
                    const teamColors = getTeamColors(perf.player.team);
                    const isLeader = idx === 0 || perf.tier === 'legendary';

                    return (
                      <TableRow 
                        key={perf.player.name}
                        className="hover:bg-secondary/20 cursor-pointer"
                        style={teamColors ? { borderLeft: `3px solid hsl(${teamColors.primary})` } : undefined}
                        onClick={() => setSelectedPlayer(perf.player)}
                      >
                        <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="sticky left-0 bg-card/90 backdrop-blur z-10">
                          <div className="flex items-center gap-2">
                            {isLeader && <Crown className="w-4 h-4 text-chart-4" />}
                            <div>
                              <span className="font-medium text-foreground">{perf.player.name}</span>
                              {perf.player.nickname && (
                                <span className="block text-xs text-muted-foreground italic">"{perf.player.nickname}"</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {perf.player.team && (
                            <span 
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={teamColors ? {
                                backgroundColor: `hsl(${teamColors.primary} / 0.2)`,
                                color: `hsl(${teamColors.primary})`,
                              } : undefined}
                            >
                              {perf.player.team}
                            </span>
                          )}
                        </TableCell>
                        <TableCell><PositionBadge position={perf.player.position} className="text-xs" /></TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${tierInfo.color}`}>
                            <TierIcon className="w-3 h-3" />
                            {tierInfo.label}
                          </div>
                        </TableCell>
                        {perf.keyStats.map((stat) => (
                          <TableCell key={stat.label} className="text-right">
                            <div>
                              <span className="font-mono font-bold text-foreground">{stat.value.toLocaleString()}</span>
                              <span className="block text-xs text-muted-foreground">{stat.label}</span>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Upload Next Season */}
          <div className="max-w-md mx-auto">
            <FileUpload onFileLoad={handleFileLoad} label="Upload Next Season" askForSeason />
          </div>
        </>
      )}

      {/* Player Detail Card */}
      <PlayerDetailCard 
        player={selectedPlayer} 
        onClose={() => setSelectedPlayer(null)} 
      />
    </div>
  );
};

export default SeasonTab;
