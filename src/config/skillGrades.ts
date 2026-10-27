import type { Player, Position } from '@/types/player';
import { METRIC_BY_ID, SIM_MIN_GAMES, compFeatures, similarityBaseline, type CompFeature } from './advanced';

/**
 * Skill grades: the play-style traits (config/advanced.ts compFeatures, the similarity features) with football
 * names, graded by per-position percentile → S / A+ … D− / F, and the overall mapping onto the official OVR curve.
 * Pure and React-free; shared by Build-a-Legend and the Player Deep Dive so both always show the same grades.
 * Percentiles are against league players at the position with ≥ 8 games (similarityBaseline).
 */

/** Football names for the play-style features (config/advanced.ts compFeatures ids). */
const TRAIT_NAMES: Record<string, Record<string, string>> = {
  QB: { ya: 'Arm', cmp: 'Accuracy', tdPct: 'Gunslinger', intPct: 'Decision making', rating: 'Clutch rating', passYdsG: 'Volume', rushYdsG: 'Legs', rushShare: 'Scrambler' },
  RB: { ypc: 'Vision', rushYdsG: 'Workhorse', recYdsG: 'Pass catching', recShare: 'Dual threat', td16: 'Nose for the end zone', fumRate: 'Ball security', ypt: 'Explosiveness' },
  REC: { recG: 'Hands', recYdsG: 'Production', ypr: 'Big play', tdPerRec: 'Red zone', fumRate: 'Ball security' },
  DEF: { tklG: 'Tackling', sackG: 'Pass rush', intG: 'Ball hawk', ffG: 'Strip', impactG: 'Playmaker' },
};
const traitGroup = (pos: Position) => (pos === 'WR' || pos === 'TE' ? 'REC' : pos === 'LB' || pos === 'DB' || pos === 'DL' ? 'DEF' : pos);
export const traitName = (pos: Position, f: CompFeature) => TRAIT_NAMES[traitGroup(pos)]?.[f.id] ?? f.label;

export interface SkillTrait extends CompFeature {
  /** Football name, e.g. "Accuracy" for Cmp% */
  name: string;
}

/** The graded traits for a position, in similarity-feature order. */
export const skillTraits = (pos: Position): SkillTrait[] => compFeatures(pos).map((f) => ({ ...f, name: traitName(pos, f) }));

/** Display string for a raw feature value. */
export const fmtFeature = (f: CompFeature, v: number) =>
  Number.isFinite(v)
    ? `${((f.scale ?? 1) * v).toLocaleString('en-US', { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals })}${f.suffix ?? ''}`
    : '—';

/** Percentile (0–100, share of qualified players at or below) of a raw value among the position baseline. */
export const percentileOf = (sortedVals: number[], v: number) => {
  if (!sortedVals.length || !Number.isFinite(v)) return NaN;
  // Mid-rank: share strictly below plus half the ties, so flipping a lower-is-better stat (100 − pct) stays symmetric
  const bound = (strict: boolean) => {
    let lo = 0;
    let hi = sortedVals.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? sortedVals[mid] < v : sortedVals[mid] <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const n = sortedVals.length;
  const below = bound(true);
  const ties = bound(false) - below;
  if (n <= 1) return 100;
  // Same mid-rank formula as the Advanced boards (config/advanced.ts): a player in the pool is ranked against the
  // others, so the best is exactly 100 and the worst 0. A value outside the pool (a build) slots in between.
  return ties > 0 ? (100 * (below + (ties - 1) / 2)) / (n - 1) : (100 * below) / n;
};

/** Percentile where higher is always better: lower-is-better features (INT%, fumble rates) are flipped. */
export const skillPct = (f: CompFeature, sortedVals: number[], v: number) => {
  const pct = percentileOf(sortedVals, v);
  return f.lowerIsBetter && Number.isFinite(pct) ? 100 - pct : pct;
};

/**
 * Traits that are the same stat as an Advanced board: they use that board's qualifier pool, so the trait's
 * percentile equals the board's (Deep Dive shows both side by side).
 */
const SAME_AS_METRIC: Partial<Record<Position, Record<string, string>>> = {
  QB: { tdPct: 'tdPct', intPct: 'intPct', rating: 'passerRating' },
  RB: { td16: 'tdPer16', fumRate: 'fumbleRate', ypt: 'ydsPerTouch' },
  LB: { tklG: 'tacklesPerGame', impactG: 'impactPerGame' },
  DB: { tklG: 'tacklesPerGame', impactG: 'impactPerGame' },
  DL: { tklG: 'tacklesPerGame', impactG: 'impactPerGame' },
};

/**
 * The qualifier pool per feature id, with its label. Traits that match an Advanced board use that board's
 * qualifiers; the rest use league players at the position with ≥ SIM_MIN_GAMES games (similarityBaseline).
 */
export const traitPools = (players: Player[], position: Position): Map<string, { pool: Player[]; label: string }> => {
  const base = similarityBaseline(players, position);
  const atPos = players.filter((p) => p.position === position && !p.isRealLegend);
  return new Map(
    compFeatures(position).map((f) => {
      const metric = METRIC_BY_ID.get(SAME_AS_METRIC[position]?.[f.id] ?? '');
      return [f.id, metric ? { pool: atPos.filter(metric.qualifies), label: metric.minLabel } : { pool: base, label: `${SIM_MIN_GAMES}+ games` }];
    }),
  );
};

/** Sorted baseline values per feature id, over each trait's qualifier pool (traitPools). */
export const positionBaseline = (players: Player[], position: Position): Map<string, number[]> => {
  const pools = traitPools(players, position);
  return new Map(compFeatures(position).map((f) => [f.id, (pools.get(f.id)?.pool ?? []).map(f.get).filter(Number.isFinite).sort((a, b) => a - b)]));
};

// ---------- Letter grades ----------

export interface GradeStep {
  /** Inclusive minimum direction-aware percentile (0–100) */
  min: number;
  grade: string;
  /** Chip background; text is always dark (#0b1020) for contrast */
  color: string;
}

/**
 * Percentile → letter grade, best first, on a generous curve: S top 10%, A next 15%, B next 25%, C next 25%,
 * D next 15%, F bottom 10%; each of A–D is split into +/plain/− thirds by percentile (S and F have no modifier).
 * Percentiles are per-position rate percentiles (no career volume) and direction-aware (skillPct): INT% and fumble
 * rates are inverted. The overall blends trait percentiles (overallFor), which compresses the top, so S at 90 lands
 * on about the top 5% of the league overall (owner: "the S grade bar should come down").
 */
export const GRADE_SCALE: GradeStep[] = [
  { min: 90, grade: 'S', color: '#ffd84a' },
  { min: 85, grade: 'A+', color: '#3ddc84' },
  { min: 80, grade: 'A', color: '#5fdc78' },
  { min: 75, grade: 'A−', color: '#7fd86c' },
  { min: 66.67, grade: 'B+', color: '#a3d85e' },
  { min: 58.33, grade: 'B', color: '#c2d652' },
  { min: 50, grade: 'B−', color: '#dcd04a' },
  { min: 41.67, grade: 'C+', color: '#ffc83d' },
  { min: 33.33, grade: 'C', color: '#ffb43d' },
  { min: 25, grade: 'C−', color: '#ffa03d' },
  { min: 20.0, grade: 'D+', color: '#ff8a45' },
  { min: 15.0, grade: 'D', color: '#ff7a4a' },
  { min: 10, grade: 'D−', color: '#ff6c50' },
  { min: 0, grade: 'F', color: '#ff5a61' },
];

export const gradeFor = (pct: number): GradeStep | null =>
  Number.isFinite(pct) ? (GRADE_SCALE.find((g) => pct >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1]) : null;

export interface Overall {
  /** Weighted mean of the filled traits' direction-aware percentiles: the single source for the rating and letter */
  pct: number;
  /** Official OVR curve (config/ovr.ts): round(62 + 37·(pct/100)^0.85), 62–99 */
  rating: number;
  grade: GradeStep;
  tier: string;
}

/** Official OVR curve (config/ovr.ts): round(62 + 37·(pct/100)^0.85). */
export const ovrFromPercentile = (pct: number) => Math.round(62 + 37 * (Math.min(100, Math.max(0, pct)) / 100) ** 0.85);

/** Tier label from the grade family, so the letter and the label never disagree. */
const TIERS: Record<string, string> = { S: 'Generational', A: 'All-Pro', B: 'Pro Bowl', C: 'Starter', D: 'Backup', F: 'Depth chart' };
export const tierFor = (grade: GradeStep) => TIERS[grade.grade[0]] ?? 'Depth chart';

/**
 * Value weights for the OVERALL only (independent of the similarity weights, which are style-matching weights).
 * Pure style descriptors (rush share, receiving share) weigh 0; a missing id weighs 0.
 */
export const VALUE_WEIGHTS: Record<string, Record<string, number>> = {
  QB: { ya: 0.2, tdPct: 0.2, intPct: 0.15, cmp: 0.15, rating: 0.1, passYdsG: 0.15, rushYdsG: 0.05, rushShare: 0 },
  RB: { ypc: 0.2, td16: 0.25, rushYdsG: 0.3, fumRate: 0.1, recYdsG: 0.1, ypt: 0.05, recShare: 0 },
  REC: { recYdsG: 0.35, ypr: 0.2, tdPerRec: 0.2, recG: 0.15, fumRate: 0.1 },
  DEF: { impactG: 0.35, tklG: 0.2, sackG: 0.15, intG: 0.15, ffG: 0.15 },
  OL: { blocksG: 1 },
};
const valueWeight = (pos: Position, id: string) => VALUE_WEIGHTS[traitGroup(pos)]?.[id] ?? VALUE_WEIGHTS[pos]?.[id] ?? 0;
/** Share of the overall that comes from the player's three best traits, so excellence isn't averaged away. */
export const OVERALL_TOP3_MIX = 0.4;


/**
 * THE overall (Build-a-Legend header, build panel, results; Player Deep Dive): value-weighted mean percentile
 * blended with the mean of the three best traits (OVERALL_TOP3_MIX) → OVR on the official 62–99 curve, letter
 * grade (same GRADE_SCALE) and tier from the grade. Null before any valued trait.
 */
export const overallFor = (features: CompFeature[], baseline: Map<string, number[]>, values: (number | null)[], position: Position): Overall | null => {
  const items: { w: number; pct: number }[] = [];
  features.forEach((f, i) => {
    const v = values[i];
    const w = valueWeight(position, f.id);
    if (v == null || w <= 0) return;
    const pct = skillPct(f, baseline.get(f.id) ?? [], v);
    if (Number.isFinite(pct)) items.push({ w, pct });
  });
  if (!items.length) return null;
  const W = items.reduce((a, x) => a + x.w, 0);
  const mean = items.reduce((a, x) => a + x.w * x.pct, 0) / W;
  const top = [...items].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const topMean = top.reduce((a, x) => a + x.pct, 0) / top.length;
  const pct = (1 - OVERALL_TOP3_MIX) * mean + OVERALL_TOP3_MIX * topMean;
  const grade = gradeFor(pct) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
  return { pct, rating: ovrFromPercentile(pct), grade, tier: tierFor(grade) };
};

export interface SkillGrade {
  trait: SkillTrait;
  /** Raw stat value (NaN when missing) and its display string */
  value: number;
  display: string;
  /** Direction-aware percentile within the position (higher = better), NaN when missing */
  percentile: number;
  grade: GradeStep | null;
}

/** Every trait of one player: value, percentile and letter grade, plus his overall on the same mapping. */
export const playerSkillGrades = (players: Player[], player: Player): { traits: SkillGrade[]; overall: Overall | null } => {
  const traits = skillTraits(player.position);
  const baseline = positionBaseline(players, player.position);
  const rows = traits.map((t) => {
    const value = t.get(player);
    const percentile = skillPct(t, baseline.get(t.id) ?? [], value);
    return { trait: t, value, display: fmtFeature(t, value), percentile, grade: gradeFor(percentile) };
  });
  const overall = overallFor(traits, baseline, rows.map((r) => (Number.isFinite(r.value) ? r.value : null)), player.position);
  return { traits: rows, overall };
};

// ---------- Leaderboards (Deep Dive skill tiles) ----------

export interface SkillLeader {
  player: Player;
  value: number;
  display: string;
  percentile: number;
  grade: GradeStep | null;
}

export interface SkillBoard {
  /** Qualifier pool label, e.g. "8+ games" or "min 50 touches" */
  poolLabel: string;
  lowerIsBetter: boolean;
  /** Every qualifier, best first (lower-is-better traits ascending; ties by name) */
  entries: SkillLeader[];
}

const byName = (a: SkillLeader, b: SkillLeader) => a.player.name.localeCompare(b.player.name);

/** One trait's leaderboard over the same pool and percentile as its grade, so place, value, pct and grade agree. */
export const skillBoard = (players: Player[], position: Position, traitId: string): SkillBoard | null => {
  const t = skillTraits(position).find((x) => x.id === traitId);
  const pool = traitPools(players, position).get(traitId);
  if (!t || !pool) return null;
  const sorted = positionBaseline(players, position).get(traitId) ?? [];
  const entries = pool.pool
    .map((p) => {
      const value = t.get(p);
      const percentile = skillPct(t, sorted, value);
      return { player: p, value, display: fmtFeature(t, value), percentile, grade: gradeFor(percentile) };
    })
    .filter((e) => Number.isFinite(e.value))
    .sort((a, b) => (t.lowerIsBetter ? a.value - b.value : b.value - a.value) || byName(a, b));
  return { poolLabel: pool.label, lowerIsBetter: !!t.lowerIsBetter, entries };
};

/** Overall skill rating leaderboard for a position: players with ≥ SIM_MIN_GAMES games (the grade baseline). */
export const overallBoard = (players: Player[], position: Position): SkillBoard => {
  const entries = similarityBaseline(players, position)
    .map((p) => ({ p, o: playerSkillGrades(players, p).overall }))
    .filter((x): x is { p: Player; o: Overall } => !!x.o)
    .map(({ p, o }) => ({ player: p, value: o.rating, display: String(o.rating), percentile: o.pct, grade: o.grade }))
    .sort((a, b) => b.value - a.value || b.percentile - a.percentile || byName(a, b));
  return { poolLabel: `${SIM_MIN_GAMES}+ games`, lowerIsBetter: false, entries };
};
