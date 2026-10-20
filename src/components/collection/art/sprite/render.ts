import type { Palette } from '../shared';
import type { TeamStyle } from '../teamStyle';
import { F, FAR, GROUND, PIX_H, PIX_W, PIX_X, line, shade, stamp, tint, type Key, type Pt, type Rect } from './grid';
import { bareHead, faceColours, goldenHourPortrait, hairColor, hairRise, helmetHair, isPortraitPose, skinColor, skinRamp, type HeadOpts, type SpriteLook } from './faces';
import { frontHead, helmetColours, miniHelmet, sideHead, tqHead, type Helmet } from './helmets';
import { jitterFor, markFor, runPose, type FieldMark, type PoseOut, type Skel } from './poses';
import { pantsBands, sleeveBands, sockBands, type Uniform } from './uniforms';

/*
 * Retro Bowl-style pixel player, generated on one pixel grid (no images, gradients or anti-aliasing inside it):
 *   1. Build and height (sprites.json, or by position) set an athletic frame: a V-taper torso (wide pads, narrow
 *      waist), a thick neck and traps, arms with a bicep bump and 1-px highlight / shadow lines, quads.
 *   2. The pose (spritePoses.ts: 8–10 per position, celebrations, signatures) places the limbs as thick pixel lines;
 *      airborne poses lift, dives rotate pixel by pixel and are refit above the turf.
 *   3. A chibi-sized head: a helmet seen from the side (shell over the top and back, the face through the front
 *      opening behind the facemask bars, chin strap, pixel team decal, crown stripe), or facing out for
 *      celebrations, or helmet off (full face and hair, the helmet in his hand or at his feet). The face has
 *      shading, brows, eyes, nose and a mouth set by the pose (grimace, smile, stern, eyes up) plus his facial hair.
 *   4. Every empty pixel touching the figure becomes a dark outline, like the game's sprites.
 */

/** Grid keys → colours (see colours()). */

// ---------- Body (build / height → frame) ----------

export interface Body {
  /** shoulder half-width, waist half-width, arm / leg thickness, torso / leg length, upper-arm length, neck width */
  sh: number;
  waist: number;
  armT: number;
  legT: number;
  torsoH: number;
  legH: number;
  arm: number;
  neck: number;
  /** Muscle definition lines */
  ripped: boolean;
}

export const BUILDS: Record<SpriteLook['build'], Body> = {
  normal: { sh: 8, waist: 5, armT: 3, legT: 4, torsoH: 12, legH: 17, arm: 6, neck: 3, ripped: false },
  big: { sh: 10, waist: 6, armT: 4, legT: 5, torsoH: 13, legH: 17, arm: 6, neck: 5, ripped: true },
  huge: { sh: 12, waist: 7, armT: 5, legT: 5, torsoH: 14, legH: 17, arm: 7, neck: 7, ripped: true },
};
/** Rows above the shoulder line taken by the bare head (chin at the shoulders, forehead 15 rows up) */
const HEAD_ROWS = 15;
/** Top margin: the hair's top pixel stays this far below the frame's top (the outline sits above it) */
const TOP = 2;
/**
 * Frame for a look: the build, plus height for tall players, fitted by height so the bare head and its hair (locs,
 * a high-top) always fit inside the frame. When space is short the legs shrink first (to 14), then the torso; the
 * head never does. Every pose uses the same frame, helmet on or off.
 */
export const bodyFor = (look: SpriteLook): Body => {
  const base = BUILDS[look.build];
  const b = look.height === 'tall' ? { ...base, torsoH: base.torsoH + 2, legH: base.legH + 4, arm: base.arm + 1 } : { ...base };
  const room = GROUND - 2 - TOP - HEAD_ROWS - hairRise(look);
  let over = b.legH + b.torsoH - room;
  if (over > 0) {
    const legCut = Math.min(over, b.legH - 14);
    b.legH -= legCut;
    over -= legCut;
    b.torsoH -= Math.max(0, over);
  }
  return b;
};


// ---------- Body ----------

/**
 * Stripes across a sleeve, perpendicular to the arm (s → e), on the fine grid: keyed bands (widths in fine cells)
 * from distance d0 along the arm, optionally slanted (skew: extra distance per pixel across the arm), clipped to the
 * sleeve's own pixels so they never change the silhouette.
 */
const sleeveStripes = (s: Pt, e: Pt, t: number, bands: [Key, number][], d0: number, sleeve: Rect[], skew = 0): Rect[] => {
  const len = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1;
  const [ux, uy] = [(e[0] - s[0]) / len, (e[1] - s[1]) / len];
  const [nx, ny] = [-uy, ux];
  const cover = new Set<string>();
  sleeve.forEach(([x, y, w, h]) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cover.add(`${x + i},${y + j}`);
  });
  // The line() squares put the arm's centre line half a square past s
  const c = (t + 1) / 2 - Math.floor((t + 1) / 2);
  const cells = new Map<string, Rect>();
  const step = 1 / (2 * F);
  const half = (t + 1) / 2 + 0.5;
  let d = d0;
  bands.forEach(([key, w]) => {
    const d1 = d + w / F;
    for (let a = d; a < d1 - 1e-6; a += step)
      for (let k = -half; k <= half; k += step) {
        const aa = a + k * skew;
        const x = Math.floor((s[0] + c + ux * aa + nx * k) * F) / F;
        const y = Math.floor((s[1] + c + uy * aa + ny * k) * F) / F;
        if (!cover.has(`${Math.floor(x)},${Math.floor(y)}`)) continue;
        cells.set(`${x},${y}`, [x, y, 1 / F, 1 / F, key]);
      }
    d = d1;
  });
  return [...cells.values()];
};

/** Stripe columns (half a pixel each, keys left to right) running along a → b, centred on the line, up to `to`. */
const lengthStripe = (a: Pt, b: Pt, keys: Key[], to = 1): Rect[] => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  // Normal pointing to +x (the figure's front) for a leg running down
  const [nx, ny] = [uy, -ux];
  const cells = new Map<string, Rect>();
  const step = 1 / (2 * F);
  const w = keys.length / F;
  for (let d = 0; d <= len * to; d += step)
    for (let k = -w / 2; k < w / 2 - 1e-6; k += step) {
      const key = keys[Math.min(keys.length - 1, Math.floor((k + w / 2) * F))];
      const x = Math.floor((a[0] + ux * d + nx * k) * F) / F;
      const y = Math.floor((a[1] + uy * d + ny * k) * F) / F;
      cells.set(`${x},${y}`, [x, y, 1 / F, 1 / F, key]);
    }
  return [...cells.values()];
};

const arm = (pts: [Pt, Pt, Pt], b: Body, look: SpriteLook, front: boolean, palm: boolean, uni: Uniform): Rect[] => {
  const k = (x: Key): Key => (front ? x : (FAR[x] ?? x));
  const acc = look.accessories;
  const sleeve = front && acc.some((a) => a.startsWith('sleeve-'));
  const t = b.armT;
  const [s, e, h] = pts;
  const out: Rect[] = [...line(s, e, t, k('s')), ...line(e, h, t, sleeve ? 'A' : k('s'))];
  // Bicep bump below the sleeve, then 1-px highlight along the top of the arm (front arm only)
  out.push(...line(s, e, t + 1, k('s'), 0.55, 0.85));
  if (front && b.ripped) {
    out.push(...line(s, e, 1, 'u', 0.58, 0.85, [0, -Math.floor(t / 2)]));
    if (!sleeve) out.push(...line(e, h, 1, 'u', 0.15, 0.7, [0, -Math.floor(t / 2)]));
    out.push(...line(e, h, 1, 'X', 0.2, 0.75, [0, Math.floor(t / 2)]));
  }
  // Jersey sleeve over the shoulder (snug, not ballooned), the yoke colour on top where the uniform has one
  const sleeveRects = line(s, e, t + 1, k('J'), 0, 0.5);
  out.push(...sleeveRects);
  if (uni.sleeve === 'yoke') out.push(...line(s, e, t + 1, 'Q', 0, 0.25));
  if (uni.sleeve === 'tiger' && uni.yoke) out.push(...sleeveRects.map((r): Rect => [r[0], r[1], r[2], r[3], 'Q']));
  if (b.ripped) out.push(...line(s, e, 1, front ? 'Y' : 'y', 0, 0.45, [0, -Math.floor((t + 1) / 2)]));
  const band = (a: Pt, b2: Pt, f: number, key: Key, wide = 0) => {
    const [x, y] = [Math.round(a[0] + (b2[0] - a[0]) * f), Math.round(a[1] + (b2[1] - a[1]) * f)];
    out.push([x - Math.floor((t + wide) / 2), y, t + wide, 1, key]);
  };
  // Sleeve stripes (uniforms.ts sleeveBands: count, widths, colours) ending half a pixel above the hem; shoulder cap;
  // tiger stripes on yoke-coloured sleeves; the Chargers' bolt as two slanted strokes
  const len = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1;
  const hem = 0.5 * len + (t + 1) / 2 - 0.5;
  if (uni.shoulder) out.push(...sleeveStripes(s, e, t, [['us', 1]], -1, sleeveRects));
  if (uni.sleeve === 'tiger') out.push(...sleeveStripes(s, e, t, [['tg', 1], ['Q', 1], ['tg', 1], ['Q', 1], ['tg', 1]], hem - 3.2, sleeveRects, 0.7));
  else if (uni.sleeve === 'bolt') out.push(...sleeveStripes(s, e, t, [['j', 1], [k('J'), 1], ['j', 1]], hem - 2.2, sleeveRects, -0.9));
  else {
    const bands = sleeveBands(uni);
    const total = bands.reduce((a, [, w]) => a + (w ?? 1), 0) / F;
    const keyed = bands.map(([col, w], i): [Key, number] => [col == null ? k('J') : `u${i + 1}`, w ?? 1]);
    if (keyed.length) out.push(...sleeveStripes(s, e, t, keyed, Math.max(0.5, hem - 0.5 - total), sleeveRects));
  }
  if (acc.includes('armbands')) band(s, e, 0.66, 'j');
  if (acc.includes('tattoos') && !sleeve) out.push(...line(e, h, t, 't', 0.15, 0.75).filter((_, i) => i % 2 === 0));
  if (acc.includes('wristbands')) band(e, h, 0.8, 'W');
  const glove: Key | null = acc.includes('gloves-white') || acc.includes('gloves-black') ? 'G' : null;
  const hs = t + 1;
  const [hx, hy] = h;
  if (palm) out.push([hx - 1, hy - Math.floor(hs / 2) - 1, 2, hs + 2, glove ?? k('s')]);
  else out.push([hx - Math.floor(hs / 2), hy - Math.floor(hs / 2), hs, hs, glove ?? k('s')]);
  return out;
};

const leg = (pts: [Pt, Pt, Pt], b: Body, front: boolean, uni: Uniform, pointed = false): Rect[] => {
  const k = (x: Key): Key => (front ? x : (FAR[x] ?? x));
  const [hp, kn, an] = pts;
  const t = b.legT;
  const out: Rect[] = [...line(hp, kn, t + 1, k('P')), ...line(kn, an, t, k('K')), ...line(kn, an, t, k('P'), 0, 0.3)];
  // Calf bump, sock stripe, quad highlight, team stripe down the pants
  out.push(...line(kn, an, t + 1, k('K'), 0.35, 0.6));
  // Sock stripes: half-pixel rows (uniforms.ts sockBands), centred halfway down the shin
  {
    const f = 0.5;
    const [x, y] = [Math.round(kn[0] + (an[0] - kn[0]) * f), Math.round(kn[1] + (an[1] - kn[1]) * f)];
    const rows = sockBands(uni);
    const y0 = y + 0.5 - Math.ceil(rows.length / 2) / F;
    rows.forEach((_, i) => out.push([x - Math.floor(t / 2), y0 + i / F, t, 1 / F, `c${i + 1}`]));
  }
  if (front) {
    out.push(...line(hp, kn, 1, 'i', 0.15, 0.8, [0, -Math.floor((t + 1) / 2)]));
    // Pants side stripe: half-pixel columns (uniforms.ts pantsBands), e.g. red-white-red
    const cols = pantsBands(uni);
    if (cols.length) out.push(...lengthStripe([hp[0] + 1.5, hp[1] + 0.5], [kn[0] + 1.5, kn[1] + 0.5], cols.map((_, i) => `p${i + 1}`), 0.9));
  }
  const [ax, ay] = an;
  // Cleat: flat on the turf, or pointed (heel up, toe down on the same sole row: a drag or a push-off)
  if (pointed) {
    const x = ax - Math.floor(t / 2);
    out.push([x, ay - 1, t, 1, 'B'], [x + 1, ay, t, 1, 'B'], [x + 2, ay + 1, t - 1, 1, 'B']);
  } else out.push([ax - Math.floor(t / 2), ay, t + 2, 2, 'B'], [ax + Math.ceil(t / 2), ay + 1, 1, 1, 'B']);
  return out;
};

/** V-taper torso: snug pads, a fast taper to a narrow waist, traps up to a thick neck, pec line, belt and hips. */
const torso = (cx: number, sy: number, b: Body, uni: Uniform): Rect[] => {
  const R: Rect[] = [];
  // Traps / neck
  R.push([cx - Math.floor(b.neck / 2), sy - 3, b.neck, 3, 's']);
  R.push([cx - b.sh + 3, sy - 1, b.sh * 2 - 5, 1, 'J']);
  // Pads (3 rows), top row catching the light
  R.push([cx - b.sh, sy, b.sh * 2 + 1, 3, 'J']);
  if (b.ripped) R.push([cx - b.sh + 1, sy, b.sh * 2 - 1, 1, 'Y']);
  const body = b.torsoH - 3;
  for (let i = 0; i < body; i++) {
    const f = Math.min(1, i / Math.max(1, body * 0.62));
    const half = Math.round(b.sh - 1 - (b.sh - 1 - b.waist) * f);
    R.push([cx - half, sy + 3 + i, half * 2 + 1, 1, 'J']);
    // Shadow down the far (right-hand, away from the light) flank
    R.push([cx + half, sy + 3 + i, 1, 1, 'Z']);
  }
  if (b.ripped) {
    // Pec line and a lat shadow under the pads
    R.push([cx - b.sh + 3, sy + 5, b.sh * 2 - 5, 1, 'Z']);
    R.push([cx - b.sh + 1, sy + 3, 1, 3, 'Z']);
  }
  // Shoulder yoke (tiger: yoke-coloured pads with stripes), piping on the pad caps, shoulder cap, bumblebee bands,
  // collar trim
  if (uni.sleeve === 'yoke') R.push([cx - b.sh, sy, b.sh * 2 + 1, 2, 'Q'], [cx - b.sh, sy + 2, b.sh * 2 + 1, 1, 'j']);
  else if (uni.sleeve === 'tiger' && uni.yoke) {
    R.push([cx - b.sh, sy, b.sh * 2 + 1, 2, 'Q']);
    [-b.sh + 1, -b.sh + 3, b.sh - 3, b.sh - 1].forEach((dx, i) => R.push([cx + dx, sy + (i % 2), 1, 2 - (i % 2), 'tg']));
  } else if (uni.sleeve !== 'none') R.push([cx - b.sh, sy + 2, 1, 1, 'j'], [cx + b.sh, sy + 2, 1, 1, 'j']);
  if (uni.shoulder) R.push([cx - b.sh + 1, sy, b.sh * 2 - 1, 1 / F, 'us']);
  if (uni.sleeve === 'bands') for (let y = sy + 4; y < sy + b.torsoH - 1; y += 3) R.push([cx - b.sh, y, b.sh * 2 + 1, 1, 'j']);
  R.push([cx - 2, sy - 1, 5, 1, 'uc'], [cx, sy, 1, 1, 'Z']);
  // Belt, pants top (hips just wider than the waist)
  const hy = sy + b.torsoH;
  R.push([cx - b.waist - 1, hy, b.waist * 2 + 3, 3, 'P'], [cx - b.waist, hy, b.waist * 2 + 1, 1, 'b']);
  return R;
};


const ball = ([x, y]: Pt): Rect[] => stamp(['.FFFFF.', 'FFfffFF', '.FFFFF.'], x - 3, y - 1);

/** 3 × 5 pixel digits */
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
/** The big chest number with its outline (one ring, or two for 'double'; none for 'solid'). */
const numberRects = (n: number, x: number, y: number, uni: Uniform): Rect[] => {
  const s = String(n).slice(0, 2);
  const start = s.length === 1 ? x - 1 : x - 3;
  const cells: Pt[] = [];
  [...s].forEach((ch, i) => {
    const bits = DIGITS[Number(ch)] ?? DIGITS[0];
    for (let q = 0; q < 15; q++) if (bits[q] === '1') cells.push([start + i * 4 + (q % 3), y + Math.floor(q / 3)]);
  });
  const out: Rect[] = [];
  if (uni.numberStyle !== 'solid') {
    // Outline on the fine grid: half a sprite pixel round each digit cell; 'double' adds the second colour as a
    // half-pixel drop to the lower right (a full second ring would fill the gaps between digits at this size)
    const h = 1 / F;
    if (uni.numberStyle === 'double') cells.forEach(([cx, cy]) => out.push([cx, cy, 1 + 2 * h, 1 + 2 * h, 'n2']));
    cells.forEach(([cx, cy]) => out.push([cx - h, cy - h, 1 + 2 * h, 1 + 2 * h, 'O']));
  }
  cells.forEach(([cx, cy]) => out.push([cx, cy, 1, 1, 'N']));
  return out;
};


// ---------- Compose ----------

export type Grid = (Key | undefined)[];
/**
 * Fine grid (F from grid.ts) × the sprite's pixel density. Bodies and faces are drawn in whole sprite pixels (F × F fine cells);
 * helmet logos are drawn on the fine grid, so they can be detailed. The outline is one sprite pixel thick.
 */
const W = PIX_W * F;
const H = PIX_H * F;
const at = (x: number, y: number) => y * W + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
/** Sprite-pixel coordinate → fine column / row */
const fx = (x: number) => Math.round((x - PIX_X) * F);
const fy = (y: number) => Math.round(y * F);

export const rasterise = (rects: Rect[]): Grid => {
  const g: Grid = new Array(W * H);
  rects.forEach(([x, y, w, h, k]) => {
    const x0 = fx(x);
    const x1 = fx(x + w);
    const y0 = fy(y);
    const y1 = fy(y + h);
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) if (inside(i, j)) g[at(i, j)] = k;
  });
  return g;
};

const NEIGH = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** One-sprite-pixel dark outline around the figure (F fine cells), then horizontal runs of one colour. */
export const runsOf = (grid: Grid, outline = true): Rect[] => {
  let out = grid.slice();
  for (let pass = 0; pass < (outline ? F : 0); pass++) {
    const src = out;
    out = src.slice();
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        if (src[at(i, j)]) continue;
        if (NEIGH.some(([a, c]) => inside(i + a, j + c) && src[at(i + a, j + c)])) out[at(i, j)] = 'o';
      }
  }
  const runs: Rect[] = [];
  for (let j = 0; j < H; j++) {
    let i = 0;
    while (i < W) {
      const k = out[at(i, j)];
      if (!k) {
        i++;
        continue;
      }
      let e = i + 1;
      while (e < W && out[at(e, j)] === k) e++;
      runs.push([i, j, e - i, 1, k]);
      i = e;
    }
  }
  return runs;
};

// ---------- Placement (poses.ts says where the limbs go; this puts the figure on the grid) ----------
//
// Scale is fixed by the build: the skeleton stands on one ankle line (GROUND − 2) and every pose draws the same head
// and torso; poses only move limbs, lean (shear), crouch, lift and rotate. Nothing is ever scaled to fit a bounding
// box. The figure is drawn in layers (back limbs, torso, front leg, head, front arm) so the body can lean or rotate
// while the head rides the neck upright. scripts/check_sprites.ts asserts all of this for every pose.

/** Skeleton anchors for a frame: feet on one ankle line (GROUND − 2), hips and shoulders up from it by the build. */
export const skeletonFor = (b: Body): Skel => {
  const cx = 22;
  const hy = GROUND - 2 - b.legH;
  const sy = hy - b.torsoH;
  return { cx, sy, hy, fs: cx + b.sh - 1, bs: cx - b.sh + 1, fh: cx + 2, bh: cx - 2, A: b.arm, L: b.legH, h: Math.round(b.legH / 2), G: GROUND - 2 };
};

/**
 * Lean: the body bends at the waist. Rows ramp over the few rows above the hips, then the chest, number, arms and
 * head move as one block by `shear` whole pixels, so nothing above the belt is skewed.
 */
const shearAt = (pose: PoseOut, k: Skel, y: number): number => {
  if (!pose.shear) return 0;
  const hip = k.hy + pose.crouch;
  const ramp = Math.abs(pose.shear) + 2;
  return y >= hip ? 0 : Math.round(pose.shear * Math.min(1, (hip - y) / ramp));
};
/** Where a (crouched) pose-space point lands after the lean and the rotation round the hips, before the lift. */
const bodyPoint = ([x, y]: Pt, pose: PoseOut, k: Skel): Pt => {
  const p: Pt = [x + shearAt(pose, k, Math.floor(y)), y];
  if (!pose.rotate) return p;
  const r = (pose.rotate * Math.PI) / 180;
  const [px, py] = [k.cx, k.hy + pose.crouch];
  const [dx, dy] = [p[0] - px, p[1] - py];
  return [px + dx * Math.cos(r) - dy * Math.sin(r), py + dx * Math.sin(r) + dy * Math.cos(r)];
};

const shearGrid = (g: Grid, pose: PoseOut, k: Skel): Grid => {
  if (!pose.shear) return g;
  const n: Grid = new Array(W * H);
  for (let y = 0; y < H; y++) {
    const s = shearAt(pose, k, Math.floor(y / F)) * F;
    for (let x = 0; x < W; x++) if (g[at(x, y)] && inside(x + s, y)) n[at(x + s, y)] = g[at(x, y)];
  }
  return n;
};
/** Rotate clockwise round a sprite-pixel pivot (nearest fine cell). */
const rotateGrid = (g: Grid, deg: number, pivot: Pt): Grid => {
  const px = fx(pivot[0]);
  const py = fy(pivot[1]);
  const r = (-deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const n: Grid = new Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - px;
      const dy = y - py;
      const sx = Math.round(px + dx * cos - dy * sin);
      const sy = Math.round(py + dx * sin + dy * cos);
      if (inside(sx, sy) && g[at(sx, sy)]) n[at(x, y)] = g[at(sx, sy)];
    }
  return n;
};
const moveGrid = (g: Grid, dx: number, dy: number): Grid => {
  if (!dx && !dy) return g;
  const n: Grid = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[at(x, y)] && inside(x + dx, y + dy)) n[at(x + dx, y + dy)] = g[at(x, y)];
  return n;
};
/** Bounding box of the filled cells (fine grid): [x0, y0, x1, y1], or null when empty. */
export const boundsOf = (g: Grid): [number, number, number, number] | null => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[at(x, y)]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
};

/** 1-px index finger out of the hand, along the forearm (pointing, finger to the sky). */
const fingerRects = ([, e, h]: [Pt, Pt, Pt], b: Body, look: SpriteLook): Rect[] => {
  const len = Math.hypot(h[0] - e[0], h[1] - e[1]) || 1;
  const [ux, uy] = [(h[0] - e[0]) / len, (h[1] - e[1]) / len];
  const r = (b.armT + 1) / 2;
  const gloved = look.accessories.includes('gloves-white') || look.accessories.includes('gloves-black');
  const p = (d: number): Pt => [Math.round(h[0] + ux * d), Math.round(h[1] + uy * d)];
  return line(p(r), p(r + 2), 1, gloved ? 'G' : 's');
};

/** A composed sprite on the fine grid, plus its head and torso layers alone (the sprite check measures them). */
export interface Composed {
  grid: Grid;
  head: Grid;
  torso: Grid;
  pose: PoseOut;
  skel: Skel;
  /** The frame forced a horizontal shift (the figure didn't fit where the pose put it) */
  clamped: boolean;
}

export const composeSprite = (look: SpriteLook, poseKey: string, style: TeamStyle, hel: Helmet, number: number | null | undefined, name: string, uni: Uniform): Composed => {
  const b = bodyFor(look);
  const skel = skeletonFor(b);
  const { cx, sy } = skel;
  const pose = runPose(poseKey, skel, jitterFor(name));
  const c = pose.crouch;
  const down = ([x, y]: Pt): Pt => [x, y + c];
  const upper = (pts: [Pt, Pt, Pt]) => pts.map(down) as [Pt, Pt, Pt];
  const legPts = (pts: [Pt, Pt, Pt]): [Pt, Pt, Pt] => [down(pts[0]), [pts[1][0], pts[1][1] + Math.ceil(c / 2)], pts[2]];
  const tall = look.height === 'tall' ? 3 : 0;
  const nod = pose.nod ?? 0;
  const opts: HeadOpts = { look, pose, style, hel };

  // Head placement by kind (all sit on the shoulder line, 15 rows up). The helmet is the same size for every build;
  // thicker arms (big / huge) lift it a row or two so the sleeve over the near shoulder doesn't cover the jaw.
  const helmetLift = Math.max(0, b.armT - 3);
  let headBehind: Rect[] = [];
  let headFront: Rect[];
  if (pose.helmetOff) {
    headFront = bareHead(cx - 7 + pose.lean, sy + c - 15 + nod, opts, tall);
  } else if (pose.look === 'front') {
    headFront = frontHead(cx - 9 + pose.lean, sy + c - 15 - helmetLift + nod, opts);
  } else if (pose.look === 'tq') {
    headFront = tqHead(cx - 8 + pose.lean, sy + c - 15 - helmetLift + nod, opts);
  } else {
    const hx = cx - 11 + pose.lean;
    const hyy = sy + c - 15 - helmetLift + nod;
    headBehind = helmetHair(hx, hyy, look, tall);
    headFront = sideHead(hx, hyy, opts);
  }
  const ballRects = pose.ball ? ball(down(pose.ball)) : [];
  const helmetRects =
    pose.helmetOff && pose.helmetAt === 'hand'
      ? miniHelmet(pose.backArm[2][0] - 6, pose.backArm[2][1] + c - 1, hel)
      : pose.helmetOff
        ? miniHelmet(cx - b.sh - 12, GROUND - 9, hel)
        : [];
  const toe = (front: boolean) => pose.toes === 'both' || pose.toes === (front ? 'front' : 'back');
  const backArm = arm(upper(pose.backArm), b, look, false, !!pose.backPalm, uni);
  const frontArmPts = upper(pose.frontArm);
  const frontArm = [...arm(frontArmPts, b, look, true, !!pose.palm, uni), ...(pose.finger ? fingerRects(frontArmPts, b, look) : [])];
  const arms = [...(pose.armsFront ? backArm : []), ...frontArm];

  // Layers: the body ones lean / rotate together; the head ones ride the neck upright (or turn with the body)
  const bodyT = (rects: Rect[]): Grid => {
    const g = shearGrid(rasterise(rects), pose, skel);
    return pose.rotate ? rotateGrid(g, pose.rotate, [cx, skel.hy + c]) : g;
  };
  const neck: Pt = [cx, sy + c - 4];
  const [nx, ny] = bodyPoint(neck, pose, skel);
  const headShift: Pt = [Math.round(nx - neck[0]) * F, Math.round(ny - neck[1]) * F];
  const headT = (rects: Rect[]): Grid => (pose.rotate && pose.headUp === false ? bodyT(rects) : moveGrid(rasterise(rects), headShift[0], headShift[1]));

  const torsoG = bodyT(torso(cx, sy + c, b, uni));
  const headG = headT(headFront);
  const armsG = bodyT(arms);
  const layers: Grid[] = [
    bodyT([...(pose.ballBack ? ballRects : []), ...(pose.armsFront ? [] : backArm), ...(pose.helmetAt === 'hand' ? helmetRects : []), ...leg(legPts(pose.backLeg), b, false, uni, toe(false))]),
    headT(headBehind),
    torsoG,
    bodyT([...(number != null && !pose.armsFront ? numberRects(number, cx + 1, sy + c + 4, uni) : []), ...leg(legPts(pose.frontLeg), b, true, uni, toe(true)), ...(pose.helmetAt === 'feet' ? helmetRects : [])]),
    headG,
    armsG,
  ];
  // A held ball sits over the hands (no outline round it: STYLE_GUIDE.md rule 1)
  const ballG = pose.ball && !pose.ballBack ? bodyT(ballRects) : null;
  if (ballG) layers.push(ballG);
  const grid: Grid = new Array(W * H);
  layers.forEach((g) => g.forEach((v, i) => v && (grid[i] = v)));
  separate(grid, headG, armsG);

  // Lift; dives are refit just above the turf. Shifts are whole sprite pixels (F cells), so the art stays on the grid.
  const box = boundsOf(grid);
  if (!box) return { grid, head: headG, torso: torsoG, pose, skel, clamped: false };
  const [x0, y0, x1, y1] = box;
  let dx = (pose.shiftX ?? 0) * F;
  let dy = -(pose.lift ?? 0) * F;
  if (pose.rotate) dy += Math.round((fy(GROUND - 3) - y1) / F) * F;
  if (y0 + dy < 2 * F) dy = Math.ceil((2 * F - y0) / F) * F;
  const want = dx;
  if (x0 + dx < 2 * F) dx = Math.ceil((2 * F - x0) / F) * F;
  if (x1 + dx > W - 2 * F) dx = Math.floor((W - 2 * F - x1) / F) * F;
  return { grid: moveGrid(grid, dx, dy), head: moveGrid(headG, dx, dy), torso: moveGrid(torsoG, dx, dy), pose, skel, clamped: dx !== want };
};

export const buildSprite = (look: SpriteLook, poseKey: string, style: TeamStyle, hel: Helmet, number: number | null | undefined, name: string, uni: Uniform): Rect[] =>
  // Signature portraits (faces.ts) replace the whole frame, background included, with their own outline
  isPortraitPose(poseKey) ? runsOf(rasterise(goldenHourPortrait(look, number)), false) : runsOf(composeSprite(look, poseKey, style, hel, number, name, uni).grid);

/** Where a pose's turf mark goes (sprite x of a 2-px stripe): under a dive's ball, just behind a toe-tap's toes. */
export interface FieldMarkAt {
  kind: FieldMark;
  x: number;
}
export const fieldMarkFor = (look: SpriteLook, poseKey: string, name: string): FieldMarkAt | null => {
  const kind = markFor(poseKey);
  if (!kind) return null;
  const b = bodyFor(look);
  const k = skeletonFor(b);
  const pose = runPose(poseKey, k, jitterFor(name));
  const sx = pose.shiftX ?? 0;
  if (kind === 'goal') {
    if (!pose.ball) return null;
    const [x] = bodyPoint([pose.ball[0], pose.ball[1] + pose.crouch], pose, k);
    return { kind, x: Math.round(x) + sx - 1 };
  }
  // Pointed foot (leg()): the toe tip is at ankle x + legT − ⌊legT / 2⌋; the stripe's right column sits under it
  const [ax] = pose.frontLeg[2];
  return { kind, x: ax + sx + b.legT - Math.floor(b.legT / 2) - 1 };
};

/** Where a raised arm touches the head, the arm's edge pixel becomes outline, so the two never merge into a blob. */
const separate = (grid: Grid, head: Grid, arms: Grid) => {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (!arms[i] || head[i] && grid[i] === head[i]) continue;
      const touches = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([a, b]) => inside(a, b) && head[at(a, b)] && !arms[at(a, b)]);
      if (touches) grid[i] = 'o';
    }
};



export const colours = (pal: Palette, look: SpriteLook, style: TeamStyle, hel: Helmet, uni: Uniform): Record<Key, string> => {
  const skin = skinColor(look.skin);
  const ramp = skinRamp(look.skin);
  const acc = look.accessories;
  const sleeve = acc.includes('sleeve-white') ? '#eef0f3' : acc.includes('sleeve-black') ? '#1b1d22' : pal.aDark;
  const pants = uni.pants;
  const hair = hairColor(look.hair.color);
  // Uniform detail slots: sleeve bands u1…, pants stripe columns p1…, sock stripe rows c1…
  const detail: Record<Key, string> = {};
  sleeveBands(uni).forEach(([col], i) => (detail[`u${i + 1}`] = col ?? uni.jersey));
  pantsBands(uni).forEach((col, i) => (detail[`p${i + 1}`] = col));
  sockBands(uni).forEach((col, i) => (detail[`c${i + 1}`] = col));
  return {
    ...detail,
    uc: uni.collar ?? uni.trim,
    us: uni.shoulder ?? uni.trim,
    n2: uni.numberOutline2 ?? uni.trim,
    tg: uni.yoke && uni.yoke !== uni.jersey ? uni.jersey : uni.trim,
    ...helmetColours(hel),
    ...faceColours(look),
    // Skin: the game's 4-tone ramp (faces.ts skinRamp, STYLE_GUIDE.md §5)
    s: ramp.base,
    d: ramp.shadow,
    u: ramp.hi,
    x: ramp.shadow,
    X: ramp.dark,
    e: '#160b00',
    w: '#ffffff',
    E: look.hair.color === 'black' || look.hair.color === 'darkbrown' ? '#160b00' : shade(hair, 0.85),
    m: ramp.dark,
    o: '#10131a',
    T: '#f4f1ea',
    k: '#0d0e12',
    V: '#262b36',
    v: '#7d8796',
    r: hair,
    R: tint(hair, 0.7),
    U: acc.includes('durag') ? '#16171c' : pal.aDark,
    J: uni.jersey,
    Y: tint(uni.jersey, 0.75),
    Z: shade(uni.jersey, 0.72),
    y: shade(uni.jersey, 0.8),
    j: uni.trim,
    Q: uni.yoke ?? uni.jersey,
    O: uni.numberOutline,
    a: style.accent,
    N: uni.number,
    P: pants,
    i: tint(pants, 0.7),
    z: shade(pants, 0.78),
    p: uni.pantsStripe ?? pants,
    K: uni.socks,
    q: shade(uni.socks, 0.82),
    c: uni.sockStripe,
    B: uni.cleats,
    F: '#8a4f22',
    f: '#f4f1ea',
    W: '#f4f5f7',
    G: acc.includes('gloves-black') ? '#1b1d22' : '#f4f5f7',
    A: sleeve,
    t: shade(skin, 0.55),
    b: '#14161b',
  };
};

