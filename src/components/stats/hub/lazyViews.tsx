import { lazy } from 'react';
import PixelLoader from '@/components/ui/PixelLoader';
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
  clock: () => import('../../clock/ClockPage'),
};

export const PlayersInsights = lazy(loaders.insights);
export const TeamRankingsTab = lazy(loaders.teams);
export const GraphsPage = lazy(loaders.graphs);
export const HeadToHead = lazy(loaders.h2h);
export const PlayerDeepDive = lazy(loaders.deepdive);
export const ClockPage = lazy(loaders.clock);

const warmed = new Set<string>();
export const prefetchStatsSub = (sub: StatsSub | 'insights') => {
  if (sub === 'players' || warmed.has(sub)) return;
  warmed.add(sub);
  loaders[sub]().catch(() => warmed.delete(sub));
};

/** Suspense fallback: the pixel football, holding the panel's height so the page doesn't jump (it shows after ~180 ms). */
export const ViewLoading = ({ label, tall = true }: { label: string; tall?: boolean }) => (
  <PixelLoader what={label} label="Loading" minHeight={tall ? '60vh' : '40vh'} className={tall ? 'justify-start pt-20' : 'justify-start pt-12'} />
);
