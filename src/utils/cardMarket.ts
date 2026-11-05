import type { Player } from '@/types/player';
import { HOF_THRESHOLD, LEGACY_TIERS } from '@/config/stats';
import { officialOvrMap, playerKey } from '@/config/ovr';
import { playerSkillGrades } from '@/config/skillGrades';
import { TIERS, tierFor, type Finish, type PrizmCopy, type PrizmParallel, type Tier, type Variant } from '@/config/cardTiers';
import { AUTOGRAPH_MEAN_MULT } from '@/config/autographs';

/**
 * Card market: what a collectible card is "worth" in coins, and how that changes as the league data changes.
 * Pure (no React, no fetch), shared by scripts/market_snapshot.ts (which writes the history) and the UI.
 *
 * VALUE of a player's Base card, in coins:
 *
 *   value = round( OVR_FLOOR + OVR_SCALE · c³ )        c = clamp((OVR − 60) / 39, 0, 1)   official OVR, convex
 *           × skill     0.80 + 0.40 · clamp((skill − 62) / 37, 0, 1)                      skill rating 62–99 (1 if none)
 *           × legacy    ( (1 + L / 10000) / 1.5 )³        L = clamp(Career Legacy, 0, 15000); 1 at 5000
 *           × HOF       1.25 if Career Legacy ≥ 7000 (the original Hall of Fame line), else 1
 *           × tier      Common 1, Rare 1.25, Epic 1.6, Legendary 2
 *           × scarcity  clamp( sqrt( (pool size / 4) / players in his tier ), 0.8, 1.5 )
 *
 * OVR dominates (an 80 is worth ~5× a 70, a 95 ~3× an 85) and saturates at 99, so among the elite Career Legacy
 * is what keeps moving the price: a real career line that adds 1000 legacy lifts a card ~15–20%, and crossing
 * into the Hall of Fame adds another 25%. A thin tier is worth more than a crowded one.
 * Finish multipliers (FINISH_MULTIPLIER): Base ×1, Silver ×1.5, Gold ×2.5, Holo ×6.
 * Art variant multipliers (VARIANT_MULTIPLIER), on top: Prizm number ×1, Team jersey ×1.2, 70s Topps ×1.8,
 * Locker stall ×2.5, Autograph ×1 (it is priced by its own roll instead, below). KITS are a per-pull chase (KIT_ODDS in
 * src/utils/collection.ts: a modern alternate on 8–12% of pulls, the club's era kit on 2.5–4.5%, by pack): a card
 * wearing an alternate is worth ALT_VALUE_BONUS (×1.2) more, one in its era kit (a throwback) ERA_VALUE_BONUS (×1.4).
 * A card's price is value × finish × variant × the bonus of the kit it actually wears (cardPrice); the portfolio
 * prices each variant at its best finish in the best kit owned there.
 * PRIZM PARALLELS (Prizm number only; PRIZM_ODDS in src/utils/collection.ts: about 1 Prizm in 7 from Standard packs)
 * multiply on top (PARALLEL_MULTIPLIER): Red /199 ×1.3, Blue /99 ×1.6, Green /49 ×2, Gold /10 ×3.5, Black 1/1 ×8, and a
 * numbered parallel's first serial (1/199, 1/99…) another SERIAL_ONE_BONUS ×1.15. So a card's price is
 * value × finish × variant × kit × parallel; the portfolio takes the best parallel owned at that finish.
 * An AUTOGRAPH (the Autograph variant) is value × finish × its own multiplier (parallel × pen and ink × inscription ×
 * serial × throwback, config/autographs.ts autographValue), from ×2.7 for a black ballpoint sticker to ×91 for a
 * nickname-inscribed throwback 1/1 cut (autographPrice). Each owned autograph is its own holding, so nothing counts
 * twice; an Autograph card with no roll behind it (not owned, a gallery sample) is priced at the mean multiplier
 * (AUTOGRAPH_MEAN_MULT, about ×7.4 with every parallel open).
 *
 * HISTORY: data/y80/market_history.json (built into public/data/market.json) holds a snapshot of every collectible
 * league player's { ovr, skill, legacy, value } per update, stored as changes only: full keyframes (the first, every
 * Nth and the latest) plus deltas between them (src/utils/marketHistory.ts, expandMarket / compactMarket).
 * `npm run rebuild` adds one whenever any player's OVR, skill or legacy changed, so prices move only when the data
 * does. Nothing here is hand-maintained.
 */

export const OVR_FLOOR = 25;
export const OVR_SCALE = 2400;
export const TIER_MULTIPLIER: Record<Tier, number> = { common: 1, rare: 1.25, epic: 1.6, legendary: 2 };
export const HOF_MULTIPLIER = 1.25;
/** Career Legacy that earns the Hall of Fame price premium: the original 7,000 line, kept when the induction bar rose so card prices did not jump. */
const HOF_PREMIUM_LEGACY = 7000;
export const FINISH_MULTIPLIER: Record<Finish, number> = { base: 1, silver: 1.5, gold: 2.5, holo: 6 };
export const VARIANT_MULTIPLIER: Record<Variant, number> = { number: 1, jersey: 1.2, topps: 1.8, locker: 2.5, auto: 1 };
/** Market bonus for a card wearing a modern alternate kit (8–12% of pulls by pack; re-exported by art/sprite/uniforms.ts) */
export const ALT_VALUE_BONUS = 1.2;
/** Market bonus for a card wearing his club's famous era kit, a throwback (rarer: 2.5–4.5% of pulls by pack) */
export const ERA_VALUE_BONUS = 1.4;
/** Prizm parallel multipliers (Prizm number cards; plain Prizm ×1) */
export const PARALLEL_MULTIPLIER: Record<PrizmParallel, number> = { red: 1.3, blue: 1.6, green: 2, gold: 3.5, black: 8 };
/** A numbered parallel's serial 1 (1/199 … 1/10) is worth this much more; a Black 1/1 is priced by its colour alone */
export const SERIAL_ONE_BONUS = 1.15;
/** Market multiplier of a Prizm parallel copy (1 for a plain Prizm, `undefined`). */
export const parallelMultiplier = (p: PrizmCopy | undefined | null): number =>
  !p ? 1 : PARALLEL_MULTIPLIER[p.c] * (p.n === 1 && p.c !== 'black' ? SERIAL_ONE_BONUS : 1);
/** "×3.5", "×1.5 (serial 1)" */
export const fmtParallelMult = (p: PrizmCopy) => `×${Number(parallelMultiplier(p).toFixed(2))}`;
const LEGACY_REF = LEGACY_TIERS[0].min; // 10000, the Legendary legacy tier
const LEGACY_CAP = 1.5 * LEGACY_REF;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface ValueInputs {
  ovr: number;
  skill: number | null;
  legacy: number;
  tier: Tier;
  /** Players in his tier, and in the whole card pool */
  tierCount: number;
  poolSize: number;
}

/** Base-card value in coins (see the formula above). */
export const cardValue = ({ ovr, skill, legacy, tier, tierCount, poolSize }: ValueInputs): number => {
  const c = clamp((ovr - 60) / 39, 0, 1);
  const base = OVR_FLOOR + OVR_SCALE * c ** 3;
  const skillM = skill == null ? 1 : 0.8 + 0.4 * clamp((skill - 62) / 37, 0, 1);
  const legacyM = ((1 + clamp(legacy, 0, LEGACY_CAP) / LEGACY_REF) / 1.5) ** 3;
  const hofM = legacy >= HOF_PREMIUM_LEGACY ? HOF_MULTIPLIER : 1;
  const scarcity = clamp(Math.sqrt(poolSize / TIERS.length / Math.max(1, tierCount)), 0.8, 1.5);
  return Math.max(1, Math.round(base * skillM * legacyM * hofM * TIER_MULTIPLIER[tier] * scarcity));
};

export const finishValue = (value: number, finish: Finish) => Math.round(value * FINISH_MULTIPLIER[finish]);
/**
 * Price of one card: base value × finish × art variant × its kit (ALT_VALUE_BONUS for an alternate, ERA_VALUE_BONUS for
 * an era kit, `alt` = the kind of the kit it wears: kindOf / OwnedKit.kind) × its Prizm parallel (parallelMultiplier;
 * Prizm number cards only). An
 * Autograph card with no roll behind it is priced at the mean autograph multiplier (an owned one: autographPrice).
 */
export const cardPrice = (value: number, finish: Finish, variant: Variant, alt: boolean | 'alt' | 'era' | 'home' = false, prizm?: PrizmCopy | null) =>
  variant === 'auto'
    ? autographPrice(value, AUTOGRAPH_MEAN_MULT, finish)
    : Math.round(
        value * FINISH_MULTIPLIER[finish] * VARIANT_MULTIPLIER[variant] * (alt === 'era' ? ERA_VALUE_BONUS : alt && alt !== 'home' ? ALT_VALUE_BONUS : 1) *
          (variant === 'number' ? parallelMultiplier(prizm) : 1),
      );

/** Price of an autograph: the player's base card value × the finish it was pulled at × its multiplier (config/autographs.ts). */
export function autographPrice(value: number, mult: number, finish: Finish = 'base') {
  return Math.round(value * FINISH_MULTIPLIER[finish] * VARIANT_MULTIPLIER.auto * mult);
}

// ---------- Snapshots ----------

export interface MarketPoint {
  ovr: number;
  /** Skill rating (62–99), null when the player has no graded skills */
  skill: number | null;
  /** Career Legacy, rounded */
  legacy: number;
  /** Base-card value in coins */
  value: number;
  /** Overall skill letter grade (config/skillGrades.ts GRADE_SCALE), for the "What changed" headlines */
  grade?: string;
  /**
   * Career totals the headlines watch for milestones, in data/y80/players.json keys (nonzero only). Kept in
   * data/y80/market_history.json; scripts/market_snapshot.ts strips them from public/data/market.json.
   */
  s?: Record<string, number>;
}

export interface MarketSnapshot {
  id: string;
  label: string;
  /** ISO date-time */
  date: string;
  players: Record<string, MarketPoint>;
}

/** The file: oldest snapshot first. */
export type MarketHistory = MarketSnapshot[];

/** Career totals for the milestone headlines (scripts/build_league_content.py headlines()), players.json keys. */
export const milestoneStats = (p: Player): Record<string, number> => {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
  const r = p as unknown as Record<string, unknown>;
  const defense = p.position === 'LB' || p.position === 'DB' || p.position === 'DL';
  const by: Record<string, Record<string, string>> = {
    QB: { yds: 'passYds', td: 'passTD', int: 'interceptions', ryds: 'rushYds', rtd: 'rushTD' },
    RB: { ryds: 'rushYds', rtd: 'rushTD', rec: 'receptions', recyds: 'recYds', rectd: 'recTD' },
    WR: { rec: 'receptions', yds: 'recYds', td: 'recTD' },
    TE: { rec: 'receptions', yds: 'recYds', td: 'recTD' },
    OL: { blk: 'blocks' },
    DEF: { tkl: 'tackles', int: 'interceptions', sck: 'sacks', ff: 'forcedFumbles' },
  };
  const fields: Record<string, string> = {
    g: 'games',
    ...by[defense ? 'DEF' : p.position],
    rings: 'rings',
    mvp: 'mvp',
    sbmvp: 'sbmvp',
    [defense ? 'dpoy' : 'opoy']: 'opoy',
  };
  const out: Record<string, number> = {};
  Object.entries(fields).forEach(([k, f]) => {
    const v = n(r[f]);
    if (v) out[k] = v;
  });
  return out;
};

/**
 * Market point for every collectible player (league minus game exclusions), computed like the site does:
 * official OVR over the game pool (league + real NFL players, minus exclusions), skill rating graded against the
 * whole league, Career Legacy from the normalized league. `league` is normalized and has no real legends.
 */
export const snapshotPlayers = (league: Player[], legends: Player[], excluded: Set<string>): Record<string, MarketPoint> => {
  const ovrMap = officialOvrMap(league, legends, excluded);
  const pool = league.filter((p) => !excluded.has(playerKey(p)));
  const rows = pool.map((p) => {
    const ovr = ovrMap.get(playerKey(p)) ?? 62;
    const overall = playerSkillGrades(league, p).overall;
    return { p, ovr, tier: tierFor(p, ovr), skill: overall?.rating ?? null, grade: overall?.grade.grade };
  });
  const counts = new Map<Tier, number>();
  rows.forEach((r) => counts.set(r.tier, (counts.get(r.tier) ?? 0) + 1));
  const out: Record<string, MarketPoint> = {};
  [...rows]
    .sort((a, b) => playerKey(a.p).localeCompare(playerKey(b.p)))
    .forEach(({ p, ovr, tier, skill, grade }) => {
      const legacy = Math.round(p.careerLegacy || 0);
      out[playerKey(p)] = {
        ovr,
        skill,
        legacy,
        value: cardValue({ ovr, skill, legacy, tier, tierCount: counts.get(tier) ?? 1, poolSize: rows.length }),
        ...(grade ? { grade } : {}),
        s: milestoneStats(p),
      };
    });
  return out;
};

/** True when two snapshots have the same players with the same OVR, skill and legacy (value is derived). */
export const samePlayers = (a: Record<string, MarketPoint>, b: Record<string, MarketPoint>) => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] && a[k].ovr === b[k].ovr && a[k].skill === b[k].skill && a[k].legacy === b[k].legacy);
};

// ---------- Reading the history (UI) ----------

export interface PricePoint extends MarketPoint {
  label: string;
  date: string;
}

/** One player's points over the snapshots he appears in, oldest first. */
export const priceSeries = (history: MarketHistory, key: string): PricePoint[] =>
  history.flatMap((s) => (s.players[key] ? [{ ...s.players[key], label: s.label, date: s.date }] : []));

/** Fractional change between two values (null when there is no earlier value). */
export const pctChange = (now: number, before: number | null | undefined) => (before ? (now - before) / before : null);

export interface Mover {
  key: string;
  value: number;
  before: number;
  change: number;
}

/**
 * Every player in the latest snapshot with his change since `since`: 'last' = the previous snapshot, 'all' = the
 * first snapshot he appears in. Players with no earlier price are left out.
 */
export const marketMovers = (history: MarketHistory, since: 'last' | 'all' = 'last'): Mover[] => {
  const latest = history[history.length - 1];
  if (!latest) return [];
  const prev = history[history.length - 2];
  return Object.entries(latest.players).flatMap(([key, p]) => {
    const before = since === 'last' ? prev?.players[key]?.value : history.find((s) => s.players[key])?.players[key]?.value;
    const change = pctChange(p.value, before);
    return change == null || before == null ? [] : [{ key, value: p.value, before, change }];
  });
};

/** One owned card for the portfolio: a player's variant at its best finish. */
export interface Holding {
  key: string;
  finish: Finish;
  variant: Variant;
  /** Kit worn: an alternate (true / 'alt') or a famous era kit ('era'); for owned cards the best kit owned (collection.ts bestKit) */
  alt?: boolean | 'alt' | 'era' | 'home';
  /** An autograph: priced as the base card × its finish × this multiplier instead (autographPrice) */
  mult?: number;
  /** Prizm number: the best parallel owned at this finish (collection.ts bestParallel); missing = plain */
  prizm?: PrizmCopy;
}

/** A holding's price at one base value. */
export const holdingPrice = (value: number, h: Holding) => (h.mult != null ? autographPrice(value, h.mult, h.finish) : cardPrice(value, h.finish, h.variant, h.alt, h.prizm));

/** Portfolio value per snapshot: each owned (player, variant) at its best finish (cards not yet listed count 0). */
export const portfolioSeries = (history: MarketHistory, owned: Holding[]) =>
  history.map((s) => ({
    label: s.label,
    date: s.date,
    value: owned.reduce((sum, h) => sum + (s.players[h.key] ? holdingPrice(s.players[h.key].value, h) : 0), 0),
  }));

/** "+12.4%" / "−3.0%" / "0.0%" */
export const fmtPct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(1)}%`;
/** "1,234" */
export const fmtCoins = (n: number) => Math.round(n).toLocaleString('en-US');

// ---------- Index, news, pull value ----------

/**
 * RVX, the Retro Vault index: 1000 at the first snapshot, then chain-linked. Each update moves it by the change in
 * the total value of the cards listed both before and after, so newly listed players never jump the index.
 */
export const marketIndex = (history: MarketHistory): { label: string; date: string; value: number }[] => {
  let level = 1000;
  return history.map((s, i) => {
    if (i > 0) {
      const prev = history[i - 1].players;
      let now = 0;
      let before = 0;
      Object.entries(s.players).forEach(([k, p]) => {
        if (!prev[k]) return;
        now += p.value;
        before += prev[k].value;
      });
      if (before > 0) level *= now / before;
    }
    return { label: s.label, date: s.date, value: Math.round(level * 10) / 10 };
  });
};

export interface MarketNews {
  key: string;
  /** Snapshot label it happened in */
  label: string;
  /** Snapshot index (newer = higher) */
  at: number;
  text: string;
  change: number;
  kind: 'hof' | 'legendary' | 'ovr' | 'career' | 'move';
}

const nameOf = (key: string) => key.slice(key.indexOf(':') + 1);
const LEGENDARY_LEGACY = LEGACY_REF;

/**
 * Headlines generated from consecutive snapshots: Hall of Fame entries, Legendary legacy, OVR jumps, grown career
 * lines and big price moves. Newest first, one per player per update, at most `limit`.
 */
export const marketNews = (history: MarketHistory, limit = 8): MarketNews[] => {
  const out: MarketNews[] = [];
  for (let i = history.length - 1; i > 0; i--) {
    const prev = history[i - 1].players;
    const label = history[i].label;
    const items: MarketNews[] = [];
    Object.entries(history[i].players).forEach(([key, p]) => {
      const b = prev[key];
      if (!b) return;
      const change = (p.value - b.value) / b.value;
      const name = nameOf(key);
      const base = { key, label, at: i, change };
      if (b.legacy < LEGENDARY_LEGACY && p.legacy >= LEGENDARY_LEGACY) items.push({ ...base, kind: 'legendary', text: `${name} reaches Legendary legacy` });
      else if (b.legacy < HOF_THRESHOLD && p.legacy >= HOF_THRESHOLD) items.push({ ...base, kind: 'hof', text: `${name} enters the Hall of Fame` });
      else if (Math.abs(p.ovr - b.ovr) >= 3) items.push({ ...base, kind: 'ovr', text: `${name} OVR ${b.ovr} → ${p.ovr}` });
      else if (p.legacy - b.legacy >= 500) items.push({ ...base, kind: 'career', text: `${name}'s career line grows (+${fmtCoins(p.legacy - b.legacy)} legacy)` });
      else if (Math.abs(change) >= 0.3) items.push({ ...base, kind: 'move', text: `${name} ${change > 0 ? 'surges' : 'slides'}` });
    });
    const rank = { legendary: 0, hof: 1, career: 2, ovr: 3, move: 4 } as const;
    items.sort((a, b) => rank[a.kind] - rank[b.kind] || Math.abs(b.change) - Math.abs(a.change));
    out.push(...items.slice(0, 4));
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
};

/** Base value of a card in the snapshot that was current at `time` (ms), else the first one listing him. */
export const valueAt = (history: MarketHistory, key: string, time: number): number | null => {
  let hit: MarketPoint | undefined;
  for (const s of history) {
    if (Date.parse(s.date) > time) break;
    if (s.players[key]) hit = s.players[key];
  }
  return (hit ?? history.find((s) => s.players[key])?.players[key])?.value ?? null;
};
