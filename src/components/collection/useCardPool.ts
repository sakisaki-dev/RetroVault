import { useCallback, useMemo } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useGamePool } from '@/utils/useOfficialOvr';
import { playerKey, type GamePlayer } from '@/config/ovr';
import { faceStatsFor, type FaceStat } from './cardStats';
import { groupByTier, packOdds, tierFor, tierLabel, tierRank, type Tier, type TierPool } from '@/utils/collection';

export interface CardInfo {
  key: string;
  player: GamePlayer;
  tier: Tier;
  ovr: number | null;
  number: number;
  retiredBy: string | null;
  /** Franchise label (NFL nickname, raw team string, or "Free agents") */
  franchise: string;
  setNo: number;
  hint: string;
  /** Six 0–99 face stats (FUT layout) */
  stats: FaceStat[];
}

const franchiseOf = (p: Player) => findNFLTeam(p.team)?.name ?? (p.team?.trim() || 'Free agents');

const STANDARD = packOdds('standard');
const fmtPct = (x: number) => `${x >= 0.1 ? Math.round(x * 100) : (x * 100).toFixed(1)}%`;
/** Locked-card hint: where it comes from and how rare its tier is. */
const hintFor = (tier: Tier) => `${tierLabel(tier)} · ${fmtPct(STANDARD.tiers[tier])} of Standard pulls`;

/**
 * Every collectible player: the game pool (league minus game exclusions, plus the real NFL legends),
 * in set order (league by franchise, then position and name; legends last).
 */
export const useCardPool = () => {
  const { league, legends, ovrMap, loaded } = useGamePool();
  const { numberFor, retiredInfo } = useJerseyNumbers();

  const faceStats = useMemo(() => faceStatsFor(league), [league]);
  const describe = useCallback(
    (p: Player, setNo = 0): CardInfo => {
      const ovr = ovrMap.get(playerKey(p)) ?? null;
      const tier = tierFor(p, ovr);
      return {
        key: playerKey(p),
        player: p as GamePlayer,
        tier,
        ovr,
        number: numberFor(p),
        retiredBy: (p as GamePlayer).isRealLegend ? null : retiredInfo(p)?.teamLabel ?? null,
        franchise: (p as GamePlayer).isRealLegend ? 'NFL Legends' : franchiseOf(p),
        setNo,
        hint: hintFor(tier),
        stats: faceStats(p),
      };
    },
    [ovrMap, numberFor, retiredInfo, faceStats],
  );

  const cards = useMemo<CardInfo[]>(() => {
    const byName = (a: Player, b: Player) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
    const lg = [...league].sort((a, b) => franchiseOf(a).localeCompare(franchiseOf(b)) || byName(a, b));
    const lgd = [...legends].sort(byName);
    return [...lg, ...lgd].map((p, i) => describe(p, i + 1));
  }, [league, legends, describe]);

  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);
  const tierPool = useMemo<TierPool>(() => {
    const g = groupByTier(cards, (c) => c.tier);
    return { common: g.common.map((c) => c.player), rare: g.rare.map((c) => c.player), epic: g.epic.map((c) => c.player), legendary: g.legendary.map((c) => c.player) };
  }, [cards]);

  return { cards, byKey, tierPool, describe, loaded };
};

export const byTierDesc = (a: CardInfo, b: CardInfo) => tierRank(b.tier) - tierRank(a.tier) || (b.ovr ?? 0) - (a.ovr ?? 0);
