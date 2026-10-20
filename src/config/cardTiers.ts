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
 * can own every variant × finish, and they stack. Lowest (most common) to highest.
 */
export type Variant = 'number' | 'jersey' | 'topps' | 'locker' | 'sprite';

export const VARIANTS: { key: Variant; label: string; short: string }[] = [
  { key: 'number', label: 'Prizm number', short: 'Prizm' },
  { key: 'jersey', label: 'Team jersey', short: 'Jersey' },
  { key: 'topps', label: '70s Topps', short: 'Topps' },
  { key: 'locker', label: 'Locker stall', short: 'Locker' },
  { key: 'sprite', label: 'Retro Bowl sprite', short: 'Sprite' },
];
export const variantLabel = (v: Variant) => VARIANTS.find((x) => x.key === v)!.label;
export const variantShort = (v: Variant) => VARIANTS.find((x) => x.key === v)!.short;
export const variantRank = (v: Variant) => VARIANTS.findIndex((x) => x.key === v);
export const isVariant = (x: unknown): x is Variant => VARIANTS.some((v) => v.key === x);
/** Variant of every card from before variants existed (and of Legends Exchange cards). */
export const LEGACY_VARIANT: Variant = 'jersey';
