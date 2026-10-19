// Tiering + color coding for the four advanced metrics (True Talent, Dominance, Career Legacy, TPG).
// Six tiers, always shown with a text label so color is never the only signal.
//
// Thresholds were calibrated against raw sheet values. Position normalization (config/stats.ts)
// rescales each position so its elite tier lands on the league-wide average of position benchmarks,
// which roughly preserves the overall scale, so the raw thresholds still apply.
// Career Legacy boundaries come from the Hall of Fame tiers so both views agree.

import { HOF_THRESHOLD, LEGACY_TIERS, type LegacyTierKey } from '@/config/stats';

export type MetricTier = 'belowAvg' | 'average' | 'veryGood' | 'elite' | 'goat' | 'legendary';

export interface MetricThresholds {
  legendary: number;
  goat: number;
  elite: number;
  veryGood: number;
  average: number;
  // anything below `average` is belowAvg
}

const legacyMin = (key: LegacyTierKey) => LEGACY_TIERS.find((t) => t.key === key)!.min;

export const METRIC_THRESHOLDS: Record<string, MetricThresholds> = {
  trueTalent: { legendary: 1000, goat: 900, elite: 750, veryGood: 650, average: 500 },
  dominance: { legendary: 1200, goat: 1000, elite: 850, veryGood: 750, average: 600 },
  // Legendary / Elite / Great / Inductee (Hall of Fame) map onto Legendary / GOAT / Elite / Very Good.
  careerLegacy: {
    legendary: legacyMin('legendary'),
    goat: legacyMin('elite'),
    elite: legacyMin('great'),
    veryGood: HOF_THRESHOLD,
    average: 5000,
  },
  tpg: { legendary: 5, goat: 4.5, elite: 4, veryGood: 3, average: 2 },
};

export const getMetricTier = (value: number, metric: string): MetricTier => {
  const t = METRIC_THRESHOLDS[metric] || METRIC_THRESHOLDS.trueTalent;
  if (value >= t.legendary) return 'legendary';
  if (value >= t.goat) return 'goat';
  if (value >= t.elite) return 'elite';
  if (value >= t.veryGood) return 'veryGood';
  if (value >= t.average) return 'average';
  return 'belowAvg';
};

/** HSL triplets per tier; legendary/goat sit above the token scale, the rest reuse design tokens. */
const TIER_HSL: Record<MetricTier, string> = {
  legendary: '28 100% 60%',
  goat: 'var(--chart-2)',
  elite: 'var(--sky)',
  veryGood: 'var(--metric-elite)',
  average: 'var(--metric-average)',
  belowAvg: 'var(--metric-poor)',
};

export const getTierColor = (tier: MetricTier) => `hsl(${TIER_HSL[tier]})`;
export const getTierBgColor = (tier: MetricTier, alpha = 0.16) => `hsl(${TIER_HSL[tier]} / ${alpha})`;

export const getMetricColor = (value: number, metric: string): string => getTierColor(getMetricTier(value, metric));

export const getMetricBgColor = (value: number, metric: string): string => getTierBgColor(getMetricTier(value, metric));

const TIER_LABELS: Record<MetricTier, string> = {
  legendary: 'Legendary',
  goat: 'GOAT',
  elite: 'Elite',
  veryGood: 'Very Good',
  average: 'Average',
  belowAvg: 'Below Avg',
};

// Career Legacy uses the Hall of Fame names so the tables, player card and HOF page agree.
const LEGACY_LABELS: Record<MetricTier, string> = {
  legendary: 'Legendary',
  goat: 'Elite',
  elite: 'Great',
  veryGood: 'Hall of Fame',
  average: 'Average',
  belowAvg: 'Below Avg',
};

export const getTierLabel = (tier: MetricTier, metric?: string): string =>
  (metric === 'careerLegacy' ? LEGACY_LABELS : TIER_LABELS)[tier];

/** Integer with thousands separators. */
export const formatNumber = (num: number): string => (Number.isFinite(num) ? num : 0).toLocaleString('en-US');

/** Fixed decimals with thousands separators. */
export const formatDecimal = (num: number, places: number = 2): string =>
  (Number.isFinite(num) ? num : 0).toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
