import { useMemo } from 'react';
import type { Player } from '@/types/player';
import { buildContext } from '@/config/advanced';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { useSkillRatings } from '@/utils/useSkillRatings';
import { boardCache, type GraphDeps } from './graphStats';

/** Everything a graph needs to compute any stat, memoised on the league (boards are league-only). */
export const useGraphDeps = (players: Player[]): GraphDeps => {
  const ovrMap = useOfficialOvr();
  const skillMap = useSkillRatings();
  const ctx = useMemo(() => buildContext(players), [players]);
  const board = useMemo(() => boardCache(players, ctx), [players, ctx]);
  return useMemo(() => ({ ctx, ovrMap, skillMap, board }), [ctx, ovrMap, skillMap, board]);
};
