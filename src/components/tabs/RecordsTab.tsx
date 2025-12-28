import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Trophy, Crown, Calendar, Zap } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import { getTeamColors } from '@/utils/teamColors';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface RecordEntry {
  stat: string;
  value: number;
  playerName: string;
  team?: string;
  position: string;
  season?: string;
}

const RecordRow = ({ record, rank }: { record: RecordEntry; rank: number }) => {
  const teamColors = getTeamColors(record.team);
  
  return (
    <div 
      className="flex items-center gap-4 p-4 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
      style={teamColors ? { borderLeft: `3px solid hsl(${teamColors.primary})` } : undefined}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-display font-bold text-lg">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{record.playerName}</span>
          {record.team && (
            <span 
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={teamColors ? {
                backgroundColor: `hsl(${teamColors.primary} / 0.2)`,
                color: `hsl(${teamColors.primary})`,
              } : { color: 'hsl(var(--muted-foreground))' }}
            >
              {record.team}
            </span>
          )}
          {record.season && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent font-medium">
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
  const { careerData, seasonData, currentSeason } = useLeague();

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

    // QB Records
    const qbRecords: RecordEntry[] = [];
    if (careerData.quarterbacks.length > 0) {
      const qbs = careerData.quarterbacks;
      [
        findMax(qbs, (p) => p.passYds, 'Career Passing Yards'),
        findMax(qbs, (p) => p.passTD, 'Career Passing Touchdowns'),
        findMax(qbs, (p) => p.completions, 'Career Completions'),
        findMax(qbs, (p) => p.games, 'Games Started (QB)'),
        findMax(qbs, (p) => p.rushYds, 'QB Career Rush Yards'),
        findMax(qbs, (p) => p.rushTD, 'QB Career Rush TDs'),
      ].forEach((r) => r && qbRecords.push(r));
    }

    // RB Records
    const rbRecords: RecordEntry[] = [];
    if (careerData.runningbacks.length > 0) {
      const rbs = careerData.runningbacks;
      [
        findMax(rbs, (p) => p.rushYds, 'Career Rushing Yards'),
        findMax(rbs, (p) => p.rushTD, 'Career Rushing Touchdowns'),
        findMax(rbs, (p) => p.rushAtt, 'Career Rush Attempts'),
        findMax(rbs, (p) => p.recYds, 'RB Career Receiving Yards'),
        findMax(rbs, (p) => p.recTD, 'RB Career Receiving TDs'),
        findMax(rbs, (p) => p.games, 'Games Started (RB)'),
      ].forEach((r) => r && rbRecords.push(r));
    }

    // WR Records
    const wrRecords: RecordEntry[] = [];
    if (careerData.widereceivers.length > 0) {
      const wrs = careerData.widereceivers;
      [
        findMax(wrs, (p) => p.recYds, 'Career Receiving Yards'),
        findMax(wrs, (p) => p.receptions, 'Career Receptions'),
        findMax(wrs, (p) => p.recTD, 'Career Receiving TDs'),
        findMax(wrs, (p) => p.longest, 'Longest Reception'),
        findMax(wrs, (p) => p.games, 'Games Started (WR)'),
      ].forEach((r) => r && wrRecords.push(r));
    }

    // TE Records
    const teRecords: RecordEntry[] = [];
    if (careerData.tightends.length > 0) {
      const tes = careerData.tightends;
      [
        findMax(tes, (p) => p.recYds, 'TE Career Receiving Yards'),
        findMax(tes, (p) => p.receptions, 'TE Career Receptions'),
        findMax(tes, (p) => p.recTD, 'TE Career Receiving TDs'),
        findMax(tes, (p) => p.games, 'Games Started (TE)'),
      ].forEach((r) => r && teRecords.push(r));
    }

    // Defensive Records
    const allDef = [
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ] as (LBPlayer | DBPlayer | DLPlayer)[];

    const defRecords: RecordEntry[] = [];
    if (allDef.length > 0) {
      [
        findMax(allDef, (p) => p.tackles, 'Career Tackles'),
        findMax(allDef, (p) => p.interceptions, 'Career Interceptions (DEF)'),
        findMax(allDef, (p) => p.sacks, 'Career Sacks'),
        findMax(allDef, (p) => p.forcedFumbles, 'Career Forced Fumbles'),
        findMax(allDef, (p) => p.games, 'Games Started (DEF)'),
      ].forEach((r) => r && defRecords.push(r));
    }

    // Accolades & Metrics
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
        findMax(allPlayers, (p) => p.games, 'All-Time Games Played'),
        findMax(allPlayers, (p) => p.careerLegacy, 'Highest Career Legacy'),
        findMax(allPlayers, (p) => p.trueTalent, 'Highest True Talent'),
        findMax(allPlayers, (p) => p.dominance, 'Highest Dominance'),
        findMax(allPlayers, (p) => p.tpg, 'Highest TPG (Talent Per Game)'),
      ].forEach((r) => r && accoladeRecords.push(r));
    }

    return { qbRecords, rbRecords, wrRecords, teRecords, defRecords, accoladeRecords };
  }, [careerData]);

  const seasonRecords = useMemo(() => {
    if (!seasonData) return null;

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
        season: currentSeason,
      };
    };

    const qbRecords: RecordEntry[] = [];
    if (seasonData.quarterbacks.length > 0) {
      const qbs = seasonData.quarterbacks as QBPlayer[];
      [
        findMax(qbs, (p) => p.passYds, 'Season Passing Yards'),
        findMax(qbs, (p) => p.passTD, 'Season Passing TDs'),
        findMax(qbs, (p) => p.rushYds, 'Season QB Rush Yards'),
      ].forEach((r) => r && qbRecords.push(r));
    }

    const rbRecords: RecordEntry[] = [];
    if (seasonData.runningbacks.length > 0) {
      const rbs = seasonData.runningbacks as RBPlayer[];
      [
        findMax(rbs, (p) => p.rushYds, 'Season Rushing Yards'),
        findMax(rbs, (p) => p.rushTD, 'Season Rushing TDs'),
        findMax(rbs, (p) => p.recYds, 'Season RB Receiving Yards'),
      ].forEach((r) => r && rbRecords.push(r));
    }

    const wrRecords: RecordEntry[] = [];
    if (seasonData.widereceivers.length > 0) {
      const wrs = seasonData.widereceivers as WRPlayer[];
      [
        findMax(wrs, (p) => p.recYds, 'Season Receiving Yards'),
        findMax(wrs, (p) => p.receptions, 'Season Receptions'),
        findMax(wrs, (p) => p.recTD, 'Season Receiving TDs'),
      ].forEach((r) => r && wrRecords.push(r));
    }

    const teRecords: RecordEntry[] = [];
    if (seasonData.tightends.length > 0) {
      const tes = seasonData.tightends as TEPlayer[];
      [
        findMax(tes, (p) => p.recYds, 'Season TE Receiving Yards'),
        findMax(tes, (p) => p.recTD, 'Season TE Receiving TDs'),
      ].forEach((r) => r && teRecords.push(r));
    }

    const allDef = [
      ...seasonData.linebackers,
      ...seasonData.defensivebacks,
      ...seasonData.defensiveline,
    ] as (LBPlayer | DBPlayer | DLPlayer)[];

    const defRecords: RecordEntry[] = [];
    if (allDef.length > 0) {
      [
        findMax(allDef, (p) => p.tackles, 'Season Tackles'),
        findMax(allDef, (p) => p.interceptions, 'Season Interceptions'),
        findMax(allDef, (p) => p.sacks, 'Season Sacks'),
      ].forEach((r) => r && defRecords.push(r));
    }

    const allSeasonRecords = [
      ...qbRecords,
      ...rbRecords,
      ...wrRecords,
      ...teRecords,
      ...defRecords,
    ].filter(Boolean);

    return allSeasonRecords;
  }, [seasonData, currentSeason]);

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
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-border/30 pb-3">
        <Crown className="w-5 h-5" style={{ color }} />
        <h3 className="font-display text-xl font-bold tracking-wide" style={{ color }}>{title}</h3>
      </div>
      <div className="space-y-2">
        {records.map((r, i) => (
          <RecordRow key={`${r.stat}-${r.playerName}`} record={r} rank={i + 1} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="glass-card-glow p-8 mb-8 text-center">
        <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="font-display text-5xl font-bold tracking-wider text-primary mb-2">LEAGUE RECORDS</h2>
        <p className="text-muted-foreground">All-Time & Single Season Record Holders</p>
      </div>

      <Tabs defaultValue="alltime" className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border/30 mx-auto flex w-fit">
          <TabsTrigger value="alltime" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium gap-2">
            <Trophy className="w-4 h-4" />
            All-Time Records
          </TabsTrigger>
          <TabsTrigger value="season" className="data-[state=active]:bg-accent/20 data-[state=active]:text-accent font-medium gap-2">
            <Calendar className="w-4 h-4" />
            Season Records ({currentSeason})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alltime">
          <div className="grid lg:grid-cols-2 gap-6">
            {allTimeRecords.qbRecords.length > 0 && (
              <Section title="QUARTERBACK RECORDS" records={allTimeRecords.qbRecords} color="hsl(var(--primary))" />
            )}
            {allTimeRecords.rbRecords.length > 0 && (
              <Section title="RUNNING BACK RECORDS" records={allTimeRecords.rbRecords} color="hsl(var(--accent))" />
            )}
            {allTimeRecords.wrRecords.length > 0 && (
              <Section title="WIDE RECEIVER RECORDS" records={allTimeRecords.wrRecords} color="hsl(var(--chart-4))" />
            )}
            {allTimeRecords.teRecords.length > 0 && (
              <Section title="TIGHT END RECORDS" records={allTimeRecords.teRecords} color="hsl(var(--chart-3))" />
            )}
            {allTimeRecords.defRecords.length > 0 && (
              <Section title="DEFENSIVE RECORDS" records={allTimeRecords.defRecords} color="hsl(var(--destructive))" />
            )}
            {allTimeRecords.accoladeRecords.length > 0 && (
              <Section title="ACCOLADES & METRICS" records={allTimeRecords.accoladeRecords} color="hsl(var(--metric-elite))" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="season">
          {seasonRecords && seasonRecords.length > 0 ? (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 border-b border-border/30 pb-3 mb-4">
                <Zap className="w-5 h-5 text-accent" />
                <h3 className="font-display text-xl font-bold text-accent">
                  {currentSeason} SEASON LEADERS
                </h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {seasonRecords.map((r, i) => (
                  <RecordRow key={`${r.stat}-${r.playerName}`} record={r} rank={i + 1} />
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-2xl font-bold text-muted-foreground mb-2">No Season Data</h3>
              <p className="text-muted-foreground">Upload a new season CSV to see per-season records.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecordsTab;
