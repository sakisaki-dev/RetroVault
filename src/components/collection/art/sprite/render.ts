import type { Palette } from '../shared';
import type { TeamStyle } from '../teamStyle';
import { F, FAR, GROUND, PIX_H, PIX_W, PIX_X, line, shade, stamp, tint, type Key, type Pt, type Rect } from './grid';
import { bareHead, hairColor, helmetHair, skinColor, type HeadOpts, type SpriteLook } from './faces';
import { frontHead, helmetColours, miniHelmet, sideHead, tqHead, type Helmet } from './helmets';
import { jitterFor, runPose, type PoseOut, type Skel } from './poses';
import type { Uniform } from './uniforms';

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
export const bodyFor = (look: SpriteLook): Body => {
  const b = BUILDS[look.build];
  return look.height === 'tall' ? { ...b, torsoH: b.torsoH + 2, legH: b.legH + 4, arm: b.arm + 1 } : b;
};


// ---------- Body ----------

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
  out.push(...line(s, e, t + 1, k('J'), 0, 0.5));
  if (uni.sleeve === 'yoke') out.push(...line(s, e, t + 1, 'Q', 0, 0.25));
  if (b.ripped) out.push(...line(s, e, 1, front ? 'Y' : 'y', 0, 0.45, [0, -Math.floor((t + 1) / 2)]));
  const band = (a: Pt, b2: Pt, f: number, key: Key, wide = 0) => {
    const [x, y] = [Math.round(a[0] + (b2[0] - a[0]) * f), Math.round(a[1] + (b2[1] - a[1]) * f)];
    out.push([x - Math.floor((t + wide) / 2), y, t + wide, 1, key]);
  };
  // Sleeve stripes (count by uniform), tiger sleeves
  if (uni.sleeve === 'stripes2' || uni.sleeve === 'stripes3') {
    band(s, e, 0.3, 'j', 1);
    if (uni.sleeve === 'stripes3') band(s, e, 0.42, 'j', 1);
  }
  if (uni.sleeve === 'tiger') [0.15, 0.35].forEach((f) => band(s, e, f, 'j', 1));
  if (uni.sleeve === 'bolt') band(s, e, 0.3, 'j', 1);
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

const leg = (pts: [Pt, Pt, Pt], b: Body, front: boolean, uni: Uniform): Rect[] => {
  const k = (x: Key): Key => (front ? x : (FAR[x] ?? x));
  const [hp, kn, an] = pts;
  const t = b.legT;
  const out: Rect[] = [...line(hp, kn, t + 1, k('P')), ...line(kn, an, t, k('K')), ...line(kn, an, t, k('P'), 0, 0.3)];
  // Calf bump, sock stripe, quad highlight, team stripe down the pants
  out.push(...line(kn, an, t + 1, k('K'), 0.35, 0.6));
  // Sock stripe: one row in the team trim (the only accent below the pants stripe)
  {
    const f = 0.5;
    const [x, y] = [Math.round(kn[0] + (an[0] - kn[0]) * f), Math.round(kn[1] + (an[1] - kn[1]) * f)];
    out.push([x - Math.floor(t / 2), y, t, 1, 'c']);
  }
  if (front) {
    out.push(...line(hp, kn, 1, 'i', 0.15, 0.8, [0, -Math.floor((t + 1) / 2)]));
    if (uni.pantsStripe) out.push(...line(hp, kn, 1, 'p', 0, 0.9, [1, 0]));
  }
  const [ax, ay] = an;
  out.push([ax - Math.floor(t / 2), ay, t + 2, 2, 'B'], [ax + Math.ceil(t / 2), ay + 1, 1, 1, 'B']);
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
  // Shoulder yoke, piping on the pad caps, bumblebee bands, collar trim
  if (uni.sleeve === 'yoke') R.push([cx - b.sh, sy, b.sh * 2 + 1, 2, 'Q'], [cx - b.sh, sy + 2, b.sh * 2 + 1, 1, 'j']);
  else if (uni.sleeve !== 'none') R.push([cx - b.sh, sy + 2, 1, 1, 'j'], [cx + b.sh, sy + 2, 1, 1, 'j']);
  if (uni.sleeve === 'bands') for (let y = sy + 4; y < sy + b.torsoH - 1; y += 3) R.push([cx - b.sh, y, b.sh * 2 + 1, 1, 'j']);
  R.push([cx - 2, sy - 1, 5, 1, 'j'], [cx, sy, 1, 1, 'Z']);
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
    // Outline on the fine grid: half a sprite pixel round each digit cell
    const h = 1 / F;
    cells.forEach(([cx, cy]) => out.push([cx - h, cy - h, 1 + 2 * h, 1 + 2 * h, uni.numberStyle === 'double' ? 'O' : 'O']));
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

/** Rotate (nearest cell, around the hips), lift, then keep the figure inside the frame (dives refit above the turf). */
const transform = (g: Grid, pose: PoseOut, pivot: Pt, cx: number): Grid => {
  let out = g;
  const px = fx(pivot[0]);
  const py = fy(pivot[1]);
  if (pose.rotate) {
    const r = (-pose.rotate * Math.PI) / 180;
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
    out = n;
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (out[at(x, y)]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (!Number.isFinite(x0)) return out;
  // Shifts in whole sprite pixels (F cells), so the art stays on the sprite grid
  let dx = 0;
  let dy = -(pose.lift ?? 0) * F;
  if (pose.rotate) {
    dx = Math.round((fx(cx + 2) - (x0 + x1) / 2) / F) * F;
    dy = Math.round((fy(GROUND - 3) - y1) / F) * F - (pose.lift ?? 0) * F;
  }
  if (y0 + dy < 2 * F) dy = Math.ceil((2 * F - y0) / F) * F;
  if (x0 + dx < 2 * F) dx = Math.ceil((2 * F - x0) / F) * F;
  if (x1 + dx > W - 2 * F) dx = Math.floor((W - 2 * F - x1) / F) * F;
  if (!dx && !dy) return out;
  const n: Grid = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (out[at(x, y)] && inside(x + dx, y + dy)) n[at(x + dx, y + dy)] = out[at(x, y)];
  return n;
};

const NEIGH = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** One-sprite-pixel dark outline around the figure (F fine cells), then horizontal runs of one colour. */
export const runsOf = (grid: Grid): Rect[] => {
  let out = grid.slice();
  for (let pass = 0; pass < F; pass++) {
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

export const buildSprite = (look: SpriteLook, poseKey: string, style: TeamStyle, hel: Helmet, number: number | null | undefined, name: string, uni: Uniform): Rect[] => {
  const b = bodyFor(look);
  const cx = 22;
  const hy = GROUND - 2 - b.legH;
  const sy = hy - b.torsoH;
  const skel: Skel = { cx, sy, hy, fs: cx + b.sh - 1, bs: cx - b.sh + 1, fh: cx + 2, bh: cx - 2, A: b.arm, L: b.legH, h: Math.round(b.legH / 2), G: GROUND - 2 };
  const pose = runPose(poseKey, skel, jitterFor(name));
  const c = pose.crouch;
  const down = ([x, y]: Pt): Pt => [x, y + c];
  const upper = (pts: [Pt, Pt, Pt]) => pts.map(down) as [Pt, Pt, Pt];
  const legPts = (pts: [Pt, Pt, Pt]): [Pt, Pt, Pt] => [down(pts[0]), [pts[1][0], pts[1][1] + Math.ceil(c / 2)], pts[2]];
  const tall = look.height === 'tall' ? 3 : 0;
  const nod = pose.nod ?? 0;
  const opts: HeadOpts = { look, pose, style, hel };

  // Head placement by kind
  let headBehind: Rect[] = [];
  let headFront: Rect[];
  if (pose.helmetOff) {
    headFront = bareHead(cx - 7 + pose.lean, sy + c - 15 + nod, opts, tall);
  } else if (pose.look === 'front') {
    headFront = frontHead(cx - 9 + pose.lean, sy + c - 15 + nod, opts);
  } else if (pose.look === 'tq') {
    headFront = tqHead(cx - 8 + pose.lean, sy + c - 15 + nod, opts);
  } else {
    const hx = cx - 11 + pose.lean;
    const hyy = sy + c - 15 + nod;
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

  const backArm = arm(upper(pose.backArm), b, look, false, !!pose.backPalm, uni);
  const frontArm = arm(upper(pose.frontArm), b, look, true, !!pose.palm, uni);
  const rects: Rect[] = [
    ...(pose.ballBack ? ballRects : []),
    ...(pose.armsFront ? [] : backArm),
    ...(pose.helmetAt === 'hand' ? helmetRects : []),
    ...leg(legPts(pose.backLeg), b, false, uni),
    ...headBehind,
    ...torso(cx, sy + c, b, uni),
    ...(number != null && !pose.armsFront ? numberRects(number, cx + 1, sy + c + 4, uni) : []),
    ...leg(legPts(pose.frontLeg), b, true, uni),
    ...(pose.helmetAt === 'feet' ? helmetRects : []),
    ...headFront,
    ...(pose.armsFront ? backArm : []),
    ...frontArm,
  ];
  // A tucked ball sits over the front arm
  if (pose.ball && !pose.ballBack) rects.push(...ballRects);
  const grid = rasterise(rects);
  separate(grid, rasterise(headFront), rasterise([...frontArm, ...(pose.armsFront ? backArm : [])]));
  return runsOf(transform(grid, pose, [cx, hy], cx));
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
  const acc = look.accessories;
  const sleeve = acc.includes('sleeve-white') ? '#eef0f3' : acc.includes('sleeve-black') ? '#1b1d22' : pal.aDark;
  const pants = uni.pants;
  const hair = hairColor(look.hair.color);
  return {
    ...helmetColours(hel),
    s: skin,
    d: shade(skin, 0.8),
    u: tint(skin, 0.75),
    x: shade(skin, 0.78),
    X: shade(skin, 0.68),
    e: '#15121a',
    w: '#f4f1ea',
    E: shade(hair, 0.85),
    m: shade(skin, 0.45),
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

