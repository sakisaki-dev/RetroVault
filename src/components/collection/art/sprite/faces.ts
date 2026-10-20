import { useSyncExternalStore } from 'react';
import type { GamePlayer } from '@/config/ovr';
import { F, PIX_H, PIX_W, PIX_X, line, set, span, stamp, type Key, type Pt, type Rect } from './grid';
import type { Helmet } from './helmets';
import type { PoseOut } from './poses';
import type { TeamStyle } from '../teamStyle';

/*
 * Faces: looks (sprites.json → SpriteLook, the standard generic character, skin ramp), heads and hair.
 *
 * Sprite looks for the Retro Bowl sprite art. Locked looks come from public/data/sprites.json (built from
 * data/y80/sprites.json, seeded from the game's portrait screens); everyone else gets a generated look from his
 * name, with the skin tone picked in the player editor (Player.spriteSkin) when set. A locked entry may name a
 * custom pixel image (public/data/sprites/<file>) that replaces the generated sprite entirely.
 */

export type SkinTone = 'pale' | 'light' | 'tan' | 'medium' | 'brown' | 'deep';
export type HairStyle = 'bald' | 'buzz' | 'short' | 'curly' | 'twists' | 'afro' | 'freeform' | 'mohawk' | 'spiky' | 'dreads' | 'crownlocs' | 'longlocs' | 'shortlocs' | 'braids' | 'long';
export type Facial = 'none' | 'stubble' | 'jawline' | 'shortbeard' | 'mustache' | 'goatee' | 'chinstrap' | 'beard' | 'fullbeard';
export type Build = 'normal' | 'big' | 'huge';
/** Bare-face shape: oval (everyone's default); opt-in for the good-looking faces: defined (Ikarras), chiseled (Brandson) */
export type FaceShape = 'oval' | 'defined' | 'chiseled';
/** A pose key from spritePoses.ts (e.g. 'qb-windup', 'cel-flex', 'sig-crossed') */
export type SpritePose = string;

export interface SpriteLook {
  skin: SkinTone;
  hair: { style: HairStyle; color: string };
  facial: Facial;
  accessories: string[];
  build: Build;
  height: 'normal' | 'tall';
  pose?: SpritePose;
  /** Custom pixel image file in public/data/sprites/ */
  image?: string;
  /** Eyes: 'intense' = wide whites, small pupils, heavy brows */
  eyes?: 'normal' | 'intense';
  /** Beard colour (a hair-colour name or #hex) when it differs from the hair's; unset = derived from the hair */
  beard?: string;
  /** Bare-face shape (helmet off); oval when unset */
  face?: FaceShape;
  /** Nose: 'straight' adds a bridge shadow */
  nose?: 'straight';
  /** Owner-requested showcase pose */
  signature?: boolean;
  /** From sprites.json (the owner's locked look) rather than generated */
  locked: boolean;
}

/**
 * Skin ramps sampled from the game (STYLE_GUIDE.md §5): highlight, base, shadow, dark (brows / nostrils / creases),
 * lips (closed) and mouth (inside an open grin).
 */
export interface SkinRamp {
  hi: string;
  base: string;
  shadow: string;
  dark: string;
  lips: string;
  mouth: string;
}
const RAMPS: Record<'light' | 'tan' | 'tan2' | 'medium' | 'brown' | 'deep', SkinRamp> = {
  light: { hi: '#e8c09e', base: '#eab39e', shadow: '#bb8f7e', dark: '#966143', lips: '#f17a7c', mouth: '#f6757a' },
  tan2: { hi: '#ecbfa4', base: '#e2a589', shadow: '#b5896c', dark: '#966143', lips: '#f17a7c', mouth: '#f17a7c' },
  tan: { hi: '#d7ab7c', base: '#cf9064', shadow: '#a57350', dark: '#966143', lips: '#c16263', mouth: '#c16263' },
  medium: { hi: '#c7936b', base: '#b36849', shadow: '#8f533a', dark: '#503424', lips: '#b5585e', mouth: '#ac5288' },
  brown: { hi: '#9a6d57', base: '#885345', shadow: '#6d4237', dark: '#4f2f22', lips: '#a8505e', mouth: '#ac5288' },
  deep: { hi: '#7c5a48', base: '#623c32', shadow: '#4e3028', dark: '#281d1a', lips: '#9a4a58', mouth: '#ac5288' },
};
/**
 * The six skin swatches (player editor picker and sprites.json "skin"), lightest first. The game has five bases; the
 * six keys stay (saved values keep resolving): pale = the game's Light, light = its lighter Tan (#e2a589).
 */
const TONE_RAMP: Record<SkinTone, SkinRamp> = { pale: RAMPS.light, light: RAMPS.tan2, tan: RAMPS.tan, medium: RAMPS.medium, brown: RAMPS.brown, deep: RAMPS.deep };
export const SKIN_TONES: { key: SkinTone; label: string; color: string }[] = [
  { key: 'pale', label: 'Light', color: TONE_RAMP.pale.base },
  { key: 'light', label: 'Light tan', color: TONE_RAMP.light.base },
  { key: 'tan', label: 'Tan', color: TONE_RAMP.tan.base },
  { key: 'medium', label: 'Medium', color: TONE_RAMP.medium.base },
  { key: 'brown', label: 'Brown', color: TONE_RAMP.brown.base },
  { key: 'deep', label: 'Deep', color: TONE_RAMP.deep.base },
];
export const isSkinTone = (x: unknown): x is SkinTone => SKIN_TONES.some((t) => t.key === x);
export const skinColor = (t: SkinTone) => (TONE_RAMP[t] ?? TONE_RAMP.tan).base;
export const skinRamp = (t: SkinTone): SkinRamp => TONE_RAMP[t] ?? TONE_RAMP.tan;

const HAIR_COLORS: Record<string, string> = {
  black: '#0c0600',
  darkbrown: '#3b2618',
  brown: '#6b4628',
  auburn: '#8f3e22',
  strawberry: '#c27a48',
  blond: '#d8b864',
  dirtyblond: '#a88a4c',
  bleached: '#f0c030',
  grey: '#9a9aa0',
};
export const hairColor = (c: string) => HAIR_COLORS[c] ?? (/^#[0-9a-f]{3,8}$/i.test(c) ? c : HAIR_COLORS.black);

type RawLook = Partial<Omit<SpriteLook, 'locked' | 'hair'>> & { hair?: Partial<SpriteLook['hair']> };

let table: Record<string, RawLook> | null = null;
let loading = false;
const listeners = new Set<() => void>();

const load = () => {
  if (table || loading || typeof fetch === 'undefined') return;
  loading = true;
  fetch(`${import.meta.env.BASE_URL}data/sprites.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((d: unknown) => {
      table = d && typeof d === 'object' ? (d as Record<string, RawLook>) : {};
      listeners.forEach((l) => l());
    });
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
};
const snapshot = () => table;

/** sprites.json table (null until it loads; one fetch per visit, shared by every card). */
export const useSpriteTable = () => useSyncExternalStore(subscribe, snapshot, () => null);

/** Skin of the generic character when the player editor's toggle is on Auto */
export const DEFAULT_SKIN: SkinTone = 'tan';

/** A player's sprite look: the locked sprites.json entry, else generated (skin from his edit, or his name). */
export const lookFor = (player: GamePlayer, t: Record<string, RawLook> | null): SpriteLook => {
  const raw = t?.[player.name];
  const edited = isSkinTone(player.spriteSkin) ? player.spriteSkin : null;
  // Standard generic character: everyone without a sprites.json entry gets the same face, body and a short cut;
  // only the skin toggle (player editor), the pose roll, the uniform roll and the number vary.
  const gen: SpriteLook = {
    skin: edited ?? DEFAULT_SKIN,
    hair: { style: 'short', color: 'black' },
    facial: 'none',
    accessories: [],
    build: 'normal',
    height: 'normal',
    locked: false,
  };
  if (!raw) return gen;
  return {
    skin: isSkinTone(raw.skin) ? raw.skin : gen.skin,
    hair: { style: raw.hair?.style ?? gen.hair.style, color: raw.hair?.color ?? gen.hair.color },
    facial: raw.facial ?? 'none',
    accessories: Array.isArray(raw.accessories) ? raw.accessories : [],
    build: raw.build ?? gen.build,
    height: raw.height ?? 'normal',
    pose: raw.pose,
    signature: !!raw.signature,
    eyes: raw.eyes === 'intense' ? 'intense' : 'normal',
    face: raw.face === 'chiseled' || raw.face === 'defined' ? raw.face : 'oval',
    nose: raw.nose === 'straight' ? 'straight' : undefined,
    beard: typeof raw.beard === 'string' ? raw.beard : undefined,
    image: raw.image,
    locked: true,
  };
};

/** True when sprites.json locks this player's skin (the editor's picker is then read-only). */
export const lockedSkin = (name: string, t: Record<string, RawLook> | null): SkinTone | null => {
  const s = t?.[name]?.skin;
  return isSkinTone(s) ? s : null;
};


// ---------- Heads ----------
//
// Retro Bowl chibi heads (IMG_6206, the in-game Fred Warner sprite, is the base style): a natural oval about a
// third of the sprite's height, 14 wide (ears included) × 15 rows from forehead to chin. Front-facing rows,
// relative to the head's `hy` (the forehead's top row):
//
//   0–3 forehead (the hairline sits on 1–3)   4–5 brows      6 eyes (whites + 2-px pupils; 7 for wide eyes)
//   7–8 nose bridge, ears 6–9, cheekbones      9 nostrils    10 moustache   11 mouth   12 lower lip
//   13–14 jaw and chin                         15 under-chin shadow          hair rises above row 0 (to −6)
//
// Two-tone skin (base + shadow down the right side, under the cheekbones and the jaw, one highlight on the
// forehead and cheekbone), dark brows, a nose shadow with nostrils, lips, teeth when smiling, solid facial hair.

/** Bare face, face out (14 wide, rows 0–15 from the forehead's top). The oval jaw; STRONG_JAW swaps rows 11–14. */
export const HEAD_BARE = [
  '...ssssssss...',
  '..dssssssssd..',
  '.dssssHHssssd.',
  '.dsssHssHsssd.',
  '.dssssssssssd.',
  '.dssssssssssd.',
  'sdssssssssssds',
  'xdssssssssssdx',
  'sdssssssssssds',
  'sdssssssssssds',
  '.dssssssssssd.',
  '.dssssssssssd.',
  '..dssssssssd..',
  '...dssssssd...',
  '....dssssd....',
  '....dddddd....',
];
/** Square, strong jaw (huge builds, the 'jawline' beard): rows 11–14. */
const STRONG_JAW = ['.dssssssssssd.', '.dssssssssssd.', '..dssssssssd..', '...dssssssd...'];
/**
 * Chiseled face (look.face 'chiseled', opt-in: Sherman Brandson, the most angular; 'defined' below is the same
 * structure for Rondale Ikarras, the reference face). Everyone else keeps the oval. Smaller than the oval, so more of the
 * head reads as hair: 10 wide at the brow, 12 at the high cheekbones (highlight H on row 7, a shadow above and the
 * hollow under them), then straight jaw lines tapering to a firm 4-px chin, two rows shorter than the oval
 * (under-chin on row 13); eyes and brows 1 px in. Big and huge builds (Brandson) push the jaw out 1 px each side
 * (rows 9–10) and end a row higher in a blunt chin (a 6-px last row over a 4-px under-chin on row 12, owner: "too
 * sharp, bring it up"); brow, cheekbones and eyes stay. Built from the left edge column of each row (L, mirrored at
 * 13 − L; the last entry is the under-chin); returned 16 wide (column 0 = the face's x − 1) so the ears fit.
 */
type FaceShape16 = { rows: string[]; L: (number | null)[]; under: number };
//                  rows 0 … (last = under-chin): normal build, big / huge
const CHISELED_L: [number[], number[]] = [
  [4, 3, 2, 2, 2, 2, 1, 1, 1, 2, 3, 4, 5, 5],
  [4, 3, 2, 2, 2, 2, 1, 1, 1, 1, 2, 4, 5],
];
/**
 * Defined face (look.face 'defined', opt-in: Rondale Ikarras, the proportioned ideal): the chiseled structure with a
 * gentler taper, the lower cheeks and jaw 1 px wider each side (rows 9–11) and a 6-px chin instead of a point.
 */
const DEFINED_L = [4, 3, 2, 2, 2, 2, 1, 1, 1, 1, 2, 3, 4, 4];
const faceCache = new Map<string, FaceShape16>();
const chiseledFace = (wide: boolean, ears: boolean, defined = false): FaceShape16 => {
  const id = `${+wide}${+ears}${+defined}`;
  const hit = faceCache.get(id);
  if (hit) return hit;
  const Ls = defined ? DEFINED_L : CHISELED_L[+wide];
  const rows = Array.from({ length: 16 }, (_, y) => {
    const L = Ls[y];
    const r = new Array(16).fill('.');
    if (L === undefined) return r.join('');
    const put = (x: number, k: string) => (r[x + 1] = k);
    const both = (x: number, k: string) => (put(x, k), put(13 - x, k));
    const under = Ls.length - 1;
    for (let x = L; x <= 13 - L; x++) put(x, y === under ? 'd' : 's');
    if (y > 0 && y < under) both(L, 'd');
    if (ears && y >= 6 && y <= 8) both(L - 1, y === 7 ? 'x' : 's');
    if (y === 7) both(L + 2, 'H');
    if (y === 6 || y === 8) both(L + 1, 'd');
    return r.join('');
  });
  const out = { rows, L: rows.map((_, y) => Ls[y] ?? null), under: Ls.length - 1 };
  faceCache.set(id, out);
  return out;
};

/**
 * Facial-hair templates on the bare face (14 wide, rows from 7). r = solid beard colour, b = darker beard,
 * ',' = stubble tone, z = stubble checker (stubble / skin shadow, so the skin shows through). Only the full beards
 * are solid blocks; shortbeard and stubble are a stubble shadow on the jaw ("Fred Warner with stubble").
 */
const BEARDS: Partial<Record<Facial, string[]>> = {
  stubble: ['..............', '..............', '..............', '.z..........z.', '.zz........zz.', '..zz......zz..', '..zzzzzzzzzz..', '...zzzzzzzz...'],
  mustache: ['..............', '..............', '....rrrrrr....'],
  goatee: ['..............', '..............', '....rrrrrr....', '..............', '..............', '.....rrrr.....', '.....rrrr.....', '......rr......'],
  jawline: ['..............', '..............', '.r...rrrr...r.', '.r..r....r..r.', '.r..........r.', '..r..rrrr..r..', '...r..rr..r...', '....rrrrrr....'],
  chinstrap: ['.r..........r.', '.r..........r.', '.r..rrrrrr..r.', '.r..........r.', '.rr........rr.', '.rr........rr.', '..rr......rr..', '...rrrrrrrr...'],
  shortbeard: ['..............', '..............', '.zz.,,,,,,.zz.', '.zz........zz.', '.zzz......zzz.', '.zzzz....zzzz.', '..zzzzzzzzzz..', '...zzzzzzzz...'],
  beard: ['.r..........r.', '.rr........rr.', '.rrrrrrrrrrrr.', '.rrrr....rrrr.', '.rrrrr..rrrrr.', '.rrrrrrrrrrrr.', '..rrrrrrrrrr..', '..rrrrrrrrrr..', '...rrrrrrrr...'],
  fullbeard: ['.r..........r.', '.rr........rr.', '.rrrrrrrrrrrr.', '.rrrr....rrrr.', '.rrrrr..rrrrr.', '.rrrrrrrrrrrr.', '..rrrrrrrrrr..', '..rrrrrrrrrr..', '...rrrrrrrr...', '....rrrrrr....'],
};
const FACE_MAP: Record<string, Key> = { ',': 'fS', b: 'fB', L: 'fL', M: 'fM', n: 'fN', H: 'fH', T: 'fT', W: 'T' };
/** Beard pixels: 'r' is the beard colour (near-black, or a darker version of light hair), not the hair */
const BEARD_MAP: Record<string, Key> = { ...FACE_MAP, r: 'fb' };

/** Face-only colour keys (merged into render.ts colours()): lips, nostrils, stubble, darker beard. */
export const faceColours = (look: SpriteLook): Record<Key, string> => {
  const ramp = skinRamp(look.skin);
  const hair = hairColor(look.hair.color);
  // Beards: near-black for dark hair, a darker version of light hair (with a 1-px checker of two browns)
  const dark = look.hair.color === 'black' || look.hair.color === 'darkbrown' || hair === HAIR_COLORS.black;
  const own = look.beard ? hairColor(look.beard) : null;
  return {
    fL: ramp.lips,
    fM: ramp.mouth,
    fN: ramp.dark,
    fS: `color-mix(in srgb, ${ramp.base} 50%, ${dark ? '#0c1826' : hair})`,
    fb: own ?? (dark ? '#0c1826' : `color-mix(in srgb, ${hair} 60%, #2a1406)`),
    fB: own ? `color-mix(in srgb, ${own} 70%, #000)` : dark ? '#160b00' : `color-mix(in srgb, ${hair} 45%, #2a1406)`,
    fR: '#ffcf6b',
    fr: '#ffe7a8',
    fH: ramp.hi,
    fU: '#3a3d48',
    fE: '#c0cbdc',
    fT: dark ? '#1e1d1c' : `color-mix(in srgb, ${hair} 75%, #fff)`,
    // Loc strand tones (crownlocs): lit and mid, both a little lighter than the hair, which fills the gaps
    fl: `color-mix(in srgb, ${hair} 82%, #fff)`,
    fm: `color-mix(in srgb, ${hair} 91%, #fff)`,
    ...PORTRAIT_COLOURS,
  };
};

/**
 * Facial hair as solid pixel shapes on a face-out head. fx = the face's left column, w its width; rows: must
 * (moustache), mouth (top lip), jaw, chin, under (below the chin), cheek (where sideburns start). Beards leave the
 * mouth open; the expression is drawn after. (Helmet faces; the bare head uses the BEARDS templates.)
 */
export interface FaceRows {
  must: number | null;
  mouth: number;
  jaw: number;
  chin: number;
  under: number;
  cheek: number;
}
export const faceHair = (R: Rect[], fx: number, w: number, r: FaceRows, f: SpriteLook['facial']) => {
  const L = fx;
  const Rt = fx + w - 1;
  const mid = fx + Math.floor(w / 2);
  const sides = (a: number, b: number) => {
    for (let y = a; y <= b; y++) {
      set(R, L, y, 'r');
      set(R, Rt, y, 'r');
    }
  };
  if (f === 'none') return;
  if (f === 'stubble') {
    for (let x = L + 2; x < Rt - 1; x += 2) set(R, x, r.jaw, 'fS');
    for (let x = L + 3; x < Rt - 2; x += 2) set(R, x, r.chin, 'fS');
    return;
  }
  const must = () => r.must != null && span(R, mid - 3, mid + 2, r.must);
  if (f === 'mustache') return void must();
  if (f === 'goatee') {
    must();
    span(R, mid - 2, mid + 1, r.chin);
    span(R, mid - 1, mid, r.under);
    return;
  }
  if (f === 'jawline') {
    // A close beard line along a strong jaw, 1 px
    sides(r.mouth, r.jaw);
    span(R, L + 1, Rt - 1, r.chin);
    return;
  }
  if (f === 'chinstrap') {
    sides(r.cheek, r.jaw);
    span(R, L + 1, Rt - 1, r.chin);
    return;
  }
  // shortbeard / beard / fullbeard: moustache, around the mouth, the jaw and chin filled
  must();
  sides(r.cheek + (f === 'fullbeard' ? 0 : 2), r.jaw);
  span(R, L, L + 1, r.mouth);
  span(R, Rt - 1, Rt, r.mouth);
  span(R, L, Rt, r.jaw);
  span(R, L + 1, Rt - 1, r.chin);
  if (f !== 'shortbeard') span(R, L + 2, Rt - 2, r.under);
  if (f === 'fullbeard') span(R, L + 3, Rt - 3, r.under + 1);
};

export interface HeadOpts {
  look: SpriteLook;
  pose: PoseOut;
  style: TeamStyle;
  hel: Helmet;
}

/** Mouth by expression, on a helmet face: x = the mouth's left column (4 wide), y = its top row. */
export const mouth = (R: Rect[], x: number, y: number, ex: PoseOut['expr']) => {
  if (ex === 'smile') R.push(...stamp(['mTTTTm', '.mmmm.'], x - 1, y));
  else if (ex === 'open') R.push(...stamp(['mmmm', 'oooo', '.oo.'], x, y));
  else if (ex === 'grimace') R.push(...stamp(['mTTTTm', 'mmmmmm'], x - 1, y));
  else if (ex === 'stern') R.push(...stamp(['mmmmmm', 'ssssss'], x - 1, y));
  else if (ex === 'exalted') R.push(...stamp(['ssss', '.oo.'], x, y));
};

/** Eyes and brows by expression / look on a helmet face: brows at row y, eyes at y + 1, eye columns lx / rx. */
export const eyes = (R: Rect[], lx: number, rx: number, y: number, look: SpriteLook, ex: PoseOut['expr']) => {
  if (look.eyes === 'intense') {
    // Wide bright whites, small pupils, heavy furrowed brows: an unsettling stare
    R.push(...stamp(['EEEE'], lx - 1, y), ...stamp(['EEEE'], rx - 1, y), ...stamp(['...E'], lx - 1, y + 1), ...stamp(['E...'], rx - 1, y + 1));
    R.push(...stamp(['wew'], lx, y + 1), ...stamp(['wew'], rx, y + 1), ...stamp(['www'], lx, y + 2), ...stamp(['www'], rx, y + 2));
    return;
  }
  if (ex === 'stern') R.push(...stamp(['EEE', '..E'], lx, y), ...stamp(['EEE', 'E..'], rx, y));
  if (ex === 'exalted') R.push(...stamp(['EE.', '.e.', 'www'], lx, y - 1), ...stamp(['.EE', '.e.', 'www'], rx, y - 1));
  if (ex === 'smile' || ex === 'open') R.push(...stamp(['.EE'], lx, y - 1), ...stamp(['EE.'], rx, y - 1), ...stamp(['sss'], lx, y), ...stamp(['sss'], rx, y));
};

/**
 * Brows + eyes on the bare face (STYLE_GUIDE §5): each eye is 1 white + 1 pupil in one row (row 6), pupils toward the
 * nose (columns 3 and 10, 7 apart); brows are 2 px, one row above with a 1-row gap (row 4), inner ends 5 apart.
 * Angry / intense looks drop the brow onto the eye (no gap) and slant it 1 px down toward the nose.
 */
const bareEyes = (R: Rect[], hx: number, hy: number, look: SpriteLook, ex: PoseOut['expr'], inset = 0) => {
  // Left-side rows (face columns 1–5); the right side is their mirror image (columns 8–12)
  const both = (left: string[], dy: number) =>
    R.push(...stamp(left, hx + 1 + inset, hy + dy), ...stamp(left.map((r) => [...r].reverse().join('')), hx + 8 - inset, hy + dy));
  if (look.eyes === 'intense') {
    // Scary stare: the brow pressed down onto the eye and slanted; a 3-px eye, the pupil staring out of the white
    both(['.E...', '..EE.'], 4);
    both(['.wew.'], 6);
    return;
  }
  if (ex === 'stern' || ex === 'grimace') {
    both(['.E...', '..EE.'], 4);
    both(['.we..'], 6);
    return;
  }
  if (ex === 'exalted') {
    // Reverent, eyes up: brows lifted at the inner end, calm one-row eyes with the pupil on the white's top edge
    both(['...E.', '..E..'], 3);
    both(['.ww..'], 6);
    R.push([hx + 3 + inset, hy + 6, 1, 0.5, 'e'], [hx + 10 - inset, hy + 6, 1, 0.5, 'e']);
    return;
  }
  // Calm / smiling / open: level brows
  both(['..EE.'], ex === 'open' ? 3 : 4);
  both(['.we..'], 6);
};

/** Nose (two nostrils, 3 apart, two rows under the eyes) and the mouth (rows 9–11) by expression on the bare face. */
const bareMouth = (R: Rect[], hx: number, hy: number, ex: PoseOut['expr']) => {
  R.push(...stamp(['n..n'], hx + 5, hy + 8, FACE_MAP));
  const m = (rows: string[], dx: number, dy: number) => R.push(...stamp(rows, hx + dx, hy + dy, FACE_MAP));
  // Grin: dark lip line, white teeth, the mouth colour; corners turned up in skin-dark
  if (ex === 'smile') m(['mmmmmm', 'nWWWWn', '.MMMM.'], 4, 9);
  else if (ex === 'open') m(['.mmmm.', 'mWWWWm', 'mMMMMm', '.MMMM.'], 4, 9);
  else if (ex === 'grimace') m(['mmmmmm', 'mWWWWm', '.mmmm.'], 4, 9);
  // Frown / pout: 1 px of lip over 3
  else if (ex === 'stern') m(['..L.', '.LLL'], 4, 10);
  else if (ex === 'exalted') m(['LL'], 6, 10);
  // Closed / neutral: 2–3 px of lip colour, one row
  else m(['LLL'], 5, 10);
};

/** Bare head (helmet off) at (hx, hy): hair, face, brows / eyes / mouth by expression, facial hair, ears. */
export const bareHead = (hx: number, hy: number, { look, pose }: HeadOpts, tall: number): Rect[] => {
  const R: Rect[] = [];
  const ex = pose.expr ?? 'line';
  const strong = look.build === 'huge' || look.facial === 'jawline';
  // Long hair hangs behind the head and shoulders
  R.push(...hairBehind(hx, hy, look, tall, !!pose.wind));
  const shape = look.face ?? 'oval';
  // Faces as 16-wide rows (column 0 = hx − 1). Crown locs fall in front of the ears, so that face has none.
  const ang = shape === 'oval' ? null : chiseledFace(look.build !== 'normal', look.hair.style !== 'crownlocs', shape === 'defined');
  const face16 = ang ? ang.rows : (strong ? [...HEAD_BARE.slice(0, 11), ...STRONG_JAW, HEAD_BARE[15]] : HEAD_BARE).map((r) => `.${r}.`);
  R.push(...stamp(face16, hx - 1, hy, FACE_MAP));
  // Extent of a face row in face columns (hx + x), ears left out, or null
  const extent = (y: number): [number, number] | null => {
    if (ang) {
      const L = ang.L[y];
      return L == null ? null : [L, 13 - L];
    }
    const r = face16[y];
    if (!r || !/[^.]/.test(r)) return null;
    return [r.search(/[^.]/) - 1, r.length - 2 - [...r].reverse().join('').search(/[^.]/)];
  };
  // Jawline beard on a chiseled face: a 1-px line along the jaw edge from the cheekbone to the chin, the under-chin,
  // a thin moustache and a chin strip (the oval keeps its template)
  const jawLine = !!ang && look.facial === 'jawline';
  if (jawLine) {
    for (let y = 8; y <= ang.under; y++) {
      const e = extent(y);
      if (!e) continue;
      if (y === ang.under) R.push([hx + e[0], hy + y, e[1] - e[0] + 1, 1, 'fb']);
      else R.push([hx + e[0], hy + y, 1, 1, 'fb'], [hx + e[1], hy + y, 1, 1, 'fb']);
    }
    R.push([hx + 5, hy + 9, 4, 1, 'fb'], [hx + 6, hy + 12, 2, 1, 'fb']);
  }
  const beard = jawLine ? undefined : BEARDS[look.facial];
  if (beard)
    beard.forEach((row, j) => {
      const y = 7 + j;
      // Chiseled faces: the templates are drawn for the oval; each half of a row slides in onto the narrower jaw, and
      // a full beard below the chin hangs at the under-chin's width
      const ref = HEAD_BARE[Math.min(y, 15)];
      const a = ref.search(/[^.]/);
      const b = ref.length - 1 - [...ref].reverse().join('').search(/[^.]/);
      const e = !ang ? null : extent(y) ?? (y > ang.under ? extent(ang.under) : null);
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        let x = i;
        if (ang) {
          if (!e) return;
          x = i < 7 ? e[0] + (i - a) : e[1] - (b - i);
          if (x < e[0] || x > e[1]) return;
        } else if (y <= 14 && (!face16[y] || face16[y][i + 1] === '.')) return;
        R.push([hx + x, hy + y, 1, 1, ch === 'z' ? ((x + y) % 2 ? 'fS' : 'd') : (BEARD_MAP[ch] ?? ch)]);
      });
    });
  // Chiseled: the jaw edge in skin-dark over any beard, from the cheek hollow down to the chin (a defined jawline)
  if (ang)
    for (let y = 9; y < ang.under; y++) {
      const e = extent(y);
      if (e) R.push([hx + e[0], hy + y, 1, 1, 'fN'], [hx + e[1], hy + y, 1, 1, 'fN']);
    }
  // A straight nose (look.nose): a bridge shadow down the shade side from the eyes to the nostrils
  if (look.nose === 'straight') R.push([hx + 7, hy + 6, 1, 2, 'd']);
  const inset = ang ? 1 : 0;
  bareEyes(R, hx, hy, look, ex, inset);
  bareMouth(R, hx, hy, ex);
  // Eye black: a smudge on the cheekbone (left off when looking up in reverence)
  if (look.accessories.includes('eyeblack') && ex !== 'exalted') R.push(...stamp(['kk'], hx + 2 + inset, hy + 8), ...stamp(['kk'], hx + 10 - inset, hy + 8));
  if (look.accessories.includes('earrings')) {
    // On the ear lobe, under the ear (the oval's ear runs a row longer)
    const lobe = !ang ? 0 : (extent(8)?.[0] ?? 1) - 1;
    R.push([hx + lobe, hy + 9, 1, 1, 'fE'], [hx + 13 - lobe, hy + 9, 1, 1, 'fE']);
  }
  R.push(...bareHair(hx, hy, look, tall, !!pose.wind));
  return R;
};

/** How far the bare head's hair rises above the forehead's top row (render.ts fits the frame by height with it). */
export const hairRise = (look: SpriteLook): number => {
  const s = look.hair.style;
  if (look.accessories.includes('durag')) return 2;
  if (s === 'crownlocs') return 5;
  return s === 'twists' || s === 'dreads' || s === 'shortlocs' || s === 'freeform' ? 7 : s === 'afro' || s === 'mohawk' || s === 'spiky' ? 6 : s === 'bald' ? 2 : 3;
};

/**
 * Crown locs (Sherman Brandson): a crown of thick locs, 2-px strands in two near-black tones (r, fT) with a twist every
 * few rows, a glint (R) every 5 rows on each strand's outer column and on the tips of every other strand. 11 strands at
 * x = hx − 4 … hx + 16 (symmetric about the face's centre line), domed from row −5 at the middle to −2 at the edges
 * (owner: the detailed version, but not as big on top), the top edge still made of staggered loc tips; the five over
 * the face end in a fringe on rows 0–2, the three each side fall around the face to the jaw / neck (rows 10–13).
 * Nothing hangs behind. Cells above the forehead's row 1 are drawn over the face, the side strands below it behind the
 * face so the face stays whole.
 */
const crownLocs = (hx: number, hy: number, front: boolean): Rect[] => {
  const R: Rect[] = [];
  for (let k = 0; k < 11; k++) {
    const x0 = -4 + k * 2;
    const m = Math.min(k, 10 - k);
    const top = -5 + Math.round(((5 - m) / 5) ** 2 * 3) + (m % 2);
    // Side strands end staggered round the jaw and neck (a ragged mane, not a cut line); fringe tips over the brow
    const bottom = m < 3 ? [10, 13, 12][m] : [2, 0, 1][m - 3];
    // Mirror-image texture: the strand's outer column and twist rows count from the outside in
    const out = k < 5 ? 0 : 1;
    for (let y = top; y <= bottom; y++) {
      if (front !== (y <= 0 || m >= 3)) continue;
      for (let c = 0; c < 2; c++) {
        const twistRow = (y - top + m) % 4 === 0;
        let key: Key = (c === out) !== twistRow ? 'fT' : 'r';
        // A twist glint every 5 rows on the outer column, and on the tips of every other strand
        if (c === out && (y - top + 2 * m) % 5 === 2) key = 'R';
        if (y === bottom && m % 2 === 0 && c === out) key = 'R';
        R.push([hx + x0 + c, hy + y, 1, 1, key]);
      }
    }
  }
  return R;
};

/** Locs / braids / long hair hanging behind the head (drawn before the face). */
const hairBehind = (hx: number, hy: number, look: SpriteLook, tall: number, wind: boolean): Rect[] => {
  const s = look.hair.style;
  const R: Rect[] = [];
  if (look.accessories.includes('durag')) {
    // Durag tails: two flat strips from the knot at the back, hanging behind the neck onto the shoulder
    R.push([hx - 1, hy + 2, 2, 2, 'U'], [hx - 2, hy + 4, 2, 7, 'U'], [hx, hy + 4, 1, 5, 'U'], [hx - 2, hy + 6, 1, 3, 'fU']);
    return R;
  }
  if (s === 'crownlocs') return crownLocs(hx, hy, false);
  if (s === 'dreads' || s === 'longlocs' || s === 'braids') {
    // Separate strands (the outline shows between them) over the shoulders, with a twisted texture
    const len = (s === 'braids' ? 13 : 16) + tall;
    const cols = s === 'braids' ? [-1, 14] : [-2, 0, 13, 15];
    cols.forEach((dx, i) => {
      const short = i === 0 || i === cols.length - 1 ? 3 : 0;
      for (let j = 0; j < len - short; j++) {
        const sway = wind ? -Math.floor(j / 4) : 0;
        R.push([hx + dx + sway, hy + 1 + j, 1, 1, (j + i) % 3 === 0 ? 'R' : 'r']);
        if (s !== 'braids') R.push([hx + dx + sway + (dx < 7 ? 1 : -1), hy + 1 + j, 1, 1, 'r']);
      }
      if (s === 'braids') R.push([hx + dx, hy + 1 + len, 1, 1, 'j']);
    });
  } else if (s === 'long') {
    const len = 15 + tall;
    for (let j = 0; j < len; j++) {
      const sway = wind ? -Math.floor(j / 4) : 0;
      R.push([hx - 1 + sway, hy + 1 + j, 3, 1, j % 5 === 2 ? 'R' : 'r'], [hx + 12 + sway, hy + 1 + j, 3 - (j > len - 3 ? 1 : 0), 1, j % 5 === 4 ? 'R' : 'r']);
    }
  }
  return R;
};

/** Twisted-loc texture: r with a checker of highlights. */
const twist = (rows: string[]) => rows.map((r, j) => [...r].map((c, i) => (c === 'r' && (i * 2 + j) % 7 === 0 ? 'T' : c)).join(''));

/** Hair on a bare head (14 wide at hx; the forehead's top row is hy), by style; drawn over the face. */
export const bareHair = (hx: number, hy: number, look: SpriteLook, tall: number, wind = false): Rect[] => {
  void tall;
  const s = look.hair.style;
  const R: Rect[] = [];
  const top = (rows: string[], dy: number, dx = 0, map: Record<string, Key> = {}) => R.push(...stamp(rows, hx + dx, hy + dy, map));
  if (look.accessories.includes('durag')) {
    // Durag: a smooth cap hugging the skull, a seam down the middle and a band across the forehead
    top(['....UUUUUU....', '..UUUUVUUUUU..', '.UUUUUVUUUUUU.', '.UVUUUVUUUUUU.', '.UUUUUVUUUUUU.', '.UUUUUUUUUUUU.'], -3, 0, { V: 'fU' });
    R.push([hx + 1, hy + 3, 12, 1, 'fB'], [hx + 1, hy + 3, 1, 2, 'U'], [hx + 12, hy + 3, 1, 2, 'U']);
    return R;
  }
  if (s === 'bald') top(['....ssssss....', '..ssuussssss..', '.ssusssssssd..'], -2);
  else if (s === 'buzz') top(['...rrrrrrrr...', '..rrrrrrrrrr..', '.rrrrrrrrrrrr.', '.r..........r.'], -2);
  else if (s === 'short') {
    // The standard short cut (every generic player with his helmet off)
    top(['....rrrrrr....', '..rrrRRrrrrr..', '.rrRrrrrrrrrr.', '.rrrrrrrrrrrr.', '.rrrrrrrrrrrr.', '.rr.r.rr.r.rr.', '.r..........r.', '.r..........r.'], -3);
  } else if (s === 'afro') {
    top(['....rrrrrrrr....', '..rrrrrRrrrrrr..', '.rrrRrrrrrrRrrr.', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrr........rrrr', '.rr..........rr.', '.rr..........rr.', '..r..........r..'], -6, -1);
  } else if (s === 'mohawk') {
    top(['.....rrr......', '....rrRr......', '....rrrrr.....', '...rrRrrr.....', '..,,rrrrr,,,..', '.,,,,rrrr,,,,.', '.,,,,,,,,,,,,.', '.,..........,.'], -6);
  } else if (s === 'spiky') {
    top(['...r..r..r....', '...rr.rr.rr.r.', '..rrrrrrrrrr..', '.rrRrrRrrRrrr.', '.rrrrrrrrrrrr.', '.rrrrrrrrrrrr.', '.rr.r.rr.r.rr.', '.r..........r.'], -6);
  } else if (s === 'curly') {
    top(['..rr.rr.rr.r..', '.rrRrrRrrRrrr.', '.rrrrrrrrrrrr.', '.rRrrRrrRrrRr.', '.rr.r.rr.r.rr.', '.r..........r.'], -3);
  } else if (s === 'twists' || s === 'dreads') {
    // A high-top of twists standing up and swept back (to the left), like Fred Warner's
    const lean = wind ? -1 : 0;
    top(twist(['...r...r..r.....', '..rr..rr.rr.r...', '.rrr.rrrrrrrr...', '.rrrrrrrrrrrrr..', '..rrrrrrrrrrrrr.']), -7, -2 + lean, FACE_MAP);
    top(twist(['.rrrrrrrrrrrr.', '.rrrrrrrrrrrr.', '.rrrrrrrrrrrr.', '.rr.r.rr.r.rr.', '.r..........r.']), -2, 0, FACE_MAP);
  } else if (s === 'crownlocs') {
    R.push(...crownLocs(hx, hy, true));
  } else if (s === 'longlocs') {
    // Long locs from the crown, no high-top (Isaiah Karras): a cap of locs with the scalp showing between them on the
    // crown (H), a short fringe, then strands down both sides over the ears, past the jaw and onto the chest in front
    top(twist(['...rrrrrrrr...', '..rrrrrrrrrr..', '.rrrHrrrHrrrr.', 'rrrHrrrrrHrrrr', 'rrrrrrrrrrrrrr', 'rrr.r.rr.r.rrr', 'rr..........rr']), -3, 0, FACE_MAP);
    [
      [-1, 22],
      [0, 25],
      [1, 21],
      [12, 21],
      [13, 25],
      [14, 22],
    ].forEach(([dx, len], i) => {
      for (let j = 0; j < len; j++) {
        const sway = wind ? -Math.floor(j / 5) : 0;
        R.push([hx + dx + sway, hy + 3 + j, 1, 1, (j + i * 2) % 4 === 0 ? 'fT' : 'r']);
      }
    });
  } else if (s === 'shortlocs' || s === 'freeform') {
    // Wild twists sticking out all round, down to the jaw (Macleone); freeform a shorter, messier mop
    top(
      twist([
        '.....r...r...r....',
        '..r..rr.rrr.rr..r.',
        '...rrrrrrrrrrrrrr.',
        '.rrrrrrrrrrrrrrrr.',
        'rrrrrrrrrrrrrrrrrr',
        '.rrrrrrrrrrrrrrrrr',
        'rrrrrrrrrrrrrrrrr.',
        '.rrrrrrrrrrrrrrrrr',
        'rrrrr.r..r.r.rrrr.',
        '.rrr..........rrrr',
        'rrr............rr.',
        '..rr...........rrr',
        '.rr............rr.',
        'r.r.............r.',
        '.r..............rr',
        'rr..............r.',
        '.r...............r',
        'r.................',
      ]).slice(0, s === 'freeform' ? 12 : 18),
      -7,
      -2,
      FACE_MAP,
    );
  } else if (s === 'braids') {
    // Cornrows: front-to-back rows
    top(['....rRrRrR....', '..rRrRrRrRrR..', '.rRrRrRrRrRrr.', '.rRrRrRrRrRrr.', '.rrrrrrrrrrrr.', '.rr........rr.'], -3);
  } else if (s === 'long') {
    // Centre-parted curtain framing the face
    top(['....rrrrrr....', '..rrrRrrRrrr..', '.rrRrrrrrrRrr.', 'rrrrrrr.rrrrrr', 'rrrrr....rrrrr', 'rrr........rrr', 'rr..........rr', 'rr..........rr', 'rr..........rr', 'rr..........rr'], -3);
  }
  if (look.accessories.includes('headband')) R.push([hx + 1, hy + 1, 12, 1, 'k']);
  return R;
};

/** Hair out of the back / bottom of a side helmet (short hair stays hidden under the helmet). */
export const helmetHair = (hx0: number, hy: number, look: SpriteLook, tall: number): Rect[] => {
  // The side helmet's back edge sits at x 2–4 low down (helmets.ts HEAD_SIDE), so the hair hangs from just under it
  const hx = hx0 - 1;
  const s = look.hair.style;
  const R: Rect[] = [];
  if (s === 'crownlocs') {
    // Loc ends hang from under the back of the helmet onto the shoulders: parallel 2-px strands, dark 1-px gaps
    [9, 11].forEach((len, i) => {
      const x = hx + i * 3;
      R.push([x - 1, hy + 13, 1, len - 1, 'r'], [x, hy + 13, 1, len + tall, 'fm'], [x + 1, hy + 13, 1, len + tall, 'fl']);
      R.push([x + (i % 2), hy + 12 + len + tall, 1, 1, 'R']);
    });
  } else if (s === 'dreads' || s === 'longlocs' || s === 'braids' || s === 'shortlocs' || s === 'long') {
    const len = (s === 'dreads' || s === 'longlocs' ? 9 : s === 'shortlocs' ? 6 : s === 'long' ? 9 : 8) + tall;
    const xs = s === 'braids' ? [0, 2] : [0, 2, 4];
    xs.forEach((dx, i) => {
      R.push([hx + 2 + dx, hy + 13, s === 'braids' ? 1 : 2, len - (i % 2) * 2, 'r']);
      for (let y = hy + 14 + (i % 2); y < hy + 12 + len; y += 3) R.push([hx + 2 + dx, y, 1, 1, 'R']);
    });
  } else if (s === 'afro' || s === 'twists' || s === 'freeform' || s === 'curly') {
    R.push([hx + 1, hy + 12, 3, 4, 'r'], [hx, hy + 13, 1, 2, 'r']);
  }
  return R;
};

// ---------- Signature portrait: "Golden hour" ----------
//
// A zoomed-in head-and-shoulders portrait on the fine grid (F cells per sprite pixel, so twice the sprite's
// detail): the head tilted up toward a low sun at the upper right, eyes up, serene; warm golden-hour rim light down
// the sun side, a pixel sun with a stepped glow and a lens flare, locs falling over massive shoulders, the number on
// the near shoulder. Built analytically per cell (head and features in head-local coordinates, rotated), then
// quantised to a few tones, so it stays crisp pixel art. render.ts draws it instead of the body for these keys.

/** Pose keys drawn as a portrait instead of a full-body sprite. */
export const PORTRAIT_POSES = new Set(['sig-golden']);
export const isPortraitPose = (key: string) => PORTRAIT_POSES.has(key);

/** Portrait colour keys (merged into render.ts colours() via faceColours). */
const PORTRAIT_COLOURS: Record<Key, string> = {
  g0: '#fff4cf',
  g1: '#ffe39a',
  g2: '#fdca6c',
  g3: '#f7ad57',
  g4: '#ee8c4a',
  g5: '#d96c45',
  g6: '#b8523f',
  gF: '#fff0bc',
  gf: '#ffd98a',
};

const PDIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

/**
 * The Golden hour portrait as fine-grid cells (sprite coordinates, 1 / F wide), background included. Colour keys:
 * skin s / d / x, golden rim fR, warm highlight fr, hair r / fT, beard fB, eyes w / e, brows E, lips fL, mouth m,
 * jersey J / Y / Z / j, number N / O, sky g0–g6, sun / flare gF / gf, outline o.
 */
export const goldenHourPortrait = (look: SpriteLook, number: number | null | undefined): Rect[] => {
  const W = PIX_W * F;
  const H = PIX_H * F;
  const g: (Key | undefined)[] = new Array(W * H);
  const at = (x: number, y: number) => y * W + x;
  const put = (x: number, y: number, k: Key) => {
    if (x >= 0 && y >= 0 && x < W && y < H) g[at(x, y)] = k;
  };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? g[at(x, y)] : undefined);

  // Head frame: centre, radii, tilt (negative: crown back to the left, chin up toward the sun)
  const hc: Pt = [56, 56];
  const a = 22;
  const b = 27;
  const t = (-20 * Math.PI) / 180;
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const local = (x: number, y: number): Pt => {
    const dx = x + 0.5 - hc[0];
    const dy = y + 0.5 - hc[1];
    return [dx * ct + dy * st, -dx * st + dy * ct];
  };
  const toScreen = (u: number, v: number): Pt => [hc[0] + u * ct - v * st, hc[1] + u * st + v * ct];
  // Light from the upper right, in front
  const L = [0.62, -0.55, 0.56];
  const inEll = (u: number, v: number, cu: number, cv: number, ru: number, rv: number) => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 <= 1;
  // The face looks up and a little to the right: features sit up and right of the head's centre
  const fu = 2.5;
  const fv = -3;

  // 1. Shoulders (massive, pads), back locs, neck
  const shTop = 96;
  // Massive shoulders: traps sloping up into the neck, two big rounded pads
  const topAt = (x: number) => {
    const cx = x + 0.5;
    const trap = 86 + Math.abs(cx - 58) * 0.5;
    const pad = (c: number) => (Math.abs(cx - c) < 26 ? shTop + 2 - 12 * Math.sqrt(1 - ((cx - c) / 26) ** 2) : 999);
    return Math.min(trap, pad(22), pad(95));
  };
  for (let x = 0; x < W; x++) {
    const top = topAt(x);
    for (let y = Math.ceil(top); y < H; y++) {
      const dy = y - top;
      let k: Key = 'J';
      if (dy < 3.5) k = x > 58 ? 'Y' : 'J';
      if (x < 14 || (x < 40 && dy > 12)) k = 'Z';
      if (dy < 1.6 && x > 66) k = 'fR';
      if (x > 108 && dy < 20) k = 'fR';
      put(x, y, k);
    }
  }
  // Pad trim lines
  for (let x = 6; x < 110; x++) {
    const y = Math.round(topAt(x)) + 9;
    if (get(x, y) && Math.abs(x - 58) > 18) put(x, y, 'j');
  }
  // Number on the near (sun-side) shoulder: 3 × 5 digits, 2 cells per digit pixel, outlined
  if (number != null) {
    const s = String(number).slice(0, 2);
    const x0 = 92 - s.length * 4;
    const y0 = shTop + 16;
    const cells: Pt[] = [];
    [...s].forEach((ch, i) => {
      const bits = PDIGITS[Number(ch)] ?? PDIGITS[0];
      for (let q = 0; q < 15; q++)
        if (bits[q] === '1') for (let e = 0; e < 4; e++) cells.push([x0 + i * 8 + (q % 3) * 2 + (e % 2), y0 + Math.floor(q / 3) * 2 + (e >> 1)]);
    });
    cells.forEach(([x, y]) => [-1, 0, 1].forEach((ox) => [-1, 0, 1].forEach((oy) => get(x + ox, y + oy) && put(x + ox, y + oy, 'O'))));
    cells.forEach(([x, y]) => put(x, y, 'N'));
  }
  // Neck: thick, in shadow under the jaw, rim-lit on the sun side
  for (let y = 74; y < shTop + 2; y++)
    for (let x = 40; x < 80; x++) {
      const nx = (x + 0.5 - 60) / (15 + Math.max(0, y - 88) * 0.9);
      if (Math.abs(nx) > 1) continue;
      put(x, y, nx > 0.8 ? 'fR' : nx < -0.5 ? 'x' : y < 90 ? 'd' : 's');
    }

  // 2. Locs: twisted strands from the sides and back of the head falling over the shoulders (behind the face)
  const strand = (x0: number, y0: number, len: number, sway: number, sun: boolean) => {
    for (let j = 0; j < len; j++) {
      const x = Math.round(x0 + sway * Math.sin((j / len) * Math.PI * 0.9) + (j / len) * sway * 0.6);
      const y = y0 + j;
      for (let w = 0; w < 3; w++) {
        const tex = (j + w * 2) % 5 === 0;
        put(x + w, y, sun && w === 2 ? 'fR' : tex ? 'fT' : 'r');
      }
    }
  };
  const isHair = look.hair.style === 'dreads' || look.hair.style === 'crownlocs' || look.hair.style === 'longlocs' || look.hair.style === 'shortlocs' || look.hair.style === 'braids' || look.hair.style === 'long';
  if (isHair) {
    [-24, -18, -12, -5].forEach((v, i) => {
      const [sx, sy] = toScreen(-a + 1, v + 14);
      strand(Math.round(sx) - 5 - i * 3 + (i === 3 ? 8 : 0), Math.round(sy), [46, 52, 40, 44][i], -3, false);
    });
    [-14, -8, -2, 4].forEach((v, i) => {
      const [sx, sy] = toScreen(a - 3, v - 6);
      strand(Math.round(sx) - 2 + i * 3, Math.round(sy), [56, 60, 52, 46][i], 2 + (i % 2), true);
    });
  }

  // 3. Head: skin with two tones + warm highlight + golden rim, ears, then hair, features, beard
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [u, v] = local(x, y);
      const e = (u / a) ** 2 + (v / b) ** 2;
      // Strong jaw: square off the lower corners a little
      const jaw = v > b * 0.35 ? (u / (a * (1.02 - (v / b - 0.35) * 0.35))) ** 2 + (v / b) ** 2 : e;
      const ear = inEll(u, v, -a + 0.5, 2, 3.2, 6);
      if (jaw > 1 && !ear) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, e)));
      const n = [u / a, v / b, nz];
      const lum = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
      let k: Key = lum > 0.9 ? 'fr' : lum > 0.3 ? 's' : 'd';
      if (e > 0.86 && (n[0] > 0.4 || n[1] < -0.6) && lum > 0.3) k = 'fR';
      if (ear) k = inEll(u, v, -a + 0.5, 2, 1.4, 3.5) ? 'x' : 'd';
      put(x, y, k);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [u, v] = local(x, y);
      if (!get(x, y) && v > -b - 12) {
        // High-top twists above the crown, leaning back
        if (v < -b * 0.55 && isHair) {
          const lean = (v + b * 0.55) * 0.45;
          const w = u - lean;
          const col = ((Math.round(w) % 5) + 5) % 5;
          const top = -b - 8 + Math.abs(Math.sin(Math.round(w / 5) * 1.7)) * 4;
          if (Math.abs(w) < a * 0.92 && v > top && col !== 4) put(x, y, (Math.round(v) + col) % 4 === 0 ? 'fT' : col === 3 && w > 4 ? 'fR' : 'r');
        }
        continue;
      }
      if (!get(x, y)) continue;
      const k = get(x, y);
      if (k === 'J' || k === 'Y' || k === 'Z' || k === 'j' || k === 'N' || k === 'O') continue;
      if (!(((u / a) ** 2 + (v / b) ** 2) <= 1.05)) continue;
      // Hairline: the crown under the twists, temples
      const hairline = -b * 0.58 + 1.6 * Math.cos(u * 0.35);
      if (isHair && (v < hairline || (Math.abs(u) > a * 0.86 && v < -2 && !(u < 0 && v > -6)))) {
        put(x, y, u > a * 0.55 && v < hairline ? 'fR' : (Math.round(u) + Math.round(v)) % 6 === 0 ? 'fT' : 'r');
        continue;
      }
      const fx = u - fu;
      const fy = v - fv;
      // Brows: thick, gently arched and lifted (serene, confident)
      const browL = fx > -15 && fx < -4 && Math.abs(fy - (-10.5 + Math.abs(fx + 9.5) * 0.18)) < 1.3;
      const browR = fx > 4 && fx < 14 && Math.abs(fy - (-11 + Math.abs(fx - 9) * 0.2)) < 1.3;
      if (browL || browR) put(x, y, 'E');
      // Eyes: whites with the pupils at the top (looking up), a dark upper lid
      for (const [ecx, erx] of [[-9.5, 5], [9.4, 4.6]] as const) {
        if (inEll(fx, fy, ecx, -5, erx, 2.7)) {
          const lid = fy < -6.9;
          const pupil = inEll(fx, fy, ecx + 1, -6.2, 2.2, 1.9);
          put(x, y, lid && !pupil ? 'm' : pupil ? 'e' : 'w');
        }
      }
      // Nose: shadow down the side away from the sun, a lit tip, nostrils
      if (fx > -2 && fx < 0.2 && fy > -3 && fy < 6) put(x, y, 'd');
      if (inEll(fx, fy, 1.5, 6.5, 3.2, 1.6)) put(x, y, 'fr');
      if (inEll(fx, fy, -1.5, 8.2, 1.2, 0.8) || inEll(fx, fy, 4, 8.2, 1.2, 0.8)) put(x, y, 'fN');
      // Beard: moustache, chin and jaw, solid, with the mouth open in it
      const beard = look.facial !== 'none' && look.facial !== 'stubble';
      const inMouth = fy > 12 && fy < 16.5 && fx > -6.5 && fx < 8.5;
      if (beard && !inMouth) {
        const must = fy > 10 && fy < 12.6 && fx > -7.5 && fx < 9.5;
        const chin = fy > 15 && Math.abs(fx - 1) < 16 - Math.max(0, 15 - fy) * 0.9;
        const side = fy > 6 && Math.abs(fx - 0.5) > 15;
        if (must || chin || side) put(x, y, (Math.round(fx) * 3 + Math.round(fy)) % 7 === 0 ? 'fT' : get(x, y) === 'fR' ? 'fR' : 'fB');
      }
      if (look.facial === 'stubble' && fy > 10 && (Math.round(fx) + Math.round(fy)) % 2 === 0 && !inMouth) put(x, y, 'fS');
      // Mouth: closed, a confident half-smile rising toward the sun side; fuller lower lip
      if (inMouth) {
        const lineY = 13.4 - Math.max(0, fx - 3) * 0.28;
        if (Math.abs(fy - lineY) < 0.7) put(x, y, 'm');
        else if (fy > lineY && fy < lineY + 2.4 && fx > -4.5 && fx < 6.5) put(x, y, 'fL');
        else if (fy < lineY && fy > lineY - 1.6 && fx > -4 && fx < 6) put(x, y, 'fL');
      }
      // Cheekbone shadow on the far side
      if (fx < -11 && fy > -1 && fy < 9 && get(x, y) === 's') put(x, y, 'd');
    }

  // 4. No outline (STYLE_GUIDE.md rule 1): the figure meets the sky by colour alone

  // 5. Sky: a stepped glow round a low sun (dithered at the band edges), the sun, a lens flare toward the head
  const sun: Pt = [97, 20];
  const bands = [9, 13, 22, 34, 50, 70, 92];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (g[at(x, y)]) continue;
      const d = Math.hypot(x + 0.5 - sun[0], (y + 0.5 - sun[1]) * 1.05);
      let i = bands.findIndex((r) => d < r);
      if (i < 0) i = bands.length - 1;
      // Checker dither across the inner edge of each band
      if (i > 0 && d - bands[i - 1] < 1.6 && (x + y) % 2 === 0) i -= 1;
      g[at(x, y)] = i === 0 ? 'gF' : `g${Math.min(6, i - 1)}`;
    }
  const ring = (cx: number, cy: number, r: number, k: Key, fill = false) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const sky = typeof get(x, y) === 'string' && (get(x, y) as string).startsWith('g');
        if (sky && (fill ? d <= r : Math.abs(d - r) < 0.6)) put(x, y, k);
      }
  };
  // Flare: small discs and a ring along the line from the sun toward the head
  ring(84, 34, 2.2, 'g0', true);
  ring(78, 41, 1.2, 'gF', true);
  ring(66, 54, 4.5, 'gf');
  ring(104, 9, 1.6, 'g0', true);
  // Rays: short stepped spokes
  for (const ang of [0.2, 1.0, 1.75, 2.6, 3.5, 4.4, 5.3]) for (let r = 12; r < 18; r++) put(Math.round(sun[0] + Math.cos(ang) * r), Math.round(sun[1] + Math.sin(ang) * r), 'g0');

  // Runs → rects in sprite coordinates
  const out: Rect[] = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const k = g[at(x, y)];
      let e = x + 1;
      while (e < W && g[at(e, y)] === k) e++;
      if (k) out.push([PIX_X + x / F, y / F, (e - x) / F, 1 / F, k]);
      x = e;
    }
  }
  return out;
};
