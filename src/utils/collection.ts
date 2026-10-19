import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { Player } from '@/types/player';
import { LEGACY_TIERS, isHallOfFamer } from '@/config/stats';
import { playerKey } from '@/config/ovr';

/**
 * Player card collection, v2: reward packs.
 *
 * A card is a player plus a FINISH (Base, Silver, Gold, Holo). Games never hand out a specific card:
 * they award reward PACKS through awardPack(), and every card comes from opening one on the
 * Collection tab. A pull is two rolls: which player (weighted by the player's TIER, so better players
 * are rarer), then which finish (Holo rarest, and rarer still for top tiers). Duplicates turn into
 * shards that craft finish upgrades.
 *
 * State is per browser, in localStorage under STORAGE_KEY; every write fires CHANGE_EVENT so open
 * views update live. v1 (STORAGE_KEY_V1, one fixed rarity per player, cards granted directly by
 * game events) is discarded on first load and the Collection tab shows a one-time notice.
 */

export const STORAGE_KEY = 'retroVault:collection:v2';
export const STORAGE_KEY_V1 = 'retroVault:collection';
/** window CustomEvent fired after every write; detail is a CollectionChange. */
export const CHANGE_EVENT = 'retroVault:collection';

// ---------- Tiers (which player) ----------

export type Tier = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * Player tiers. Legendary is the league's legacy elite only, the best of the best:
 *   Legendary  league players in the LEGENDARY legacy tier (Career Legacy ≥ LEGENDARY_MIN_LEGACY,
 *              getLegacyTier in src/config/stats.ts), plus real NFL legends rated
 *              ≥ LEGEND_LEGENDARY_MIN_OVR official OVR (about ten of them)
 *   Epic       every other Hall of Famer and real NFL legend, and anyone with OVR ≥ EPIC_MIN_OVR
 *   Rare       OVR ≥ RARE_MIN_OVR
 *   Common     everyone else, or OVR unknown
 */
export const LEGENDARY_MIN_LEGACY = LEGACY_TIERS.find((t) => t.key === 'legendary')!.min;
export const LEGEND_LEGENDARY_MIN_OVR = 93;
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

export const tierFor = (player: Player & { isRealLegend?: boolean }, ovr: number | null | undefined): Tier => {
  if (player.isRealLegend) return ovr != null && ovr >= LEGEND_LEGENDARY_MIN_OVR ? 'legendary' : 'epic';
  if (player.careerLegacy >= LEGENDARY_MIN_LEGACY) return 'legendary';
  if (isHallOfFamer(player) || (ovr != null && ovr >= EPIC_MIN_OVR)) return 'epic';
  if (ovr != null && ovr >= RARE_MIN_OVR) return 'rare';
  return 'common';
};

// ---------- Finishes (which version) ----------

export type Finish = 'base' | 'silver' | 'gold' | 'holo';

/** Lowest to highest. Real NFL legends wear a black-gold Legend frame as their Base look. */
export const FINISHES: { key: Finish; label: string }[] = [
  { key: 'base', label: 'Base' },
  { key: 'silver', label: 'Silver' },
  { key: 'gold', label: 'Gold' },
  { key: 'holo', label: 'Holo' },
];
export const finishLabel = (f: Finish) => FINISHES.find((x) => x.key === f)!.label;
export const finishRank = (f: Finish) => FINISHES.findIndex((x) => x.key === f);

// ---------- Packs and odds ----------

export type PackType = 'standard' | 'premium' | 'elite' | 'perfect';
/** Packs stored as a plain count (the Perfect Season pack is stored one by one, with provenance). */
export type CountedPack = Exclude<PackType, 'perfect'>;

type Weights<K extends string> = Record<K, number>;
type FinishTable = Record<Tier, Weights<Finish>>;

export interface PackSpec {
  label: string;
  size: number;
  /** Relative odds of each player tier per regular slot */
  tiers: Weights<Tier>;
  /** Relative odds of each finish per regular slot, by the tier that slot rolled */
  finishes: FinishTable;
  /** One-line summary of the guarantees, shown on the odds table */
  guarantee: string;
}

/**
 * Standard pack odds are the baseline (targets, per card: Legendary-tier player ≤ 3%, Holo ≤ 2%,
 * Legendary-tier Holo ≤ 0.1%). Premium and Elite raise them, never above about 3× the baseline.
 */
export const PACKS: Record<PackType, PackSpec> = {
  standard: {
    label: 'Standard Pack',
    size: 3,
    tiers: { common: 70, rare: 22, epic: 5.5, legendary: 2.5 },
    finishes: {
      common: { base: 64, silver: 24, gold: 10, holo: 2 },
      rare: { base: 66, silver: 23, gold: 9.5, holo: 1.5 },
      epic: { base: 70, silver: 21, gold: 8, holo: 1 },
      legendary: { base: 75, silver: 18, gold: 6, holo: 1 },
    },
    guarantee: '3 cards. No guarantees.',
  },
  premium: {
    label: 'Premium Pack',
    size: 4,
    tiers: { common: 55, rare: 32, epic: 10, legendary: 3 },
    finishes: {
      common: { base: 60, silver: 25, gold: 12.5, holo: 2.5 },
      rare: { base: 62, silver: 24, gold: 12, holo: 2 },
      epic: { base: 66, silver: 22, gold: 10.5, holo: 1.5 },
      legendary: { base: 72, silver: 20, gold: 7, holo: 1 },
    },
    guarantee: '4 cards. At least one Gold-or-better finish (the last card is upgraded if needed).',
  },
  elite: {
    label: 'Elite Pack',
    size: 5,
    tiers: { common: 42, rare: 35, epic: 17, legendary: 6 },
    finishes: {
      common: { base: 56, silver: 25, gold: 14, holo: 5 },
      rare: { base: 58, silver: 24, gold: 14, holo: 4 },
      epic: { base: 62, silver: 22, gold: 13, holo: 3 },
      legendary: { base: 69, silver: 20, gold: 10, holo: 1 },
    },
    guarantee: '5 cards. At least one Epic-or-better player (the last card is upgraded if needed).',
  },
  perfect: {
    label: 'Perfect Season Pack',
    size: 5,
    // The two regular slots use Elite odds; the three chase slots follow PERFECT_CHASE_*
    tiers: { common: 42, rare: 35, epic: 17, legendary: 6 },
    finishes: {
      common: { base: 56, silver: 25, gold: 14, holo: 5 },
      rare: { base: 58, silver: 24, gold: 14, holo: 4 },
      epic: { base: 62, silver: 22, gold: 13, holo: 3 },
      legendary: { base: 69, silver: 20, gold: 10, holo: 1 },
    },
    guarantee: '5 cards: 2 at Elite odds, then 3 chase cards, each a Legendary Holo or else an Epic-or-better Gold.',
  },
};

export const PACK_ORDER: PackType[] = ['standard', 'premium', 'elite', 'perfect'];

/** Premium: finish odds for the last card when the first three had no Gold or Holo. */
export const PREMIUM_GUARANTEE_FINISH: FinishTable = {
  common: { base: 0, silver: 0, gold: 97, holo: 3 },
  rare: { base: 0, silver: 0, gold: 97, holo: 3 },
  epic: { base: 0, silver: 0, gold: 98, holo: 2 },
  legendary: { base: 0, silver: 0, gold: 99, holo: 1 },
};
/** Elite: tier odds for the last card when the first four had no Epic or Legendary player. */
export const ELITE_GUARANTEE_TIER: Weights<Tier> = { common: 0, rare: 0, epic: 85, legendary: 15 };

/** Perfect Season pack: chase slots, each a Legendary-tier Holo with this chance… */
export const PERFECT_CHASE_SLOTS = 3;
export const PERFECT_CHASE_HOLO_CHANCE = 0.23;
/** …and otherwise a Gold card of an Epic-or-better player rolled from these tier odds. */
export const PERFECT_CHASE_FALLBACK_TIER: Weights<Tier> = { common: 0, rare: 0, epic: 80, legendary: 20 };
export const PERFECT_CHASE_FALLBACK_FINISH: Finish = 'gold';

/** Shards from a duplicate (same player and finish already owned), by finish. */
export const DUPLICATE_SHARDS: Weights<Finish> = { base: 5, silver: 10, gold: 25, holo: 100 };
/** Shards to craft a card up to the next finish (× CRAFT_TIER_MULTIPLIER for the player's tier). */
export const CRAFT_COST: Record<Exclude<Finish, 'base'>, number> = { silver: 40, gold: 120, holo: 900 };
export const CRAFT_TIER_MULTIPLIER: Weights<Tier> = { common: 1, rare: 1.5, epic: 2, legendary: 4 };

export const craftCost = (to: Exclude<Finish, 'base'>, tier: Tier) => Math.round(CRAFT_COST[to] * CRAFT_TIER_MULTIPLIER[tier]);
export const nextFinish = (f: Finish): Exclude<Finish, 'base'> | null => (f === 'base' ? 'silver' : f === 'silver' ? 'gold' : f === 'gold' ? 'holo' : null);

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

export interface OwnedCard {
  /** Best finish owned */
  best: Finish;
  /** Copies pulled (or crafted) per finish */
  counts: Partial<Record<Finish, number>>;
  /** First pull and latest pull (ms since epoch) */
  first: number;
  last: number;
  /** Provenance badges, e.g. "18–0 · Bills · Oct 19, 2026" for cards from a Perfect Season pack */
  marks?: string[];
}

export interface PerfectPack {
  id: string;
  /** Provenance label stamped on the pack and every card pulled from it */
  label: string;
  at: number;
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
  shards: number;
  /** Packs opened so far, by type */
  opened: Record<PackType, number>;
  /** Most recent awards, newest first (capped) */
  earned: EarnedPack[];
  /** A v1 collection was found and discarded on this browser */
  migrated?: boolean;
  /** The one-time "new system" notice was dismissed */
  noticeSeen?: boolean;
}

export type CollectionChange =
  | { kind: 'earned'; type: PackType; reason: string; label?: string }
  | { kind: 'opened'; type: PackType }
  | { kind: 'crafted'; key: string; finish: Finish }
  | { kind: 'other' };

const EARNED_CAP = 30;
const fresh = (): CollectionState => ({
  v: 2,
  cards: {},
  packs: { standard: 0, premium: 0, elite: 0 },
  perfect: [],
  shards: 0,
  opened: { standard: 0, premium: 0, elite: 0, perfect: 0 },
  earned: [],
});
const EMPTY: CollectionState = fresh();
let memory: CollectionState | null = null;

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
const isFinish = (x: unknown): x is Finish => FINISHES.some((f) => f.key === x);
const isPack = (x: unknown): x is PackType => PACK_ORDER.includes(x as PackType);

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
      if (!/^[A-Z]{2}:.+/.test(k) || !e || typeof e !== 'object' || !isFinish(e.best)) return;
      const counts: Partial<Record<Finish, number>> = {};
      FINISHES.forEach(({ key }) => {
        const n = num(e.counts?.[key]);
        if (n) counts[key] = n;
      });
      if (!counts[e.best]) counts[e.best] = 1;
      const marks = Array.isArray(e.marks) ? e.marks.filter((m): m is string => typeof m === 'string') : [];
      s.cards[k] = { best: e.best, counts, first: num(e.first), last: num(e.last), ...(marks.length ? { marks } : {}) };
    });
    (['standard', 'premium', 'elite'] as const).forEach((t) => (s.packs[t] = num(d.packs?.[t])));
    PACK_ORDER.forEach((t) => (s.opened[t] = num(d.opened?.[t])));
    s.perfect = (Array.isArray(d.perfect) ? d.perfect : []).filter(
      (p): p is PerfectPack => !!p && typeof p.id === 'string' && typeof p.label === 'string',
    );
    s.shards = num(d.shards);
    s.earned = (Array.isArray(d.earned) ? d.earned : []).filter((e): e is EarnedPack => !!e && isPack(e.type) && typeof e.reason === 'string').slice(0, EARNED_CAP);
    s.migrated = !!d.migrated;
    s.noticeSeen = !!d.noticeSeen;
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

const write = (next: CollectionState, change: CollectionChange) => {
  memory = next;
  persist(next);
  try {
    window.dispatchEvent(new CustomEvent<CollectionChange>(CHANGE_EVENT, { detail: change }));
  } catch {
    // Non-browser environment
  }
};

export const cardKey = (p: Pick<Player, 'name' | 'position'>) => playerKey(p);
export const isOwned = (p: Pick<Player, 'name' | 'position'>, state = readCollection()) => !!state.cards[cardKey(p)];

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

export const packTotal = (s: CollectionState) => s.packs.standard + s.packs.premium + s.packs.elite + s.perfect.length;
export const packCount = (s: CollectionState, t: PackType) => (t === 'perfect' ? s.perfect.length : s.packs[t]);

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
export const awardPack = (type: PackType, reason: string, opts: AwardOptions = {}): boolean => {
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

// ---------- Rolling ----------

export type Rng = () => number;

const pick = <K extends string>(weights: Partial<Record<K, number>>, rng: Rng, allowed?: (k: K) => boolean): K | null => {
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

export interface RolledCard {
  player: Player;
  tier: Tier;
  finish: Finish;
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
 * has others), then a finish. Guarantees apply to the last slot only when still unmet.
 */
export const rollPack = (type: PackType, pool: TierPool, rng: Rng = Math.random): RolledCard[] => {
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
  const push = (tier: Tier, finish: Finish, slot: RolledCard['slot']) => out.push({ player: playerOf(tier), tier, finish, slot });
  const regular = () => {
    const tier = pick(spec.tiers, rng, has);
    if (!tier) return;
    push(tier, pick(spec.finishes[tier], rng)!, 'regular');
  };

  if (!TIERS.some((t) => has(t.key))) return out;

  if (type === 'perfect') {
    for (let i = 0; i < spec.size - PERFECT_CHASE_SLOTS; i++) regular();
    for (let i = 0; i < PERFECT_CHASE_SLOTS; i++) {
      if (has('legendary') && rng() < PERFECT_CHASE_HOLO_CHANCE) {
        push('legendary', 'holo', 'chase');
      } else {
        const tier = pick(PERFECT_CHASE_FALLBACK_TIER, rng, has) ?? pick(spec.tiers, rng, has);
        if (tier) push(tier, PERFECT_CHASE_FALLBACK_FINISH, 'chase');
      }
    }
    return out;
  }

  for (let i = 0; i < spec.size - 1; i++) regular();
  if (type === 'premium' && !out.some((c) => finishRank(c.finish) >= finishRank('gold'))) {
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
  /** Better than the best finish owned before */
  upgrade: boolean;
  /** Same player and finish already owned: converted to shards */
  duplicate: boolean;
  shards: number;
  /** Provenance (Perfect Season packs) */
  mark?: string;
}

/**
 * Opens one stored pack of `type`: rolls it, adds the cards, credits duplicate shards. Null when no
 * such pack is stored or the pool is empty.
 */
export const openPack = (type: PackType, pool: TierPool): PackCard[] | null => {
  const s = readCollection();
  if (packCount(s, type) <= 0) return null;
  const rolled = rollPack(type, pool);
  if (!rolled.length) return null;
  const perfect = type === 'perfect' ? s.perfect[0] : undefined;
  const cards = { ...s.cards };
  const now = Date.now();
  let shards = s.shards;
  const out: PackCard[] = rolled.map((c) => {
    const k = cardKey(c.player);
    const prev = cards[k];
    const duplicate = !!prev?.counts[c.finish];
    const gain = duplicate ? DUPLICATE_SHARDS[c.finish] : 0;
    shards += gain;
    const upgrade = !!prev && finishRank(c.finish) > finishRank(prev.best);
    const marks = perfect ? [...new Set([...(prev?.marks ?? []), perfect.label])] : prev?.marks;
    cards[k] = {
      best: prev && finishRank(prev.best) >= finishRank(c.finish) ? prev.best : c.finish,
      counts: { ...prev?.counts, [c.finish]: (prev?.counts[c.finish] ?? 0) + 1 },
      first: prev?.first ?? now,
      last: now,
      ...(marks?.length ? { marks } : {}),
    };
    return { ...c, isNew: !prev, upgrade, duplicate, shards: gain, mark: perfect?.label };
  });
  const next: CollectionState = {
    ...s,
    cards,
    shards,
    opened: { ...s.opened, [type]: s.opened[type] + 1 },
    ...(type === 'perfect' ? { perfect: s.perfect.slice(1) } : { packs: { ...s.packs, [type]: s.packs[type] - 1 } }),
  };
  write(next, { kind: 'opened', type });
  return out;
};

/** Crafts an owned card up to its next finish with shards. Returns the new finish, or null. */
export const craftUpgrade = (p: Pick<Player, 'name' | 'position'>, tier: Tier): Finish | null => {
  const s = readCollection();
  const k = cardKey(p);
  const card = s.cards[k];
  const to = card && nextFinish(card.best);
  if (!card || !to) return null;
  const cost = craftCost(to, tier);
  if (s.shards < cost) return null;
  write(
    {
      ...s,
      shards: s.shards - cost,
      cards: { ...s.cards, [k]: { ...card, best: to, counts: { ...card.counts, [to]: (card.counts[to] ?? 0) + 1 }, last: Date.now() } },
    },
    { kind: 'crafted', key: k, finish: to },
  );
  return to;
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
export const expectedJoint = (type: PackType): Joint => {
  const spec = PACKS[type];
  const regular = jointOf(spec.tiers, (t) => spec.finishes[t]);
  const n = spec.size;
  if (type === 'standard') return regular;
  if (type === 'premium') {
    const miss = (1 - sum(regular, (_, f) => finishRank(f) >= 2)) ** (n - 1);
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
    [1 - PERFECT_CHASE_HOLO_CHANCE, jointOf(PERFECT_CHASE_FALLBACK_TIER, () => ({ base: 0, silver: 0, gold: 1, holo: 0 }))],
  ]);
  return mix([
    [(n - PERFECT_CHASE_SLOTS) / n, regular],
    [PERFECT_CHASE_SLOTS / n, chase],
  ]);
};

export interface OddsSummary {
  tiers: Record<Tier, number>;
  finishes: Record<Finish, number>;
  legendaryHolo: number;
}
/** Per-card odds for a pack type: by tier, by finish, and Legendary-tier Holo. */
export const packOdds = (type: PackType): OddsSummary => {
  const j = expectedJoint(type);
  const tiers = Object.fromEntries(TIERS.map(({ key: t }) => [t, sum(j, (x) => x === t)])) as Record<Tier, number>;
  const finishes = Object.fromEntries(FINISHES.map(({ key: f }) => [f, sum(j, (_, y) => y === f)])) as Record<Finish, number>;
  return { tiers, finishes, legendaryHolo: j.legendary.holo };
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

/** Live collection state (updates on every change, including from other tabs). */
export const useCollection = () => {
  const state = useSyncExternalStore(subscribe, readCollection, () => EMPTY);
  return { state, cards: state.cards, packs: packTotal(state) };
};
