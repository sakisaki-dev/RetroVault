import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Tiny hash router for the single-page hub. The URL hash mirrors the visible page so tabs are linkable
 * and the back button works:
 *
 *   #games                       top-level tab (games, stats, hof, collection, timeline, office)
 *   #stats/teams                 Stats sub-tab (players, teams, graphs, h2h, deepdive)
 *   #stats/players/leaders       ...plus a section id to scroll to inside the sub-tab
 *   #stats/deepdive?p=QB:Name    Player Deep Dive with a player preselected
 *   #stats/graphs?gx=ya&gy=intPct&pos=QB    Graph Builder on a shared chart (stats/graph/graphConfig);
 *                                            the old #stats/players?gx=… links land there too
 *   #lab?t=<lineup>              Team Lab with a lineup (utils/teamLab encodeLineup)
 *
 * Old in-page anchors (#leaders, #head-to-head, #comp-finder, ...) and the retired #teams tab still resolve.
 * Unknown hashes are ignored (the current page stays), so plain in-page anchors keep working.
 */

export const STATS_SUBS = ['players', 'teams', 'graphs', 'h2h', 'deepdive'] as const;
export type StatsSub = (typeof STATS_SUBS)[number];

/** Internal tab ids (as used by Header / Index) → hash names. */
const TAB_TO_HASH: Record<string, string> = { career: 'stats' };
const HASH_TO_TAB: Record<string, string> = { stats: 'career', arcade: 'games' };
const KNOWN_TABS = new Set(['games', 'career', 'lab', 'hof', 'collection', 'timeline', 'office']);

/** Legacy section anchors from the old one-page Stats layout → where they live now. */
const LEGACY_SECTIONS: Record<string, { sub: StatsSub; section?: string }> = {
  'record-book': { sub: 'players', section: 'record-book' },
  efficiency: { sub: 'players', section: 'efficiency' },
  leaders: { sub: 'players', section: 'leaders' },
  tables: { sub: 'players', section: 'tables' },
  analytics: { sub: 'players', section: 'analytics' },
  advanced: { sub: 'players', section: 'analytics' },
  'head-to-head': { sub: 'h2h' },
  'comp-finder': { sub: 'deepdive' },
};

export interface Route {
  tab: string;
  sub?: StatsSub;
  section?: string;
  /** Player key ("POS:Name") for Comps / Map deep links. */
  p?: string;
  /** Team Lab lineup (encodeLineup) */
  t?: string;
  /** Other Stats query params, e.g. the Graph Builder's gx / gy / pos (stats/graph/graphConfig GRAPH_PARAMS). */
  q?: Record<string, string>;
}

const isSub = (s: string | undefined): s is StatsSub => !!s && (STATS_SUBS as readonly string[]).includes(s);

export const parseHash = (hash: string): Route | null => {
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return null;
  const [path, query = ''] = raw.split('?');
  const segs = path.split('/').map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const params = new URLSearchParams(query);
  const p = params.get('p') || undefined;
  const head = segs[0].toLowerCase();

  if (head === 'teams') return { tab: 'career', sub: 'teams' };
  if (LEGACY_SECTIONS[head]) return { tab: 'career', ...LEGACY_SECTIONS[head] };

  const tab = HASH_TO_TAB[head] ?? head;
  if (!KNOWN_TABS.has(tab)) return null;
  if (tab === 'career') {
    const alias: Record<string, StatsSub> = { compare: 'h2h', comps: 'deepdive', 'deep-dive': 'deepdive', graph: 'graphs', 'graph-builder': 'graphs' };
    // The Analytics Lab now lives on the Players sub-tab
    if (segs[1] === 'advanced') return { tab, sub: 'players', section: 'analytics', p };
    const sub = isSub(segs[1]) ? segs[1] : alias[segs[1]];
    const q: Record<string, string> = {};
    params.forEach((v, k) => {
      if (k !== 'p') q[k] = v;
    });
    // Graph Builder links from before the Graphs tab (#stats/players?gx=…) open the Graphs tab.
    if (q.gx && q.gy && (!sub || sub === 'players')) return { tab, sub: 'graphs', q };
    return Object.keys(q).length ? { tab, sub, section: segs[2] || undefined, p, q } : { tab, sub, section: segs[2] || undefined, p };
  }
  const t = params.get('t') || undefined;
  return t ? { tab, p, t } : { tab, p };
};

export const buildHash = (r: Route): string => {
  let h = `#${TAB_TO_HASH[r.tab] ?? r.tab}`;
  if (r.tab === 'career' && r.sub) {
    h += `/${r.sub}`;
    if (r.section) h += `/${encodeURIComponent(r.section)}`;
  }
  if (r.p) h += `?p=${encodeURIComponent(r.p)}`;
  if (r.t) h += `${r.p ? '&' : '?'}t=${encodeURIComponent(r.t).replace(/%20/g, '+')}`;
  if (r.tab === 'career' && r.q) {
    const qs = new URLSearchParams(r.q).toString();
    if (qs) h += `${h.includes('?') ? '&' : '?'}${qs}`;
  }
  return h;
};

const sameRoute = (a: Route, b: Route) => buildHash(a) === buildHash(b);

/**
 * The current route, kept in sync with the URL hash. `navigate` pushes a history entry (or replaces with
 * `{ replace: true }`). Re-navigating to the Stats tab without a sub-tab returns to the last one used.
 */
export const useHashRoute = (defaultTab = 'games') => {
  const lastSub = useRef<StatsSub>('players');
  const read = useCallback((): Route => {
    const r = typeof window === 'undefined' ? null : parseHash(window.location.hash);
    return r ?? { tab: defaultTab };
  }, [defaultTab]);
  const [route, setRoute] = useState<Route>(() => {
    const r = read();
    return r.tab === 'career' && !r.sub ? { ...r, sub: 'players' } : r;
  });
  const routeRef = useRef(route);
  routeRef.current = route;
  if (route.sub) lastSub.current = route.sub;

  useEffect(() => {
    const sync = () => {
      const r = parseHash(window.location.hash);
      if (!r) return; // plain anchor: stay where we are
      const next = r.tab === 'career' && !r.sub ? { ...r, sub: lastSub.current } : r;
      if (!sameRoute(next, routeRef.current)) setRoute(next);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((to: Route, opts?: { replace?: boolean }) => {
    const next: Route = to.tab === 'career' && !to.sub ? { ...to, sub: lastSub.current } : to;
    const hash = buildHash(next);
    if (hash !== window.location.hash) {
      if (opts?.replace) window.history.replaceState(window.history.state, '', hash);
      else window.history.pushState(null, '', hash);
    }
    if (!sameRoute(next, routeRef.current)) setRoute(next);
  }, []);

  return { route, navigate };
};

export type Navigate = (to: Route, opts?: { replace?: boolean }) => void;

/** Route + navigate for pages under Index (Stats hub, Map). Index provides it. */
export const HubRouteContext = createContext<{ route: Route; navigate: Navigate }>({
  route: { tab: 'games' },
  navigate: () => undefined,
});

export const useHubRoute = () => useContext(HubRouteContext);
