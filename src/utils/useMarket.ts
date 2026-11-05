import { useEffect, useState } from 'react';
import type { MarketHistory } from '@/utils/cardMarket';
import { expandMarket } from '@/utils/marketHistory';

let request: Promise<MarketHistory> | null = null;
/** The loaded history, once it is in: later mounts render it on their first render (no "Loading" frame) */
let loaded: MarketHistory | null = null;

/**
 * Fetches public/data/market.json once per page load (built by scripts/market_snapshot.ts) and expands its stored
 * changes into full snapshots (utils/marketHistory.ts). Missing or bad → [].
 */
export const loadMarket = (): Promise<MarketHistory> => {
  request ??= fetch(`${import.meta.env.BASE_URL}data/market.json`, { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : []))
    .then((raw: unknown) => expandMarket(raw))
    .then((d) =>
      Array.isArray(d) ? d.filter((s) => s && typeof s.id === 'string' && s.players && typeof s.players === 'object') : [],
    )
    .catch(() => [] as MarketHistory)
    .then((h) => (loaded = h));
  return request;
};

/** Card market history, oldest snapshot first; null while loading. */
export const useMarket = (): MarketHistory | null => {
  const [history, setHistory] = useState<MarketHistory | null>(loaded);
  useEffect(() => {
    if (loaded) return;
    let alive = true;
    loadMarket().then((h) => alive && setHistory(h));
    return () => {
      alive = false;
    };
  }, []);
  return history;
};
