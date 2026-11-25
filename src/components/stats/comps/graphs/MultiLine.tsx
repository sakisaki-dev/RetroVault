import { memo, useMemo, useState, type ReactNode } from 'react';
import { peekKeyProps } from '@/components/peek/peekProps';
import { VIZ } from '../../analytics/viz';
import { ChartTip } from '../../visual/chartParts';
import { niceTicks, useWidth } from '../../visual/chartKit';
import { linear, shortNum, useTapPick } from './graphKit';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
  width?: number;
  dash?: string;
  /** "POS:Name" for the press-and-hold quick look on its end label */
  peekKey?: string;
  /** Draw the end label */
  endLabel?: boolean;
}

export interface Marker {
  x: number;
  y: number;
  label: string;
  color: string;
}

const M = { l: 40, r: 74, t: 10, b: 22 };

/**
 * A multi-line chart (the race and the comparison overlay): lines with end labels (each a quick-look target), an
 * optional shaded band and horizontal reference line, point markers, and a highlighted x (the season cursor). Tap or
 * hover a column for every line's value there; tapping also moves the shared cursor when `onX` is given.
 */
const MultiLine = memo(
  ({
    series,
    xs,
    xLabel,
    yFmt = shortNum,
    band,
    refLine,
    markers = [],
    selX,
    onX,
    height = 230,
    zero = true,
    ariaLabel,
    footer,
  }: {
    series: LineSeries[];
    xs: number[];
    xLabel: (x: number) => string;
    yFmt?: (v: number) => string;
    band?: { x: number; lo: number; hi: number }[];
    refLine?: { y: number; label: string };
    markers?: Marker[];
    selX?: number | null;
    onX?: (x: number) => void;
    height?: number;
    /** Start the y axis at 0 (false: fit the data, e.g. OVR 60-99) */
    zero?: boolean;
    ariaLabel: string;
    footer?: ReactNode;
  }) => {
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<number | null>(null);
    const tap = useTapPick<number>();
    const geo = useMemo(() => {
      if (!width || !xs.length) return null;
      const ys = [...series.flatMap((s) => s.points.map((p) => p.y)), ...(band ?? []).flatMap((b) => [b.lo, b.hi]), ...(refLine ? [refLine.y] : [])];
      const lo = Math.min(...ys);
      const { ticks, domain } = niceTicks(zero ? Math.min(0, lo) : lo, Math.max(zero ? 1 : lo + 1, ...ys), 4);
      const x0 = xs[0];
      const x1 = xs[xs.length - 1];
      const sx = linear(x0, x1 === x0 ? x0 + 1 : x1, M.l + 6, width - M.r);
      const sy = linear(domain[0], domain[1], height - M.b, M.t);
      // end labels pushed apart so close lines stay readable
      const ends = series
        .filter((s) => s.points.length && s.endLabel !== false)
        .map((s) => ({ key: s.key, y: sy(s.points[s.points.length - 1].y) }))
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
      const labelY = new Map(ends.map((e) => [e.key, e.y]));
      return { ticks, sx, sy, labelY };
    }, [width, xs, series, band, refLine, height, zero]);
    const step = xs.length > 1 ? Math.max(1, Math.ceil(xs.length / Math.max(2, Math.floor((width - M.l - M.r) / 34)))) : 1;
    const nearest = (clientX: number, el: HTMLElement) => {
      if (!geo) return null;
      const r = el.getBoundingClientRect();
      let best = xs[0];
      xs.forEach((x) => Math.abs(geo.sx(x) - (clientX - r.left)) < Math.abs(geo.sx(best) - (clientX - r.left)) && (best = x));
      return best;
    };
    const tipX = hover ?? tap.picked;
    return (
      <div className="cg-svgbox" ref={ref} data-no-swipe-x {...tap.boxProps}>
        {geo && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            className="block"
            onPointerDown={(e) => e.pointerType !== 'mouse' && tap.pick(nearest(e.clientX, e.currentTarget as unknown as HTMLElement))}
            onPointerMove={(e) => (e.pointerType === 'mouse' ? setHover(nearest(e.clientX, e.currentTarget as unknown as HTMLElement)) : e.buttons && tap.pick(nearest(e.clientX, e.currentTarget as unknown as HTMLElement)))}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
            onClick={(e) => {
              const x = nearest(e.clientX, e.currentTarget as unknown as HTMLElement);
              if (x != null) onX?.(x);
            }}
          >
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={width - M.r} y1={geo.sy(t)} y2={geo.sy(t)} stroke={VIZ.grid} strokeDasharray="2 3" />
                <text x={M.l - 5} y={geo.sy(t) + 3.5} textAnchor="end" fontSize="11" fill={VIZ.muted} className="tabular-nums">
                  {yFmt(t)}
                </text>
              </g>
            ))}
            {xs.map((x, i) =>
              (xs.length - 1 - i) % step === 0 ? (
                <text key={x} x={geo.sx(x)} y={height - 6} textAnchor="middle" fontSize="11" fill={x === selX ? 'hsl(43 100% 62%)' : VIZ.muted} className="tabular-nums">
                  {xLabel(x)}
                </text>
              ) : null,
            )}
            {selX != null && xs.includes(selX) && <line x1={geo.sx(selX)} x2={geo.sx(selX)} y1={M.t} y2={height - M.b} stroke="hsl(43 100% 62% / 0.55)" strokeWidth={1.5} />}
            {band && band.length > 1 && (
              <path
                d={`${band.map((b, i) => `${i ? 'L' : 'M'}${geo.sx(b.x)},${geo.sy(b.hi)}`).join(' ')} ${[...band]
                  .reverse()
                  .map((b) => `L${geo.sx(b.x)},${geo.sy(b.lo)}`)
                  .join(' ')} Z`}
                fill={VIZ.muted}
                opacity={0.14}
              />
            )}
            {refLine && (
              <g>
                <line x1={M.l} x2={width - M.r} y1={geo.sy(refLine.y)} y2={geo.sy(refLine.y)} stroke="hsl(354 90% 65%)" strokeDasharray="6 4" strokeWidth={1.25} />
                <text x={M.l + 4} y={geo.sy(refLine.y) - 4} fontSize="11" fill="hsl(354 90% 70%)" fontWeight={700}>
                  {refLine.label}
                </text>
              </g>
            )}
            {series.map((s) =>
              s.points.length ? (
                <g key={s.key}>
                  <path
                    d={s.points.map((p, i) => `${i ? 'L' : 'M'}${geo.sx(p.x).toFixed(1)},${geo.sy(p.y).toFixed(1)}`).join(' ')}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width ?? 1.75}
                    strokeDasharray={s.dash}
                    strokeLinejoin="round"
                  />
                  {s.points.length === 1 && <circle cx={geo.sx(s.points[0].x)} cy={geo.sy(s.points[0].y)} r={3} fill={s.color} />}
                  {s.endLabel !== false && (
                    <text
                      x={geo.sx(s.points[s.points.length - 1].x) + 5}
                      y={(geo.labelY.get(s.key) ?? geo.sy(s.points[s.points.length - 1].y)) + 3.5}
                      fontSize="11"
                      fontWeight={s.width && s.width > 2 ? 800 : 600}
                      fill={s.color}
                      {...peekKeyProps(s.peekKey)}
                    >
                      {s.label.length > 12 ? `${s.label.slice(0, 11)}…` : s.label}
                    </text>
                  )}
                </g>
              ) : null,
            )}
            {markers.map((m, i) => (
              <g key={i}>
                <circle cx={geo.sx(m.x)} cy={geo.sy(m.y)} r={5} fill="none" stroke={m.color} strokeWidth={2} />
                <circle cx={geo.sx(m.x)} cy={geo.sy(m.y)} r={2} fill={m.color} />
              </g>
            ))}
            {tipX != null && <line x1={geo.sx(tipX)} x2={geo.sx(tipX)} y1={M.t} y2={height - M.b} stroke={VIZ.axis} />}
          </svg>
        )}
        {geo && tipX != null && (
          <ChartTip x={geo.sx(tipX)} y={M.t + 30} width={width} dock={hover == null}>
            <p className="mb-1 font-semibold">{xLabel(tipX)}</p>
            <ul className="space-y-0.5 tabular-nums">
              {series
                .map((s) => ({ s, p: s.points.find((p) => p.x === tipX) }))
                .filter((r) => r.p)
                .sort((a, b) => b.p!.y - a.p!.y)
                .map(({ s, p }) => (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span className="cg-swatch" style={{ background: s.color }} />
                    <span className="truncate">{s.label}</span>
                    <span className="ml-auto pl-2 font-mono">{yFmt(p!.y)}</span>
                  </li>
                ))}
              {markers
                .filter((m) => m.x === tipX)
                .map((m, i) => (
                  <li key={`m${i}`} className="text-[11px]" style={{ color: m.color }}>
                    {m.label}
                  </li>
                ))}
            </ul>
          </ChartTip>
        )}
        {footer}
      </div>
    );
  },
);
MultiLine.displayName = 'MultiLine';

export default MultiLine;
