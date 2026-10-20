import { useEffect, useState } from 'react';
import type { Key, Rect } from './sprite/grid';

/*
 * Sprite bitmaps: a sprite's pixel runs are painted ONCE into an offscreen canvas and shown as one image (a data
 * URL), instead of hundreds of SVG <rect>s per sprite. Bitmaps are cached by their full input key (LRU) and built
 * in idle time, so a lab tab or binder page full of sprites never blocks a click.
 */

// ---------- Colours (the sprite palette uses hex, hsl() and nested color-mix(in srgb, …)) ----------

type RGBA = [number, number, number, number];

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

/** Split at top-level commas */
const args = (s: string) => {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

let probe: CanvasRenderingContext2D | null = null;
const parsed = new Map<string, RGBA>();

const parse = (input: string): RGBA => {
  const c = input.trim();
  const hit = parsed.get(c);
  if (hit) return hit;
  let out: RGBA = [0, 0, 0, 1];
  let m: RegExpMatchArray | null;
  if ((m = c.match(/^#([0-9a-f]{3,8})$/i))) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((x) => x + x).join('');
    out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  } else if ((m = c.match(/^hsla?\((.*)\)$/i))) {
    const n = m[1].split(/[\s,/]+/).filter(Boolean).map((x) => parseFloat(x));
    out = [...hslToRgb(n[0], n[1], n[2]), n[3] ?? 1];
  } else if ((m = c.match(/^rgba?\((.*)\)$/i))) {
    const n = m[1].split(/[\s,/]+/).filter(Boolean).map((x) => parseFloat(x));
    out = [n[0], n[1], n[2], n[3] ?? 1];
  } else if ((m = c.match(/^color-mix\(\s*in srgb\s*,(.*)\)$/i))) {
    const [a, b] = args(m[1]).map((p) => {
      const pm = p.match(/^(.*?)\s+([\d.]+)%$/);
      return pm ? { col: parse(pm[1]), pct: parseFloat(pm[2]) } : { col: parse(p), pct: NaN };
    });
    const pa = Number.isNaN(a.pct) ? (Number.isNaN(b.pct) ? 50 : 100 - b.pct) : a.pct;
    const t = pa / 100;
    out = [0, 1, 2, 3].map((i) => a.col[i] * t + b.col[i] * (1 - t)) as RGBA;
  } else {
    // Named colours and anything else: let a canvas parse it
    if (!probe && typeof document !== 'undefined') probe = document.createElement('canvas').getContext('2d');
    if (probe) {
      probe.fillStyle = '#000';
      probe.fillStyle = c;
      return parse(String(probe.fillStyle) === c ? '#000' : String(probe.fillStyle));
    }
  }
  parsed.set(c, out);
  return out;
};

const css = ([r, g, b, a]: RGBA) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

// ---------- Paint + cache ----------

export interface Bitmap {
  url: string;
  /** Size in fine cells (the canvas size) */
  w: number;
  h: number;
  /** Crop offset in fine cells (0 unless cropped) */
  x: number;
  y: number;
}

/** Paint runs (fine-grid rects) into a canvas; crop to the drawn box when asked. */
export const paint = (runs: Rect[], colours: Record<Key, string>, w: number, h: number, crop = false, pad = 0): Bitmap => {
  let x0 = 0;
  let y0 = 0;
  let cw = w;
  let ch = h;
  if (crop && runs.length) {
    x0 = Math.min(...runs.map((r) => r[0])) - pad;
    y0 = Math.min(...runs.map((r) => r[1])) - pad;
    cw = Math.max(...runs.map((r) => r[0] + r[2])) + pad - x0;
    ch = Math.max(...runs.map((r) => r[1] + r[3])) + pad - y0;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, cw);
  canvas.height = Math.max(1, ch);
  const g = canvas.getContext('2d');
  if (!g) return { url: '', w: cw, h: ch, x: x0, y: y0 };
  const fills = new Map<Key, string>();
  runs.forEach(([x, y, rw, rh, k]) => {
    let f = fills.get(k);
    if (f === undefined) {
      f = colours[k] ? css(parse(colours[k])) : 'rgba(0,0,0,0)';
      fills.set(k, f);
    }
    g.fillStyle = f;
    g.fillRect(x - x0, y - y0, rw, rh);
  });
  return { url: canvas.toDataURL('image/png'), w: cw, h: ch, x: x0, y: y0 };
};

const MAX = 300;
const cache = new Map<string, Bitmap>();
const get = (key: string) => {
  const b = cache.get(key);
  if (b) {
    cache.delete(key);
    cache.set(key, b);
  }
  return b;
};
const put = (key: string, b: Bitmap) => {
  cache.set(key, b);
  if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
};

// ---------- Idle queue ----------

const queue = new Map<string, { make: () => Bitmap; done: Set<(b: Bitmap) => void> }>();
let scheduled = false;
type IdleDeadline = { timeRemaining: () => number };
const ric: (cb: (d: IdleDeadline) => void) => void =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => (window as unknown as { requestIdleCallback: (c: (d: IdleDeadline) => void, o: { timeout: number }) => void }).requestIdleCallback(cb, { timeout: 120 })
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 16);

const pump = (d: IdleDeadline) => {
  scheduled = false;
  let n = 0;
  for (const [key, job] of queue) {
    // At least one per callback, then while the frame has time
    if (n > 0 && d.timeRemaining() < 3) break;
    queue.delete(key);
    // Nobody waiting any more (scrolled away, tab switched): skip the work
    if (!job.done.size) continue;
    const b = get(key) ?? job.make();
    put(key, b);
    job.done.forEach((f) => f(b));
    n++;
  }
  if (queue.size) schedule();
};
const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  ric(pump);
};

/** Cached bitmap for `key` (built by `make` in idle time on a miss; null until then). */
export const useBitmap = (key: string, make: () => Bitmap): Bitmap | null => {
  const [state, setState] = useState<{ key: string; b: Bitmap | null }>(() => ({ key, b: get(key) ?? null }));
  const hit = state.key === key ? state.b : (get(key) ?? null);
  useEffect(() => {
    const b = get(key);
    if (b) {
      setState((s) => (s.key === key && s.b === b ? s : { key, b }));
      return;
    }
    const done = (x: Bitmap) => setState({ key, b: x });
    const job = queue.get(key);
    if (job) job.done.add(done);
    else queue.set(key, { make, done: new Set([done]) });
    schedule();
    return () => {
      queue.get(key)?.done.delete(done);
    };
    // make is recreated each render; the key covers its inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return hit;
};

/** Synchronous variant (cache hit, else build now): for the few places that must not flash a placeholder. */
export const bitmapNow = (key: string, make: () => Bitmap): Bitmap => {
  const b = get(key) ?? make();
  put(key, b);
  return b;
};
