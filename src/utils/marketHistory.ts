/**
 * Market history storage: changes only (the reader and writer for data/y80/market_history.json and
 * public/data/market.json; scripts/market_history.py is the Python reader, and the two must agree).
 *
 * The file is { format: 2, keyframeEvery: N, snapshots: [...] }, oldest first. Each stored snapshot carries its meta
 * (id, label, date, season?, upload?) and either
 *   players: { "POS:Name": point }           a keyframe: every player in full (the first, the latest, and every
 *                                             Nth snapshot, so any snapshot rebuilds from the nearest keyframe)
 *   delta:   { set?, unset?, removed?, at?, order? }   the changes since the snapshot before it:
 *     set      { key: fields }   fields that changed (a whole point for a player added in this snapshot; `s`, the
 *                                career totals, is replaced whole)
 *     unset    { key: [field] }  fields a point no longer has (e.g. a grade dropped)
 *     removed  [key]             players no longer in the snapshot (the explicit removal marker)
 *     at       { key: index }    where an added player sits in the snapshot's player order
 *     order    [key]             the full player order, only when it isn't the previous order (minus removed) with
 *                                the added players inserted at `at`
 * Points keep the field order ovr, skill, legacy, value, grade, s (then any others).
 *
 * expandMarket() returns the full snapshots, exactly as the old full-snapshot file stored them; compactMarket() is
 * the inverse (and checks itself: it throws if the stored form does not expand back to the same history). A plain
 * array (the old format) expands as is, so either file layout reads.
 */
import type { MarketHistory, MarketPoint, MarketSnapshot } from '@/utils/cardMarket';

export const MARKET_FORMAT = 2;
export const KEYFRAME_EVERY = 10;
const FIELD_ORDER = ['ovr', 'skill', 'legacy', 'value', 'grade', 's'];

type Point = Record<string, unknown>;
export interface MarketDelta {
  set?: Record<string, Point>;
  unset?: Record<string, string[]>;
  removed?: string[];
  at?: Record<string, number>;
  order?: string[];
}
export type StoredSnapshot = Omit<MarketSnapshot, 'players'> & { players?: MarketSnapshot['players']; delta?: MarketDelta };
export interface StoredMarket {
  format: number;
  keyframeEvery: number;
  snapshots: StoredSnapshot[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A point with its fields in the canonical order (known fields first, others after in their own order). */
const ordered = (p: Point): Point => {
  const out: Point = {};
  FIELD_ORDER.forEach((f) => f in p && (out[f] = p[f]));
  Object.keys(p).forEach((f) => !(f in out) && (out[f] = p[f]));
  return out;
};

/** The keyframe rule: the first, every Nth and the latest snapshot are stored in full. */
export const isKeyframe = (i: number, n: number, every = KEYFRAME_EVERY) => i === 0 || i === n - 1 || i % every === 0;

/** Full snapshots from either file layout (the old full array, or the delta format). Bad entries are skipped. */
export const expandMarket = (raw: unknown): MarketHistory => {
  if (Array.isArray(raw)) return raw as MarketHistory;
  if (!isObj(raw) || !Array.isArray(raw.snapshots)) return [];
  const out: MarketHistory = [];
  let prev: Record<string, MarketPoint> | null = null;
  for (const s of raw.snapshots as StoredSnapshot[]) {
    if (!isObj(s)) continue;
    const { players, delta: rawDelta, ...meta } = s;
    const delta = rawDelta as MarketDelta | undefined;
    let full: Record<string, MarketPoint>;
    if (isObj(players)) full = players as Record<string, MarketPoint>;
    else if (delta && typeof delta === 'object' && prev) {
      const removed = new Set(delta.removed ?? []);
      const set = delta.set ?? {};
      const unset = delta.unset ?? {};
      let order = Object.keys(prev).filter((k) => !removed.has(k));
      if (delta.order) order = delta.order;
      else {
        const known = new Set(order);
        Object.entries(delta.at ?? {})
          .filter(([k]) => !known.has(k))
          .sort((a, b) => a[1] - b[1])
          .forEach(([k, i]) => order.splice(i, 0, k));
        Object.keys(set).forEach((k) => !known.has(k) && !(k in (delta.at ?? {})) && order.push(k));
      }
      full = {};
      for (const k of order) {
        const p: Point = { ...((prev[k] as unknown as Point) ?? {}), ...(set[k] ?? {}) };
        (unset[k] ?? []).forEach((f) => delete p[f]);
        full[k] = ordered(p) as unknown as MarketPoint;
      }
    } else continue;
    out.push({ ...(meta as Omit<MarketSnapshot, 'players'>), players: full });
    prev = full;
  }
  return out;
};

/** The changes from one snapshot's players to the next one's. */
const diff = (prev: Record<string, MarketPoint>, cur: Record<string, MarketPoint>): MarketDelta => {
  const d: MarketDelta = {};
  const set: Record<string, Point> = {};
  const unset: Record<string, string[]> = {};
  const removed = Object.keys(prev).filter((k) => !(k in cur));
  const at: Record<string, number> = {};
  const curKeys = Object.keys(cur);
  curKeys.forEach((k, i) => {
    const a = prev[k] as unknown as Point | undefined;
    const b = cur[k] as unknown as Point;
    if (!a) {
      set[k] = b;
      at[k] = i;
      return;
    }
    const changed: Point = {};
    Object.keys(b).forEach((f) => !same(a[f], b[f]) && (changed[f] = b[f]));
    if (Object.keys(changed).length) set[k] = changed;
    const gone = Object.keys(a).filter((f) => !(f in b));
    if (gone.length) unset[k] = gone;
  });
  if (Object.keys(set).length) d.set = set;
  if (Object.keys(unset).length) d.unset = unset;
  if (removed.length) d.removed = removed;
  if (Object.keys(at).length) d.at = at;
  // The order rule (previous minus removed, added inserted at `at`); spell the order out only when it doesn't hold
  const gone = new Set(removed);
  const derived = Object.keys(prev).filter((k) => !gone.has(k));
  Object.entries(at)
    .sort((x, y) => x[1] - y[1])
    .forEach(([k, i]) => derived.splice(i, 0, k));
  if (!same(derived, curKeys)) {
    d.order = curKeys;
    delete d.at;
  }
  return d;
};

/** The stored (delta) form of a full history. Throws if it would not expand back to exactly the same snapshots. */
export const compactMarket = (history: MarketHistory, every = KEYFRAME_EVERY): StoredMarket => {
  const snapshots = history.map((s, i): StoredSnapshot => {
    const { players, ...meta } = s;
    if (isKeyframe(i, history.length, every)) return { ...meta, players };
    return { ...meta, delta: diff(history[i - 1].players, players) };
  });
  const stored = { format: MARKET_FORMAT, keyframeEvery: every, snapshots };
  if (!same(expandMarket(stored), history)) throw new Error('market history: the delta form does not expand back to the same snapshots');
  return stored;
};
