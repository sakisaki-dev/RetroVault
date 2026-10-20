import { TIERS, type Finish, type PackCard, type Tier, type Variant } from '@/utils/collection';
import type { CardInfo } from './useCardPool';

/** Preferred faces for the Legendary row (owner's picks), then the best by OVR. */
const LEGENDARY_PICKS = ['Sherman Brandson', 'God Johnson'];

export interface DesignRow {
  key: string;
  label: string;
  tier: Tier;
  info: CardInfo;
}

/** One representative league player per tier (different positions where possible). */
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
  return rows;
};

/**
 * Sample pack for the preview opening (Card designs). Shows every reveal: a Common and a Rare flip in about a
 * second, two Epics walk out, and the Legendary closes the pack with a full Legendary walkout
 * and the hidden-holo twist. Each card shows a different art variant; the Legendary is a sprite (8-bit beat). It is shown in an Elite pack, so nothing on the pack hints at the holo.
 */
export const samplePack = (rows: DesignRow[], cards: CardInfo[] = []): PackCard[] => {
  const finishes: Record<string, Finish> = { common: 'base', rare: 'silver', epic: 'gold', epic2: 'silver', legendary: 'holo' };
  // Every art variant once, the sprite last (its 8-bit beat, then the holo twist)
  const variants: Record<string, Variant> = { common: 'number', rare: 'jersey', epic: 'topps', epic2: 'locker', legendary: 'sprite' };
  const epic = rows.find((r) => r.key === 'epic');
  // A second Epic (another position) fills the fifth slot
  const second = epic && cards.filter((c) => c.tier === 'epic' && c.player.position !== epic.info.player.position).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0))[0];
  const all = second ? [...rows, { key: 'epic2', label: 'Epic', tier: 'epic' as const, info: second }] : rows;
  const order = ['common', 'rare', 'epic', 'epic2', 'legendary'];
  return order
    .map((k) => all.find((r) => r.key === k))
    .filter((r): r is DesignRow => !!r)
    .map((r) => ({
      player: r.info.player,
      tier: r.tier,
      finish: finishes[r.key],
      variant: variants[r.key],
      slot: 'regular' as const,
      isNew: true,
      newVariant: false,
      upgrade: false,
      duplicate: false,
      shards: 0,
    }));
};
