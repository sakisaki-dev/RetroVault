import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { Player } from '@/types/player';
import { playerKey } from '@/config/ovr';
import { FINISHES, LEGACY_VARIANT, PRIZM_PARALLELS, TIERS, VARIANTS, finishRank, isPrizmParallel, isVariant, prizmInfo, tierRank, type Finish, type PrizmCopy, type PrizmParallel, type Tier, type Variant } from '@/config/cardTiers';
import { parseRoll, parseSnapshot, rollAutograph, type AutographRoll, type AutographSnapshot } from '@/config/autographs';

export * from '@/config/cardTiers';

/**
 * Player card collection, v2: reward packs.
 *
 * A card is a league player plus a FINISH (Base, Silver, Gold, Holo). Real NFL legends are not collectible (they
 * stay in the games only); legend cards in older saves are swapped for league cards in a one-time Legends
 * Exchange pack (exchangeLegends). Games never hand out a specific card: they award reward PACKS through
 * awardPack(), and every card comes from opening one on the Collection tab. A pull is two rolls: which player
 * (weighted by the player's TIER, src/config/cardTiers.ts, so better players are rarer), then which finish (Holo
 * rarest, and rarer still for top tiers), then which art VARIANT (Prizm number most common, the Autograph
 * rarest; PackSpec.variants). A player can own every variant, each at its own best finish, so they stack:
 * OwnedCard.variants holds one entry per variant owned, and OwnedCard.best / counts / first / last summarise them.
 * Saves from before variants are migrated on load: every owned card becomes the Team jersey variant.
 * Shards (every pack opened, more from duplicates of the same player, variant, finish and kit) are the deliberate path:
 * claim a chosen player's Base card (claimCard; a "Legend claim" for a Legendary), then craft it up a finish at a time
 * (craftUpgrade; costs scale by tier and art variant). The owner can pin which variant × finish a player's card
 * displays (setDisplay / displayOf; CollectionState.display), else it shows the rarest variant at its best finish.
 * The Autograph is the fifth and rarest art variant, at the retired Retro Bowl sprite's old odds. A pull that rolls it
 * also rolls its autograph (parallel, pen and ink, inscription, serial, throwback; src/config/autographs.ts), stored as
 * its own item in CollectionState.autos with a snapshot of the player frozen at the pull, while variants.auto counts
 * the finish like any other variant. Autographs are pulled only: never claimed or crafted with shards.
 * Every other pull also rolls its KIT (home, a modern alternate or the club's era kit; KIT_ODDS), and each variant ×
 * finish remembers the kits owned (VariantCard.kits): a pull in a kit not owned yet is a "New kit", not a duplicate.
 * Every Prizm number pull also rolls its colour PARALLEL (plain most of the time, else Red /199 … Black 1/1 with a
 * serial; PRIZM_ODDS), and each Prizm finish remembers every parallel copy owned (VariantCard.prizm): a colour not owned
 * yet in that finish is a "New parallel", not a duplicate.
 *
 * State is per browser, in localStorage under STORAGE_KEY; every write fires CHANGE_EVENT so open
 * views update live. v1 (STORAGE_KEY_V1, one fixed rarity per player, cards granted directly by
 * game events) is discarded on first load and the Collection tab shows a one-time notice.
 */

export const STORAGE_KEY = 'retroVault:collection:v2';
export const STORAGE_KEY_V1 = 'retroVault:collection';
/** window CustomEvent fired after every write; detail is a CollectionChange. */
export const CHANGE_EVENT = 'retroVault:collection';

// ---------- Packs and odds ----------

export type PackType = 'standard' | 'premium' | 'elite' | 'perfect' | 'holo' | 'exchange';
/**
 * Kit odds per card, by pack (owner: "considering throwbacks and diff eras are in it would be nice to be a small but
 * substantial chase"). Every pulled card but the Autograph rolls once: `era` is the chance of the club's famous era
 * kit (a throwback, art/sprite/uniforms.ts ERAS), `alt` of one of its modern alternates (picked evenly), the rest home.
 * A club without an era kit or without alternates gives that share to home, so no card rolls a kit its club lacks.
 * Rolled after the variant (rollKit); the market prices the kit worn (ALT_VALUE_BONUS / ERA_VALUE_BONUS).
 */
export const KIT_ODDS: Record<'standard' | 'premium' | 'elite' | 'perfect' | 'holo' | 'exchange', { alt: number; era: number }> = {
  standard: { alt: 0.08, era: 0.025 },
  premium: { alt: 0.09, era: 0.03 },
  elite: { alt: 0.1, era: 0.035 },
  perfect: { alt: 0.12, era: 0.045 },
  holo: { alt: 0.12, era: 0.045 },
  exchange: { alt: 0.1, era: 0.04 },
};

/**
 * Prizm colour parallel odds per Prizm number card, by pack (owner: "add Prizm colour parallels (e.g. Red /199, Blue
 * /99, Green /49, Gold /10, Black 1/1)"). Every pulled Prizm card rolls once after its kit (rollPrizm): each colour has
 * its own chance, rarer than the one before, and the rest stay plain Prizm. A parallel lands on about 1 Prizm in 7 from
 * Standard packs and 1 in 5.4 from Holo Showcase / Perfect Season; a Black 1/1 on about 1 in 5,000 Prizm cards
 * (Standard) to 1 in 2,500 (the chase packs). A parallel carries a serial out of its run (1…199, a Black always 1/1),
 * stored with the card (VariantCard.prizm); the market prices it by PARALLEL_MULTIPLIER (src/utils/cardMarket.ts).
 * scripts/simulate_packs.ts prints the odds per pack.
 */
export const PRIZM_ODDS: Record<'standard' | 'premium' | 'elite' | 'perfect' | 'holo' | 'exchange', Record<PrizmParallel, number>> = {
  standard: { red: 0.08, blue: 0.04, green: 0.018, gold: 0.0045, black: 0.0002 },
  premium: { red: 0.085, blue: 0.045, green: 0.021, gold: 0.0055, black: 0.00025 },
  elite: { red: 0.09, blue: 0.05, green: 0.024, gold: 0.0065, black: 0.0003 },
  perfect: { red: 0.095, blue: 0.055, green: 0.027, gold: 0.008, black: 0.0004 },
  holo: { red: 0.095, blue: 0.055, green: 0.027, gold: 0.008, black: 0.0004 },
  exchange: { red: 0.09, blue: 0.05, green: 0.024, gold: 0.0065, black: 0.0003 },
};
/** Chance a Prizm number card from this pack is any parallel. */
export const prizmAnyChance = (type: PackType) => PRIZM_PARALLELS.reduce((a, p) => a + PRIZM_ODDS[type][p.key], 0);

/** Packs games and gifts can award. The Legends Exchange pack is only ever created by exchangeLegends. */
export type EarnablePack = Exclude<PackType, 'exchange'>;
/** Packs stored as a plain count (Perfect Season and Legends Exchange packs are stored one by one). */
export type CountedPack = Exclude<PackType, 'perfect' | 'exchange'>;

type Weights<K extends string> = Record<K, number>;
type FinishTable = Record<Tier, Weights<Finish>>;

export interface PackSpec {
  label: string;
  size: number;
  /** Relative odds of each player tier per regular slot */
  tiers: Weights<Tier>;
  /** Relative odds of each finish per regular slot, by the tier that slot rolled */
  finishes: FinishTable;
  /** Base odds of each art variant (rolled last; VARIANT_STACK then makes the rarer arts rarer still on better cards) */
  variants: Weights<Variant>;
  /** One-line summary of the guarantees, shown on the odds table */
  guarantee: string;
}

/**
 * Base variant odds (what a Common Base card rolls; relative weights, normalized per roll): Prizm most common, then
 * Jersey, Topps, Locker, the Autograph rarest. Standard is the baseline (Autograph 3.5%); better packs lean rarer, never
 * above 2× it. The Autograph has exactly the retired Retro Bowl sprite's odds and stacking (owner: "keep the sprites
 * old odds with the diff rarities within the autographs having their own rarities").
 */
const VARIANT_ODDS = {
  standard: { number: 44, jersey: 29, topps: 15, locker: 8.5, auto: 3.5 },
  premium: { number: 40, jersey: 29, topps: 17, locker: 10, auto: 4 },
  elite: { number: 36, jersey: 28, topps: 19, locker: 12, auto: 5 },
  chase: { number: 32, jersey: 28, topps: 20, locker: 13.5, auto: 6.5 },
} satisfies Record<string, Weights<Variant>>;

/**
 * Rarity layers stack: the rarer arts get rarer still on better players and finishes. A variant's base weight is
 * multiplied by its factor for the card's tier and for its finish (Prizm and Jersey stay ×1, so they soak up the
 * rest), then by any VARIANT_COMBO penalty that matches the exact card. The Autograph's per-axis factors are gentle,
 * so an Autograph Holo (Common to Epic) is a rare thrill rather than impossible; the combo penalty is what keeps
 * Autograph × Holo × Legendary near-unattainable (scripts/simulate_packs.ts prints its odds). The market prices it the
 * same way (value × finish × variant, src/utils/cardMarket.ts; an autograph by its own multiplier), so rarer layers
 * stay worth more.
 */
export const VARIANT_STACK: Partial<Record<Variant, { tier: Weights<Tier>; finish: Weights<Finish> }>> = {
  topps: { tier: { common: 1, rare: 0.9, epic: 0.8, legendary: 0.7 }, finish: { base: 1, silver: 0.9, gold: 0.8, holo: 0.7 } },
  locker: { tier: { common: 1, rare: 0.85, epic: 0.7, legendary: 0.55 }, finish: { base: 1, silver: 0.85, gold: 0.7, holo: 0.55 } },
  auto: { tier: { common: 1, rare: 0.65, epic: 0.45, legendary: 0.15 }, finish: { base: 1, silver: 0.65, gold: 0.5, holo: 0.5 } },
};

/** Extra multipliers for one exact variant × tier × finish, on top of VARIANT_STACK (the chase cards). */
export const VARIANT_COMBO: { variant: Variant; tier: Tier; finish: Finish; factor: number }[] = [
  { variant: 'auto', tier: 'legendary', finish: 'holo', factor: 0.15 },
];

/** Variant odds for one card of a pack, given the tier and finish it already rolled. */
export const variantWeights = (type: PackType, tier: Tier, finish: Finish): Weights<Variant> => {
  const base = PACKS[type].variants;
  return Object.fromEntries(
    VARIANTS.map(({ key }) => {
      const s = VARIANT_STACK[key];
      const combo = VARIANT_COMBO.reduce((m, c) => (c.variant === key && c.tier === tier && c.finish === finish ? m * c.factor : m), 1);
      return [key, base[key] * (s ? s.tier[tier] * s.finish[finish] : 1) * combo];
    }),
  ) as Weights<Variant>;
};

/**
 * Standard pack odds are the baseline. Targets per card (owner: "Holos are supposed to be super rare, same goes for
 * legendary players"): Silver about 1 in 9, Gold about 1 in 50, Holo about 1 in 350; Epic player about 1 in 17,
 * Legendary player about 1 in 100. Premium and Elite improve them (Elite Legendary about 1 in 33, Holo about 1 in
 * 200) but never make a Holo or a Legendary routine; Holo Showcase packs hold one guaranteed Holo. The shard path
 * (claims and finish upgrades below) is how a chosen card is worked toward on purpose.
 */
export const PACKS: Record<PackType, PackSpec> = {
  standard: {
    label: 'Standard Pack',
    size: 3,
    tiers: { common: 75, rare: 18, epic: 6, legendary: 1 },
    finishes: {
      common: { base: 86.5, silver: 11.2, gold: 2, holo: 0.3 },
      rare: { base: 87, silver: 10.8, gold: 1.95, holo: 0.25 },
      epic: { base: 88, silver: 10, gold: 1.8, holo: 0.2 },
      legendary: { base: 89, silver: 9.5, gold: 1.4, holo: 0.1 },
    },
    variants: VARIANT_ODDS.standard,
    guarantee: '3 cards. No guarantees.',
  },
  premium: {
    label: 'Premium Pack',
    size: 4,
    tiers: { common: 66, rare: 24, epic: 8.5, legendary: 1.5 },
    finishes: {
      common: { base: 80, silver: 15, gold: 4.5, holo: 0.5 },
      rare: { base: 81, silver: 14.5, gold: 4.1, holo: 0.4 },
      epic: { base: 82, silver: 14, gold: 3.7, holo: 0.3 },
      legendary: { base: 84, silver: 13, gold: 2.8, holo: 0.2 },
    },
    variants: VARIANT_ODDS.premium,
    guarantee: '4 cards. At least one Silver-or-better finish (the last card is upgraded if needed).',
  },
  elite: {
    label: 'Elite Pack',
    size: 5,
    tiers: { common: 52, rare: 30, epic: 15, legendary: 3 },
    finishes: {
      common: { base: 74, silver: 20, gold: 5.5, holo: 0.5 },
      rare: { base: 75, silver: 19.5, gold: 5, holo: 0.5 },
      epic: { base: 77, silver: 18, gold: 4.6, holo: 0.4 },
      legendary: { base: 80, silver: 16, gold: 3.7, holo: 0.3 },
    },
    variants: VARIANT_ODDS.elite,
    guarantee: '5 cards. At least one Epic-or-better player (the last card is upgraded if needed).',
  },
  perfect: {
    label: 'Perfect Season Pack',
    size: 5,
    // The two regular slots use Elite odds; the three chase slots follow PERFECT_CHASE_*
    tiers: { common: 52, rare: 30, epic: 15, legendary: 3 },
    finishes: {
      common: { base: 74, silver: 20, gold: 5.5, holo: 0.5 },
      rare: { base: 75, silver: 19.5, gold: 5, holo: 0.5 },
      epic: { base: 77, silver: 18, gold: 4.6, holo: 0.4 },
      legendary: { base: 80, silver: 16, gold: 3.7, holo: 0.3 },
    },
    variants: VARIANT_ODDS.chase,
    guarantee: '5 cards: 2 at Elite odds, then 3 chase cards, each an Epic-or-better player (1 in 5 Legendary) at Silver or better; about 1 pack in 25 holds a Legendary Holo.',
  },
  holo: {
    label: 'Holo Showcase Pack',
    size: 5,
    // HOLO_PACK_SLOTS guaranteed Holo cards (tier from HOLO_SLOT_TIER); the other slots roll these Elite odds
    tiers: { common: 52, rare: 30, epic: 15, legendary: 3 },
    finishes: {
      common: { base: 74, silver: 20, gold: 5.5, holo: 0.5 },
      rare: { base: 75, silver: 19.5, gold: 5, holo: 0.5 },
      epic: { base: 77, silver: 18, gold: 4.6, holo: 0.4 },
      legendary: { base: 80, silver: 16, gold: 3.7, holo: 0.3 },
    },
    variants: VARIANT_ODDS.chase,
    guarantee: '5 cards: 1 guaranteed Holo (any tier, Legendary 1 in 25), the rest at Elite odds.',
  },
  exchange: {
    label: 'Legends Exchange',
    size: 0,
    // Contents are planned at migration time (ExchangePack.cards); never rolled, never in the odds table
    tiers: { common: 0, rare: 0, epic: 0, legendary: 0 },
    finishes: {
      common: { base: 1, silver: 0, gold: 0, holo: 0 },
      rare: { base: 1, silver: 0, gold: 0, holo: 0 },
      epic: { base: 1, silver: 0, gold: 0, holo: 0 },
      legendary: { base: 1, silver: 0, gold: 0, holo: 0 },
    },
    // Each exchanged card rolls its art at open time like any pull, at Elite variant odds
    variants: VARIANT_ODDS.elite,
    guarantee: 'One league card for each retired NFL legend card, same tier and finish.',
  },
};

/** Earnable packs, in shelf and odds-table order. */
export const PACK_ORDER: EarnablePack[] = ['standard', 'premium', 'elite', 'perfect', 'holo'];
/** Every pack the shelf can show (the Legends Exchange pack last). */
export const SHELF_ORDER: PackType[] = [...PACK_ORDER, 'exchange'];
/** Packs stored as plain counts. */
export const COUNTED_PACKS: CountedPack[] = ['standard', 'premium', 'elite', 'holo'];

/**
 * Holo Showcase pack: this many guaranteed Holo slots, their tier rolled from HOLO_SLOT_TIER (the other slots roll
 * PACKS.holo like an Elite pack). It used to be five Holos with two Legendary Holos guaranteed, which made Holo
 * routine; one Holo keeps the pack special without handing out the rarest finish by the handful.
 */
export const HOLO_PACK_SLOTS = 1;
export const HOLO_SLOT_TIER: Weights<Tier> = { common: 50, rare: 30, epic: 16, legendary: 4 };

/** Premium: finish odds for the last card when the first three were all Base. */
export const PREMIUM_GUARANTEE_FINISH: FinishTable = {
  common: { base: 0, silver: 90, gold: 9.5, holo: 0.5 },
  rare: { base: 0, silver: 90, gold: 9.6, holo: 0.4 },
  epic: { base: 0, silver: 91, gold: 8.7, holo: 0.3 },
  legendary: { base: 0, silver: 92, gold: 7.8, holo: 0.2 },
};
/** Elite: tier odds for the last card when the first four had no Epic or Legendary player. */
export const ELITE_GUARANTEE_TIER: Weights<Tier> = { common: 0, rare: 0, epic: 92, legendary: 8 };

/** Perfect Season pack: chase slots, each a Legendary-tier Holo with this chance… */
export const PERFECT_CHASE_SLOTS = 3;
export const PERFECT_CHASE_HOLO_CHANCE = 0.01;
/** …and otherwise an Epic-or-better player rolled from these tier odds, at one of these finishes. */
export const PERFECT_CHASE_FALLBACK_TIER: Weights<Tier> = { common: 0, rare: 0, epic: 80, legendary: 20 };
export const PERFECT_CHASE_FALLBACK_FINISH: Weights<Finish> = { base: 0, silver: 62, gold: 36, holo: 2 };

// ---------- Shards: duplicates in, claims and finish upgrades out ----------

/**
 * Shards from a duplicate (same player, variant, finish and kit already owned), by finish, × DUPLICATE_TIER_MULTIPLIER.
 * The pool is small (about 130 players), so duplicates come quickly; they fund the deliberate path: claim a chosen
 * player's card, then upgrade it a finish at a time. Pacing for an active player (scripts/simulate_packs.ts): a
 * Legend claim in about a week, Gold on a chosen card in about two, Holo only after several weeks.
 */
export const DUPLICATE_SHARDS: Weights<Finish> = { base: 5, silver: 12, gold: 40, holo: 150 };
/** Flat shards for every pack opened, so the shard path moves from day one (before duplicates pile up). */
export const PACK_SHARDS: Record<PackType, number> = { standard: 10, premium: 20, elite: 35, perfect: 60, holo: 60, exchange: 0 };
export const DUPLICATE_TIER_MULTIPLIER: Weights<Tier> = { common: 1, rare: 1.5, epic: 2, legendary: 3 };
export const duplicateShards = (finish: Finish, tier: Tier) => Math.round(DUPLICATE_SHARDS[finish] * DUPLICATE_TIER_MULTIPLIER[tier]);

/**
 * Shards to craft a card up to the next finish, × the tier and the art variant multipliers (Locker upgrades cost
 * most). Autographs are pulled only: their finish is the one they were pulled at, so they are never upgraded.
 */
export const CRAFT_COST: Record<Exclude<Finish, 'base'>, number> = { silver: 80, gold: 360, holo: 2000 };
export const CRAFT_TIER_MULTIPLIER: Weights<Tier> = { common: 1, rare: 1.5, epic: 2, legendary: 3 };
export const CRAFT_VARIANT_MULTIPLIER: Partial<Weights<Variant>> = { number: 1, jersey: 1, topps: 1.25, locker: 1.5 };
/** Can this variant be upgraded a finish with shards? (Every art but the Autograph.) */
export const isCraftable = (v: Variant) => CRAFT_VARIANT_MULTIPLIER[v] != null;

export const craftCost = (to: Exclude<Finish, 'base'>, tier: Tier, variant: Variant = 'number') =>
  Math.round(CRAFT_COST[to] * CRAFT_TIER_MULTIPLIER[tier] * (CRAFT_VARIANT_MULTIPLIER[variant] ?? 1));
export const nextFinish = (f: Finish): Exclude<Finish, 'base'> | null => (f === 'base' ? 'silver' : f === 'silver' ? 'gold' : f === 'gold' ? 'holo' : null);

/**
 * Claim: shards buy a chosen player's Base card (a "Legend claim" for a Legendary player), in the most common art
 * variant he is still missing (CLAIM_VARIANTS order; never the Autograph, which stays a pull).
 */
export const CLAIM_COST: Weights<Tier> = { common: 150, rare: 300, epic: 600, legendary: 1000 };
export const CLAIM_VARIANTS: Variant[] = ['number', 'jersey', 'topps', 'locker'];
export const claimCost = (tier: Tier) => CLAIM_COST[tier];
/** The variant a claim would add for this player, or null when every claimable variant is owned. */
export const claimVariant = (card: OwnedCard | undefined): Variant | null => CLAIM_VARIANTS.find((v) => !card?.variants[v]) ?? null;

// ---------- Earning rules (documented here, called from src/components/games/*) ----------

/** What each Arcade game pays out; shown on the Collection tab. Single correct answers earn nothing. */
export const EARNING_RULES: { game: string; rules: string }[] = [
  { game: 'Guess the Legend', rules: 'Solve for 3–4 points: Standard. Solve for 5 points: Premium.' },
  { game: 'Higher or Lower', rules: 'Every 5 in a row: Standard. Every 15 in a row: Premium instead.' },
  { game: 'League Grid', rules: 'Finish with 6–8 of 9: Standard. All 9: Premium.' },
  { game: 'Blind Rank', rules: 'Perfect round (10 points): Premium.' },
  { game: 'Keep 3 / Cut 3', rules: 'Keep all three right: Standard.' },
  { game: 'Can you go 18–0?', rules: 'Winning season: Standard. Win a playoff game: Premium. 18–0: one Perfect Season pack.' },
  { game: 'Imposter', rules: 'Every 3 in a row: Standard.' },
  { game: 'Six Degrees', rules: 'Par or better: Standard. Eagle or better: Premium.' },
  { game: 'Over / Under', rules: 'Slip settles in profit: Standard. Parlay hits: Premium.' },
];

// ---------- Store ----------

/** One art variant of a player's card. */
export interface VariantCard {
  /** Best finish owned in this variant */
  best: Finish;
  /** Copies pulled (or crafted) per finish */
  counts: Partial<Record<Finish, number>>;
  /** First pull and latest pull (ms since epoch) */
  first: number;
  last: number;
  /**
   * Kits owned per finish: kit id ('home', an alternate's or era kit's id from art/sprite/uniforms.ts, or LEGACY_KIT
   * for cards from before per-pull kits, which wear the old fixed roll) → copies. Missing for the Autograph.
   */
  kits?: Partial<Record<Finish, Record<string, number>>>;
  /**
   * Prizm number only: every colour parallel copy owned per finish, in pull order (colour + serial). Copies a finish
   * holds beyond these are plain Prizm, so saves from before parallels (no field) load as all plain.
   */
  prizm?: Partial<Record<Finish, PrizmCopy[]>>;
}

/** Everything owned of one player: one entry per art variant, plus a summary across them. */
export interface OwnedCard {
  /** Best finish owned in any variant */
  best: Finish;
  /** Copies per finish, all variants together */
  counts: Partial<Record<Finish, number>>;
  /** First pull and latest pull of any variant (ms since epoch) */
  first: number;
  last: number;
  /** Provenance badges, e.g. "18–0 · Bills · Oct 19, 2026" for cards from a Perfect Season pack */
  marks?: string[];
  /** Variants owned (at least one) */
  variants: Partial<Record<Variant, VariantCard>>;
}

/** Recomputes an OwnedCard's summary (best, counts, first, last) from its variants. */
export const summarise = (variants: Partial<Record<Variant, VariantCard>>, marks?: string[]): OwnedCard => {
  const list = VARIANTS.map((v) => variants[v.key]).filter((x): x is VariantCard => !!x);
  const counts: Partial<Record<Finish, number>> = {};
  list.forEach((c) => FINISHES.forEach(({ key }) => c.counts[key] && (counts[key] = (counts[key] ?? 0) + c.counts[key]!)));
  const best = list.reduce<Finish>((b, c) => (finishRank(c.best) > finishRank(b) ? c.best : b), 'base');
  const firsts = list.map((c) => c.first).filter((x) => x > 0);
  return {
    best,
    counts,
    first: firsts.length ? Math.min(...firsts) : 0,
    last: Math.max(0, ...list.map((c) => c.last)),
    ...(marks?.length ? { marks } : {}),
    variants,
  };
};

/** Variants owned, rarest first. */
export const ownedVariants = (card: OwnedCard | undefined): Variant[] =>
  card ? [...VARIANTS].reverse().map((v) => v.key).filter((v) => !!card.variants[v]) : [];

/** The variant a binder tile shows: the rarest one owned (ties can't happen: one entry per variant). */
export const bestVariant = (card: OwnedCard | undefined): Variant => ownedVariants(card)[0] ?? LEGACY_VARIANT;

/** Is this exact variant × finish owned? */
export const ownsCombo = (card: OwnedCard | undefined, variant: Variant, finish: Finish) => {
  const v = card?.variants[variant];
  return !!v && (!!v.counts[finish] || v.best === finish);
};

/**
 * What a player's card shows by default (binder tile, Best pulls, the detail): the owner's display choice when he
 * still owns it (`pinned`), otherwise auto, the rarest variant owned at its best finish. The kit it wears is picked by
 * displayWithKit (src/components/collection/kits.ts), which knows the uniforms.
 */
export const displayOf = (card: OwnedCard | undefined, choice?: DisplayChoice): { variant: Variant; finish: Finish; pinned: boolean } => {
  if (choice && ownsCombo(card, choice.variant, choice.finish)) return { variant: choice.variant, finish: choice.finish, pinned: true };
  const variant = bestVariant(card);
  return { variant, finish: card?.variants[variant]?.best ?? 'base', pinned: false };
};

export interface PerfectPack {
  id: string;
  /** Provenance label stamped on the pack and every card pulled from it */
  label: string;
  at: number;
  /** From a gift link: opens like any Perfect Season pack but stamps no 18–0 mark on its cards */
  gift?: boolean;
}

/** One planned card in a Legends Exchange pack: a league card replacing a retired legend card. */
export interface ExchangeCard {
  /** League player's "POS:Name" */
  key: string;
  tier: Tier;
  finish: Finish;
  /** The legend card it replaces ("POS:Name") */
  from: string;
  /** Unused: older builds stored the Team jersey here. The variant is rolled when the pack is opened. */
  variant?: Variant;
}

/** Legends Exchange pack: contents fixed when it was created, so a reload never rerolls them. */
export interface ExchangePack {
  id: string;
  label: string;
  at: number;
  cards: ExchangeCard[];
}

/** One owned autograph: an individual card (two pulls of the same player are two autographs). */
export interface OwnedAuto {
  id: string;
  /** "POS:Name" */
  key: string;
  pulledAt: number;
  pack: PackType;
  /** The finish of the card it was pulled on (autographs pulled before the Autograph variant: Base) */
  finish: Finish;
  roll: AutographRoll;
  /** The player as he was at the pull; the card renders from this forever */
  snap: AutographSnapshot;
}

export interface EarnedPack {
  type: PackType;
  reason: string;
  at: number;
}

export interface CollectionState {
  v: 2;
  cards: Record<string, OwnedCard>;
  /** Unopened packs */
  packs: Record<CountedPack, number>;
  perfect: PerfectPack[];
  /** Unopened Legends Exchange packs (normally at most one) */
  exchange: ExchangePack[];
  shards: number;
  /** Packs opened so far, by type */
  opened: Record<PackType, number>;
  /** Most recent awards, newest first (capped) */
  earned: EarnedPack[];
  /** A v1 collection was found and discarded on this browser */
  migrated?: boolean;
  /** The one-time "new system" notice was dismissed */
  noticeSeen?: boolean;
  /** Gift links already redeemed on this browser (GIFTS ids) */
  gifts?: string[];
  /** Local day ("2026-11-05") of the last daily draw (claimDaily); missing = never drawn */
  daily?: string;
  /**
   * Display choice per player ("POS:Name" → variant + finish): what his binder tile, Best pulls and the detail show.
   * Missing (the default) means auto: the rarest variant owned at its best finish. A choice no longer owned falls
   * back to auto (displayOf).
   */
  display?: Record<string, DisplayChoice>;
  /** Owned autographs, in pull order (older saves have none) */
  autos: OwnedAuto[];
  /**
   * Coins: the trading currency (src/utils/economy.ts). Earned by selling cards to the market, set bonuses and bounties;
   * spent in the pack shop. Older saves load with 0.
   */
  coins: number;
  /** Latest coin movements, newest first (capped at COIN_LOG_CAP) */
  coinLog?: CoinEntry[];
  /** Set ids whose one-time completion bonus was claimed (economy.ts collectionSets) */
  setsClaimed?: string[];
  /** Bounties turned in this edition: the edition seed they belong to and the bounty ids done (reset on a new edition) */
  bounties?: { seed: number; done: string[] };
  /** Portfolio milestone ids reached (economy.ts MILESTONES); once unlocked, always unlocked */
  unlocks?: string[];
  /** Cosmetics switched on (ids from unlocked milestones); missing = the classic look */
  cosmetics?: { binder?: string; pack?: string };
}

/** One coin movement: amount (+ earned, − spent) and what it was for. */
export interface CoinEntry {
  at: number;
  amount: number;
  text: string;
}
export const COIN_LOG_CAP = 40;

export interface DisplayChoice {
  variant: Variant;
  finish: Finish;
  /** The kit to wear (a stored kit id); missing = the best owned for that variant × finish */
  kit?: string;
  /** Prizm number: the parallel to show ('plain' or a colour owned there); missing = the best owned */
  parallel?: PrizmParallel | 'plain';
}

export type CollectionChange =
  | { kind: 'earned'; type: PackType; reason: string; label?: string }
  | { kind: 'opened'; type: PackType }
  | { kind: 'crafted'; key: string; finish: Finish; variant: Variant }
  | { kind: 'claimed'; key: string; variant: Variant }
  | { kind: 'other' };

const EARNED_CAP = 30;
const fresh = (): CollectionState => ({
  v: 2,
  cards: {},
  packs: { standard: 0, premium: 0, elite: 0, holo: 0 },
  perfect: [],
  exchange: [],
  shards: 0,
  opened: { standard: 0, premium: 0, elite: 0, perfect: 0, holo: 0, exchange: 0 },
  earned: [],
  autos: [],
  coins: 0,
});
const EMPTY: CollectionState = fresh();
let memory: CollectionState | null = null;

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
const isFinish = (x: unknown): x is Finish => FINISHES.some((f) => f.key === x);
const isPack = (x: unknown): x is PackType => SHELF_ORDER.includes(x as PackType);
const isTier = (x: unknown): x is Tier => TIERS.some((t) => t.key === x);
const KEY_RE = /^[A-Z]{2}:.+/;

/** One variant entry (or a whole pre-variant card): needs a valid best finish. */
const parseVariant = (x: unknown): VariantCard | null => {
  const e = x as Partial<VariantCard> | null;
  if (!e || typeof e !== 'object' || !isFinish(e.best)) return null;
  const counts: Partial<Record<Finish, number>> = {};
  FINISHES.forEach(({ key }) => {
    const n = num(e.counts?.[key]);
    if (n) counts[key] = n;
  });
  if (!counts[e.best]) counts[e.best] = 1;
  const prizm = parsePrizm(e.prizm, counts);
  return { best: e.best, counts, first: num(e.first), last: num(e.last), kits: parseKits(e.kits, counts), ...(prizm ? { prizm } : {}) };
};

/** Prizm parallel copies per finish, validated: known colours, serials within the run, never more than the copies owned. */
const parsePrizm = (x: unknown, counts: Partial<Record<Finish, number>>): VariantCard['prizm'] => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const out: NonNullable<VariantCard['prizm']> = {};
  FINISHES.forEach(({ key: f }) => {
    const r = (x as Record<string, unknown>)[f];
    if (!counts[f] || !Array.isArray(r)) return;
    const list = r
      .filter((p): p is PrizmCopy => !!p && typeof p === 'object' && isPrizmParallel((p as PrizmCopy).c) && Number.isInteger((p as PrizmCopy).n))
      .filter((p) => p.n >= 1 && p.n <= prizmInfo(p.c).run)
      .map(({ c, n }) => ({ c, n }))
      .slice(0, counts[f]);
    if (list.length) out[f] = list;
  });
  return Object.keys(out).length ? out : undefined;
};

const KIT_RE = /^[a-z0-9-]{1,40}$/;
/**
 * Kits per finish, validated. Every finish owned keeps at least its copies' worth of kits: a finish with no (valid)
 * kits, as in every save from before per-pull kits, owns LEGACY_KIT (the kit the old fixed roll gives it, so it keeps
 * its look), and copies the kits don't account for are LEGACY_KIT too.
 */
const parseKits = (x: unknown, counts: Partial<Record<Finish, number>>): VariantCard['kits'] => {
  const raw = x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
  const out: NonNullable<VariantCard['kits']> = {};
  FINISHES.forEach(({ key: f }) => {
    const have = counts[f];
    if (!have) return;
    const r = raw[f] && typeof raw[f] === 'object' && !Array.isArray(raw[f]) ? (raw[f] as Record<string, unknown>) : {};
    const kits: Record<string, number> = {};
    Object.entries(r).forEach(([id, n]) => {
      const c = num(n);
      if (c && KIT_RE.test(id)) kits[id] = c;
    });
    const missing = have - Object.values(kits).reduce((a, b) => a + b, 0);
    if (missing > 0) kits[LEGACY_KIT] = (kits[LEGACY_KIT] ?? 0) + missing;
    out[f] = kits;
  });
  return out;
};
/** Kits of two entries for one variant, summed per finish and kit. */
const mergeKits = (a: VariantCard['kits'], b: VariantCard['kits']): VariantCard['kits'] => {
  const out: NonNullable<VariantCard['kits']> = {};
  FINISHES.forEach(({ key: f }) => {
    const m: Record<string, number> = { ...a?.[f] };
    Object.entries(b?.[f] ?? {}).forEach(([id, n]) => (m[id] = (m[id] ?? 0) + n));
    if (Object.keys(m).length) out[f] = m;
  });
  return out;
};

/** Variant key of the removed Retro Bowl sprite art; stored entries migrate to the Locker stall on load. */
const RETIRED_SPRITE = 'sprite';
/** Two entries for one variant: counts per finish summed, the better best finish, the earliest first, the latest last. */
const mergeVariant = (a: VariantCard, b: VariantCard): VariantCard => {
  const counts: Partial<Record<Finish, number>> = {};
  FINISHES.forEach(({ key }) => {
    const n = (a.counts[key] ?? 0) + (b.counts[key] ?? 0);
    if (n) counts[key] = n;
  });
  const firsts = [a.first, b.first].filter((t) => t > 0);
  return {
    best: finishRank(b.best) > finishRank(a.best) ? b.best : a.best,
    counts,
    first: firsts.length ? Math.min(...firsts) : 0,
    last: Math.max(a.last, b.last),
    kits: mergeKits(a.kits, b.kits),
    ...(a.prizm || b.prizm
      ? { prizm: Object.fromEntries(FINISHES.map(({ key: f }) => [f, [...(a.prizm?.[f] ?? []), ...(b.prizm?.[f] ?? [])]]).filter(([, l]) => l.length)) }
      : {}),
  };
};

/**
 * Autographs pulled before the Autograph was an art variant were a separate hit on top of a card: each player who has
 * one but no Autograph variant gets it (Base, one copy per autograph, first and last from the pulls), so the binder,
 * variant badges and counts see every autograph owned. Idempotent: a player with an Autograph variant is left alone.
 */
const migrateAutos = (s: CollectionState) => {
  const missing = new Map<string, OwnedAuto[]>();
  s.autos.forEach((a) => {
    if (s.cards[a.key]?.variants.auto) return;
    missing.set(a.key, [...(missing.get(a.key) ?? []), a]);
  });
  missing.forEach((list, k) => {
    const times = list.map((a) => a.pulledAt).filter((t) => t > 0);
    const first = times.length ? Math.min(...times) : 0;
    const entry: VariantCard = { best: 'base', counts: { base: list.length }, first, last: times.length ? Math.max(...times) : 0 };
    const card = s.cards[k];
    s.cards[k] = summarise({ ...card?.variants, auto: entry }, card?.marks ?? []);
  });
};

const parse = (raw: string | null): CollectionState | null => {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<CollectionState> | null;
    if (!d || typeof d !== 'object' || d.v !== 2) return null;
    const s = fresh();
    const rawCards = d.cards && typeof d.cards === 'object' && !Array.isArray(d.cards) ? d.cards : {};
    Object.entries(rawCards).forEach(([k, v]) => {
      const e = v as Partial<OwnedCard> | null;
      // Keys are "POS:Name"; entries need a valid best finish. Anything else is dropped.
      if (!KEY_RE.test(k) || !e || typeof e !== 'object' || !isFinish(e.best)) return;
      const marks = Array.isArray(e.marks) ? e.marks.filter((m): m is string => typeof m === 'string') : [];
      const variants: Partial<Record<Variant, VariantCard>> = {};
      const raw = e.variants && typeof e.variants === 'object' && !Array.isArray(e.variants) ? e.variants : null;
      if (raw) Object.entries(raw).forEach(([vk, vc]) => {
        const c = parseVariant(vc);
        if (!c) return;
        if (isVariant(vk)) variants[vk] = variants[vk] ? mergeVariant(variants[vk]!, c) : c;
        // The retired Retro Bowl sprite art: its cards become the Locker stall (never an Autograph: those are signed pulls)
        else if (vk === RETIRED_SPRITE) variants.locker = variants.locker ? mergeVariant(variants.locker, c) : c;
      });
      // Saves from before variants (or with no valid variant): the whole card becomes the Team jersey variant
      if (!Object.keys(variants).length) variants[LEGACY_VARIANT] = parseVariant(e)!;
      // The Autograph's art is the signed card: it has no kits
      if (variants.auto) delete variants.auto.kits;
      // Parallels are Prizm number only
      VARIANTS.forEach(({ key }) => key !== 'number' && variants[key] && delete variants[key]!.prizm);
      s.cards[k] = summarise(variants, marks);
    });
    COUNTED_PACKS.forEach((t) => (s.packs[t] = num(d.packs?.[t])));
    SHELF_ORDER.forEach((t) => (s.opened[t] = num(d.opened?.[t])));
    s.perfect = (Array.isArray(d.perfect) ? d.perfect : []).filter(
      (p): p is PerfectPack => !!p && typeof p.id === 'string' && typeof p.label === 'string',
    );
    s.exchange = (Array.isArray(d.exchange) ? d.exchange : [])
      .filter((p): p is ExchangePack => !!p && typeof p.id === 'string' && Array.isArray(p.cards))
      .map((p) => ({
        id: p.id,
        label: typeof p.label === 'string' ? p.label : PACKS.exchange.label,
        at: num(p.at),
        cards: p.cards.filter(
          (c): c is ExchangeCard => !!c && typeof c.key === 'string' && KEY_RE.test(c.key) && isTier(c.tier) && isFinish(c.finish) && typeof c.from === 'string',
        )
        .map(({ key, tier, finish, from }) => ({ key, tier, finish, from })),
      }))
      .filter((p) => p.cards.length > 0);
    s.shards = num(d.shards);
    s.earned = (Array.isArray(d.earned) ? d.earned : []).filter((e): e is EarnedPack => !!e && isPack(e.type) && typeof e.reason === 'string').slice(0, EARNED_CAP);
    s.migrated = !!d.migrated;
    s.noticeSeen = !!d.noticeSeen;
    const gifts = Array.isArray(d.gifts) ? d.gifts.filter((g): g is string => typeof g === 'string') : [];
    if (gifts.length) s.gifts = gifts;
    if (typeof d.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.daily)) s.daily = d.daily;
    const rawDisplay = d.display && typeof d.display === 'object' && !Array.isArray(d.display) ? d.display : {};
    const display: Record<string, DisplayChoice> = {};
    Object.entries(rawDisplay).forEach(([k, v]) => {
      const c = v as Partial<DisplayChoice> | null;
      if (KEY_RE.test(k) && c && isVariant(c.variant) && isFinish(c.finish))
        display[k] = {
          variant: c.variant,
          finish: c.finish,
          ...(typeof c.kit === 'string' && KIT_RE.test(c.kit) ? { kit: c.kit } : {}),
          ...(c.variant === 'number' && (c.parallel === 'plain' || isPrizmParallel(c.parallel)) ? { parallel: c.parallel } : {}),
        };
    });
    if (Object.keys(display).length) s.display = display;
    s.autos = (Array.isArray(d.autos) ? d.autos : []).flatMap((a): OwnedAuto[] => {
      const e = a as Partial<OwnedAuto> | null;
      if (!e || typeof e !== 'object' || typeof e.id !== 'string' || typeof e.key !== 'string' || !KEY_RE.test(e.key)) return [];
      const roll = parseRoll(e.roll);
      const snap = parseSnapshot(e.snap);
      if (!roll || !snap) return [];
      return [{ id: e.id, key: e.key, pulledAt: num(e.pulledAt), pack: isPack(e.pack) ? e.pack : 'standard', finish: isFinish(e.finish) ? e.finish : 'base', roll, snap }];
    });
    migrateAutos(s);
    // Economy (all optional on disk: older saves load with no coins, nothing claimed, nothing unlocked)
    s.coins = num(d.coins);
    const log = (Array.isArray(d.coinLog) ? d.coinLog : []).filter(
      (e): e is CoinEntry => !!e && typeof e === 'object' && typeof e.text === 'string' && typeof e.amount === 'number' && Number.isFinite(e.amount),
    );
    if (log.length) s.coinLog = log.slice(0, COIN_LOG_CAP).map(({ at, amount, text }) => ({ at: num(at), amount: Math.round(amount), text }));
    const strs = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length < 120))] : []);
    const sets = strs(d.setsClaimed);
    if (sets.length) s.setsClaimed = sets;
    const b = d.bounties as { seed?: unknown; done?: unknown } | undefined;
    if (b && typeof b === 'object' && typeof b.seed === 'number' && Number.isFinite(b.seed)) s.bounties = { seed: b.seed, done: strs(b.done) };
    const unlocks = strs(d.unlocks);
    if (unlocks.length) s.unlocks = unlocks;
    const cos = d.cosmetics as { binder?: unknown; pack?: unknown } | undefined;
    if (cos && typeof cos === 'object') {
      const c: NonNullable<CollectionState['cosmetics']> = {};
      if (typeof cos.binder === 'string' && KIT_RE.test(cos.binder)) c.binder = cos.binder;
      if (typeof cos.pack === 'string' && KIT_RE.test(cos.pack)) c.pack = cos.pack;
      if (c.binder || c.pack) s.cosmetics = c;
    }
    return s;
  } catch {
    return null;
  }
};

const persist = (s: CollectionState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable or full; keep the in-memory copy for this visit
  }
};

/** Current state; cached so useSyncExternalStore gets a stable snapshot between writes. */
export const readCollection = (): CollectionState => {
  if (memory) return memory;
  try {
    const stored = parse(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      memory = stored;
      persist(stored); // write back the validated shape (drops malformed entries)
      // A v1 binder written later (e.g. by a tab still running the old build) is ignored and removed
      if (localStorage.getItem(STORAGE_KEY_V1) != null) localStorage.removeItem(STORAGE_KEY_V1);
    } else {
      // First run of v2, or a malformed v2 value (it is replaced with a fresh state)
      // Drop the v1 binder (its cards were granted directly by game events)
      const hadV1 = localStorage.getItem(STORAGE_KEY_V1) != null;
      if (hadV1) localStorage.removeItem(STORAGE_KEY_V1);
      memory = { ...fresh(), migrated: hadV1 };
      persist(memory);
    }
  } catch {
    memory = fresh();
  }
  return memory;
};

/** Every write: memory, storage, then CHANGE_EVENT (src/utils/economy.ts writes through commitCollection). */
const write = (next: CollectionState, change: CollectionChange) => {
  memory = next;
  persist(next);
  try {
    window.dispatchEvent(new CustomEvent<CollectionChange>(CHANGE_EVENT, { detail: change }));
  } catch {
    // Non-browser environment
  }
};

/** The one save path for modules outside this file (the economy): same as every write here, fires CHANGE_EVENT. */
export const commitCollection = (next: CollectionState, change: CollectionChange = { kind: 'other' }) => write(next, change);

export const cardKey = (p: Pick<Player, 'name' | 'position'>) => playerKey(p);
export const isOwned = (p: Pick<Player, 'name' | 'position'>, state = readCollection()) => !!state.cards[cardKey(p)];
/** Variants owned across the binder (set progress counts each player × variant). */
export const variantsOwned = (cards: Record<string, OwnedCard>, keys?: string[]) =>
  (keys ?? Object.keys(cards)).reduce((n, k) => n + (cards[k] ? Object.keys(cards[k].variants).length : 0), 0);

export const dismissNotice = () => {
  const s = readCollection();
  if (!s.noticeSeen) write({ ...s, noticeSeen: true }, { kind: 'other' });
};

// Toast listeners (CardUnlockToasts). With none mounted, awardPack falls back to a plain text toast.
let toastListeners = 0;
export const registerToastListener = () => {
  toastListeners++;
  return () => {
    toastListeners--;
  };
};
export const hasToastListener = () => toastListeners > 0;

export const packTotal = (s: CollectionState) => COUNTED_PACKS.reduce((n, t) => n + s.packs[t], 0) + s.perfect.length + s.exchange.length;
export const packCount = (s: CollectionState, t: PackType) => (t === 'perfect' ? s.perfect.length : t === 'exchange' ? s.exchange.length : s.packs[t]);

/** Objects that already paid out (a game round, a season), so a re-run handler can't pay twice. */
const paid = new WeakSet<object>();

export interface AwardOptions {
  /** Pay out at most once per this object (e.g. the finished round or season) */
  once?: object;
  /** Perfect Season packs: provenance label stamped on the pack and its cards */
  label?: string;
}

/**
 * Awards one unopened reward pack. Games call this (never a card grant). `reason` is shown in the
 * toast, e.g. "League Grid 9/9". Returns false when `once` already paid out.
 */
export const awardPack = (type: EarnablePack, reason: string, opts: AwardOptions = {}): boolean => {
  if (opts.once) {
    if (paid.has(opts.once)) return false;
    paid.add(opts.once);
  }
  const s = readCollection();
  const at = Date.now();
  const next: CollectionState = {
    ...s,
    earned: [{ type, reason, at }, ...s.earned].slice(0, EARNED_CAP),
  };
  let label: string | undefined;
  if (type === 'perfect') {
    label = opts.label ?? `18–0 · ${new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    next.perfect = [...s.perfect, { id: `ps-${at}-${Math.random().toString(36).slice(2, 8)}`, label, at }];
  } else {
    next.packs = { ...s.packs, [type]: s.packs[type] + 1 };
  }
  write(next, { kind: 'earned', type, reason, label });
  if (!hasToastListener()) {
    toast.success(`Pack earned: ${PACKS[type].label} (${reason})`, { description: 'Open it on the Collection tab.' });
  }
  return true;
};

// ---------- Gift links ----------

/** One-time gift links (#collection?gift=<id>): real packs added once per browser. */
export const GIFTS: Record<string, { label: string; packs: [EarnablePack, number][] }> = {
  sampler: {
    label: 'Sampler packs',
    packs: [
      ['standard', 1],
      ['premium', 1],
      ['elite', 1],
      ['perfect', 1],
      ['holo', 2],
    ],
  },
  // New art variants, uniforms and poses (Oct 2026): auto-applied once per device (AUTO_GIFTS), or by link
  'refresh-2026-10-20': {
    label: 'Refresh packs',
    packs: [
      ['standard', 5],
      ['premium', 3],
      ['elite', 2],
      ['holo', 1],
    ],
  },
};

/** Gifts every device gets once, the first time a build containing them loads (same ids as the links, so never twice). */
export const AUTO_GIFTS = ['refresh-2026-10-20'];

/** "5 Standard, 3 Premium, 2 Elite, 1 Holo Showcase" */
export const giftSummary = (id: string) =>
  (GIFTS[id]?.packs ?? []).map(([t, n]) => `${n} ${PACKS[t].label.replace(/ Pack$/, '')}`).join(', ');

/**
 * Redeems every AUTO_GIFTS id not yet redeemed on this device; returns the ids granted now. Auto gifts top up an
 * existing collection only: a brand-new one (no cards, no packs opened, e.g. a new device or the public site before
 * a sync) just records them as redeemed, so a fresh browser never hands out the refresh bundle.
 */
export const redeemAutoGifts = (): string[] => {
  const s = readCollection();
  const fresh = Object.keys(s.cards).length === 0 && Object.values(s.opened).every((n) => !n);
  if (fresh) {
    const missing = AUTO_GIFTS.filter((id) => !s.gifts?.includes(id));
    if (missing.length) write({ ...s, gifts: [...(s.gifts ?? []), ...missing] }, { kind: 'other' });
    return [];
  }
  return AUTO_GIFTS.filter((id) => redeemGift(id) === 'granted');
};

/**
 * Redeems a gift link once per browser: adds its packs and records the id so a reload never grants again.
 * Returns 'granted', 'already' (redeemed before) or 'unknown'.
 */
export const redeemGift = (id: string): 'granted' | 'already' | 'unknown' => {
  const gift = GIFTS[id];
  if (!gift) return 'unknown';
  const s = readCollection();
  if (s.gifts?.includes(id)) return 'already';
  const at = Date.now();
  const packs = { ...s.packs };
  const perfect = [...s.perfect];
  const earned: EarnedPack[] = [];
  gift.packs.forEach(([type, count]) => {
    for (let i = 0; i < count; i++) {
      if (type === 'perfect') perfect.push({ id: `gift-${id}-${at}-${i}`, label: gift.label, at, gift: true });
      else packs[type] += 1;
      earned.push({ type, reason: gift.label, at });
    }
  });
  write({ ...s, packs, perfect, earned: [...earned, ...s.earned].slice(0, EARNED_CAP), gifts: [...(s.gifts ?? []), id] }, { kind: 'other' });
  return 'granted';
};

// ---------- Rolling ----------

export type Rng = () => number;

/**
 * Where kits come from. The uniform tables live with the card art (src/components/collection/art/sprite/uniforms.ts,
 * wired up as KIT_SOURCE in src/components/collection/kits.ts) and are passed in by the pack code, so this module (in
 * the main bundle: every game awards packs) never loads them.
 */
export interface KitSource {
  /** A club's kit ids: its modern alternates (0–2) and its era kit (if any) */
  of: (team: string | undefined) => { alts: string[]; era?: string };
  /** The kit id the old fixed roll gives a card (what LEGACY_KIT stands for on it) */
  legacy: (player: Player, variant: Variant, finish: Finish) => string;
}
/**
 * Stored kit id of a card the binder had before per-pull kits: it wears the old fixed roll (uniforms.ts uniformFor for
 * that player × variant × finish), so nothing owned changes look.
 */
export const LEGACY_KIT = 'legacy';

/**
 * Rolls one card's kit for a pack (KIT_ODDS): one roll r, r < era → the club's era kit, era ≤ r < era + alt → one of
 * its alternates (evenly), else home; a share the club has no kit for stays home. The Autograph always wears home.
 */
export const rollKit = (type: PackType, club: { alts: string[]; era?: string }, variant: Variant, rng: Rng = Math.random): string => {
  if (variant === 'auto') return 'home';
  const o = KIT_ODDS[type];
  const r = rng();
  if (r < o.era) return club.era ?? 'home';
  if (r < o.era + o.alt) return club.alts.length ? club.alts[Math.floor(rng() * club.alts.length)] : 'home';
  return 'home';
};

/** Per-card chance (non-Autograph pulls) of one exact kit of this club from a pack: home, an alternate or the era kit. */
export const kitChance = (type: PackType, club: { alts: string[]; era?: string }, kit: string): number => {
  const o = KIT_ODDS[type];
  if (club.era && kit === club.era) return o.era;
  if (club.alts.includes(kit)) return o.alt / club.alts.length;
  return kit === 'home' ? 1 - (club.era ? o.era : 0) - (club.alts.length ? o.alt : 0) : 0;
};

/**
 * Rolls one Prizm number card's colour parallel for a pack (PRIZM_ODDS): one roll r against the colours rarest first,
 * then a serial out of the colour's run (a Black is 1/1). Null (plain Prizm) for every other variant and most Prizms.
 */
export const rollPrizm = (type: PackType, variant: Variant, rng: Rng = Math.random): PrizmCopy | null => {
  if (variant !== 'number') return null;
  const o = PRIZM_ODDS[type];
  let r = rng();
  for (const p of [...PRIZM_PARALLELS].reverse()) {
    if (r < o[p.key]) return { c: p.key, n: p.run === 1 ? 1 : 1 + Math.floor(rng() * p.run) };
    r -= o[p.key];
  }
  return null;
};

/**
 * Prizm parallels owned in one Prizm finish: each colour owned (rarest first, with its serials in pull order), then
 * 'plain' when copies there aren't all parallels. Empty for other variants and combos not owned.
 */
export const ownedParallels = (card: OwnedCard | undefined, variant: Variant, finish: Finish): { c: PrizmParallel | 'plain'; serials: number[]; count: number }[] => {
  const v = card?.variants[variant];
  if (!v || variant !== 'number' || !ownsCombo(card, variant, finish)) return [];
  const list = v.prizm?.[finish] ?? [];
  const out = [...PRIZM_PARALLELS]
    .reverse()
    .map((p) => {
      const serials = list.filter((x) => x.c === p.key).map((x) => x.n);
      return { c: p.key as PrizmParallel | 'plain', serials, count: serials.length };
    })
    .filter((x) => x.count > 0);
  const plain = Math.max(0, (v.counts[finish] ?? 1) - list.length);
  if (plain) out.push({ c: 'plain', serials: [], count: plain });
  return out;
};

/**
 * The parallel a Prizm card shows: the pinned one when it is still owned there ('plain' = plain Prizm), else the best
 * owned (rarest colour, its lowest serial). Undefined = plain (and for every other variant).
 */
export const shownParallel = (card: OwnedCard | undefined, variant: Variant, finish: Finish, pin?: PrizmParallel | 'plain'): PrizmCopy | undefined => {
  const owned = ownedParallels(card, variant, finish);
  const hit = (pin && owned.find((o) => o.c === pin)) || owned[0];
  return !hit || hit.c === 'plain' ? undefined : { c: hit.c, n: Math.min(...hit.serials) };
};
/** The best parallel owned in one Prizm finish (shownParallel without a pin). */
export const bestParallel = (card: OwnedCard | undefined, variant: Variant, finish: Finish) => shownParallel(card, variant, finish);

export const pick = <K extends string>(weights: Partial<Record<K, number>>, rng: Rng, allowed?: (k: K) => boolean): K | null => {
  const items = (Object.entries(weights) as [K, number][]).filter(([k, w]) => w > 0 && (!allowed || allowed(k)));
  const total = items.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [k, w] of items) {
    r -= w;
    if (r < 0) return k;
  }
  return items[items.length - 1][0];
};

// ---------- Daily draw ----------

/**
 * One free pack a day (owner: "1 random draw a day … common packs are very common rares etc etc so that I don't have
 * to only rely on the games"). The draw rolls the pack TYPE: Standard very common, Premium uncommon, Elite rare,
 * Holo Showcase very rare (about 1 day in 200). Perfect Season packs stay 18–0 only. Resets at local midnight.
 */
export const DAILY_ODDS: Weights<Exclude<EarnablePack, 'perfect'>> = { standard: 78, premium: 17, elite: 4.5, holo: 0.5 };

/** Local calendar day, "2026-11-05". */
export const dayKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** True when today's draw hasn't been taken on this device. */
export const dailyReady = (s: CollectionState, now: Date = new Date()) => s.daily !== dayKey(now);

/** Milliseconds until the next draw unlocks (local midnight). */
export const msUntilDaily = (now: Date = new Date()) => {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
};

/** Takes today's draw: adds one rolled pack to the shelf and returns its type, or null if already drawn today. */
export const claimDaily = (rng: Rng = Math.random): Exclude<EarnablePack, 'perfect'> | null => {
  const s = readCollection();
  if (!dailyReady(s)) return null;
  const type = pick(DAILY_ODDS, rng) ?? 'standard';
  const at = Date.now();
  write(
    { ...s, daily: dayKey(), packs: { ...s.packs, [type]: s.packs[type] + 1 }, earned: [{ type, reason: 'Daily draw', at }, ...s.earned].slice(0, EARNED_CAP) },
    { kind: 'earned', type, reason: 'Daily draw' },
  );
  return type;
};

export interface RolledCard {
  player: Player;
  tier: Tier;
  finish: Finish;
  /** Art variant (rolled after the finish) */
  variant: Variant;
  /** Kit id (rolled after the variant, rollKit): 'home', an alternate's id or the era kit's id; always 'home' on the Autograph */
  kit: string;
  /** Prizm number: its colour parallel and serial (rolled last, rollPrizm); missing = plain (and every other variant) */
  prizm?: PrizmCopy;
  /** Which slot rule produced it (for the reveal) */
  slot: 'regular' | 'guarantee' | 'chase';
}

/** Players grouped by tier: the card pool for a roll. */
export type TierPool = Record<Tier, Player[]>;

export const groupByTier = <P,>(pool: P[], tierOf: (p: P) => Tier): Record<Tier, P[]> => {
  const out = { common: [], rare: [], epic: [], legendary: [] } as Record<Tier, P[]>;
  pool.forEach((p) => out[tierOf(p)].push(p));
  return out;
};

/**
 * Rolls a pack without touching storage (the odds simulation calls this directly). Each slot rolls a
 * tier (empty tiers drop out), a random player of that tier (no repeats within a pack while the tier
 * has others), then a finish, an art variant and (with a kit source) a kit. Guarantees apply to the last slot only when
 * still unmet. Without `kits` every card is home (and the rolls before it are unchanged).
 */
export const rollPack = (type: EarnablePack, pool: TierPool, rng: Rng = Math.random, kits?: KitSource): RolledCard[] => {
  const spec = PACKS[type];
  const has = (t: Tier) => pool[t].length > 0;
  const taken = new Set<string>();
  const out: RolledCard[] = [];

  const playerOf = (tier: Tier): Player => {
    const list = pool[tier];
    const free = list.filter((p) => !taken.has(cardKey(p)));
    const from = free.length ? free : list;
    const p = from[Math.floor(rng() * from.length)];
    taken.add(cardKey(p));
    return p;
  };
  // Order of rolls per card: tier → player → finish (already rolled by the caller) → variant → kit → Prizm parallel
  const push = (tier: Tier, finish: Finish, slot: RolledCard['slot']) => {
    const player = playerOf(tier);
    const variant = pick(variantWeights(type, tier, finish), rng) ?? LEGACY_VARIANT;
    const kit = kits ? rollKit(type, kits.of(player.team), variant, rng) : 'home';
    const prizm = rollPrizm(type, variant, rng);
    out.push({ player, tier, finish, variant, kit, ...(prizm ? { prizm } : {}), slot });
  };
  const regular = () => {
    const tier = pick(spec.tiers, rng, has);
    if (!tier) return;
    push(tier, pick(spec.finishes[tier], rng)!, 'regular');
  };

  if (!TIERS.some((t) => has(t.key))) return out;

  if (type === 'holo') {
    // The guaranteed Holo slots land at random positions in the reveal
    const holoAt = new Set<number>();
    while (holoAt.size < Math.min(HOLO_PACK_SLOTS, spec.size)) holoAt.add(Math.floor(rng() * spec.size));
    for (let i = 0; i < spec.size; i++) {
      if (!holoAt.has(i)) {
        regular();
        continue;
      }
      const tier = pick(HOLO_SLOT_TIER, rng, has);
      if (tier) push(tier, 'holo', 'chase');
    }
    return out;
  }

  if (type === 'perfect') {
    for (let i = 0; i < spec.size - PERFECT_CHASE_SLOTS; i++) regular();
    for (let i = 0; i < PERFECT_CHASE_SLOTS; i++) {
      if (has('legendary') && rng() < PERFECT_CHASE_HOLO_CHANCE) {
        push('legendary', 'holo', 'chase');
      } else {
        const tier = pick(PERFECT_CHASE_FALLBACK_TIER, rng, has) ?? pick(spec.tiers, rng, has);
        if (tier) push(tier, pick(PERFECT_CHASE_FALLBACK_FINISH, rng) ?? 'silver', 'chase');
      }
    }
    return out;
  }

  for (let i = 0; i < spec.size - 1; i++) regular();
  if (type === 'premium' && !out.some((c) => finishRank(c.finish) >= finishRank('silver'))) {
    const tier = pick(spec.tiers, rng, has)!;
    push(tier, pick(PREMIUM_GUARANTEE_FINISH[tier], rng)!, 'guarantee');
  } else if (type === 'elite' && !out.some((c) => tierRank(c.tier) >= tierRank('epic'))) {
    const tier = pick(ELITE_GUARANTEE_TIER, rng, has) ?? pick(spec.tiers, rng, has)!;
    push(tier, pick(spec.finishes[tier], rng)!, 'guarantee');
  } else {
    regular();
  }
  return out;
};

export interface PackCard extends RolledCard {
  /** This player was not in the binder before */
  isNew: boolean;
  /** The player was owned, but not in this art variant */
  newVariant: boolean;
  /** Better than the best finish owned before in this variant */
  upgrade: boolean;
  /** Same player, variant and finish owned, but not in this kit: a new kit, not a duplicate */
  newKit: boolean;
  /** Same player, Prizm finish owned, but not in this colour parallel: a new parallel, not a duplicate */
  newParallel: boolean;
  /** Same player, variant, finish, kit and parallel already owned: converted to shards */
  duplicate: boolean;
  shards: number;
  /** Provenance (Perfect Season packs) */
  mark?: string;
  /** The Autograph variant's autograph (already added to `autos`); previews attach a sample roll */
  auto?: OwnedAuto;
}

/** Freezes a pulled player's autograph snapshot (the Collection passes one built from the card pool and content). */
export type AutographFreezer = (player: Player) => AutographSnapshot | null;

/**
 * Opens one stored pack of `type`: rolls it, adds the cards, credits duplicate shards. Null when no
 * such pack is stored or the pool is empty. A card that rolls the Autograph variant is signed: its autograph is rolled
 * and frozen by `freeze` and added to `autos` (no freezer, or a player it can't describe: the card is a Locker stall).
 */
export const openPack = (type: PackType, pool: TierPool, freeze?: AutographFreezer, kits?: KitSource): PackCard[] | null => {
  const s = readCollection();
  if (packCount(s, type) <= 0) return null;
  const rolled = type === 'exchange' ? exchangeCards(s.exchange[0], pool, Math.random, kits) : rollPack(type, pool, Math.random, kits);
  if (!rolled.length) return null;
  const perfect = type === 'perfect' && !s.perfect[0]?.gift ? s.perfect[0] : undefined;
  const cards = { ...s.cards };
  const now = Date.now();
  let shards = s.shards + PACK_SHARDS[type];
  const autos: OwnedAuto[] = [];
  const out: PackCard[] = rolled.map((rc, i) => {
    const pc = applyPull(cards, rc, { type, now, index: i, freeze, kits, mark: perfect?.label });
    shards += pc.shards;
    if (pc.auto) autos.push(pc.auto);
    return pc;
  });
  const next: CollectionState = {
    ...s,
    cards,
    shards,
    ...(autos.length ? { autos: [...s.autos, ...autos] } : {}),
    opened: { ...s.opened, [type]: s.opened[type] + 1 },
    ...(type === 'perfect'
      ? { perfect: s.perfect.slice(1) }
      : type === 'exchange'
        ? { exchange: s.exchange.slice(1) }
        : { packs: { ...s.packs, [type]: s.packs[type] - 1 } }),
  };
  write(next, { kind: 'opened', type });
  return out;
};

/**
 * Adds one rolled card to `cards` (a copy the caller owns; mutated) exactly as a pack pull does: the Autograph signs
 * it (or falls back to a Locker stall), kits and Prizm parallels are recorded, a duplicate is worth shards. Returns the
 * PackCard (with its autograph, which the caller adds to `autos`, and its duplicate shards, which the caller credits).
 * openPack and the economy's trade-up (src/utils/economy.ts) both pull through here.
 */
export const applyPull = (
  cards: Record<string, OwnedCard>,
  rc: RolledCard,
  opts: { type: PackType; now: number; index: number; freeze?: AutographFreezer; kits?: KitSource; mark?: string },
): PackCard => {
  const { type, now, index: i, freeze, kits, mark } = opts;
  // The Autograph variant signs the card: freeze his career as of now and roll the autograph. A player the freezer
  // can't describe (or no freezer) falls back to the next rarest art, so the variant never exists without its autograph.
  const snap = rc.variant === 'auto' && freeze ? freeze(rc.player) : null;
  const c: RolledCard = rc.variant === 'auto' && !snap ? { ...rc, variant: 'locker', kit: kits ? rollKit(type, kits.of(rc.player.team), 'locker') : 'home' } : rc;
  const k = cardKey(c.player);
  const prev = cards[k];
  const pv = prev?.variants[c.variant];
  const owned = !!pv?.counts[c.finish];
  // Kits of this finish so far, the legacy sentinel resolved to the kit it stands for (this pull knows the player)
  const kitsHad: Record<string, number> = {};
  Object.entries(pv?.kits?.[c.finish] ?? {}).forEach(([id, n]) => {
    const real = id === LEGACY_KIT && kits ? kits.legacy(c.player, c.variant, c.finish) : id;
    kitsHad[real] = (kitsHad[real] ?? 0) + n;
  });
  if (owned && !Object.keys(kitsHad).length) kitsHad[kits ? kits.legacy(c.player, c.variant, c.finish) : LEGACY_KIT] = pv!.counts[c.finish]!;
  const kitOwned = c.variant === 'auto' ? owned : !!kitsHad[c.kit];
  // A parallel colour counts as owned once any copy of it is in this finish; a plain Prizm once the finish is owned
  const prizmHad = pv?.prizm?.[c.finish] ?? [];
  const parallelOwned = !c.prizm || prizmHad.some((x) => x.c === c.prizm!.c);
  const duplicate = owned && kitOwned && parallelOwned;
  const newKit = owned && !kitOwned;
  const newParallel = owned && !parallelOwned;
  const gain = duplicate ? duplicateShards(c.finish, c.tier) : 0;
  const upgrade = !!pv && finishRank(c.finish) > finishRank(pv.best);
  const marks = mark ? [...new Set([...(prev?.marks ?? []), mark])] : prev?.marks;
  const entry: VariantCard = {
    best: pv && finishRank(pv.best) >= finishRank(c.finish) ? pv.best : c.finish,
    counts: { ...pv?.counts, [c.finish]: (pv?.counts[c.finish] ?? 0) + 1 },
    first: pv?.first || now,
    last: now,
    ...(c.variant === 'auto' ? {} : { kits: { ...pv?.kits, [c.finish]: { ...kitsHad, [c.kit]: (kitsHad[c.kit] ?? 0) + 1 } } }),
    ...(c.prizm ? { prizm: { ...pv?.prizm, [c.finish]: [...prizmHad, { c: c.prizm.c, n: c.prizm.n }] } } : pv?.prizm ? { prizm: pv.prizm } : {}),
  };
  cards[k] = summarise({ ...prev?.variants, [c.variant]: entry }, marks);
  const auto: OwnedAuto | undefined = snap
    ? {
        id: `au-${now.toString(36)}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        key: k,
        pulledAt: now,
        pack: type,
        finish: c.finish,
        roll: rollAutograph(snap, Math.floor(Math.random() * 2 ** 32)),
        snap,
      }
    : undefined;
  return { ...c, isNew: !prev, newVariant: !!prev && !pv, upgrade, newKit, newParallel, duplicate, shards: gain, mark, ...(auto ? { auto } : {}) };
};

// ---------- Legends Exchange (one-time migration: NFL legends are no longer collectible) ----------

/** Cards of a stored Legends Exchange pack, resolved against the current pool (a player gone from it is replaced in his tier). */
const exchangeCards = (pack: ExchangePack | undefined, pool: TierPool, rng: Rng = Math.random, kits?: KitSource): RolledCard[] => {
  if (!pack) return [];
  const where = new Map<string, { player: Player; tier: Tier }>();
  TIERS.forEach(({ key: tier }) => pool[tier].forEach((player) => where.set(cardKey(player), { player, tier })));
  const taken = new Set(pack.cards.map((c) => c.key));
  return pack.cards
    .map((c): RolledCard | null => {
      const hit = where.get(c.key);
      // Rolled now, like any pull (the stored plan fixes only player, tier and finish)
      const variant = pick(variantWeights('exchange', c.tier, c.finish), rng) ?? LEGACY_VARIANT;
      const extras = (team: string | undefined): Pick<RolledCard, 'kit' | 'prizm'> => {
        const kit = kits ? rollKit('exchange', kits.of(team), variant, rng) : 'home';
        const prizm = rollPrizm('exchange', variant, rng);
        return { kit, ...(prizm ? { prizm } : {}) };
      };
      if (hit) return { player: hit.player, tier: hit.tier, finish: c.finish, variant, ...extras(hit.player.team), slot: 'chase' };
      const list = pool[c.tier].filter((p) => !taken.has(cardKey(p)));
      const player = list[Math.floor(rng() * list.length)];
      if (!player) return null;
      taken.add(cardKey(player));
      return { player, tier: c.tier, finish: c.finish, variant, ...extras(player.team), slot: 'chase' };
    })
    .filter((c): c is RolledCard => !!c)
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || finishRank(a.finish) - finishRank(b.finish));
};

/** A legend card being retired: its key, the tier it had as a legend, and the best finish owned. */
export interface RetiredLegend {
  key: string;
  position: string;
  tier: Tier;
}

/**
 * One-time migration for saves from when real NFL legends were collectible. Removes every owned card whose key
 * is in `legends` and adds one Legends Exchange pack holding, per removed card, a league card of the same tier
 * and the same (best) finish: a random league player of that tier and position when possible, else of that tier,
 * preferring players not owned yet. The plan is stored, so reloading never rerolls or duplicates it.
 * Returns the number of legend cards exchanged (0 when there was nothing to do).
 */
export const exchangeLegends = (legends: Map<string, RetiredLegend>, pool: TierPool, rng: Rng = Math.random): number => {
  const s = readCollection();
  const retired = Object.keys(s.cards).filter((k) => legends.has(k));
  if (!retired.length) return 0;
  const owned = new Set(Object.keys(s.cards).filter((k) => !legends.has(k)));
  const planned = new Set<string>();
  const choose = (list: Player[]) => {
    const fresh = list.filter((p) => !owned.has(cardKey(p)) && !planned.has(cardKey(p)));
    const notPlanned = list.filter((p) => !planned.has(cardKey(p)));
    const from = fresh.length ? fresh : notPlanned.length ? notPlanned : list;
    return from.length ? from[Math.floor(rng() * from.length)] : undefined;
  };
  const cards: ExchangeCard[] = [];
  // Best cards first, so they get first pick of unowned players
  const order = retired
    .map((k) => ({ k, legend: legends.get(k)!, finish: s.cards[k].best }))
    .sort((a, b) => tierRank(b.legend.tier) - tierRank(a.legend.tier) || finishRank(b.finish) - finishRank(a.finish));
  order.forEach(({ k, legend, finish }) => {
    // Same tier (same position first); if the tier is empty, the nearest lower tier, then higher
    const tiers = [...TIERS.map((t) => t.key)].sort((a, b) => {
      const da = tierRank(a) - tierRank(legend.tier);
      const db = tierRank(b) - tierRank(legend.tier);
      return (da > 0 ? 10 + da : -da) - (db > 0 ? 10 + db : -db);
    });
    for (const tier of tiers) {
      const p = choose(pool[tier].filter((x) => x.position === legend.position)) ?? choose(pool[tier]);
      if (p) {
        planned.add(cardKey(p));
        cards.push({ key: cardKey(p), tier, finish, from: k });
        return;
      }
    }
  });
  if (!cards.length) return 0;
  const at = Date.now();
  const nextCards = { ...s.cards };
  retired.forEach((k) => delete nextCards[k]);
  const pack: ExchangePack = { id: `ex-${at}-${Math.random().toString(36).slice(2, 8)}`, label: PACKS.exchange.label, at, cards };
  write(
    {
      ...s,
      cards: nextCards,
      exchange: [...s.exchange, pack],
      earned: [{ type: 'exchange' as const, reason: `${retired.length} NFL legend card${retired.length === 1 ? '' : 's'} exchanged`, at }, ...s.earned].slice(0, EARNED_CAP),
    },
    { kind: 'other' },
  );
  return retired.length;
};

/** Crafts one owned variant of a card up to its next finish with shards. Returns the new finish, or null. */
export const craftUpgrade = (p: Pick<Player, 'name' | 'position'>, tier: Tier, variant: Variant): Finish | null => {
  const s = readCollection();
  const k = cardKey(p);
  const card = s.cards[k];
  const v = card?.variants[variant];
  const to = v && isCraftable(variant) && nextFinish(v.best);
  if (!card || !v || !to) return null;
  const cost = craftCost(to, tier, variant);
  if (s.shards < cost) return null;
  // A crafted copy wears the home kit (kits are pulled, never crafted)
  const had = v.kits?.[to] ?? (v.counts[to] ? { [LEGACY_KIT]: v.counts[to]! } : {});
  const entry: VariantCard = {
    ...v,
    best: to,
    counts: { ...v.counts, [to]: (v.counts[to] ?? 0) + 1 },
    last: Date.now(),
    kits: { ...v.kits, [to]: { ...had, home: (had.home ?? 0) + 1 } },
  };
  write(
    { ...s, shards: s.shards - cost, cards: { ...s.cards, [k]: summarise({ ...card.variants, [variant]: entry }, card.marks) } },
    { kind: 'crafted', key: k, finish: to, variant },
  );
  return to;
};

/** Sets (or with null clears, back to auto) the variant × finish a player's card displays. Only owned combos. */
export const setDisplay = (p: Pick<Player, 'name' | 'position'>, choice: DisplayChoice | null): boolean => {
  const s = readCollection();
  const k = cardKey(p);
  if (choice && !ownsCombo(s.cards[k], choice.variant, choice.finish)) return false;
  const display = { ...s.display };
  if (choice)
    display[k] = {
      variant: choice.variant,
      finish: choice.finish,
      ...(choice.kit ? { kit: choice.kit } : {}),
      ...(choice.variant === 'number' && choice.parallel ? { parallel: choice.parallel } : {}),
    };
  else delete display[k];
  const next: CollectionState = { ...s };
  if (Object.keys(display).length) next.display = display;
  else delete next.display;
  write(next, { kind: 'other' });
  return true;
};

/**
 * Claims a chosen player's Base card with shards (CLAIM_COST by tier; a "Legend claim" for a Legendary player), in
 * the most common art variant he is still missing (claimVariant). Returns the variant added, or null.
 */
export const claimCard = (p: Pick<Player, 'name' | 'position'>, tier: Tier): Variant | null => {
  const s = readCollection();
  const k = cardKey(p);
  const card = s.cards[k];
  const variant = claimVariant(card);
  const cost = claimCost(tier);
  if (!variant || s.shards < cost) return null;
  const now = Date.now();
  // Claimed cards wear the home kit (kits are pulled, never bought)
  const entry: VariantCard = { best: 'base', counts: { base: 1 }, first: now, last: now, kits: { base: { home: 1 } } };
  write(
    { ...s, shards: s.shards - cost, cards: { ...s.cards, [k]: summarise({ ...card?.variants, [variant]: entry }, card?.marks) } },
    { kind: 'claimed', key: k, variant },
  );
  return variant;
};

/**
 * Expected duplicate shards from one pack of `type` for this binder: for every tier × finish × variant a card can
 * roll, the share of that tier's players already owned in that exact variant × finish, times its shard value, plus
 * the flat PACK_SHARDS. Used
 * for "about N packs to go" next to claims and upgrades (an estimate: it ignores the no-repeat rule within a pack).
 */
export const expectedShardsPerPack = (type: EarnablePack, cards: Record<string, OwnedCard>, pool: Record<Tier, string[]>): number => {
  const j = expectedJoint(type);
  let perCard = 0;
  TIERS.forEach(({ key: t }) => {
    const keys = pool[t];
    if (!keys.length) return;
    FINISHES.forEach(({ key: f }) => {
      if (!j[t][f]) return;
      const pv = norm(variantWeights(type, t, f));
      VARIANTS.forEach(({ key: v }) => {
        const have = keys.reduce((n, k) => n + dupeChance(type, cards[k]?.variants[v], v, f), 0);
        perCard += j[t][f] * pv(v) * (have / keys.length) * duplicateShards(f, t);
      });
    });
  });
  return perCard * PACKS[type].size + PACK_SHARDS[type];
};

/**
 * Chance a pull of this variant × finish duplicates a kit already owned (an estimate: it doesn't know the card's
 * club, so it assumes the club has every kind of kit and up to two alternates). The Autograph has no kits.
 */
const dupeChance = (type: PackType, vc: VariantCard | undefined, v: Variant, f: Finish): number => {
  if (!vc?.counts[f]) return 0;
  if (v === 'auto') return 1;
  const o = KIT_ODDS[type];
  const ids = Object.keys(vc.kits?.[f] ?? { [LEGACY_KIT]: 1 });
  const alts = ids.filter((id) => id !== 'home' && id !== LEGACY_KIT && !id.startsWith('era')).length;
  // A Prizm duplicate also needs the parallel it rolls owned there (plain always is, once the finish is)
  const owned = new Set((vc.prizm?.[f] ?? []).map((x) => x.c));
  const par = v === 'number' ? 1 - prizmAnyChance(type) + PRIZM_PARALLELS.reduce((a, p) => a + (owned.has(p.key) ? PRIZM_ODDS[type][p.key] : 0), 0) : 1;
  return (
    ((ids.includes('home') || ids.includes(LEGACY_KIT) ? 1 - o.alt - o.era : 0) +
      (ids.some((id) => id.startsWith('era')) ? o.era : 0) +
      o.alt * Math.min(1, alts / 2)) *
    par
  );
};

/** "about 12 Standard packs to go" (null when the shards are already there). */
export const packsToGo = (need: number, have: number, perPack: number): string | null => {
  if (have >= need) return null;
  if (perPack <= 0) return 'keep opening packs';
  const n = Math.ceil((need - have) / perPack);
  return `about ${n.toLocaleString()} Standard pack${n === 1 ? '' : 's'} to go`;
};

// ---------- Expected odds (exact, per card; all tiers assumed non-empty) ----------

type Joint = Record<Tier, Record<Finish, number>>;
const zero = (): Joint => ({
  common: { base: 0, silver: 0, gold: 0, holo: 0 },
  rare: { base: 0, silver: 0, gold: 0, holo: 0 },
  epic: { base: 0, silver: 0, gold: 0, holo: 0 },
  legendary: { base: 0, silver: 0, gold: 0, holo: 0 },
});
const norm = <K extends string>(w: Record<K, number>) => {
  const t = Object.values<number>(w).reduce((a, b) => a + b, 0);
  return (k: K) => (t ? w[k] / t : 0);
};
const jointOf = (tiers: Weights<Tier>, finish: (t: Tier) => Weights<Finish>): Joint => {
  const j = zero();
  const pt = norm(tiers);
  TIERS.forEach(({ key: t }) => {
    const pf = norm(finish(t));
    FINISHES.forEach(({ key: f }) => (j[t][f] = pt(t) * pf(f)));
  });
  return j;
};
const mix = (parts: [number, Joint][]): Joint => {
  const j = zero();
  parts.forEach(([w, p]) => TIERS.forEach(({ key: t }) => FINISHES.forEach(({ key: f }) => (j[t][f] += w * p[t][f]))));
  return j;
};
const sum = (j: Joint, test: (t: Tier, f: Finish) => boolean) =>
  TIERS.reduce((s, { key: t }) => s + FINISHES.reduce((a, { key: f }) => a + (test(t, f) ? j[t][f] : 0), 0), 0);

/** Exact per-card probability of each tier × finish for a pack type (average over its slots). */
export const expectedJoint = (type: EarnablePack): Joint => {
  const spec = PACKS[type];
  const regular = jointOf(spec.tiers, (t) => spec.finishes[t]);
  const n = spec.size;
  if (type === 'standard') return regular;
  if (type === 'holo') {
    const holoSlot = jointOf(HOLO_SLOT_TIER, () => ({ base: 0, silver: 0, gold: 0, holo: 1 }));
    return mix([
      [HOLO_PACK_SLOTS / n, holoSlot],
      [(n - HOLO_PACK_SLOTS) / n, regular],
    ]);
  }
  if (type === 'premium') {
    const miss = (1 - sum(regular, (_, f) => finishRank(f) >= 1)) ** (n - 1);
    const last = mix([
      [1 - miss, regular],
      [miss, jointOf(spec.tiers, (t) => PREMIUM_GUARANTEE_FINISH[t])],
    ]);
    return mix([
      [(n - 1) / n, regular],
      [1 / n, last],
    ]);
  }
  if (type === 'elite') {
    const miss = (1 - sum(regular, (t) => tierRank(t) >= 2)) ** (n - 1);
    const last = mix([
      [1 - miss, regular],
      [miss, jointOf(ELITE_GUARANTEE_TIER, (t) => spec.finishes[t])],
    ]);
    return mix([
      [(n - 1) / n, regular],
      [1 / n, last],
    ]);
  }
  const chaseHolo = zero();
  chaseHolo.legendary.holo = 1;
  const chase = mix([
    [PERFECT_CHASE_HOLO_CHANCE, chaseHolo],
    [1 - PERFECT_CHASE_HOLO_CHANCE, jointOf(PERFECT_CHASE_FALLBACK_TIER, () => PERFECT_CHASE_FALLBACK_FINISH)],
  ]);
  return mix([
    [(n - PERFECT_CHASE_SLOTS) / n, regular],
    [PERFECT_CHASE_SLOTS / n, chase],
  ]);
};

export interface OddsSummary {
  tiers: Record<Tier, number>;
  finishes: Record<Finish, number>;
  /** Per card, averaged over the tier × finish it rolls (VARIANT_STACK) */
  variants: Record<Variant, number>;
  legendaryHolo: number;
  /** Per card: the rarest art (the Autograph) × Holo at any tier */
  rarestHolo: number;
  /** Per card: the rarest art × Holo × Legendary, the rarest card there is */
  rarestLegendaryHolo: number;
  /**
   * Per card, for a club with both kinds of kit: a modern alternate, an era kit (both KIT_ODDS on every card but the
   * Autograph), and an era kit on a Holo or a Legendary-tier card.
   */
  kits: { alt: number; era: number; eraHoloOrLegendary: number };
  /** Per card: each Prizm colour parallel (the Prizm share × PRIZM_ODDS), and any parallel */
  parallels: Record<PrizmParallel, number> & { any: number };
}
/** Per-card odds for a pack type: by tier, by finish, and Legendary-tier Holo. */
export const packOdds = (type: EarnablePack): OddsSummary => {
  const j = expectedJoint(type);
  const tiers = Object.fromEntries(TIERS.map(({ key: t }) => [t, sum(j, (x) => x === t)])) as Record<Tier, number>;
  const finishes = Object.fromEntries(FINISHES.map(({ key: f }) => [f, sum(j, (_, y) => y === f)])) as Record<Finish, number>;
  const variants = Object.fromEntries(VARIANTS.map(({ key: v }) => [v, 0])) as Record<Variant, number>;
  TIERS.forEach(({ key: t }) =>
    FINISHES.forEach(({ key: f }) => {
      const pv = norm(variantWeights(type, t, f));
      VARIANTS.forEach(({ key: v }) => (variants[v] += j[t][f] * pv(v)));
    }),
  );
  const rarest = VARIANTS[VARIANTS.length - 1].key;
  const rarestHoloAt = (t: Tier) => j[t].holo * norm(variantWeights(type, t, 'holo'))(rarest);
  const rarestHolo = TIERS.reduce((a, { key: t }) => a + rarestHoloAt(t), 0);
  const rarestLegendaryHolo = rarestHoloAt('legendary');
  const o = KIT_ODDS[type];
  const kitted = 1 - variants.auto;
  const eraHoloOrLegendary = TIERS.reduce(
    (a, { key: t }) =>
      a + FINISHES.reduce((b, { key: f }) => b + (t === 'legendary' || f === 'holo' ? j[t][f] * (1 - norm(variantWeights(type, t, f))('auto')) * o.era : 0), 0),
    0,
  );
  return {
    tiers,
    finishes,
    variants,
    legendaryHolo: j.legendary.holo,
    rarestHolo,
    rarestLegendaryHolo,
    kits: { alt: kitted * o.alt, era: kitted * o.era, eraHoloOrLegendary },
    parallels: {
      ...(Object.fromEntries(PRIZM_PARALLELS.map((p) => [p.key, variants.number * PRIZM_ODDS[type][p.key]])) as Record<PrizmParallel, number>),
      any: variants.number * prizmAnyChance(type),
    },
  };
};

// ---------- React ----------

const subscribe = (onChange: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    memory = null;
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
};

// ---------- Pending reveal: hide a pack's cards from the UI until they are revealed ----------

/*
 * openPack commits the cards to storage at once (a reload or a device sync mid-pack never loses them), but the
 * Collection UI must not show them before the flips. While a pack is open, PackOpening holds a reveal: useCollection
 * then serves the pre-pack snapshot (cards, shards, marks, display choices) with only the unopened-pack counts live,
 * so the binder, Best pulls, sets, tier counts, the shard workshop and the market behind the dialog can't spoil the
 * pull. endReveal (at the summary, or when the dialog closes, whichever is first) lets the live state through and
 * remembers which players changed, for a short "new cards" highlight in the binder.
 */
let revealSnapshot: CollectionState | null = null;
let viewCache: { live: CollectionState; snap: CollectionState; view: CollectionState } | null = null;
let revealed: { keys: Set<string>; until: number } | null = null;
let revealTimer: ReturnType<typeof setTimeout> | undefined;
/** How long the binder highlights the cards a pack added. */
export const REVEAL_HIGHLIGHT_MS = 4000;

const notify = () => {
  try {
    window.dispatchEvent(new CustomEvent<CollectionChange>(CHANGE_EVENT, { detail: { kind: 'other' } }));
  } catch {
    // Non-browser environment
  }
};

/** Starts hiding the next pack's cards (call just before openPack). Nested calls keep the first snapshot. */
export const beginReveal = () => {
  if (revealSnapshot) return;
  revealSnapshot = readCollection();
};

/** Shows the pack's cards (summary reached, or the pack dialog closed); idempotent. */
export const endReveal = () => {
  const before = revealSnapshot;
  if (!before) return;
  revealSnapshot = null;
  viewCache = null;
  const live = readCollection();
  const keys = new Set(
    Object.keys(live.cards).filter((k) => {
      const a = before.cards[k];
      const b = live.cards[k];
      return !a || a.last !== b.last;
    }),
  );
  if (keys.size) {
    revealed = { keys, until: Date.now() + REVEAL_HIGHLIGHT_MS };
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      revealed = null;
      notify();
    }, REVEAL_HIGHLIGHT_MS);
  }
  notify();
};

/** True while a pack's cards are hidden from the UI. */
export const revealPending = () => revealSnapshot != null;

/** What the UI shows: the live state, or during a pending reveal the pre-pack snapshot with live pack counts. */
const readView = (): CollectionState => {
  const live = readCollection();
  const snap = revealSnapshot;
  if (!snap) return live;
  if (viewCache && viewCache.live === live && viewCache.snap === snap) return viewCache.view;
  const view: CollectionState = { ...snap, packs: live.packs, perfect: live.perfect, exchange: live.exchange, opened: live.opened, earned: live.earned, gifts: live.gifts, daily: live.daily };
  viewCache = { live, snap, view };
  return view;
};

/**
 * Collection state for the UI (updates on every change, including from other tabs). During a pending reveal it is
 * the pre-pack snapshot (see beginReveal); `fresh` holds the players a just-revealed pack added or changed.
 */
export const useCollection = () => {
  const state = useSyncExternalStore(subscribe, readView, () => EMPTY);
  const fresh = revealed && revealed.until > Date.now() ? revealed.keys : null;
  return { state, cards: state.cards, packs: packTotal(state), fresh };
};
