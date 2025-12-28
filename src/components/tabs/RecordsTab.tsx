import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Trophy, Crown, Calendar, Zap, Star, Flame, TrendingUp } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { loadSeasonHistory, type SeasonSnapshot } from '@/utils/seasonHistory';

interface RecordEntry {
  stat: string;
  value: number;
  playerName: string;
  team?: string;
  position: string;
  season?: string;
}

interface GreatSeason {
  playerName: string;
  position: string;
  team?: string;
  season: string;
  score: number;
  stats: { label: string; value: number }[];
  awards: { mvp: number; opoy: number; sbmvp: number; roty: number; rings: number };
}

// Formula to evaluate a season's greatness
// QB: (passYds/50) + (passTD*10) + (rushYds/20) + (rushTD*15) - (INT*5) + awards
// RB: (rushYds/20) + (rushTD*15) + (recYds/30) + (recTD*10) + awards
// WR/TE: (recYds/20) + (receptions*2) + (recTD*15) + awards
// DEF: (tackles*2) + (sacks*15) + (INT*20) + (FF*10) + awards
const calculateSeasonScore = (
  snapshot: SeasonSnapshot,
  position: string
): number => {
  const awardBonus = 
    (snapshot.mvp || 0) * 100 + 
    (snapshot.opoy || 0) * 75 + 
    (snapshot.sbmvp || 0) * 80 + 
    (snapshot.roty || 0) * 50 +
    (snapshot.rings || 0) * 60;

  if (position === 'QB') {
    return (
      ((snapshot.passYds || 0) / 50) +
      ((snapshot.passTD || 0) * 10) +
      ((snapshot.rushYds || 0) / 20) +
      ((snapshot.rushTD || 0) * 15) -
      ((snapshot.interceptions || 0) * 5) +
      awardBonus
    );
  } else if (position === 'RB') {
    return (
      ((snapshot.rushYds || 0) / 20) +
      ((snapshot.rushTD || 0) * 15) +
      ((snapshot.recYds || 0) / 30) +
      ((snapshot.recTD || 0) * 10) +
      awardBonus
    );
  } else if (position === 'WR' || position === 'TE') {
    return (
      ((snapshot.recYds || 0) / 20) +
      ((snapshot.receptions || 0) * 2) +
      ((snapshot.recTD || 0) * 15) +
      awardBonus
    );
  } else {
    // Defensive
    return (
      ((snapshot.tackles || 0) * 2) +
      ((snapshot.sacks || 0) * 15) +
      ((snapshot.interceptions || 0) * 20) +
      ((snapshot.forcedFumbles || 0) * 10) +
      awardBonus
    );
  }
};

const getSeasonTier = (score: number) => {
  if (score >= 800) return { label: 'LEGENDARY', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40' };
  if (score >= 600) return { label: 'ELITE', color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/40' };
  if (score >= 400) return { label: 'GREAT', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/40' };
  if (score >= 250) return { label: 'NOTABLE', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' };
  return { label: 'SOLID', color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/40' };
};

const RecordRow = ({ record, rank }: { record: RecordEntry; rank: number }) => {
  const teamColors = getTeamColors(record.team);
  
  return (
    <div 
      className="flex items-center gap-4 p-4 rounded-xl bg-background/40 hover:bg-background/60 transition-all border border-border/10"
      style={teamColors ? { borderLeftWidth: '3px', borderLeftColor: `hsl(${teamColors.primary})` } : undefined}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-display font-bold text-lg">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{record.playerName}</span>
          {record.team && (
            <span 
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={teamColors ? {
                backgroundColor: `hsl(${teamColors.primary} / 0.15)`,
                color: `hsl(${teamColors.primary})`,
              } : { color: 'hsl(var(--muted-foreground))' }}
            >
              {record.team}
            </span>
          )}
          {record.season && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent font-medium">
              {record.season}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{record.stat}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xl font-bold text-primary">
          {record.value.toLocaleString()}
        </p>
      </div>
    </div>
  );
};

const RecordsTab = () => {
  const { careerData, currentSeason } = useLeague();

  // All-time career records
  const allTimeRecords = useMemo(() => {
    if (!careerData) return null;

    const findMax = <T extends Player>(
      players: T[],
      getValue: (p: T) => number,
      stat: string,
    ): RecordEntry | null => {
      if (players.length === 0) return null;
      const max = players.reduce((a, b) => (getValue(a) > getValue(b) ? a : b));
      const val = getValue(max);
      if (val <= 0) return null;
      return {
        stat,
        value: val,
        playerName: max.name,
        team: max.team,
        position: max.position,
      };
    };

    const qbRecords: RecordEntry[] = [];
    if (careerData.quarterbacks.length > 0) {
      const qbs = careerData.quarterbacks;
      [
        findMax(qbs, (p) => p.passYds, 'Career Passing Yards'),
        findMax(qbs, (p) => p.passTD, 'Career Passing Touchdowns'),
        findMax(qbs, (p) => p.completions, 'Career Completions'),
        findMax(qbs, (p) => p.rushYds, 'QB Career Rush Yards'),
        findMax(qbs, (p) => p.rushTD, 'QB Career Rush TDs'),
      ].forEach((r) => r && qbRecords.push(r));
    }

    const rbRecords: RecordEntry[] = [];
    if (careerData.runningbacks.length > 0) {
      const rbs = careerData.runningbacks;
      [
        findMax(rbs, (p) => p.rushYds, 'Career Rushing Yards'),
        findMax(rbs, (p) => p.rushTD, 'Career Rushing Touchdowns'),
        findMax(rbs, (p) => p.rushAtt, 'Career Rush Attempts'),
        findMax(rbs, (p) => p.recYds, 'RB Career Receiving Yards'),
      ].forEach((r) => r && rbRecords.push(r));
    }

    const wrRecords: RecordEntry[] = [];
    if (careerData.widereceivers.length > 0) {
      const wrs = careerData.widereceivers;
      [
        findMax(wrs, (p) => p.recYds, 'Career Receiving Yards'),
        findMax(wrs, (p) => p.receptions, 'Career Receptions'),
        findMax(wrs, (p) => p.recTD, 'Career Receiving TDs'),
      ].forEach((r) => r && wrRecords.push(r));
    }

    const teRecords: RecordEntry[] = [];
    if (careerData.tightends.length > 0) {
      const tes = careerData.tightends;
      [
        findMax(tes, (p) => p.recYds, 'TE Career Receiving Yards'),
        findMax(tes, (p) => p.recTD, 'TE Career Receiving TDs'),
      ].forEach((r) => r && teRecords.push(r));
    }

    const allDef = [
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ] as (LBPlayer | DBPlayer | DLPlayer)[];

    const defRecords: RecordEntry[] = [];
    if (allDef.length > 0) {
      [
        findMax(allDef, (p) => p.tackles, 'Career Tackles'),
        findMax(allDef, (p) => p.interceptions, 'Career Interceptions'),
        findMax(allDef, (p) => p.sacks, 'Career Sacks'),
        findMax(allDef, (p) => p.forcedFumbles, 'Career Forced Fumbles'),
      ].forEach((r) => r && defRecords.push(r));
    }

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

    const accoladeRecords: RecordEntry[] = [];
    if (allPlayers.length > 0) {
      [
        findMax(allPlayers, (p) => p.rings, 'Career Championships'),
        findMax(allPlayers, (p) => p.mvp, 'Career MVP Awards'),
        findMax(allPlayers, (p) => p.sbmvp, 'Super Bowl MVP Awards'),
        findMax(allPlayers, (p) => p.careerLegacy, 'Highest Career Legacy'),
        findMax(allPlayers, (p) => p.trueTalent, 'Highest True Talent'),
      ].forEach((r) => r && accoladeRecords.push(r));
    }

    return { qbRecords, rbRecords, wrRecords, teRecords, defRecords, accoladeRecords };
  }, [careerData]);

  // Single-season records from stored history
  const singleSeasonRecords = useMemo(() => {
    const history = loadSeasonHistory();
    const allSnapshots: { playerKey: string; snapshot: SeasonSnapshot }[] = [];
    
    Object.entries(history).forEach(([playerKey, snapshots]) => {
      snapshots.forEach((snapshot) => {
        allSnapshots.push({ playerKey, snapshot });
      });
    });

    if (allSnapshots.length === 0) return null;

    const findMaxSeason = (
      filter: (key: string) => boolean,
      getValue: (s: SeasonSnapshot) => number,
      stat: string
    ): RecordEntry | null => {
      const filtered = allSnapshots.filter(({ playerKey }) => filter(playerKey));
      if (filtered.length === 0) return null;
      
      const max = filtered.reduce((a, b) => 
        getValue(a.snapshot) > getValue(b.snapshot) ? a : b
      );
      const val = getValue(max.snapshot);
      if (val <= 0) return null;

      const [position, ...nameParts] = max.playerKey.split(':');
      return {
        stat,
        value: val,
        playerName: nameParts.join(':'),
        position,
        season: max.snapshot.season,
      };
    };

    const qbRecords: RecordEntry[] = [];
    [
      findMaxSeason((k) => k.startsWith('QB:'), (s) => s.passYds || 0, 'Single Season Passing Yards'),
      findMaxSeason((k) => k.startsWith('QB:'), (s) => s.passTD || 0, 'Single Season Passing TDs'),
      findMaxSeason((k) => k.startsWith('QB:'), (s) => s.rushYds || 0, 'Single Season QB Rush Yards'),
    ].forEach((r) => r && qbRecords.push(r));

    const rbRecords: RecordEntry[] = [];
    [
      findMaxSeason((k) => k.startsWith('RB:'), (s) => s.rushYds || 0, 'Single Season Rushing Yards'),
      findMaxSeason((k) => k.startsWith('RB:'), (s) => s.rushTD || 0, 'Single Season Rushing TDs'),
      findMaxSeason((k) => k.startsWith('RB:'), (s) => s.recYds || 0, 'Single Season RB Receiving Yards'),
    ].forEach((r) => r && rbRecords.push(r));

    const wrRecords: RecordEntry[] = [];
    [
      findMaxSeason((k) => k.startsWith('WR:'), (s) => s.recYds || 0, 'Single Season Receiving Yards'),
      findMaxSeason((k) => k.startsWith('WR:'), (s) => s.receptions || 0, 'Single Season Receptions'),
      findMaxSeason((k) => k.startsWith('WR:'), (s) => s.recTD || 0, 'Single Season Receiving TDs'),
    ].forEach((r) => r && wrRecords.push(r));

    const teRecords: RecordEntry[] = [];
    [
      findMaxSeason((k) => k.startsWith('TE:'), (s) => s.recYds || 0, 'Single Season TE Receiving Yards'),
      findMaxSeason((k) => k.startsWith('TE:'), (s) => s.recTD || 0, 'Single Season TE Receiving TDs'),
    ].forEach((r) => r && teRecords.push(r));

    const defRecords: RecordEntry[] = [];
    [
      findMaxSeason((k) => ['LB:', 'DB:', 'DL:'].some(p => k.startsWith(p)), (s) => s.tackles || 0, 'Single Season Tackles'),
      findMaxSeason((k) => ['LB:', 'DB:', 'DL:'].some(p => k.startsWith(p)), (s) => s.sacks || 0, 'Single Season Sacks'),
      findMaxSeason((k) => ['LB:', 'DB:', 'DL:'].some(p => k.startsWith(p)), (s) => s.interceptions || 0, 'Single Season INTs'),
    ].forEach((r) => r && defRecords.push(r));

    return { qbRecords, rbRecords, wrRecords, teRecords, defRecords };
  }, []);

  // Greatest seasons of all time
  const greatestSeasons = useMemo((): GreatSeason[] => {
    const history = loadSeasonHistory();
    const seasons: GreatSeason[] = [];

    Object.entries(history).forEach(([playerKey, snapshots]) => {
      const [position, ...nameParts] = playerKey.split(':');
      const playerName = nameParts.join(':');

      snapshots.forEach((snapshot) => {
        const score = calculateSeasonScore(snapshot, position);
        
        const stats: { label: string; value: number }[] = [];
        if (position === 'QB') {
          if (snapshot.passYds) stats.push({ label: 'Pass Yds', value: snapshot.passYds });
          if (snapshot.passTD) stats.push({ label: 'Pass TD', value: snapshot.passTD });
          if (snapshot.rushYds) stats.push({ label: 'Rush Yds', value: snapshot.rushYds });
        } else if (position === 'RB') {
          if (snapshot.rushYds) stats.push({ label: 'Rush Yds', value: snapshot.rushYds });
          if (snapshot.rushTD) stats.push({ label: 'Rush TD', value: snapshot.rushTD });
          if (snapshot.recYds) stats.push({ label: 'Rec Yds', value: snapshot.recYds });
        } else if (position === 'WR' || position === 'TE') {
          if (snapshot.recYds) stats.push({ label: 'Rec Yds', value: snapshot.recYds });
          if (snapshot.receptions) stats.push({ label: 'Rec', value: snapshot.receptions });
          if (snapshot.recTD) stats.push({ label: 'Rec TD', value: snapshot.recTD });
        } else {
          if (snapshot.tackles) stats.push({ label: 'Tackles', value: snapshot.tackles });
          if (snapshot.sacks) stats.push({ label: 'Sacks', value: snapshot.sacks });
          if (snapshot.interceptions) stats.push({ label: 'INTs', value: snapshot.interceptions });
        }

        seasons.push({
          playerName,
          position,
          season: snapshot.season,
          score,
          stats,
          awards: {
            mvp: snapshot.mvp || 0,
            opoy: snapshot.opoy || 0,
            sbmvp: snapshot.sbmvp || 0,
            roty: snapshot.roty || 0,
            rings: snapshot.rings || 0,
          },
        });
      });
    });

    return seasons.sort((a, b) => b.score - a.score).slice(0, 25);
  }, []);

  if (!careerData || !allTimeRecords) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-4xl font-bold mb-4 text-primary">ALL-TIME RECORDS</h2>
          <p className="text-muted-foreground text-lg">Upload your league data to view all-time records.</p>
        </div>
      </div>
    );
  }

  const Section = ({ title, records, color }: { title: string; records: RecordEntry[]; color: string }) => (
    <div 
      className="relative overflow-hidden rounded-2xl border-2 p-6 space-y-4"
      style={{ 
        borderColor: `${color}40`,
        background: `linear-gradient(135deg, ${color}08 0%, transparent 50%, ${color}05 100%)`
      }}
    >
      {/* Decorative corner accent */}
      <div 
        className="absolute top-0 right-0 w-32 h-32 opacity-10"
        style={{
          background: `radial-gradient(circle at top right, ${color}, transparent 70%)`
        }}
      />
      <div 
        className="absolute bottom-0 left-0 w-24 h-24 opacity-5"
        style={{
          background: `radial-gradient(circle at bottom left, ${color}, transparent 70%)`
        }}
      />
      
      <div className="relative flex items-center gap-3 border-b pb-4" style={{ borderColor: `${color}30` }}>
        <div 
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ backgroundColor: `${color}20` }}
        >
          <Crown className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="font-display text-2xl font-bold tracking-wide" style={{ color }}>{title}</h3>
      </div>
      <div className="relative space-y-3">
        {records.map((r, i) => (
          <RecordRow key={`${r.stat}-${r.playerName}`} record={r} rank={i + 1} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/20 via-orange-500/10 to-amber-500/20 p-8 mb-8 border border-rose-500/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InN0YXJzIiB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxjaXJjbGUgY3g9IjI1IiBjeT0iMjUiIHI9IjEiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMSIvPjxjaXJjbGUgY3g9IjUiIGN5PSI1IiByPSIwLjUiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMDgiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjc3RhcnMpIi8+PC9zdmc+')] opacity-60" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400/50 mb-4 shadow-lg shadow-rose-500/20">
            <Trophy className="w-8 h-8 text-rose-400" />
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl font-bold bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 bg-clip-text text-transparent mb-2">
            LEAGUE RECORDS
          </h1>
          <p className="text-muted-foreground">Career, Single-Season & Greatest Seasons of All Time</p>
          
          <div className="flex justify-center gap-4 flex-wrap mt-4">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-sm">
              <Crown className="w-4 h-4 text-rose-400" />
              <span className="text-rose-400 font-bold">Career</span>
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold">Single Season</span>
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/40 text-sm">
              <Flame className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 font-bold">Greatest Seasons</span>
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="career" className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border/30 mx-auto flex w-fit">
          <TabsTrigger value="career" className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400 font-medium gap-2">
            <Trophy className="w-4 h-4" />
            Career Records
          </TabsTrigger>
          <TabsTrigger value="season" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 font-medium gap-2">
            <Zap className="w-4 h-4" />
            Single Season
          </TabsTrigger>
          <TabsTrigger value="greatest" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 font-medium gap-2">
            <Flame className="w-4 h-4" />
            Greatest Seasons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="career">
          <div className="grid lg:grid-cols-2 gap-6">
            {allTimeRecords.qbRecords.length > 0 && (
              <Section title="QUARTERBACK" records={allTimeRecords.qbRecords} color="hsl(var(--primary))" />
            )}
            {allTimeRecords.rbRecords.length > 0 && (
              <Section title="RUNNING BACK" records={allTimeRecords.rbRecords} color="hsl(var(--accent))" />
            )}
            {allTimeRecords.wrRecords.length > 0 && (
              <Section title="WIDE RECEIVER" records={allTimeRecords.wrRecords} color="hsl(var(--chart-4))" />
            )}
            {allTimeRecords.teRecords.length > 0 && (
              <Section title="TIGHT END" records={allTimeRecords.teRecords} color="hsl(var(--chart-3))" />
            )}
            {allTimeRecords.defRecords.length > 0 && (
              <Section title="DEFENSE" records={allTimeRecords.defRecords} color="hsl(var(--destructive))" />
            )}
            {allTimeRecords.accoladeRecords.length > 0 && (
              <Section title="ACCOLADES" records={allTimeRecords.accoladeRecords} color="hsl(var(--metric-elite))" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="season">
          {singleSeasonRecords ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {singleSeasonRecords.qbRecords.length > 0 && (
                <Section title="QB SINGLE SEASON" records={singleSeasonRecords.qbRecords} color="#f59e0b" />
              )}
              {singleSeasonRecords.rbRecords.length > 0 && (
                <Section title="RB SINGLE SEASON" records={singleSeasonRecords.rbRecords} color="#10b981" />
              )}
              {singleSeasonRecords.wrRecords.length > 0 && (
                <Section title="WR SINGLE SEASON" records={singleSeasonRecords.wrRecords} color="#8b5cf6" />
              )}
              {singleSeasonRecords.teRecords.length > 0 && (
                <Section title="TE SINGLE SEASON" records={singleSeasonRecords.teRecords} color="#06b6d4" />
              )}
              {singleSeasonRecords.defRecords.length > 0 && (
                <Section title="DEF SINGLE SEASON" records={singleSeasonRecords.defRecords} color="#ef4444" />
              )}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-2xl font-bold text-muted-foreground mb-2">No Season History</h3>
              <p className="text-muted-foreground">Upload season CSVs to track single-season records across all years.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="greatest">
          {greatestSeasons.length > 0 ? (
            <div className="space-y-6">
              {/* Formula explanation */}
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-500/10 via-transparent to-purple-500/5 p-6">
                <div className="absolute top-0 right-0 w-40 h-40 opacity-10 bg-gradient-radial from-purple-500 to-transparent" />
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/20">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-purple-400">Season Score Formula</h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs font-bold shrink-0">QB</span>
                      <span className="text-sm text-muted-foreground font-mono">(PassYds ÷ 50) + (TD × 10) + (RushYds ÷ 20) - (INT × 5) + Awards</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold shrink-0">RB</span>
                      <span className="text-sm text-muted-foreground font-mono">(RushYds ÷ 20) + (TD × 15) + (RecYds ÷ 30) + Awards</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-bold shrink-0">WR/TE</span>
                      <span className="text-sm text-muted-foreground font-mono">(RecYds ÷ 20) + (Rec × 2) + (TD × 15) + Awards</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-xs font-bold shrink-0">DEF</span>
                      <span className="text-sm text-muted-foreground font-mono">(Tackles × 2) + (Sacks × 15) + (INT × 20) + Awards</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-purple-500/20">
                  <p className="text-xs text-muted-foreground">
                    <span className="text-purple-400 font-semibold">Award Bonuses:</span> MVP (+100) • OPOY (+75) • SB MVP (+80) • Ring (+60) • ROTY (+50)
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="text-xs"><span className="text-amber-400 font-bold">LEGENDARY</span> 800+</span>
                    <span className="text-xs"><span className="text-purple-400 font-bold">ELITE</span> 600+</span>
                    <span className="text-xs"><span className="text-blue-400 font-bold">GREAT</span> 400+</span>
                    <span className="text-xs"><span className="text-emerald-400 font-bold">NOTABLE</span> 250+</span>
                  </div>
                </div>
              </div>

              {/* Greatest seasons list */}
              <div className="grid gap-3">
                {greatestSeasons.map((gs, i) => {
                  const tier = getSeasonTier(gs.score);
                  const hasAwards = gs.awards.mvp || gs.awards.opoy || gs.awards.sbmvp || gs.awards.rings;
                  
                  return (
                    <div
                      key={`${gs.playerName}-${gs.season}`}
                      className={`flex items-center gap-4 p-4 rounded-xl ${tier.bg} border ${tier.border}`}
                    >
                      {/* Rank */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${tier.bg} border-2 ${tier.border} font-display font-bold text-lg ${tier.color}`}>
                        {i + 1}
                      </div>

                      {/* Player info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-lg">{gs.playerName}</span>
                          <PositionBadge position={gs.position as any} />
                          <span className={`text-xs px-2 py-0.5 rounded ${tier.bg} ${tier.color} font-bold`}>
                            {gs.season}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded bg-background/50 ${tier.color} font-mono font-bold`}>
                            {gs.score.toFixed(0)} pts
                          </span>
                        </div>
                        
                        {/* Stats */}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {gs.stats.slice(0, 4).map((stat) => (
                            <span key={stat.label}>
                              <span className="font-mono font-medium text-foreground">{stat.value.toLocaleString()}</span>
                              {' '}{stat.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Awards */}
                      {hasAwards && (
                        <div className="flex items-center gap-2">
                          {gs.awards.rings > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <Trophy className="w-4 h-4" />{gs.awards.rings}
                            </span>
                          )}
                          {gs.awards.mvp > 0 && (
                            <span className="flex items-center gap-1 text-purple-400">
                              <Crown className="w-4 h-4" />{gs.awards.mvp}
                            </span>
                          )}
                          {gs.awards.opoy > 0 && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <Star className="w-4 h-4" />{gs.awards.opoy}
                            </span>
                          )}
                          {gs.awards.sbmvp > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Zap className="w-4 h-4" />{gs.awards.sbmvp}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tier label */}
                      <span className={`text-xs font-bold ${tier.color}`}>{tier.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Flame className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-2xl font-bold text-muted-foreground mb-2">No Season History</h3>
              <p className="text-muted-foreground">Upload season CSVs to track and rank the greatest seasons of all time.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecordsTab;