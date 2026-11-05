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
  type SignIdentity,
} from '@/config/autographs';

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
  /** Relative luminance (0–1) of what the signature is written on: a sticker, the cut paper, or the card art under it */
  bg?: number;
}

/**
 * Draws a signature centred on (cx, cy) with width budget w (logical units) onto `out` (a layer at the target's pixel
 * size): the strokes on a scratch layer, then composited with the pen's character (bleed or metallic shadow,
 * ballpoint skips).
 */
export function drawSignature(out: Ctx, name: string, cx: number, cy: number, w: number, pull: SigPull) {
  const id = pull.id;
  const hand = id.hand;
  const pen = pull.pen;
  const r = rng(hash('pull:' + name + ':' + pull.seed));
  const slant = ((id.slant + (r() - 0.5) * 8) * Math.PI) / 180;
  const sizeJ = id.size * (1 + (r() - 0.5) * 0.12);
  const parts = name.split(' ');
  let first = parts[0];
  const last = parts.slice(1).join(' ') || parts[0];
  if (parts.length < 2) first = '';
  // forms that write a shortened name use the full-name layout
  if (hand.mode === 'initlast' && first) first = first[0] + '.';
  if (hand.mode === 'lastonly') first = '';
  let px = Math.max(30, w / Math.max(5, name.length * 0.42)) * hand.size * sizeJ;
  const L = canvas(out.canvas.width, out.canvas.height);
  const c = L.getContext('2d')!;
  const bg = pull.bg ?? 0.1;
  const color = inkFill(c, pull.ink, cx - w / 2, cy - px, cx + w / 2, cy + px, pull.team, bg);
  c.setTransform(K, 0, 0, K, cx * K, cy * K);
  c.transform(1, 0, -Math.tan(slant) * 0.55, 1, 0, 0);
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.textBaseline = 'alphabetic';
  const fontOf = (s: number) => `${s}px ${sigFont(hand.font)}`;
  const weight = pen.weight;
  const wob = 0.6 + id.mess * 2.4;

  const strokeText = (t: string, x: number, y: number, s: number, rot = 0) => {
    if (!t) return;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.font = fontOf(s);
    if (pen.nib) {
      for (let k = 0; k < 6; k++) c.fillText(t, k * s * 0.012, -k * s * 0.012);
    } else {
      c.fillText(t, 0, 0);
      c.lineWidth = Math.max(0.6, s * 0.03 * weight);
      c.strokeText(t, 0, 0);
    }
    c.restore();
  };
  const measure = (t: string, s: number) => {
    c.font = fontOf(s);
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
  if (hand.mode === 'full' || hand.mode === 'stacked' || hand.mode === 'initlast' || hand.mode === 'lastonly') {
    const fw = first ? measure(first, px) : 0;
    const lw = measure(last, px);
    let total = fw + lw + px * (0.25 + id.track * 4);
    if (hand.mode === 'stacked') total = Math.max(fw * 0.7, lw);
    const fit = Math.min(1, (w * 0.92) / total);
    px *= fit;
    capH = px * 0.7;
    if (hand.mode === 'stacked' && first) {
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
  } else if (hand.mode === 'initials') {
    const words = parts;
    const big = px * 1.15;
    const widths = words.map((wd) => measure(wd[0], big) + Math.min(w * 0.3, wd.length * px * 0.2));
    const total = widths.reduce((a, b) => a + b, 0) + px * 0.2 * (words.length - 1);
    const fit = Math.min(1, (w * 0.9) / total);
    let x = (-total * fit) / 2;
    words.forEach((wd, i) => {
      const s = big * fit;
      strokeText(wd[0], x, (i % 2 ? 1 : -1) * id.drift * s * 0.4, s, id.drift * 0.2);
      const iw = measure(wd[0], s);
      const tl = Math.min(w * 0.3, wd.length * px * 0.2) * fit;
      const e = tail(x + iw * 0.85, -s * 0.12, tl, s * 0.1, 3 + (wd.length % 4), id.mess > 0.5);
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

  // Inscription (per pull, frozen at the pull)
  if (pull.inscription) {
    c.save();
    c.setTransform(K, 0, 0, K, cx * K, cy * K);
    const s = Math.max(16, px * 0.36);
    c.font = `${s}px ${sigFont(hand.font)}`;
    c.textAlign = 'center';
    c.fillStyle = color;
    c.rotate(-0.04 + id.drift * 0.1);
    c.fillText(pull.inscription, px * 0.2, px * 0.95);
    c.restore();
  }

  // Contrast: when the ink and what it's written on are too close, a soft halo in the opposite tone goes under the
  // strokes first (a dark halo for a light ink on light art, a light one for a dark ink on dark art)
  const ratio = contrast(inkLum(pull.ink, pull.team, bg), bg);
  if (ratio < 3.2) {
    const inkIsLight = inkLum(pull.ink, pull.team, bg) > bg;
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.shadowColor = inkIsLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
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
  out.globalAlpha = pull.ink === 'team' ? 0.95 : 0.97;
  out.drawImage(L, 0, 0);
  out.restore();
  if (pen.skip) {
    // ballpoint skips: knock out thin streaks along the stroke direction (on the signature layer only)
    out.save();
    out.setTransform(K, 0, 0, K, 0, 0);
    out.globalCompositeOperation = 'destination-out';
    out.globalAlpha = 0.35;
    const sr = rng(hash('skip:' + name + pull.seed));
    for (let i = 0; i < 70; i++) out.fillRect(cx - w / 2 + sr() * w, cy - px + sr() * px * 1.8, 2 + sr() * 9, 0.9);
    out.restore();
  }
  return { px };
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
    ctx.font = `140px ${sigFont(identity(p.name).hand.font)}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = era === 'leather' ? 'rgba(70,45,20,0.12)' : 'rgba(255,255,255,0.09)';
    ctx.fillText(p.nickname, 0, 0, W * 1.5);
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
    ctx.font = `800 13px ${DISPLAY}`;
    ctx.fillText(p.hof ? 'HALL OF FAME' : 'CAREER', sx, sy - 9);
    ctx.font = `italic 800 19px ${DISPLAY}`;
    ctx.fillText((tier.label || 'Legend').toUpperCase(), sx, sy + 9, R * 1.6);
    ctx.font = `700 11px ${MONO}`;
    ctx.fillText(p.hof && p.hofClass ? p.hofClass.toUpperCase() : '', sx, sy + 24);
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
}

const foilOf = (ctx: Ctx, W: number) => {
  const foil = ctx.createLinearGradient(0, 0, W, 0);
  ['#fff1b8', '#ffc83d', '#b8740f', '#ffe08a', '#ffc83d'].forEach((c, i, a) => foil.addColorStop(i / (a.length - 1), c));
  return foil;
};

/** Renders a card's two layers at `pw` pixels wide (the height follows the 5:7 card). */
export function renderLayers(p: AutographSnapshot, roll: AutographRoll, pw: number): AutoLayers {
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
  ctx.font = `800 24px ${DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.fillText('AUTHENTIC AUTOGRAPH', W * 0.12, hb * 0.66, W * 0.5);
  ctx.textAlign = 'right';
  ctx.font = `700 21px ${MONO}`;
  ctx.fillText(serialStr(roll), W * 0.88, hb * 0.66, W * 0.26);
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
  ctx.font = `italic 800 40px ${DISPLAY}`;
  ctx.fillText(p.name.toUpperCase(), W / 2, nt + (nb - nt) * 0.5, W * 0.84);
  ctx.fillStyle = lightHead ? '#6b5333' : '#9aa6c8';
  ctx.font = `600 17px ${BODY}`;
  ctx.fillText(`${p.position} #${p.number} · ${p.team} · ${eraInfo.label}${roll.throwback ? ' (throwback)' : ''}`, W / 2, nt + (nb - nt) * 0.83, W * 0.84);
  // the point: only the era art, plus a small foil star at its centre
  ctx.save();
  ctx.fillStyle = lightHead ? '#3b2a17' : foil;
  ctx.translate(W / 2, (nb + H) / 2 - 4);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr2 = i % 2 ? 5 : 12;
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
  if (roll.parallel === 'sticker' || roll.parallel === 'patch') {
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
    drawSignature(sctx, p.name, cx, y + 6, lw * 0.86, { ...pull, bg: 0.94 });
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
    drawSignature(sctx, p.name, cx, cy + 10, sw * 0.88, { ...pull, pen: PENS.nib, ink: '#0e1430', bg: 0.82 });
    ctx.save();
    ctx.fillStyle = foil;
    ctx.font = `800 20px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.hofClass ? `HALL OF FAME · ${p.hofClass === 'Inaugural' ? 'INAUGURAL CLASS' : `${p.hofClass.toUpperCase()} CLASS`}` : 'HALL OF FAME', cx, sy + sh + 50);
    ctx.restore();
  } else {
    clip = { x: 0, y: H * HEADER_BOTTOM + 6, w: W, h: H * (NAME_TOP - HEADER_BOTTOM) - 12 };
    // Signed straight on the card: measure the art under the signature so the ink and halo can answer it
    drawSignature(sctx, p.name, cx, cy, W * 0.86, { ...pull, bg: artLuminance(ctx, cx - W * 0.4, cy - 70, W * 0.8, 140) });
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
  return { base, sig, clip, scale: pw / W };
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

/** The finished card at `pw` pixels wide, cached by `cacheKey` (an autograph id); pass no key to skip the cache. */
export function renderAutograph(p: AutographSnapshot, roll: AutographRoll, pw: number, cacheKey?: string): HTMLCanvasElement {
  const k = cacheKey ? `${cacheKey}@${pw}` : '';
  const hit = k ? cache.get(k) : undefined;
  if (hit) {
    cache.delete(k);
    cache.set(k, hit);
    return hit;
  }
  const layers = renderLayers(p, roll, pw);
  const out = canvas(layers.base.width, layers.base.height);
  compose(out.getContext('2d')!, layers);
  if (k) {
    cache.set(k, out);
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  return out;
}
