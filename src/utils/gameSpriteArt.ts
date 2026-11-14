import { homeUniform, helmetWith, sleeveBands } from '@/components/collection/art/sprite/uniforms';
import { helmetFor } from '@/components/collection/art/sprite/helmets';
import { faceRow, type BodyPose, type GameFace, type RegularSprites } from './gameSprites';

/**
 * Recolouring for the private Retro Bowl sprites (gameSprites.ts loads this module only when the sheets exist on this
 * machine). The game paints players in placeholder key colours; each key maps to a part of the club's home kit
 * (uniforms.ts): shirt, collar and shoulder stripes on the portraits; helmet, jersey (with a lighter and a darker shade derived from the
 * base), pants and stripe, socks on the bodies, plus a skin tone sampled from the player's face; shell and stripes on
 * the big helmet. Results are cached per sprite × frame × palette as data URLs. No art lives here.
 */

// ---------- Colours ----------

type RGB = [number, number, number];
const toInt = ([r, g, b]: RGB) => (r << 16) | (g << 8) | b;
const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

let probe: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, RGB>();
/** Any CSS colour (#hex, hsl(...)) → RGB, through the canvas parser. */
const rgbOf = (c: string): RGB => {
  const hit = colorCache.get(c);
  if (hit) return hit;
  probe ??= document.createElement('canvas').getContext('2d');
  let out: RGB = [128, 128, 128];
  if (probe) {
    probe.fillStyle = '#808080';
    probe.fillStyle = c;
    const v = String(probe.fillStyle);
    if (v.startsWith('#')) out = hex(v);
    else {
      const m = v.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (m) out = [Number(m[1]), Number(m[2]), Number(m[3])];
    }
  }
  colorCache.set(c, out);
  return out;
};
/** Lighten (f > 0, toward white) or darken (f < 0, toward black). */
const shade = ([r, g, b]: RGB, f: number): RGB =>
  f >= 0 ? [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f].map(Math.round) as RGB : [r * (1 + f), g * (1 + f), b * (1 + f)].map(Math.round) as RGB;

// The faces' own skin bases and the shadow tone each pairs with (sampled per face for the body's skin keys).
const FACE_SKINS: Record<string, string> = { '#74412b': '#5d3322', '#8f563b': '#5d3322', '#eec39a': '#d9a066', '#d9a066': '#ba8857' };
const SKIN_BY_SHEET: Record<0 | 1 | 2, [string, string]> = { 0: ['#74412b', '#5d3322'], 1: ['#d9a066', '#ba8857'], 2: ['#eec39a', '#d9a066'] };

type Palette = Map<number, RGB>;

const kitColors = (team: string) => {
  const u = homeUniform(team);
  const hel = helmetWith(helmetFor(team), u);
  return { u, hel };
};

const facePalette = (s: RegularSprites, team: string): Palette => {
  const { u } = kitColors(team);
  const k = s.index.faces.keys;
  // #ff0000 is the portraits' third key (shoulder stripes): the kit's first sleeve band, else its trim
  const stripe = sleeveBands(u).find(([c]) => c)?.[0] ?? u.trim;
  return new Map([
    [toInt(hex(k.shirt)), rgbOf(u.jersey)],
    [toInt(hex(k.trim)), rgbOf(u.collar ?? u.trim)],
    [toInt(hex(k.stripe ?? '#ff0000')), rgbOf(stripe)],
  ]);
};

const bodyPalette = (s: RegularSprites, team: string, skin: [string, string]): Palette => {
  const { u, hel } = kitColors(team);
  const k = s.index.bodies.keys;
  const shell = rgbOf(hel.shell);
  const jersey = rgbOf(u.jersey);
  const pants = rgbOf(u.pants);
  const m: Palette = new Map();
  const put = (key: string | undefined, c: RGB) => key && m.set(toInt(hex(key)), c);
  put(k.helmet[0], shell);
  put('#800000', shade(shell, -0.35)); // the helmet's shaded edge
  put(k.jersey[0], jersey);
  put(k.jersey[1], shade(jersey, 0.22));
  put(k.jersey[2], shade(jersey, -0.35));
  put(k.pants[0], pants);
  put(k.pants[1], u.pantsStripe ? rgbOf(u.pantsStripe) : shade(pants, -0.3));
  put(k.socks[0], rgbOf(u.socks));
  put(k.skin[0], hex(skin[0]));
  k.skin.slice(1).forEach((key) => put(key, hex(skin[1])));
  return m;
};

const helmetPalette = (s: RegularSprites, team: string): { pal: Palette; frame: number } => {
  const { hel } = kitColors(team);
  const k = s.index.helmet.keys;
  const shell = rgbOf(hel.shell);
  const striped = hel.stripe !== 'none';
  return {
    frame: striped ? 0 : 1,
    pal: new Map([
      [toInt(hex(k.shell)), shell],
      [toInt(hex(k.stripe)), striped ? rgbOf(hel.stripes[0]) : shell],
      [toInt(hex(k.stripe2)), rgbOf(hel.stripes[1] ?? hel.shell)],
    ]),
  };
};

// ---------- Recolouring ----------

const urlCache = new Map<string, string>();

/** One cell of a sheet with its key colours replaced, as a data URL (cached per sprite × frame × palette). */
const recolor = (img: HTMLImageElement, sx: number, sy: number, w: number, h: number, pal: Palette, key: string): string => {
  const hit = urlCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const to = pal.get((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    if (to) [px[i], px[i + 1], px[i + 2]] = to;
  }
  ctx.putImageData(data, 0, 0);
  const url = c.toDataURL('image/png');
  urlCache.set(key, url);
  return url;
};

const skinCache = new Map<string, [string, string]>();
/** The skin a face is drawn in (its most common skin base), for the body's skin keys. */
const skinOfFace = (s: RegularSprites, f: GameFace): [string, string] => {
  const key = `${f.skin}:${f.faceY}:${f.faceX}`;
  const hit = skinCache.get(key);
  if (hit) return hit;
  let out = SKIN_BY_SHEET[f.skin];
  const { w, h } = s.index.faces;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(s.faces, f.faceX * w, faceRow(f) * h, w, h, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const counts = new Map<string, number>();
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const hx = `#${((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]).toString(16).padStart(6, '0')}`;
      if (FACE_SKINS[hx]) counts.set(hx, (counts.get(hx) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) out = [best[0], FACE_SKINS[best[0]]];
  }
  skinCache.set(key, out);
  return out;
};

export interface SpriteImage {
  src: string;
  w: number;
  h: number;
}

/** A player's portrait (bust) in his club's shirt. */
export const facePortrait = (s: RegularSprites, face: GameFace, team: string): SpriteImage => {
  const { w, h } = s.index.faces;
  const src = recolor(s.faces, face.faceX * w, faceRow(face) * h, w, h, facePalette(s, team), `face|${faceRow(face)}|${face.faceX}|${team}`);
  return { src, w, h };
};

/** Every frame of an on-field pose in his club's kit, skin matched to his face (empty when the pose is unknown). */
export const bodyFrames = (s: RegularSprites, face: GameFace, team: string, pose: BodyPose): SpriteImage[] => {
  const p = s.index.bodies.poses[pose];
  if (!p) return [];
  const [w, h] = s.index.bodies.cell;
  const skin = skinOfFace(s, face);
  const pal = bodyPalette(s, team, skin);
  return Array.from({ length: p.frames }, (_, i) => ({
    src: recolor(s.bodies, i * w, p.row * h, w, h, pal, `body|${pose}|${i}|${team}|${skin[0]}`),
    w,
    h,
  }));
};

/** The big helmet in the club's shell and stripes (the striped frame, or the plain one for a stripeless shell). */
export const helmetImage = (s: RegularSprites, team: string): SpriteImage => {
  const { w, h } = s.index.helmet;
  const { pal, frame } = helmetPalette(s, team);
  return { src: recolor(s.helmet, frame * w, 0, w, h, pal, `helmet|${frame}|${team}`), w, h };
};

