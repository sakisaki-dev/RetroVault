import type { Player } from '@/types/player';
import { HOF_THRESHOLD, LEGACY_TIERS } from '@/config/stats';
import { officialOvrMap, playerKey } from '@/config/ovr';
import { playerSkillGrades } from '@/config/skillGrades';
import { TIERS, tierFor, type Finish, type Tier } from '@/config/cardTiers';

/**
 * Card market: what a collectible card is "worth" in coins, and how that changes as the league data changes.
 * Pure (no React, no fetch), shared by scripts/market_snapshot.ts (which writes the history) and the UI.
 *
 * VALUE of a player's Base card, in coins:
 *
 *   value = round( OVR_FLOOR + OVR_SCALE · c³ )        c = clamp((OVR − 60) / 39, 0, 1)   official OVR, convex
 *           × skill     0.80 + 0.40 · clamp((skill − 62) / 37, 0, 1)                      skill rating 62–99 (1 if none)
 *           × legacy    ( (1 + L / 10000) / 1.5 )³        L = clamp(Career Legacy, 0, 15000); 1 at 5000
 *           × HOF       1.25 if Career Legacy ≥ 7000 (Hall of Fame), else 1
 *           × tier      Common 1, Rare 1.25, Epic 1.6, Legendary 2
 *           × scarcity  clamp( sqrt( (pool size / 4) / players in his tier ), 0.8, 1.5 )
 *
 * OVR dominates (an 80 is worth ~5× a 70, a 95 ~3× an 85) and saturates at 99, so among the elite Career Legacy
 * is what keeps moving the price: a real career line that adds 1000 legacy lifts a card ~15–20%, and crossing
 * into the Hall of Fame adds another 25%. A thin tier is worth more than a crowded one.
 * Finish multipliers (FINISH_MULTIPLIER): Base ×1, Silver ×1.5, Gold ×2.5, Holo ×6.
 *
 * HISTORY: data/y80/market_history.json (built into public/data/market.json) is a list of snapshots of every
 * collectible league player's { ovr, skill, legacy, value }. `npm run rebuild` appends one whenever any player's
 * OVR, skill or legacy changed, so prices move only when the data does. Nothing here is hand-maintained.
 */

export const OVR_FLOOR = 25;
export const OVR_SCALE = 2400;
export const TIER_MULTIPLIER: Record<Tier, number> = { common: 1, rare: 1.25, epic: 1.6, legendary: 2 };
export const HOF_MULTIPLIER = 1.25;
export const FINISH_MULTIPLIER: Record<Finish, number> = { base: 1, silver: 1.5, gold: 2.5, holo: 6 };
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
  const hofM = legacy >= HOF_THRESHOLD ? HOF_MULTIPLIER : 1;
  const scarcity = clamp(Math.sqrt(poolSize / TIERS.length / Math.max(1, tierCount)), 0.8, 1.5);
  return Math.max(1, Math.round(base * skillM * legacyM * hofM * TIER_MULTIPLIER[tier] * scarcity));
};

export const finishValue = (value: number, finish: Finish) => Math.round(value * FINISH_MULTIPLIER[finish]);

// ---------- Snapshots ----------

export interface MarketPoint {
  ovr: number;
  /** Skill rating (62–99), null when the player has no graded skills */
  skill: number | null;
  /** Career Legacy, rounded */
  legacy: number;
  /** Base-card value in coins */
  value: number;
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
    return { p, ovr, tier: tierFor(p, ovr), skill: playerSkillGrades(league, p).overall?.rating ?? null };
  });
  const counts = new Map<Tier, number>();
  rows.forEach((r) => counts.set(r.tier, (counts.get(r.tier) ?? 0) + 1));
  const out: Record<string, MarketPoint> = {};
  [...rows]
    .sort((a, b) => playerKey(a.p).localeCompare(playerKey(b.p)))
    .forEach(({ p, ovr, tier, skill }) => {
      const legacy = Math.round(p.careerLegacy || 0);
      out[playerKey(p)] = { ovr, skill, legacy, value: cardValue({ ovr, skill, legacy, tier, tierCount: counts.get(tier) ?? 1, poolSize: rows.length }) };
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

/** Portfolio value per snapshot: each owned card at its finish (cards not yet listed in a snapshot count 0). */
export const portfolioSeries = (history: MarketHistory, owned: Record<string, Finish>) =>
  history.map((s) => ({
    label: s.label,
    date: s.date,
    value: Object.entries(owned).reduce((sum, [k, f]) => sum + (s.players[k] ? finishValue(s.players[k].value, f) : 0), 0),
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
