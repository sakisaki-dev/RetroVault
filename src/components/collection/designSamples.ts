import { TIERS, tierRank, type Finish, type PackCard, type Tier } from '@/utils/collection';
import type { CardInfo } from './useCardPool';

/** Preferred faces for the Legendary row (owner's picks), then the best by OVR. */
const LEGENDARY_PICKS = ['Sherman Brandson', 'God Johnson'];

export interface DesignRow {
  key: string;
  label: string;
  tier: Tier;
  info: CardInfo;
}

/**
 * One representative player per tier (league players, different positions where possible), plus a real NFL
 * legend row because legends use photo art.
 */
export const designRows = (cards: CardInfo[]): DesignRow[] => {
  const league = cards.filter((c) => !c.player.isRealLegend);
  const used = new Set<string>();
  const rows: DesignRow[] = [];
  [...TIERS].reverse().forEach(({ key: tier, label }) => {
    const list = league.filter((c) => c.tier === tier).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0));
    const pick =
      (tier === 'legendary' ? LEGENDARY_PICKS.map((n) => list.find((c) => c.player.name === n)).find(Boolean) : undefined) ??
      list.find((c) => !used.has(c.player.position)) ??
      list[0];
    if (!pick) return;
    used.add(pick.player.position);
    rows.push({ key: tier, label, tier, info: pick });
  });
  const legend = cards
    .filter((c) => c.player.isRealLegend && c.player.photo?.url)
    .sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || (b.ovr ?? 0) - (a.ovr ?? 0))[0];
  if (legend) rows.push({ key: 'nfl', label: 'NFL Legend', tier: legend.tier, info: legend });
  return rows;
};

/** Sample pack for the preview opening: one of each tier rising in finish, ending on a Legendary Holo. */
export const samplePack = (rows: DesignRow[]): PackCard[] => {
  const finishes: Record<string, Finish> = { common: 'base', rare: 'silver', epic: 'gold', legendary: 'holo', nfl: 'gold' };
  const order = ['common', 'rare', 'nfl', 'epic', 'legendary'];
  return order
    .map((k) => rows.find((r) => r.key === k))
    .filter((r): r is DesignRow => !!r)
    .map((r) => ({ player: r.info.player, tier: r.tier, finish: finishes[r.key], slot: 'regular' as const, isNew: true, upgrade: false, duplicate: false, shards: 0 }));
};
