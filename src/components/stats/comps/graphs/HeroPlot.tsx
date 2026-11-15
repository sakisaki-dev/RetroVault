import { memo, useId } from 'react';
import { GOLD, niceTicks } from '../../visual/chartKit';
import { VIZ } from '../../analytics/viz';
import type { Career, EventKind } from './careerStory';
import { Glyph, clubInk, shortNum, yLabel, type GraphMetric } from './graphKit';

export const HERO_M = { l: 38, r: 10, t: 26, b: 22 };

/** Glyph priority for a season's icon column (one shown on narrow columns) */
const ORDER: EventKind[] = ['hof', 'mvp', 'ring', 'poy', 'sbmvp', 'record', 'final', 'ceiling', 'club'];

export interface HeroGeom {
  x: (i: number) => number;
  y: (v: number) => number;
  colW: number;
  values: (number | null)[];
}

export const heroGeom = (career: Career, metric: GraphMetric, width: number, height: number): HeroGeom & { ticks: number[] } => {
  const n = career.points.length;
  const colW = (width - HERO_M.l - HERO_M.r) / Math.max(1, n);
  const values = career.points.map((p) => metric.get(p));
  const fin = values.filter((v): v is number => v != null && Number.isFinite(v));
  const lo = fin.length ? Math.min(...fin) : 0;
  const hi = fin.length ? Math.max(...fin) : 1;
  const base = metric.group === 'Card' && metric.id !== 'ovr' && metric.id !== 'skill' && !metric.invert ? 0 : lo;
  const { ticks, domain } = niceTicks(Math.min(base, lo), hi === lo ? hi + 1 : hi, 4);
  const [d0, d1] = metric.invert ? [Math.max(1, domain[0]), domain[1]] : domain;
  const top = HERO_M.t + 6;
  const bottom = height - HERO_M.b;
  const y = (v: number) => {
    const t = (v - d0) / (d1 - d0 || 1);
    return metric.invert ? top + t * (bottom - top) : bottom - t * (bottom - top);
  };
  return { x: (i) => HERO_M.l + (i + 0.5) * colW, y, colW, values, ticks: ticks.filter((t) => t >= d0 && t <= d1) };
};

/**
 * The hero chart's static layers: club bands, grid, the metric's line and area, season labels, and the event glyphs.
 * Memoised on its inputs, so moving the season cursor never redraws it.
 */
const HeroPlot = memo(({ career, metric, width, height, reduced }: { career: Career; metric: GraphMetric; width: number; height: number; reduced: boolean }) => {
  const gid = useId().replace(/:/g, '');
  const { x, y, colW, values, ticks } = heroGeom(career, metric, width, height);
  const pts = career.points;
  const bottom = height - HERO_M.b;
  // line segments: consecutive non-null values; the live season dashed
  const segs: { d: string; live: boolean }[] = [];
  let cur: string[] = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (cur.length) segs.push({ d: cur.join(' '), live: false });
      cur = [];
      return;
    }
    const cmd = `${cur.length ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    if (pts[i].status === 'live' && cur.length) {
      segs.push({ d: cur.join(' '), live: false });
      const prev = cur[cur.length - 1].slice(1);
      segs.push({ d: `M${prev} L${x(i).toFixed(1)},${y(v).toFixed(1)}`, live: true });
      cur = [];
      return;
    }
    cur.push(cmd);
  });
  if (cur.length) segs.push({ d: cur.join(' '), live: false });
  const areas = segs.filter((s) => !s.live && s.d.includes('L'));
  const byYear = new Map<number, Map<EventKind, number>>();
  career.events.forEach((e) => {
    const m = byYear.get(e.year) ?? new Map<EventKind, number>();
    m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
    byYear.set(e.year, m);
  });
  const px = colW >= 30 ? 2 : colW >= 16 ? 2 : 1.5;
  const perCol = Math.max(1, Math.floor(colW / (5 * px + 3)));
  const labelEvery = colW >= 34 ? 1 : colW >= 18 ? 2 : 3;
  return (
    <svg width={width} height={height} className="block" aria-hidden="true">
      <defs>
        <linearGradient id={`a${gid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={GOLD} stopOpacity={0.32} />
          <stop offset="1" stopColor={GOLD} stopOpacity={0} />
        </linearGradient>
        <pattern id={`h${gid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={VIZ.grid} strokeWidth="2" />
        </pattern>
      </defs>
      {pts.map((p, i) => {
        const ink = clubInk(career.clubs[i]);
        const x0 = HERO_M.l + i * colW;
        return (
          <g key={p.year}>
            <rect x={x0} y={HERO_M.t} width={colW + 0.5} height={bottom - HERO_M.t} fill={ink.band} />
            {(p.status === 'idle' || p.status === 'first' || p.status === 'multi') && <rect x={x0} y={HERO_M.t} width={colW} height={bottom - HERO_M.t} fill={`url(#h${gid})`} opacity={0.5} />}
          </g>
        );
      })}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={HERO_M.l} x2={width - HERO_M.r} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeDasharray="2 3" />
          <text x={HERO_M.l - 5} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={VIZ.muted} className="tabular-nums">
            {metric.invert ? `#${shortNum(t)}` : shortNum(t)}
          </text>
        </g>
      ))}
      {areas.map((s, k) => {
        const m = s.d.match(/[ML]([\d.]+),/g) ?? [];
        const xs = m.map((t) => Number(t.slice(1, -1)));
        const yb = metric.invert ? HERO_M.t : bottom;
        return <path key={k} d={`${s.d} L${xs[xs.length - 1]},${yb} L${xs[0]},${yb} Z`} fill={`url(#a${gid})`} />;
      })}
      {segs.map((s, k) => (
        <path
          key={k}
          d={s.d}
          fill="none"
          stroke={GOLD}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeDasharray={s.live ? '4 4' : undefined}
          className={reduced ? undefined : 'cg-draw'}
          pathLength={reduced ? undefined : 1}
        />
      ))}
      {values.map((v, i) =>
        v == null || !Number.isFinite(v) ? null : (
          <circle key={i} cx={x(i)} cy={y(v)} r={colW >= 20 ? 3.2 : 2.4} fill={pts[i].status === 'short' || pts[i].status === 'live' ? VIZ.surface : GOLD} stroke={GOLD} strokeWidth={1.5} />
        ),
      )}
      {pts.map((p, i) => {
        const m = byYear.get(p.year);
        if (!m) return null;
        const kinds = ORDER.filter((k) => m.has(k)).slice(0, perCol);
        const w = kinds.length * (5 * px + 3) - 3;
        return (
          <g key={`e${p.year}`}>
            {kinds.map((k, j) => (
              <Glyph key={k} kind={k} px={px} x={x(i) - w / 2 + j * (5 * px + 3)} y={4} />
            ))}
          </g>
        );
      })}
      {pts.map((p, i) =>
        i % labelEvery === 0 || (i === pts.length - 1 && i % labelEvery >= labelEvery / 2) ? (
          <text key={`y${p.year}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill={p.status === 'live' ? GOLD : VIZ.muted} className="tabular-nums">
            {colW >= 26 ? yLabel(p.year) : `'${p.year % 100}`}
          </text>
        ) : null,
      )}
      <line x1={HERO_M.l} x2={width - HERO_M.r} y1={bottom} y2={bottom} stroke={VIZ.axis} />
    </svg>
  );
});
HeroPlot.displayName = 'HeroPlot';

export default HeroPlot;
