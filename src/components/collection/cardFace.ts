import type { CSSProperties } from 'react';
import { homeUniform } from './art/sprite/uniforms';

/**
 * Team-colour card face. Every owned card's face is its club's home jersey colour (the same uniform table the card
 * art uses, sprite/uniforms.ts), as a gradient from a rich top shade into a dark bottom shade, with the trim colour
 * as an accent (corner glow, pinstripes, art halo). Text on the face is always light, so the top shade is darkened
 * until white text clears WCAG AA (4.5:1); light clubs (Dolphins aqua, Chargers powder blue) get a deeper shade of
 * their colour, black clubs (Steelers, Raiders, Saints, Bengals) are lifted just enough to show the gradient and lean
 * on their trim. Tier lives on the frame and finish on the rim (collection.css), never on the face.
 */

type RGB = [number, number, number];

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** "#rgb", "#rrggbb" or "hsl(h s% l%)" (the formats the uniform table uses). */
const parse = (css: string): RGB | null => {
  const s = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  const hsl = /^hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)$/i.exec(s);
  if (hsl) return hslToRgb(+hsl[1], +hsl[2], +hsl[3]);
  return null;
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as RGB;
};

const rgbToHsl = ([r, g, b]: RGB): [number, number, number] => {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s * 100, l * 100];
};

const luminance = ([r, g, b]: RGB) => {
  const c = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
/** WCAG contrast ratio of white text on this colour. */
export const whiteContrast = (rgb: RGB) => 1.05 / (luminance(rgb) + 0.05);

const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(1)}%)`;

export interface CardFace {
  /** Top, middle and bottom shades of the face gradient (CSS) */
  top: string;
  mid: string;
  bottom: string;
  /** Trim colour (CSS), for the accent */
  accent: string;
  /** White-text contrast on the top shade (≥ 4.5) */
  contrast: number;
}

const cache = new Map<string, CardFace>();

export const cardFaceFor = (team: string | undefined): CardFace => {
  const key = team ?? '';
  const hit = cache.get(key);
  if (hit) return hit;
  const u = homeUniform(team);
  const jersey = parse(u.jersey) ?? [31, 44, 77];
  const [h, s0] = rgbToHsl(jersey);
  let l = rgbToHsl(jersey)[2];
  const s = clamp(s0, 0, 88);
  // Black kits: lift a little so the gradient reads; light kits: deepen until white text passes AA
  l = clamp(l, 15, 46);
  while (l > 8 && whiteContrast(hslToRgb(h, s, l)) < 4.5) l -= 1;
  const face: CardFace = {
    top: hsl(h, s, l),
    mid: hsl(h, s * 0.95, l * 0.68),
    bottom: hsl(h, s * 0.9, Math.max(4, l * 0.36)),
    accent: u.trim,
    contrast: whiteContrast(hslToRgb(h, s, l)),
  };
  cache.set(key, face);
  return face;
};

/** CSS variables for .fut (read by collection.css --fut-bg). */
export const cardFaceVars = (team: string | undefined): CSSProperties => {
  const f = cardFaceFor(team);
  return { '--fut-f1': f.top, '--fut-f2': f.mid, '--fut-f3': f.bottom, '--fut-fx': f.accent } as CSSProperties;
};
