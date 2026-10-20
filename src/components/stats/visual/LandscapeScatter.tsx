import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import TeamLogo, { resolveTeam } from '../../brand/TeamLogo';
import { VIZ } from '../analytics/viz';
import { GOLD, fmtShort, niceTicks, teamMark, useRoving, useWidth } from './chartKit';
import { ChartTip } from './chartParts';
import { logTicks, quadrantName, splitOf, trendFit, type LPoint, type LandscapeSpec } from './landscape';

/**
 * The shared scatter engine for every landscape and the Graph Builder: team-coloured dots or logos (or a colour
 * override), Hall of Famers ringed in gold, real NFL legends as hollow squares tagged NFL, optional bubble size,
 * log axes, a league-only trend line with r, median (or custom) split lines with a quadrant name in each corner,
 * an optional y = x diagonal, and greedy label placement that names only notable points (plus the hovered,
 * focused or searched one) so labels never overlap. Medians, quadrants and the trend use league points only.
 */

const M = { top: 22, right: 18, bottom: 42, left: 50 };

const shortName = (name: string) => {
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
};

interface Placed {
  key: string;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
}

type Box = [number, number, number, number];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** Greedy label placement: most notable first, four candidate spots each, never overlapping another label. */
const placeLabels = (
  cands: { key: string; text: string; cx: number; cy: number }[],
  dots: { cx: number; cy: number }[],
  bounds: Box,
  max: number,
  reserved: Box[] = [],
): Placed[] => {
  const boxes: Box[] = [...reserved];
  const out: Placed[] = [];
  for (const c of cands) {
    if (out.length >= max) break;
    const w = c.text.length * 6.2 + 4;
    const h = 13;
    const spots: (Placed & { box: Box })[] = [
      { key: c.key, text: c.text, x: c.cx + 9, y: c.cy + 4, anchor: 'start', box: [c.cx + 7, c.cy - 8, c.cx + 9 + w, c.cy - 8 + h] },
      { key: c.key, text: c.text, x: c.cx - 9, y: c.cy + 4, anchor: 'end', box: [c.cx - 9 - w, c.cy - 8, c.cx - 7, c.cy - 8 + h] },
      { key: c.key, text: c.text, x: c.cx, y: c.cy - 10, anchor: 'middle', box: [c.cx - w / 2, c.cy - 21, c.cx + w / 2, c.cy - 21 + h] },
      { key: c.key, text: c.text, x: c.cx, y: c.cy + 19, anchor: 'middle', box: [c.cx - w / 2, c.cy + 8, c.cx + w / 2, c.cy + 8 + h] },
    ];
    let best: (Placed & { box: Box }) | null = null;
    let bestHits = Infinity;
    for (const s of spots) {
      const [x0, y0, x1, y1] = s.box;
      if (x0 < bounds[0] || y0 < bounds[1] || x1 > bounds[2] || y1 > bounds[3]) continue;
      if (boxes.some((b) => overlaps(b, s.box))) continue;
      const hits = dots.filter((d) => d.cx > x0 - 4 && d.cx < x1 + 4 && d.cy > y0 - 4 && d.cy < y1 + 4).length;
      if (hits < bestHits) {
        best = s;
        bestHits = hits;
      }
    }
    if (best && bestHits <= 1) {
      boxes.push(best.box);
      out.push({ key: best.key, text: best.text, x: best.x, y: best.y, anchor: best.anchor });
    }
  }
  return out;
};

/** Words packed into lines no wider than maxW (approximate glyph width for the bold uppercase label font). */
const wrapWords = (text: string, maxW: number, fontSize: number) => {
  const maxChars = Math.max(6, Math.floor(maxW / (fontSize * 0.72)));
  const lines: string[] = [];
  text.split(' ').forEach((w) => {
    const last = lines[lines.length - 1];
    if (last && `${last} ${w}`.length <= maxChars) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  });
  return lines;
};

/** Areas the corner quadrant names occupy, so point labels avoid them. */
const cornerBoxes = (spec: LandscapeSpec, plot: Box, fontSize: number): Box[] => {
  const maxW = (plot[2] - plot[0]) / 2 - 10;
  const lh = fontSize + 2;
  const size = (t: string) => {
    const lines = wrapWords(t.toUpperCase(), maxW, fontSize);
    return { w: Math.max(...lines.map((l) => l.length)) * fontSize * 0.72 + 8, h: lines.length * lh + 6 };
  };
  const q = spec.quadrants;
  const tr = size(q.tr);
  const tl = size(q.tl);
  const br = size(q.br);
  const bl = size(q.bl);
  const bottom = plot[3] - (spec.xSplit ? 12 : 0);
  return [
    [plot[2] - tr.w, plot[1], plot[2], plot[1] + tr.h],
    [plot[0], plot[1], plot[0] + tl.w, plot[1] + tl.h],
    [plot[2] - br.w, bottom - br.h, plot[2], plot[3]],
    [plot[0], plot[3] - bl.h, plot[0] + bl.w, plot[3]],
  ];
};

const QuadrantLabel = ({
  text,
  x,
  y,
  anchor,
  fromTop,
  maxW,
  style,
}: {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  fromTop: boolean;
  maxW: number;
  style: { fill: string; fillOpacity: number; fontSize: number; fontWeight: number; letterSpacing: number };
}) => {
  const lines = wrapWords(text.toUpperCase(), maxW, style.fontSize);
  const lh = style.fontSize + 2;
  const y0 = fromTop ? y : y - (lines.length - 1) * lh;
  return (
    <text x={x} y={y0} textAnchor={anchor} {...style}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i ? lh : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
};

const PointMark = ({
  pt,
  cx,
  cy,
  r,
  logo,
  highlight,
  onSelect,
  onShow,
  onKey,
}: {
  pt: LPoint;
  cx: number;
  cy: number;
  r: number;
  logo: string | null;
  highlight: boolean;
  onSelect: (p: Player) => void;
  onShow: (k: string | null) => void;
  onKey: (e: KeyboardEvent) => void;
}) => {
  const hof = !pt.nfl && isHallOfFamer(pt.player);
  const p = pt.player;
  const fill = pt.color ?? teamMark(p.team);
  return (
    <g
      role="button"
      tabIndex={0}
      data-rk={pt.key}
      aria-label={`${p.name}, ${p.position}${p.team ? `, ${p.team}` : ''}${pt.nfl ? ', real NFL player, not in the league baseline' : hof ? ', Hall of Famer' : ''}: ${pt.xText}, ${pt.yText}${pt.sizeText ? `, ${pt.sizeText}` : ''}. Open player`}
      className="cursor-pointer outline-none [&:focus-visible>.ring]:stroke-[hsl(43_100%_62%)]"
      onClick={() => onSelect(p)}
      onKeyDown={onKey}
      onMouseEnter={() => onShow(pt.key)}
      onFocus={() => onShow(pt.key)}
      onBlur={() => onShow(null)}
    >
      {/* ≥ 24px hit target; doubles as the focus ring */}
      <circle className="ring" cx={cx} cy={cy} r={Math.max(12, r + 3)} fill="transparent" stroke="transparent" strokeWidth={2} />
      {highlight && <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={GOLD} strokeWidth={2} strokeDasharray="3 2" />}
      {pt.nfl ? (
        <>
          <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} fill={VIZ.surface} stroke={fill} strokeWidth={2.5} />
          <rect x={cx - r * 0.45} y={cy - r * 0.45} width={r * 0.9} height={r * 0.9} fill={fill} />
        </>
      ) : logo ? (
        <>
          {hof && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={GOLD} strokeWidth={2} />}
          <image href={logo} x={cx - r - 3} y={cy - r - 3} width={(r + 3) * 2} height={(r + 3) * 2} preserveAspectRatio="xMidYMid meet" />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={pt.size != null ? 0.85 : 1} stroke={hof ? GOLD : VIZ.surface} strokeWidth={hof ? 2.5 : 1.5} />
      )}
    </g>
  );
};

/** Linear or log10 axis over [lo, hi] mapped to [a, b]. */
const axis = (lo: number, hi: number, log: boolean, zero: boolean, count: number, pad: number) => {
  if (log) {
    const l = lo / (1 + pad * 3);
    const h = hi * (1 + pad * 3);
    const ticks = logTicks(l, h);
    return { ticks, domain: [l, h] as [number, number], t: (v: number) => Math.log10(v), inv: (u: number) => 10 ** u };
  }
  const span = hi - lo || Math.abs(hi) || 1;
  const nt = niceTicks(zero ? Math.min(0, lo) : lo - span * pad, hi + span * pad, count);
  return { ticks: nt.ticks, domain: nt.domain, t: (v: number) => v, inv: (u: number) => u };
};

const LandscapeScatter = ({
  points,
  spec,
  logos,
  onSelect,
  ariaLabel,
  highlightKey,
}: {
  points: LPoint[];
  spec: LandscapeSpec;
  logos: boolean;
  onSelect: (p: Player) => void;
  ariaLabel: string;
  /** Searched player: always labelled and ringed. */
  highlightKey?: string | null;
}) => {
  const [boxRef, width] = useWidth();
  const [hover, setHover] = useState<string | null>(null);
  const narrow = width < 520;
  const height = narrow ? Math.max(360, Math.round(width * 1.05)) : Math.round(Math.min(560, Math.max(400, width * 0.58)));
  const plot: Box = [M.left, M.top, width - M.right, height - M.bottom];

  const geo = useMemo(() => {
    const pts = points.filter((p) => (!spec.logX || p.x > 0) && (!spec.logY || p.y > 0));
    if (!pts.length || width === 0) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const { sx, sy } = splitOf(pts, spec);
    let xlo = Math.min(...xs, sx);
    let xhi = Math.max(...xs, sx);
    let ylo = Math.min(...ys, sy);
    let yhi = Math.max(...ys, sy);
    if (spec.diagonal) {
      xlo = ylo = Math.min(xlo, ylo);
      xhi = yhi = Math.max(xhi, yhi);
    }
    const ax = axis(xlo, xhi, !!spec.logX, !!spec.xZero, narrow ? 4 : 6, 0.04);
    const ay = axis(ylo, yhi, !!spec.logY, !!spec.yZero, narrow ? 5 : 6, 0.06);
    const fx = (v: number) => (ax.t(v) - ax.t(ax.domain[0])) / (ax.t(ax.domain[1]) - ax.t(ax.domain[0]) || 1);
    const fy = (v: number) => (ay.t(v) - ay.t(ay.domain[0])) / (ay.t(ay.domain[1]) - ay.t(ay.domain[0]) || 1);
    const X = (v: number) => plot[0] + fx(v) * (plot[2] - plot[0]);
    const Y = (v: number) => (spec.yInvert ? plot[1] + fy(v) * (plot[3] - plot[1]) : plot[3] - fy(v) * (plot[3] - plot[1]));
    const yTicks = spec.yInteger ? ay.ticks.filter((t) => Number.isInteger(t)) : ay.ticks;

    // Bubble size: sqrt scale of the third stat, 4–14px.
    const sizes = pts.map((p) => p.size).filter((v): v is number => v != null && Number.isFinite(v));
    const sLo = Math.min(...sizes);
    const sHi = Math.max(...sizes);
    const base = narrow ? 5 : 6;
    const radius = (p: LPoint) => (p.size == null || !sizes.length ? base : 4 + 10 * Math.sqrt(sHi > sLo ? (p.size - sLo) / (sHi - sLo) : 0.5));

    // Notability: distance from the split point in plotted units, Hall of Famers and the top-right nudged up.
    const up = (p: LPoint) => (spec.yInvert ? p.y <= sy : p.y >= sy);
    const scored = pts
      .map((p) => ({
        p,
        s:
          Math.hypot(fx(p.x) - fx(sx), fy(p.y) - fy(sy)) +
          (isHallOfFamer(p.player) && !p.nfl ? 0.08 : 0) +
          (p.x >= sx && up(p) ? 0.05 : 0) +
          (p.key === highlightKey ? 10 : 0),
      }))
      .sort((a, b) => b.s - a.s);
    const dots = pts.map((p) => ({ cx: X(p.x), cy: Y(p.y) }));
    const labels = placeLabels(
      scored.map(({ p }) => ({ key: p.key, text: `${narrow ? shortName(p.player.name) : p.player.name}${p.nfl ? ' (NFL)' : ''}`, cx: X(p.x), cy: Y(p.y) })),
      dots,
      plot,
      (narrow ? 6 : 14) + (highlightKey ? 1 : 0),
      spec.noSplits ? [] : cornerBoxes(spec, plot, narrow ? 10 : 12),
    );

    const fit = spec.trend ? trendFit(pts, spec) : null;
    let trendLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
    if (fit) {
      const u0 = ax.t(ax.domain[0]);
      const u1 = ax.t(ax.domain[1]);
      const yAt = (u: number) => ay.inv(fit.intercept + fit.slope * u);
      const clampY = (v: number) => Math.min(Math.max(v, Math.min(...ay.domain)), Math.max(...ay.domain));
      trendLine = { x1: X(ax.inv(u0)), y1: Y(clampY(yAt(u0))), x2: X(ax.inv(u1)), y2: Y(clampY(yAt(u1))) };
    }
    return { pts, X, Y, ax, yTicks, sx, sy, labels, radius, fit, trendLine };
    // plot is derived from width/height
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, spec, width, height, narrow, highlightKey]);

  const order = useMemo(() => [...points].sort((a, b) => a.x - b.x || a.y - b.y).map((p) => p.key), [points]);
  const roving = useRoving(order);
  const byKey = useMemo(() => new Map(points.map((p) => [p.key, p])), [points]);
  const hovered = hover ? byKey.get(hover) : undefined;
  const labelled = new Set(geo?.labels.map((l) => l.key));
  // Big bubbles first (small ones stay clickable on top), Hall of Famers and legends last.
  const drawOrder = useMemo(
    () =>
      [...(geo?.pts ?? [])].sort(
        (a, b) => (b.size ?? 0) - (a.size ?? 0) || Number(isHallOfFamer(a.player) || !!a.nfl) - Number(isHallOfFamer(b.player) || !!b.nfl),
      ),
    [geo],
  );

  const q = spec.quadrants;
  const qStyle = { fill: GOLD, fillOpacity: 0.8, fontSize: narrow ? 10 : 12, fontWeight: 800, letterSpacing: 1 } as const;
  const fmtTick = (t: number) => fmtShort(t);

  return (
    <div ref={boxRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {geo && (
        <div ref={roving.container}>
          <svg width={width} height={height} role="group" aria-label={ariaLabel} className="block select-none">
            {/* Grid + axes */}
            <g aria-hidden="true">
              {geo.ax.ticks.map((t) => (
                <g key={`x${t}`}>
                  <line x1={geo.X(t)} x2={geo.X(t)} y1={plot[1]} y2={plot[3]} stroke={VIZ.grid} />
                  <text x={geo.X(t)} y={plot[3] + 16} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
                    {fmtTick(t)}
                  </text>
                </g>
              ))}
              {geo.yTicks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={plot[0]} x2={plot[2]} y1={geo.Y(t)} y2={geo.Y(t)} stroke={VIZ.grid} />
                  <text x={plot[0] - 6} y={geo.Y(t) + 4} textAnchor="end" fontSize={11} fill={VIZ.muted}>
                    {fmtTick(t)}
                  </text>
                </g>
              ))}
              <text x={(plot[0] + plot[2]) / 2} y={height - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill={VIZ.ink} className="font-display uppercase">
                {spec.xLabel}
                {spec.logX ? ' (log)' : ''} →
              </text>
              <text transform={`translate(13 ${(plot[1] + plot[3]) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fontWeight={700} fill={VIZ.ink} className="font-display uppercase">
                {spec.yLabel}
                {spec.logY ? ' (log)' : ''} {spec.yInvert ? '(lower is better) ' : ''}→
              </text>

              {!spec.noSplits && (
                <>
                  {/* Top-right quadrant tint, split lines */}
                  <rect x={geo.X(geo.sx)} y={plot[1]} width={Math.max(plot[2] - geo.X(geo.sx), 0)} height={Math.max(geo.Y(geo.sy) - plot[1], 0)} fill={GOLD} fillOpacity={0.045} />
                  <line x1={geo.X(geo.sx)} x2={geo.X(geo.sx)} y1={plot[1]} y2={plot[3]} stroke={spec.xSplit ? GOLD : VIZ.muted} strokeOpacity={spec.xSplit ? 0.8 : 0.6} strokeDasharray="5 4" />
                  <line x1={plot[0]} x2={plot[2]} y1={geo.Y(geo.sy)} y2={geo.Y(geo.sy)} stroke={spec.ySplit ? GOLD : VIZ.muted} strokeOpacity={spec.ySplit ? 0.8 : 0.6} strokeDasharray="5 4" />
                  {spec.ySplit && (
                    <text x={plot[2] - 4} y={geo.Y(geo.sy) - 5} textAnchor="end" fontSize={10} fontWeight={700} fill={GOLD}>
                      {spec.ySplit.label}
                    </text>
                  )}
                  {spec.xSplit && (
                    <text x={geo.X(geo.sx) + 4} y={plot[3] - 6} fontSize={10} fontWeight={700} fill={GOLD}>
                      {spec.xSplit.label}
                    </text>
                  )}
                  {/* Quadrant names in the corners (wrapped to half the plot width so they never collide) */}
                  <QuadrantLabel text={q.tr} x={plot[2] - 6} y={plot[1] + 14} anchor="end" fromTop maxW={(plot[2] - plot[0]) / 2 - 10} style={qStyle} />
                  <QuadrantLabel text={q.tl} x={plot[0] + 6} y={plot[1] + 14} anchor="start" fromTop maxW={(plot[2] - plot[0]) / 2 - 10} style={qStyle} />
                  <QuadrantLabel text={q.br} x={plot[2] - 6} y={plot[3] - (spec.xSplit ? 20 : 8)} anchor="end" fromTop={false} maxW={(plot[2] - plot[0]) / 2 - 10} style={qStyle} />
                  <QuadrantLabel text={q.bl} x={plot[0] + 6} y={plot[3] - 8} anchor="start" fromTop={false} maxW={(plot[2] - plot[0]) / 2 - 10} style={qStyle} />
                </>
              )}
              {spec.diagonal && (
                <>
                  <line x1={geo.X(geo.ax.domain[0])} y1={geo.Y(geo.ax.domain[0])} x2={geo.X(geo.ax.domain[1])} y2={geo.Y(geo.ax.domain[1])} stroke={VIZ.ink} strokeOpacity={0.35} strokeWidth={1.5} />
                  <text x={geo.X(geo.ax.domain[1]) - 4} y={geo.Y(geo.ax.domain[1]) + 14} textAnchor="end" fontSize={10} fill={VIZ.muted}>
                    y = x
                  </text>
                </>
              )}
              {geo.trendLine && geo.fit && (
                <>
                  <line {...geo.trendLine} stroke={VIZ.ink} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="8 5" />
                  <g transform={`translate(${(plot[0] + plot[2]) / 2} ${plot[1] + 4})`}>
                    <rect x={-34} y={0} width={68} height={18} rx={4} fill={VIZ.surface} stroke={VIZ.axis} />
                    <text x={0} y={13} textAnchor="middle" fontSize={11} fontWeight={700} fill={VIZ.ink} className="font-mono">
                      r = {geo.fit.r.toFixed(2)}
                    </text>
                  </g>
                </>
              )}
            </g>

            {drawOrder.map((pt) => (
              <PointMark
                key={pt.key}
                pt={pt}
                cx={geo.X(pt.x)}
                cy={geo.Y(pt.y)}
                r={geo.radius(pt)}
                logo={logos ? resolveTeam(pt.player.team)?.logoUrl ?? null : null}
                highlight={pt.key === highlightKey}
                onSelect={onSelect}
                onShow={setHover}
                onKey={(e) => roving.onKeyDown(pt.key, e, () => onSelect(pt.player))}
              />
            ))}

            {/* Labels (non-interactive; the dot is the target) */}
            <g aria-hidden="true" pointerEvents="none">
              {geo.labels.map((l) => (
                <text
                  key={l.key}
                  x={l.x}
                  y={l.y}
                  textAnchor={l.anchor}
                  fontSize={11}
                  fontWeight={l.key === highlightKey ? 800 : 600}
                  fill={l.key === highlightKey ? GOLD : VIZ.ink}
                  stroke={VIZ.surface}
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {l.text}
                </text>
              ))}
              {hovered && !labelled.has(hovered.key) && (
                <text x={geo.X(hovered.x) + 9} y={geo.Y(hovered.y) - 8} fontSize={11} fontWeight={700} fill={GOLD} stroke={VIZ.surface} strokeWidth={3} paintOrder="stroke">
                  {hovered.player.name}
                </text>
              )}
            </g>
          </svg>
        </div>
      )}
      {hovered && geo && (
        <ChartTip x={geo.X(hovered.x)} y={geo.Y(hovered.y)} width={width}>
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            {hovered.player.team && <TeamLogo team={hovered.player.team} size={16} decorative />}
            {hovered.player.name} <span className="text-muted-foreground">· {hovered.player.position}</span>
            {hovered.nfl && <span className="rounded-sm bg-flag/80 px-1 font-pixel text-[7px] text-night">NFL</span>}
          </p>
          <p className="mt-0.5 font-mono tabular-nums text-secondary-foreground">
            {hovered.xText} · {hovered.yText}
            {hovered.sizeText ? ` · ${hovered.sizeText}` : ''}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {spec.noSplits ? '' : `${quadrantName(hovered, geo.sx, geo.sy, spec)} · `}
            {hovered.nfl ? 'real NFL, unranked · ' : isHallOfFamer(hovered.player) ? 'Hall of Famer · ' : ''}click to open
          </p>
        </ChartTip>
      )}
    </div>
  );
};

export default LandscapeScatter;
