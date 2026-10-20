import type { Player } from '@/types/player';
import { quantile } from '@/config/advanced';

/** Pure model for the shared scatter engine (LandscapeScatter): points, spec, splits, scales and the trend fit. */

export interface LPoint {
  key: string;
  player: Player;
  x: number;
  y: number;
  xText: string;
  yText: string;
  /** Real NFL legend: drawn distinctly, never part of medians, quadrant lines or the trend. */
  nfl?: boolean;
  /** Optional third stat for bubble size (raw value; the engine scales it). */
  size?: number;
  sizeText?: string;
  /** Mark colour override (colour by position / tier); default is the team colour. */
  color?: string;
}

export interface Quadrants {
  tl: string;
  tr: string;
  bl: string;
  br: string;
}

export interface LandscapeSpec {
  xLabel: string;
  yLabel: string;
  quadrants: Quadrants;
  /** Vertical split; default = median x of league points. */
  xSplit?: { value: number; label: string };
  /** Horizontal split; default = median y of league points. */
  ySplit?: { value: number; label: string };
  /** Draw y = x (same units on both axes). */
  diagonal?: boolean;
  xZero?: boolean;
  yZero?: boolean;
  /** Integer axis (counts such as rings). */
  yInteger?: boolean;
  /** Lower y is better (INT%, fumble rate): the axis runs upside down so "up" is always better. */
  yInvert?: boolean;
  logX?: boolean;
  logY?: boolean;
  /** Least-squares line through the league points, with r. */
  trend?: boolean;
  /** Hide the median lines and quadrant names. */
  noSplits?: boolean;
}

const league = (points: LPoint[]) => points.filter((p) => !p.nfl);

export const splitOf = (points: LPoint[], spec: LandscapeSpec) => {
  const lg = league(points);
  const base = lg.length ? lg : points;
  return {
    sx: spec.xSplit?.value ?? quantile(base.map((p) => p.x), 50),
    sy: spec.ySplit?.value ?? quantile(base.map((p) => p.y), 50),
  };
};

/** Quadrant of a point ("up" = better, so an inverted y axis flips the test). */
export const quadrantName = (pt: LPoint, sx: number, sy: number, spec: LandscapeSpec) => {
  const q = spec.quadrants;
  const up = spec.yInvert ? pt.y <= sy : pt.y >= sy;
  return up ? (pt.x >= sx ? q.tr : q.tl) : pt.x >= sx ? q.br : q.bl;
};

/** League points per quadrant, in tr / tl / br / bl order, for text summaries. */
export const quadrantCounts = (points: LPoint[], spec: LandscapeSpec) => {
  const lg = league(points);
  const { sx, sy } = splitOf(points, spec);
  const q = spec.quadrants;
  return [q.tr, q.tl, q.br, q.bl].map((name) => ({ name, n: lg.filter((p) => quadrantName(p, sx, sy, spec) === name).length }));
};

/** Pearson r and the least-squares line of y on x (in plotted units: log10 on a log axis). League points only. */
export const trendFit = (points: LPoint[], spec: LandscapeSpec) => {
  const tx = (v: number) => (spec.logX ? Math.log10(v) : v);
  const ty = (v: number) => (spec.logY ? Math.log10(v) : v);
  const pts = league(points)
    .map((p) => [tx(p.x), ty(p.y)] as const)
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((s, [a]) => s + a, 0) / n;
  const my = pts.reduce((s, [, b]) => s + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  pts.forEach(([a, b]) => {
    sxy += (a - mx) * (b - my);
    sxx += (a - mx) ** 2;
    syy += (b - my) ** 2;
  });
  if (!(sxx > 0) || !(syy > 0)) return null;
  const slope = sxy / sxx;
  return { r: sxy / Math.sqrt(sxx * syy), slope, intercept: my - slope * mx, n };
};

/** Log-axis ticks: 1 / 2 / 5 × 10^k inside [lo, hi]. */
export const logTicks = (lo: number, hi: number) => {
  const out: number[] = [];
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k += 1) {
    [1, 2, 5].forEach((m) => {
      const v = m * 10 ** k;
      if (v >= lo && v <= hi) out.push(Number(v.toPrecision(6)));
    });
  }
  return out;
};

/** Plain-words strength of a correlation. */
export const describeR = (r: number) => {
  const a = Math.abs(r);
  const s = a >= 0.7 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : 'no clear';
  return a < 0.2 ? 'no clear relationship' : `${s} ${r > 0 ? 'positive' : 'negative'} relationship`;
};
