// Dynamic color coding for metrics based on value ranges
// Returns tailwind class for the metric tier
// 6-tier system: below average, average, very good, elite, goat, legendary

export type MetricTier = 'belowAvg' | 'average' | 'veryGood' | 'elite' | 'goat' | 'legendary';

export interface MetricThresholds {
  legendary: number;
  goat: number;
  elite: number;
  veryGood: number;
  average: number;
  // anything below average threshold is belowAvg
}

// Thresholds based on user specification
const metricThresholds: Record<string, MetricThresholds> = {
  trueTalent: { legendary: 1000, goat: 900, elite: 750, veryGood: 650, average: 500 },
  dominance: { legendary: 1200, goat: 1000, elite: 850, veryGood: 750, average: 600 },
  careerLegacy: { legendary: 10000, goat: 8500, elite: 8000, veryGood: 6250, average: 5000 },
  tpg: { legendary: 5, goat: 4.5, elite: 4, veryGood: 3, average: 2 },
};

export const getMetricTier = (value: number, metric: string): MetricTier => {
  const thresholds = metricThresholds[metric] || metricThresholds.trueTalent;
  
  if (value >= thresholds.legendary) return 'legendary';
  if (value >= thresholds.goat) return 'goat';
  if (value >= thresholds.elite) return 'elite';
  if (value >= thresholds.veryGood) return 'veryGood';
  if (value >= thresholds.average) return 'average';
  return 'belowAvg';
};

export const getMetricClass = (value: number, metric: string): string => {
  const tier = getMetricTier(value, metric);
  return `metric-${tier}`;
};

// Background color classes for metric boxes
export const getMetricBgClass = (value: number, metric: string): string => {
  const tier = getMetricTier(value, metric);
  return `metric-bg-${tier}`;
};

// For inline styles when needed
export const getMetricColor = (value: number, metric: string): string => {
  const tier = getMetricTier(value, metric);
  const colors: Record<MetricTier, string> = {
    legendary: 'hsl(280, 100%, 65%)',  // Purple/violet for legendary
    goat: 'hsl(45, 100%, 50%)',        // Gold for GOAT
    elite: 'hsl(150, 80%, 45%)',       // Green for elite
    veryGood: 'hsl(190, 100%, 50%)',   // Cyan for very good
    average: 'hsl(45, 70%, 55%)',      // Yellow for average
    belowAvg: 'hsl(0, 60%, 55%)',      // Red for below average
  };
  return colors[tier];
};

export const getMetricBgColor = (value: number, metric: string): string => {
  const tier = getMetricTier(value, metric);
  const colors: Record<MetricTier, string> = {
    legendary: 'hsl(280, 100%, 65%, 0.2)',
    goat: 'hsl(45, 100%, 50%, 0.2)',
    elite: 'hsl(150, 80%, 45%, 0.2)',
    veryGood: 'hsl(190, 100%, 50%, 0.2)',
    average: 'hsl(45, 70%, 55%, 0.2)',
    belowAvg: 'hsl(0, 60%, 55%, 0.2)',
  };
  return colors[tier];
};

export const getTierLabel = (tier: MetricTier): string => {
  const labels: Record<MetricTier, string> = {
    legendary: 'Legendary',
    goat: 'GOAT',
    elite: 'Elite',
    veryGood: 'Very Good',
    average: 'Average',
    belowAvg: 'Below Avg',
  };
  return labels[tier];
};

// Format large numbers with commas
export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Format decimal to fixed places
export const formatDecimal = (num: number, places: number = 2): string => {
  return num.toFixed(places);
};

// Calculate percentile within a group
export const calculatePercentile = (value: number, allValues: number[]): number => {
  const sorted = [...allValues].sort((a, b) => a - b);
  const index = sorted.indexOf(value);
  return Math.round((index / (sorted.length - 1)) * 100);
};
