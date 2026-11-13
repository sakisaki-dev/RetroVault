import { findNFLTeam } from '@/utils/nflTeams';
import { slotSeed, editionShuffle } from '@/utils/edition';
import { AUTOGRAPH_MEAN_MULT } from '@/config/autographs';
import { ALT_VALUE_BONUS, ERA_VALUE_BONUS, FINISH_MULTIPLIER, PARALLEL_MULTIPLIER, SERIAL_ONE_BONUS, VARIANT_MULTIPLIER } from '@/utils/cardMarket';
import {
  COIN_LOG_CAP,
  FINISHES,
  KIT_ODDS,
  LEGACY_KIT,
  PACKS,
  PRIZM_ODDS,
  PRIZM_PARALLELS,
  TIERS,
  VARIANTS,
  applyPull,
  commitCollection,
  expectedJoint,
  finishLabel,
  finishRank,
  pick,
  readCollection,
  rollKit,
  rollPrizm,
  summarise,
  tierLabel,
  tierRank,
  variantLabel,
  variantWeights,
  type AutographFreezer,
  type CoinEntry,
  type CollectionState,
  type CountedPack,
  type EarnablePack,
  type Finish,
  type KitSource,
  type OwnedAuto,
  type PackCard,
  type PrizmCopy,
  type PrizmParallel,
  type RolledCard,
  type Tier,
  type TierPool,
  type Variant,
  type VariantCard,
} from '@/utils/collection';

/**
 * The Collection economy: coins become the trading currency (shards stay exactly as they were: claims and finish
 * upgrades). Pure rules plus the writes, every one through commitCollection (the collection's one save path, which
 * fires CHANGE_EVENT). Owner-approved, six parts:
 *
 * 1. SELL: one copy (a variant × finish × kit × Prizm parallel, or one autograph) sells to the market for SELL_RATE of
 *    its current market price (src/utils/cardMarket.ts cardPrice / autographPrice). "Sell duplicates" sells every
 *    copy beyond the best one per variant × finish.
 * 2. SHOP: packs for coins at SHOP_PRICES (Standard, Premium, Elite, Holo Showcase; Perfect Season and Legends
 *    Exchange stay earned). Calibrated with expectedPackPrice: a pack sells back for about a third of its price.
 * 3. SETS: each club's active roster, each of the coach's Super Bowl champions (the ring holders that season) and each
 *    Hall of Fame class, derived from the league data (collectionSets). Owning every member's card (any art, any
 *    finish) lets the set's one-time bonus be claimed (setReward: coins plus a pack, by size and value).
 * 4. TRADE-UP: TRADE_UP_COUNT copies of one tier in, one random card of the next tier out, rolled with TRADE_UP_PACK's
 *    finish, art, kit and parallel odds (Legendary is the top).
 * 5. BOUNTIES: 3 or 4 requests per edition, picked from the edition seed (never Math.random); turning a matching copy
 *    in pays its flat reward plus BOUNTY_PRICE_SHARE of the copy's price, once per bounty per edition.
 * 6. MILESTONES: portfolio value crossing MILESTONES unlocks cosmetics (binder skins, pack-opening themes) for good.
 */

// ---------- Constants ----------

/** A card sold to the market fetches this share of its current market price (rounded, at least 1 coin). */
export const SELL_RATE = 0.4;
export const sellPrice = (price: number) => Math.max(1, Math.round(price * SELL_RATE));

/** Packs for sale, in shelf order, and their prices in coins (calibrated with expectedPackPrice; see CLAUDE.md). */
export const SHOP_PACKS: CountedPack[] = ['standard', 'premium', 'elite', 'holo'];
export const SHOP_PRICES: Record<CountedPack, number> = { standard: 3500, premium: 7500, elite: 20000, holo: 35000 };

/** Trade-up: this many copies of one tier buy one card of the next tier, rolled at this pack's odds. */
export const TRADE_UP_COUNT = 5;
export const TRADE_UP_PACK: EarnablePack = 'premium';
export const nextTier = (t: Tier): Tier | null => TIERS[tierRank(t) + 1]?.key ?? null;

/** Bounties: a turned-in copy pays the bounty's flat reward plus this share of its market price (selling pays SELL_RATE). */
export const BOUNTY_PRICE_SHARE = 0.75;

/** Set bonuses: coins = this share of the members' base card values (at least SET_MIN_COINS), plus a pack by size. */
export const SET_COIN_SHARE = 0.5;
export const SET_MIN_COINS = 300;
/** Smallest champion team that counts as a set (fewer ring holders with cards: no set). */
export const SET_MIN_MEMBERS = 2;

// ---------- Coins ----------

const logged = (s: CollectionState, amount: number, text: string): Pick<CollectionState, 'coins' | 'coinLog'> => {
  const entry: CoinEntry = { at: Date.now(), amount: Math.round(amount), text };
  return { coins: Math.max(0, s.coins + Math.round(amount)), coinLog: [entry, ...(s.coinLog ?? [])].slice(0, COIN_LOG_CAP) };
};

// ---------- Copies: one owned card instance ----------

/** One copy to hand over: a card (variant × finish, the kit it wears and, for a Prizm, its parallel) or one autograph. */
export type CopyRef =
  | { kind: 'card'; key: string; variant: Exclude<Variant, 'auto'>; finish: Finish; kit: string; prizm?: PrizmCopy }
  | { kind: 'auto'; key: string; id: string };

/** "Prizm number Gold" / "Autograph". */
export const refLabel = (r: CopyRef, auto?: OwnedAuto) =>
  r.kind === 'auto' ? `Autograph ${finishLabel(auto?.finish ?? 'base')}` : `${variantLabel(r.variant)} ${finishLabel(r.finish)}`;

/**
 * The collection without one copy, or null when that copy isn't owned. A card copy takes one from its finish's count,
 * its kit (the stored id, else a legacy kit, which stands for the old fixed roll) and, for a Prizm parallel, that
 * colour and serial (a plain Prizm needs a plain copy). An emptied finish, variant or player is removed (a player with
 * nothing left leaves the binder, with his display choice). An autograph removes the item and one Autograph copy.
 */
export const removeCopy = (s: CollectionState, ref: CopyRef): CollectionState | null => {
  const card = s.cards[ref.key];
  if (!card) return null;
  const variant: Variant = ref.kind === 'auto' ? 'auto' : ref.variant;
  const v = card.variants[variant];
  if (!v) return null;
  let finish: Finish;
  let autos = s.autos;
  let entry: VariantCard;
  if (ref.kind === 'auto') {
    const a = s.autos.find((x) => x.id === ref.id && x.key === ref.key);
    if (!a) return null;
    autos = s.autos.filter((x) => x !== a);
    // The finish it was pulled at, else (older saves) any finish holding an Autograph copy
    finish = v.counts[a.finish] ? a.finish : (FINISHES.map((f) => f.key).find((f) => v.counts[f]) ?? a.finish);
    entry = { ...v, counts: { ...v.counts } };
  } else {
    finish = ref.finish;
    const have = v.counts[finish] ?? 0;
    if (!have) return null;
    const kits = { ...(v.kits?.[finish] ?? {}) };
    const kitId = kits[ref.kit] ? ref.kit : kits[LEGACY_KIT] ? LEGACY_KIT : Object.keys(kits).find((k) => kits[k] > 0);
    if (kitId) {
      kits[kitId] -= 1;
      if (kits[kitId] <= 0) delete kits[kitId];
    }
    let pars = [...(v.prizm?.[finish] ?? [])];
    if (ref.prizm) {
      const i = pars.findIndex((p) => p.c === ref.prizm!.c && p.n === ref.prizm!.n);
      const j = i >= 0 ? i : pars.findIndex((p) => p.c === ref.prizm!.c);
      if (j < 0) return null;
      pars.splice(j, 1);
    } else if (have - pars.length <= 0) {
      // No plain copy left to take: the copies are all parallels (shouldn't happen; keep the counts consistent)
      pars = pars.slice(0, have - 1);
    }
    entry = {
      ...v,
      counts: { ...v.counts },
      kits: { ...v.kits, [finish]: kits },
      ...(v.prizm || pars.length ? { prizm: { ...v.prizm, [finish]: pars } } : {}),
    };
  }
  const left = (entry.counts[finish] ?? 0) - 1;
  if (left > 0) entry.counts[finish] = left;
  else {
    delete entry.counts[finish];
    if (entry.kits) {
      const k = { ...entry.kits };
      delete k[finish];
      entry.kits = k;
    }
  }
  if (entry.prizm) {
    const p = { ...entry.prizm };
    if (!p[finish]?.length || left <= 0) delete p[finish];
    if (Object.keys(p).length) entry.prizm = p;
    else delete entry.prizm;
  }
  const remaining = FINISHES.map((f) => f.key).filter((f) => entry.counts[f]);
  const variants = { ...card.variants };
  if (!remaining.length) delete variants[variant];
  else variants[variant] = { ...entry, best: remaining.reduce((b, f) => (finishRank(f) > finishRank(b) ? f : b), remaining[0]) };
  const cards = { ...s.cards };
  let display = s.display;
  if (!Object.keys(variants).length) {
    delete cards[ref.key];
    if (display?.[ref.key]) {
      display = { ...display };
      delete display[ref.key];
    }
  } else cards[ref.key] = summarise(variants, card.marks);
  const next: CollectionState = { ...s, cards, autos };
  if (display && Object.keys(display).length) next.display = display;
  else delete next.display;
  return next;
};

/** A copy with what it is worth on the market now (cardPrice / autographPrice of the copy, in coins). */
export interface PricedRef {
  ref: CopyRef;
  price: number;
  /** For the coin log: "Ty Lock · Prizm number Gold" */
  label: string;
}

/**
 * Sells copies to the market: each for sellPrice(price). Every copy must still be owned (else nothing happens and
 * null comes back). Returns the coins received.
 */
export const sellCopies = (items: PricedRef[]): number | null => {
  if (!items.length) return null;
  let s: CollectionState | null = readCollection();
  let total = 0;
  for (const it of items) {
    s = removeCopy(s, it.ref);
    if (!s) return null;
    total += sellPrice(it.price);
  }
  const text = items.length === 1 ? `Sold ${items[0].label}` : `Sold ${items.length} cards`;
  commitCollection({ ...s, ...logged(s, total, text) });
  return total;
};

// ---------- Pack shop ----------

/** Buys one pack: coins down, the pack on the shelf (opened like any pack). False when the coins aren't there. */
export const buyPack = (type: CountedPack): boolean => {
  const s = readCollection();
  const price = SHOP_PRICES[type];
  if (s.coins < price) return false;
  const at = Date.now();
  commitCollection({
    ...s,
    ...logged(s, -price, `Bought a ${PACKS[type].label}`),
    packs: { ...s.packs, [type]: s.packs[type] + 1 },
    earned: [{ type, reason: 'Pack shop', at }, ...s.earned].slice(0, 30),
  });
  return true;
};

/**
 * Expected market price of one pack's cards, from the mean base card value per tier (players are picked evenly
 * within a tier, so the mean is exact): per card, every tier × finish (expectedJoint) × art (variantWeights) × kit
 * (KIT_ODDS, a club with every kind) × Prizm parallel (PRIZM_ODDS, serial 1 included) × the market multipliers; an
 * Autograph at AUTOGRAPH_MEAN_MULT. Ignores the no-repeat rule within a pack. × SELL_RATE = what it sells back for.
 */
export const expectedPackPrice = (type: EarnablePack, meanValue: Record<Tier, number>): number => {
  const j = expectedJoint(type);
  const k = KIT_ODDS[type];
  const kitMult = 1 + k.alt * (ALT_VALUE_BONUS - 1) + k.era * (ERA_VALUE_BONUS - 1);
  const parMult =
    1 +
    PRIZM_PARALLELS.reduce(
      (a, p) => a + PRIZM_ODDS[type][p.key] * (PARALLEL_MULTIPLIER[p.key] * (p.run > 1 ? 1 + (SERIAL_ONE_BONUS - 1) / p.run : 1) - 1),
      0,
    );
  let perCard = 0;
  TIERS.forEach(({ key: t }) =>
    FINISHES.forEach(({ key: f }) => {
      if (!j[t][f]) return;
      const w = variantWeights(type, t, f);
      const tot = Object.values(w).reduce((a, b) => a + b, 0);
      const art = VARIANTS.reduce((a, { key: v }) => {
        const m = v === 'auto' ? AUTOGRAPH_MEAN_MULT : VARIANT_MULTIPLIER[v] * kitMult * (v === 'number' ? parMult : 1);
        return a + (w[v] / tot) * m;
      }, 0);
      perCard += j[t][f] * meanValue[t] * FINISH_MULTIPLIER[f] * art;
    }),
  );
  return perCard * PACKS[type].size;
};

// ---------- Sets ----------

export type SetKind = 'club' | 'champion' | 'hof';
export interface CollectionSet {
  id: string;
  kind: SetKind;
  title: string;
  /** One line under the title: "Active roster", "Super Bowl CL · Y91", "Hall of Fame" */
  sub: string;
  /** Club the set belongs to (club rosters and champions), for its colours and logo */
  team?: string;
  /** Card keys ("POS:Name") */
  members: string[];
}

/** What collectionSets needs about each card (CardInfo has all of it). */
export interface SetCard {
  key: string;
  /** Name as the stints are keyed (the site passes playerExtras normalizeName) */
  name: string;
  /** His current club, raw ("Eagles"), and whether he is active */
  currentTeam: string;
  active: boolean;
}

/**
 * Sets from the league data: every club's active roster (players with cards), every Super Bowl the coach won (the
 * club's ring holders that season, from the career stints in player-extras.json; at least SET_MIN_MEMBERS with cards),
 * and every Hall of Fame class (content.json hofClasses). Ids are stable across updates (club:<Club>, sb:<year>,
 * hof:<label>); membership follows the data.
 */
export const collectionSets = (input: {
  cards: SetCard[];
  superBowls: { year: number; roman: string; winner: string | null; yourResult: string }[];
  stints: Record<string, { stints: { team: string; rings?: number[] }[] }>;
  hofClasses: { label: string; keys: string[] }[];
}): CollectionSet[] => {
  const clubOf = (t: string | null | undefined) => findNFLTeam(t)?.name ?? null;
  const byName = new Map(input.cards.map((c) => [c.name, c]));
  const keys = new Set(input.cards.map((c) => c.key));
  const clubs = new Map<string, string[]>();
  input.cards.forEach((c) => {
    const club = c.active ? clubOf(c.currentTeam) : null;
    if (club) clubs.set(club, [...(clubs.get(club) ?? []), c.key]);
  });
  const clubSets: CollectionSet[] = [...clubs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([club, members]) => ({ id: `club:${club}`, kind: 'club', title: findNFLTeam(club)?.fullName ?? club, sub: 'Active roster', team: club, members: [...members].sort() }));
  const champs: CollectionSet[] = input.superBowls
    .filter((sb) => sb.yourResult === 'won' && sb.winner)
    .map((sb) => {
      const club = clubOf(sb.winner);
      const members = Object.entries(input.stints)
        .filter(([, v]) => v.stints.some((st) => clubOf(st.team) === club && st.rings?.includes(sb.year)))
        .map(([name]) => byName.get(name)?.key)
        .filter((k): k is string => !!k);
      return { id: `sb:${sb.year}`, kind: 'champion' as const, title: `Y${sb.year} ${sb.winner}`, sub: `Super Bowl ${sb.roman} champions`, team: club ?? undefined, members: [...new Set(members)].sort() };
    })
    .filter((s) => s.members.length >= SET_MIN_MEMBERS)
    .reverse();
  const hof: CollectionSet[] = input.hofClasses
    .map((c) => ({
      id: `hof:${c.label}`,
      kind: 'hof' as const,
      title: /class/i.test(c.label) ? c.label : `Class of ${c.label}`,
      sub: 'Hall of Fame',
      members: c.keys.filter((k) => keys.has(k)),
    }))
    .filter((s) => s.members.length > 0)
    .reverse();
  return [...hof, ...champs, ...clubSets];
};

/** Members owned (any art, any finish). */
export const setProgress = (set: CollectionSet, cards: CollectionState['cards']) => {
  const have = set.members.filter((k) => !!cards[k]).length;
  return { have, total: set.members.length, done: have === set.members.length && set.members.length > 0 };
};

/** Pack a set bonus adds, by members (a Hall of Fame class one step better): ≤3 Standard, ≤6 Premium, ≤10 Elite, more Holo Showcase. */
const SET_PACK_STEPS: CountedPack[] = ['standard', 'premium', 'elite', 'holo'];
export const setReward = (set: CollectionSet, values: Record<string, number>): { coins: number; pack: CountedPack } => {
  const n = set.members.length;
  const step = (n <= 3 ? 0 : n <= 6 ? 1 : n <= 10 ? 2 : 3) + (set.kind === 'hof' ? 1 : 0);
  const sum = set.members.reduce((a, k) => a + (values[k] ?? 0), 0);
  return { coins: Math.max(SET_MIN_COINS, Math.round((sum * SET_COIN_SHARE) / 50) * 50), pack: SET_PACK_STEPS[Math.min(step, SET_PACK_STEPS.length - 1)] };
};

/** Claims a completed set's one-time bonus (the cards stay). False when it isn't complete or was claimed. */
export const claimSet = (set: CollectionSet, reward: { coins: number; pack: CountedPack }): boolean => {
  const s = readCollection();
  if (s.setsClaimed?.includes(set.id) || !setProgress(set, s.cards).done) return false;
  commitCollection({
    ...s,
    ...logged(s, reward.coins, `Set bonus: ${set.title}`),
    packs: { ...s.packs, [reward.pack]: s.packs[reward.pack] + 1 },
    setsClaimed: [...(s.setsClaimed ?? []), set.id],
    earned: [{ type: reward.pack, reason: `Set bonus: ${set.title}`, at: Date.now() }, ...s.earned].slice(0, 30),
  });
  return true;
};

// ---------- Trade-up ----------

/**
 * Trades TRADE_UP_COUNT copies of one tier for one random card of the next tier: the copies go, then a player of
 * the next tier is picked evenly and rolls his finish, art, kit and parallel at TRADE_UP_PACK odds, exactly like a
 * pack slot (an Autograph is signed through `freeze`; a duplicate is worth its shards). Null when a copy isn't owned
 * or isn't of `tier`, or the next tier is empty.
 */
export const tradeUp = (tier: Tier, refs: CopyRef[], pool: TierPool, freeze?: AutographFreezer, kits?: KitSource, rng: () => number = Math.random): PackCard | null => {
  const up = nextTier(tier);
  if (!up || refs.length !== TRADE_UP_COUNT || !pool[up].length) return null;
  const inTier = new Set(pool[tier].map((p) => `${p.position}:${p.name}`));
  if (!refs.every((r) => inTier.has(r.key))) return null;
  let s: CollectionState | null = readCollection();
  for (const r of refs) {
    s = removeCopy(s, r);
    if (!s) return null;
  }
  const type = TRADE_UP_PACK;
  const player = pool[up][Math.floor(rng() * pool[up].length)];
  const finish = pick(PACKS[type].finishes[up], rng) ?? 'base';
  const variant = pick(variantWeights(type, up, finish), rng) ?? 'jersey';
  const kit = kits ? rollKit(type, kits.of(player.team), variant, rng) : 'home';
  const prizm = rollPrizm(type, variant, rng);
  const rc: RolledCard = { player, tier: up, finish, variant, kit, ...(prizm ? { prizm } : {}), slot: 'chase' };
  const cards = { ...s.cards };
  const pc = applyPull(cards, rc, { type, now: Date.now(), index: 0, freeze, kits });
  commitCollection({
    ...s,
    cards,
    shards: s.shards + pc.shards,
    ...(pc.auto ? { autos: [...s.autos, pc.auto] } : {}),
  });
  return pc;
};

// ---------- Bounties ----------

/** What a bounty can test about one copy. */
export interface CopyFacts {
  key: string;
  position: string;
  tier: Tier;
  /** Club the card is listed under (CardInfo.franchise: his current club) */
  franchise: string;
  variant: Variant;
  finish: Finish;
  kitKind: 'home' | 'alt' | 'era';
  prizm?: PrizmCopy;
  /** Base value change since the previous market snapshot (null: no earlier price) */
  change: number | null;
}

export interface Bounty {
  id: string;
  title: string;
  /** Flat coins on top of BOUNTY_PRICE_SHARE of the copy's price */
  reward: number;
  test: (c: CopyFacts) => boolean;
}

/** mulberry32 over the edition seed: which bounties and their details, never Math.random. */
const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const choose = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
const POS_PLURAL: Record<string, string> = { QB: 'quarterback', RB: 'running back', WR: 'wide receiver', TE: 'tight end', OL: 'offensive lineman', LB: 'linebacker', DB: 'defensive back', DL: 'defensive lineman' };
const atLeast = (f: Finish, min: Finish) => finishRank(f) >= finishRank(min);
/** "A Rams card", "An Eagles card", "An Epic-or-better player" */
const article = (word: string) => `${/^[AEIOU]/i.test(word) ? 'An' : 'A'} ${word}`;

type Template = (r: () => number, ctx: { clubs: string[]; risers: number }) => Bounty | null;
/** Bounty templates; each edition shuffles them (edition seed) and takes 3 or 4 that apply. */
const TEMPLATES: Record<string, Template> = {
  club: (r, { clubs }) => {
    if (!clubs.length) return null;
    const club = choose(r, clubs);
    const min: Finish = r() < 0.7 ? 'silver' : 'gold';
    return { id: `club-${club}-${min}`, title: `${article(club)} card at ${finishLabel(min)} or better`, reward: min === 'gold' ? 900 : 300, test: (c) => c.franchise === club && atLeast(c.finish, min) };
  },
  riser: (_r, { risers }) =>
    risers ? { id: 'riser', title: 'Any player whose value rose 5% or more this update', reward: 250, test: (c) => c.change != null && c.change >= 0.05 } : null,
  parallel: (r) => {
    if (r() < 0.35) {
      const rare: PrizmParallel[] = ['blue', 'green', 'gold', 'black'];
      return { id: 'parallel-blue', title: 'A Blue /99 or rarer Prizm parallel', reward: 1200, test: (c) => !!c.prizm && rare.includes(c.prizm.c) };
    }
    return { id: 'parallel', title: 'A Prizm colour parallel (any colour)', reward: 500, test: (c) => !!c.prizm };
  },
  art: (r) => {
    const art = choose(r, ['topps', 'locker', 'jersey'] as const);
    const pos = choose(r, POSITIONS);
    return {
      id: `art-${art}-${pos}`,
      title: `${article(variantLabel(art))} card of ${article(POS_PLURAL[pos]).toLowerCase()}`,
      reward: art === 'locker' ? 600 : art === 'topps' ? 400 : 200,
      test: (c) => c.variant === art && c.position === pos,
    };
  },
  kit: () => ({ id: 'kit', title: 'Any card in an alternate or throwback kit', reward: 450, test: (c) => c.kitKind !== 'home' }),
  tier: (r) => {
    const tier = choose(r, ['rare', 'epic'] as const);
    const min: Finish = tier === 'rare' ? 'gold' : 'silver';
    return {
      id: `tier-${tier}-${min}`,
      title: `${article(tierLabel(tier))}-or-better player at ${finishLabel(min)} or better`,
      reward: tier === 'epic' ? 1500 : 1000,
      test: (c) => tierRank(c.tier) >= tierRank(tier) && atLeast(c.finish, min),
    };
  },
  position: (r) => {
    const pos = choose(r, POSITIONS);
    return { id: `pos-${pos}`, title: `An Epic or Legendary ${POS_PLURAL[pos]}`, reward: 700, test: (c) => c.position === pos && tierRank(c.tier) >= tierRank('epic') };
  },
};

/**
 * This edition's bounties: the templates shuffled by the edition seed, the first 3 or 4 (also from the seed) that
 * apply, each with its details drawn from its own seeded stream. Same seed, same bounties, on every device.
 */
export const editionBounties = (seed: number, ctx: { clubs: string[]; risers: number }): Bounty[] => {
  const want = 3 + (slotSeed(seed, 'bounty-count') % 2);
  const out: Bounty[] = [];
  for (const name of editionShuffle(Object.keys(TEMPLATES), seed, 'bounties')) {
    if (out.length >= want) break;
    const b = TEMPLATES[name](seeded(slotSeed(seed, `bounty:${name}`)), ctx);
    if (b) out.push(b);
  }
  return out;
};

/** Bounty ids already turned in this edition. */
export const bountiesDone = (s: CollectionState, seed: number) => (s.bounties?.seed === seed ? s.bounties.done : []);
export const bountyPayout = (b: Bounty, price: number) => b.reward + Math.round(price * BOUNTY_PRICE_SHARE);

/** Turns a copy in for a bounty (the copy goes): pays bountyPayout. Null when done already or the copy isn't owned. */
export const turnInBounty = (seed: number, bounty: Bounty, item: PricedRef): number | null => {
  const s0 = readCollection();
  const done = bountiesDone(s0, seed);
  if (done.includes(bounty.id)) return null;
  const s = removeCopy(s0, item.ref);
  if (!s) return null;
  const pay = bountyPayout(bounty, item.price);
  commitCollection({ ...s, ...logged(s, pay, `Bounty: ${bounty.title}`), bounties: { seed, done: [...done, bounty.id] } });
  return pay;
};

// ---------- Portfolio milestones and cosmetics ----------

export type CosmeticKind = 'binder' | 'pack';
export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  label: string;
  blurb: string;
}
export interface Milestone {
  id: string;
  /** Portfolio value (coins) that unlocks it */
  at: number;
  cosmetic: Cosmetic;
}

/** Calibrated against the expected portfolio value of packs opened (CLAUDE.md "Collection economy"). */
export const MILESTONES: Milestone[] = [
  { id: 'm-250k', at: 250_000, cosmetic: { id: 'turf', kind: 'binder', label: 'Turf binder', blurb: 'Mown stripes and chalk yard lines behind your binder.' } },
  { id: 'm-1m', at: 1_000_000, cosmetic: { id: 'floodlights', kind: 'pack', label: 'Floodlights packs', blurb: 'Packs open under stadium light towers.' } },
  { id: 'm-3m', at: 3_000_000, cosmetic: { id: 'gold-leaf', kind: 'binder', label: 'Gold leaf binder', blurb: 'Deep navy leather with gilded edges.' } },
  { id: 'm-10m', at: 10_000_000, cosmetic: { id: 'gold-rush', kind: 'pack', label: 'Gold rush packs', blurb: 'Packs open in a shower of gold foil.' } },
  { id: 'm-30m', at: 30_000_000, cosmetic: { id: 'marble', kind: 'binder', label: 'Hall of Fame marble', blurb: 'White marble and brass, like the Hall itself.' } },
];

/** Records every milestone the portfolio value has reached (never removes one). Returns the ones new now. */
export const checkMilestones = (value: number): Milestone[] => {
  const s = readCollection();
  const have = new Set(s.unlocks ?? []);
  const fresh = MILESTONES.filter((m) => value >= m.at && !have.has(m.id));
  if (fresh.length) commitCollection({ ...s, unlocks: [...have, ...fresh.map((m) => m.id)] });
  return fresh;
};

/** Switches a cosmetic on (an unlocked one) or, with null, back to the classic look. */
export const setCosmetic = (kind: CosmeticKind, id: string | null): boolean => {
  const s = readCollection();
  const m = id ? MILESTONES.find((x) => x.cosmetic.id === id && x.cosmetic.kind === kind) : null;
  if (id && (!m || !s.unlocks?.includes(m.id))) return false;
  const cosmetics = { ...s.cosmetics };
  if (id) cosmetics[kind] = id;
  else delete cosmetics[kind];
  const next: CollectionState = { ...s };
  if (cosmetics.binder || cosmetics.pack) next.cosmetics = cosmetics;
  else delete next.cosmetics;
  commitCollection(next);
  return true;
};

/** The cosmetic switched on for a kind, if it is still unlocked. */
export const activeCosmetic = (s: CollectionState, kind: CosmeticKind): string | undefined => {
  const id = s.cosmetics?.[kind];
  const m = MILESTONES.find((x) => x.cosmetic.id === id && x.cosmetic.kind === kind);
  return m && s.unlocks?.includes(m.id) ? id : undefined;
};
