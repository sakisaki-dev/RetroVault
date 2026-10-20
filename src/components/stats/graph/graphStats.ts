import type { Player, Position } from '@/types/player';
import {
  ADV_METRICS,
  POSITIONS,
  awardPoints,
  compFeatures,
  evaluateMetric,
  plusIndex,
  type AdvContext,
  type AdvMetric,
  type MetricBoard,
} from '@/config/advanced';
import { leagueScore, playerKey } from '@/config/ovr';
import type { Overall } from '@/config/skillGrades';

/**
 * Graph Builder stat catalogue: every stat that can go on an axis, with its label, definition, direction and
 * positions. Values come from the shared modules (style features and advanced metrics in config/advanced.ts,
 * official OVR, skill ratings, career fields); nothing is re-derived here. A null value = not plotted.
 */

export type StatGroup = 'Career totals' | 'Rates' | 'Plus indexes' | 'Ratings' | 'Hardware';
export const STAT_GROUPS: StatGroup[] = ['Career totals', 'Rates', 'Plus indexes', 'Ratings', 'Hardware'];

export interface GraphDeps {
  ctx: AdvContext;
  ovrMap: Map<string, number>;
  skillMap: Map<string, Overall>;
  /** League board for a metric at a position (cached; league players only). */
  board: (m: AdvMetric, pos: Position) => MetricBoard;
}

export interface GraphStat {
  id: string;
  label: string;
  short: string;
  group: StatGroup;
  definition: string;
  lowerIsBetter?: boolean;
  positions: Position[];
  decimals: number;
  suffix?: string;
  /** Integer counts (rings, MVPs): integer ticks. */
  integer?: boolean;
  get: (p: Player, d: GraphDeps) => number | null;
}

const DEF: Position[] = ['LB', 'DB', 'DL'];
const OFF: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL'];

const field = (p: Player, key: string): number | null => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const positive = (v: number | null) => (v != null && v > 0 ? v : null);

const total = (id: string, label: string, short: string, positions: Position[], key: string, definition: string, extra: Partial<GraphStat> = {}): GraphStat => ({
  id,
  label,
  short,
  group: 'Career totals',
  definition,
  positions,
  decimals: 0,
  get: (p) => (positions.includes(p.position) ? field(p, key) : null),
  ...extra,
});

const TOTALS: GraphStat[] = [
  total('games', 'Games played', 'G', POSITIONS, 'games', 'Career games played.'),
  total('passYds', 'Passing yards', 'Pass yds', ['QB'], 'passYds', 'Career passing yards.'),
  total('passTD', 'Passing TDs', 'Pass TD', ['QB'], 'passTD', 'Career passing touchdowns.'),
  total('passINT', 'Interceptions thrown', 'INT thrown', ['QB'], 'interceptions', 'Career interceptions thrown.', { lowerIsBetter: true }),
  total('attempts', 'Pass attempts', 'Att', ['QB'], 'attempts', 'Career pass attempts.'),
  total('rushYds', 'Rushing yards', 'Rush yds', ['QB', 'RB'], 'rushYds', 'Career rushing yards.'),
  total('rushTD', 'Rushing TDs', 'Rush TD', ['QB', 'RB'], 'rushTD', 'Career rushing touchdowns.'),
  total('rushAtt', 'Carries', 'Car', ['QB', 'RB'], 'rushAtt', 'Career rushing attempts.'),
  total('receptions', 'Receptions', 'Rec', ['RB', 'WR', 'TE'], 'receptions', 'Career catches.'),
  total('recYds', 'Receiving yards', 'Rec yds', ['RB', 'WR', 'TE'], 'recYds', 'Career receiving yards.'),
  total('recTD', 'Receiving TDs', 'Rec TD', ['RB', 'WR', 'TE'], 'recTD', 'Career receiving touchdowns.'),
  total('fumbles', 'Fumbles', 'Fum', ['RB', 'WR', 'TE'], 'fumbles', 'Career fumbles.', { lowerIsBetter: true }),
  total('tackles', 'Tackles', 'Tkl', DEF, 'tackles', 'Career tackles.'),
  total('sacks', 'Sacks', 'Sacks', DEF, 'sacks', 'Career sacks.'),
  total('defINT', 'Interceptions', 'INT', DEF, 'interceptions', 'Career interceptions made.'),
  total('forcedFumbles', 'Forced fumbles', 'FF', DEF, 'forcedFumbles', 'Career forced fumbles.'),
  total('blocks', 'Blocks', 'Blk', ['OL'], 'blocks', 'Career blocks.'),
];

/** Style features (per position) merged by id; an id that is also an advanced metric is left to the metric. */
const featureStats = (): GraphStat[] => {
  const metricIds = new Set(ADV_METRICS.map((m) => m.id));
  const byId = new Map<string, GraphStat>();
  POSITIONS.forEach((pos) =>
    compFeatures(pos).forEach((f) => {
      if (metricIds.has(f.id)) return;
      const existing = byId.get(f.id);
      if (existing) {
        existing.positions.push(pos);
        return;
      }
      byId.set(f.id, {
        id: f.id,
        label: f.label,
        short: f.label,
        group: 'Rates',
        definition: f.definition,
        lowerIsBetter: f.lowerIsBetter,
        positions: [pos],
        decimals: f.decimals,
        suffix: f.suffix,
        get: (p) => {
          const feat = compFeatures(p.position).find((x) => x.id === f.id);
          if (!feat || !p.games) return null;
          const v = feat.get(p);
          return Number.isFinite(v) ? (feat.scale ?? 1) * v : null;
        },
      });
    }),
  );
  return [...byId.values()];
};

const metricStats = (): GraphStat[] =>
  ADV_METRICS.flatMap((m) => {
    const rate: GraphStat = {
      id: m.id,
      label: m.label,
      short: m.short,
      group: 'Rates',
      definition: `${m.definition} (${m.minLabel})`,
      lowerIsBetter: m.lowerIsBetter,
      positions: m.positions,
      decimals: m.decimals,
      suffix: m.suffix,
      get: (p, d) => {
        if (!m.positions.includes(p.position) || !m.qualifies(p)) return null;
        const v = m.value(p, d.ctx);
        return Number.isFinite(v) ? v : null;
      },
    };
    if (!m.plus) return [rate];
    const plus: GraphStat = {
      id: `${m.id}Plus`,
      label: `${m.label} +`,
      short: `${m.short}+`,
      group: 'Plus indexes',
      definition: `${m.label} as a + index against the league average at his position (100 = average, higher = better). ${m.minLabel}.`,
      positions: m.positions,
      decimals: 0,
      get: (p, d) => {
        const v = rate.get(p, d);
        if (v == null) return null;
        const b = d.board(m, p.position);
        return b.rows.length ? plusIndex(v, b.mean, m.lowerIsBetter) : null;
      },
    };
    return [rate, plus];
  });

const RATINGS: GraphStat[] = [
  { id: 'ovr', label: 'Official OVR', short: 'OVR', group: 'Ratings', definition: 'Official overall rating (career production and awards), same as the arcade.', positions: POSITIONS, decimals: 0, get: (p, d) => d.ovrMap.get(playerKey(p)) ?? null },
  { id: 'skill', label: 'Skill rating', short: 'Skill', group: 'Ratings', definition: 'Per-game skills graded against the position, on the OVR curve. League players only.', positions: POSITIONS, decimals: 0, get: (p, d) => d.skillMap.get(playerKey(p))?.rating ?? null },
  { id: 'careerLegacy', label: 'Career Legacy', short: 'Legacy', group: 'Ratings', definition: 'Career Legacy = 4·TT + 4·Dominance + 2·G. 7,000+ is the Hall of Fame.', positions: POSITIONS, decimals: 0, get: (p) => positive(field(p, 'careerLegacy')) },
  { id: 'trueTalent', label: 'True Talent', short: 'TT', group: 'Ratings', definition: 'True Talent, position-normalised.', positions: POSITIONS, decimals: 1, get: (p) => positive(field(p, 'trueTalent')) },
  { id: 'dominance', label: 'Dominance', short: 'Dom', group: 'Ratings', definition: 'Dominance = 0.7·TT + award points.', positions: POSITIONS, decimals: 1, get: (p) => positive(field(p, 'dominance')) },
  { id: 'tpg', label: 'Talent per game', short: 'TPG', group: 'Ratings', definition: 'TPG = True Talent / (games + 50): the peak rate.', positions: POSITIONS, decimals: 2, get: (p) => positive(field(p, 'tpg')) },
  { id: 'leagueScore', label: 'League Score', short: 'LS', group: 'Ratings', definition: 'Official League Score (production + awards), the input to OVR.', positions: POSITIONS, decimals: 0, get: (p) => leagueScore(p) },
];

const hw = (id: string, label: string, short: string, key: string, definition: string, positions: Position[] = POSITIONS): GraphStat => ({
  id,
  label,
  short,
  group: 'Hardware',
  definition,
  positions,
  decimals: 0,
  integer: true,
  get: (p) => (positions.includes(p.position) ? field(p, key) ?? 0 : null),
});

const HARDWARE: GraphStat[] = [
  hw('rings', 'Rings', 'Rings', 'rings', 'Championships won.'),
  hw('mvp', 'MVP awards', 'MVP', 'mvp', 'League MVP awards.'),
  hw('opoy', 'OPOY awards', 'OPOY', 'opoy', 'Offensive Player of the Year awards.', OFF),
  hw('dpoy', 'DPOY awards', 'DPOY', 'opoy', 'Defensive Player of the Year awards.', DEF),
  hw('sbmvp', 'Super Bowl MVPs', 'SB MVP', 'sbmvp', 'Super Bowl MVP awards.'),
  hw('roty', 'Rookie of the Year', 'ROTY', 'roty', 'Rookie of the Year award.'),
  { ...hw('awardPoints', 'Award points', 'Award pts', 'rings', 'Award points as weighted in Dominance (rings, MVP, OPOY/DPOY, SB MVP).'), integer: false, get: (p) => awardPoints(p) },
];

export const GRAPH_STATS: GraphStat[] = [...TOTALS, ...featureStats(), ...metricStats(), ...RATINGS, ...HARDWARE];
export const STAT_BY_ID = new Map(GRAPH_STATS.map((s) => [s.id, s]));

export const fmtStat = (s: GraphStat, v: number) =>
  `${v.toLocaleString('en-US', { minimumFractionDigits: s.decimals, maximumFractionDigits: s.decimals })}${s.suffix ?? ''}`;

/** Board cache factory for GraphDeps.board (league players only, as evaluateMetric always is). */
export const boardCache = (players: Player[], ctx: AdvContext) => {
  const cache = new Map<string, MetricBoard>();
  return (m: AdvMetric, pos: Position) => {
    const k = `${m.id}:${pos}`;
    let b = cache.get(k);
    if (!b) {
      b = evaluateMetric(players, m, pos, ctx);
      cache.set(k, b);
    }
    return b;
  };
};
