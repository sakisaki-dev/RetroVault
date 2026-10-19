import { useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { playerKey } from '@/config/ovr';
import { playerSkillGrades, type Overall } from '@/config/skillGrades';

/**
 * Skill rating for every league player (`POS:Name` → Overall): per-game skills graded against the position,
 * independent of career length and awards. Same math as Deep Dive and Build-a-Legend.
 */
export const useSkillRatings = (): Map<string, Overall> => {
  const { getAllPlayers, dataVersion } = useLeague();
  return useMemo(() => {
    const league = getAllPlayers().filter((p) => !(p as { isRealLegend?: boolean }).isRealLegend);
    const out = new Map<string, Overall>();
    league.forEach((p) => {
      const o = playerSkillGrades(league, p).overall;
      if (o) out.set(playerKey(p), o);
    });
    return out;
    // dataVersion bumps when the league reloads or a player is edited
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllPlayers, dataVersion]);
};
