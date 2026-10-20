import { tierLabel, type Tier } from '@/utils/collection';
import { findNFLTeam } from '@/utils/nflTeams';
import type { CardInfo } from '../useCardPool';

export interface ArtSample {
  key: string;
  label: string;
  tier: Tier;
  info: CardInfo;
}

const WANT: { key: string; tier: Tier; pos: string[]; prefer?: string }[] = [
  { key: 'qb', tier: 'legendary', pos: ['QB'], prefer: 'Sherman Brandson' },
  { key: 'rb', tier: 'epic', pos: ['RB'] },
  { key: 'wr', tier: 'rare', pos: ['WR'] },
  { key: 'def', tier: 'common', pos: ['LB', 'DL', 'DB'] },
];

/**
 * Four league players for the Art lab: a Legendary QB (Sherman Brandson when present), an Epic RB, a Rare WR and a
 * Common defender, each on a different team so the art is seen in several colour schemes. Falls back to any tier.
 */
export const artSamples = (cards: CardInfo[]): ArtSample[] => {
  const league = cards.filter((c) => !c.player.isRealLegend && findNFLTeam(c.player.team));
  const teams = new Set<string>();
  const out: ArtSample[] = [];
  WANT.forEach((w) => {
    const byPos = league.filter((c) => w.pos.includes(c.player.position)).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0));
    const fresh = (c: CardInfo) => !teams.has(findNFLTeam(c.player.team)!.name);
    const pick =
      (w.prefer ? byPos.find((c) => c.player.name === w.prefer) : undefined) ??
      byPos.find((c) => c.tier === w.tier && fresh(c)) ??
      byPos.find((c) => c.tier === w.tier) ??
      byPos.find(fresh) ??
      byPos[0];
    if (!pick) return;
    teams.add(findNFLTeam(pick.player.team)!.name);
    out.push({ key: w.key, label: `${tierLabel(pick.tier)} ${pick.player.position}`, tier: pick.tier, info: pick });
  });
  return out;
};
