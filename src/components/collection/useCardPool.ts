import { useCallback, useMemo } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useGamePool } from '@/utils/useOfficialOvr';
import { playerKey, type GamePlayer } from '@/config/ovr';
import { rarityFor, rarityRank, unlockHint, type Rarity } from '@/utils/collection';

export interface CardInfo {
  key: string;
  player: GamePlayer;
  rarity: Rarity;
  ovr: number | null;
  number: number;
  retiredBy: string | null;
  /** Franchise label (NFL nickname, raw team string, or "Free agents") */
  franchise: string;
  setNo: number;
  hint: string;
}

const franchiseOf = (p: Player) => findNFLTeam(p.team)?.name ?? (p.team?.trim() || 'Free agents');

/**
 * Every collectible card: the game pool (league minus game exclusions, plus the real NFL legends),
 * in set order (league by franchise, then position and name; legends last).
 */
export const useCardPool = () => {
  const { league, legends, ovrMap, loaded } = useGamePool();
  const { numberFor, retiredInfo } = useJerseyNumbers();

  const describe = useCallback(
    (p: Player, setNo = 0): CardInfo => {
      const ovr = ovrMap.get(playerKey(p)) ?? null;
      const rarity = rarityFor(p, ovr);
      return {
        key: playerKey(p),
        player: p as GamePlayer,
        rarity,
        ovr,
        number: numberFor(p),
        retiredBy: p.isRealLegend ? null : retiredInfo(p)?.teamLabel ?? null,
        franchise: p.isRealLegend ? 'NFL Legends' : franchiseOf(p),
        setNo,
        hint: unlockHint(p, rarity),
      };
    },
    [ovrMap, numberFor, retiredInfo],
  );

  const cards = useMemo<CardInfo[]>(() => {
    const byName = (a: Player, b: Player) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
    const lg = [...league].sort((a, b) => franchiseOf(a).localeCompare(franchiseOf(b)) || byName(a, b));
    const lgd = [...legends].sort(byName);
    return [...lg, ...lgd].map((p, i) => describe(p, i + 1));
  }, [league, legends, describe]);

  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);
  const rarityOf = useCallback((p: Player) => byKey.get(playerKey(p))?.rarity ?? rarityFor(p, null), [byKey]);

  return { cards, byKey, rarityOf, describe, loaded };
};

export const byRarityDesc = (a: CardInfo, b: CardInfo) => rarityRank(b.rarity) - rarityRank(a.rarity) || (b.ovr ?? 0) - (a.ovr ?? 0);
