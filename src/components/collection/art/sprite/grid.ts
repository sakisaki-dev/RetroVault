/**
 * Sprite pixel grid: shared types, constants and drawing primitives for every sprite module.
 *
 *   Sprite pixels: x −4…54 (PIX_X … PIX_X + PIX_W), y 0…64 (PIX_H); turf from y = GROUND (59). The figure stands
 *   around x = 22. Rects are [x, y, w, h, key] in sprite pixels; fractional (multiples of 1/F) for fine detail.
 *   Fine grid: F cells per sprite pixel (render.ts rasterises at F×); helmet logos and number outlines use it.
 *   Keys are colour slots (one or two letters) mapped to colours by render.ts colours().
 */
export type Key = string;
export type Rect = [number, number, number, number, Key];
export type Pt = [number, number];

export const PIX_X = -4;
export const PIX_W = 58;
export const PIX_H = 64;
export const GROUND = 59;
/** Fine cells per sprite pixel */
export const F = 2;

/** Thick pixel line from a to b (a t × t square stamped along a Bresenham line), between fractions from…to. */
export const line = ([x0, y0]: Pt, [x1, y1]: Pt, t: number, k: Key, from = 0, to = 1, off: Pt = [0, 0]): Rect[] => {
  const out: Rect[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  const steps = Math.max(dx, -dy) || 1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const o = Math.floor(t / 2);
  for (let i = 0; ; i++) {
    const f = i / steps;
    if (f >= from && f <= to) out.push([x - o + off[0], y - o + off[1], t, t, k]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
};

/** A string template (one char per pixel, '.' = empty) at (x, y), chars mapped to keys. */
export const stamp = (rows: string[], x: number, y: number, map: Record<string, Key> = {}): Rect[] => {
  const out: Rect[] = [];
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && out.push([x + i, y + j, 1, 1, map[ch] ?? ch])));
  return out;
};

export const FAR: Record<string, Key> = { s: 'x', J: 'y', P: 'z', K: 'q', u: 'x' };

export const set = (R: Rect[], x: number, y: number, k: Key) => R.push([x, y, 1, 1, k]);
export const span = (R: Rect[], x0: number, x1: number, y: number, k: Key = 'r') => {
  for (let x = x0; x <= x1; x++) set(R, x, y, k);
};
export const shade = (hex: string, f: number) => `color-mix(in srgb, ${hex} ${Math.round(f * 100)}%, #000)`;
export const tint = (hex: string, f: number) => `color-mix(in srgb, ${hex} ${Math.round(f * 100)}%, #fff)`;
