import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import { playerKey } from '@/config/ovr';

/**
 * Player card collection ("cards that live and breathe").
 *
 * Every game-pool player (league players minus game exclusions, plus the real NFL legends) has one
 * collectible card. Cards unlock by playing the Arcade (see the unlockCard call sites in
 * src/components/games/*) or from the free daily pack on the Collection tab. State is per browser,
 * in localStorage under STORAGE_KEY; every write fires CHANGE_EVENT so open views update live.
 */

export const STORAGE_KEY = 'retroVault:collection';
/** window CustomEvent fired after every write; detail is a CollectionChange. */
export const CHANGE_EVENT = 'retroVault:collection';

// ---------- Rarity ----------

export type Rarity = 'base' | 'silver' | 'gold' | 'hof' | 'legend';

/**
 * Rarity thresholds (official OVR, 62–99, src/config/ovr.ts). OVR is a per-position percentile
 * (OVR = 62 + 37 · pct^0.85), so these cut the pool by share rather than by raw stats:
 *   Legend            real NFL player (isRealLegend), whatever the rating
 *   Hall of Fame Holo league player with Career Legacy ≥ HOF_THRESHOLD (isHallOfFamer)
 *   Gold              OVR ≥ GOLD_MIN_OVR   (about the top 28% of each position, before HOF takes its share)
 *   Silver            OVR ≥ SILVER_MIN_OVR (about the next 29%)
 *   Base              everyone else, or OVR unknown
 */
export const GOLD_MIN_OVR = 90;
export const SILVER_MIN_OVR = 80;

/** Lowest to highest. */
export const RARITIES: { key: Rarity; label: string; short: string }[] = [
  { key: 'base', label: 'Base', short: 'Base' },
  { key: 'silver', label: 'Silver', short: 'Silver' },
  { key: 'gold', label: 'Gold', short: 'Gold' },
  { key: 'hof', label: 'Hall of Fame Holo', short: 'HOF Holo' },
  { key: 'legend', label: 'Legend', short: 'Legend' },
];

export const rarityLabel = (r: Rarity) => RARITIES.find((x) => x.key === r)!.label;
export const rarityRank = (r: Rarity) => RARITIES.findIndex((x) => x.key === r);

export const rarityFor = (player: Player, ovr: number | null | undefined): Rarity => {
  if (player.isRealLegend) return 'legend';
  if (isHallOfFamer(player)) return 'hof';
  if (ovr != null && ovr >= GOLD_MIN_OVR) return 'gold';
  if (ovr != null && ovr >= SILVER_MIN_OVR) return 'silver';
  return 'base';
};

/** Daily pack: cards per pack and the relative odds of each rarity per slot. */
export const PACK_SIZE = 3;
export const PACK_WEIGHTS: Record<Rarity, number> = { base: 55, silver: 25, gold: 12, hof: 5, legend: 3 };

// ---------- Store ----------

export interface CardEntry {
  /** Unlock time (ms since epoch) */
  at: number;
  /** What unlocked it: game name or "Daily pack" */
  source: string;
}

export interface CollectionState {
  cards: Record<string, CardEntry>;
  /** Local date (YYYY-MM-DD) of the last daily pack opened */
  lastPack?: string;
}

export interface CollectionChange {
  /** Players unlocked by this write (empty for pack bookkeeping) */
  added: Player[];
  reason: string;
  /** Pack openings show their own animation, so no toast */
  silent: boolean;
}

const EMPTY: CollectionState = { cards: {} };
let memory: CollectionState | null = null;

const parse = (raw: string | null): CollectionState => {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as Partial<CollectionState> | null;
    if (!data || typeof data !== 'object' || !data.cards || typeof data.cards !== 'object') return EMPTY;
    const cards: Record<string, CardEntry> = {};
    Object.entries(data.cards).forEach(([k, v]) => {
      const e = v as Partial<CardEntry> | null;
      if (e && typeof e.at === 'number') cards[k] = { at: e.at, source: typeof e.source === 'string' ? e.source : 'Arcade' };
    });
    return { cards, lastPack: typeof data.lastPack === 'string' ? data.lastPack : undefined };
  } catch {
    return EMPTY;
  }
};

/** Current state; cached so useSyncExternalStore gets a stable snapshot between writes. */
export const readCollection = (): CollectionState => {
  if (memory) return memory;
  try {
    memory = parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    memory = EMPTY;
  }
  return memory;
};

const write = (next: CollectionState, change: CollectionChange) => {
  memory = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable or full; keep the in-memory copy for this visit
  }
  try {
    window.dispatchEvent(new CustomEvent<CollectionChange>(CHANGE_EVENT, { detail: change }));
  } catch {
    // Non-browser environment
  }
};

export const cardKey = (p: Pick<Player, 'name' | 'position'>) => playerKey(p);
export const isOwned = (p: Pick<Player, 'name' | 'position'>, state = readCollection()) => !!state.cards[cardKey(p)];

// Toast listeners (CardUnlockToasts). With none mounted, unlockCard falls back to a plain text toast.
let toastListeners = 0;
export const registerToastListener = () => {
  toastListeners++;
  return () => {
    toastListeners--;
  };
};
export const hasToastListener = () => toastListeners > 0;

/**
 * Unlocks one or more players' cards. Already-owned cards are ignored (the first unlock keeps its
 * date and source). Returns the newly unlocked players. Safe to call from event handlers and effects.
 */
export const unlockCard = (players: Player | Player[] | null | undefined, reason: string, opts: { silent?: boolean } = {}): Player[] => {
  const list = (Array.isArray(players) ? players : players ? [players] : []).filter(Boolean);
  if (!list.length) return [];
  const state = readCollection();
  const cards = { ...state.cards };
  const added: Player[] = [];
  const now = Date.now();
  list.forEach((p) => {
    const k = cardKey(p);
    if (cards[k]) return;
    cards[k] = { at: now, source: reason };
    added.push(p);
  });
  if (!added.length) return [];
  const silent = !!opts.silent;
  write({ ...state, cards }, { added, reason, silent });
  if (!silent && !hasToastListener()) {
    toast.success(added.length === 1 ? `New card: ${added[0].name}` : `${added.length} new cards`, { description: `Unlocked in ${reason}. See the Collection tab.` });
  }
  return added;
};

// ---------- Daily pack ----------

/** Local calendar day, YYYY-MM-DD. */
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const packAvailable = (state = readCollection()) => state.lastPack !== todayKey();

/** Milliseconds until local midnight (when the next pack unlocks). */
export const msUntilNextPack = (now = new Date()) => {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
};

export interface PackCard {
  player: Player;
  rarity: Rarity;
  /** Already owned before this pack */
  duplicate: boolean;
}

const weightedPick = <T,>(items: { item: T; w: number }[]): T | null => {
  const total = items.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of items) {
    r -= x.w;
    if (r < 0) return x.item;
  }
  return items[items.length - 1].item;
};

/**
 * Deals PACK_SIZE cards: each slot rolls a rarity by PACK_WEIGHTS (only rarities that still have
 * cards), then a random card of that rarity, preferring ones you don't own yet. No repeats in a pack.
 */
export const rollPack = (pool: Player[], rarityOf: (p: Player) => Rarity, state = readCollection()): PackCard[] => {
  const byRarity = new Map<Rarity, Player[]>();
  pool.forEach((p) => {
    const r = rarityOf(p);
    byRarity.set(r, [...(byRarity.get(r) ?? []), p]);
  });
  const taken = new Set<string>();
  const out: PackCard[] = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    const free = (r: Rarity) => (byRarity.get(r) ?? []).filter((p) => !taken.has(cardKey(p)));
    const rarity = weightedPick(RARITIES.filter((r) => free(r.key).length).map((r) => ({ item: r.key, w: PACK_WEIGHTS[r.key] })));
    if (!rarity) break;
    const candidates = free(rarity);
    const missing = candidates.filter((p) => !state.cards[cardKey(p)]);
    const from = missing.length ? missing : candidates;
    const player = from[Math.floor(Math.random() * from.length)];
    taken.add(cardKey(player));
    out.push({ player, rarity, duplicate: !!state.cards[cardKey(player)] });
  }
  return out;
};

/** Opens today's pack: rolls it, unlocks the cards (silently) and stamps today. Null if already opened today. */
export const openDailyPack = (pool: Player[], rarityOf: (p: Player) => Rarity): PackCard[] | null => {
  const state = readCollection();
  if (!packAvailable(state) || !pool.length) return null;
  const pack = rollPack(pool, rarityOf, state);
  const cards = { ...state.cards };
  const now = Date.now();
  pack.forEach(({ player }) => {
    cards[cardKey(player)] ??= { at: now, source: 'Daily pack' };
  });
  write(
    { cards, lastPack: todayKey() },
    { added: pack.filter((c) => !c.duplicate).map((c) => c.player), reason: 'Daily pack', silent: true },
  );
  return pack;
};

// ---------- Hint for locked cards ----------

const HINTS: Record<Rarity, string[]> = {
  legend: ['Name them in Guess the Legend', 'Unmask them as the Imposter', 'Pull one from a daily pack'],
  hof: ['Solve them in Guess the Legend', 'Fill them into a League Grid', 'Keep them in Keep 3 / Cut 3'],
  gold: ['Slot them right in Blind Rank', 'Fill them into a League Grid', 'Draft them onto an 18–0 team'],
  silver: ['Reveal them in Higher or Lower', 'Keep them in Keep 3 / Cut 3', 'Win a season with them in 18–0'],
  base: ['Reveal them in Higher or Lower', 'Spot them as the Imposter', 'Pull one from a daily pack'],
};

/** Stable unlock hint for a locked card. */
export const unlockHint = (p: Pick<Player, 'name' | 'position'>, rarity: Rarity) => {
  let h = 0;
  for (const c of cardKey(p)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const list = HINTS[rarity];
  return list[h % list.length];
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

/** Live collection state (updates on every unlock, including from other tabs). */
export const useCollection = () => {
  const state = useSyncExternalStore(subscribe, readCollection, () => EMPTY);
  return {
    state,
    cards: state.cards,
    owned: (p: Pick<Player, 'name' | 'position'>) => !!state.cards[cardKey(p)],
    count: Object.keys(state.cards).length,
    packReady: packAvailable(state),
  };
};
