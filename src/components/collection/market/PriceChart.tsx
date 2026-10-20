import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';

export interface ChartPoint {
  label: string;
  value: number;
  /** Extra tooltip lines, e.g. "OVR 96 · Skill 97" */
  detail?: string;
}

interface PriceChartProps {
  points: ChartPoint[];
  /** Accessible name, e.g. "Price of Jackson Wardell Kline's card" */
  title: string;
  /** Value formatter for tooltips, axis and the table */
  format?: (v: number) => string;
  /** Column header for the value in the table fallback */
  valueLabel?: string;
  /** Small line without area, axis labels or tooltip (OVR / skill history) */
  mini?: boolean;
  /** Plot height in px (default 120, mini 36); the width follows the container */
  height?: number;
  /** Hidden from assistive tech (a sparkline inside a labelled button); direction-coloured */
  decorative?: boolean;
  className?: string;
}

const PAD = { l: 6, r: 6, t: 10, b: 10 };

/**
 * Single-series price chart: a 2px line over a soft area, a dot per snapshot, a crosshair + tooltip on hover or
 * arrow keys (the chart is focusable), and a screen-reader table of every point. `mini` draws just the line.
 */
const PriceChart = ({ points, title, format = (v) => v.toLocaleString('en-US'), valueLabel = 'Value', mini = false, decorative = false, height, className }: PriceChartProps) => {
  const [active, setActive] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const plotRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => el.clientWidth > 0 && setW(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height ?? (mini ? 36 : 120);
  const n = points.length;
  if (!n) return null;

  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    const pad = Math.max(1, Math.abs(hi) * 0.05);
    lo -= pad;
    hi += pad;
  }
  const x = (i: number) => (n === 1 ? W / 2 : PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;
  const up = vals[n - 1] >= vals[0];

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - fx) < Math.abs(x(best) - fx)) best = i;
    });
    setActive(best);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation(); // the card dialog also uses ← → to browse cards
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      setActive((a) => Math.min(n - 1, Math.max(0, (a ?? (d > 0 ? -1 : n)) + d)));
    } else if (e.key === 'Escape' && active != null) {
      e.stopPropagation();
      setActive(null);
    }
  };
  const p = active != null ? points[active] : null;

  return (
    <figure className={cn('mk-chart', mini && 'mk-chart--mini', decorative && 'mk-chart--dir', up ? 'is-up' : 'is-down', className)} aria-hidden={decorative || undefined}>
      <div className="mk-chart__plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role={mini ? 'img' : 'application'}
          aria-label={mini ? `${title}: ${points.map((q) => `${q.label} ${format(q.value)}`).join(', ')}` : `${title}. Use left and right arrows to read each point.`}
          tabIndex={mini ? undefined : 0}
          onPointerMove={mini ? undefined : pick}
          onPointerDown={mini ? undefined : pick}
          onPointerLeave={mini ? undefined : () => setActive(null)}
          onKeyDown={mini ? undefined : onKey}
          onBlur={() => setActive(null)}
        >
          {!mini && (
            <>
              <defs>
                <linearGradient id={`mk-g-${gid}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line className="mk-chart__grid" x1={0} x2={W} y1={y(hi)} y2={y(hi)} />
              <line className="mk-chart__grid" x1={0} x2={W} y1={y(lo)} y2={y(lo)} />
              {n > 1 && <path d={area} fill={`url(#mk-g-${gid})`} />}
            </>
          )}
          {n > 1 && <path d={line} className="mk-chart__line" />}
          {!mini && p && active != null && <line className="mk-chart__cross" x1={x(active)} x2={x(active)} y1={PAD.t - 6} y2={H - PAD.b + 4} />}
          {points.map((q, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(q.value)}
              r={mini ? (i === n - 1 ? 2.6 : 0) : active === i ? 5 : i === n - 1 ? 4 : 3}
              className={cn('mk-chart__dot', active === i && 'is-on')}
            />
          ))}
        </svg>
        {!mini && p && active != null && (
          <div
            className="mk-tip"
            style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
            data-edge={active === 0 ? 'start' : active === n - 1 ? 'end' : undefined}
            aria-hidden="true"
          >
            <span className="mk-tip__label">{p.label}</span>
            <span className="mk-tip__value">{format(p.value)}</span>
            {p.detail && <span className="mk-tip__detail">{p.detail}</span>}
          </div>
        )}
        {!mini && (
          <span className="sr-only" aria-live="polite">
            {p ? `${p.label}: ${format(p.value)}${p.detail ? `, ${p.detail}` : ''}` : ''}
          </span>
        )}
      </div>
      {!mini && (
        <figcaption className="mk-chart__axis" aria-hidden="true">
          <span>{points[0].label}</span>
          <span className="mk-chart__range">
            {format(Math.min(...vals))} – {format(Math.max(...vals))}
          </span>
          <span>{points[n - 1].label}</span>
        </figcaption>
      )}
      {!mini && (
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Update</th>
              <th scope="col">{valueLabel}</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {points.map((q, i) => (
              <tr key={i}>
                <th scope="row">{q.label}</th>
                <td>{format(q.value)}</td>
                <td>{q.detail ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
};

export default PriceChart;
