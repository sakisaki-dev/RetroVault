import {
  PENS,
  PRESTIGE,
  eraOf,
  hash,
  identity,
  lerp,
  lum,
  rng,
  serialStr,
  type AutoEra,
  type AutographRoll,
  type AutographSnapshot,
  type Pen,
  type SignForm,
  type SignIdentity,
} from '@/config/autographs';
import { fontReady } from './fonts';
import type { AutoFigure, AutoSprite } from './figure';

/**
 * Autograph card renderer (canvas 2D), ported from the approved Autograph Room prototype. Everything is drawn in a
 * logical 500 × 700 card and scaled to the canvas's pixel size, so a binder tile and the hero reveal are the same card.
 *
 * Layers, bottom to top: the era design (Leather, Broadcast, Prizm, Night Game, Current, with his jersey number and club
 * colours), the prestige layer (chalk play for his position seeded by his name, nickname watermark in his own hand, an
 * aura in his club colour that grows with his Career Legacy tier, light rays and gold dust for Elite and Legendary, a
 * vignette, one ring per title, the Hall of Fame seal, a rim light), paper grain, the header (AUTHENTIC AUTOGRAPH, the
 * serial) and footer (name, position, number, club, era), the parallel's mount (sticker label, jersey patch, framed cut),
 * then the signature. No stats anywhere: it renders from the frozen snapshot only.
 *
 * renderLayers keeps the signature on its own layer so the reveal can write it left to right (compose with reveal < 1)
 * without redrawing the card; renderAutograph composes the finished card and caches it by autograph id and size.
 */

export const CARD_W = 500;
/** The card shape every collectible uses (collection.css .fut: aspect 100 / 142, the FUT shield) */
export const CARD_H = 710;
/** The FUT shield (collection.css --fut-clip) in card fractions: notched top corners, a point from 85% down */
const SHIELD: [number, number][] = [
  [0, 8.5], [6, 4.2], [17, 3], [27, 0.6], [73, 0.6], [83, 3], [94, 4.2], [100, 8.5],
  [100, 85], [90, 91], [66, 95.4], [50, 100], [34, 95.4], [10, 91], [0, 85],
];
/** Layout lines inside the shield: everything with text stays above NAME_BOTTOM (where the point starts) and below
 *  HEADER_BOTTOM; only background art runs into the notched corners and the point */
const HEADER_BOTTOM = 0.12;
const NAME_TOP = 0.71;
const NAME_BOTTOM = 0.85;
function shieldPath(ctx: Ctx, W: number, H: number) {
  ctx.beginPath();
  SHIELD.forEach(([x, y], i) => (i ? ctx.lineTo((x / 100) * W, (y / 100) * H) : ctx.moveTo((x / 100) * W, (y / 100) * H)));
  ctx.closePath();
}

/** Pixel scale of the render in progress (shadow blur and offsets are not scaled by the transform). */
let K = 1;

type Ctx = CanvasRenderingContext2D;
type Fill = string | CanvasGradient;

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const rrect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  const q = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
};

const shade = (hex: string, k: number) => {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => Math.round(Math.min(255, Math.max(0, parseInt(h.slice(i, i + 2), 16) * k))));
  return `rgb(${v.join(',')})`;
};
const mixHex = (a: string, b: string, t: number) => {
  const pa = [0, 2, 4].map((i) => parseInt(a.slice(1 + i, 3 + i), 16));
  const pb = [0, 2, 4].map((i) => parseInt(b.slice(1 + i, 3 + i), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
};
/** His brighter club colour (a near-black primary falls back to the secondary). */
const light = (p: AutographSnapshot) => (lum(p.c1) < 0.03 ? p.c2 : p.c1);
const rgbOf = (hex: string) => {
  const c = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',');
};

let noiseTile: HTMLCanvasElement | null = null;
const noise = () => {
  if (noiseTile) return noiseTile;
  const n = canvas(160, 160);
  const c = n.getContext('2d')!;
  const im = c.createImageData(160, 160);
  const r = rng(7);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 120 + r() * 135;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 18;
  }
  c.putImageData(im, 0, 0);
  noiseTile = n;
  return n;
};

const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const BODY = '"Barlow", "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const sigFont = (family: string) => `${family}, cursive`;

/**
 * Fits one line of card type to `maxW` (logical units): the largest size from `size` down to `min` at which its inked
 * width fits, and only at the minimum is it shortened with an ellipsis. Sets ctx.font and returns the text to draw (with
 * no maxWidth, so nothing is squeezed out of shape).
 */
function fitText(ctx: Ctx, text: string, maxW: number, size: number, min: number, font: (s: number) => string) {
  const width = () => {
    const m = ctx.measureText(text);
    const ink = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? 0);
    return Math.max(m.width, ink);
  };
  let s = size;
  ctx.font = font(s);
  let tw = width();
  for (let i = 0; i < 4 && tw > maxW && s > min; i++) {
    s = Math.max(min, Math.floor(((s * maxW) / tw) * 0.98 * 10) / 10);
    ctx.font = font(s);
    tw = width();
  }
  if (tw <= maxW) return text;
  let t = text;
  const fits = (x: string) => {
    const m = ctx.measureText(x);
    return Math.max(m.width, (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? 0)) <= maxW;
  };
  while (t.length > 1 && !fits(`${t.trimEnd()}…`)) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// ---------- Ink ----------

/** Relative luminance of a #rrggbb colour (WCAG). */
const relLum = (hex: string) => {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0.2;
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** Darkens a #rrggbb colour until its luminance is at most `target`. */
const darkenTo = (hex: string, target: number) => {
  let rgb = [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16));
  for (let k = 0; k < 24 && relLum(`#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`) > target; k++) rgb = rgb.map((v) => Math.round(v * 0.88));
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
/** Light paper (a sticker, the cut) or light card art behind the signature */
const LIGHT_BG = 0.55;

const inkFill = (ctx: Ctx, ink: string, x0: number, y0: number, x1: number, y1: number, team: string, bg = 0.1): Fill => {
  if (ink === 'gold' || ink === 'silver') {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    // On white paper a paint pen reads as the deeper, burnished metal; on dark card art, the bright one
    const stops = bg > LIGHT_BG
      ? ink === 'gold' ? ['#c9902a', '#9a6208', '#6e4304', '#b97f17', '#5c3802'] : ['#7d8596', '#565d6c', '#3a404d', '#6d7585', '#30353f']
      : ink === 'gold' ? ['#fff1b8', '#ffc83d', '#b8740f', '#ffe08a', '#9a5b07'] : ['#ffffff', '#c9ced8', '#7f8796', '#eef1f6', '#6c7380'];
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  if (ink === 'team') return bg > LIGHT_BG ? darkenTo(team, 0.12) : team;
  return ink;
};
/** Approximate luminance of an ink as it will be drawn (metallic inks by their mid tone). */
const inkLum = (ink: string, team: string, bg: number) =>
  ink === 'gold' ? (bg > LIGHT_BG ? 0.16 : 0.5) : ink === 'silver' ? (bg > LIGHT_BG ? 0.11 : 0.6) : relLum(ink === 'team' ? (bg > LIGHT_BG ? darkenTo(team, 0.12) : team) : ink);

// ---------- Signature ----------

export interface SigPull {
  id: SignIdentity;
  pen: Pen;
  ink: string;
  team: string;
  seed: number;
  inscription?: string;
  /** Relative luminance (0–1) of what the signature is written on, when `under` is not given */
  bg?: number;
  /** The card drawn so far: the luminance right under the fitted ink is read from it (readability, below) */
  under?: Ctx;
  /** Ink of the inscription when it differs from the signature's (the inscribed figure design's gold paint pen) */
  insInk?: string;
  /** Start from a size that fills the box (the figure designs): the fit then only ever scales it down to the largest
   *  size that stays inside */
  fill?: boolean;
}

/** What the signature was drawn with after the readability check (the rolled ink and its value never change). */
export interface SigInk {
  /** The colour drawn: the rolled ink, or the contrasting pen it was swapped to */
  drawn: string;
  swapped: boolean;
  /** A thin keyline in the opposite tone under the strokes */
  outline: boolean;
  /** Contrast of the drawn ink against the mean luminance under it, and against its darkest / lightest patch */
  contrast: number;
  worst: number;
}

/** A rectangle in logical card units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An inscription's usual smallest size on the card, and the least it is shrunk to before it is shortened (logical
 *  units; the card is 500 wide). */
const INS_SIZE = 16;
/** The inscribed figure design's gold paint-pen inscription is written larger. */
const INS_SIZE_GOLD = 22;
const INS_MIN = 13;
/** A full-name or initial-and-surname signature fitted below this share of its natural size is written stacked instead
 *  (first name over surname), which keeps the letters bigger in a short box. */
const RESTACK_BELOW = 0.62;
/** Readability (drawSignature): swap the drawn ink below SWAP_BELOW against the mean under it; keyline below READ_MIN
 *  against the mean or READ_WORST against its darkest / lightest patch; the keyline's offset and the thinnest stroke
 *  drawn (device pixels). */
const SWAP_BELOW = 1.7;
const READ_MIN = 3;
const READ_WORST = 2;
const DARK_SWAP = '#15161b';
const LIGHT_SWAP = '#f4f6ff';
const KEYLINE = 1.3;
const MIN_STROKE = 0.7;
/** Margin around the card on the measuring layer, so ink far off the card is still seen. */
const MEASURE_PAD = 200;

let measureLayer: HTMLCanvasElement | null = null;
const measureCanvas = () => (measureLayer ??= canvas(CARD_W + MEASURE_PAD * 2, CARD_H + MEASURE_PAD * 2));

/** Box of everything inked on the measuring layer, in logical units, or null when it is blank. */
function inkBounds(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings)!;
  const { width: cw, height: ch } = c;
  const d = ctx.getImageData(0, 0, cw, ch).data;
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let y = 0; y < ch; y++) {
    const row = y * cw * 4;
    let first = -1, lastX = -1;
    for (let x = 0; x < cw; x++) if (d[row + x * 4 + 3] > 24) { first = x; break; }
    if (first < 0) continue;
    for (let x = cw - 1; x >= first; x--) if (d[row + x * 4 + 3] > 24) { lastX = x; break; }
    if (first < x0) x0 = first;
    if (lastX > x1) x1 = lastX;
    if (y < y0) y0 = y;
    y1 = y;
  }
  if (x1 < 0) return null;
  return { x0: x0 - MEASURE_PAD, y0: y0 - MEASURE_PAD, x1: x1 + 1 - MEASURE_PAD, y1: y1 + 1 - MEASURE_PAD };
}

/** How a signature is fitted to its box: scaled by s about its anchor, moved by (ox, oy), written in `mode`. */
interface SigFit {
  s: number;
  ox: number;
  oy: number;
  mode: SignForm;
  /** The fitted ink's box (logical units), from the last measure */
  b?: { x0: number; y0: number; x1: number; y1: number };
}
const FIT_MAX = 400;
const fits = new Map<string, SigFit>();

/** Shortens `text` with an ellipsis until it measures at most `maxW` in the current font. */
const ellipsize = (c: Ctx, text: string, maxW: number) => {
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t.trimEnd()}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
};

/**
 * Draws a signature centred on (cx, cy) with width budget w (logical units) onto `out` (a layer at the target's pixel
 * size): the strokes on a scratch layer, then composited with the pen's character (bleed or metallic shadow,
 * ballpoint skips).
 *
 * With a `box`, the whole ink (letters, slant, flourish and inscription) is fitted inside it: the strokes are drawn once
 * on a measuring layer at one pixel per unit, their inked bounding box is read back, and the signature is scaled down
 * about its anchor and nudged until that box sits inside (a long full name that would end up too small is written
 * stacked instead). The fit is measured at a fixed scale and cached, so a binder tile and the hero card match, and the
 * same autograph always lands the same way. A signature that already fits is drawn exactly as before.
 */
export function drawSignature(out: Ctx, name: string, cx: number, cy: number, w: number, pull: SigPull, box?: Box) {
  const id = pull.id;
  const hand = id.hand;
  const pen = pull.pen;
  let bg = pull.bg ?? 0.1;
  const parts = name.split(' ');
  const fontOf = (s: number) => `${s}px ${sigFont(hand.font)}`;
  const weight = pen.weight;
  const wob = 0.6 + id.mess * 2.4;

  /**
   * Every stroke of the signature and its inscription onto `c` at pixel scale k, scaled by s about (cx + ox, cy + oy)
   * and shifted `dev` pixels on the canvas (the measuring margin). Replays the same random draws on every call.
   */
  const ink = (c: Ctx, k: number, s: number, ox: number, oy: number, mode: SignForm, dev = 0, drawnInk = pull.ink) => {
    const r = rng(hash('pull:' + name + ':' + pull.seed));
    const slant = ((id.slant + (r() - 0.5) * 8) * Math.PI) / 180;
    const sizeJ = id.size * (1 + (r() - 0.5) * 0.12);
    let first = parts[0];
    const last = parts.slice(1).join(' ') || parts[0];
    if (parts.length < 2) first = '';
    // forms that write a shortened name use the full-name layout
    if (mode === 'initlast' && first) first = first[0] + '.';
    if (mode === 'lastonly') first = '';
    let px = Math.max(30, w / Math.max(5, name.length * 0.42)) * hand.size * sizeJ;
    if (pull.fill && box) px = Math.max(px, box.h * FILL_PX * hand.size * sizeJ);
    const color = inkFill(c, drawnInk, cx - w / 2, cy - px, cx + w / 2, cy + px, pull.team, bg);
    const anchor = () => c.setTransform(k * s, 0, 0, k * s, (cx + ox) * k + dev, (cy + oy) * k + dev);
    anchor();
    c.transform(1, 0, -Math.tan(slant) * 0.55, 1, 0, 0);
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';

    const strokeText = (t: string, x: number, y: number, sz: number, rot = 0) => {
      if (!t) return;
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.font = fontOf(sz);
      if (pen.nib) {
        for (let q = 0; q < 6; q++) c.fillText(t, q * sz * 0.012, -q * sz * 0.012);
      } else {
        c.fillText(t, 0, 0);
        // never thinner than MIN_STROKE device pixels, so a hairline script still reads on a binder tile
        c.lineWidth = Math.max(0.6, sz * 0.03 * weight, MIN_STROKE / (k * s));
        c.strokeText(t, 0, 0);
      }
      c.restore();
    };
    const measure = (t: string, sz: number) => {
      c.font = fontOf(sz);
      return c.measureText(t).width;
    };

    // Procedural stroke: a smooth path with pen-dependent width
    const path = (pts: [number, number][], base: number) => {
      if (pts.length < 2) return;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        let lw = base * weight;
        if (pen.nib) {
          const a = Math.atan2(y1 - y0, x1 - x0);
          lw = base * (0.25 + 1.4 * Math.abs(Math.sin(a - Math.PI / 4)));
        }
        const t = i / pts.length;
        lw *= 0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.1));
        c.lineWidth = Math.max(0.7, lw);
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
      }
    };
    const tail = (x: number, y: number, len: number, amp: number, freq: number, loops: boolean): [number, number] => {
      const pts: [number, number][] = [];
      const n = Math.max(24, Math.round(len / 3));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        let xx = x + t * len;
        let yy = y - Math.sin(t * Math.PI * freq + id.seedA * 6) * amp * (1 - t * 0.6) + (r() - 0.5) * wob;
        if (loops && Math.sin(t * Math.PI * freq) > 0.94) {
          const a = t * 40;
          xx += Math.cos(a) * amp * 0.25;
          yy += Math.sin(a) * amp * 0.25;
        }
        pts.push([xx, yy]);
      }
      path(pts, px * 0.045);
      return pts[pts.length - 1];
    };

    // Lay out by mode, centred: measure first, then draw from -total/2
    let endX = 0;
    let baseY = 0;
    let startX = 0;
    let capH = px * 0.7;
    if (mode === 'full' || mode === 'stacked' || mode === 'initlast' || mode === 'lastonly') {
      const fw = first ? measure(first, px) : 0;
      const lw = measure(last, px);
      let total = fw + lw + px * (0.25 + id.track * 4);
      if (mode === 'stacked') total = Math.max(fw * 0.7, lw);
      const fit = Math.min(1, (w * 0.92) / total);
      px *= fit;
      capH = px * 0.7;
      if (mode === 'stacked' && first) {
        const fw2 = measure(first, px * 0.72);
        const lw2 = measure(last, px);
        const left = -Math.max(fw2 + px * 0.2, lw2) / 2;
        strokeText(first, left, -px * 0.42, px * 0.72, id.drift * 0.4);
        strokeText(last, left + px * 0.2, px * 0.34, px, id.drift * 0.4);
        startX = left;
        endX = left + px * 0.2 + lw2;
        baseY = px * 0.34;
      } else {
        const fw2 = first ? measure(first, px) : 0;
        const gap = first ? px * (0.25 + id.track * 4) : 0;
        const left = -(fw2 + gap + measure(last, px)) / 2;
        if (first) strokeText(first, left, -id.drift * px * 0.3, px, id.drift * 0.25);
        strokeText(last, left + fw2 + gap, id.drift * px * 0.3, px, id.drift * 0.25);
        startX = left;
        endX = left + fw2 + gap + measure(last, px);
        baseY = id.drift * px * 0.3;
      }
    } else if (mode === 'initials') {
      const words = parts;
      const big = px * 1.15;
      const widths = words.map((wd) => measure(wd[0], big) + Math.min(w * 0.3, wd.length * px * 0.2));
      const total = widths.reduce((a, b) => a + b, 0) + px * 0.2 * (words.length - 1);
      const fit = Math.min(1, (w * 0.9) / total);
      let x = (-total * fit) / 2;
      words.forEach((wd, i) => {
        const sz = big * fit;
        strokeText(wd[0], x, (i % 2 ? 1 : -1) * id.drift * sz * 0.4, sz, id.drift * 0.2);
        const iw = measure(wd[0], sz);
        const tl = Math.min(w * 0.3, wd.length * px * 0.2) * fit;
        const e = tail(x + iw * 0.85, -sz * 0.12, tl, sz * 0.1, 3 + (wd.length % 4), id.mess > 0.5);
        x += iw + tl + px * 0.2 * fit;
        endX = e[0];
        baseY = e[1];
      });
      startX = (-total * fit) / 2;
    } else {
      // scrawl: a big first initial, a wave, a mid-size last initial, a long tail
      const big = px * 1.25;
      const fi = parts[0][0];
      const li = (parts[parts.length - 1] || '')[0] || '';
      const iw = measure(fi, big);
      const total = Math.min(w * 0.92, iw + px * 3.6);
      const left = -total / 2;
      strokeText(fi, left, 0, big, id.drift * 0.2);
      const e1 = tail(left + iw * 0.8, -big * 0.15, total * 0.32, big * 0.12, 4 + Math.round(id.seedB * 3), true);
      strokeText(li, e1[0] - px * 0.05, e1[1] + big * 0.12, big * 0.72, id.drift * 0.2);
      const lw = measure(li, big * 0.72);
      const e2 = tail(e1[0] + lw * 0.7, e1[1] - big * 0.02, Math.max(px, left + total - (e1[0] + lw * 0.7)), big * 0.08, 5, id.mess > 0.4);
      startX = left;
      endX = e2[0];
      baseY = e2[1];
    }

    // Flourish (identity)
    const fw = px * 0.05;
    const f = id.flourish;
    const ux0 = startX - px * 0.1;
    const ux1 = endX + px * 0.15;
    const uy = baseY + px * 0.32;
    const curve = (x0: number, y0: number, cx1: number, cy1: number, cx2: number, cy2: number, x1: number, y1: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const it = 1 - t;
        pts.push([
          it * it * it * x0 + 3 * it * it * t * cx1 + 3 * it * t * t * cx2 + t * t * t * x1,
          it * it * it * y0 + 3 * it * it * t * cy1 + 3 * it * t * t * cy2 + t * t * t * y1 + (r() - 0.5) * wob * 0.6,
        ]);
      }
      return pts;
    };
    if (f === 'swoosh' || f === 'double') {
      path(curve(ux0, uy + px * 0.08, lerp(ux0, ux1, 0.3), uy + px * 0.22, lerp(ux0, ux1, 0.7), uy - px * 0.02, ux1, uy - px * 0.28), fw);
      if (f === 'double') path(curve(ux0 + px * 0.3, uy + px * 0.22, lerp(ux0, ux1, 0.4), uy + px * 0.32, lerp(ux0, ux1, 0.75), uy + px * 0.12, ux1 - px * 0.2, uy - px * 0.06), fw * 0.8);
    } else if (f === 'loop') {
      const mid = lerp(ux0, ux1, 0.45);
      const pts = curve(ux0, uy, lerp(ux0, mid, 0.5), uy + px * 0.15, mid - px * 0.2, uy + px * 0.1, mid, uy);
      for (let i = 0; i <= 36; i++) {
        const a = -Math.PI / 2 + (i / 36) * Math.PI * 2;
        pts.push([mid + Math.cos(a) * px * 0.18, uy - px * 0.18 + Math.sin(a) * px * 0.18]);
      }
      pts.push(...curve(mid, uy, lerp(mid, ux1, 0.4), uy + px * 0.08, lerp(mid, ux1, 0.8), uy - px * 0.05, ux1, uy - px * 0.2));
      path(pts, fw);
    } else if (f === 'slash') {
      path(curve(startX - px * 0.15, -capH * 0.2, startX + px * 0.4, -capH * 0.35, lerp(startX, endX, 0.5), -capH * 0.3, endX + px * 0.1, -capH * 0.55), fw * 0.9);
    } else if (f === 'swirl') {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const a = t * Math.PI * 3.2;
        const rr = px * 0.32 * (1 - t * 0.75);
        pts.push([endX + px * 0.1 + Math.cos(a) * rr + t * px * 0.25, baseY - px * 0.05 + Math.sin(a) * rr]);
      }
      path(pts, fw);
    } else if (f === 'star' || f === 'dot') {
      c.save();
      c.translate(endX + px * 0.22, baseY - capH * 0.95);
      c.beginPath();
      if (f === 'star') {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? px * 0.06 : px * 0.15;
          c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
      } else c.arc(0, 0, px * 0.06, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // Inscription (per pull, frozen at the pull): written at least INS_SIZE on the card however far the signature is
    // scaled down (sizes below are in the signature's own units, so on the card they are × s), no wider than the box,
    // shrunk to INS_MIN, then shortened
    if (pull.inscription) {
      c.save();
      anchor();
      const ix = px * 0.2;
      const room = Math.max(40, (box?.w ?? w) * 0.94 - Math.abs(ix) * 2 * s) / s;
      let sz = Math.max((pull.insInk ? INS_SIZE_GOLD : INS_SIZE) / s, px * (pull.insInk ? 0.46 : 0.36));
      c.font = fontOf(sz);
      const tw = c.measureText(pull.inscription).width;
      if (tw > room) {
        sz = Math.max(INS_MIN / s, (sz * room) / tw);
        c.font = fontOf(sz);
      }
      c.textAlign = 'center';
      c.fillStyle = pull.insInk ? inkFill(c, pull.insInk, -w / 2, 0, w / 2, px, pull.team, bg) : color;
      c.rotate(-0.04 + id.drift * 0.1);
      c.fillText(ellipsize(c, pull.inscription, room), ix, px * 0.95);
      c.restore();
    }
    return { px, color };
  };

  // Fit to the box: measure the ink at one pixel per unit, scale it down about its anchor and nudge it inside
  const fitKey = box
    ? [name, pull.seed, pen.id, pull.inscription ?? '', cx, cy, w, box.x, box.y, box.w, box.h, pull.fill ? 'fill' : '', pull.insInk ?? '', fontReady(`40px ${hand.font}`) ? 1 : 0].join('|')
    : '';
  let fit: SigFit = (fitKey && fits.get(fitKey)) || { s: 1, ox: 0, oy: 0, mode: hand.mode };
  if (box && !fits.has(fitKey)) {
    const mcv = measureCanvas();
    const mc = mcv.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings)!;
    const bounds = (f: SigFit) => {
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.clearRect(0, 0, mcv.width, mcv.height);
      ink(mc, 1, f.s, f.ox, f.oy, f.mode, MEASURE_PAD);
      return inkBounds(mcv);
    };
    const solve = (mode: SignForm): SigFit => {
      const f: SigFit = { s: 1, ox: 0, oy: 0, mode };
      const bx1 = box.x + box.w;
      const by1 = box.y + box.h;
      for (let i = 0; i < 12; i++) {
        const b = bounds(f);
        if (b) f.b = b;
        if (!b || (b.x0 >= box.x && b.x1 <= bx1 && b.y0 >= box.y && b.y1 <= by1)) return f;
        // the ink in the signature's own units, then the scale that fits it (a hair more after the first pass, for the
        // few things that don't scale: minimum line widths, the wobble)
        const ax = cx + f.ox;
        const ay = cy + f.oy;
        const l = { x0: (b.x0 - ax) / f.s, x1: (b.x1 - ax) / f.s, y0: (b.y0 - ay) / f.s, y1: (b.y1 - ay) / f.s };
        const need = Math.min(1, box.w / (b.x1 - b.x0), box.h / (b.y1 - b.y0));
        if (need < 1) f.s *= need * (i ? 0.985 : 0.995);
        else if (i > 2) f.s *= 0.99;
        const shift = (o: number, a: number, l0: number, l1: number, lo: number, hi: number) => {
          const p0 = a + o + f.s * l0;
          const p1 = a + o + f.s * l1;
          if (p1 - p0 > hi - lo) return o + (lo + hi) / 2 - (p0 + p1) / 2;
          if (p0 < lo) return o + lo - p0;
          if (p1 > hi) return o - (p1 - hi);
          return o;
        };
        f.ox = shift(f.ox, cx, l.x0, l.x1, box.x, bx1);
        f.oy = shift(f.oy, cy, l.y0, l.y1, box.y, by1);
      }
      return f;
    };
    fit = solve(hand.mode);
    if (fit.s < RESTACK_BELOW && (hand.mode === 'full' || hand.mode === 'initlast') && parts.length > 1) {
      const stacked = solve('stacked');
      if (stacked.s > fit.s) fit = stacked;
    }
    fits.set(fitKey, fit);
    while (fits.size > FIT_MAX) fits.delete(fits.keys().next().value!);
  }

  // Readability: the luminance right under the fitted ink, read from the card drawn so far (art, figure, mount). An ink
  // too close to it is swapped to a contrasting pen for this card (dark on light, white on dark; metallic paint pens
  // keep their metal, burnished on light and bright on dark); an ink still short of READ_MIN against the mean, or of
  // READ_WORST against its darkest or lightest patch, gets a thin keyline in the opposite tone, the way a paint pen
  // is outlined on a busy photo. The roll (pen, ink, value) is untouched: only the drawn colour changes.
  let cells: number[] = [];
  if (pull.under && fit.b) {
    const u = underLuminance(pull.under, fit.b);
    if (u) {
      bg = u.mean;
      cells = u.cells;
    }
  }
  let drawnInk = pull.ink;
  const metal = (x: string) => x === 'gold' || x === 'silver';
  let inkL = inkLum(drawnInk, pull.team, bg);
  if (!metal(drawnInk) && contrast(inkL, bg) < SWAP_BELOW) {
    drawnInk = inkL > bg || bg > LIGHT_BG ? DARK_SWAP : LIGHT_SWAP;
    inkL = inkLum(drawnInk, pull.team, bg);
  }
  const ratio = contrast(inkL, bg);
  const worst = cells.length ? Math.min(...cells.map((x) => contrast(inkL, x))) : ratio;
  const outline = ratio < READ_MIN || worst < READ_WORST;
  const sigInk: SigInk = { drawn: drawnInk, swapped: drawnInk !== pull.ink, outline, contrast: ratio, worst };

  const L = canvas(out.canvas.width, out.canvas.height);
  const c = L.getContext('2d')!;
  const { px, color } = ink(c, K, fit.s, fit.ox, fit.oy, fit.mode, 0, drawnInk);
  const fx = cx + fit.ox;
  const fy = cy + fit.oy;

  // the keyline tone that contrasts most with the ink itself (the two tones cross at a luminance of about 0.18)
  const inkIsLight = inkL > 0.18;
  if (outline) {
    // the keyline: the strokes in the opposite tone, offset a hair in eight directions
    const T = canvas(L.width, L.height);
    const t = T.getContext('2d')!;
    t.drawImage(L, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = inkIsLight ? 'rgba(8,10,20,0.92)' : 'rgba(255,255,255,0.95)';
    t.fillRect(0, 0, T.width, T.height);
    const d = Math.max(1, KEYLINE * K);
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 8; i++) out.drawImage(T, Math.cos((i * Math.PI) / 4) * d, Math.sin((i * Math.PI) / 4) * d);
    out.restore();
  }
  // Contrast: when the ink and what it's written on are too close, a soft halo in the opposite tone goes under the
  // strokes first (a dark halo for a light ink on light art, a light one for a dark ink on dark art)
  if (ratio < 3.2) {
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.shadowColor = inkL > bg ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
    out.shadowBlur = (ratio < 1.8 ? 7 : 5) * K;
    out.globalAlpha = 0.9;
    for (let i = 0; i < (ratio < 1.8 ? 3 : 2); i++) out.drawImage(L, 0, 0);
    out.restore();
  }
  // Composite with the pen's character
  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  if (pen.metallic) {
    out.shadowColor = 'rgba(0,0,0,0.55)';
    out.shadowBlur = 2 * K;
    out.shadowOffsetY = 1.5 * K;
  } else {
    out.shadowColor = typeof color === 'string' ? color : 'rgba(0,0,0,.4)';
    out.shadowBlur = pen.bleed * 1.4 * K;
  }
  out.globalAlpha = drawnInk === 'team' ? 0.95 : 0.97;
  out.drawImage(L, 0, 0);
  out.restore();
  if (pen.skip) {
    // ballpoint skips: knock out thin streaks along the stroke direction (on the signature layer only)
    out.save();
    out.setTransform(K, 0, 0, K, 0, 0);
    out.globalCompositeOperation = 'destination-out';
    out.globalAlpha = 0.35;
    const sr = rng(hash('skip:' + name + pull.seed));
    const sw = w * fit.s;
    const sp = px * fit.s;
    for (let i = 0; i < 70; i++) out.fillRect(fx - sw / 2 + sr() * sw, fy - sp + sr() * sp * 1.8, 2 + sr() * 9, 0.9);
    out.restore();
  }
  return { px, fit, ink: sigInk };
}

/** Mean relative luminance under a box of the card (logical units), overall and in a 6 × 3 grid of patches. */
function underLuminance(ctx: Ctx, b: { x0: number; y0: number; x1: number; y1: number }) {
  try {
    const x = Math.max(0, Math.floor(b.x0 * K));
    const y = Math.max(0, Math.floor(b.y0 * K));
    const w = Math.min(ctx.canvas.width - x, Math.ceil((b.x1 - b.x0) * K));
    const h = Math.min(ctx.canvas.height - y, Math.ceil((b.y1 - b.y0) * K));
    if (w < 2 || h < 2) return null;
    const d = ctx.getImageData(x, y, w, h).data;
    const GX = 6;
    const GY = 3;
    const sum = new Array(GX * GY).fill(0);
    const n = new Array(GX * GY).fill(0);
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
    for (let yy = 0; yy < h; yy += step)
      for (let xx = 0; xx < w; xx += step) {
        const i = (yy * w + xx) * 4;
        const v = [d[i], d[i + 1], d[i + 2]].map((q) => q / 255).map((q) => (q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4));
        const cell = Math.min(GY - 1, Math.floor((yy / h) * GY)) * GX + Math.min(GX - 1, Math.floor((xx / w) * GX));
        sum[cell] += 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        n[cell]++;
      }
    const cells = sum.map((s, i) => (n[i] ? s / n[i] : NaN)).filter((v) => !Number.isNaN(v));
    const all = sum.reduce((a, s) => a + s, 0) / Math.max(1, n.reduce((a, q) => a + q, 0));
    return { mean: all, cells };
  } catch {
    return null;
  }
}

/** Average relative luminance of a region of the card drawn so far (logical units), sampled on a coarse grid. */
function artLuminance(ctx: Ctx, x: number, y: number, w: number, h: number) {
  try {
    const px = Math.max(1, Math.round(w * K)), py = Math.max(1, Math.round(h * K));
    const data = ctx.getImageData(Math.round(x * K), Math.round(y * K), px, py).data;
    let sum = 0, n = 0;
    const step = Math.max(4, Math.floor((px * py) / 1500)) * 4;
    for (let i = 0; i < data.length; i += step) {
      const v = [data[i], data[i + 1], data[i + 2]].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      sum += 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      n++;
    }
    return n ? sum / n : 0.1;
  } catch {
    return 0.1;
  }
}

// ---------- Card backgrounds, one per era ----------

type Look = { header?: 'light' };
const BG: Record<AutoEra, (ctx: Ctx, W: number, H: number, p: AutographSnapshot) => Look> = {
  leather(ctx, W, H, p) {
    ctx.fillStyle = '#efe4c8';
    ctx.fillRect(0, 0, W, H);
    const ix = 28;
    const iy = 76;
    const iw = W - 56;
    const ih = H * NAME_TOP - iy - 16;
    // sepia photo panel tinted by the club
    const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
    g.addColorStop(0, mixHex(light(p), '#c8a26a', 0.45));
    g.addColorStop(1, mixHex(p.c1, '#3b2a17', 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(ix, iy, iw, ih);
    // halftone, bigger dots toward the bottom (one path)
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,244,220,0.22)';
    ctx.beginPath();
    for (let y = iy; y < iy + ih; y += 9)
      for (let x = ix + ((y / 9) % 2) * 4.5; x < ix + iw; x += 9) {
        const rr = 0.6 + ((y - iy) / ih) * 3;
        ctx.moveTo(x + rr, y);
        ctx.arc(x, y, rr, 0, Math.PI * 2);
      }
    ctx.fill();
    ctx.restore();
    // pinstripe frame and pennant badge with his number
    ctx.strokeStyle = lum(p.c2) > 0.85 ? '#3b2a17' : p.c2;
    ctx.lineWidth = 4;
    ctx.strokeRect(ix - 8, iy - 8, iw + 16, ih + 16);
    ctx.save();
    ctx.translate(ix + 18, iy + ih - 18);
    ctx.fillStyle = p.c1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(118, -26);
    ctx.lineTo(0, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#efe4c8';
    ctx.font = `italic 800 34px ${DISPLAY}`;
    ctx.fillText(`#${p.number}`, 10, -14);
    ctx.restore();
    return { header: 'light' };
  },
  broadcast(ctx, W, H, p) {
    const hz = H * 0.6;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#0d0820');
    sky.addColorStop(0.6, shade(p.c1, 0.55));
    sky.addColorStop(1, '#ff5f8a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);
    // striped sun
    const sun = ctx.createLinearGradient(0, hz - 220, 0, hz);
    sun.addColorStop(0, '#ffe08a');
    sun.addColorStop(1, light(p));
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, hz, 170, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = sun;
    ctx.fillRect(0, hz - 180, W, 180);
    ctx.fillStyle = '#0d0820';
    for (let i = 0; i < 7; i++) ctx.fillRect(0, hz - 14 - i * 22, W, 3 + i * 0.9);
    ctx.restore();
    // perspective grid floor
    ctx.fillStyle = '#0d0820';
    ctx.fillRect(0, hz, W, H - hz);
    ctx.save();
    const grid = lum(light(p)) < 0.005 ? '#c83803' : light(p);
    ctx.strokeStyle = grid;
    ctx.shadowColor = grid;
    ctx.shadowBlur = 8 * K;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = -10; i <= 10; i++) {
      ctx.moveTo(W / 2, hz);
      ctx.lineTo(W / 2 + i * 70, H);
    }
    for (let k = 1; k < 9; k++) {
      const y = hz + Math.pow(k / 8, 1.8) * (H - hz);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
    // chrome number
    const ch = ctx.createLinearGradient(0, 90, 0, 250);
    ['#ffffff', '#9aa6c8', '#3a4060', '#eef1fa'].forEach((c, i) => ch.addColorStop(i / 3, c));
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = `italic 800 150px ${DISPLAY}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = ch;
    ctx.fillText(String(p.number), W - 26, 230);
    ctx.restore();
    return {};
  },
  prizm(ctx, W, H, p) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, shade(light(p), 1.1));
    g.addColorStop(1, shade(p.c1, 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.7;
    const stops = ['#ff4d6d', '#ffd166', '#06d6a0', '#118ab2', '#7b2cbf', '#ff4d6d'];
    const cg = typeof ctx.createConicGradient === 'function' ? ctx.createConicGradient(0.6, W / 2, H * 0.45) : ctx.createLinearGradient(0, 0, W, H);
    stops.forEach((c, i, a) => cg.addColorStop(i / (a.length - 1), c));
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // refractor rays
    ctx.save();
    ctx.translate(W / 2, H * 0.45);
    for (let i = 0; i < 72; i++) {
      ctx.rotate((Math.PI * 2) / 72);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(900, -22);
      ctx.lineTo(900, 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const r = rng(hash('spark' + p.name));
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 40; i++) {
      const x = r() * W;
      const y = 70 + r() * (H - 180);
      const s = r() * 2.4;
      ctx.fillRect(x - s, y, s * 2 + 1, 1);
      ctx.fillRect(x, y - s, 1, s * 2 + 1);
    }
    return {};
  },
  night(ctx, W, H, p) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04060d');
    g.addColorStop(0.55, shade(p.c1, 0.35));
    g.addColorStop(1, '#062012');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // light rigs and beams
    [
      [90, 110],
      [W - 90, 110],
    ].forEach(([x, y]) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(x, y, W / 2, H * 0.75);
      beam.addColorStop(0, 'rgba(255,240,200,0.28)');
      beam.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x + 20, y);
      ctx.lineTo(W / 2 + (x < W / 2 ? 140 : -140), H * 0.8);
      ctx.lineTo(W / 2 + (x < W / 2 ? -40 : 40), H * 0.8);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const bx = x - 40 + (i % 3) * 40;
        const by = y - 24 + Math.floor(i / 3) * 22;
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, 26);
        rg.addColorStop(0, 'rgba(255,250,230,0.95)');
        rg.addColorStop(1, 'rgba(255,250,230,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(bx - 26, by - 26, 52, 52);
      }
      ctx.restore();
    });
    // the field: mowing stripes, yard lines, his number painted on the turf
    const fy = H * 0.56;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#1b6a3c' : '#227a46';
      ctx.fillRect(0, fy + i * ((H - fy) / 6), W, (H - fy) / 6 + 1);
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) ctx.fillRect(i * 100 + 20, fy, 3, H - fy);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.font = `800 70px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(p.number), W / 2, fy + 66);
    ctx.restore();
    return {};
  },
  current(ctx, W, H, p) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, shade(light(p), 1.2));
    g.addColorStop(0.6, p.c1);
    g.addColorStop(1, shade(p.c1, 0.4));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // mesh jersey texture (one path)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    for (let y = 64; y < H; y += 7)
      for (let x = ((y / 7) % 2) * 3.5; x < W; x += 7) {
        ctx.moveTo(x + 1.5, y);
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      }
    ctx.fill();
    ctx.restore();
    // giant knocked-out number with a trim stroke
    ctx.save();
    ctx.font = `italic 800 ${p.number > 9 ? 420 : 500}px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 10;
    ctx.strokeStyle = p.c2;
    ctx.globalAlpha = 0.55;
    ctx.strokeText(String(p.number), W / 2 + 10, H * 0.72);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff';
    ctx.fillText(String(p.number), W / 2 + 10, H * 0.72);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = p.c2;
    ctx.fillRect(0, 70, 10, H - 180);
    ctx.restore();
    return {};
  },
};

// ---------- Prestige: his stature, position and honours, drawn over the era design ----------

const chalkFor = (era: AutoEra) => (era === 'leather' ? 'rgba(70,45,20,0.28)' : 'rgba(255,255,255,0.17)');
function arrow(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, cx1?: number, cy1?: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  if (cx1 != null && cy1 != null) ctx.quadraticCurveTo(cx1, cy1, x1, y1);
  else ctx.lineTo(x1, y1);
  ctx.stroke();
  const a = cx1 != null && cy1 != null ? Math.atan2(y1 - cy1, x1 - cx1) : Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45));
  ctx.stroke();
}
const O = (ctx: Ctx, x: number, y: number, r = 9) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
};
const X = (ctx: Ctx, x: number, y: number, r = 8) => {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
};

/** A chalkboard play for his position, unique to him (seeded by his name). */
function playDiagram(ctx: Ctx, W: number, H: number, p: AutographSnapshot, era: AutoEra, level: number) {
  const r = rng(hash('play:' + p.name));
  ctx.save();
  ctx.strokeStyle = chalkFor(era);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  const top = 96;
  const bot = H * NAME_TOP - 20;
  const mid = (top + bot) / 2;
  const los = mid + 70;
  if (p.position === 'QB') {
    const qx = W / 2 + (r() - 0.5) * 60;
    const qy = bot - 30;
    O(ctx, qx, qy, 11);
    for (let i = -2; i <= 2; i++) O(ctx, W / 2 + i * 38, los, 9);
    const n = 4 + Math.min(4, Math.round(level * 1.2));
    for (let i = 0; i < n; i++) {
      const tx = 50 + r() * (W - 100);
      const ty = top + 20 + r() * (los - top - 90);
      arrow(ctx, qx, qy - 12, tx, ty, lerp(qx, tx, 0.5) + (r() - 0.5) * 80, Math.min(qy, ty) - 60 - r() * 80);
    }
  } else if (p.position === 'RB') {
    for (let i = -2; i <= 2; i++) O(ctx, W / 2 + i * 40, los, 9);
    const bx = W / 2 + (r() - 0.5) * 30;
    const by = bot - 20;
    O(ctx, bx, by, 11);
    const hole = W / 2 + (r() < 0.5 ? -1 : 1) * (20 + r() * 40);
    ctx.beginPath();
    ctx.moveTo(bx, by - 12);
    ctx.bezierCurveTo(bx, los + 40, hole, los + 20, hole, los - 10);
    ctx.stroke();
    arrow(ctx, hole, los - 10, hole + (r() - 0.5) * 220, top + 30, hole + (r() - 0.5) * 140, mid - 40);
    ctx.setLineDash([6, 9]);
    arrow(ctx, bx, by - 12, W - 70, mid + 10, W - 90, los + 60);
    ctx.setLineDash([]);
  } else if (p.position === 'WR' || p.position === 'TE') {
    const sx = 80 + r() * (W - 160);
    const sy = los;
    X(ctx, sx, sy);
    const stem = sy - 70 - r() * 50;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 10);
    ctx.lineTo(sx, stem);
    ctx.stroke();
    const routes = [
      [-150, 0],
      [150, 0],
      [-110, -110],
      [110, -110],
      [0, -160],
      [-60, 40],
      [60, 40],
    ];
    routes.slice(0, 4 + Math.round(r() * 3)).forEach(([dx, dy]) => arrow(ctx, sx, stem, Math.max(30, Math.min(W - 30, sx + dx)), Math.max(top + 20, stem + dy)));
    for (let i = -2; i <= 2; i++) O(ctx, W / 2 + i * 36, los + 4, 8);
  } else if (p.position === 'OL') {
    for (let i = -3; i <= 3; i++) {
      const x = W / 2 + i * 56;
      O(ctx, x, los, 12);
      ctx.beginPath();
      ctx.moveTo(x, los - 14);
      ctx.lineTo(x + (r() - 0.5) * 30, los - 70);
      ctx.moveTo(x - 14 + (r() - 0.5) * 30, los - 70);
      ctx.lineTo(x + 14 + (r() - 0.5) * 30, los - 70);
      ctx.stroke();
      X(ctx, x + (r() - 0.5) * 20, los - 100, 9);
    }
  } else {
    for (let i = -2; i <= 2; i++) O(ctx, W / 2 + i * 38, los + 40, 8);
    ctx.setLineDash([7, 8]);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(90 + i * 160, top + 80 + r() * 60, 70, 36, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const n = p.position === 'DB' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const x = 70 + r() * (W - 140);
      const y = mid - 40 + r() * 60;
      X(ctx, x, y);
      if (p.position !== 'DB' || i === 0) arrow(ctx, x, y + 12, W / 2 + (r() - 0.5) * 120, los + 30, x + (r() - 0.5) * 60, (y + los) / 2);
    }
  }
  ctx.restore();
}

/** A championship ring seen at three-quarters: a wide band below, a faceted gem with prongs on top (reads as a ring at ~14px). */
function ringIcon(ctx: Ctx, x: number, y: number, s: number, gem: string) {
  const g = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
  ['#fff1b8', '#ffc83d', '#9a5b07'].forEach((c, i) => g.addColorStop(i / 2, c));
  ctx.save();
  // the band: an ellipse, open in the middle
  ctx.lineWidth = s * 0.3;
  ctx.strokeStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.45, s * 0.62, s * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  // the setting and a diamond gem in his club's colour
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55, y - s * 0.05);
  ctx.lineTo(x + s * 0.55, y - s * 0.05);
  ctx.lineTo(x + s * 0.3, y + s * 0.2);
  ctx.lineTo(x - s * 0.3, y + s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = gem;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.75);
  ctx.lineTo(x + s * 0.42, y - s * 0.12);
  ctx.lineTo(x, y + s * 0.12);
  ctx.lineTo(x - s * 0.42, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.08, y - s * 0.6);
  ctx.lineTo(x + s * 0.12, y - s * 0.2);
  ctx.lineTo(x - s * 0.2, y - s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function prestige(ctx: Ctx, W: number, H: number, p: AutographSnapshot, era: AutoEra) {
  const tier = PRESTIGE[p.prestige];
  const L = tier.level;
  const cx = W / 2;
  const cy = H * 0.42; // centre of the art area between the header band and the name bar
  const glow = era === 'leather' ? '200,150,80' : rgbOf(light(p));
  playDiagram(ctx, W, H, p, era, L);
  // nickname watermark in his own hand
  if (p.nickname) {
    ctx.save();
    ctx.translate(cx, cy + 10);
    ctx.rotate(-0.22);
    ctx.textAlign = 'center';
    // kept on the card: tilted, its width must fit across the card
    const mark = fitText(ctx, p.nickname, (W * 0.92) / Math.cos(0.22), 140, 56, (s) => `${s}px ${sigFont(identity(p.name).hand.font)}`);
    ctx.fillStyle = era === 'leather' ? 'rgba(70,45,20,0.12)' : 'rgba(255,255,255,0.09)';
    ctx.fillText(mark, 0, 0);
    ctx.restore();
  }
  // aura: a glow behind the signature that grows with his stature
  const rad = 170 + L * 45;
  const a = ctx.createRadialGradient(cx, cy, 10, cx, cy, rad);
  a.addColorStop(0, `rgba(${glow},${0.18 + L * 0.08})`);
  a.addColorStop(1, `rgba(${glow},0)`);
  ctx.save();
  ctx.globalCompositeOperation = era === 'leather' ? 'multiply' : 'screen';
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (L >= 3) {
    // god rays
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'screen';
    const n = L === 4 ? 36 : 22;
    const rg = ctx.createLinearGradient(0, 0, 420, 0);
    rg.addColorStop(0, `rgba(255,224,138,${L === 4 ? 0.16 : 0.1})`);
    rg.addColorStop(1, 'rgba(255,224,138,0)');
    ctx.fillStyle = rg;
    for (let i = 0; i < n; i++) {
      ctx.rotate((Math.PI * 2) / n);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(420, -14);
      ctx.lineTo(420, 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  if (L >= 2) {
    // gold dust
    const r = rng(hash('dust' + p.name));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 20 + L * 22; i++) {
      const ang = r() * Math.PI * 2;
      const d = 40 + Math.pow(r(), 0.7) * 260;
      const x = cx + Math.cos(ang) * d;
      const y = cy + Math.sin(ang) * d * 1.2;
      const s = r() * (1 + L * 0.5);
      ctx.fillStyle = `rgba(255,${200 + r() * 40},120,${0.35 + r() * 0.5})`;
      ctx.fillRect(x, y, s + 0.8, s + 0.8);
      if (s > 1.6) {
        ctx.fillRect(x - s * 2, y + s / 2, s * 5, 0.8);
        ctx.fillRect(x + s / 2, y - s * 2, 0.8, s * 5);
      }
    }
    ctx.restore();
  }
  // vignette for depth
  const v = ctx.createRadialGradient(cx, cy, 160, cx, cy, 520);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, era === 'leather' ? 'rgba(60,35,10,0.35)' : 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // rings row: one per title
  if (p.rings) {
    const n = Math.min(p.rings, 10);
    const s = 14;
    const gap = 33;
    const x0 = 32;
    for (let i = 0; i < n; i++) ringIcon(ctx, x0 + i * gap, 100, s, light(p));
    ctx.save();
    ctx.font = `800 20px ${DISPLAY}`;
    ctx.fillStyle = era === 'leather' ? '#3b2a17' : '#ffe08a';
    ctx.fillText(`${p.rings}×`, x0 + n * gap - 4, 108);
    ctx.restore();
  }
  // Hall of Fame seal with his tier
  if (p.hof || L >= 2) {
    const sx = W - 70;
    const sy = 150;
    const R = 46;
    const g = ctx.createLinearGradient(sx - R, sy - R, sx + R, sy + R);
    ['#fff1b8', '#ffc83d', '#b8740f', '#ffe08a'].forEach((c, i, arr) => g.addColorStop(i / (arr.length - 1), c));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10 * K;
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 32; i++) {
      const ang = (i / 32) * Math.PI * 2;
      const rr = i % 2 ? R : R - 5;
      ctx.lineTo(sx + Math.cos(ang) * rr, sy + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(90,50,5,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, R - 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#3a2205';
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, p.hof ? 'HALL OF FAME' : 'CAREER', R * 1.5, 13, 10, (s) => `800 ${s}px ${DISPLAY}`), sx, sy - 9);
    ctx.fillText(fitText(ctx, (tier.label || 'Legend').toUpperCase(), R * 1.6, 19, 12, (s) => `italic 800 ${s}px ${DISPLAY}`), sx, sy + 9);
    if (p.hof && p.hofClass) ctx.fillText(fitText(ctx, p.hofClass.toUpperCase(), (R - 13) * 2, 11, 8, (s) => `700 ${s}px ${MONO}`), sx, sy + 24);
    ctx.restore();
  }
  // No stat or record ribbon on the card (owner). Rim light in his club colour:
  ctx.save();
  ctx.strokeStyle = `rgba(${glow},${0.35 + L * 0.12})`;
  ctx.lineWidth = 10;
  ctx.shadowColor = `rgba(${glow},0.8)`;
  ctx.shadowBlur = 18 * K;
  ctx.strokeRect(-4, -4, W + 8, H + 8);
  ctx.restore();
}

// ---------- The card ----------

export interface AutoLayers {
  /** Everything but the signature */
  base: HTMLCanvasElement;
  /** The signature alone (with its ink effects), at the same size */
  sig: HTMLCanvasElement;
  /** Where the signature may show, in logical units (the reveal writes across it) */
  clip: { x: number; y: number; w: number; h: number };
  scale: number;
  /** How the signature was fitted to its mount: its scale (1 = as written) and the form it was written in */
  fit: { s: number; mode: SignForm };
  /** What it was drawn with after the readability check */
  ink: SigInk;
}

/** Where the foil star sits in the shield's point, as a share of the way from the name plate down to the tip. */
const STAR_AT = 0.6;

// ---------- The figure designs (private sprites only; owner approved 2026-11-13) ----------

/** The header kicker of each figure design. */
const FIGURE_KICKER: Record<AutographRoll['parallel'], string> = {
  sticker: 'AUTHENTIC AUTOGRAPH',
  oncard: 'AUTHENTIC AUTOGRAPH',
  inscribed: 'INSCRIBED AUTOGRAPH',
  patch: 'PATCH AUTOGRAPH',
  cut: 'CUT SIGNATURE',
};
/** Logical units per sprite pixel: the full figure (64 px frame, about 51 px of him) and the patch portrait. */
const FIG_UNIT = 6;
const BUST_UNIT = 11;
/** A filling signature's starting size, as a share of its box's height (drawSignature `fill`). */
const FILL_PX = 1.15;
/** Rows from the figure's feet up to the top of his shoulders (the save's body template: body from row 27, feet on
 *  58), and the shoulder row inside the bust crop (from row 6); the signature box starts there, below his chin. */
const SHOULDERS = 31;
const SHOULDERS_IN_BUST = 21;
/** Top of the patch portrait. */
const PATCH_TOP = 104;
/** Where his feet stand in each era's scene: on its horizon (Broadcast's grid, Night Game's turf, Leather's photo). */
const FEET: Record<AutoEra, number> = { leather: 458, broadcast: 446, prizm: 446, night: 432, current: 446 };

const sepiaCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
/** The sprite printed as an old photo: greyscale mapped onto sepia (the mockup's tables), alpha kept. */
const sepiaOf = (img: HTMLImageElement) => {
  const hit = sepiaCache.get(img);
  if (hit) return hit;
  const c = canvas(img.naturalWidth, img.naturalHeight);
  const x = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings)!;
  x.drawImage(img, 0, 0);
  try {
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const g = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) / 255;
      d.data[i] = 255 * (0.22 + 0.71 * g);
      d.data[i + 1] = 255 * (0.15 + 0.71 * g);
      d.data[i + 2] = 255 * (0.08 + 0.62 * g);
    }
    x.putImageData(d, 0, 0);
  } catch {
    /* a tainted image: drawn in colour */
  }
  sepiaCache.set(img, c);
  return c;
};

/** Draws a sprite region pixel-crisp with its centre line on x and its feet row on `feet` (logical units). */
function drawSprite(ctx: Ctx, sp: AutoSprite, x: number, feet: number, unit: number, src: CanvasImageSource = sp.img) {
  const u = unit / sp.unit;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowOffsetY = 1.2 * unit * K;
  ctx.drawImage(src, sp.sx, sp.sy, sp.sw, sp.sh, x - sp.cx * u, feet - (sp.foot + 1) * u, sp.sw * u, sp.sh * u);
  ctx.restore();
}

/** He stands on the scene's horizon with a floor shadow (on-card, inscribed, sticker, cut), or a big portrait (patch). */
function figureScene(ctx: Ctx, p: AutographSnapshot, roll: AutographRoll, fig: AutoFigure, era: AutoEra) {
  const cx = CARD_W / 2;
  if (roll.parallel === 'patch') {
    const top = PATCH_TOP;
    drawSprite(ctx, fig.bust, cx, top + fig.bust.sh * (BUST_UNIT / fig.bust.unit), BUST_UNIT);
    return;
  }
  const feet = FEET[era];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, feet + 2, 62, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawSprite(ctx, fig.figure, cx, feet, FIG_UNIT, roll.parallel === 'cut' ? sepiaOf(fig.figure.img) : fig.figure.img);
  void p;
}

/** The mount and signature of each figure design. */
function figureMount(ctx: Ctx, sctx: Ctx, p: AutographSnapshot, roll: AutographRoll, fig: AutoFigure, pull: SigPull, foil: CanvasGradient) {
  const W = CARD_W;
  const H = CARD_H;
  const cx = W / 2;
  const art = { x: 0, y: H * HEADER_BOTTOM + 6, w: W, h: H * (NAME_TOP - HEADER_BOTTOM) - 12 };
  const onArt: Box = { x: 22, y: art.y + 6, w: W - 44, h: art.h - 12 };
  void fig;
  if (roll.parallel === 'sticker') {
    // a clear glossy label over his lower legs
    const lw = 388;
    const lh = 112;
    const y = FEET[roll.era] - 28;
    const x0 = cx - lw / 2;
    const y0 = y - lh / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6 * K;
    ctx.shadowOffsetY = 4 * K;
    const g = ctx.createLinearGradient(x0, y0, x0 + lw * 0.4, y0 + lh);
    g.addColorStop(0, 'rgba(255,255,255,0.86)');
    g.addColorStop(0.6, 'rgba(241,244,255,0.78)');
    g.addColorStop(1, 'rgba(255,255,255,0.88)');
    ctx.fillStyle = g;
    ctx.beginPath();
    rrect(ctx, x0, y0, lw, lh, 12);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    rrect(ctx, x0, y0, lw, lh, 12);
    ctx.clip();
    const gl = ctx.createLinearGradient(x0, y0, x0 + lw, y0 + lh * 0.6);
    gl.addColorStop(0.3, 'rgba(255,255,255,0)');
    gl.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    gl.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x0, y0, lw, lh);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    rrect(ctx, x0 + 1, y0 + 1, lw - 2, lh - 2, 11);
    ctx.stroke();
    ctx.restore();
    const clip = { x: x0, y: y0, w: lw, h: lh };
    const drawn = drawSignature(sctx, p.name, cx, y + 6, lw * 0.92, { ...pull, bg: 0.9, under: ctx, fill: true }, inset(clip, SIG_MARGIN));
    return { clip, drawn };
  }
  if (roll.parallel === 'patch') {
    // a framed swatch of his club jersey (stitched mesh, his colours and stripe) at lower left; the signature runs
    // from the swatch across the portrait
    const sx = 40;
    const sy = 340;
    const sw = 136;
    const sh = 128;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8 * K;
    ctx.fillStyle = foil;
    ctx.beginPath();
    rrect(ctx, sx - 6, sy - 6, sw + 12, sh + 12, 14);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    rrect(ctx, sx, sy, sw, sh, 10);
    ctx.clip();
    ctx.fillStyle = p.c1;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = p.c2;
    ctx.fillRect(sx, sy + sh * 0.58, sw, sh * 0.14);
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.strokeStyle = shade(p.c1, 0.55);
    ctx.beginPath();
    for (let i = 0; i < sw; i += 4) {
      ctx.moveTo(sx + i, sy);
      ctx.lineTo(sx + i, sy + sh);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    for (let j = 0; j < sh; j += 4) {
      ctx.moveTo(sx, sy + j);
      ctx.lineTo(sx + sw, sy + j);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = shade(light(p), 1.3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    rrect(ctx, sx + 7, sy + 7, sw - 14, sh - 14, 6);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    const inner = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, sw * 0.3, sx + sw / 2, sy + sh / 2, sw * 0.75);
    inner.addColorStop(0, 'rgba(0,0,0,0)');
    inner.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    rrect(ctx, sx, sy, sw, sh, 10);
    ctx.fill();
    ctx.restore();
    // over his shoulders and the swatch, below his chin
    const chin = PATCH_TOP - BUST_UNIT + (SHOULDERS_IN_BUST + 1) * BUST_UNIT;
    const box: Box = { x: sx + sw * 0.55, y: chin, w: W - 22 - (sx + sw * 0.55), h: art.y + art.h - 6 - chin };
    const drawn = drawSignature(sctx, p.name, box.x + box.w / 2, box.y + box.h / 2, box.w * 0.95, { ...pull, under: ctx, fill: true }, box);
    return { clip: art, drawn };
  }
  if (roll.parallel === 'cut') {
    // a framed, torn-edge clipping of aged paper over his legs, signed in broad-nib navy
    const sw = 380;
    const sh = 112;
    const sx = cx - sw / 2;
    const sy = FEET[roll.era] - 28 - sh / 2;
    ctx.save();
    ctx.fillStyle = '#2a1d0c';
    ctx.fillRect(sx - 14, sy - 14, sw + 28, sh + 28);
    ctx.strokeStyle = foil;
    ctx.lineWidth = 4;
    ctx.strokeRect(sx - 14, sy - 14, sw + 28, sh + 28);
    const tr = rng(hash('cut:' + p.name));
    ctx.fillStyle = '#e9dbb5';
    ctx.beginPath();
    const jag = (x0: number, y0: number, x1: number, y1: number) => {
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        ctx.lineTo(lerp(x0, x1, t) + (tr() - 0.5) * 6, lerp(y0, y1, t) + (tr() - 0.5) * 6);
      }
    };
    ctx.moveTo(sx, sy);
    jag(sx, sy, sx + sw, sy);
    jag(sx + sw, sy, sx + sw, sy + sh);
    jag(sx + sw, sy + sh, sx, sy + sh);
    jag(sx, sy + sh, sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#8a6a2a';
    for (let i = 0; i < 6; i++) ctx.fillRect(sx, sy + 18 + i * 16, sw, 1);
    ctx.restore();
    const clip = { x: sx, y: sy, w: sw, h: sh };
    const drawn = drawSignature(sctx, p.name, cx, sy + sh / 2 + 6, sw * 0.92, { ...pull, pen: PENS.nib, ink: '#0e1430', bg: 0.75, under: ctx, fill: true }, inset(clip, SIG_MARGIN));
    return { clip, drawn };
  }
  // on-card and inscribed: hard-signed across him in paint pen; the inscription in gold paint pen under it
  const inscribed = roll.parallel === 'inscribed';
  // across his body, never his face: from the top of his shoulders down to just above his feet, the full art width
  const feet = FEET[roll.era];
  const top = feet - SHOULDERS * FIG_UNIT;
  const body: Box = { x: onArt.x, y: Math.max(onArt.y, top), w: onArt.w, h: feet - 4 - Math.max(onArt.y, top) };
  const drawn = drawSignature(sctx, p.name, cx, body.y + body.h * (inscribed ? 0.42 : 0.5), onArt.w * 0.96, { ...pull, under: ctx, fill: true, ...(inscribed ? { insInk: 'gold' } : {}) }, body);
  return { clip: art, drawn };
}

/** Clear space kept between the signature's ink and the edge of its sticker, patch label or cut. */
const SIG_MARGIN = 10;
const inset = (b: Box, m: number): Box => ({ x: b.x + m, y: b.y + m, w: b.w - 2 * m, h: b.h - 2 * m });

const foilOf = (ctx: Ctx, W: number) => {
  const foil = ctx.createLinearGradient(0, 0, W, 0);
  ['#fff1b8', '#ffc83d', '#b8740f', '#ffe08a', '#ffc83d'].forEach((c, i, a) => foil.addColorStop(i / (a.length - 1), c));
  return foil;
};

/** Renders a card's two layers at `pw` pixels wide (the height follows the 5:7 card). */
export function renderLayers(p: AutographSnapshot, roll: AutographRoll, pw: number, fig?: AutoFigure | null): AutoLayers {
  const W = CARD_W;
  const H = CARD_H;
  K = pw / W;
  const base = canvas(pw, (pw * H) / W);
  const sig = canvas(base.width, base.height);
  const ctx = base.getContext('2d')!;
  const sctx = sig.getContext('2d')!;
  ctx.setTransform(K, 0, 0, K, 0, 0);
  const era = roll.era;
  const eraInfo = eraOf(era);
  ctx.save();
  shieldPath(ctx, W, H);
  ctx.clip();
  const look = BG[era](ctx, W, H, p);
  prestige(ctx, W, H, p, era);
  // the figure designs (private sprites only): him in the scene, under the paper grain like the rest of the art
  if (fig) figureScene(ctx, p, roll, fig, era);
  ctx.save();
  const pat = ctx.createPattern(noise(), 'repeat');
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  const lightHead = look.header === 'light';
  const foil = foilOf(ctx, W);
  // header band: text kept in the wide part of the shield, clear of the notched corners
  const hb = H * HEADER_BOTTOM;
  ctx.fillStyle = lightHead ? '#3b2a17' : 'rgba(9,13,26,0.72)';
  ctx.fillRect(0, 0, W, hb);
  ctx.fillStyle = lightHead ? '#efe4c8' : foil;
  ctx.textAlign = 'left';
  const kicker = fig ? FIGURE_KICKER[roll.parallel] : 'AUTHENTIC AUTOGRAPH';
  ctx.fillText(fitText(ctx, kicker, W * 0.5, 24, 16, (s) => `800 ${s}px ${DISPLAY}`), W * 0.12, hb * 0.66);
  ctx.textAlign = 'right';
  ctx.fillText(fitText(ctx, serialStr(roll), W * 0.26, 21, 14, (s) => `700 ${s}px ${MONO}`), W * 0.88, hb * 0.66);
  ctx.fillStyle = lightHead ? '#3b2a17' : foil;
  ctx.fillRect(0, hb, W, 2);
  // name bar: ends where the shield narrows into its point, text centred inside the full-width part
  const nt = H * NAME_TOP;
  const nb = H * NAME_BOTTOM;
  ctx.fillStyle = lightHead ? '#efe4c8' : 'rgba(9,13,26,0.82)';
  ctx.fillRect(0, nt, W, nb - nt);
  ctx.fillStyle = lightHead ? '#3b2a17' : foil;
  ctx.fillRect(0, nt - 2, W, 3);
  ctx.fillRect(0, nb - 1, W, 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = lightHead ? '#2a1d10' : '#eef1fa';
  ctx.fillText(fitText(ctx, p.name.toUpperCase(), W * 0.84, 40, 24, (s) => `italic 800 ${s}px ${DISPLAY}`), W / 2, nt + (nb - nt) * 0.5);
  ctx.fillStyle = lightHead ? '#6b5333' : '#9aa6c8';
  const plate = `${p.position} #${p.number} · ${p.team} · ${eraInfo.label}${roll.throwback ? ' (throwback)' : ''}`;
  ctx.fillText(fitText(ctx, plate, W * 0.84, 17, 12, (s) => `600 ${s}px ${BODY}`), W / 2, nt + (nb - nt) * 0.83);
  // the point: only the era art, plus a small foil star low in it, clear of the name plate's second line
  ctx.save();
  ctx.fillStyle = lightHead ? '#3b2a17' : foil;
  ctx.translate(W / 2, nb + (H - nb) * STAR_AT);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr2 = i % 2 ? 4.5 : 11;
    ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const cx = W / 2;
  const cy = H * 0.42; // centre of the art area between the header band and the name bar
  const id = identity(p.name);
  const pull: SigPull = { id, pen: PENS[roll.pen], ink: roll.ink, team: roll.teamInk, seed: roll.seed, inscription: roll.inscription };
  sctx.setTransform(K, 0, 0, K, 0, 0);
  let clip: AutoLayers['clip'];
  let drawn: ReturnType<typeof drawSignature>;
  if (fig) {
    ({ clip, drawn } = figureMount(ctx, sctx, p, roll, fig, pull, foil));
  } else if (roll.parallel === 'sticker' || roll.parallel === 'patch') {
    if (roll.parallel === 'patch') {
      const sx = cx - 120;
      const sy = cy - 190;
      const sw = 240;
      const sh = 150;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx - 8, sy - 8, sw + 16, sh + 16);
      ctx.fillStyle = p.c1;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.strokeStyle = shade(p.c1, 0.6);
      ctx.beginPath();
      for (let i = 0; i < sw; i += 4) {
        ctx.moveTo(sx + i, sy);
        ctx.lineTo(sx + i, sy + sh);
      }
      ctx.stroke();
      ctx.strokeStyle = shade(light(p), 1.5);
      ctx.beginPath();
      for (let j = 0; j < sh; j += 4) {
        ctx.moveTo(sx, sy + j);
        ctx.lineTo(sx + sw, sy + j);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.c2;
      ctx.fillRect(sx, sy + sh * 0.62, sw, 14);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(sx, sy + sh * 0.62 + 14, sw, 6);
      ctx.restore();
    }
    const y = roll.parallel === 'patch' ? cy + 70 : cy;
    const lw = W * 0.82;
    const lh = 150;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14 * K;
    ctx.shadowOffsetY = 6 * K;
    ctx.fillStyle = 'rgba(250,250,246,0.96)';
    ctx.beginPath();
    rrect(ctx, cx - lw / 2, y - lh / 2, lw, lh, 12);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    rrect(ctx, cx - lw / 2 + 8, y - lh / 2 + 8, lw - 16, lh - 16, 8);
    ctx.stroke();
    ctx.restore();
    clip = { x: cx - lw / 2, y: y - lh / 2, w: lw, h: lh };
    drawn = drawSignature(sctx, p.name, cx, y + 6, lw * 0.86, { ...pull, bg: 0.94, under: ctx }, inset(clip, SIG_MARGIN));
  } else if (roll.parallel === 'cut') {
    const sw = W * 0.78;
    const sh = 170;
    const sx = cx - sw / 2;
    const sy = cy - sh / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx - 18, sy - 18, sw + 36, sh + 36);
    ctx.strokeStyle = foil;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx - 18, sy - 18, sw + 36, sh + 36);
    const tr = rng(hash('cut:' + p.name));
    ctx.fillStyle = '#efe6cf';
    ctx.beginPath();
    const jag = (x0: number, y0: number, x1: number, y1: number) => {
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        ctx.lineTo(lerp(x0, x1, t) + (tr() - 0.5) * 5, lerp(y0, y1, t) + (tr() - 0.5) * 5);
      }
    };
    ctx.moveTo(sx, sy);
    jag(sx, sy, sx + sw, sy);
    jag(sx + sw, sy, sx + sw, sy + sh);
    jag(sx + sw, sy + sh, sx, sy + sh);
    jag(sx, sy + sh, sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#8a6a2a';
    for (let i = 0; i < 9; i++) ctx.fillRect(sx, sy + 26 + i * 15, sw, 1);
    ctx.restore();
    clip = { x: sx, y: sy, w: sw, h: sh };
    drawn = drawSignature(sctx, p.name, cx, cy + 10, sw * 0.88, { ...pull, pen: PENS.nib, ink: '#0e1430', bg: 0.82, under: ctx }, inset(clip, SIG_MARGIN));
    ctx.save();
    ctx.fillStyle = foil;
    ctx.textAlign = 'center';
    const caption = p.hofClass ? `HALL OF FAME · ${p.hofClass === 'Inaugural' ? 'INAUGURAL CLASS' : `${p.hofClass.toUpperCase()} CLASS`}` : 'HALL OF FAME';
    ctx.fillText(fitText(ctx, caption, sw + 24, 20, 13, (s) => `800 ${s}px ${DISPLAY}`), cx, sy + sh + 50);
    ctx.restore();
  } else {
    clip = { x: 0, y: H * HEADER_BOTTOM + 6, w: W, h: H * (NAME_TOP - HEADER_BOTTOM) - 12 };
    // Signed straight on the card: measure the art under the signature so the ink and halo can answer it
    drawn = drawSignature(sctx, p.name, cx, cy, W * 0.86, { ...pull, bg: artLuminance(ctx, cx - W * 0.4, cy - 70, W * 0.8, 140), under: ctx }, { x: 22, y: clip.y + 6, w: W - 44, h: clip.h - 12 });
  }
  ctx.restore();
  // rim along the shield (the collectible frame adds its own tier / finish rim outside this)
  ctx.save();
  ctx.lineWidth = 6;
  ctx.strokeStyle = lightHead ? '#3b2a17' : foil;
  shieldPath(ctx, W, H);
  ctx.stroke();
  ctx.restore();
  K = 1;
  return { base, sig, clip, scale: pw / W, fit: { s: drawn.fit.s, mode: drawn.fit.mode }, ink: drawn.ink };
}

/** Draws the layers onto `ctx` (same pixel size), the signature written up to `reveal` (0 to 1) of its width. */
export function compose(ctx: Ctx, layers: AutoLayers, reveal = 1) {
  const { base, sig, clip, scale } = layers;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(base, 0, 0);
  if (reveal > 0) {
    ctx.beginPath();
    ctx.rect(clip.x * scale, clip.y * scale, clip.w * scale * Math.min(1, reveal), clip.h * scale);
    ctx.clip();
    ctx.drawImage(sig, 0, 0);
  }
  ctx.restore();
}

// ---------- Cache: finished cards by autograph id and pixel width ----------

const CACHE_MAX = 40;
const cache = new Map<string, HTMLCanvasElement>();

/** The finished card at `pw` pixels wide (with his figure when given), cached by `cacheKey` (an autograph id) and the
 *  figure; pass no key to skip the cache. */
export function renderAutograph(p: AutographSnapshot, roll: AutographRoll, pw: number, cacheKey?: string, fig?: AutoFigure | null): HTMLCanvasElement {
  const k = cacheKey ? `${cacheKey}@${pw}${fig ? `|${fig.id}` : ''}` : '';
  const hit = k ? cache.get(k) : undefined;
  if (hit) {
    cache.delete(k);
    cache.set(k, hit);
    return hit;
  }
  const layers = renderLayers(p, roll, pw, fig);
  const out = canvas(layers.base.width, layers.base.height);
  compose(out.getContext('2d')!, layers);
  if (k) {
    cache.set(k, out);
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  return out;
}
