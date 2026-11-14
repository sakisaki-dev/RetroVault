import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { playerKey } from '@/config/ovr';
import { playerSkillGrades, type Overall } from '@/config/skillGrades';

/*
 * One computation per league load: the Stats page, the player card and quick search all mount this hook, and each
 * tab switch remounts them, so the map is kept at module level for the current league data and data version.
 */
let cached: { data: unknown; version: number; map: Map<string, Overall> } | null = null;

/**
 * Skill rating for every league player (`POS:Name` → Overall): per-game skills graded against the position,
 * independent of career length and awards. Same math as Deep Dive and Build-a-Legend.
 */
export const useSkillRatings = (): Map<string, Overall> => {
  const { getAllPlayers, dataVersion, careerData } = useLeague();
  return useMemo(() => {
    if (cached && cached.data === careerData && cached.version === dataVersion) return cached.map;
    const league = getAllPlayers().filter((p) => !(p as { isRealLegend?: boolean }).isRealLegend);
    const out = new Map<string, Overall>();
    league.forEach((p) => {
      const o = playerSkillGrades(league, p).overall;
      if (o) out.set(playerKey(p), o);
    });
    if (careerData) cached = { data: careerData, version: dataVersion, map: out };
    return out;
    // dataVersion bumps when the league reloads or a player is edited
  }, [getAllPlayers, dataVersion, careerData]);
};
