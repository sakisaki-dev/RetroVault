// Single source of truth for league stat formulas and thresholds.
// See docs/STATS_REFERENCE.md for where each value is used.

interface MetricInputs {
  games: number;
  rings: number;
  mvp: number;
  opoy: number;
  sbmvp: number;
  trueTalent: number;
  dominance: number;
  careerLegacy: number;
  tpg: number;
}

// Award points in Dominance. Defenders store DPOY in `opoy`; the current league sheet
// weights it at 120 (exact on 99/102 rows of the Y80 sheet; the older seed sheet used 30).
export const AWARD_POINTS = { ring: 60, mvp: 50, opoy: 30, dpoy: 120, sbmvp: 40, roty: 0 } as const;

// Formulas reverse-engineered from the league sheet.
export const calcDominance = (p: MetricInputs, isDefense = false) =>
  0.7 * p.trueTalent +
  AWARD_POINTS.ring * p.rings +
  AWARD_POINTS.mvp * p.mvp +
  (isDefense ? AWARD_POINTS.dpoy : AWARD_POINTS.opoy) * p.opoy +
  AWARD_POINTS.sbmvp * p.sbmvp;

export const calcCareerLegacy = (p: MetricInputs, dominance: number) =>
  4 * p.trueTalent + 4 * dominance + 2 * p.games;

export const calcTPG = (p: MetricInputs) => p.trueTalent / (p.games + 50);

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Fills in Dominance / Career Legacy / TPG from True Talent when the sheet leaves them blank. */
export const withDerivedMetrics = <T extends MetricInputs>(p: T, isDefense = false): T => {
  if (!p.trueTalent) return p;
  const dominance = p.dominance || round(calcDominance(p, isDefense), 3);
  return {
    ...p,
    dominance,
    careerLegacy: p.careerLegacy || round(calcCareerLegacy(p, dominance), 3),
    tpg: p.tpg || round(calcTPG(p), 2),
  };
};

// ---------- Position normalization ----------
// The sheet's per-position True Talent formulas are not on a common scale (defenders,
// especially LB/DL, rate far lower than offense). On every load we refit a per-position
// multiplier so each position's elite tier lands on the same league-wide reference.

/** Master switch. When false, `normalizeLeague` leaves sheet values untouched (factor 1). */
export const POSITION_NORMALIZATION_ENABLED = true;
/** Position benchmark = mean raw TT of the top N players at that position (fewer if the position is smaller). */
export const NORMALIZATION_BENCHMARK_TOP_N = 3;

export const DEFENSIVE_POSITIONS = ['LB', 'DB', 'DL'] as const;
export const isDefensivePosition = (pos: string) => (DEFENSIVE_POSITIONS as readonly string[]).includes(pos);

interface NormalizablePlayer extends MetricInputs {
  position: string;
  isRealLegend?: boolean;
  rawTrueTalent?: number;
  positionFactor?: number;
}

/** Raw (pre-normalization) True Talent, safe to call on already-normalized players. */
export const getRawTrueTalent = (p: { trueTalent: number; rawTrueTalent?: number }) =>
  p.rawTrueTalent ?? p.trueTalent;

/**
 * Per-position multipliers: factor = league reference / position benchmark, where the
 * benchmark is the mean of the top-N raw TT at the position and the reference is the mean of
 * all position benchmarks. Real-life legends and players with no TT are ignored.
 */
export const computePositionFactors = (players: NormalizablePlayer[]): Record<string, number> => {
  const byPos = new Map<string, number[]>();
  players.forEach((p) => {
    const tt = getRawTrueTalent(p);
    if (p.isRealLegend || !(tt > 0)) return;
    byPos.set(p.position, [...(byPos.get(p.position) ?? []), tt]);
  });

  const benchmarks = new Map<string, number>();
  byPos.forEach((tts, pos) => {
    const top = [...tts].sort((a, b) => b - a).slice(0, NORMALIZATION_BENCHMARK_TOP_N);
    benchmarks.set(pos, top.reduce((a, b) => a + b, 0) / top.length);
  });
  if (benchmarks.size === 0) return {};

  const reference = [...benchmarks.values()].reduce((a, b) => a + b, 0) / benchmarks.size;
  const factors: Record<string, number> = {};
  benchmarks.forEach((b, pos) => {
    factors[pos] = reference / b;
  });
  return factors;
};

/**
 * Pure. Rescales every player's True Talent by its position factor (keeping the original in
 * `rawTrueTalent`) and recomputes Dominance / Career Legacy / TPG from the adjusted value so all
 * derived metrics are consistent. Legends get the same factors but do not influence them.
 * Idempotent: re-running uses `rawTrueTalent` as the input.
 */
export const normalizeLeague = <T extends NormalizablePlayer>(players: T[]): T[] => {
  if (!POSITION_NORMALIZATION_ENABLED) return players;
  const factors = computePositionFactors(players);

  return players.map((p) => {
    const raw = getRawTrueTalent(p);
    const positionFactor = factors[p.position] ?? 1;
    const trueTalent = round(raw * positionFactor, 1);
    const adjusted = { ...p, trueTalent };
    const dominance = round(calcDominance(adjusted, isDefensivePosition(p.position)), 3);
    return {
      ...adjusted,
      rawTrueTalent: raw,
      positionFactor,
      dominance,
      careerLegacy: round(calcCareerLegacy(adjusted, dominance), 3),
      tpg: round(calcTPG(adjusted), 2),
    };
  });
};

// ---------- Hall of Fame / legacy tiers ----------

export const HOF_THRESHOLD = 7000;

export const LEGACY_TIERS = [
  { key: 'legendary', label: 'LEGENDARY', min: 10000 },
  { key: 'elite', label: 'ELITE', min: 8500 },
  { key: 'great', label: 'GREAT', min: 7500 },
  { key: 'inductee', label: 'INDUCTEE', min: HOF_THRESHOLD },
] as const;

export type LegacyTierKey = (typeof LEGACY_TIERS)[number]['key'];

export const isHallOfFamer = (p: { careerLegacy: number }) => p.careerLegacy >= HOF_THRESHOLD;

export const getLegacyTier = (careerLegacy: number) =>
  LEGACY_TIERS.find((t) => careerLegacy >= t.min) ?? null;

export const formatThreshold = (n: number) => `≥${n >= 1000 ? `${n / 1000}k` : n}`;
