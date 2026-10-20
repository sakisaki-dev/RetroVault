import { lazy } from 'react';
import type { StatsSub } from './hashRoute';

/**
 * Code-split Stats views. Each sub-tab (and the heavy middle of Players) is its own chunk, so the default Players
 * view loads without the Graph Builder, Deep Dive, Head-to-Head or Teams code. `prefetchStatsSub` warms a chunk
 * (sub-nav hover / focus) so the switch is usually instant.
 */
const loaders = {
  insights: () => import('./PlayersInsights'),
  teams: () => import('../../tabs/TeamRankingsTab'),
  graphs: () => import('../graph/GraphsPage'),
  h2h: () => import('../HeadToHead'),
  deepdive: () => import('../comps/PlayerDeepDive'),
};

export const PlayersInsights = lazy(loaders.insights);
export const TeamRankingsTab = lazy(loaders.teams);
export const GraphsPage = lazy(loaders.graphs);
export const HeadToHead = lazy(loaders.h2h);
export const PlayerDeepDive = lazy(loaders.deepdive);

const warmed = new Set<string>();
export const prefetchStatsSub = (sub: StatsSub | 'insights') => {
  if (sub === 'players' || warmed.has(sub)) return;
  warmed.add(sub);
  loaders[sub]().catch(() => warmed.delete(sub));
};

/** Suspense fallback: a quiet spinner that holds the panel's height so the page doesn't jump. */
export const ViewLoading = ({ label, tall = true }: { label: string; tall?: boolean }) => (
  <div role="status" aria-label={`Loading ${label}`} className={tall ? 'flex min-h-[60vh] items-start justify-center pt-20' : 'flex min-h-[40vh] items-start justify-center pt-12'}>
    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
  </div>
);
