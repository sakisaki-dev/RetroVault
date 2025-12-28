// Dynamic color coding for metrics based on value ranges
// Returns tailwind class for the metric tier

export type MetricTier = 'elite' | 'good' | 'average' | 'below' | 'poor';

export interface MetricThresholds {
  elite: number;
  good: number;
  average: number;
  below: number;
}

// Default thresholds for custom metrics
const defaultThresholds: Record<string, MetricThresholds> = {
  trueTalent: { elite: 900, good: 700, average: 500, below: 300 },
  dominance: { elite: 900, good: 700, average: 500, below: 300 },
  careerLegacy: { elite: 7000, good: 5000, average: 3500, below: 2000 },
  tpg: { elite: 4, good: 3, average: 2, below: 1 },
};

export const getMetricTier = (value: number, metric: string): MetricTier => {
  const thresholds = defaultThresholds[metric] || defaultThresholds.trueTalent;
  
  if (value >= thresholds.elite) return 'elite';
  if (value >= thresholds.good) return 'good';
  if (value >= thresholds.average) return 'average';
  if (value >= thresholds.below) return 'below';
  return 'poor';
};

export const getMetricClass = (value: number, metric: string): string => {
  const tier = getMetricTier(value, metric);
  return `metric-${tier}`;
};

// For inline styles when needed
export const getMetricColor = (value: number, metric: string): string => {
  const tier = getMetricTier(value, metric);
  const colors: Record<MetricTier, string> = {
    elite: 'hsl(150, 80%, 45%)',
    good: 'hsl(190, 100%, 50%)',
    average: 'hsl(45, 100%, 55%)',
    below: 'hsl(25, 90%, 55%)',
    poor: 'hsl(0, 70%, 55%)',
  };
  return colors[tier];
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
