/**
 * Zone geometry for family overlays (CompMap, the Graph Builder scatter): a soft, rounded region around each
 * family's core members, and a label spot per zone that never collides with another label. Pure and deterministic.
 *
 * Groups: a family's dots split into single-linkage groups (gap ≤ `link`), so a region never bridges empty map.
 * Region: each dot is padded into a ring of points, the convex hull of a group's rings is taken (Andrew's
 * monotone chain), thinned and drawn as a closed Catmull-Rom curve.
 */

export interface ZonePoint {
  key: string;
  x: number;
  y: number;
  /** Dot radius (the zone pads past it). */
  r?: number;
}

export interface ZoneShape {
  id: number;
  /** SVG path (closed) in the same coordinates as the points. */
  d: string;
  /** Mean of the core points: where the label wants to sit. */
  cx: number;
  cy: number;
  /** Top and bottom edge of the labelled group's region. */
  top: number;
  bottom: number;
  /** Members in the labelled (largest) group. */
  core: number;
}

const RING = 10;

const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export const convexHull = (pts: number[][]) => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: number[][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: number[][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};

/** Drops hull vertices closer than `min` to the previous kept one (near-duplicates make the curve kink). */
const thin = (pts: number[][], min: number) => {
  const out: number[][] = [];
  pts.forEach((p) => {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= min) out.push(p);
  });
  while (out.length > 3 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < min) out.pop();
  return out;
};

/**
 * Closed Catmull-Rom spline through the points, as cubic Béziers. Each control arm is capped at a third of its
 * segment, so a short edge next to a long one never overshoots into a spike.
 */
export const closedCurve = (pts: number[][]) => {
  const n = pts.length;
  if (!n) return '';
  const f = (v: number) => v.toFixed(1);
  const arm = (dx: number, dy: number, seg: number) => {
    const len = Math.hypot(dx, dy) / 6;
    const cap = seg / 3;
    const k = len > cap && len > 0 ? cap / len : 1;
    return [(dx / 6) * k, (dy / 6) * k];
  };
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const a1 = arm(p2[0] - p0[0], p2[1] - p0[1], seg);
    const a2 = arm(p3[0] - p1[0], p3[1] - p1[1], seg);
    d += ` C${f(p1[0] + a1[0])},${f(p1[1] + a1[1])} ${f(p2[0] - a2[0])},${f(p2[1] - a2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return `${d} Z`;
};

/** Rounded region around a set of dots: padded rings → convex hull → thinned → smoothed. */
const blob = (pts: ZonePoint[], pad: number) => {
  const ring = pts.flatMap((p) => {
    const rr = (p.r ?? 0) + pad;
    return Array.from({ length: RING }, (_, k) => {
      const a = (2 * Math.PI * k) / RING;
      return [p.x + rr * Math.cos(a), p.y + rr * Math.sin(a)];
    });
  });
  return closedCurve(thin(convexHull(ring), pad * 0.45));
};

/**
 * One zone per family id that has points. A family whose members sit apart on the map (single-linkage gaps wider
 * than `link`) gets one region per group, so every member is covered and no region bridges empty space; the
 * label goes on the largest group. `pad` is the margin past each dot.
 */
export const buildZones = (points: ZonePoint[], familyOf: (key: string) => number | undefined, pad: number, link: number): ZoneShape[] => {
  const groups = new Map<number, ZonePoint[]>();
  points.forEach((p) => {
    const id = familyOf(p.key);
    if (id == null) return;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(p);
  });
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, pts]) => {
      // Single-linkage components (union-find), in input order.
      const parent = pts.map((_, i) => i);
      const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const gap = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) - (pts[i].r ?? 0) - (pts[j].r ?? 0);
          if (gap <= link) parent[find(j)] = find(i);
        }
      const comps = new Map<number, ZonePoint[]>();
      pts.forEach((p, i) => {
        const r = find(i);
        if (!comps.has(r)) comps.set(r, []);
        comps.get(r)!.push(p);
      });
      const pieces = [...comps.values()].sort((a, b) => b.length - a.length);
      const main = pieces[0];
      const xs = main.map((p) => p.x);
      const ys = main.map((p) => p.y);
      return {
        id,
        d: pieces.map((c) => blob(c, pad)).join(' '),
        cx: xs.reduce((s, x) => s + x, 0) / xs.length,
        cy: ys.reduce((s, y) => s + y, 0) / ys.length,
        top: Math.min(...main.map((p) => p.y - (p.r ?? 0))) - pad,
        bottom: Math.max(...main.map((p) => p.y + (p.r ?? 0))) + pad,
        core: main.length,
      };
    });
};

export interface ZoneLabel {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box, m = 3) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

/**
 * Greedy label placement (largest family first): each label tries its zone's centroid, then just above and just
 * below the zone, keeping the first spot that covers no dot and no placed label; failing that it steps away from
 * the centroid until it clears the other labels. Boxes stay inside [0, W] × [0, H].
 */
export const placeZoneLabels = (
  items: { id: number; cx: number; cy: number; top: number; bottom: number; w: number; h: number }[],
  dots: { x: number; y: number; r: number }[],
  W: number,
  H: number,
): ZoneLabel[] => {
  const placed: ZoneLabel[] = [];
  // Defensive: a caller on an older signature (e.g. mid hot-reload) must not crash the chart.
  const obstacles = Array.isArray(dots) ? dots : [];
  const clamp = (b: ZoneLabel): ZoneLabel => ({ ...b, x: Math.max(2, Math.min(W - b.w - 2, b.x)), y: Math.max(2, Math.min(H - b.h - 2, b.y)) });
  const hitsLabel = (b: Box) => placed.some((o) => overlap(b, o));
  const hitsDot = (b: Box) => obstacles.some((d) => overlap(b, { x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r }, 1));
  items.forEach((it) => {
    const at = (cx: number, cy: number) => clamp({ id: it.id, w: it.w, h: it.h, x: cx - it.w / 2, y: cy - it.h / 2 });
    const cands = [at(it.cx, it.cy), at(it.cx, it.top - it.h / 2 - 2), at(it.cx, it.bottom + it.h / 2 + 2)];
    let best = cands.find((c) => !hitsLabel(c) && !hitsDot(c)) ?? cands.find((c) => !hitsLabel(c));
    for (let k = 1; !best && k <= 24; k++) {
      const step = Math.ceil(k / 4) * (it.h + 4);
      const dir = k % 4;
      const c = at(it.cx + (dir === 2 ? step * 1.5 : dir === 3 ? -step * 1.5 : 0), it.cy + (dir === 0 ? step : dir === 1 ? -step : 0));
      if (!hitsLabel(c)) best = c;
    }
    placed.push(best ?? cands[0]);
  });
  return placed;
};
