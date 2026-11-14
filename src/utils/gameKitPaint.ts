import { homeUniform, pantsBands, sleeveBands, sockBands } from '@/components/collection/art/sprite/uniforms';

/**
 * The kit painter for the owner's private NFL Retro Bowl sprites (gameSprites.ts; loaded only on this Mac when a
 * sprite needs it). The save draws every player's neutral kit (800) on one fixed body template: the same pixels in the
 * same rows for every player and every pose, in three colours. Measured over the Y93 save's 484 neutral sprites (the
 * kit pixels agree at 90% or more between players, the rest are arm-dependent):
 *
 *   #bfbfbf  base cloth       #8f8f8f  its shading       #fbfffd  trim (shoulder caps, collar, belt, pants stripe, socks)
 *
 * Rows of the 64 x 64 frame (the body starts at row 27 whatever the head): 27-40 jersey and sleeves, 41-51 pants,
 * 52-55 socks, 56-58 shoes. Painting maps each colour by its row band into the club's home kit (uniforms.ts, the same
 * palette as the regular-game fallback): jersey, its shade and the sleeve stripe; pants, their shade and stripe;
 * socks. Skin, hair, shoes, gloves (#ffffff), the ball and outlines keep their own colours. The same pass reshapes the
 * body to his roll (`reshape`, below; src/config/bodyTypes.ts). No art lives here.
 */

const BASE = 0xbfbfbf;
const SHADE = 0x8f8f8f;
const TRIM = 0xfbfffd;
const BODY_TOP = 27;
const PANTS_TOP = 41;
const SOCKS_TOP = 52;
const SHOES_TOP = 56;

type RGB = [number, number, number];

let probe: CanvasRenderingContext2D | null = null;
const rgbOf = (c: string): RGB => {
  probe ??= document.createElement('canvas').getContext('2d');
  if (!probe) return [128, 128, 128];
  probe.fillStyle = '#808080';
  probe.fillStyle = c;
  const v = String(probe.fillStyle);
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/(\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
};
const shade = ([r, g, b]: RGB, f: number): RGB =>
  (f >= 0 ? [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f] : [r * (1 + f), g * (1 + f), b * (1 + f)]).map(Math.round) as RGB;

const paletteFor = (team: string) => {
  const u = homeUniform(team);
  const jersey = rgbOf(u.jersey);
  const pants = rgbOf(u.pants);
  const sleeve = sleeveBands(u).find(([c]) => c)?.[0] ?? u.trim;
  const pantsStripe = pantsBands(u)[0];
  return {
    jersey: { [BASE]: jersey, [SHADE]: shade(jersey, -0.32), [TRIM]: rgbOf(sleeve) } as Record<number, RGB>,
    pants: { [BASE]: pants, [SHADE]: shade(pants, -0.3), [TRIM]: pantsStripe ? rgbOf(pantsStripe) : shade(pants, 0.35) } as Record<number, RGB>,
    socks: { [TRIM]: rgbOf(u.socks), [BASE]: rgbOf(sockBands(u)[0] ?? u.socks), [SHADE]: shade(rgbOf(u.socks), -0.3) } as Record<number, RGB>,
  };
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('sprite'));
    img.src = src;
  });

/** Paints the neutral kit's three colours, row band by row band, into `team`'s home kit (in place). */
const paintPixels = (px: Uint8ClampedArray, w: number, h: number, team: string) => {
  const pal = paletteFor(team);
  for (let y = BODY_TOP; y < Math.min(SHOES_TOP, h); y++) {
    const band = y < PANTS_TOP ? pal.jersey : y < SOCKS_TOP ? pal.pants : pal.socks;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 255) continue;
      const to = band[(px[i] << 16) | (px[i + 1] << 8) | px[i + 2]];
      if (to) [px[i], px[i + 1], px[i + 2]] = to;
    }
  }
};

/**
 * BODY RESHAPE (src/config/bodyTypes.ts rolls it): whole pixel rows and columns are repeated or dropped, never scaled,
 * so the sprite stays pixel-perfect. Every save sprite is drawn on one body template (all five poses, every kit, the
 * stand-ins), measured from his feet row `foot` (58) and centre line `cx` (31.5):
 *
 *   height  rows repeated (tall) or dropped (short), in this order: a thigh row (foot - 8, row 50), a chest row below
 *           the shoulders (foot - 27, row 31), a sock row (foot - 5, row 53). Everything above moves up or down as one
 *           piece, the head untouched; the feet stay on their row, so the baseline holds.
 *   build   one column a side repeated (broad) or dropped (lean), mirrored about the centre. Down to the shoulders
 *           (rows 0-33) columns cx - 8.5 and cx + 7.5 (23 and 39: just outside the head and long hair, inside the
 *           shoulder caps, so the shoulders, a raised arm or a ball move out while the head stays whole); in the
 *           chest and hips (rows 34-48, centred on column 31) cx - 5.5 and cx + 4.5 (26 and 36: inside the jersey, so
 *           the arms and hands move out with it); in the legs and shoes (rows 49 down, centred on 31.5) 26 and 37
 *           (inside each leg: thicker legs).
 *
 * The centre line and feet row don't move, so the anchors stay right and GameSprite's centring rules hold.
 */
const reshape = (src: Uint32Array, w: number, h: number, cx: number, foot: number, rows: number, cols: number): Uint32Array => {
  let cur = src;
  if (cols) {
    const out = new Uint32Array(w * h);
    const head = foot - 24;
    const legs = foot - 9;
    for (let y = 0; y < h; y++) {
      const [L, R] = y < head ? [cx - 8.5, cx + 7.5] : y < legs ? [cx - 5.5, cx + 4.5] : [cx - 5.5, cx + 5.5];
      for (let x = 0; x < w; x++) {
        let ox = x;
        if (x <= L) ox = cols > 0 ? Math.min(x + cols, L) : x + cols;
        else if (x >= R) ox = cols > 0 ? Math.max(x - cols, R) : x - cols;
        out[y * w + x] = ox >= 0 && ox < w ? cur[y * w + ox] : 0;
      }
    }
    cur = out;
  }
  if (rows) {
    const order = [foot - 8, foot - 27, foot - 5].slice(0, Math.abs(rows));
    const list: number[] = [];
    for (let y = 0; y < h; y++) {
      if (rows < 0 && order.includes(y)) continue;
      list.push(y);
      if (rows > 0 && order.includes(y)) list.push(y);
    }
    // keep the bottom (the feet) where it was: trim the empty top, or pad it
    while (list.length > h) list.shift();
    while (list.length < h) list.unshift(-1);
    const out = new Uint32Array(w * h);
    list.forEach((sy, y) => {
      if (sy >= 0) out.set(cur.subarray(sy * w, sy * w + w), y * w);
    });
    cur = out;
  }
  return cur;
};

export interface SpriteJob {
  /** Paint the neutral kit into this club's home kit */
  paint?: string;
  /** Rows added (+) / removed (-) and columns a side (bodyTypes.ts BodyRoll) */
  rows?: number;
  cols?: number;
  /** The figure's centre line and feet row (index anchors) */
  cx?: number;
  foot?: number;
}

const cache = new Map<string, Promise<string>>();
/** Most processed sprites kept (a formation, search and the Record Book stay well under it). */
const CACHE_MAX = 600;

/**
 * The sprite at `src` painted (job.paint) and reshaped to his body (job.rows, job.cols), as a data URL, cached per
 * sprite file x club x body (so per player key x kit x pose). Returns `src` itself when there is nothing to do.
 */
export const processSprite = (src: string, job: SpriteJob = {}): Promise<string> => {
  const rows = job.rows ?? 0;
  const cols = job.cols ?? 0;
  if (!job.paint && !rows && !cols) return Promise.resolve(src);
  const key = `${src}|${job.paint ?? ''}|${rows},${cols}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job2 = loadImage(src).then((img) => {
    const c = document.createElement('canvas');
    const w = (c.width = img.naturalWidth);
    const h = (c.height = img.naturalHeight);
    const ctx = c.getContext('2d');
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h);
    if (job.paint) paintPixels(data.data, w, h, job.paint);
    if (rows || cols) {
      const shaped = reshape(new Uint32Array(data.data.buffer), w, h, job.cx ?? 31.5, job.foot ?? 58, rows, cols);
      data.data.set(new Uint8ClampedArray(shaped.buffer));
    }
    ctx.putImageData(data, 0, 0);
    return c.toDataURL('image/png');
  });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, job2);
  job2.catch(() => cache.delete(key));
  return job2;
};

/** The neutral-kit sprite at `src` painted into `team`'s home kit, as a data URL (cached per sprite × club). */
export const paintNeutral = (src: string, team: string): Promise<string> => processSprite(src, { paint: team });
