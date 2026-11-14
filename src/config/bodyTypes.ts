/**
 * Body types for the private game sprites (owner: "it would be cool if we created a per position randomizer with
 * chances on how big they are and playstyle, ie I know OL are huge and RBs are kinda small so randomize with small
 * chances that we have a tall RB etc etc").
 *
 * Every player rolls two things once, seeded by his key "POS:Name" (FNV-1a; never Math.random, never the edition seed,
 * so a player looks the same everywhere and forever):
 *
 *   height  short | normal | tall     build  lean | normal | broad
 *
 * from his position's odds below (percent; each row sums to 100). The rarer columns are the outliers: a tall RB, a
 * lean lineman, a broad DB. Then a second roll picks how far (`HEIGHT_ROWS`): short = 1 or 2 rows fewer, tall = 1 or 2
 * more; build is one pixel column a side (lean narrower, broad wider).
 *
 * A locked look in data/sprites.json that sets height or build (Sherman Brandson, Jason Macleone) is NOT rolled: he
 * is drawn exactly as the game draws him, his own face, body and proportions (owner on Sherman: "sherm looks nothing
 * like his avatar now … just scale him a bit as before"). Sherman's size comes only from his banner stature
 * (gameSprites.ts statureScale: a uniform whole-pixel scale from his feet in the player banner).
 *
 * The rows and columns are applied pixel for pixel by the kit painter (src/utils/gameKitPaint.ts `reshape`), never by
 * scaling. This file holds no art.
 *
 *   pos   short normal tall  |  lean normal broad   what it means
 *   OL      4    24    72    |    5    20    75     huge: tall and broad, a lean one now and then
 *   DL      5    30    65    |    6    26    68     big, a shade less than the line across from them
 *   TE      5    32    63    |    6    38    56     tall and broad
 *   QB      7    35    58    |   12    76    12     tall, normal build
 *   LB      8    50    42    |    6    36    58     normal to tall, broad
 *   WR      6    34    60    |   60    34     6     tall and lean
 *   DB     12    78    10    |   55    40     5     normal height, lean
 *   RB     64    30     6    |    7    45    48     short and stocky; a tall back is the outlier
 *   other  15    70    15    |   15    70    15
 */

export type HeightClass = 'short' | 'normal' | 'tall';
export type BuildClass = 'lean' | 'normal' | 'broad';

/** Odds in percent: [short, normal, tall] and [lean, normal, broad]. */
export const BODY_ODDS: Record<string, { height: [number, number, number]; build: [number, number, number] }> = {
  OL: { height: [4, 24, 72], build: [5, 20, 75] },
  DL: { height: [5, 30, 65], build: [6, 26, 68] },
  TE: { height: [5, 32, 63], build: [6, 38, 56] },
  QB: { height: [7, 35, 58], build: [12, 76, 12] },
  LB: { height: [8, 50, 42], build: [6, 36, 58] },
  WR: { height: [6, 34, 60], build: [60, 34, 6] },
  DB: { height: [12, 78, 10], build: [55, 40, 5] },
  RB: { height: [64, 30, 6], build: [7, 45, 48] },
};
const DEFAULT_ODDS = { height: [15, 70, 15] as [number, number, number], build: [15, 70, 15] as [number, number, number] };

/** Rows a height class adds (+) or removes (-): the first value 55% of the time, else the second. */
export const HEIGHT_ROWS: Record<HeightClass, [number, number]> = { short: [-1, -2], normal: [0, 0], tall: [1, 2] };
/** Columns a side a build class adds (+) or removes (-). */
export const BUILD_COLS: Record<BuildClass, number> = { lean: -1, normal: 0, broad: 1 };

export interface BodyRoll {
  height: HeightClass;
  build: BuildClass;
  /** Rows added (+) or removed (-) in the legs and torso; feet stay on the baseline */
  rows: number;
  /** Pixel columns added (+) or removed (-) on each side of the centre line below the head */
  cols: number;
  /** A locked look (sprites.json height / build): drawn as the game has him, never reshaped */
  locked: boolean;
}

/** A sprites.json look's size fields (height normal|tall, build normal|big|huge). */
export interface BodyLook {
  height?: unknown;
  build?: unknown;
}

const fnv = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const pick = <T,>(classes: [T, T, T], odds: [number, number, number], roll: number): T => {
  const r = roll % 100;
  return r < odds[0] ? classes[0] : r < odds[0] + odds[1] ? classes[1] : classes[2];
};

const cache = new Map<string, BodyRoll>();

/**
 * Owner-set bodies (keyed "POS:Name"), which win over the roll. Ryland Maxwell (owner, 2026-11-13: "make maxwell a bit
 * bigger"): tall and broad instead of his rolled short build, a row taller and a column a side wider, face untouched.
 */
export const OWNER_BODIES: Record<string, { height: HeightClass; build: BuildClass; rows: number }> = {
  'RB:Ryland Maxwell': { height: 'tall', build: 'broad', rows: 1 },
};

/** A player's body: the stable roll for his position; a locked look that sets height or build keeps the game's body. */
export const bodyFor = (key: string, look?: BodyLook | null): BodyRoll => {
  const ck = `${key}|${String(look?.height ?? '')}|${String(look?.build ?? '')}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const own = OWNER_BODIES[key];
  if (own) {
    const out: BodyRoll = { height: own.height, build: own.build, rows: own.rows, cols: BUILD_COLS[own.build], locked: false };
    cache.set(ck, out);
    return out;
  }
  const pos = key.slice(0, key.indexOf(':'));
  const odds = BODY_ODDS[pos] ?? DEFAULT_ODDS;
  if (look?.height !== undefined || look?.build !== undefined) {
    const out: BodyRoll = { height: 'normal', build: 'normal', rows: 0, cols: 0, locked: true };
    cache.set(ck, out);
    return out;
  }
  const height = pick<HeightClass>(['short', 'normal', 'tall'], odds.height, fnv(`${key}|height`));
  const build = pick<BuildClass>(['lean', 'normal', 'broad'], odds.build, fnv(`${key}|build`));
  const rows = HEIGHT_ROWS[height][fnv(`${key}|stretch`) % 100 < 55 ? 0 : 1];
  const out: BodyRoll = { height, build, rows, cols: BUILD_COLS[build], locked: false };
  cache.set(ck, out);
  return out;
};

/** The body as a short stable string (cache keys), '' for the unchanged template. */
export const bodyKey = (b: BodyRoll) => (b.rows || b.cols ? `${b.rows},${b.cols}` : '');

/**
 * Playstyle: the save pose a player stands in when a page asks for nothing in particular (action idle). The save has
 * five poses (1 standing, 2 ball at his side, 3 waving with the ball, 4 ball tucked, 5 spinning the ball) and no
 * lineman's stance, so linemen and defenders stand; ball carriers tuck it; quarterbacks hold it at the side.
 * Explicit actions (celebrate, run, stiff arm) always win.
 */
export const ROLE_POSE: Record<string, number> = { QB: 2, RB: 4, WR: 4, TE: 4 };
export const rolePose = (position: string | undefined): number => (position && ROLE_POSE[position]) || 1;
