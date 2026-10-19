import { useEffect, useState } from 'react';
import type { Player } from '@/types/player';
import type { LegendPhoto } from '@/config/ovr';
import { loadLegends } from '@/utils/useOfficialOvr';

/**
 * The Commons photo for a real-life legend: the one carried on the player object (games pass GamePlayer),
 * else looked up in legends.json by position + name. Null for league players.
 */
export const useLegendPhoto = (player: Player | null): LegendPhoto | null => {
  const carried = (player as (Player & { photo?: LegendPhoto }) | null)?.photo ?? null;
  const [found, setFound] = useState<LegendPhoto | null>(null);
  const isLegend = !!player?.isRealLegend;
  const name = player?.name;
  const position = player?.position;

  useEffect(() => {
    setFound(null);
    if (!isLegend || carried) return;
    let alive = true;
    loadLegends().then((list) => {
      if (!alive) return;
      const hit = list.find((l) => l.name === name && l.position === position);
      setFound(hit?.photo ?? null);
    });
    return () => {
      alive = false;
    };
  }, [isLegend, carried, name, position]);

  return isLegend ? carried ?? found : null;
};
