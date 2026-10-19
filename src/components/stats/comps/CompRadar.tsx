import type { KeyboardEvent } from 'react';
import { VIZ } from '../analytics/viz';

export interface RadarSeries {
  label: string;
  /** 0–100 per axis; null = missing for this player (no vertex on that axis). */
  values: (number | null)[];
  color: string;
}

interface Props {
  labels: string[];
  /** False = the axis has too few league values; drawn greyed with "n/a". */
  axisOk: boolean[];
  series: RadarSeries[];
  /** Mini radars drop labels and rings (comp list rows). */
  mini?: boolean;
  className?: string;
  /** Omit for a decorative radar (hidden from assistive tech). */
  ariaLabel?: string;
  /** Interactive axes: the highlighted axis and a callback for hover / focus / tap. */
  activeAxis?: number | null;
  onAxis?: (i: number | null) => void;
  /** Accessible name for each axis button (full radar only). */
  axisDescription?: (i: number) => string;
}

const RINGS = [25, 50, 75, 100];
const GOLD = 'hsl(43 100% 62%)';
const MUTED_AXIS = 'hsl(226 15% 45%)';

/** NBA-style hexagon: one axis per style feature, 0–100 percentile, outward = better. */
const CompRadar = ({ labels, axisOk, series, mini = false, className, ariaLabel, activeAxis = null, onAxis, axisDescription }: Props) => {
  const n = labels.length;
  const W = mini ? 48 : 460;
  const H = mini ? 48 : 390;
  const cx = W / 2;
  const cy = H / 2;
  const R = mini ? 21 : 132;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i: number, pct: number) => [cx + (Math.cos(angle(i)) * (R * pct)) / 100, cy + (Math.sin(angle(i)) * (R * pct)) / 100] as const;
  const ring = (pct: number) => labels.map((_, i) => at(i, pct).join(',')).join(' ');
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onAxis?.(i);
    }
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} className={className} style={{ overflow: 'visible' }}>
      {/* Grid */}
      {(mini ? [100] : RINGS).map((p) => (
        <polygon key={p} points={ring(p)} fill={p === 100 ? 'rgba(255,255,255,0.025)' : 'none'} stroke={p === 50 ? VIZ.axis : VIZ.grid} strokeWidth={mini ? 0.75 : 1} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = at(i, 100);
        const on = activeAxis === i;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={on ? GOLD : axisOk[i] ? VIZ.grid : 'hsl(226 20% 30%)'}
            strokeDasharray={axisOk[i] ? undefined : '3 3'}
            strokeWidth={mini ? 0.5 : on ? 1.6 : 1}
          />
        );
      })}

      {/* Series (first = back) */}
      {series.map((s, si) => {
        const pts = s.values
          .map((v, i) => (v == null || !axisOk[i] ? null : at(i, Math.max(v, 3))))
          .filter((p): p is readonly [number, number] => !!p);
        if (pts.length < 3) return null;
        return (
          <g key={`${s.label}-${si}`} aria-hidden="true">
            <polygon
              points={pts.map((p) => p.join(',')).join(' ')}
              fill={s.color}
              fillOpacity={mini ? (si === 0 ? 0.12 : 0.4) : si === 0 ? 0.3 : 0.18}
              stroke={s.color}
              strokeWidth={mini ? 1 : 2.5}
              strokeLinejoin="round"
              strokeDasharray={!mini && si > 0 ? '6 4' : undefined}
              style={{ transition: 'all 300ms ease' }}
            />
            {!mini && pts.map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r={3.5} fill={s.color} stroke={VIZ.surface} strokeWidth={1.2} />)}
          </g>
        );
      })}

      {/* Axis labels: hover / focus / tap shows the values panel */}
      {!mini &&
        labels.map((label, i) => {
          const [x, y] = at(i, 100);
          const c = Math.cos(angle(i));
          const s = Math.sin(angle(i));
          const lx = x + c * 16;
          const ly = y + s * 16 + (s > 0.3 ? 12 : s < -0.3 ? -4 : 5);
          const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
          const on = activeAxis === i;
          const w = (label.length + (axisOk[i] ? 0 : 4)) * 9 + 14;
          const bx = anchor === 'start' ? lx - 7 : anchor === 'end' ? lx - w + 7 : lx - w / 2;
          return (
            <g
              key={label}
              role={onAxis ? 'button' : undefined}
              tabIndex={onAxis ? 0 : undefined}
              aria-pressed={onAxis ? on : undefined}
              aria-label={onAxis ? axisDescription?.(i) ?? label : undefined}
              className={onAxis ? 'group/axis cursor-pointer outline-none' : undefined}
              onMouseEnter={() => onAxis?.(i)}
              onFocus={() => onAxis?.(i)}
              onClick={() => onAxis?.(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <rect
                x={bx}
                y={ly - 17}
                width={w}
                height={25}
                rx={5}
                fill={on ? 'hsl(43 100% 62% / 0.14)' : 'transparent'}
                stroke={on ? 'hsl(43 100% 62% / 0.65)' : 'transparent'}
                strokeWidth={1.2}
                className="group-focus-visible/axis:stroke-[hsl(43_100%_62%)]"
              />
              <text x={lx} y={ly} textAnchor={anchor} fontSize={15} className="font-display font-bold uppercase" fill={axisOk[i] ? (on ? GOLD : VIZ.ink) : MUTED_AXIS}>
                {label}
                {!axisOk[i] && (
                  <tspan fontSize={12} className="font-mono font-normal normal-case" dx={5}>
                    n/a
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
    </svg>
  );
};

export default CompRadar;
