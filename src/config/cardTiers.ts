import type { Player } from '@/types/player';
import { LEGACY_TIERS, isHallOfFamer } from '@/config/stats';

/**
 * Collectible card tiers (which player). Pure, so build scripts (scripts/market_snapshot.ts) can use it;
 * src/utils/collection.ts re-exports everything here. Cards are league players only.
 *
 *   Legendary  Career Legacy ≥ LEGENDARY_MIN_LEGACY (the LEGENDARY legacy tier, getLegacyTier in config/stats.ts)
 *   Epic       every other Hall of Famer, and anyone with OVR ≥ EPIC_MIN_OVR
 *   Rare       OVR ≥ RARE_MIN_OVR
 *   Common     everyone else, or OVR unknown
 */
export type Tier = 'common' | 'rare' | 'epic' | 'legendary';

export const LEGENDARY_MIN_LEGACY = LEGACY_TIERS.find((t) => t.key === 'legendary')!.min;
export const EPIC_MIN_OVR = 90;
export const RARE_MIN_OVR = 80;

/** Lowest to highest. */
export const TIERS: { key: Tier; label: string }[] = [
  { key: 'common', label: 'Common' },
  { key: 'rare', label: 'Rare' },
  { key: 'epic', label: 'Epic' },
  { key: 'legendary', label: 'Legendary' },
];
export const tierLabel = (t: Tier) => TIERS.find((x) => x.key === t)!.label;
export const tierRank = (t: Tier) => TIERS.findIndex((x) => x.key === t);

export const tierFor = (player: Pick<Player, 'careerLegacy'>, ovr: number | null | undefined): Tier => {
  if (player.careerLegacy >= LEGENDARY_MIN_LEGACY) return 'legendary';
  if (isHallOfFamer(player) || (ovr != null && ovr >= EPIC_MIN_OVR)) return 'epic';
  if (ovr != null && ovr >= RARE_MIN_OVR) return 'rare';
  return 'common';
};

export type Finish = 'base' | 'silver' | 'gold' | 'holo';

/** Lowest to highest. */
export const FINISHES: { key: Finish; label: string }[] = [
  { key: 'base', label: 'Base' },
  { key: 'silver', label: 'Silver' },
  { key: 'gold', label: 'Gold' },
  { key: 'holo', label: 'Holo' },
];
export const finishLabel = (f: Finish) => FINISHES.find((x) => x.key === f)!.label;
export const finishRank = (f: Finish) => FINISHES.findIndex((x) => x.key === f);

/**
 * Art VARIANT (which card art): a third rarity layer on top of tier and finish. Every pull rolls one; a player
 * can own every variant × finish, and they stack. Lowest (most common) to highest. The Autograph is the rarest: it
 * took the retired Retro Bowl sprite's place and odds (owner: "aren't they just a replacement for the sprite cards
 * with many more variants and rarities?"), and each one pulled is also its own signed item with its own parallel,
 * ink and serial (CollectionState.autos, src/config/autographs.ts). Saved sprite cards still load as Locker stall cards.
 */
export type Variant = 'number' | 'jersey' | 'topps' | 'locker' | 'auto';

export const VARIANTS: { key: Variant; label: string; short: string }[] = [
  { key: 'number', label: 'Prizm number', short: 'Prizm' },
  { key: 'jersey', label: 'Team jersey', short: 'Jersey' },
  { key: 'topps', label: '70s Topps', short: 'Topps' },
  { key: 'locker', label: 'Locker stall', short: 'Locker' },
  { key: 'auto', label: 'Autograph', short: 'Auto' },
];
export const variantLabel = (v: Variant) => VARIANTS.find((x) => x.key === v)!.label;
export const variantShort = (v: Variant) => VARIANTS.find((x) => x.key === v)!.short;
export const variantRank = (v: Variant) => VARIANTS.findIndex((x) => x.key === v);
export const isVariant = (x: unknown): x is Variant => VARIANTS.some((v) => v.key === x);
/** The Autograph variant: pulled only (never claimed or crafted with shards), each one a unique signed card. */
export const AUTO_VARIANT: Variant = 'auto';
/** Variant of every card from before variants existed (and of Legends Exchange cards). */
export const LEGACY_VARIANT: Variant = 'jersey';

/**
 * Prizm colour PARALLELS (owner: "add Prizm colour parallels (e.g. Red /199, Blue /99, Green /49, Gold /10, Black
 * 1/1)"): a cheap extra chase on the most common art, so Prizm pulls aren't all alike. Every pulled Prizm card rolls one
 * (PRIZM_ODDS in src/utils/collection.ts; most stay plain) with a serial out of its run; the art takes the colour
 * (NumberArt) and the market its multiplier (PARALLEL_MULTIPLIER in src/utils/cardMarket.ts). Lowest to highest.
 */
export type PrizmParallel = 'red' | 'blue' | 'green' | 'gold' | 'black';
export const PRIZM_PARALLELS: { key: PrizmParallel; label: string; run: number; color: string }[] = [
  { key: 'red', label: 'Red', run: 199, color: '#e2363f' },
  { key: 'blue', label: 'Blue', run: 99, color: '#2f7be6' },
  { key: 'green', label: 'Green', run: 49, color: '#22b35e' },
  { key: 'gold', label: 'Gold', run: 10, color: '#f2c14a' },
  { key: 'black', label: 'Black', run: 1, color: '#16181d' },
];
/** One Prizm parallel copy: its colour and serial (1…run; a Black is always 1). */
export interface PrizmCopy {
  c: PrizmParallel;
  n: number;
}
export const isPrizmParallel = (x: unknown): x is PrizmParallel => PRIZM_PARALLELS.some((p) => p.key === x);
export const prizmInfo = (c: PrizmParallel) => PRIZM_PARALLELS.find((p) => p.key === c)!;
export const prizmRank = (c: PrizmParallel) => PRIZM_PARALLELS.findIndex((p) => p.key === c);
/** "27/99", "1/1" */
export const prizmSerial = (p: PrizmCopy) => `${p.n}/${prizmInfo(p.c).run}`;
/** "PRIZM RED /199", "PRIZM BLACK 1/1" (the reveal stamp) */
export const prizmStamp = (c: PrizmParallel) => {
  const i = prizmInfo(c);
  return `PRIZM ${i.label.toUpperCase()} ${i.run === 1 ? '1/1' : `/${i.run}`}`;
};
