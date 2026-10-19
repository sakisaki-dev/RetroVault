import type { LeagueData, Player, Position } from '@/types/player';
import { AWARD_POINTS, isDefensivePosition } from './stats';
import { leagueScore } from './ovr';

/**
 * Advanced analytics for the Stats hub. Pure functions over CAREER totals only (no per-season data).
 * Every metric carries a one-line definition and an inclusive (>=) minimum-sample rule; players below
 * the minimum get no value and never enter a position average or percentile.
 * See docs/STATS_REFERENCE.md, "Advanced metrics".
 */

export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];

/** Minimum samples (inclusive). Shared with the record book so the two never disagree. */
export const ADV_MIN = {
  qbAttempts: 200,
  touches: 100,
  receptions: 50,
  games: 16,
  defGames: 32,
} as const;

/** Replacement level for Value Over Replacement: this percentile of League Score at the position. */
export const REPLACEMENT_PERCENTILE = 20;

// ---------- Small helpers ----------

const n = (p: Player, key: string): number => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const ratio = (a: number, b: number) => (b > 0 ? a / b : NaN);

/** Touches: carries + catches (RB), catches (WR/TE). */
export const touches = (p: Player) =>
  p.position === 'RB' ? n(p, 'rushAtt') + n(p, 'receptions') : n(p, 'receptions');
/** Scrimmage yards: rush + receiving (QBs are not included in this family). */
const scrimYds = (p: Player) => n(p, 'rushYds') + n(p, 'recYds');
const skillTD = (p: Player) => n(p, 'rushTD') + n(p, 'recTD');

/** Official NFL passer rating. Each component is clamped to 0–2.375. */
export const passerRating = (p: Player) => {
  const att = n(p, 'attempts');
  if (att <= 0) return NaN;
  const a = clamp((n(p, 'completions') / att - 0.3) * 5, 0, 2.375);
  const b = clamp((n(p, 'passYds') / att - 3) * 0.25, 0, 2.375);
  const c = clamp((n(p, 'passTD') / att) * 20, 0, 2.375);
  const d = clamp(2.375 - (n(p, 'interceptions') / att) * 25, 0, 2.375);
  return ((a + b + c + d) / 6) * 100;
};

/** Award points as weighted in Dominance (config/stats.ts AWARD_POINTS); defenders' `opoy` is DPOY. */
export const awardPoints = (p: Player) =>
  AWARD_POINTS.ring * p.rings +
  AWARD_POINTS.mvp * p.mvp +
  (isDefensivePosition(p.position) ? AWARD_POINTS.dpoy : AWARD_POINTS.opoy) * p.opoy +
  AWARD_POINTS.sbmvp * p.sbmvp +
  AWARD_POINTS.roty * p.roty;

// ---------- Context (position-level baselines) ----------

export interface AdvContext {
  /** League Score at REPLACEMENT_PERCENTILE for each position. */
  replacement: Partial<Record<Position, number>>;
}

/** Linear-interpolated percentile (0–100) of a numeric list. */
export const quantile = (values: number[], pct: number) => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (pct / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

export const buildContext = (players: Player[]): AdvContext => {
  const replacement: Partial<Record<Position, number>> = {};
  POSITIONS.forEach((pos) => {
    const scores = players.filter((p) => p.position === pos && !p.isRealLegend).map(leagueScore);
    if (scores.length > 0) replacement[pos] = quantile(scores, REPLACEMENT_PERCENTILE);
  });
  return { replacement };
};

// ---------- Metric catalogue ----------

export type MetricFamily = 'Passing' | 'Skill' | 'Defense' | 'Line' | 'Value';

export interface AdvMetric {
  id: string;
  label: string;
  short: string;
  family: MetricFamily;
  /** One-line definition, shown on hover/focus everywhere the metric appears. */
  definition: string;
  /** Minimum sample, printed next to the metric (e.g. "min 200 att"). */
  minLabel: string;
  positions: Position[];
  decimals: number;
  suffix?: string;
  /** Lower is better (INT%, fumble rate): percentiles and + index are inverted. */
  lowerIsBetter?: boolean;
  /** False when a ratio to the position mean is meaningless (VOR is centered near zero). */
  plus: boolean;
  /** Describes style, not quality (rush share): kept out of the better/worse heat grid. */
  styleOnly?: boolean;
  qualifies: (p: Player) => boolean;
  value: (p: Player, ctx: AdvContext) => number;
}

const minAtt = (p: Player) => n(p, 'attempts') >= ADV_MIN.qbAttempts;
const minGames = (p: Player) => p.games >= ADV_MIN.games;
const minDefGames = (p: Player) => p.games >= ADV_MIN.defGames;
const minTouches = (p: Player) =>
  p.position === 'RB' ? touches(p) >= ADV_MIN.touches : n(p, 'receptions') >= ADV_MIN.receptions;

const SKILL: Position[] = ['RB', 'WR', 'TE'];
const DEF: Position[] = ['LB', 'DB', 'DL'];

export const ADV_METRICS: AdvMetric[] = [
  // Passing
  {
    id: 'passerRating',
    label: 'Passer Rating',
    short: 'Rate',
    family: 'Passing',
    definition: 'Official NFL passer rating from Cmp%, Y/A, TD% and INT%, each component clamped to 0–2.375 (max 158.3).',
    minLabel: `min ${ADV_MIN.qbAttempts} att`,
    positions: ['QB'],
    decimals: 1,
    plus: true,
    qualifies: minAtt,
    value: passerRating,
  },
  {
    id: 'ayPerAtt',
    label: 'Adj. Yards / Attempt',
    short: 'AY/A',
    family: 'Passing',
    definition: '(Pass yds + 20·TD − 45·INT) ÷ attempts. ANY/A would also subtract sack yards, which the sheet does not track, so that term is omitted.',
    minLabel: `min ${ADV_MIN.qbAttempts} att`,
    positions: ['QB'],
    decimals: 2,
    plus: true,
    qualifies: minAtt,
    value: (p) => ratio(n(p, 'passYds') + 20 * n(p, 'passTD') - 45 * n(p, 'interceptions'), n(p, 'attempts')),
  },
  {
    id: 'tdPct',
    label: 'Touchdown %',
    short: 'TD%',
    family: 'Passing',
    definition: 'Passing touchdowns per 100 attempts.',
    minLabel: `min ${ADV_MIN.qbAttempts} att`,
    positions: ['QB'],
    decimals: 2,
    suffix: '%',
    plus: true,
    qualifies: minAtt,
    value: (p) => ratio(n(p, 'passTD'), n(p, 'attempts')) * 100,
  },
  {
    id: 'intPct',
    label: 'Interception %',
    short: 'INT%',
    family: 'Passing',
    definition: 'Interceptions per 100 attempts. Lower is better: + index is avg ÷ value and the percentile is inverted.',
    minLabel: `min ${ADV_MIN.qbAttempts} att`,
    positions: ['QB'],
    decimals: 2,
    suffix: '%',
    lowerIsBetter: true,
    plus: true,
    qualifies: minAtt,
    value: (p) => ratio(n(p, 'interceptions'), n(p, 'attempts')) * 100,
  },
  {
    id: 'rushShare',
    label: 'Rush Share',
    short: 'Rush%',
    family: 'Passing',
    definition: 'Rushing yards as a share of total yards (pass + rush). A style marker: high means a dual threat.',
    minLabel: `min ${ADV_MIN.qbAttempts} att`,
    positions: ['QB'],
    decimals: 1,
    suffix: '%',
    plus: true,
    styleOnly: true,
    qualifies: minAtt,
    value: (p) => ratio(n(p, 'rushYds'), n(p, 'passYds') + n(p, 'rushYds')) * 100,
  },
  // Skill positions
  {
    id: 'scrimPerGame',
    label: 'Scrimmage Yds / Game',
    short: 'Yds/G',
    family: 'Skill',
    definition: 'Rushing + receiving yards per game played.',
    minLabel: `min ${ADV_MIN.games} games`,
    positions: SKILL,
    decimals: 1,
    plus: true,
    qualifies: minGames,
    value: (p) => ratio(scrimYds(p), p.games),
  },
  {
    id: 'ydsPerTouch',
    label: 'Yards / Touch',
    short: 'Y/Tch',
    family: 'Skill',
    definition: 'Scrimmage yards ÷ touches (carries + receptions).',
    minLabel: `min ${ADV_MIN.touches} touches`,
    positions: ['RB'],
    decimals: 2,
    plus: true,
    qualifies: minTouches,
    value: (p) => ratio(scrimYds(p), touches(p)),
  },
  {
    id: 'tdPer16',
    label: 'Total TD / 16 Games',
    short: 'TD/16',
    family: 'Skill',
    definition: 'Rushing + receiving touchdowns per 16 games, a full-season pace.',
    minLabel: `min ${ADV_MIN.games} games`,
    positions: SKILL,
    decimals: 1,
    plus: true,
    qualifies: minGames,
    value: (p) => ratio(skillTD(p), p.games) * 16,
  },
  {
    id: 'fumbleRate',
    label: 'Fumble Rate',
    short: 'Fum%',
    family: 'Skill',
    definition: 'Fumbles per 100 touches. Lower is better: + index is avg ÷ value and the percentile is inverted.',
    minLabel: `min ${ADV_MIN.touches} touches (RB) / ${ADV_MIN.receptions} rec`,
    positions: SKILL,
    decimals: 2,
    suffix: '%',
    lowerIsBetter: true,
    plus: true,
    qualifies: minTouches,
    value: (p) => ratio(n(p, 'fumbles'), touches(p)) * 100,
  },
  // Defense
  {
    id: 'impactPerGame',
    label: 'Impact Plays / Game',
    short: 'Imp/G',
    family: 'Defense',
    definition: '(Sacks + interceptions + forced fumbles) per game: drive-ending plays.',
    minLabel: `min ${ADV_MIN.defGames} games`,
    positions: DEF,
    decimals: 2,
    plus: true,
    qualifies: minDefGames,
    value: (p) => ratio(n(p, 'sacks') + n(p, 'interceptions') + n(p, 'forcedFumbles'), p.games),
  },
  {
    id: 'takeawaysPer16',
    label: 'Takeaways / 16 Games',
    short: 'TkA/16',
    family: 'Defense',
    definition: '(Interceptions + forced fumbles) per 16 games.',
    minLabel: `min ${ADV_MIN.defGames} games`,
    positions: DEF,
    decimals: 1,
    plus: true,
    qualifies: minDefGames,
    value: (p) => ratio(n(p, 'interceptions') + n(p, 'forcedFumbles'), p.games) * 16,
  },
  {
    id: 'tacklesPerGame',
    label: 'Tackles / Game',
    short: 'Tkl/G',
    family: 'Defense',
    definition: 'Career tackles per game played.',
    minLabel: `min ${ADV_MIN.defGames} games`,
    positions: DEF,
    decimals: 2,
    plus: true,
    qualifies: minDefGames,
    value: (p) => ratio(n(p, 'tackles'), p.games),
  },
  // Line
  {
    id: 'blocksPerGame',
    label: 'Blocks / Game',
    short: 'Blk/G',
    family: 'Line',
    definition: 'Career blocks per game played.',
    minLabel: `min ${ADV_MIN.games} games`,
    positions: ['OL'],
    decimals: 2,
    plus: true,
    qualifies: minGames,
    value: (p) => ratio(n(p, 'blocks'), p.games),
  },
  // Cross-position value
  {
    id: 'scorePerGame',
    label: 'League Score / Game',
    short: 'LS/G',
    family: 'Value',
    definition: 'Official League Score (production + awards, the input to OVR) per game: the production rate.',
    minLabel: `min ${ADV_MIN.games} games`,
    positions: POSITIONS,
    decimals: 2,
    plus: true,
    qualifies: minGames,
    value: (p) => ratio(leagueScore(p), p.games),
  },
  {
    id: 'vor',
    label: 'Value Over Replacement',
    short: 'VOR',
    family: 'Value',
    definition: `League Score minus a replacement-level player's (the ${REPLACEMENT_PERCENTILE}th percentile at the position). Negative means below replacement.`,
    minLabel: 'min 1 game',
    positions: POSITIONS,
    decimals: 0,
    plus: false,
    qualifies: (p) => p.games >= 1,
    value: (p, ctx) => leagueScore(p) - (ctx.replacement[p.position] ?? 0),
  },
  {
    id: 'vorPer16',
    label: 'VOR / 16 Games',
    short: 'VOR/16',
    family: 'Value',
    definition: 'Value Over Replacement per 16 games: how far above replacement a player is per season of work.',
    minLabel: `min ${ADV_MIN.games} games`,
    positions: POSITIONS,
    decimals: 1,
    plus: false,
    qualifies: minGames,
    value: (p, ctx) => ratio(leagueScore(p) - (ctx.replacement[p.position] ?? 0), p.games) * 16,
  },
  {
    id: 'awardRate',
    label: 'Award Points / 100 Games',
    short: 'Awd/100',
    family: 'Value',
    definition: `Award points as weighted in Dominance (ring ${AWARD_POINTS.ring}, MVP ${AWARD_POINTS.mvp}, OPOY ${AWARD_POINTS.opoy} / DPOY ${AWARD_POINTS.dpoy}, SB MVP ${AWARD_POINTS.sbmvp}) per 100 games.`,
    minLabel: `min ${ADV_MIN.games} games`,
    positions: POSITIONS,
    decimals: 1,
    plus: true,
    qualifies: minGames,
    value: (p) => ratio(awardPoints(p), p.games) * 100,
  },
];

export const METRIC_BY_ID = new Map(ADV_METRICS.map((m) => [m.id, m]));

export const metricsFor = (pos: Position) => ADV_METRICS.filter((m) => m.positions.includes(pos));

/** The headline rate stat per position (used for the summary + index). */
export const HEADLINE_METRIC: Record<Position, string> = {
  QB: 'passerRating',
  RB: 'scrimPerGame',
  WR: 'scrimPerGame',
  TE: 'scrimPerGame',
  OL: 'blocksPerGame',
  LB: 'impactPerGame',
  DB: 'impactPerGame',
  DL: 'impactPerGame',
};

// ---------- Evaluation: value, + index, percentile ----------

export interface MetricRow {
  player: Player;
  value: number;
  /** 100 = position average among qualifiers; null when the metric has no + index. */
  plus: number | null;
  /** 0 (worst qualifier) – 100 (best qualifier), direction-aware. */
  pct: number;
  rank: number;
}

export interface MetricBoard {
  metric: AdvMetric;
  position: Position;
  rows: MetricRow[];
  mean: number;
  /** Players at the position who miss the minimum sample. */
  belowMin: number;
}

/**
 * + index, 100 = position average among qualifiers (like OPS+ / ERA+):
 * higher is better → 100 × value / avg; lower is better → 100 × avg / value. 130 = 30% better than average.
 * Capped at PLUS_CAP so a zero-INT or zero-fumble sample does not explode.
 */
export const PLUS_CAP = 300;
export const plusIndex = (value: number, mean: number, lowerIsBetter = false) => {
  if (!(mean > 0) || !Number.isFinite(value)) return null;
  if (lowerIsBetter) return value > 0 ? Math.min(PLUS_CAP, (100 * mean) / value) : PLUS_CAP;
  return Math.min(PLUS_CAP, Math.max(0, (100 * value) / mean));
};

/** Mid-rank percentile among qualifiers: best = 100, worst = 0, ties share a value. */
const percentiles = (values: number[], lowerIsBetter: boolean) => {
  const len = values.length;
  return values.map((v) => {
    if (len <= 1) return 100;
    let below = 0;
    let equal = 0;
    values.forEach((o) => {
      if (lowerIsBetter ? o > v : o < v) below += 1;
      else if (o === v) equal += 1;
    });
    return ((below + (equal - 1) / 2) / (len - 1)) * 100;
  });
};

export const evaluateMetric = (players: Player[], metric: AdvMetric, position: Position, ctx: AdvContext): MetricBoard => {
  const atPos = players.filter((p) => p.position === position && !p.isRealLegend);
  const scored = atPos
    .filter(metric.qualifies)
    .map((p) => ({ player: p, value: metric.value(p, ctx) }))
    .filter((r) => Number.isFinite(r.value));
  const mean = scored.length ? scored.reduce((s, r) => s + r.value, 0) / scored.length : 0;
  const pcts = percentiles(
    scored.map((r) => r.value),
    !!metric.lowerIsBetter,
  );
  const rows = scored
    .map((r, i) => ({
      ...r,
      plus: metric.plus ? plusIndex(r.value, mean, metric.lowerIsBetter) : null,
      pct: pcts[i],
      rank: 0,
    }))
    .sort((a, b) => (metric.lowerIsBetter ? a.value - b.value : b.value - a.value) || a.player.name.localeCompare(b.player.name));
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].value === r.value ? rows[i - 1].rank : i + 1;
  });
  return { metric, position, rows, mean, belowMin: atPos.length - scored.length };
};

/** Every metric for one position, keyed by metric id. */
export const evaluatePosition = (players: Player[], position: Position, ctx: AdvContext) =>
  new Map(metricsFor(position).map((m) => [m.id, evaluateMetric(players, m, position, ctx)]));

// ---------- Legacy composition ----------

export interface LegacyMix {
  /** 6.8 × True Talent (4·TT directly, plus 4 × the 0.7·TT inside Dominance). */
  talent: number;
  /** 4 × award points (the award part of Dominance, weighted 4 in Career Legacy). */
  awards: number;
  /** 2 × games. */
  longevity: number;
  total: number;
}

/**
 * Splits Career Legacy (= 4·TT + 4·Dom + 2·G, Dom = 0.7·TT + award points) into its three sources.
 * The parts sum to the recomputed Career Legacy exactly (the stored value is rounded to 3 places).
 */
export const legacyMix = (p: Player): LegacyMix => {
  const talent = 6.8 * p.trueTalent;
  const awards = 4 * awardPoints(p);
  const longevity = 2 * p.games;
  return { talent, awards, longevity, total: talent + awards + longevity };
};

// ---------- Similarity (career comps) ----------

/** Per-game / rate features used for comps, z-scored within the position. */
const COMP_FEATURES: Record<Position, { label: string; get: (p: Player) => number }[]> = {
  QB: [
    { label: 'Pass yds/G', get: (p) => ratio(n(p, 'passYds'), p.games) },
    { label: 'Pass TD/G', get: (p) => ratio(n(p, 'passTD'), p.games) },
    { label: 'Rating', get: passerRating },
    { label: 'INT%', get: (p) => ratio(n(p, 'interceptions'), n(p, 'attempts')) },
    { label: 'Rush yds/G', get: (p) => ratio(n(p, 'rushYds'), p.games) },
  ],
  RB: [
    { label: 'Rush yds/G', get: (p) => ratio(n(p, 'rushYds'), p.games) },
    { label: 'Y/C', get: (p) => ratio(n(p, 'rushYds'), n(p, 'rushAtt')) },
    { label: 'Rec yds/G', get: (p) => ratio(n(p, 'recYds'), p.games) },
    { label: 'TD/G', get: (p) => ratio(skillTD(p), p.games) },
  ],
  WR: [
    { label: 'Rec/G', get: (p) => ratio(n(p, 'receptions'), p.games) },
    { label: 'Rec yds/G', get: (p) => ratio(n(p, 'recYds'), p.games) },
    { label: 'Y/R', get: (p) => ratio(n(p, 'recYds'), n(p, 'receptions')) },
    { label: 'TD/G', get: (p) => ratio(n(p, 'recTD'), p.games) },
  ],
  TE: [
    { label: 'Rec/G', get: (p) => ratio(n(p, 'receptions'), p.games) },
    { label: 'Rec yds/G', get: (p) => ratio(n(p, 'recYds'), p.games) },
    { label: 'Y/R', get: (p) => ratio(n(p, 'recYds'), n(p, 'receptions')) },
    { label: 'TD/G', get: (p) => ratio(n(p, 'recTD'), p.games) },
  ],
  OL: [{ label: 'Blocks/G', get: (p) => ratio(n(p, 'blocks'), p.games) }],
  LB: [],
  DB: [],
  DL: [],
};
const DEF_FEATURES = [
  { label: 'Tackles/G', get: (p: Player) => ratio(n(p, 'tackles'), p.games) },
  { label: 'Sacks/G', get: (p: Player) => ratio(n(p, 'sacks'), p.games) },
  { label: 'INT/G', get: (p: Player) => ratio(n(p, 'interceptions'), p.games) },
  { label: 'FF/G', get: (p: Player) => ratio(n(p, 'forcedFumbles'), p.games) },
];
DEF.forEach((pos) => {
  COMP_FEATURES[pos] = DEF_FEATURES;
});
/** Shape-of-career features shared by every position. */
const CAREER_FEATURES = [
  { label: 'Games', get: (p: Player) => p.games },
  { label: 'True Talent', get: (p: Player) => p.trueTalent },
];

export const compFeatureLabels = (pos: Position) => [...COMP_FEATURES[pos], ...CAREER_FEATURES].map((f) => f.label);

export interface Comp {
  player: Player;
  /** 0–100: 100·exp(−d² / 2k), d = Euclidean distance over k z-scored features. */
  similarity: number;
}

/**
 * Nearest careers at the same position by z-scored per-game rates + games + True Talent.
 * A feature with no spread (or no value for either player) is skipped.
 */
export const similarPlayers = (players: Player[], target: Player, count = 3): Comp[] => {
  const pool = players.filter((p) => p.position === target.position && !p.isRealLegend && p.games > 0);
  const features = [...COMP_FEATURES[target.position], ...CAREER_FEATURES];
  const stats = features.map((f) => {
    const vals = pool.map(f.get).filter(Number.isFinite);
    const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length || 1));
    return { get: f.get, mean, sd };
  });
  const z = (p: Player) => stats.map((s) => (s.sd > 0 ? (s.get(p) - s.mean) / s.sd : NaN));
  const zt = z(target);
  return pool
    .filter((p) => p !== target && p.name !== target.name)
    .map((p) => {
      const zp = z(p);
      let d2 = 0;
      let k = 0;
      zt.forEach((v, i) => {
        if (Number.isFinite(v) && Number.isFinite(zp[i])) {
          d2 += (v - zp[i]) ** 2;
          k += 1;
        }
      });
      return { player: p, similarity: k > 0 ? 100 * Math.exp(-d2 / (2 * k)) : 0 };
    })
    .sort((a, b) => b.similarity - a.similarity || a.player.name.localeCompare(b.player.name))
    .slice(0, count);
};

// ---------- Convenience ----------

export const leaguePlayers = (data: LeagueData | null | undefined): Player[] =>
  data
    ? [
        ...data.quarterbacks,
        ...data.runningbacks,
        ...data.widereceivers,
        ...data.tightends,
        ...data.offensiveline,
        ...data.linebackers,
        ...data.defensivebacks,
        ...data.defensiveline,
      ].filter((p) => !p.isRealLegend)
    : [];
