import { useSyncExternalStore } from 'react';
import type { GamePlayer } from '@/config/ovr';
import { line, set, span, stamp, type Key, type Rect } from './grid';
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
export type HairStyle = 'bald' | 'buzz' | 'short' | 'curly' | 'twists' | 'afro' | 'freeform' | 'mohawk' | 'spiky' | 'dreads' | 'shortlocs' | 'braids' | 'long';
export type Facial = 'none' | 'stubble' | 'jawline' | 'shortbeard' | 'mustache' | 'goatee' | 'chinstrap' | 'beard' | 'fullbeard';
export type Build = 'normal' | 'big' | 'huge';
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
  /** Owner-requested showcase pose */
  signature?: boolean;
  /** From sprites.json (the owner's locked look) rather than generated */
  locked: boolean;
}

/** The six skin swatches (player editor picker and sprites.json "skin"), lightest first. */
export const SKIN_TONES: { key: SkinTone; label: string; color: string }[] = [
  { key: 'pale', label: 'Pale', color: '#ebbca0' },
  { key: 'light', label: 'Light', color: '#d9a07a' },
  { key: 'tan', label: 'Tan', color: '#c98a5a' },
  { key: 'medium', label: 'Medium', color: '#a5643f' },
  { key: 'brown', label: 'Brown', color: '#7a4630' },
  { key: 'deep', label: 'Deep', color: '#5a3222' },
];
export const isSkinTone = (x: unknown): x is SkinTone => SKIN_TONES.some((t) => t.key === x);
export const skinColor = (t: SkinTone) => SKIN_TONES.find((x) => x.key === t)!.color;

const HAIR_COLORS: Record<string, string> = {
  black: '#16121a',
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
// Retro Bowl chibi heads (the in-game player screen is the reference): the head is about a third of the sprite's
// height and the face 12 px wide × 13 tall, with room for a hairline, brows, eyes (whites + pupil), a nose with
// nostrils, cheek and jaw shading, a mouth (lips, teeth) and a chin, plus ears and solid pixel facial hair.


/** Bare head, face out (14 wide). Rows 0–2 are for hair; forehead from row 3; chin row 14. */
export const HEAD_BARE = [
  '..............',
  '..............',
  '..............',
  '..ssssssssss..',
  '.ssssssssssss.',
  '.ssusssssusss.',
  '.sEEsssssEEss.',
  'dswwessssewwsd',
  'dssssssssssssd',
  '.sssssnnsssss.',
  '.dssssssssssd.',
  '.ssssmmmmssss.',
  '.ssssssssssss.',
  '..dssssssssd..',
  '...dssssssd...',
  '....dddddd....',
];


/**
 * Facial hair as solid pixel shapes on a face-out head. fx = the face's left column, w its width; rows: must
 * (moustache), mouth (top lip), jaw, chin, under (below the chin), cheek (where sideburns start). Beards leave the
 * mouth open; the expression is drawn after.
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
    for (let x = L + 2; x < Rt - 1; x += 2) set(R, x, r.jaw, 'r');
    for (let x = L + 3; x < Rt - 2; x += 2) set(R, x, r.chin, 'r');
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

/** Mouth by expression, on a face-out head: x = the mouth's left column (4 wide), y = its top row. */
export const mouth = (R: Rect[], x: number, y: number, ex: PoseOut['expr']) => {
  if (ex === 'smile') R.push(...stamp(['mTTTTm', '.mmmm.'], x - 1, y));
  else if (ex === 'open') R.push(...stamp(['mmmm', 'oooo', '.oo.'], x, y));
  else if (ex === 'grimace') R.push(...stamp(['mTTTTm', 'mmmmmm'], x - 1, y));
  else if (ex === 'stern') R.push(...stamp(['mmmmmm', 'ssssss'], x - 1, y));
  else if (ex === 'exalted') R.push(...stamp(['ssss', '.oo.'], x, y));
};

/** Eyes and brows by expression / look on a face-out head: brows at row y, eyes at y + 1, eye columns ex1 / ex2. */
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

/** Bare head (helmet off) at (hx, hy): hair, face, brows / eyes / mouth by expression, facial hair, ears. */
export const bareHead = (hx: number, hy: number, { look, pose }: HeadOpts, tall: number): Rect[] => {
  const R: Rect[] = [...stamp(HEAD_BARE, hx, hy)];
  const ex = pose.expr ?? 'line';
  faceHair(R, hx + 1, 12, { must: hy + 10, mouth: hy + 11, jaw: hy + 13, chin: hy + 14, under: hy + 15, cheek: hy + 8 }, look.facial);
  mouth(R, hx + 5, hy + 11, ex);
  eyes(R, hx + 2, hx + 9, hy + 6, look, ex);
  if (look.accessories.includes('eyeblack')) R.push(...stamp(['kkk'], hx + 2, hy + 8), ...stamp(['kkk'], hx + 9, hy + 8));
  if (look.accessories.includes('earrings')) R.push([hx, hy + 9, 1, 1, 'W'], [hx + 13, hy + 9, 1, 1, 'W']);
  R.push(...bareHair(hx, hy, look, tall));
  return R;
};

/** Hair on a bare head (14 wide at hx; forehead from hy + 3), by style. */
export const bareHair = (hx: number, hy: number, look: SpriteLook, tall: number): Rect[] => {
  const s = look.hair.style;
  const R: Rect[] = [];
  if (look.accessories.includes('durag')) {
    // Durag over the crown, knotted at the back, tails trailing behind
    R.push(...stamp(['....UUUUUU....', '..UUUUUUUUUU..', '.UUUUUUUUUUUU.', '.UuUUUUUUUUUU.', '.U..........U.'], hx, hy));
    R.push(...line([hx + 1, hy + 4], [hx - 5, hy + 11], 2, 'U'), ...line([hx + 2, hy + 5], [hx - 3, hy + 14], 1, 'U'));
    return R;
  }
  const top = (rows: string[], dy = 0) => R.push(...stamp(rows, hx, hy + dy));
  const sidesDown = (to: number) => R.push([hx + 1, hy + 3, 1, to - 3, 'r'], [hx + 12, hy + 3, 1, to - 3, 'r']);
  if (s === 'bald') top(['..............', '....ssssss....', '..ssusssssss..']);
  else if (s === 'buzz') {
    top(['..............', '....rrrrrr....', '..rrrrrrrrrr..', '.r..........r.']);
  } else if (s === 'short') {
    top(['....rrrrrr....', '..rrrrRrrrrr..', '.rrrrrrrrrrrr.', '.rr........rr.']);
    sidesDown(8);
  } else if (s === 'afro') {
    top(['...rrrrrrrr...', '.rrrrrRrrrrrr.', 'rrrrrrrrrrrrrr', 'rrrrrrrrrrrrrr', 'rr..........rr', 'r............r'], -2);
    sidesDown(8);
  } else if (s === 'mohawk' || s === 'spiky') {
    top(['....r.r.r.r...', '...rrrrrrrr...', '..rrrrrrrrrr..', '.rr........rr.'], -1);
  } else if (s === 'curly') {
    top(['...rr.rr.rr...', '..rrrRrrrRrr..', '.rrrrrrrrrrrr.', '.rrr......rrr.']);
    sidesDown(7);
  } else if (s === 'twists' || s === 'freeform' || s === 'dreads' || s === 'shortlocs') {
    // High-top twists / locs standing up and back (the Retro Bowl look), sides down to the ears
    const tallTop = s === 'dreads' ? 3 : s === 'shortlocs' || s === 'freeform' ? 2 : 1;
    const rows = [
      '..r..r..r..r..',
      '.rR.rR.rR.rR..',
      '..rrrRrrrRrr..',
      '.rrrrrrrrrrrr.',
      '.rrrrrrrrrrrr.',
      '.rr........rr.',
    ];
    top(rows.slice(3 - tallTop + 0 >= 0 ? 0 : 0), -tallTop);
    // Locs leaning back (to the left) off the crown, a few hanging behind the ears
    if (s === 'dreads' || s === 'shortlocs') {
      const n = s === 'dreads' ? 4 : 3;
      for (let i = 0; i < n; i++) R.push(...line([hx + 2 + i * 2, hy - tallTop], [hx - 1 + i * 2, hy - tallTop - 2 - (i % 2)], 1, i % 2 ? 'R' : 'r'));
      R.push([hx, hy + 4, 1, (s === 'dreads' ? 7 : 5) + tall, 'r'], [hx + 13, hy + 4, 1, (s === 'dreads' ? 7 : 5) + tall, 'r']);
    }
    sidesDown(8);
  } else if (s === 'braids') {
    top(['..rRrRrRrRr...', '.rRrRrRrRrRr..', '.rrrrrrrrrrrr.', '.rr........rr.']);
    R.push([hx, hy + 3, 1, 10 + tall, 'r'], [hx + 13, hy + 3, 1, 10 + tall, 'r']);
    sidesDown(8);
  } else if (s === 'long') {
    top(['...rrrrrrrr...', '.rrrrRrrrrrrr.', 'rrrrrrrrrrrrrr', 'rrr........rrr']);
    R.push([hx, hy + 4, 2, 10 + tall, 'r'], [hx + 12, hy + 4, 2, 10 + tall, 'r'], [hx, hy + 6, 1, 6, 'R']);
  }
  if (look.accessories.includes('headband')) R.push([hx + 1, hy + 3, 12, 1, 'j']);
  return R;
};

/** Hair out of the back / bottom of a side helmet. */
export const helmetHair = (hx: number, hy: number, look: SpriteLook, tall: number): Rect[] => {
  const s = look.hair.style;
  const R: Rect[] = [];
  if (s === 'dreads' || s === 'braids' || s === 'shortlocs' || s === 'long') {
    const len = (s === 'dreads' ? 9 : s === 'shortlocs' ? 6 : s === 'long' ? 9 : 8) + tall;
    const xs = s === 'braids' ? [0, 2] : [0, 2, 4];
    xs.forEach((dx, i) => {
      R.push([hx + 1 + dx, hy + 13, s === 'braids' ? 1 : 2, len - (i % 2) * 2, 'r']);
      for (let y = hy + 14 + (i % 2); y < hy + 12 + len; y += 3) R.push([hx + 1 + dx, y, 1, 1, 'R']);
    });
  } else if (s === 'afro' || s === 'twists' || s === 'freeform' || s === 'curly') {
    R.push([hx, hy + 12, 3, 4, 'r'], [hx - 1, hy + 13, 1, 2, 'r']);
  } else if (s === 'short' || s === 'mohawk' || s === 'spiky') {
    R.push([hx + 1, hy + 13, 2, 3, 'r']);
  } else if (s === 'buzz') {
    R.push([hx + 2, hy + 14, 2, 1, 'r']);
  }
  return R;
};

