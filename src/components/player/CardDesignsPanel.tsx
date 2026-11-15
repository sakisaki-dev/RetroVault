import { useMemo } from 'react';
import { Gem, Lock } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { playerKey } from '@/config/ovr';
import {
  FINISHES,
  PACKS,
  VARIANTS,
  bestParallel,
  displayOf,
  finishLabel,
  prizmInfo,
  tierLabel,
  useCollection,
  variantWeights,
  type Finish,
  type Tier,
  type Variant,
} from '@/utils/collection';
import CollectibleCard from '@/components/collection/CollectibleCard';
import { bestKit } from '@/components/collection/kits';
import { useCardPool } from '@/components/collection/useCardPool';
import { FINISH_ICON } from '@/components/collection/rarityIcons';
import './cardDesigns.css';
import PixelLoader from '@/components/ui/PixelLoader';

const BEST_FINISH: Finish = FINISHES[FINISHES.length - 1].key;
const share = <K extends string>(w: Record<K, number>, k: K) => w[k] / Object.values<number>(w).reduce((a, b) => a + b, 0);

/**
 * Chance that one card from a Standard pack is THIS player's card in `variant` at the best finish (Holo), from the
 * pack code's own tables (src/utils/collection.ts, the same ones rollPack draws from):
 *   P(his tier)            PACKS.standard.tiers
 * × P(Holo | his tier)     PACKS.standard.finishes[tier]
 * × P(variant | tier, Holo) variantWeights('standard', tier, 'holo'): VARIANT_ODDS × VARIANT_STACK tier and finish
 *                           factors × any VARIANT_COMBO penalty, normalised over the five arts
 * ÷ players in his tier    rollPack picks a player of the rolled tier evenly
 * Only the third factor differs between his arts, so his rarest variant is the one with the smallest stacked weight
 * at his tier and Holo: the Autograph for every tier today (and rarest of all for a Legendary, where VARIANT_COMBO
 * cuts it to 0.15 more), but it is computed from the tables, so a change to the odds moves the label with it.
 */
const variantPullChance = (tier: Tier, variant: Variant, tierSize: number) => {
  const spec = PACKS.standard;
  return (
    share(spec.tiers, tier) * share(spec.finishes[tier], BEST_FINISH) * share(variantWeights('standard', tier, BEST_FINISH), variant) / Math.max(1, tierSize)
  );
};

const oneIn = (p: number) => {
  const n = 1 / p;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3).toLocaleString()}K`;
  return Math.round(n).toLocaleString();
};

/**
 * The player card's Card designs tab: his collectible in every art, as the Collection draws it. Owned arts show the
 * owner's best finish there with its best kit and rarest Prizm parallel (as the binder does); arts not pulled yet show
 * the Base design dimmed under a lock. The Autograph is his best owned one, else a sample (as the galleries). Cards are
 * timeless: the face carries nothing but what the binder's tile carries. The row scrolls sideways on a phone
 * (data-no-swipe-x keeps the card's swipe-to-close off it) and becomes a five-up grid from 768px.
 */
const CardDesignsPanel = ({ player }: { player: Player }) => {
  const { byKey, tierPool, loaded, cards } = useCardPool();
  const { state } = useCollection();
  const key = playerKey(player);
  const info = byKey.get(key);
  const owned = state.cards[key];
  const shown = owned ? displayOf(owned, state.display?.[key]) : null;

  const rows = useMemo(() => {
    if (!info) return [];
    const size = tierPool[info.tier].length;
    const list = VARIANTS.map(({ key: v, label }) => {
      const vc = owned?.variants[v];
      const finish: Finish = vc?.best ?? 'base';
      return {
        v,
        label,
        owned: !!vc,
        finish,
        copies: vc ? Object.values(vc.counts).reduce<number>((a, b) => a + (b ?? 0), 0) : 0,
        kit: vc ? bestKit(owned, info.player, v, finish)?.id : undefined,
        prizm: vc ? bestParallel(owned, v, finish) : undefined,
        chance: variantPullChance(info.tier, v, size),
      };
    });
    const rarest = list.reduce((a, b) => (b.chance < a.chance ? b : a));
    return list.map((r) => ({ ...r, rarest: r.v === rarest.v }));
  }, [info, owned, tierPool]);

  if (!loaded && !cards.length) return <PixelLoader size="sm" label="Cards" what="cards" minHeight={220} />;
  if (!info) return <p className="py-8 text-center text-sm text-muted-foreground">{player.name} has no collectible card.</p>;

  const ownedCount = rows.filter((r) => r.owned).length;
  const rarest = rows.find((r) => r.rarest)!;
  return (
    <div className="cdz">
      <div className="cdz__head">
        <span className={cn('cdz__tier', `cdz__tier--${info.tier}`)}>{tierLabel(info.tier)}</span>
        <span className="cdz__count">
          <b>{ownedCount}</b> of {rows.length} arts pulled
        </span>
        <span className="cdz__rare">
          <Gem className="h-3.5 w-3.5" aria-hidden="true" />
          Rarest pull: {rarest.label} {finishLabel(BEST_FINISH)}, 1 in {oneIn(rarest.chance)} cards
        </span>
      </div>

      <ul className="cdz__row" data-no-swipe-x aria-label={`${player.name}'s card designs`}>
        {rows.map((r) => {
          const FIcon = FINISH_ICON[r.finish];
          const pin = shown && shown.variant === r.v;
          const par = r.prizm ? prizmInfo(r.prizm.c) : undefined;
          return (
            <li key={r.v} className={cn('cdz__item', !r.owned && 'is-locked', r.rarest && 'is-rarest')}>
              {r.rarest && <span className="cdz__flag">Rarest</span>}
              <div className="cdz__card">
                <CollectibleCard
                  owned
                  player={info.player}
                  tier={info.tier}
                  finish={r.finish}
                  variant={r.v}
                  kit={r.kit}
                  prizm={r.prizm}
                  autograph={r.v === 'auto' && !r.owned ? 'sample' : undefined}
                  ovr={info.ovr}
                  number={info.number}
                  stats={info.stats}
                  setNo={info.setNo}
                  setTotal={cards.length}
                  pinned={!!pin && !!shown?.pinned}
                />
                {!r.owned && (
                  <span className="cdz__lock" aria-hidden="true">
                    <Lock className="h-5 w-5" />
                  </span>
                )}
              </div>
              <div className="cdz__meta">
                <span className="cdz__name">{r.label}</span>
                {r.owned ? (
                  <span className={cn('cdz__state', `cdz__state--${r.finish}`)}>
                    <FIcon className="h-3 w-3" aria-hidden="true" />
                    {finishLabel(r.finish)}
                    {par ? ` · ${par.label}` : ''}
                    {r.copies > 1 ? ` · ×${r.copies}` : ''}
                  </span>
                ) : (
                  <span className="cdz__state cdz__state--locked">{r.v === 'auto' ? 'Not pulled · sample' : 'Not pulled'}</span>
                )}
                <span className="cdz__odds" title={`Chance one Standard pack card is his ${r.label} at Holo`}>
                  Holo 1 in {oneIn(r.chance)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="cdz__note">
        Odds are per Standard pack card for his {tierLabel(info.tier)} card at Holo: tier, finish, art and his share of the{' '}
        {tierPool[info.tier].length} {tierLabel(info.tier)} players.
      </p>
    </div>
  );
};

export default CardDesignsPanel;
