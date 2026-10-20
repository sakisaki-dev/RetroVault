import { useEffect, useState } from 'react';

/**
 * Chart palette for the Analytics Lab (dark site, surface ≈ #111627). Validated with the dataviz
 * validator (`--mode dark --surface #111627 --pairs all`): slots 1–3 pass every check all-pairs,
 * so any chart here uses at most three categorical hues; past that it highlights instead of coloring.
 */
export const VIZ = {
  surface: '#111627',
  series: ['#3987e5', '#d95926', '#199e70'] as const,
  /** Single-series fill (percentile bars) and its track: a lighter step of the same hue. */
  bar: '#3987e5',
  track: 'rgba(57, 135, 229, 0.16)',
  /** Diverging poles for the + index heat map; the midpoint is the neutral panel surface. */
  above: '57, 135, 229',
  below: '230, 103, 103',
  grid: 'hsl(226 38% 22%)',
  axis: 'hsl(226 38% 32%)',
  muted: 'hsl(225 30% 70%)',
  ink: 'hsl(228 100% 97%)',
} as const;

/** Diverging cell fill for a + index (100 = neutral). Saturates at ±50. */
export const plusFill = (plus: number | null) => {
  if (plus == null) return 'transparent';
  const t = Math.max(-1, Math.min(1, (plus - 100) / 50));
  const alpha = Math.abs(t) * 0.62;
  return `rgba(${t >= 0 ? VIZ.above : VIZ.below}, ${alpha.toFixed(3)})`;
};

export const usePrefersReducedMotion = () => {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
};

export const fmtNum = (v: number, decimals: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const fmtPlus = (v: number | null) => (v == null ? '—' : String(Math.round(v)));

/** Ordinal suffix for percentiles: 1st, 2nd, 93rd. */
export const ordinal = (x: number) => {
  const r = Math.round(x);
  const s = r % 100 >= 11 && r % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][r % 10] ?? 'th';
  return `${r}${s}`;
};
