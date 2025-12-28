import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import FileUpload from '../FileUpload';
import { Calendar, TrendingUp, TrendingDown, Star, Zap, Trophy, Crown, Newspaper, Target } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  const { careerData, seasonData, currentSeason, loadSeasonData } = useLeague();

  const handleFileLoad = (content: string, filename: string) => {
    const seasonMatch = filename.match(/y(\d+)/i);
    const seasonName = seasonMatch ? `Y${seasonMatch[1]}` : 'New Season';
    loadSeasonData(content, seasonName);
  };

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
  }, [seasonData, careerData]);

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
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="glass-card-glow p-8 text-center">
        <Calendar className="w-12 h-12 text-accent mx-auto mb-4" />
        <p className="text-muted-foreground text-sm uppercase tracking-wider mb-2">Current Season</p>
        <h2 className="font-display text-6xl font-bold text-accent mb-4">{currentSeason}</h2>
        {hasSeasonData && (
          <p className="text-muted-foreground">
            {topPerformers.legendary.length} legendary • {topPerformers.great.length} great • {performances.length} total
          </p>
        )}
      </div>

      {!hasSeasonData && (
        <div className="max-w-xl mx-auto">
          <FileUpload onFileLoad={handleFileLoad} label="Upload Season CSV" />
        </div>
      )}

      {hasSeasonData && (
        <>
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
                        <span className="text-foreground font-semibold">{p.player.name}</span>
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
                    className="p-4 rounded-xl bg-secondary/30 border border-border/30"
                    style={teamColors ? { borderLeftColor: `hsl(${teamColors.primary})`, borderLeftWidth: '3px' } : undefined}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="sticky left-0 bg-secondary/80 backdrop-blur z-10">Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Pos</TableHead>
                    <TableHead className="text-center">Tier</TableHead>
                    <TableHead className="text-right">Stat 1</TableHead>
                    <TableHead className="text-right">Stat 2</TableHead>
                    <TableHead className="text-right">Stat 3</TableHead>
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
                        className="hover:bg-secondary/20"
                        style={teamColors ? { borderLeft: `3px solid hsl(${teamColors.primary})` } : undefined}
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
            </div>
          </div>

          {/* Upload Next Season */}
          <div className="max-w-md mx-auto">
            <FileUpload onFileLoad={handleFileLoad} label="Upload Next Season" />
          </div>
        </>
      )}
    </div>
  );
};

export default SeasonTab;