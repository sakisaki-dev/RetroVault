import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

/**
 * Shared zoom + pan for SVG plots. Zoom is semantic: the hook returns the visible x / y domains, so the chart redraws
 * its axes and ticks crisply and its marks keep their screen size (clusters spread apart). Gestures: two fingers pinch
 * around the pinch centre (and pan with the midpoint), one finger pans only while zoomed (otherwise the page scrolls),
 * double-tap zooms in around the point and again resets, the wheel zooms around the cursor. Taps are reported through
 * `onTap` with the point in viewBox units, so a chart can pick the nearest marks or a cluster of them.
 *
 * Domains are numeric with y growing upward (invert a rank axis by negating it). `lockY` zooms x only (line charts).
 */

export interface ZoomBox {
  /** viewBox size */
  W: number;
  H: number;
  /** plot margins in viewBox units */
  l: number;
  t: number;
  r: number;
  b: number;
}

interface Win {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const FULL: Win = { x0: 0, x1: 1, y0: 0, y1: 1 };
const MAX_ZOOM = 40;

export interface TapInfo {
  clientX: number;
  clientY: number;
  /** viewBox units */
  vx: number;
  vy: number;
  /** viewBox units per CSS pixel */
  unit: number;
  pointerType: string;
}

export interface ChartZoom {
  dx: [number, number];
  dy: [number, number];
  zoomed: boolean;
  /** how far in (1 = whole data) */
  k: number;
  reset: () => void;
  zoomBy: (factor: number) => void;
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function useChartZoom(opts: {
  svgRef: RefObject<SVGSVGElement | null>;
  box: ZoomBox;
  domX: [number, number];
  domY: [number, number];
  /** a new chart (other axes, filters) starts unzoomed */
  resetKey?: unknown;
  lockY?: boolean;
  onTap?: (t: TapInfo) => void;
  /** a double tap started: close anything the first tap opened */
  onDoubleTap?: () => void;
}): ChartZoom {
  const { svgRef, box, domX, domY, resetKey, lockY } = opts;
  const [win, setWin] = useState<Win>(FULL);
  const winRef = useRef<Win>(FULL);
  const raf = useRef(0);
  const anim = useRef(0);
  const live = useRef(opts);
  live.current = opts;
  const boxRef = useRef(box);
  boxRef.current = box;

  const commit = useCallback((w: Win) => {
    winRef.current = w;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      setWin(winRef.current);
    });
  }, []);

  const norm = useCallback(
    (w: Win): Win => {
      let wx = clamp(w.x1 - w.x0, 1 / MAX_ZOOM, 1);
      let wy = clamp(w.y1 - w.y0, 1 / MAX_ZOOM, 1);
      if (live.current.lockY) wy = 1;
      const x0 = clamp(w.x0, 0, 1 - wx);
      const y0 = live.current.lockY ? 0 : clamp(w.y0, 0, 1 - wy);
      wx = Math.min(wx, 1);
      return { x0, x1: x0 + wx, y0, y1: y0 + wy };
    },
    [],
  );

  const animateTo = useCallback(
    (to: Win) => {
      cancelAnimationFrame(anim.current);
      const target = norm(to);
      if (reducedMotion()) {
        commit(target);
        return;
      }
      const from = winRef.current;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 170);
        const e = 1 - (1 - p) ** 3;
        const lerp = (a: number, b: number) => a + (b - a) * e;
        commit({ x0: lerp(from.x0, target.x0), x1: lerp(from.x1, target.x1), y0: lerp(from.y0, target.y0), y1: lerp(from.y1, target.y1) });
        if (p < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [commit, norm],
  );

  /** zoom so the window shrinks by `f` about the plot fraction (fx, fy from the left / bottom) */
  const zoomAbout = useCallback(
    (f: number, fx: number, fy: number, base: Win = winRef.current, animate = false): Win => {
      const wx = (base.x1 - base.x0) / f;
      const wy = (base.y1 - base.y0) / f;
      const px = base.x0 + fx * (base.x1 - base.x0);
      const py = base.y0 + fy * (base.y1 - base.y0);
      const next = norm({ x0: px - fx * wx, x1: px - fx * wx + wx, y0: py - fy * wy, y1: py - fy * wy + wy });
      if (animate) animateTo(next);
      else commit(next);
      return next;
    },
    [animateTo, commit, norm],
  );

  const reset = useCallback(() => animateTo(FULL), [animateTo]);
  const zoomBy = useCallback((factor: number) => zoomAbout(factor, 0.5, 0.5, winRef.current, true), [zoomAbout]);

  useEffect(() => {
    cancelAnimationFrame(anim.current);
    winRef.current = FULL;
    setWin(FULL);
  }, [resetKey]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(anim.current);
    },
    [],
  );

  const isZoomed = win.x1 - win.x0 < 0.999 || win.y1 - win.y0 < 0.999;
  const zoomedRef = useRef(isZoomed);
  zoomedRef.current = isZoomed;

  // The page keeps its vertical scroll until the plot is zoomed; the tab swipe leaves the plot alone
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.style.touchAction = isZoomed ? 'none' : 'pan-y';
    el.style.cursor = isZoomed ? 'grab' : '';
    el.setAttribute('data-no-swipe', '');
  });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; mx: number; my: number; w: Win } | null = null;
    let pan: { x: number; y: number; w: Win } | null = null;
    let tap: { x: number; y: number; t: number; type: string } | null = null;
    let last: { x: number; y: number; t: number } | null = null;
    let sup = false;

    const rect = () => el.getBoundingClientRect();
    /** a client point as plot fractions (from the left, from the bottom) */
    const frac = (cx: number, cy: number) => {
      const r = rect();
      const b = boxRef.current;
      const vx = ((cx - r.left) / r.width) * b.W;
      const vy = ((cy - r.top) / r.height) * b.H;
      return { vx, vy, fx: clamp((vx - b.l) / (b.W - b.l - b.r), 0, 1), fy: clamp(1 - (vy - b.t) / (b.H - b.t - b.b), 0, 1), unit: b.W / r.width };
    };
    const plotPx = () => {
      const r = rect();
      const b = boxRef.current;
      return { w: ((b.W - b.l - b.r) / b.W) * r.width, h: ((b.H - b.t - b.b) / b.H) * r.height };
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(anim.current);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        tap = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType };
        pan = zoomedRef.current ? { x: e.clientX, y: e.clientY, w: winRef.current } : null;
      } else if (pts.size === 2) {
        tap = null;
        pan = null;
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, w: winRef.current };
      }
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pinch && pts.size >= 2) {
        e.preventDefault();
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const f = d / pinch.d;
        const s = frac(pinch.mx, pinch.my);
        const c = frac(mx, my);
        const w0 = pinch.w;
        const wx = (w0.x1 - w0.x0) / f;
        const wy = (w0.y1 - w0.y0) / f;
        const px = w0.x0 + s.fx * (w0.x1 - w0.x0);
        const py = w0.y0 + s.fy * (w0.y1 - w0.y0);
        commit(norm({ x0: px - c.fx * wx, x1: px - c.fx * wx + wx, y0: py - c.fy * wy, y1: py - c.fy * wy + wy }));
        return;
      }
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null;
      if (pan && pts.size === 1 && !tap) {
        e.preventDefault();
        if (!sup) {
          sup = true;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* the pointer is gone */
          }
        }
        const pp = plotPx();
        const w = pan.w;
        const wx = w.x1 - w.x0;
        const wy = w.y1 - w.y0;
        const x0 = w.x0 - ((e.clientX - pan.x) / pp.w) * wx;
        const y0 = w.y0 + ((e.clientY - pan.y) / pp.h) * wy;
        commit(norm({ x0, x1: x0 + wx, y0, y1: y0 + wy }));
      }
    };
    const up = (e: PointerEvent) => {
      const had = pts.delete(e.pointerId);
      if (!had) return;
      const wasPinch = !!pinch;
      if (pts.size < 2) pinch = null;
      if (wasPinch && pts.size === 1) {
        // carry on as a one-finger pan from here
        const [rest] = [...pts.values()];
        pan = zoomedRef.current ? { x: rest.x, y: rest.y, w: winRef.current } : null;
        tap = null;
        return;
      }
      sup = false;
      if (pts.size) return;
      pan = null;
      const t = tap;
      tap = null;
      if (!t || e.type === 'pointercancel' || performance.now() - t.t > 450) {
        last = null;
        return;
      }
      const now = performance.now();
      const f = frac(e.clientX, e.clientY);
      if (last && now - last.t < 320 && Math.hypot(last.x - e.clientX, last.y - e.clientY) < 28) {
        last = null;
        live.current.onDoubleTap?.();
        if (zoomedRef.current) animateTo(FULL);
        else zoomAbout(2.6, f.fx, f.fy, winRef.current, true);
        return;
      }
      last = { x: e.clientX, y: e.clientY, t: now };
      live.current.onTap?.({ clientX: e.clientX, clientY: e.clientY, vx: f.vx, vy: f.vy, unit: f.unit, pointerType: e.pointerType });
    };
    const cancel = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!pts.size) {
        tap = null;
        pan = null;
        sup = false;
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const f = frac(e.clientX, e.clientY);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAbout(Math.exp(clamp(-dy, -120, 120) * 0.0035), f.fx, f.fy);
    };
    // a tap is the chart's own business (nearest mark or a cluster): a mark's native click must not also fire
    const click = (e: MouseEvent) => {
      if (e.detail === 0) return; // keyboard activation
      e.stopPropagation();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('click', click, true);
    };
    // the svg element can swap when a chart changes size: listeners follow it
  }, [svgRef, svgRef.current, commit, norm, zoomAbout, animateTo]);

  const dx = useMemo<[number, number]>(() => [domX[0] + win.x0 * (domX[1] - domX[0]), domX[0] + win.x1 * (domX[1] - domX[0])], [domX, win]);
  const dy = useMemo<[number, number]>(() => [domY[0] + win.y0 * (domY[1] - domY[0]), domY[0] + win.y1 * (domY[1] - domY[0])], [domY, win]);
  const k = 1 / Math.max(1e-6, win.x1 - win.x0);
  return { dx, dy, zoomed: isZoomed, k, reset, zoomBy };
}

/** Marks within `radius` viewBox units of a point, nearest first (at most `max`). */
export function nearestMarks<T>(items: T[], at: (t: T) => { x: number; y: number } | null, vx: number, vy: number, radius: number, max = 8): { item: T; d: number }[] {
  const out: { item: T; d: number }[] = [];
  items.forEach((item) => {
    const p = at(item);
    if (!p) return;
    const d = Math.hypot(p.x - vx, p.y - vy);
    if (d <= radius) out.push({ item, d });
  });
  return out.sort((a, b) => a.d - b.d).slice(0, max);
}

/** Tap radius in CSS pixels: a fingertip on a phone, a cursor on a desktop. */
export const tapRadiusPx = (pointerType: string) => (pointerType === 'mouse' || pointerType === 'pen' ? 10 : 24);
