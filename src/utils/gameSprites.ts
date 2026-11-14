import { useSyncExternalStore } from 'react';
import type * as SpriteArt from './gameSpriteArt';
import { findNFLTeam } from './nflTeams';

/**
 * Retro Bowl's own player sprites (New Star Games' art; the NFL edition's NFL and NFLPA marks), PRIVATE: they exist
 * only on the owner's Mac in public/private-sprites/ (git-ignored). The GitHub Pages build never has that folder, so
 * `__PRIVATE_SPRITES__` (vite.config.ts) is false there and nothing is ever fetched: the public site looks exactly as
 * it would without this module. Two sources, in order:
 *   1. nfl/: the owner's own NFL Retro Bowl players from his save (scripts/pull_save.py, then
 *      scripts/private_nfl_sprites.py), 64 x 64 full-body sprites already drawn in real kits, several poses.
 *   2. the regular game's sheets (scripts/private_sprites.py): portraits, on-field poses and the helmet in placeholder
 *      key colours, recoloured into the club's kit (gameSpriteArt.ts), for players the save doesn't have.
 *
 * This file holds no art: only the key colours the game paints its placeholders in, and the rules mapping them.
 */

export type BodyPose = 'stand' | 'run' | 'celebrate' | 'jump' | 'dive' | 'stiffarm' | 'qb_throw';

export interface SpriteIndex {
  faces: { file: string; w: number; h: number; sheets: string[]; perSheet: number; keys: { shirt: string; trim: string; stripe?: string } };
  bodies: {
    file: string;
    cell: [number, number];
    poses: Record<string, { row: number; frames: number }>;
    keys: { helmet: string[]; jersey: string[]; pants: string[]; socks: string[]; skin: string[] };
  };
  helmet: { file: string; w: number; h: number; frames: number; keys: { shell: string; stripe: string; stripe2: string } };
}

/** The recoloured regular-game sheets (scripts/private_sprites.py): the fallback for players the save doesn't have. */
export interface RegularSprites {
  index: SpriteIndex;
  /** The recolouring code (gameSpriteArt.ts), loaded only once the sheets exist, so the public bundle never runs it */
  art: typeof SpriteArt;
  faces: HTMLImageElement;
  bodies: HTMLImageElement;
  helmet: HTMLImageElement;
  /** Skin locks from data/sprites.json (public data; the site's own looks), for the face pick */
  skins: Record<string, { skin?: unknown; build?: unknown; height?: unknown }>;
}

/** One player's sprites from the owner's NFL Retro Bowl save (scripts/private_nfl_sprites.py). */
export interface NflSpriteEntry {
  uid: string;
  /** Club name (as the site uses it) → poses drawn in that club's kit (1 = the standing pose) */
  kits: Record<string, number[]>;
  /** Poses in the neutral white kit (800) */
  neutral: number[];
}
export interface NflSprites {
  size: [number, number];
  clubs: Record<string, number>;
  players: Record<string, NflSpriteEntry>;
  /** Real NFL legends (public/data/legends.json keys), for the arcade games only */
  legends?: Record<string, NflSpriteEntry>;
  /** The game's generated look templates (skin 0 dark, 1 mix, 2 light), worn by league players the save doesn't have */
  standins?: { uid: string; skin: number; neutral: number[] }[];
  /** file → [centre x of his legs, last row of his feet] in the 64 x 64 frame (scripts/private_nfl_sprites.py) */
  anchors?: Record<string, [number, number]>;
}

/**
 * Everything private this machine has. `nfl`: the owner's own NFL Retro Bowl players, already drawn in real kits
 * (primary). `regular`: the regular game's sheets, recoloured to a club's kit (fallback). Either may be null.
 */
export interface GameSprites {
  nfl: NflSprites | null;
  regular: RegularSprites | null;
  /** The site's locked looks (public data/sprites.json): skin, and height / build for the body (config/bodyTypes.ts) */
  looks?: Record<string, { skin?: unknown; build?: unknown; height?: unknown }> | null;
}

/** Build-time: true only when public/private-sprites/ exists on the machine that builds (never CI). */
const ENABLED = typeof __PRIVATE_SPRITES__ !== 'undefined' && __PRIVATE_SPRITES__;
export const PRIVATE_BASE = `${import.meta.env.BASE_URL}private-sprites/`;

// ---------- Loading (once, silent) ----------

let sprites: GameSprites | null = null;
let started = false;
const listeners = new Set<() => void>();
const publish = (part: Partial<GameSprites>) => {
  sprites = { nfl: null, regular: null, looks: null, ...sprites, ...part };
  listeners.forEach((l) => l());
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('sprite sheet'));
    img.src = src;
  });

/** JSON from the private folder, or null: a 404, or the dev server's SPA fallback (HTML) when the folder is gone. */
const privateJson = (path: string): Promise<unknown> =>
  fetch(PRIVATE_BASE + path, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.text() : null))
    .then((text) => {
      if (!text) return null;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    })
    .catch(() => null);

const validIndex = (d: unknown): d is SpriteIndex => {
  const x = d as SpriteIndex | null;
  return !!x && typeof x === 'object' && !!x.faces?.file && !!x.bodies?.file && !!x.helmet?.file && Array.isArray(x.faces.sheets);
};
const validNfl = (d: unknown): d is NflSprites => {
  const x = d as NflSprites | null;
  return !!x && typeof x === 'object' && !!x.players && typeof x.players === 'object';
};

let looksJob: Promise<RegularSprites['skins']> | null = null;
/** The site's own locked looks (public data/sprites.json), fetched once. */
const siteLooks = () =>
  (looksJob ??= fetch(`${import.meta.env.BASE_URL}data/sprites.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((d: unknown) => (d && typeof d === 'object' ? (d as RegularSprites['skins']) : {})));

/** Fetches both indexes (and the regular sheets) once. Any failure = that source is absent; nothing is logged. */
export const loadGameSprites = (): void => {
  if (started || !ENABLED || typeof window === 'undefined') return;
  started = true;
  // the NFL index with the site's locked looks, together, so a locked body (Sherman Brandson) never draws twice
  Promise.all([privateJson('nfl/index.json'), siteLooks()]).then(([nfl, looks]) => {
    if (validNfl(nfl)) publish({ nfl, looks });
  });
  privateJson('index.json')
    .then(async (index) => {
      if (!validIndex(index)) return;
      const [faces, bodies, helmet] = await Promise.all([index.faces.file, index.bodies.file, index.helmet.file].map((f) => loadImage(PRIVATE_BASE + f)));
      const art = await import('./gameSpriteArt');
      const skins = await siteLooks();
      publish({ regular: { index, art, faces, bodies, helmet, skins } });
    })
    .catch(() => {
      /* no regular sheets: callers fall back silently */
    });
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  loadGameSprites();
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => sprites;

/** The private sprites this machine has, or null (none here, or still loading). Callers choose a fallback. */
export const useGameSprites = (): GameSprites | null => useSyncExternalStore(subscribe, snapshot, () => null);

/**
 * Stature from the site's locked looks (data/sprites.json): a look marked build "huge" and height "tall" (Sherman
 * Brandson; owner: "he's supposed to be huge compared to everyone else but don't overdo it, just the sprite in the
 * banner") stands a step larger in the player banner (ProPlayerBanner.css turns it into whole pixels). 1 for everyone else.
 */
export const statureScale = (sprites: GameSprites | null, name: string): number => {
  const look = sprites?.looks?.[name] ?? sprites?.regular?.skins?.[name];
  return look && look.build === 'huge' && look.height === 'tall' ? 1.25 : 1;
};

// ---------- The owner's NFL save sprites (primary) ----------

/**
 * What a sprite is doing. Poses carry meaning and never cycle at random: idle (standing), celebrate (a correct answer,
 * a Hall of Fame induction, a title), run (loading states and transitions), stiffarm (a record falling).
 */
export type SpriteAction = 'idle' | 'celebrate' | 'run' | 'stiffarm';
/**
 * The save's five poses, as the files draw them (checked frame by frame, 2026-11-13): 1 standing, 2 ball at his side,
 * 3 arm raised high with the ball at his side, 4 ball tucked under the arm, 5 spinning the ball on one hand.
 */
export const NFL_POSE: Record<SpriteAction, number> = { idle: 1, celebrate: 3, run: 4, stiffarm: 4 };
/** The regular game's on-field poses for the same actions (animated unless reduced motion). */
export const REGULAR_POSE: Record<SpriteAction, BodyPose> = { idle: 'stand', celebrate: 'celebrate', run: 'run', stiffarm: 'stiffarm' };

export interface NflPick {
  /** The file to draw (a club kit as the save drew it, or the neutral white kit) */
  src: string;
  /** Club name of the kit drawn, or 'neutral' */
  kit: string;
  /** Club to paint the neutral kit into (gameKitPaint.ts); unset = draw src as is */
  paint?: string;
  pose: number;
  /** The figure's centre line and feet row in the 64 x 64 frame (index anchors; the body template's 31.5, 58) */
  cx: number;
  foot: number;
}

const nflFile = (uid: string, kit: number, pose: number) => `${PRIVATE_BASE}nfl/${uid}_${String(kit).padStart(3, '0')}${pose > 1 ? `_p${pose}` : ''}.png`;

/**
 * A player's NFL save sprite in his club's kit, in this order: the kit the save drew for that club (in the wanted
 * pose), the neutral white kit painted into the club's colours (gameKitPaint.ts), the club kit in another pose; null
 * when the save doesn't have him (the regular recolour is next, then nothing). `club` is his banner club, `current`
 * his current club (used only when he has no banner club). With no club at all he wears the neutral kit unpainted.
 * `legend`: a real NFL legend (index.legends), for the arcade games only.
 */
const withAnchor = (nfl: NflSprites, pick: Omit<NflPick, 'cx' | 'foot'> | null): NflPick | null => {
  if (!pick) return null;
  const a = nfl.anchors?.[pick.src.slice(pick.src.lastIndexOf('/') + 1)];
  return { ...pick, cx: a?.[0] ?? 31.5, foot: a?.[1] ?? 58 };
};

export const nflSpriteFor = (
  nfl: NflSprites | null,
  key: string,
  club: string | undefined,
  current: string | undefined,
  action: SpriteAction = 'idle',
  legend = false,
  tone?: string,
  role = 1,
): NflPick | null => (nfl ? withAnchor(nfl, pickNfl(nfl, key, club, current, action, legend, tone, role)) : null);

const STANDIN_SKINS: Record<string, number[]> = { pale: [2], light: [2], tan: [2, 1], medium: [1, 0], brown: [0], deep: [0] };

/**
 * A league player the save doesn't have wears one of the game's own look templates (index standins), a stable pick
 * seeded by his key within the templates matching his skin where the site knows it (sprites.json, the player editor),
 * so every player on the site is drawn in the same style; the kit is painted like any neutral sprite.
 */
const standinFor = (nfl: NflSprites, key: string, tone?: string): NflSpriteEntry | null => {
  const all = nfl.standins ?? [];
  const groups = tone ? STANDIN_SKINS[tone] : undefined;
  const pool = groups ? all.filter((x) => groups.includes(x.skin)) : all;
  const list = pool.length ? pool : all;
  if (!list.length) return null;
  const x = list[fnv(`${key}|standin`) % list.length];
  return { uid: x.uid, kits: {}, neutral: x.neutral };
};

const pickNfl = (
  nfl: NflSprites,
  key: string,
  club: string | undefined,
  current: string | undefined,
  action: SpriteAction,
  legend: boolean,
  tone?: string,
  role = 1,
): Omit<NflPick, 'cx' | 'foot'> | null => {
  const e = legend ? nfl.legends?.[key] : nfl.players[key] ?? standinFor(nfl, key, tone);
  if (!e) return null;
  const want = NFL_POSE[action];
  const target = club || current;
  const id = target ? findNFLTeam(target)?.id : undefined;
  const kitName = target ? Object.keys(e.kits).find((k) => k.toLowerCase() === target.toLowerCase() || (!!id && findNFLTeam(k)?.id === id)) : undefined;
  const kitUid = kitName !== undefined ? nfl.clubs[kitName] : undefined;
  const poses = kitName ? e.kits[kitName] : [];
  const team = id ? findNFLTeam(target)!.name : undefined;
  // playstyle (config/bodyTypes.ts rolePose): standing idle, he holds his role's pose, in his club's kit as the save
  // drew it or the neutral kit painted; explicit actions never come here
  if (action === 'idle' && role !== want) {
    if (kitName && kitUid !== undefined && poses.includes(role)) return { src: nflFile(e.uid, kitUid, role), kit: kitName, pose: role };
    if (team && e.neutral.includes(role)) return { src: nflFile(e.uid, 800, role), kit: team, paint: team, pose: role };
  }
  if (kitName && kitUid !== undefined && poses.includes(want)) return { src: nflFile(e.uid, kitUid, want), kit: kitName, pose: want };
  const neutralPose = e.neutral.includes(want) ? want : e.neutral[0];
  if (team && neutralPose !== undefined) return { src: nflFile(e.uid, 800, neutralPose), kit: team, paint: team, pose: neutralPose };
  if (kitName && kitUid !== undefined && poses.length) {
    const pose = poses.includes(1) ? 1 : poses[0];
    return { src: nflFile(e.uid, kitUid, pose), kit: kitName, pose };
  }
  if (neutralPose !== undefined) return { src: nflFile(e.uid, 800, neutralPose), kit: 'neutral', pose: neutralPose };
  return null;
};

// ---------- Which face ----------

/**
 * The game's own face fields, as a save record stores them: skin 0 dark (sheet spr_dark_00<face_y+1>, face_y 0-7),
 * 1 mix (spr_mix_001, face_y 0), 2 light (spr_light_00<face_y+1>, face_y 0-2); face_x 0-7 is the frame in that sheet.
 */
export interface GameFace {
  skin: 0 | 1 | 2;
  faceY: number;
  faceX: number;
}

export interface FaceSubject {
  name: string;
  position?: string;
  /** Skin tone from the player editor (types/player.ts) */
  spriteSkin?: string;
  /** Exact face from a save import (future); out-of-range values fall back to the seeded pick */
  gameFace?: Partial<GameFace> | null;
}

const FACE_Y_COUNT: Record<0 | 1 | 2, number> = { 0: 8, 1: 1, 2: 3 };

const validFace = (f: Partial<GameFace> | null | undefined): f is GameFace =>
  !!f &&
  (f.skin === 0 || f.skin === 1 || f.skin === 2) &&
  Number.isInteger(f.faceY) &&
  Number.isInteger(f.faceX) &&
  f.faceY! >= 0 &&
  f.faceY! < FACE_Y_COUNT[f.skin] &&
  f.faceX! >= 0 &&
  f.faceX! <= 7; // face_x 8 is a special case in the game's code: no exact face

/** Row of faces.png for a game face: dark 1-8 are rows 0-7, light 1-3 rows 8-10, mix 1 row 11. */
export const faceRow = (f: GameFace) => (f.skin === 0 ? f.faceY : f.skin === 2 ? 8 + f.faceY : 11);

// The site's six skin tones → the game's sheets (dark sheets 5-7 are the lighter browns).
type SkinTone = 'pale' | 'light' | 'tan' | 'medium' | 'brown' | 'deep'; // the site's tones (sprite/faces.ts)
const isSkinTone = (x: unknown): x is SkinTone => typeof x === 'string' && Object.prototype.hasOwnProperty.call(SHEETS_FOR_TONE, x);
const SHEETS_FOR_TONE: Record<SkinTone, Array<[0 | 1 | 2, number]>> = {
  pale: [[2, 0], [2, 1], [2, 2]],
  light: [[2, 0], [2, 1], [2, 2]],
  tan: [[2, 0], [2, 1], [2, 2], [1, 0]],
  medium: [[1, 0], [0, 4], [0, 5], [0, 6]],
  brown: [0, 1, 2, 3, 4, 5, 6, 7].map((y): [0, number] => [0, y]),
  deep: [0, 1, 2, 3, 7].map((y): [0, number] => [0, y]),
};
const ALL_SHEETS: Array<[0 | 1 | 2, number]> = [...SHEETS_FOR_TONE.brown, [1, 0], ...SHEETS_FOR_TONE.pale];

const fnv = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * The face a player wears: his exact game face when a save import gives one, else a stable pick seeded by his key
 * (position:name; never Math.random, never the edition seed) within the sheets matching his skin where the site knows
 * it (sprites.json skin lock, then the player editor's toggle), else any of the 96. Both paths give a GameFace.
 */
export const faceFor = (player: FaceSubject, skinLocks?: Record<string, { skin?: unknown }> | null): GameFace & { exact: boolean } => {
  if (validFace(player.gameFace)) return { ...player.gameFace, exact: true };
  const locked = skinLocks?.[player.name]?.skin;
  const tone = isSkinTone(locked) ? locked : isSkinTone(player.spriteSkin) ? player.spriteSkin : null;
  const pool = tone ? SHEETS_FOR_TONE[tone] : ALL_SHEETS;
  const h = fnv(`${player.position ?? ''}:${player.name}|gameface`);
  const [skin, faceY] = pool[h % pool.length];
  return { skin, faceY, faceX: (h >>> 8) % 8, exact: false };
};

/** A sensible on-field pose for a position (the banner and roster figures). */
export const poseForPosition = (position: string | undefined): BodyPose => {
  switch (position) {
    case 'QB':
      return 'qb_throw';
    case 'RB':
      return 'stiffarm';
    case 'WR':
    case 'TE':
      return 'run';
    case 'DB':
    case 'LB':
    case 'DL':
      return 'run';
    default:
      return 'stand';
  }
};
