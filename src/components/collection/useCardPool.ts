import { useCallback, useMemo } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { useJerseyNumbers } from '@/utils/jerseys';
import { usePlayerExtras, withSignatureTeam } from '@/utils/playerExtras';
import { useGamePool } from '@/utils/useOfficialOvr';
import { playerKey, type GamePlayer } from '@/config/ovr';
import { faceStatsFor, type FaceStat } from './cardStats';
import { groupByTier, packOdds, tierFor, tierLabel, tierRank, type Tier, type TierPool } from '@/utils/collection';

export interface CardInfo {
  key: string;
  /**
   * The card's player, dressed in his signature team (where he was best known): `player.team` drives the card's
   * jersey, helmet, colours and logo. His current team is `currentTeam`; `franchise` (filters, set order) follows it.
   */
  player: GamePlayer;
  /** His current (or final) team, as in the league data */
  currentTeam: string;
  tier: Tier;
  ovr: number | null;
  number: number;
  retiredBy: string | null;
  /** Franchise label of his current team (NFL nickname, raw team string, or "Free agents"): filters and set order */
  franchise: string;
  /** Franchise label of the card's team (his signature team), shown on the card */
  cardTeam: string;
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
 * Every collectible player: league players in the game pool (league minus game exclusions), in set order
 * (by franchise, then position and name). Real NFL legends are not collectible; they stay in the games only.
 */
export const useCardPool = () => {
  const { league, ovrMap, loaded } = useGamePool();
  const { numberFor, retiredInfo } = useJerseyNumbers();
  const extras = usePlayerExtras();

  const faceStats = useMemo(() => faceStatsFor(league), [league]);
  // Pack pulls hand back card players (already in their signature team): describe from the league row
  const leagueByKey = useMemo(() => new Map(league.map((p) => [playerKey(p), p])), [league]);
  const describe = useCallback(
    (pulled: Player, setNo = 0): CardInfo => {
      const p = leagueByKey.get(playerKey(pulled)) ?? pulled;
      const ovr = ovrMap.get(playerKey(p)) ?? null;
      const tier = tierFor(p, ovr);
      const dressed = withSignatureTeam(extras, p as GamePlayer);
      return {
        key: playerKey(p),
        player: dressed,
        currentTeam: p.team ?? '',
        tier,
        ovr,
        number: numberFor(p),
        retiredBy: retiredInfo(p)?.teamLabel ?? null,
        franchise: franchiseOf(p),
        cardTeam: franchiseOf(dressed),
        setNo,
        hint: hintFor(tier),
        stats: faceStats(p),
      };
    },
    [leagueByKey, ovrMap, numberFor, retiredInfo, faceStats, extras],
  );

  const cards = useMemo<CardInfo[]>(() => {
    const byName = (a: Player, b: Player) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
    const lg = league.filter((p) => !p.isRealLegend).sort((a, b) => franchiseOf(a).localeCompare(franchiseOf(b)) || byName(a, b));
    return lg.map((p, i) => describe(p, i + 1));
  }, [league, describe]);

  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);
  const tierPool = useMemo<TierPool>(() => {
    const g = groupByTier(cards, (c) => c.tier);
    return { common: g.common.map((c) => c.player), rare: g.rare.map((c) => c.player), epic: g.epic.map((c) => c.player), legendary: g.legendary.map((c) => c.player) };
  }, [cards]);

  return { cards, byKey, tierPool, describe, loaded };
};

export const byTierDesc = (a: CardInfo, b: CardInfo) => tierRank(b.tier) - tierRank(a.tier) || (b.ovr ?? 0) - (a.ovr ?? 0);
