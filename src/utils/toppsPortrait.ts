import { pantsBands, sleeveBands, sockBands, type Uniform } from '@/components/collection/art/sprite/uniforms';
import { processSprite } from './gameKitPaint';

/**
 * The 70s Topps card's printed portrait (VintageArt.tsx; owner, 2026-11-13: "perfect for the topps"): the player's
 * private game sprite (gameSprites.ts, the same pick as GameSprite) in the kit the pull rolled, cropped to head and
 * shoulders. Loaded only on this Mac, only when a Topps card needs it; the public build never imports it.
 *
 *   1. Kit: the save's own drawing of his club's kit when the pull rolled home and the save has it; otherwise the
 *      save's neutral kit (800) painted into the rolled Uniform (home, alternate or era), with the same row bands and
 *      colours as gameKitPaint.ts (which paints home kits only; this takes any Uniform, so a throwback card stays one).
 *   2. Body: his roll (config/bodyTypes.ts), reshaped pixel for pixel by gameKitPaint.ts processSprite.
 *   3. Crop: the top BUST_ROWS rows of the figure (from the first opaque row: hair and all), BUST_W columns centred
 *      on his centre line, upscaled by whole pixels (UPSCALE) so it stays crisp whatever the browser does.
 *
 * The duotone (club deep ink and cream) and the halftone are drawn by the SVG, not here.
 */

export const BUST_W = 34;
export const BUST_ROWS = 24;
const UPSCALE = 6;

// The neutral kit's colours and row bands (gameKitPaint.ts measures them; kept in step with it)
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

/** The neutral kit's three colours per band, in a Uniform's colours (gameKitPaint.ts paletteFor, for any kit). */
const paletteOf = (u: Uniform) => {
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

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** The neutral sprite at `src` painted into `u`, as a data URL. */
const paintUniform = async (src: string, u: Uniform): Promise<string> => {
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = canvasOf(w, h);
  const ctx = c.getContext('2d');
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const pal = paletteOf(u);
  for (let y = BODY_TOP; y < Math.min(SHOES_TOP, h); y++) {
    const band = y < PANTS_TOP ? pal.jersey : y < SOCKS_TOP ? pal.pants : pal.socks;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 255) continue;
      const to = band[(px[i] << 16) | (px[i + 1] << 8) | px[i + 2]];
      if (to) [px[i], px[i + 1], px[i + 2]] = to;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
};

/** Head and shoulders of the sprite at `src`: BUST_ROWS rows from his first opaque row, centred on `cx`, upscaled. */
const cropBust = async (src: string, cx: number, foot: number): Promise<string | null> => {
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = canvasOf(w, h);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  let top = -1;
  for (let y = 0; y < Math.min(foot, h) && top < 0; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 0) {
        top = y;
        break;
      }
    }
  }
  if (top < 0) return null;
  const x0 = Math.round(cx - BUST_W / 2);
  const out = canvasOf(BUST_W * UPSCALE, BUST_ROWS * UPSCALE);
  const o = out.getContext('2d');
  if (!o) return null;
  o.imageSmoothingEnabled = false;
  o.drawImage(img, x0, top, BUST_W, BUST_ROWS, 0, 0, BUST_W * UPSCALE, BUST_ROWS * UPSCALE);
  return out.toDataURL('image/png');
};

export interface PortraitJob {
  /** The sprite file (gameSprites.ts nflSpriteFor) */
  src: string;
  /** Paint the neutral kit into this uniform (unset: the file is already in the kit the card wants) */
  uniform?: Uniform;
  rows: number;
  cols: number;
  cx: number;
  foot: number;
}

const cache = new Map<string, Promise<string | null>>();
const CACHE_MAX = 300;

/** The printed portrait's source image (a data URL of the cropped, upscaled bust), cached per sprite × kit × body. */
export const toppsPortrait = (job: PortraitJob): Promise<string | null> => {
  const key = `${job.src}|${job.uniform ? JSON.stringify(job.uniform) : ''}|${job.rows},${job.cols}|${job.cx},${job.foot}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const run = (async () => {
    const painted = job.uniform ? await paintUniform(job.src, job.uniform) : job.src;
    const shaped = await processSprite(painted, { rows: job.rows, cols: job.cols, cx: job.cx, foot: job.foot });
    return cropBust(shaped, job.cx, job.foot);
  })();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, run);
  run.catch(() => cache.delete(key));
  return run;
};
