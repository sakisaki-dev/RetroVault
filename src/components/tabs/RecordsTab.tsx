import { useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Trophy, Crown, Calendar, Zap, Star, Flame, TrendingUp, ChevronDown, ChevronUp, Target, Award, Activity } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { loadSeasonHistory, type SeasonSnapshot } from '@/utils/seasonHistory';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface RecordEntry {
  stat: string;
  value: number;
  playerName: string;
  team?: string;
  position: string;
  season?: string;
  description?: string;
}

interface TopNRecord {
  stat: string;
  description: string;
  entries: RecordEntry[];
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

// Advanced stat descriptions
const statDescriptions: Record<string, string> = {
  // QB
  'Career Passing Yards': 'Total yards thrown over entire career',
  'Career Passing TDs': 'Total touchdown passes in career',
  'Career Completions': 'Total completed passes in career',
  'QB Career Rush Yards': 'Rushing yards accumulated by quarterbacks',
  'QB Career Rush TDs': 'Rushing touchdowns by quarterbacks',
  'Career Passer Rating': 'Efficiency metric combining completion %, yards, TDs, and INTs',
  'Career Yards Per Attempt': 'Average yards gained per pass attempt',
  'Career TD/INT Ratio': 'Touchdowns thrown per interception',
  'Career Total TDs': 'Combined passing and rushing touchdowns',
  'Career Total Yards': 'Combined passing and rushing yards',
  // RB
  'Career Rushing Yards': 'Total rushing yards over career',
  'Career Rushing TDs': 'Total rushing touchdowns in career',
  'Career Rush Attempts': 'Total rushing attempts in career',
  'RB Career Receiving Yards': 'Receiving yards by running backs',
  'Career Yards Per Carry': 'Average yards gained per rushing attempt',
  'Career Scrimmage Yards': 'Combined rushing and receiving yards',
  'Career Total RB TDs': 'Combined rushing and receiving touchdowns',
  'Career Yards From Scrimmage Per Game': 'Average scrimmage yards per game played',
  // WR
  'Career Receiving Yards': 'Total receiving yards over career',
  'Career Receptions': 'Total catches in career',
  'Career Receiving TDs': 'Total receiving touchdowns in career',
  'Career Yards Per Reception': 'Average yards per catch',
  'Career Yards Per Game': 'Average receiving yards per game',
  // TE
  'TE Career Receiving Yards': 'Total receiving yards by tight ends',
  'TE Career Receiving TDs': 'Total receiving touchdowns by tight ends',
  'TE Career Receptions': 'Total catches by tight ends',
  // Defense
  'Career Tackles': 'Total tackles over entire career',
  'Career Interceptions': 'Total interceptions in career',
  'Career Sacks': 'Total quarterback sacks in career',
  'Career Forced Fumbles': 'Total forced fumbles in career',
  'Career Defensive TDs': 'Touchdowns from defensive turnovers',
  'Career Turnovers Created': 'Combined interceptions and forced fumbles',
  // Accolades
  'Career Championships': 'Super Bowl/Championship rings won',
  'Career MVP Awards': 'League MVP awards received',
  'Super Bowl MVP Awards': 'Super Bowl MVP awards received',
  'Highest Career Legacy': 'Composite score measuring overall career impact',
  'Highest True Talent': 'Peak ability rating',
  'Career OPOY/DPOY': 'Offensive/Defensive Player of Year awards',
  // Single Season
  'Single Season Passing Yards': 'Most yards thrown in a single season',
  'Single Season Passing TDs': 'Most TD passes in a single season',
  'Single Season QB Rush Yards': 'Most rushing yards by a QB in a season',
  'Single Season Rushing Yards': 'Most rushing yards in a single season',
  'Single Season Rushing TDs': 'Most rushing TDs in a single season',
  'Single Season RB Receiving Yards': 'Most receiving yards by RB in a season',
  'Single Season Receiving Yards': 'Most receiving yards in a single season',
  'Single Season Receptions': 'Most receptions in a single season',
  'Single Season Receiving TDs': 'Most receiving TDs in a single season',
  'Single Season TE Receiving Yards': 'Most receiving yards by TE in a season',
  'Single Season TE Receiving TDs': 'Most receiving TDs by TE in a season',
  'Single Season Tackles': 'Most tackles in a single season',
  'Single Season Sacks': 'Most sacks in a single season',
  'Single Season INTs': 'Most interceptions in a single season',
};

// Season score formula
const calculateSeasonScore = (snapshot: SeasonSnapshot, position: string): number => {
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
      className="flex items-center gap-3 p-3 rounded-lg bg-background/40 hover:bg-background/60 transition-all border border-border/10"
      style={teamColors ? { borderLeftWidth: '3px', borderLeftColor: `hsl(${teamColors.primary})` } : undefined}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-display font-bold text-sm">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground text-sm">{record.playerName}</span>
          <PositionBadge position={record.position as any} className="text-xs" />
          {record.team && (
            <span 
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={teamColors ? {
                backgroundColor: `hsl(${teamColors.primary} / 0.15)`,
                color: `hsl(${teamColors.primary})`,
              } : { color: 'hsl(var(--muted-foreground))' }}
            >
              {record.team}
            </span>
          )}
          {record.season && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
              {record.season}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-lg font-bold text-primary">
          {typeof record.value === 'number' && record.value % 1 !== 0 
            ? record.value.toFixed(2) 
            : record.value.toLocaleString()}
        </p>
      </div>
    </div>
  );
};

const TopNSection = ({ record, defaultExpanded = false }: { record: TopNRecord; defaultExpanded?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto hover:bg-secondary/50"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{record.stat}</h4>
              <p className="text-xs text-muted-foreground">{record.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Top {record.entries.length}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-2">
          {record.entries.map((entry, i) => (
            <RecordRow key={`${entry.playerName}-${entry.stat}`} record={entry} rank={i + 1} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const RecordsTab = () => {
  const { careerData, dataVersion } = useLeague();
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  // All-time career records with advanced metrics
  const allTimeRecords = useMemo(() => {
    if (!careerData) return null;

    const findTopN = <T extends Player>(
      players: T[],
      getValue: (p: T) => number,
      stat: string,
      n: number = 10,
    ): TopNRecord | null => {
      if (players.length === 0) return null;
      const sorted = [...players]
        .filter((p) => getValue(p) > 0)
        .sort((a, b) => getValue(b) - getValue(a))
        .slice(0, n);
      if (sorted.length === 0) return null;
      
      return {
        stat,
        description: statDescriptions[stat] || stat,
        entries: sorted.map((p) => ({
          stat,
          value: getValue(p),
          playerName: p.name,
          team: p.team,
          position: p.position,
        })),
      };
    };

    // QB Records - Basic
    const qbBasicRecords: TopNRecord[] = [];
    const qbs = careerData.quarterbacks;
    [
      findTopN(qbs, (p) => p.passYds, 'Career Passing Yards', 10),
      findTopN(qbs, (p) => p.passTD, 'Career Passing TDs', 10),
      findTopN(qbs, (p) => p.completions, 'Career Completions', 10),
      findTopN(qbs, (p) => p.rushYds, 'QB Career Rush Yards', 10),
      findTopN(qbs, (p) => p.rushTD, 'QB Career Rush TDs', 10),
    ].forEach((r) => r && qbBasicRecords.push(r));

    // QB Records - Advanced
    const qbAdvancedRecords: TopNRecord[] = [];
    [
      findTopN(qbs, (p) => p.attempts > 0 ? p.passYds / p.attempts : 0, 'Career Yards Per Attempt', 10),
      findTopN(qbs, (p) => p.interceptions > 0 ? p.passTD / p.interceptions : p.passTD, 'Career TD/INT Ratio', 10),
      findTopN(qbs, (p) => p.passTD + p.rushTD, 'Career Total TDs', 10),
      findTopN(qbs, (p) => p.passYds + p.rushYds, 'Career Total Yards', 10),
      findTopN(qbs, (p) => p.games > 0 ? (p.passYds + p.rushYds) / p.games : 0, 'Career Yards Per Game', 10),
    ].forEach((r) => r && qbAdvancedRecords.push(r));

    // RB Records - Basic
    const rbBasicRecords: TopNRecord[] = [];
    const rbs = careerData.runningbacks;
    [
      findTopN(rbs, (p) => p.rushYds, 'Career Rushing Yards', 10),
      findTopN(rbs, (p) => p.rushTD, 'Career Rushing TDs', 10),
      findTopN(rbs, (p) => p.rushAtt, 'Career Rush Attempts', 10),
      findTopN(rbs, (p) => p.recYds, 'RB Career Receiving Yards', 10),
    ].forEach((r) => r && rbBasicRecords.push(r));

    // RB Records - Advanced
    const rbAdvancedRecords: TopNRecord[] = [];
    [
      findTopN(rbs, (p) => p.rushAtt > 0 ? p.rushYds / p.rushAtt : 0, 'Career Yards Per Carry', 10),
      findTopN(rbs, (p) => p.rushYds + p.recYds, 'Career Scrimmage Yards', 10),
      findTopN(rbs, (p) => p.rushTD + p.recTD, 'Career Total RB TDs', 10),
      findTopN(rbs, (p) => p.games > 0 ? (p.rushYds + p.recYds) / p.games : 0, 'Career Yards From Scrimmage Per Game', 10),
    ].forEach((r) => r && rbAdvancedRecords.push(r));

    // WR Records - Basic
    const wrBasicRecords: TopNRecord[] = [];
    const wrs = careerData.widereceivers;
    [
      findTopN(wrs, (p) => p.recYds, 'Career Receiving Yards', 10),
      findTopN(wrs, (p) => p.receptions, 'Career Receptions', 10),
      findTopN(wrs, (p) => p.recTD, 'Career Receiving TDs', 10),
    ].forEach((r) => r && wrBasicRecords.push(r));

    // WR Records - Advanced
    const wrAdvancedRecords: TopNRecord[] = [];
    [
      findTopN(wrs, (p) => p.receptions > 0 ? p.recYds / p.receptions : 0, 'Career Yards Per Reception', 10),
      findTopN(wrs, (p) => p.games > 0 ? p.recYds / p.games : 0, 'Career Yards Per Game', 10),
      findTopN(wrs, (p) => p.games > 0 ? p.recTD / p.games * 16 : 0, 'Career TDs Per 16 Games', 10),
    ].forEach((r) => r && wrAdvancedRecords.push(r));

    // TE Records
    const teRecords: TopNRecord[] = [];
    const tes = careerData.tightends;
    [
      findTopN(tes, (p) => p.recYds, 'TE Career Receiving Yards', 10),
      findTopN(tes, (p) => p.recTD, 'TE Career Receiving TDs', 10),
      findTopN(tes, (p) => p.receptions, 'TE Career Receptions', 10),
      findTopN(tes, (p) => p.receptions > 0 ? p.recYds / p.receptions : 0, 'TE Yards Per Reception', 10),
    ].forEach((r) => r && teRecords.push(r));

    // Defense Records
    const allDef = [
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ] as (LBPlayer | DBPlayer | DLPlayer)[];

    const defBasicRecords: TopNRecord[] = [];
    [
      findTopN(allDef, (p) => p.tackles, 'Career Tackles', 10),
      findTopN(allDef, (p) => p.interceptions, 'Career Interceptions', 10),
      findTopN(allDef, (p) => p.sacks, 'Career Sacks', 10),
      findTopN(allDef, (p) => p.forcedFumbles, 'Career Forced Fumbles', 10),
    ].forEach((r) => r && defBasicRecords.push(r));

    const defAdvancedRecords: TopNRecord[] = [];
    [
      findTopN(allDef, (p) => p.interceptions + p.forcedFumbles, 'Career Turnovers Created', 10),
      findTopN(allDef, (p) => p.games > 0 ? p.tackles / p.games : 0, 'Career Tackles Per Game', 10),
      findTopN(allDef, (p) => p.games > 0 ? p.sacks / p.games * 16 : 0, 'Career Sacks Per 16 Games', 10),
    ].forEach((r) => r && defAdvancedRecords.push(r));

    // Accolades
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

    const accoladeRecords: TopNRecord[] = [];
    [
      findTopN(allPlayers, (p) => p.rings, 'Career Championships', 10),
      findTopN(allPlayers, (p) => p.mvp, 'Career MVP Awards', 10),
      findTopN(allPlayers, (p) => p.sbmvp, 'Super Bowl MVP Awards', 10),
      findTopN(allPlayers, (p) => p.opoy, 'Career OPOY/DPOY', 10),
      findTopN(allPlayers, (p) => p.careerLegacy, 'Highest Career Legacy', 10),
      findTopN(allPlayers, (p) => p.trueTalent, 'Highest True Talent', 10),
      findTopN(allPlayers, (p) => p.dominance, 'Highest Dominance', 10),
    ].forEach((r) => r && accoladeRecords.push(r));

    return { 
      qbBasicRecords, qbAdvancedRecords,
      rbBasicRecords, rbAdvancedRecords,
      wrBasicRecords, wrAdvancedRecords,
      teRecords,
      defBasicRecords, defAdvancedRecords,
      accoladeRecords,
    };
  }, [careerData, dataVersion]);

  // Single-season records
  const singleSeasonRecords = useMemo(() => {
    const history = loadSeasonHistory();
    const allSnapshots: { playerKey: string; snapshot: SeasonSnapshot }[] = [];
    
    Object.entries(history).forEach(([playerKey, snapshots]) => {
      if (snapshots.length <= 1) return;
      snapshots.forEach((snapshot) => {
        allSnapshots.push({ playerKey, snapshot });
      });
    });

    if (allSnapshots.length === 0) return null;

    const findTopNSeason = (
      filter: (key: string) => boolean,
      getValue: (s: SeasonSnapshot) => number,
      stat: string,
      n: number = 10
    ): TopNRecord | null => {
      const filtered = allSnapshots.filter(({ playerKey }) => filter(playerKey));
      if (filtered.length === 0) return null;
      
      const sorted = [...filtered]
        .filter(({ snapshot }) => getValue(snapshot) > 0)
        .sort((a, b) => getValue(b.snapshot) - getValue(a.snapshot))
        .slice(0, n);
      
      if (sorted.length === 0) return null;

      return {
        stat,
        description: statDescriptions[stat] || stat,
        entries: sorted.map(({ playerKey, snapshot }) => {
          const [position, ...nameParts] = playerKey.split(':');
          return {
            stat,
            value: getValue(snapshot),
            playerName: nameParts.join(':'),
            position,
            season: snapshot.season,
          };
        }),
      };
    };

    // QB Season Records
    const qbSeasonRecords: TopNRecord[] = [];
    [
      findTopNSeason((k) => k.startsWith('QB:'), (s) => s.passYds || 0, 'Single Season Passing Yards'),
      findTopNSeason((k) => k.startsWith('QB:'), (s) => s.passTD || 0, 'Single Season Passing TDs'),
      findTopNSeason((k) => k.startsWith('QB:'), (s) => s.rushYds || 0, 'Single Season QB Rush Yards'),
      findTopNSeason((k) => k.startsWith('QB:'), (s) => s.rushTD || 0, 'Single Season QB Rush TDs'),
      findTopNSeason((k) => k.startsWith('QB:'), (s) => (s.passTD || 0) + (s.rushTD || 0), 'Single Season Total QB TDs'),
    ].forEach((r) => r && qbSeasonRecords.push(r));

    // RB Season Records
    const rbSeasonRecords: TopNRecord[] = [];
    [
      findTopNSeason((k) => k.startsWith('RB:'), (s) => s.rushYds || 0, 'Single Season Rushing Yards'),
      findTopNSeason((k) => k.startsWith('RB:'), (s) => s.rushTD || 0, 'Single Season Rushing TDs'),
      findTopNSeason((k) => k.startsWith('RB:'), (s) => s.recYds || 0, 'Single Season RB Receiving Yards'),
      findTopNSeason((k) => k.startsWith('RB:'), (s) => (s.rushYds || 0) + (s.recYds || 0), 'Single Season Scrimmage Yards'),
    ].forEach((r) => r && rbSeasonRecords.push(r));

    // WR Season Records
    const wrSeasonRecords: TopNRecord[] = [];
    [
      findTopNSeason((k) => k.startsWith('WR:'), (s) => s.recYds || 0, 'Single Season Receiving Yards'),
      findTopNSeason((k) => k.startsWith('WR:'), (s) => s.receptions || 0, 'Single Season Receptions'),
      findTopNSeason((k) => k.startsWith('WR:'), (s) => s.recTD || 0, 'Single Season Receiving TDs'),
    ].forEach((r) => r && wrSeasonRecords.push(r));

    // TE Season Records
    const teSeasonRecords: TopNRecord[] = [];
    [
      findTopNSeason((k) => k.startsWith('TE:'), (s) => s.recYds || 0, 'Single Season TE Receiving Yards'),
      findTopNSeason((k) => k.startsWith('TE:'), (s) => s.recTD || 0, 'Single Season TE Receiving TDs'),
    ].forEach((r) => r && teSeasonRecords.push(r));

    // DEF Season Records
    const defSeasonRecords: TopNRecord[] = [];
    [
      findTopNSeason((k) => ['LB:', 'DB:', 'DL:'].some(p => k.startsWith(p)), (s) => s.tackles || 0, 'Single Season Tackles'),
      findTopNSeason((k) => ['LB:', 'DB:', 'DL:'].some(p => k.startsWith(p)), (s) => s.sacks || 0, 'Single Season Sacks'),
      findTopNSeason((k) => ['LB:', 'DB:', 'DL:'].some(p => k.startsWith(p)), (s) => s.interceptions || 0, 'Single Season INTs'),
      findTopNSeason((k) => ['LB:', 'DB:', 'DL:'].some(p => k.startsWith(p)), (s) => s.forcedFumbles || 0, 'Single Season Forced Fumbles'),
    ].forEach((r) => r && defSeasonRecords.push(r));

    return { qbSeasonRecords, rbSeasonRecords, wrSeasonRecords, teSeasonRecords, defSeasonRecords };
  }, [dataVersion]);

  // Greatest seasons
  const greatestSeasons = useMemo((): GreatSeason[] => {
    const history = loadSeasonHistory();
    const seasons: GreatSeason[] = [];

    Object.entries(history).forEach(([playerKey, snapshots]) => {
      if (snapshots.length <= 1) return;
      
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
  }, [dataVersion]);

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

  const RecordCategory = ({ title, basicRecords, advancedRecords, color, icon: Icon }: { 
    title: string; 
    basicRecords: TopNRecord[]; 
    advancedRecords?: TopNRecord[];
    color: string;
    icon: any;
  }) => (
    <div 
      className="relative overflow-hidden rounded-2xl border-2 space-y-1"
      style={{ 
        borderColor: `${color}40`,
        background: `linear-gradient(135deg, ${color}08 0%, transparent 50%, ${color}05 100%)`
      }}
    >
      <div 
        className="absolute top-0 right-0 w-32 h-32 opacity-10"
        style={{ background: `radial-gradient(circle at top right, ${color}, transparent 70%)` }}
      />
      
      <div className="relative flex items-center gap-3 p-4 border-b" style={{ borderColor: `${color}30` }}>
        <div 
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="font-display text-xl font-bold tracking-wide" style={{ color }}>{title}</h3>
      </div>
      
      <div className="relative divide-y divide-border/20">
        {basicRecords.slice(0, showAllMetrics ? undefined : 3).map((r, i) => (
          <TopNSection key={r.stat} record={r} defaultExpanded={i === 0} />
        ))}
        {advancedRecords && showAllMetrics && advancedRecords.map((r) => (
          <TopNSection key={r.stat} record={r} />
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

      {/* Toggle for advanced metrics */}
      <div className="flex justify-center mb-6">
        <Button
          variant={showAllMetrics ? "default" : "outline"}
          onClick={() => setShowAllMetrics(!showAllMetrics)}
          className="gap-2"
        >
          <Activity className="w-4 h-4" />
          {showAllMetrics ? 'Show Curated Metrics' : 'Expand All Advanced Metrics'}
        </Button>
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
            {allTimeRecords.qbBasicRecords.length > 0 && (
              <RecordCategory 
                title="QUARTERBACK" 
                basicRecords={allTimeRecords.qbBasicRecords}
                advancedRecords={allTimeRecords.qbAdvancedRecords}
                color="hsl(var(--primary))" 
                icon={Target}
              />
            )}
            {allTimeRecords.rbBasicRecords.length > 0 && (
              <RecordCategory 
                title="RUNNING BACK" 
                basicRecords={allTimeRecords.rbBasicRecords}
                advancedRecords={allTimeRecords.rbAdvancedRecords}
                color="hsl(var(--accent))" 
                icon={Zap}
              />
            )}
            {allTimeRecords.wrBasicRecords.length > 0 && (
              <RecordCategory 
                title="WIDE RECEIVER" 
                basicRecords={allTimeRecords.wrBasicRecords}
                advancedRecords={allTimeRecords.wrAdvancedRecords}
                color="#8b5cf6" 
                icon={Star}
              />
            )}
            {allTimeRecords.teRecords.length > 0 && (
              <RecordCategory 
                title="TIGHT END" 
                basicRecords={allTimeRecords.teRecords}
                color="#06b6d4" 
                icon={Award}
              />
            )}
            {allTimeRecords.defBasicRecords.length > 0 && (
              <RecordCategory 
                title="DEFENSE" 
                basicRecords={allTimeRecords.defBasicRecords}
                advancedRecords={allTimeRecords.defAdvancedRecords}
                color="#ef4444" 
                icon={Activity}
              />
            )}
            {allTimeRecords.accoladeRecords.length > 0 && (
              <RecordCategory 
                title="ACCOLADES & METRICS" 
                basicRecords={allTimeRecords.accoladeRecords}
                color="#f59e0b" 
                icon={Crown}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="season">
          {singleSeasonRecords ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {singleSeasonRecords.qbSeasonRecords.length > 0 && (
                <RecordCategory 
                  title="QB SINGLE SEASON" 
                  basicRecords={singleSeasonRecords.qbSeasonRecords}
                  color="#f59e0b" 
                  icon={Target}
                />
              )}
              {singleSeasonRecords.rbSeasonRecords.length > 0 && (
                <RecordCategory 
                  title="RB SINGLE SEASON" 
                  basicRecords={singleSeasonRecords.rbSeasonRecords}
                  color="#10b981" 
                  icon={Zap}
                />
              )}
              {singleSeasonRecords.wrSeasonRecords.length > 0 && (
                <RecordCategory 
                  title="WR SINGLE SEASON" 
                  basicRecords={singleSeasonRecords.wrSeasonRecords}
                  color="#8b5cf6" 
                  icon={Star}
                />
              )}
              {singleSeasonRecords.teSeasonRecords.length > 0 && (
                <RecordCategory 
                  title="TE SINGLE SEASON" 
                  basicRecords={singleSeasonRecords.teSeasonRecords}
                  color="#06b6d4" 
                  icon={Award}
                />
              )}
              {singleSeasonRecords.defSeasonRecords.length > 0 && (
                <RecordCategory 
                  title="DEF SINGLE SEASON" 
                  basicRecords={singleSeasonRecords.defSeasonRecords}
                  color="#ef4444" 
                  icon={Activity}
                />
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
