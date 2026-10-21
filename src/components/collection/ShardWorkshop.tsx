import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Crown, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { claimCard, claimCost, claimVariant, packsToGo, variantLabel, type OwnedCard } from '@/utils/collection';
import type { CardInfo } from './useCardPool';

interface Props {
  cards: CardInfo[];
  owned: Record<string, OwnedCard>;
  shards: number;
  /** Expected shards per Standard pack for this binder (expectedShardsPerPack) */
  perPack: number;
  onOpen: (c: CardInfo) => void;
}

/**
 * Shard workshop: the deliberate path to a coveted card. Shards (every pack, plus duplicates) buy a Legend claim, a
 * chosen Legendary player's Base card in the most common art he is missing; finish upgrades happen in the card
 * detail. Shows the balance, a progress bar toward the claim and an estimate of the packs still needed.
 */
const ShardWorkshop = ({ cards, owned, shards, perPack, onOpen }: Props) => {
  const legends = useMemo(() => cards.filter((c) => c.tier === 'legendary').sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0)), [cards]);
  const claimable = legends.filter((c) => claimVariant(owned[c.key]));
  const [pick, setPick] = useState<string | null>(null);
  const chosen = claimable.find((c) => c.key === pick) ?? claimable.find((c) => !owned[c.key]) ?? claimable[0];
  if (!legends.length) return null;
  const cost = claimCost('legendary');
  const variant = chosen ? claimVariant(owned[chosen.key]) : null;
  const togo = packsToGo(cost, shards, perPack);

  const claim = () => {
    if (!chosen) return;
    const v = claimCard(chosen.player, chosen.tier);
    if (v) {
      toast.success(`Legend claim: ${chosen.player.name}`, {
        description: `${variantLabel(v)} Base card added to your binder.`,
        action: { label: 'View', onClick: () => onOpen(chosen) },
      });
      setPick(null);
    } else toast('Not enough shards yet.');
  };

  return (
    <section aria-labelledby="col-workshop" className="col-workshop">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="col-workshop" className="section-title">
          Shard workshop
        </h2>
        <p className="inline-flex items-center gap-1.5 text-sm">
          <Hammer className="h-4 w-4 text-sky-300" aria-hidden="true" />
          <span className="font-mono font-semibold tabular-nums">{shards.toLocaleString()}</span>
          <span className="text-muted-foreground">shards</span>
          {perPack > 0 && <span className="text-xs text-muted-foreground">· about {Math.round(perPack)} per Standard pack</span>}
        </p>
      </div>
      {chosen && variant ? (
        <div className="col-workshop__claim">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="flex items-center gap-1.5 font-display text-xl font-extrabold uppercase italic leading-none">
              <Crown className="h-5 w-5 text-orange-300" aria-hidden="true" /> Legend claim
            </p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Choose a Legendary player">
              {claimable.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    className={cn('cd-chip', chosen.key === c.key && 'is-on')}
                    aria-pressed={chosen.key === c.key}
                    onClick={() => setPick(c.key)}
                  >
                    {c.player.name}
                    <span className="text-muted-foreground">{owned[c.key] ? '· new art' : '· not owned'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {chosen.player.name}&apos;s {variantLabel(variant)} card at Base, then upgrade it a finish at a time. {cost.toLocaleString()} shards
              {togo ? `, ${togo}.` : ', ready to claim.'}
            </p>
            <div className="cd-craft__bar" role="progressbar" aria-label="Shards toward the Legend claim" aria-valuemin={0} aria-valuemax={cost} aria-valuenow={Math.min(shards, cost)}>
              <i style={{ width: `${Math.min(100, (shards / cost) * 100)}%` }} />
            </div>
          </div>
          <button type="button" className="cd-craft cd-craft--claim col-workshop__btn" onClick={claim} disabled={shards < cost}>
            <span className="block font-display text-lg font-extrabold uppercase italic leading-none">Claim</span>
            <span className="mt-1 block font-mono text-xs opacity-80">
              {Math.min(shards, cost).toLocaleString()} / {cost.toLocaleString()}
            </span>
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Every Legendary art you can claim is in your binder. Upgrade them in the card view.</p>
      )}
    </section>
  );
};

export default ShardWorkshop;
