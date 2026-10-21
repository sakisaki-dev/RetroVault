import { useLeagueContent, type Edition } from './leagueContent';

/**
 * Edition rotation: the "fresh look" after every update, with no AI and no randomness.
 *
 * scripts/build_league_content.py writes `edition` into content.json: the number of applied uploads, the last
 * upload's id and the season, hashed into `seed`. The seed changes on every `npm run update` and never between two
 * rebuilds of the same data, so every viewer sees the same picks until the next update.
 *
 * Use it ONLY for presentation choices that may rotate: featured / spotlight players, hero picks, the order of
 * headlines and featured storylines, the pack shelf accent. Never for player identity (sprite looks, owned card art,
 * poses, uniforms): those must stay stable across updates.
 */

/** FNV-1a 32-bit (same as the build script), for mixing a salt into the seed. */
export const fnv1a = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

/** Small deterministic PRNG (mulberry32). */
const mulberry32 = (a: number) => () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A seed for one rotating slot: the edition seed mixed with the slot's name, so slots don't move in lockstep. */
export const slotSeed = (edition: Edition | number | undefined | null, slot: string) =>
  (fnv1a(slot) ^ (typeof edition === 'number' ? edition : (edition?.seed ?? 0))) >>> 0;

/** Deterministic shuffle of a copy of `items` for this edition and slot (Fisher–Yates). */
export const editionShuffle = <T>(items: readonly T[], edition: Edition | number | undefined | null, slot: string): T[] => {
  const out = [...items];
  const rand = mulberry32(slotSeed(edition, slot));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Rotate `items` by an edition-dependent offset: keeps their order (e.g. a ranking) but changes who leads. */
export const editionRotate = <T>(items: readonly T[], edition: Edition | number | undefined | null, slot: string): T[] => {
  if (!items.length) return [];
  const k = slotSeed(edition, slot) % items.length;
  return [...items.slice(k), ...items.slice(0, k)];
};

/** One item for this edition and slot (undefined for an empty list). */
export const editionPick = <T>(items: readonly T[], edition: Edition | number | undefined | null, slot: string): T | undefined =>
  items.length ? items[slotSeed(edition, slot) % items.length] : undefined;

/** The current edition from content.json (undefined while loading or when the file has none). */
export const useEdition = (): Edition | undefined => useLeagueContent().content?.edition;

/**
 * Edition accents: a small, tasteful palette (HSL triplets) for presentation tints such as the Collection pack shelf.
 * Low-saturation enough to sit behind the pack foils, so tier colours stay readable. One per edition.
 */
export const EDITION_ACCENTS = [
  { name: 'Violet', hsl: '280 70% 58%' },
  { name: 'Teal', hsl: '174 62% 44%' },
  { name: 'Crimson', hsl: '352 72% 56%' },
  { name: 'Royal', hsl: '224 76% 62%' },
  { name: 'Emerald', hsl: '150 58% 44%' },
  { name: 'Amber', hsl: '32 90% 56%' },
  { name: 'Rose', hsl: '330 66% 62%' },
  { name: 'Sky', hsl: '199 80% 56%' },
] as const;
export type EditionAccent = (typeof EDITION_ACCENTS)[number];

/** This edition's accent (Violet, the original hero tint, while content loads). */
export const editionAccent = (edition: Edition | undefined | null): EditionAccent =>
  edition ? editionPick(EDITION_ACCENTS, edition, 'accent')! : EDITION_ACCENTS[0];
