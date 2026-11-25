import { useEffect, useState } from 'react';
import type { MarketHistory } from '@/utils/cardMarket';
import { expandMarket } from '@/utils/marketHistory';
import { dataFetch } from '@/utils/dataStore';

let request: Promise<MarketHistory> | null = null;
/** The loaded history, once it is in: later mounts render it on their first render (no "Loading" frame) */
let loaded: MarketHistory | null = null;

/**
 * Fetches public/data/market.json once per page load (built by scripts/market_snapshot.ts) and expands its stored
 * changes into full snapshots (utils/marketHistory.ts). Missing or bad → [].
 */
export const loadMarket = (): Promise<MarketHistory> => {
  request ??= dataFetch(`${import.meta.env.BASE_URL}data/market.json`, { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : []))
    .then((raw: unknown) => expandMarket(raw))
    .then((d) =>
      Array.isArray(d) ? d.filter((s) => s && typeof s.id === 'string' && s.players && typeof s.players === 'object') : [],
    )
    .catch(() => [] as MarketHistory)
    .then((h) => (loaded = h));
  return request;
};

let latestRequest: Promise<MarketHistory> | null = null;
/** The last two snapshots, once they are in */
let latestLoaded: MarketHistory | null = null;

/**
 * The small file (public/data/market-latest.json, built by scripts/market_snapshot.ts: the last two snapshots in full) that
 * everything pricing a card reads: its latest value, the day's change, tiers. The full history (market.json, ~3 MB) is
 * for the views that draw history. Falls back to the full file when the small one is missing (an older build).
 */
export const loadMarketLatest = (): Promise<MarketHistory> => {
  if (loaded) return Promise.resolve(loaded.slice(-2));
  latestRequest ??= dataFetch(`${import.meta.env.BASE_URL}data/market-latest.json`, { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .then((raw: unknown) => (Array.isArray(raw) && raw.length ? raw.filter((s) => s && typeof s.id === 'string' && s.players && typeof s.players === 'object') : loadMarket().then((h) => h.slice(-2))))
    .catch(() => loadMarket().then((h) => h.slice(-2)))
    .then((h) => (latestLoaded = h as MarketHistory));
  return latestRequest;
};

/**
 * The last two snapshots (oldest first, so `history[history.length - 1]` is the latest); null while loading. Same values
 * as the end of `useMarket()`, without waiting for the whole history.
 */
export const useMarketLatest = (): MarketHistory | null => {
  const [history, setHistory] = useState<MarketHistory | null>(() => (loaded ? loaded.slice(-2) : latestLoaded));
  useEffect(() => {
    let alive = true;
    loadMarketLatest().then((h) => alive && setHistory(h));
    return () => {
      alive = false;
    };
  }, []);
  return history;
};

/** Card market history, oldest snapshot first; null while loading. */
export const useMarket = (): MarketHistory | null => {
  const [history, setHistory] = useState<MarketHistory | null>(loaded);
  useEffect(() => {
    // Loaded between this render and the effect (another view fetched it): take it now
    if (loaded) return void setHistory(loaded);
    let alive = true;
    loadMarket().then((h) => alive && setHistory(h));
    return () => {
      alive = false;
    };
  }, []);
  return history;
};
