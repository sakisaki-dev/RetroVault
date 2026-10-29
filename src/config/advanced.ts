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
    label: 'Value / Game',
    short: 'Val/G',
    family: 'Value',
    definition: 'League Score (production + awards, the input to OVR) per game played: what a player is worth each time he takes the field.',
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

/** A player scored against a league board without joining it (no rank; the board is unchanged). */
export interface PlacedRow {
  player: Player;
  value: number;
  plus: number | null;
  /** Share of the league qualifiers he beats, direction-aware (0–100, ties count half). */
  pct: number;
}

/**
 * Places an outside player (a real NFL legend) on a league board: same value formula, + index against the
 * league mean, percentile against the league qualifiers. League means, ranks and percentiles never move.
 * Null when he plays another position, misses the minimum sample or the value is not finite.
 */
export const placeOnBoard = (board: MetricBoard, player: Player, ctx: AdvContext): PlacedRow | null => {
  const { metric } = board;
  if (player.position !== board.position || !metric.qualifies(player)) return null;
  const value = metric.value(player, ctx);
  if (!Number.isFinite(value)) return null;
  let beaten = 0;
  board.rows.forEach((r) => {
    if (metric.lowerIsBetter ? r.value > value : r.value < value) beaten += 1;
    else if (r.value === value) beaten += 0.5;
  });
  return {
    player,
    value,
    plus: metric.plus ? plusIndex(value, board.mean, metric.lowerIsBetter) : null,
    pct: board.rows.length ? (100 * beaten) / board.rows.length : 100,
  };
};

/** Games needed for the all-positions Value board: a fuller career than the 16-game metric minimum. */
export const VALUE_ACROSS_MIN_GAMES = 60;

export interface ValueAcrossRow {
  player: Player;
  /** Value / Game (League Score per game). */
  value: number;
  /** Standard deviations above his position's average Value / Game (qualifiers only). */
  sigma: number;
  /** Rank by Value / Game within his position, and how many qualify there. */
  posRank: number;
  posCount: number;
  rank: number;
}

/**
 * Value / Game ranked across every position. Raw values don't compare (a WR's average is far above a DL's) and the
 * + index flatters positions with a wide spread, so each player is scored by how far above his own position's average
 * he sits, in standard deviations, among players with VALUE_ACROSS_MIN_GAMES+ games.
 */
export const valueAcrossPositions = (players: Player[], minGames = VALUE_ACROSS_MIN_GAMES): ValueAcrossRow[] => {
  const rows: ValueAcrossRow[] = [];
  POSITIONS.forEach((pos) => {
    const scored = players
      .filter((p) => p.position === pos && !p.isRealLegend && p.games >= minGames)
      .map((p) => ({ player: p, value: leagueScore(p) / p.games }))
      .sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name));
    if (scored.length < 2) return;
    const mean = scored.reduce((s, r) => s + r.value, 0) / scored.length;
    const sd = Math.sqrt(scored.reduce((s, r) => s + (r.value - mean) ** 2, 0) / scored.length);
    if (!(sd > 0)) return;
    scored.forEach((r, i) => rows.push({ ...r, sigma: (r.value - mean) / sd, posRank: i + 1, posCount: scored.length, rank: 0 }));
  });
  rows.sort((a, b) => b.sigma - a.sigma || a.player.name.localeCompare(b.player.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
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

// ---------- Similarity (play-style comps) ----------

/**
 * One play-style feature: a per-game or efficiency rate (never a career total, games or True Talent),
 * so a rookie can match a ten-year veteran who plays the same way.
 */
export interface CompFeature {
  id: string;
  label: string;
  /** Plain-language definition (tooltips, Build-a-Legend). */
  definition: string;
  get: (p: Player) => number;
  /** Relative weight in the distance (1 = normal; 0.5 for a feature that mostly repeats others). */
  weight: number;
  decimals: number;
  /** Display multiplier (e.g. 100 for a share shown as a percent) and suffix. */
  scale?: number;
  suffix?: string;
  lowerIsBetter?: boolean;
}

/** Players below this many games still get matched, but are flagged as a small sample and don't set the z-score baselines. */
export const SIM_MIN_GAMES = 8;
/** Fewer usable features than this (missing inputs, no games): "insufficient data", never scored (OL: its one feature). */
export const SIM_MIN_FEATURES = 3;
/** The style (shape) score needs at least this many shared features for a correlation. */
export const SIM_MIN_STYLE_FEATURES = 4;

// Strict inputs for similarity: a stat that is missing from the sheet is NaN (never treated as 0), and a rate
// whose denominator is zero or missing is NaN, so a partial stat line can't fake an extreme value.
const v = (p: Player, key: string): number => {
  const x = (p as unknown as Record<string, unknown>)[key];
  return typeof x === 'number' && Number.isFinite(x) ? x : NaN;
};
const safeDiv = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : NaN);
const sum = (p: Player, ...keys: string[]) => keys.reduce((s, k) => s + v(p, k), 0);
const perG = (key: string) => (p: Player) => safeDiv(v(p, key), p.games);
const perAtt = (key: string) => (p: Player) => safeDiv(v(p, key), v(p, 'attempts'));
const strictRating = (p: Player) => (v(p, 'attempts') > 0 && [v(p, 'completions'), v(p, 'passYds'), v(p, 'passTD'), v(p, 'interceptions')].every(Number.isFinite) ? passerRating(p) : NaN);

const STYLE_FEATURES: Record<Position, CompFeature[]> = {
  QB: [
    { id: 'ya', label: 'Y/A', definition: 'Passing yards per attempt.', get: perAtt('passYds'), weight: 1, decimals: 1 },
    { id: 'cmp', label: 'Cmp%', definition: 'Completions per attempt.', get: perAtt('completions'), weight: 1, decimals: 1, scale: 100, suffix: '%' },
    { id: 'tdPct', label: 'TD%', definition: 'Passing touchdowns per attempt.', get: perAtt('passTD'), weight: 1, decimals: 1, scale: 100, suffix: '%' },
    { id: 'intPct', label: 'INT%', definition: 'Interceptions per attempt.', get: perAtt('interceptions'), weight: 1, decimals: 1, scale: 100, suffix: '%', lowerIsBetter: true },
    { id: 'rating', label: 'Rating', definition: 'Official NFL passer rating (mostly a blend of the four rates above, so it counts half).', get: strictRating, weight: 0.5, decimals: 1 },
    { id: 'passYdsG', label: 'Pass yds/G', definition: 'Passing yards per game played.', get: perG('passYds'), weight: 1, decimals: 1 },
    { id: 'rushYdsG', label: 'Rush yds/G', definition: 'Rushing yards per game played.', get: perG('rushYds'), weight: 1, decimals: 1 },
    {
      id: 'rushShare',
      label: 'Rush share',
      definition: 'Designed runs and scrambles as a share of all plays (carries / (carries + pass attempts)).',
      get: (p) => (v(p, 'attempts') > 0 ? safeDiv(v(p, 'rushAtt'), sum(p, 'rushAtt', 'attempts')) : NaN),
      weight: 1,
      decimals: 1,
      scale: 100,
      suffix: '%',
    },
  ],
  RB: [
    { id: 'ypc', label: 'Y/C', definition: 'Rushing yards per carry.', get: (p) => safeDiv(v(p, 'rushYds'), v(p, 'rushAtt')), weight: 1, decimals: 2 },
    { id: 'rushYdsG', label: 'Rush yds/G', definition: 'Rushing yards per game played.', get: perG('rushYds'), weight: 1, decimals: 1 },
    { id: 'recYdsG', label: 'Rec yds/G', definition: 'Receiving yards per game played.', get: perG('recYds'), weight: 1, decimals: 1 },
    { id: 'recShare', label: 'Rec share', definition: 'Receiving yards as a share of scrimmage yards.', get: (p) => safeDiv(v(p, 'recYds'), sum(p, 'rushYds', 'recYds')), weight: 1, decimals: 1, scale: 100, suffix: '%' },
    { id: 'td16', label: 'TD/16', definition: 'Rushing + receiving touchdowns per 16 games.', get: (p) => safeDiv(16 * sum(p, 'rushTD', 'recTD'), p.games), weight: 1, decimals: 1 },
    { id: 'fumRate', label: 'Fum/100 tch', definition: 'Fumbles per 100 touches (carries + catches).', get: (p) => safeDiv(100 * v(p, 'fumbles'), sum(p, 'rushAtt', 'receptions')), weight: 1, decimals: 2, lowerIsBetter: true },
    { id: 'ypt', label: 'Yds/touch', definition: 'Scrimmage yards per touch.', get: (p) => safeDiv(sum(p, 'rushYds', 'recYds'), sum(p, 'rushAtt', 'receptions')), weight: 1, decimals: 2 },
  ],
  WR: [],
  TE: [],
  OL: [{ id: 'blocksG', label: 'Blocks/G', definition: 'Blocks per game played.', get: perG('blocks'), weight: 1, decimals: 2 }],
  LB: [],
  DB: [],
  DL: [],
};
const RECV_FEATURES: CompFeature[] = [
  { id: 'recG', label: 'Rec/G', definition: 'Catches per game played.', get: perG('receptions'), weight: 1, decimals: 2 },
  { id: 'recYdsG', label: 'Yds/G', definition: 'Receiving yards per game played.', get: perG('recYds'), weight: 1, decimals: 1 },
  { id: 'ypr', label: 'Y/R', definition: 'Yards per reception.', get: (p) => safeDiv(v(p, 'recYds'), v(p, 'receptions')), weight: 1, decimals: 1 },
  { id: 'tdPerRec', label: 'TD/rec', definition: 'Receiving touchdowns per catch.', get: (p) => safeDiv(v(p, 'recTD'), v(p, 'receptions')), weight: 1, decimals: 1, scale: 100, suffix: '%' },
  { id: 'fumRate', label: 'Fum/100 rec', definition: 'Fumbles per 100 catches.', get: (p) => safeDiv(100 * v(p, 'fumbles'), v(p, 'receptions')), weight: 1, decimals: 2, lowerIsBetter: true },
];
const DEF_STYLE: CompFeature[] = [
  { id: 'tklG', label: 'Tackles/G', definition: 'Tackles per game played.', get: perG('tackles'), weight: 1, decimals: 2 },
  { id: 'sackG', label: 'Sacks/G', definition: 'Sacks per game played.', get: perG('sacks'), weight: 1, decimals: 2 },
  { id: 'intG', label: 'INT/G', definition: 'Interceptions per game played.', get: perG('interceptions'), weight: 1, decimals: 3 },
  { id: 'ffG', label: 'FF/G', definition: 'Forced fumbles per game played.', get: perG('forcedFumbles'), weight: 1, decimals: 3 },
  {
    id: 'impactG',
    label: 'Impact/G',
    definition: 'Sacks + interceptions + forced fumbles per game (sums the three above, so it counts half).',
    get: (p) => safeDiv(sum(p, 'sacks', 'interceptions', 'forcedFumbles'), p.games),
    weight: 0.5,
    decimals: 2,
  },
];
STYLE_FEATURES.WR = RECV_FEATURES;
STYLE_FEATURES.TE = RECV_FEATURES;
DEF.forEach((pos) => {
  STYLE_FEATURES[pos] = DEF_STYLE;
});

/** The play-style features similarity compares at a position, in a fixed order. */
export const compFeatures = (pos: Position): CompFeature[] => STYLE_FEATURES[pos];

export const compFeatureLabels = (pos: Position) => STYLE_FEATURES[pos].map((f) => f.label);

/** A player's raw feature values, in `compFeatures(pos)` order (NaN where a rate has no denominator). */
export const compFeatureValues = (p: Player): number[] => STYLE_FEATURES[p.position].map((f) => f.get(p));

export type SimilarityMode = 'level' | 'style';

/** Shared labels for the two similarity scores (Player comps, Head-to-Head, player card, Build-a-Legend). */
export const SIMILARITY_LABELS: Record<SimilarityMode, string> = {
  style: 'Plays like (style)',
  level: 'Closest overall (level + style)',
};
export const SIMILARITY_DEFINITIONS: Record<SimilarityMode, string> = {
  level:
    '0–100 closeness of per-game and efficiency rates (no games, totals or True Talent), z-scored within the position: 100·exp(−D/2W) over the weighted squared gaps. ~60 = about one standard deviation apart on average; 100 = identical rates.',
  style:
    '0–100 match of statistical shape regardless of level: the correlation between two players\' z-scored rates (oriented so higher = better, at least 4 shared features), max(0, r)·100. A lesser player with the same strengths and weaknesses scores high.',
};

export interface Comp {
  player: Player;
  /** 0–100 score for the requested mode (`level` by default). */
  similarity: number;
  /** Level + style: 100·exp(−D / 2W), D = weighted squared z-distance over the usable features, W = their total weight. */
  level: number;
  /** Plays like: max(0, weighted cosine of league-centred oriented percentiles)·100; NaN with fewer than SIM_MIN_STYLE_FEATURES shared features. */
  style: number;
  /** Fewer than SIM_MIN_GAMES games: rates are noisy. */
  smallSample: boolean;
}

/** The players that set the z-score baselines at a position (league, ≥ SIM_MIN_GAMES games, enough usable features). */
export const similarityBaseline = (players: Player[], position: Position) =>
  players.filter((p) => p.position === position && !p.isRealLegend && p.games >= SIM_MIN_GAMES && hasSimilarityData(p));

/** False when a player has fewer than SIM_MIN_FEATURES usable style features ("insufficient data"). */
export const hasSimilarityData = (p: Player) =>
  STYLE_FEATURES[p.position].filter((f) => Number.isFinite(f.get(p))).length >= minFeatures(p.position);
/** OL has a single style feature (blocks/G), so its minimum is that one feature. */
const minFeatures = (pos: Position) => Math.min(SIM_MIN_FEATURES, STYLE_FEATURES[pos].length);

/** Scorer for one position: z-scores each style feature over the baseline, returns 0–100 level and style scores. */
const similarityScorer = (players: Player[], position: Position) => {
  const pool = players.filter((p) => p.position === position && !p.isRealLegend && p.games > 0 && hasSimilarityData(p));
  const baseline = similarityBaseline(players, position);
  const features = STYLE_FEATURES[position];
  const stats = features.map((f) => {
    const vals = baseline.map(f.get).filter(Number.isFinite);
    const mean = vals.reduce((s, x) => s + x, 0) / (vals.length || 1);
    const sd = Math.sqrt(vals.reduce((s, x) => s + (x - mean) ** 2, 0) / (vals.length || 1));
    return { mean, sd, weight: f.weight, sign: f.lowerIsBetter ? -1 : 1, sorted: [...vals].sort((x, y) => x - y) };
  });
  // Oriented percentile (higher = better) minus 50: how far above or below the position's middle a player sits
  const centred = (i: number, zi: number) => {
    const st = stats[i];
    const v = st.mean + zi * st.sd;
    const n = st.sorted.length;
    let below = 0;
    let ties = 0;
    st.sorted.forEach((x) => {
      if (x < v) below += 1;
      else if (x === v) ties += 1;
    });
    const raw = n <= 1 ? 50 : ties > 0 ? (100 * (below + (ties - 1) / 2)) / (n - 1) : (100 * below) / n;
    return (st.sign < 0 ? 100 - raw : raw) - 50;
  };
  const zv = (vals: number[]) => stats.map((s, i) => (s.sd > 0 && Number.isFinite(vals[i]) ? (vals[i] - s.mean) / s.sd : NaN));
  const z = (p: Player) => zv(features.map((f) => f.get(p)));
  const shared = (za: number[], zb: number[]) => za.map((x, i) => i).filter((i) => Number.isFinite(za[i]) && Number.isFinite(zb[i]));
  const level = (za: number[], zb: number[]) => {
    const idx = shared(za, zb);
    if (idx.length < minFeatures(position)) return NaN;
    let d2 = 0;
    let w = 0;
    idx.forEach((i) => {
      d2 += stats[i].weight * (za[i] - zb[i]) ** 2;
      w += stats[i].weight;
    });
    return 100 * Math.exp(-d2 / (2 * w));
  };
  const style = (za: number[], zb: number[]) => {
    const idx = shared(za, zb);
    if (idx.length < SIM_MIN_STYLE_FEATURES) return NaN;
    // Weighted cosine of league-centred percentiles: each axis counts as above or below the position's middle,
    // so an above-average runner never matches a below-average one (a per-player Pearson r centred on each
    // player's own mean let elite passers look like poor runners). Matches what the radar draws.
    const a = idx.map((i) => centred(i, za[i]));
    const b = idx.map((i) => centred(i, zb[i]));
    let dot = 0;
    let na = 0;
    let nb = 0;
    idx.forEach((i, k) => {
      const w = stats[i].weight;
      dot += w * a[k] * b[k];
      na += w * a[k] ** 2;
      nb += w * b[k] ** 2;
    });
    if (na <= 1e-12 || nb <= 1e-12) return NaN;
    return 100 * Math.max(0, dot / Math.sqrt(na * nb));
  };
  return { pool, z, zv, level, style };
};

type Scorer = ReturnType<typeof similarityScorer>;

const compsAgainst = (sc: Scorer, zt: number[], candidates: Player[], mode: SimilarityMode): Comp[] =>
  candidates
    .map((player) => {
      const zp = sc.z(player);
      const level = sc.level(zt, zp);
      const style = sc.style(zt, zp);
      return { player, level, style, similarity: mode === 'style' ? style : level, smallSample: player.games < SIM_MIN_GAMES };
    })
    .filter((c) => Number.isFinite(c.similarity))
    .sort((a, b) => b.similarity - a.similarity || (mode === 'style' ? b.level - a.level : 0) || a.player.name.localeCompare(b.player.name));

/**
 * Players at the same position compared on play style: per-game and efficiency rates only (no games, True Talent
 * or totals), so career length doesn't matter. `level` (default) = closest overall; `style` = same statistical
 * shape at any level. Returns [] when the target has insufficient data.
 */
export const similarPlayers = (players: Player[], target: Player, count = 3, mode: SimilarityMode = 'level'): Comp[] => {
  if (!hasSimilarityData(target) || target.games <= 0) return [];
  const sc = similarityScorer(players, target.position);
  return compsAgainst(
    sc,
    sc.z(target),
    sc.pool.filter((p) => p !== target && p.name !== target.name),
    mode,
  ).slice(0, count);
};

/**
 * Comps for a league player among an outside group (e.g. real NFL legends), scored on the league's own
 * baseline so the numbers mean the same as league comps. Candidates need the same position and enough data.
 */
export const similarAmong = (players: Player[], target: Player, candidates: Player[], count = 3, mode: SimilarityMode = 'level'): Comp[] => {
  if (!hasSimilarityData(target) || target.games <= 0) return [];
  const sc = similarityScorer(players, target.position);
  const pool = candidates.filter((c) => c.position === target.position && c.games > 0 && c.name !== target.name && hasSimilarityData(c));
  return compsAgainst(sc, sc.z(target), pool, mode).slice(0, count);
};

/** Similarity (0–100) between two players; null across positions or with insufficient data. */
export const pairSimilarity = (players: Player[], a: Player, b: Player, mode: SimilarityMode = 'level'): number | null => {
  if (a.position !== b.position || a.games <= 0 || b.games <= 0 || !hasSimilarityData(a) || !hasSimilarityData(b)) return null;
  const sc = similarityScorer(players, a.position);
  const za = sc.z(a);
  const zb = sc.z(b);
  const s = mode === 'style' ? sc.style(za, zb) : sc.level(za, zb);
  return Number.isFinite(s) ? s : null;
};

/**
 * Similarity of a hypothetical player (raw feature values in `compFeatures(position)` order; NaN = unknown) to every
 * league player at the position, best first. Same normalization and scales as similarPlayers.
 */
export const similarityToVector = (players: Player[], position: Position, vector: number[], count = Infinity, mode: SimilarityMode = 'level'): Comp[] => {
  const sc = similarityScorer(players, position);
  return compsAgainst(sc, sc.zv(vector), sc.pool, mode).slice(0, count);
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
