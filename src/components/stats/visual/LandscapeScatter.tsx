import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import TeamLogo, { resolveTeam } from '../../brand/TeamLogo';
import { VIZ } from '../analytics/viz';
import { GOLD, fmtShort, niceTicks, teamMark, useWidth } from './chartKit';
import { ChartTip } from './chartParts';
import { logTicks, quadrantName, splitOf, trendFit, type LPoint, type LandscapeSpec } from './landscape';
import type { PositionFamilies } from '@/config/families';
import { FamilyZoneLabels, FamilyZoneLayer } from './FamilyZones';
import { buildZones } from './zones';

/**
 * The shared scatter engine for every landscape and the Graph Builder: team-coloured dots or logos (or a colour
 * override), Hall of Famers ringed in gold, real NFL legends as hollow squares tagged NFL, optional bubble size,
 * log axes, a league-only trend line with r, median (or custom) split lines with a quadrant name in each corner,
 * an optional y = x diagonal, and greedy label placement that names only notable points (plus the hovered,
 * focused or searched one) so labels never overlap. Medians, quadrants and the trend use league points only.
 *
 * Picking never needs pixel precision: hovering anywhere highlights the nearest point within 30px (raised on top,
 * enlarged, with its tooltip); a click opens that point, or a small chooser when several dots overlap there.
 * Arrow keys move to the nearest point in that direction; Enter opens it.
 *
 * Touch mode (`touch`, the Graph Builder on phones): a tap selects the nearest point within 30px (a 60px target, so
 * no dot is too small) and hands it to `touch.onPreview` (a bottom-sheet preview) instead of opening the card. Two
 * fingers pinch-zoom and pan the plot (semantic zoom: the axes re-tick and dots keep their size); once zoomed, one
 * finger pans too. Unzoomed, one finger always scrolls the page, so the chart never traps the scroll. Why this and
 * not a scrubber: the chart is a scatter (no single axis to scrub along), and the crowded corners are what people
 * want to get into; pinch is the gesture phones already use for that.
 */

/** Visible window in normalised plot units (0..1 on each axis); the full chart is {0, 1, 0, 1}. */
export interface ScatterView {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}
const FULL: ScatterView = { u0: 0, u1: 1, v0: 0, v1: 1 };
const MIN_SPAN = 1 / 8;
const SLACK = 0.06;
const clampView = (v: ScatterView): ScatterView => {
  const fit = (a: number, b: number): [number, number] => {
    let span = Math.min(1 + 2 * SLACK, Math.max(MIN_SPAN, b - a));
    if (span >= 1) span = 1;
    let lo = a;
    if (span === 1) lo = 0;
    lo = Math.min(Math.max(lo, -SLACK), 1 + SLACK - span);
    return [lo, lo + span];
  };
  const [u0, u1] = fit(v.u0, v.u1);
  const [v0, v1] = fit(v.v0, v.v1);
  return { u0, u1, v0, v1 };
};
const isZoomed = (v: ScatterView) => v.u1 - v.u0 < 0.999 || v.v1 - v.v0 < 0.999;

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

/** Dark outline so overlapping translucent dots stay distinguishable. */
const OUTLINE = 'hsl(228 45% 5%)';

/** One point's mark (no pointer handlers: the plot picks the nearest point). `raised` = the enlarged top copy. */
const PointShape = ({ pt, cx, cy, r, logo, raised }: { pt: LPoint; cx: number; cy: number; r: number; logo: string | null; raised?: boolean }) => {
  const hof = !pt.nfl && isHallOfFamer(pt.player);
  const fill = pt.color ?? teamMark(pt.player.team);
  if (pt.nfl)
    return (
      <>
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} fill={VIZ.surface} stroke={raised ? VIZ.ink : fill} strokeWidth={2.5} />
        <rect x={cx - r * 0.45} y={cy - r * 0.45} width={r * 0.9} height={r * 0.9} fill={fill} />
      </>
    );
  if (logo)
    return (
      <>
        {(hof || raised) && <circle cx={cx} cy={cy} r={r + 5} fill={raised ? VIZ.surface : 'none'} stroke={raised ? VIZ.ink : GOLD} strokeWidth={2} />}
        <image href={logo} x={cx - r - 3} y={cy - r - 3} width={(r + 3) * 2} height={(r + 3) * 2} preserveAspectRatio="xMidYMid meet" />
      </>
    );
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      fillOpacity={raised ? 1 : pt.size != null ? 0.7 : 0.82}
      stroke={raised ? VIZ.ink : hof ? GOLD : OUTLINE}
      strokeWidth={raised ? 2.5 : hof ? 2.5 : 1.25}
    />
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
  return (
    <g
      role="button"
      tabIndex={0}
      data-rk={pt.key}
      aria-label={`${p.name}, ${p.position}${p.team ? `, ${p.team}` : ''}${pt.nfl ? ', real NFL player, not in the league baseline' : hof ? ', Hall of Famer' : ''}: ${pt.xText}, ${pt.yText}${pt.sizeText ? `, ${pt.sizeText}` : ''}. Open player`}
      className="outline-none [&:focus-visible>.ring]:stroke-[hsl(43_100%_62%)]"
      onClick={() => onSelect(p)}
      onKeyDown={onKey}
      onFocus={() => onShow(pt.key)}
      onBlur={() => onShow(null)}
    >
      {/* ≥ 24px target; doubles as the focus ring */}
      <circle className="ring" cx={cx} cy={cy} r={Math.max(12, r + 4)} fill="transparent" stroke="transparent" strokeWidth={2} />
      {highlight && <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={GOLD} strokeWidth={2} strokeDasharray="3 2" />}
      <PointShape pt={pt} cx={cx} cy={cy} r={r} logo={logo} />
    </g>
  );
};

/** Pick radius (px): a click or hover anywhere within this of a point counts. */
const PICK = 30;

interface Screen {
  pt: LPoint;
  cx: number;
  cy: number;
  r: number;
}

/** Points within `radius` of (x, y), nearest first. A plain scan: a few hundred points is nothing. */
const near = (all: Screen[], x: number, y: number, radius: number) =>
  all
    .map((s) => ({ s, d: Math.hypot(s.cx - x, s.cy - y) }))
    .filter((o) => o.d <= radius)
    .sort((a, b) => a.d - b.d);

/** Nearest point in an arrow direction: within a 60° cone first, then the whole half-plane. */
const step = (all: Screen[], from: Screen, key: string): Screen | null => {
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!dir) return null;
  let best: Screen | null = null;
  let bestScore = Infinity;
  all.forEach((s) => {
    if (s === from) return;
    const dx = s.cx - from.cx;
    const dy = s.cy - from.cy;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 0.5) return;
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    const score = along + across * (across > along * 1.15 ? 6 : 2);
    if (score < bestScore) {
      best = s;
      bestScore = score;
    }
  });
  return best;
};

/** Small chooser for a cluster of overlapping points. */
const ClusterChooser = ({
  at,
  items,
  width,
  onPick,
  onClose,
}: {
  at: { x: number; y: number };
  items: LPoint[];
  width: number;
  onPick: (p: LPoint) => void;
  onClose: () => void;
}) => {
  const left = Math.min(Math.max(8, at.x - 130), Math.max(8, width - 268));
  return (
    <div
      role="dialog"
      aria-label={`${items.length} players here`}
      className="absolute z-30 w-[260px] max-w-[calc(100%-16px)] rounded-md border border-line bg-popover p-1 shadow-elevated"
      style={{ left, top: at.y + 14 }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <p className="flex items-center justify-between px-2 pb-1 pt-0.5 font-pixel text-[8px] uppercase text-muted-foreground">
        {items.length} players here
        <button type="button" onClick={onClose} className="rounded px-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label="Close">
          ×
        </button>
      </p>
      <ul className="max-h-[240px] overflow-y-auto">
        {items.map((pt, i) => (
          <li key={pt.key}>
            <button
              type="button"
              autoFocus={i === 0}
              onClick={() => onPick(pt)}
              className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-panel-2 focus-visible:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {pt.player.team ? <TeamLogo team={pt.player.team} size={18} decorative /> : <span className="w-[18px]" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate font-semibold text-foreground">
                  {pt.player.name}
                  <span className="font-normal text-muted-foreground">· {pt.player.position}</span>
                  {pt.nfl && <span className="rounded-sm bg-flag/80 px-1 font-pixel text-[7px] text-night">NFL</span>}
                </span>
                <span className="block truncate font-mono tabular-nums text-muted-foreground">
                  {pt.xText} · {pt.yText}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
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
  zones,
  touch,
}: {
  points: LPoint[];
  spec: LandscapeSpec;
  logos: boolean;
  onSelect: (p: Player) => void;
  ariaLabel: string;
  /** Searched player: always labelled and ringed. */
  highlightKey?: string | null;
  /** Family zones of ONE position (config/families.ts), drawn behind that position's dots; `active` dims the rest. */
  zones?: { fams: PositionFamilies; active: number | null } | null;
  /** Phone mode: tap previews (instead of opening), pinch-zoom and pan. `previewKey` is the previewed point. */
  touch?: { onPreview: (pt: LPoint | null) => void; previewKey: string | null } | null;
}) => {
  const [boxRef, width] = useWidth();
  const [hover, setHover] = useState<string | null>(null);
  const narrow = width < 520;
  // Phones: close to 4:5, but never taller than about two thirds of the screen (the page must stay scrollable)
  const touchH = typeof window === 'undefined' ? 560 : Math.round(window.innerHeight * 0.64);
  const height = touch
    ? Math.round(Math.min(Math.max(340, width * 1.2), Math.max(340, touchH)))
    : narrow
      ? Math.max(360, Math.round(width * 1.05))
      : Math.round(Math.min(560, Math.max(400, width * 0.58)));
  const plot: Box = [M.left, M.top, width - M.right, height - M.bottom];
  const [view, setView] = useState<ScatterView>(FULL);
  const zoomed = isZoomed(view);
  // A new chart (other stats, filters) starts unzoomed
  useEffect(() => setView(FULL), [points, spec]);

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
    // Zoom (touch mode): the visible window [u0, u1] × [v0, v1] of the normalised plot fills the plot box
    const zx = (u: number) => (u - view.u0) / (view.u1 - view.u0);
    const zy = (u: number) => (u - view.v0) / (view.v1 - view.v0);
    const X = (v: number) => plot[0] + zx(fx(v)) * (plot[2] - plot[0]);
    const Y = (v: number) => (spec.yInvert ? plot[1] + zy(fy(v)) * (plot[3] - plot[1]) : plot[3] - zy(fy(v)) * (plot[3] - plot[1]));
    // Ticks for the visible window only (re-ticked while zoomed, so the axes stay readable)
    const visTicks = (a: typeof ax, u0: number, u1: number, log: boolean, count: number) => {
      if (u0 <= 0.001 && u1 >= 0.999) return a.ticks;
      const t0 = a.t(a.domain[0]);
      const t1 = a.t(a.domain[1]);
      const lo = a.inv(t0 + Math.max(0, u0) * (t1 - t0));
      const hi = a.inv(t0 + Math.min(1, u1) * (t1 - t0));
      const raw = log ? logTicks(lo, hi) : niceTicks(lo, hi, count).ticks;
      const eps = (hi - lo) * 1e-6;
      return raw.filter((t) => t >= lo - eps && t <= hi + eps);
    };
    const xTicks = visTicks(ax, view.u0, view.u1, !!spec.logX, narrow ? 4 : 6);
    const yAll = visTicks(ay, view.v0, view.v1, !!spec.logY, narrow ? 5 : 6);
    const yTicks = spec.yInteger ? yAll.filter((t) => Number.isInteger(t)) : yAll;

    // Bubble size: sqrt scale of the third stat, 4–14px.
    const sizes = pts.map((p) => p.size).filter((v): v is number => v != null && Number.isFinite(v));
    const sLo = Math.min(...sizes);
    const sHi = Math.max(...sizes);
    // Bigger dots (easier to hit), a touch smaller on crowded charts.
    const base = (narrow ? 6 : 7) * (pts.length >= 100 ? 0.85 : 1);
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
    const inPlot = (p: LPoint) => {
      const cx = X(p.x);
      const cy = Y(p.y);
      return cx >= plot[0] && cx <= plot[2] && cy >= plot[1] && cy <= plot[3];
    };
    const zoomLevel = 1 / Math.min(view.u1 - view.u0, view.v1 - view.v0);
    const labels = placeLabels(
      scored.filter(({ p }) => inPlot(p)).map(({ p }) => ({ key: p.key, text: `${narrow ? shortName(p.player.name) : p.player.name}${p.nfl ? ' (NFL)' : ''}`, cx: X(p.x), cy: Y(p.y) })),
      dots,
      plot,
      Math.min(16, Math.round((narrow ? 6 : 14) * Math.sqrt(zoomLevel))) + (highlightKey ? 1 : 0),
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
    return { pts, X, Y, ax, xTicks, yTicks, sx, sy, labels, radius, fit, trendLine };
    // plot is derived from width/height
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, spec, width, height, narrow, highlightKey, view]);

  const byKey = useMemo(() => new Map(points.map((p) => [p.key, p])), [points]);
  const hovered = hover ? byKey.get(hover) : undefined;
  const labelled = new Set(geo?.labels.map((l) => l.key));
  // Big bubbles first (small ones stay visible on top), Hall of Famers and legends last.
  const drawOrder = useMemo(
    () =>
      [...(geo?.pts ?? [])].sort(
        (a, b) => (b.size ?? 0) - (a.size ?? 0) || Number(isHallOfFamer(a.player) || !!a.nfl) - Number(isHallOfFamer(b.player) || !!b.nfl),
      ),
    [geo],
  );
  const screen = useMemo<Screen[]>(() => {
    if (!geo) return [];
    const all = drawOrder.map((pt) => ({ pt, cx: geo.X(pt.x), cy: geo.Y(pt.y), r: geo.radius(pt) }));
    // Zoomed: only what's inside the plot (plus a dot's radius) is drawn and pickable
    return zoomed ? all.filter((s) => s.cx >= plot[0] - s.r && s.cx <= plot[2] + s.r && s.cy >= plot[1] - s.r && s.cy <= plot[3] + s.r) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, drawOrder, zoomed]);
  const screenByKey = useMemo(() => new Map(screen.map((s) => [s.pt.key, s])), [screen]);
  // Zones only ever wrap the zone position's league dots (NFL keys carry an "nfl:" prefix, so they never match).
  const famOf = (key: string) => zones?.fams.of.get(key);
  const zoneShapes = useMemo(
    () => (zones ? buildZones(screen.map((s) => ({ key: s.pt.key, x: s.cx, y: s.cy, r: s.r })), (k) => zones.fams.of.get(k), narrow ? 9 : 12, narrow ? 36 : 56) : []),
    [screen, zones, narrow],
  );
  const famActive = zones?.active ?? null;

  // Cluster chooser (several overlapping dots under one click) and the last picked point.
  const [chooser, setChooser] = useState<{ x: number; y: number; items: LPoint[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointsRef = useRef<SVGGElement | null>(null);
  useEffect(() => setChooser(null), [points, width]);
  useEffect(() => {
    if (!chooser) return;
    const close = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setChooser(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [chooser]);

  const local = (e: { clientX: number; clientY: number }) => {
    const box = svgRef.current?.getBoundingClientRect();
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : null;
  };
  const open = (pt: LPoint) => {
    setPicked(pt.key);
    setChooser(null);
    if (touch) touch.onPreview(pt);
    else onSelect(pt.player);
  };
  // The preview closed elsewhere: drop the raised highlight with it
  const previewKey = touch?.previewKey;
  useEffect(() => {
    if (touch && previewKey == null) setPicked(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);
  const onMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.pointerType !== 'mouse' || chooser) return;
    const at = local(e);
    const hit = at ? near(screen, at.x, at.y, PICK)[0] : undefined;
    setHover(hit ? hit.s.pt.key : null);
  };
  const onClick = (e: ReactMouseEvent<SVGRectElement>) => {
    const at = local(e);
    if (!at) return;
    const hits = near(screen, at.x, at.y, PICK);
    if (!hits.length) {
      setChooser(null);
      if (touch) {
        setPicked(null);
        touch.onPreview(null);
      }
      return;
    }
    // Overlapping dots under the cursor: let the viewer choose. An isolated nearest point opens directly.
    const nearest = hits[0];
    const cluster = hits.filter((h) => h.d <= Math.max(12, nearest.s.r * 2 + 2));
    if (cluster.length > 1) {
      setHover(null);
      setPicked(nearest.s.pt.key);
      setChooser({ x: at.x, y: at.y, items: cluster.slice(0, 12).map((h) => h.s.pt) });
    } else open(nearest.s.pt);
  };
  const ARROWS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
  const onKey = (pt: LPoint, e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(pt);
      return;
    }
    const from = screenByKey.get(pt.key);
    let to: Screen | null | undefined = null;
    if (e.key === 'Home' || e.key === 'End') {
      const sorted = [...screen].sort((a, b) => a.cx - b.cx);
      to = e.key === 'Home' ? sorted[0] : sorted[sorted.length - 1];
    } else if (ARROWS.includes(e.key)) {
      to = from ? step(screen, from, e.key) : null;
    } else return;
    e.preventDefault();
    if (to) pointsRef.current?.querySelector<SVGGElement>(`[data-rk="${CSS.escape(to.pt.key)}"]`)?.focus();
  };
  // Touch gestures (touch mode): two fingers pinch / pan; one finger pans only while zoomed (else the page scrolls)
  const gestureRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const plotRef = useRef(plot);
  plotRef.current = plot;
  useEffect(() => {
    const el = gestureRef.current;
    if (!touch || !el) return;
    type G = { mode: 'pinch' | 'pan' | 'maybe-pan'; start: ScatterView; ax: number; ay: number; d: number; mx: number; my: number };
    let g: G | null = null;
    let raf = 0;
    let next: ScatterView | null = null;
    const flush = () => {
      raf = 0;
      if (next) setView(next);
      next = null;
    };
    const push = (v: ScatterView) => {
      next = clampView(v);
      viewRef.current = next;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    // Screen point -> fraction of the plot box (y measured from the bottom unless the axis is inverted)
    const frac = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const [l, t, rr, b] = plotRef.current;
      const fxs = (x - r.left - l) / (rr - l || 1);
      const fys = spec.yInvert ? (y - r.top - t) / (b - t || 1) : (b - (y - r.top)) / (b - t || 1);
      return [fxs, fys] as const;
    };
    const mid = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
    };
    const begin = (e: TouchEvent) => {
      const v = viewRef.current;
      if (e.touches.length >= 2) {
        const m = mid(e);
        const [fa, fb] = frac(m.x, m.y);
        g = { mode: 'pinch', start: v, ax: v.u0 + fa * (v.u1 - v.u0), ay: v.v0 + fb * (v.v1 - v.v0), d: m.d, mx: m.x, my: m.y };
        if (e.cancelable) e.preventDefault();
      } else if (e.touches.length === 1 && isZoomed(v)) {
        const t = e.touches[0];
        g = { mode: 'maybe-pan', start: v, ax: 0, ay: 0, d: 0, mx: t.clientX, my: t.clientY };
      } else g = null;
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      const pl = plotRef.current;
      const pw = pl[2] - pl[0] || 1;
      const ph = pl[3] - pl[1] || 1;
      if (g.mode === 'pinch' && e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        const m = mid(e);
        const k = g.d / m.d;
        const w = (g.start.u1 - g.start.u0) * k;
        const h = (g.start.v1 - g.start.v0) * k;
        const [fa, fb] = frac(m.x, m.y);
        const u0 = g.ax - fa * w;
        const v0 = g.ay - fb * h;
        push({ u0, u1: u0 + w, v0, v1: v0 + h });
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - g.mx;
      const dy = t.clientY - g.my;
      if (g.mode === 'maybe-pan') {
        if (Math.hypot(dx, dy) < 8) return;
        g.mode = 'pan';
      }
      if (g.mode !== 'pan') return;
      if (e.cancelable) e.preventDefault();
      const s0 = g.start;
      const du = (-dx / pw) * (s0.u1 - s0.u0);
      const dv = ((spec.yInvert ? -dy : dy) / ph) * (s0.v1 - s0.v0);
      push({ u0: s0.u0 + du, u1: s0.u1 + du, v0: s0.v0 + dv, v1: s0.v1 + dv });
    };
    const end = (e: TouchEvent) => {
      if (!g) return;
      // Lifting one finger of a pinch: carry on as a one-finger pan from here
      if (g.mode === 'pinch' && e.touches.length === 1 && isZoomed(viewRef.current)) {
        const t = e.touches[0];
        g = { mode: 'pan', start: viewRef.current, ax: 0, ay: 0, d: 0, mx: t.clientX, my: t.clientY };
        return;
      }
      if (e.touches.length === 0) g = null;
    };
    // iOS: keep Safari's own page zoom out of the chart
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', begin, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('gesturestart', stopGesture);
    return () => {
      el.removeEventListener('touchstart', begin);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('gesturestart', stopGesture);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [touch, spec.yInvert, geo != null]);
  const resetZoom = useCallback(() => setView(FULL), []);
  const zoomBy = useCallback((k: number) => {
    const v = viewRef.current;
    const cu = (v.u0 + v.u1) / 2;
    const cv = (v.v0 + v.v1) / 2;
    const w = (v.u1 - v.u0) * k;
    const h = (v.v1 - v.v0) * k;
    setView(clampView({ u0: cu - w / 2, u1: cu + w / 2, v0: cv - h / 2, v1: cv + h / 2 }));
  }, []);
  const clipId = `ls-clip-${useMemo(() => Math.random().toString(36).slice(2, 8), [])}`;
  const clip = touch ? `url(#${clipId})` : undefined;

  const raised = [hover, picked !== hover ? picked : null].map((k) => (k ? screenByKey.get(k) : undefined)).filter((x): x is Screen => !!x);

  const q = spec.quadrants;
  const qStyle = { fill: GOLD, fillOpacity: 0.8, fontSize: narrow ? 10 : 12, fontWeight: 800, letterSpacing: 1 } as const;
  const fmtTick = (t: number) => fmtShort(t);

  return (
    <div ref={boxRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {geo && (
        <div ref={gestureRef} className="relative" style={touch ? { touchAction: zoomed ? 'none' : 'pan-x pan-y' } : undefined}>
          <svg ref={svgRef} width={width} height={height} role="group" aria-label={ariaLabel} className="rv-chart-in block select-none">
            {touch && (
              <defs>
                <clipPath id={clipId}>
                  <rect x={plot[0]} y={plot[1]} width={Math.max(0, plot[2] - plot[0])} height={Math.max(0, plot[3] - plot[1])} />
                </clipPath>
              </defs>
            )}
            {/* Grid + axes */}
            <g aria-hidden="true">
              {geo.xTicks.map((t) => (
                <g key={`x${t}`}>
                  <line x1={geo.X(t)} x2={geo.X(t)} y1={plot[1]} y2={plot[3]} stroke={VIZ.grid} />
                  <text x={geo.X(t)} y={plot[3] + 16} textAnchor="middle" fontSize={touch ? 12 : 11} fill={VIZ.muted}>
                    {fmtTick(t)}
                  </text>
                </g>
              ))}
              {geo.yTicks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={plot[0]} x2={plot[2]} y1={geo.Y(t)} y2={geo.Y(t)} stroke={VIZ.grid} />
                  <text x={plot[0] - 6} y={geo.Y(t) + 4} textAnchor="end" fontSize={touch ? 12 : 11} fill={VIZ.muted}>
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
                  <g clipPath={clip}>
                  <rect x={geo.X(geo.sx)} y={plot[1]} width={Math.max(plot[2] - geo.X(geo.sx), 0)} height={Math.max(geo.Y(geo.sy) - plot[1], 0)} fill={GOLD} fillOpacity={0.045} />
                  <line x1={geo.X(geo.sx)} x2={geo.X(geo.sx)} y1={plot[1]} y2={plot[3]} stroke={spec.xSplit ? GOLD : VIZ.muted} strokeOpacity={spec.xSplit ? 0.8 : 0.6} strokeDasharray="5 4" />
                  <line x1={plot[0]} x2={plot[2]} y1={geo.Y(geo.sy)} y2={geo.Y(geo.sy)} stroke={spec.ySplit ? GOLD : VIZ.muted} strokeOpacity={spec.ySplit ? 0.8 : 0.6} strokeDasharray="5 4" />
                  </g>
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
                <g clipPath={clip}>
                  <line x1={geo.X(geo.ax.domain[0])} y1={geo.Y(geo.ax.domain[0])} x2={geo.X(geo.ax.domain[1])} y2={geo.Y(geo.ax.domain[1])} stroke={VIZ.ink} strokeOpacity={0.35} strokeWidth={1.5} />
                  <text x={geo.X(geo.ax.domain[1]) - 4} y={geo.Y(geo.ax.domain[1]) + 14} textAnchor="end" fontSize={10} fill={VIZ.muted}>
                    y = x
                  </text>
                </g>
              )}
              {geo.trendLine && geo.fit && (
                <>
                  <line {...geo.trendLine} clipPath={clip} stroke={VIZ.ink} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="8 5" />
                  <g transform={`translate(${(plot[0] + plot[2]) / 2} ${plot[1] + 4})`}>
                    <rect x={-34} y={0} width={68} height={18} rx={4} fill={VIZ.surface} stroke={VIZ.axis} />
                    <text x={0} y={13} textAnchor="middle" fontSize={11} fontWeight={700} fill={VIZ.ink} className="font-mono">
                      r = {geo.fit.r.toFixed(2)}
                    </text>
                  </g>
                </>
              )}
            </g>

            {zones && zoneShapes.length > 0 && (
              <g pointerEvents="none" clipPath={clip}>
                <FamilyZoneLayer zones={zoneShapes} fams={zones.fams} active={famActive} onHover={() => {}} onOpen={() => {}} />
              </g>
            )}

            <g ref={pointsRef} pointerEvents="none" clipPath={clip}>
              {screen.map(({ pt, cx, cy, r }) => (
                <g key={pt.key} className="fz-dot" opacity={famActive != null && famOf(pt.key) !== famActive ? 0.18 : 1}>
                  <PointMark
                    pt={pt}
                    cx={cx}
                    cy={cy}
                    r={r}
                    logo={logos ? resolveTeam(pt.player.team)?.logoUrl ?? null : null}
                    highlight={pt.key === highlightKey}
                    onSelect={() => open(pt)}
                    onShow={setHover}
                    onKey={(e) => onKey(pt, e)}
                  />
                </g>
              ))}
            </g>

            {/* Hovered / picked point raised on top and enlarged */}
            <g aria-hidden="true" pointerEvents="none" clipPath={clip}>
              {raised.map(({ pt, cx, cy, r }) => (
                <PointShape key={pt.key} pt={pt} cx={cx} cy={cy} r={r + 2.5} logo={logos ? resolveTeam(pt.player.team)?.logoUrl ?? null : null} raised />
              ))}
            </g>

            {/* Nearest-point picking surface: hover or click anywhere near a dot */}
            <rect
              aria-hidden="true"
              data-pick-surface=""
              x={0}
              y={0}
              width={width}
              height={height}
              fill="transparent"
              className={hover ? 'cursor-pointer' : undefined}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              onClick={onClick}
            />

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
              {zones && zoneShapes.length > 0 && (
                <FamilyZoneLabels zones={zoneShapes} fams={zones.fams} toScreen={(x, y) => [x, y]} dots={screen.map((d) => ({ x: d.cx, y: d.cy, r: d.r }))} W={width} H={height} active={famActive} small={narrow} />
              )}
              {hovered && !labelled.has(hovered.key) && (
                <text x={geo.X(hovered.x) + 9} y={geo.Y(hovered.y) - 8} fontSize={11} fontWeight={700} fill={GOLD} stroke={VIZ.surface} strokeWidth={3} paintOrder="stroke">
                  {hovered.player.name}
                </text>
              )}
            </g>
          </svg>
          {touch && (
            <div className="mt-1 flex items-center gap-1.5">
              <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
                {zoomed ? 'Drag to move around · pinch to zoom' : 'Tap a dot · pinch with two fingers to zoom'}
              </p>
              {zoomed && (
                <button
                  type="button"
                  onClick={resetZoom}
                  className="inline-flex h-11 items-center rounded-full border border-gold/60 bg-night/90 px-3 font-display text-xs font-bold uppercase tracking-wide text-gold"
                >
                  Reset zoom
                </button>
              )}
              <button type="button" onClick={() => zoomBy(1.6)} disabled={!zoomed} aria-label="Zoom out" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-night/90 text-lg font-bold text-foreground disabled:opacity-35">
                −
              </button>
              <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom in" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-night/90 text-lg font-bold text-foreground">
                +
              </button>
            </div>
          )}
        </div>
      )}
      {chooser && <ClusterChooser at={chooser} items={chooser.items} width={width} onPick={open} onClose={() => setChooser(null)} />}
      {hovered && geo && !chooser && (
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
          {zones && famOf(hovered.key) != null && (
            <p className="mt-0.5 text-muted-foreground">
              Family: <b style={{ color: zones.fams.families[famOf(hovered.key)!].color }}>{zones.fams.families[famOf(hovered.key)!].name}</b>
            </p>
          )}
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
