import type { PackType } from '@/utils/collection';

/**
 * The players' tunnel the pack opening happens in, drawn once as pixel art (PackTunnel.tsx): a concrete tunnel seen
 * from inside, looking out at the stadium through its mouth (left transparent: the stadium is DOM under it). Every
 * pixel is solved in perspective: the tunnel's cross-section is the mouth's own arch scaled about the vanishing point,
 * so a pixel's scale `s` (1 at the mouth, growing toward the camera) gives its depth, the surface it belongs to
 * (ceiling, walls, floor) and where on that surface it lies. Structural ribs every bay, a lamp in each bay's ceiling,
 * block courses and a club-colour stripe on the walls, the club-colour runner on the floor, light from the stadium
 * falling off with depth, all quantised to small ramps with a 4 x 4 Bayer dither so it reads as the game's pixel art.
 *
 * Drawn at 1 canvas pixel per P CSS pixels (3 on a phone, 4 on a desktop) and shown with image-rendering: pixelated;
 * only on mount, resize, pack type or club change, never per frame. The pack type sets the trim (ribs and the mouth's
 * frame) and the lamps; the dynamic light (the beam's colour, the walkout) is CSS over it.
 */

export interface TunnelGeo {
  /** CSS pixels per canvas pixel */
  P: number;
  /** Canvas size in canvas pixels */
  W: number;
  H: number;
  /** The mouth (canvas pixels): left, top, width, height, top-corner radius */
  mx: number;
  my: number;
  mw: number;
  mh: number;
  r: number;
  /** Vanishing point (canvas pixels) */
  vx: number;
  vy: number;
}

/**
 * Mouth layout for a container of cw x ch CSS pixels. `safeTop` (the status bar / Dynamic Island inset of a Home
 * Screen app) pushes the mouth down so the dialog's title stays on the ceiling, and the mouth gets shorter to keep the
 * floor big enough for the cards.
 */
export const tunnelGeo = (cw: number, ch: number, safeTop = 0): TunnelGeo => {
  const P = cw < 640 ? 3 : 4;
  const W = Math.max(40, Math.ceil(cw / P));
  const H = Math.max(60, Math.ceil(ch / P));
  const landscape = cw / ch > 0.9;
  let mw = Math.round(W * (landscape ? 0.32 : 0.62));
  let mh = Math.round(H * (landscape ? 0.43 : 0.29));
  // never wider than tall by too much on a squat desktop window, never taller than a phone allows
  if (landscape) mw = Math.min(mw, Math.round(mh * 1.25));
  else mh = Math.min(mh, Math.round(mw * 1.1));
  const mx = Math.round((W - mw) / 2);
  const my = landscape ? Math.round(H * 0.1) : Math.max(Math.round(H * 0.165), Math.ceil((safeTop + 126) / P));
  if (!landscape) mh = Math.max(Math.round(mw * 0.7), Math.min(mh, Math.round(H * 0.47) - my));
  const r = Math.round(mw * 0.2);
  return { P, W, H, mx, my, mw, mh, r, vx: mx + mw / 2, vy: my + mh * 0.62 };
};

type RGB = [number, number, number];

let probe: CanvasRenderingContext2D | null = null;
/** Any CSS colour as RGB (hex, hsl(), rgb()). */
export const rgbOf = (css: string): RGB => {
  probe ??= document.createElement('canvas').getContext('2d');
  if (!probe) return [128, 128, 128];
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  const v = String(probe.fillStyle);
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/(\d+(?:\.\d+)?)/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
};

interface Look {
  wall: RGB;
  ceil: RGB;
  floor: RGB;
  rib: RGB;
  /** Trim on the ribs' inner edge and the mouth frame; `rainbow` cycles the hue per rib (Holo Showcase) */
  trim: RGB;
  rainbow?: boolean;
  lamp: RGB;
  /** How much the stadium lights the tunnel (0-1) */
  spill: number;
}

/** The tunnel per pack: Standard plain concrete, Premium cool steel, Elite gold trim, Holo iridescent, Perfect Season black and gold, Legends Exchange old brick. */
export const TUNNEL_LOOK: Record<PackType, Look> = {
  standard: { wall: [92, 98, 112], ceil: [58, 62, 74], floor: [64, 66, 74], rib: [118, 124, 138], trim: [150, 156, 170], lamp: [255, 236, 186], spill: 1 },
  premium: { wall: [84, 96, 118], ceil: [52, 60, 80], floor: [60, 66, 82], rib: [130, 146, 170], trim: [214, 228, 246], lamp: [214, 232, 255], spill: 1.05 },
  elite: { wall: [86, 88, 106], ceil: [52, 52, 68], floor: [60, 58, 70], rib: [120, 116, 126], trim: [238, 186, 64], lamp: [255, 214, 120], spill: 1.08 },
  holo: { wall: [86, 84, 116], ceil: [52, 48, 80], floor: [58, 56, 80], rib: [124, 118, 156], trim: [255, 120, 230], rainbow: true, lamp: [236, 214, 255], spill: 1.1 },
  perfect: { wall: [52, 52, 58], ceil: [30, 30, 36], floor: [40, 40, 46], rib: [70, 68, 70], trim: [236, 186, 72], lamp: [255, 222, 150], spill: 1.05 },
  exchange: { wall: [112, 74, 62], ceil: [62, 46, 42], floor: [70, 58, 54], rib: [138, 104, 84], trim: [214, 128, 66], lamp: [255, 200, 140], spill: 0.95 },
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** Brightness steps a material is quantised to (with the dither between neighbours). */
const STEPS = [0.1, 0.17, 0.26, 0.37, 0.5, 0.65, 0.82, 1, 1.18];

const hueRGB = (h: number): RGB => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (0.62 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

export interface TunnelPaint {
  type: PackType;
  /** The club whose colours the wall stripe and the floor runner wear */
  stripe: RGB;
  runner: RGB;
  runnerEdge: RGB;
}

/** Pixel is inside the mouth (canvas pixel coordinates, continuous). */
const inMouth = (g: TunnelGeo, x: number, y: number) => {
  if (x < g.mx || x > g.mx + g.mw || y < g.my || y > g.my + g.mh) return false;
  if (y < g.my + g.r) {
    const cx = x < g.mx + g.r ? g.mx + g.r : x > g.mx + g.mw - g.r ? g.mx + g.mw - g.r : null;
    if (cx != null) return (x - cx) ** 2 + (y - (g.my + g.r)) ** 2 <= g.r * g.r;
  }
  return true;
};

/** Bays (rib to rib) between the mouth and the camera. */
const DEPTH = 6.2;

/** Draws the tunnel into `ctx` (sized g.W x g.H); the mouth stays transparent. */
export const drawTunnel = (ctx: CanvasRenderingContext2D, g: TunnelGeo, paint: TunnelPaint) => {
  const look = TUNNEL_LOOK[paint.type];
  const img = ctx.createImageData(g.W, g.H);
  const px = img.data;
  const { vx, vy, mx, my, mw, mh } = g;
  const half = mw / 2;
  const bottom = my + mh;
  const course = mh / 7.5;
  const stripeTop = my + mh * 0.56;
  const stripeBot = my + mh * 0.6;
  const runnerHalf = mw * 0.2;
  const set = (i: number, c: RGB, k: number, t: number) => {
    // quantise k to the steps with an ordered dither
    let lo = 0;
    while (lo < STEPS.length - 2 && STEPS[lo + 1] <= k) lo++;
    const a = STEPS[lo];
    const b = STEPS[lo + 1];
    const f = Math.max(0, Math.min(1, (k - a) / (b - a)));
    const s = f > t ? b : a;
    px[i] = Math.min(255, c[0] * s);
    px[i + 1] = Math.min(255, c[1] * s);
    px[i + 2] = Math.min(255, c[2] * s);
    px[i + 3] = 255;
  };
  for (let y = 0; y < g.H; y++) {
    for (let x = 0; x < g.W; x++) {
      const i = (y * g.W + x) * 4;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (inMouth(g, cx, cy)) continue;
      const t = BAYER[(y & 3) * 4 + (x & 3)];
      // the scale s at which this pixel lies on the tunnel's cross-section
      let lo = 1;
      let hi = 2;
      while (!inMouth(g, vx + (cx - vx) / hi, vy + (cy - vy) / hi) && hi < 4096) hi *= 2;
      for (let n = 0; n < 18; n++) {
        const mid = (lo + hi) / 2;
        if (inMouth(g, vx + (cx - vx) / mid, vy + (cy - vy) / mid)) hi = mid;
        else lo = mid;
      }
      const s = hi;
      const qx = vx + (cx - vx) / s;
      const qy = vy + (cy - vy) / s;
      // depth from the mouth, in bays
      const w = DEPTH * (1 - 1 / s);
      const bay = w - Math.floor(w);
      const ribIdx = Math.floor(w);
      // light from the stadium falls off with depth; a little ambient everywhere
      let k = 0.16 + 0.9 * look.spill * Math.exp(-w * 0.55);
      // the mouth's frame: two pixel rings, trim then a dark lip
      const ring = (s - 1) * Math.hypot(cx - vx, cy - vy) / s;
      if (ring < 1.05) {
        const trim = look.rainbow ? hueRGB((x * 9 + y * 5) % 360) : look.trim;
        set(i, trim, 1, t);
        continue;
      }
      if (ring < 2.1) {
        set(i, look.rib, 0.32, t);
        continue;
      }
      const floor = qy >= bottom - 0.01;
      const ceil = !floor && (qy <= my + 0.01 || (qy < my + g.r && Math.abs(qx - vx) > half - g.r - 0.01));
      const rib = bay < 0.13;
      const ribEdge = bay >= 0.13 && bay < 0.18;
      if (rib && floor) {
        // on the floor a rib is only a threshold seam
        set(i, look.floor, k * (bay < 0.05 ? 0.7 : 0.95), t);
        continue;
      }
      if (rib) {
        // the rib's face, lit a touch more on the edge that faces the stadium
        set(i, look.rib, k * (bay < 0.05 ? 1.15 : 0.92), t);
        continue;
      }
      if (ribEdge && !floor) {
        const trim = look.rainbow ? hueRGB((ribIdx * 70 + (qy - my) * 4 + (qx - mx) * 3) % 360) : look.trim;
        set(i, trim, Math.max(0.5, k * 1.1), t);
        continue;
      }
      if (ceil) {
        const dx = Math.abs(qx - vx);
        // a lamp in the middle of each bay
        const lampAt = Math.abs(bay - 0.55);
        // (none in the bay nearest the camera: it would sit behind the dialog's title)
        if (dx < half * 0.16 && lampAt < 0.07 && w < DEPTH - 3.2) {
          set(i, look.lamp, lampAt < 0.04 && dx < half * 0.11 ? 1.18 : 0.95, t);
          continue;
        }
        const glow = Math.exp(-((lampAt * 6) ** 2 + (dx / half) ** 2 * 6)) * 0.55;
        const panel = Math.abs(dx - half * 0.42) < 0.6 ? 0.8 : 1;
        set(i, look.ceil, (k * 0.85 + glow) * panel, t);
        continue;
      }
      if (floor) {
        const dx = qx - vx;
        // the lamp above throws a pool on the floor
        const pool = Math.exp(-(((bay - 0.55) * 4) ** 2 + (dx / half) ** 2 * 3)) * 0.22;
        const near = Math.exp(-w * 1.6) * 0.3;
        if (Math.abs(dx) < runnerHalf) {
          const edge = Math.abs(dx) > runnerHalf - mw * 0.03;
          set(i, edge ? paint.runnerEdge : paint.runner, (k + pool + near) * (edge ? 0.95 : 0.85), t);
        } else {
          const seam = bay > 0.5 && bay < 0.54 ? 0.75 : 1;
          set(i, look.floor, (k + pool + near) * seam, t);
        }
        continue;
      }
      // walls: block courses, staggered joints, the club stripe at waist height
      if (qy > stripeTop && qy < stripeBot) {
        set(i, paint.stripe, Math.max(0.42, k * 1.05), t);
        continue;
      }
      const row = Math.floor((qy - my) / course);
      const inRow = (qy - my) / course - row;
      const joint = (w * 2 + (row & 1) * 0.5) % 1;
      const mortar = inRow < 0.09 || joint < 0.05;
      const sconce = Math.exp(-(((bay - 0.55) * 5) ** 2 + ((qy - (my + mh * 0.3)) / mh) ** 2 * 40)) * 0.18;
      set(i, look.wall, (k + sconce) * (mortar ? 0.72 : 1) * (qx < vx ? 0.94 : 1), t);
    }
  }
  ctx.putImageData(img, 0, 0);
};
