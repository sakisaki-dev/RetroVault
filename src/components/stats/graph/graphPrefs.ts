import { useCallback, useEffect, useState } from 'react';
import type { Navigate } from '../hub/hashRoute';
import { configToParams, paramsToConfig, type GraphConfig } from './graphConfig';

/**
 * Graph Builder memory, per viewer: the recent charts row (localStorage, guarded) and the hand-off that carries a
 * Lab chart's extras (title, custom quadrants, qualifier) into the Graphs tab, which the URL alone doesn't hold.
 */

const RECENT_KEY = 'retroVault:graphRecent';
const RECENT_EVENT = 'retrovault:graph-recent';
const RECENT_MAX = 6;

const keyOfParams = (p: Record<string, string>) => JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]));
/** Stable identity of a chart's shareable part (its URL params). */
export const paramsKey = (c: GraphConfig) => keyOfParams(configToParams(c));

const readRecent = (): GraphConfig[] => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r: unknown) => {
      const c = r && typeof r === 'object' ? paramsToConfig(r as Record<string, string>) : null;
      return c ? [c] : [];
    });
  } catch {
    return [];
  }
};

/** The last few charts the viewer built (newest first, no duplicates). */
export const useRecentGraphs = () => {
  const [recent, setRecent] = useState<GraphConfig[]>(readRecent);
  useEffect(() => {
    const sync = () => setRecent(readRecent());
    window.addEventListener(RECENT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RECENT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const remember = useCallback((c: GraphConfig) => {
    const key = paramsKey(c);
    const next = [c, ...readRecent().filter((r) => paramsKey(r) !== key)].slice(0, RECENT_MAX);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next.map(configToParams)));
    } catch {
      /* storage blocked: the row just stays as it is */
    }
    setRecent(next);
    window.dispatchEvent(new Event(RECENT_EVENT));
  }, []);
  return { recent, remember };
};

let pending: GraphConfig | null = null;

/** The hand-off config if it matches these URL params (fixed-chart extras survive the trip), else null. */
export const peekHandoff = (params: Record<string, string> | undefined): GraphConfig | null =>
  pending && params && paramsKey(pending) === keyOfParams(params) ? pending : null;

export const clearHandoff = () => {
  pending = null;
};

/** Open a chart full page on the Graphs tab (#stats/graphs?gx=…). */
export const openInGraphs = (navigate: Navigate, c: GraphConfig) => {
  pending = c;
  navigate({ tab: 'career', sub: 'graphs', q: configToParams(c) });
};

/** The most recent chart, for the Lab's Graph Builder button. */
export const lastGraph = (): GraphConfig | null => readRecent()[0] ?? null;
