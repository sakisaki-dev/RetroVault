import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { Trophy, Target, Zap, Shield } from 'lucide-react';
import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';

interface Record {
  category: string;
  stat: string;
  value: number;
  playerName: string;
  position: string;
  icon?: string;
}

const RecordsTab = () => {
  const { careerData } = useLeague();

  const records = useMemo(() => {
    if (!careerData) return { offense: [], defense: [], metrics: [] };

    const offense: Record[] = [];
    const defense: Record[] = [];
    const metrics: Record[] = [];

    // QB Records
    if (careerData.quarterbacks.length > 0) {
      const qbs = careerData.quarterbacks;
      const maxPassYds = qbs.reduce((max, p) => p.passYds > max.passYds ? p : max);
      const maxPassTD = qbs.reduce((max, p) => p.passTD > max.passTD ? p : max);
      const maxRushYdsQB = qbs.reduce((max, p) => p.rushYds > max.rushYds ? p : max);
      const maxRushTDQB = qbs.reduce((max, p) => p.rushTD > max.rushTD ? p : max);
      const maxGamesQB = qbs.reduce((max, p) => p.games > max.games ? p : max);

      offense.push(
        { category: 'QB', stat: 'Career Pass Yards', value: maxPassYds.passYds, playerName: maxPassYds.name, position: 'QB' },
        { category: 'QB', stat: 'Career Pass TDs', value: maxPassTD.passTD, playerName: maxPassTD.name, position: 'QB' },
        { category: 'QB', stat: 'QB Rush Yards', value: maxRushYdsQB.rushYds, playerName: maxRushYdsQB.name, position: 'QB' },
        { category: 'QB', stat: 'QB Rush TDs', value: maxRushTDQB.rushTD, playerName: maxRushTDQB.name, position: 'QB' },
        { category: 'QB', stat: 'Games (QB)', value: maxGamesQB.games, playerName: maxGamesQB.name, position: 'QB' },
      );
    }

    // RB Records
    if (careerData.runningbacks.length > 0) {
      const rbs = careerData.runningbacks;
      const maxRushYds = rbs.reduce((max, p) => p.rushYds > max.rushYds ? p : max);
      const maxRushTD = rbs.reduce((max, p) => p.rushTD > max.rushTD ? p : max);
      const maxRecYdsRB = rbs.reduce((max, p) => p.recYds > max.recYds ? p : max);
      const maxRecTDRB = rbs.reduce((max, p) => p.recTD > max.recTD ? p : max);

      offense.push(
        { category: 'RB', stat: 'Career Rush Yards', value: maxRushYds.rushYds, playerName: maxRushYds.name, position: 'RB' },
        { category: 'RB', stat: 'Career Rush TDs', value: maxRushTD.rushTD, playerName: maxRushTD.name, position: 'RB' },
        { category: 'RB', stat: 'RB Rec Yards', value: maxRecYdsRB.recYds, playerName: maxRecYdsRB.name, position: 'RB' },
        { category: 'RB', stat: 'RB Rec TDs', value: maxRecTDRB.recTD, playerName: maxRecTDRB.name, position: 'RB' },
      );
    }

    // WR Records
    if (careerData.widereceivers.length > 0) {
      const wrs = careerData.widereceivers;
      const maxRec = wrs.reduce((max, p) => p.receptions > max.receptions ? p : max);
      const maxRecYds = wrs.reduce((max, p) => p.recYds > max.recYds ? p : max);
      const maxRecTD = wrs.reduce((max, p) => p.recTD > max.recTD ? p : max);
      const maxLongest = wrs.reduce((max, p) => p.longest > max.longest ? p : max);

      offense.push(
        { category: 'WR', stat: 'Career Receptions', value: maxRec.receptions, playerName: maxRec.name, position: 'WR' },
        { category: 'WR', stat: 'Career Rec Yards', value: maxRecYds.recYds, playerName: maxRecYds.name, position: 'WR' },
        { category: 'WR', stat: 'Career Rec TDs', value: maxRecTD.recTD, playerName: maxRecTD.name, position: 'WR' },
        { category: 'WR', stat: 'Longest Reception', value: maxLongest.longest, playerName: maxLongest.name, position: 'WR' },
      );
    }

    // TE Records
    if (careerData.tightends.length > 0) {
      const tes = careerData.tightends;
      const maxRecTE = tes.reduce((max, p) => p.receptions > max.receptions ? p : max);
      const maxRecYdsTE = tes.reduce((max, p) => p.recYds > max.recYds ? p : max);
      const maxRecTDTE = tes.reduce((max, p) => p.recTD > max.recTD ? p : max);

      offense.push(
        { category: 'TE', stat: 'TE Receptions', value: maxRecTE.receptions, playerName: maxRecTE.name, position: 'TE' },
        { category: 'TE', stat: 'TE Rec Yards', value: maxRecYdsTE.recYds, playerName: maxRecYdsTE.name, position: 'TE' },
        { category: 'TE', stat: 'TE Rec TDs', value: maxRecTDTE.recTD, playerName: maxRecTDTE.name, position: 'TE' },
      );
    }

    // Defensive Records
    const allDefense = [
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ] as (LBPlayer | DBPlayer | DLPlayer)[];

    if (allDefense.length > 0) {
      const maxTackles = allDefense.reduce((max, p) => p.tackles > max.tackles ? p : max);
      const maxInts = allDefense.reduce((max, p) => p.interceptions > max.interceptions ? p : max);
      const maxSacks = allDefense.reduce((max, p) => p.sacks > max.sacks ? p : max);
      const maxFF = allDefense.reduce((max, p) => p.forcedFumbles > max.forcedFumbles ? p : max);

      defense.push(
        { category: 'DEF', stat: 'Career Tackles', value: maxTackles.tackles, playerName: maxTackles.name, position: maxTackles.position },
        { category: 'DEF', stat: 'Career Interceptions', value: maxInts.interceptions, playerName: maxInts.name, position: maxInts.position },
        { category: 'DEF', stat: 'Career Sacks', value: maxSacks.sacks, playerName: maxSacks.name, position: maxSacks.position },
        { category: 'DEF', stat: 'Career Forced Fumbles', value: maxFF.forcedFumbles, playerName: maxFF.name, position: maxFF.position },
      );
    }

    // Metric Records (all positions)
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

    if (allPlayers.length > 0) {
      const maxLegacy = allPlayers.reduce((max, p) => p.careerLegacy > max.careerLegacy ? p : max);
      const maxTalent = allPlayers.reduce((max, p) => p.trueTalent > max.trueTalent ? p : max);
      const maxDominance = allPlayers.reduce((max, p) => p.dominance > max.dominance ? p : max);
      const maxTPG = allPlayers.reduce((max, p) => p.tpg > max.tpg ? p : max);
      const maxRings = allPlayers.reduce((max, p) => p.rings > max.rings ? p : max);
      const maxMVP = allPlayers.reduce((max, p) => p.mvp > max.mvp ? p : max);
      const maxGames = allPlayers.reduce((max, p) => p.games > max.games ? p : max);

      metrics.push(
        { category: 'LEGACY', stat: 'Career Legacy', value: maxLegacy.careerLegacy, playerName: maxLegacy.name, position: maxLegacy.position },
        { category: 'TALENT', stat: 'True Talent', value: maxTalent.trueTalent, playerName: maxTalent.name, position: maxTalent.position },
        { category: 'DOM', stat: 'Dominance', value: maxDominance.dominance, playerName: maxDominance.name, position: maxDominance.position },
        { category: 'TPG', stat: 'Talent Per Game', value: maxTPG.tpg, playerName: maxTPG.name, position: maxTPG.position },
        { category: 'RINGS', stat: 'Championships', value: maxRings.rings, playerName: maxRings.name, position: maxRings.position },
        { category: 'MVP', stat: 'MVP Awards', value: maxMVP.mvp, playerName: maxMVP.name, position: maxMVP.position },
        { category: 'IRON', stat: 'Games Played', value: maxGames.games, playerName: maxGames.name, position: maxGames.position },
      );
    }

    return { offense, defense, metrics };
  }, [careerData]);

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-4xl font-bold mb-4 text-primary">
            LEAGUE RECORDS
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload your league data to view all-time records.
          </p>
        </div>
      </div>
    );
  }

  const RecordCard = ({ record, index }: { record: Record; index: number }) => (
    <div className="glass-card p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
      <div className="text-3xl font-display font-bold text-muted-foreground/40 w-10">
        {index + 1}
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{record.stat}</p>
        <p className="font-bold">{record.playerName}</p>
      </div>
      <PositionBadge position={record.position as any} />
      <div className="text-right">
        <p className="font-mono text-xl font-bold text-primary">
          {record.value.toLocaleString()}
        </p>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="glass-card-glow p-8 mb-8 text-center">
        <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="font-display text-5xl font-bold tracking-wider text-primary mb-2">
          LEAGUE RECORDS
        </h2>
        <p className="text-muted-foreground">
          All-time statistical leaders across all categories
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Offensive Records */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-chart-4" />
            <h3 className="font-display text-xl font-bold tracking-wide text-chart-4">OFFENSE</h3>
          </div>
          {records.offense.map((record, i) => (
            <RecordCard key={record.stat} record={record} index={i} />
          ))}
        </div>

        {/* Defensive Records */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-accent" />
            <h3 className="font-display text-xl font-bold tracking-wide text-accent">DEFENSE</h3>
          </div>
          {records.defense.map((record, i) => (
            <RecordCard key={record.stat} record={record} index={i} />
          ))}
        </div>

        {/* Metric Records */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-metric-elite" />
            <h3 className="font-display text-xl font-bold tracking-wide text-metric-elite">METRICS</h3>
          </div>
          {records.metrics.map((record, i) => (
            <RecordCard key={record.stat} record={record} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecordsTab;
