import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Crown, Hammer, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { claimCard, claimCost, claimVariant, packsToGo, variantLabel, type OwnedCard } from '@/utils/collection';
import { findNFLTeam } from '@/utils/nflTeams';
import CollectibleCard from './CollectibleCard';
import type { CardInfo } from './useCardPool';
import './shardWorkshop.css';

interface Props {
  cards: CardInfo[];
  owned: Record<string, OwnedCard>;
  shards: number;
  /** Expected shards per Standard pack for this binder (expectedShardsPerPack) */
  perPack: number;
  onOpen: (c: CardInfo) => void;
}

/**
 * Shard workshop, the forge (owner, 2026-11-17: "rework the shard workshop as well"): the deliberate path to a coveted
 * card. Shards (every pack, plus duplicates) buy a Legend claim, a chosen Legendary player's Base card in the most
 * common art he is missing; finish upgrades happen in the card detail. The chosen legend's card stands on the anvil
 * beside a shard gauge (the balance against the claim, the packs still to go) and the Claim button; every claimable
 * legend sits in one swipeable strip below (club logo, surname, OVR, not owned / new art), never a wall of chips.
 */
const ShardWorkshop = ({ cards, owned, shards, perPack, onOpen }: Props) => {
  const legends = useMemo(() => cards.filter((c) => c.tier === 'legendary').sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0)), [cards]);
  const claimable = legends.filter((c) => claimVariant(owned[c.key]));
  const [pick, setPick] = useState<string | null>(null);
  const [forging, setForging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const chosen = claimable.find((c) => c.key === pick) ?? claimable.find((c) => !owned[c.key]) ?? claimable[0];
  if (!legends.length) return null;
  const cost = claimCost('legendary');
  const variant = chosen ? claimVariant(owned[chosen.key]) : null;
  const togo = packsToGo(cost, shards, perPack);
  const share = Math.min(1, shards / cost);
  const ready = shards >= cost;
  const team = chosen ? findNFLTeam(chosen.cardTeam) : null;

  const choose = (k: string) => {
    if (k === chosen?.key) return;
    setPick(k);
    // the new card settles onto the anvil (transform / opacity only)
    stageRef.current?.animate?.([{ opacity: 0, transform: 'translateY(10px) scale(0.96)' }, { opacity: 1, transform: 'none' }], {
      duration: 260,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
  };

  const claim = () => {
    if (!chosen || forging) return;
    const v = claimCard(chosen.player, chosen.tier);
    if (!v) {
      toast('Not enough shards yet.');
      return;
    }
    setForging(true);
    window.setTimeout(() => setForging(false), 900);
    toast.success(`Legend claim: ${chosen.player.name}`, {
      description: `${variantLabel(v)} Base card added to your binder.`,
      action: { label: 'View', onClick: () => onOpen(chosen) },
    });
    setPick(null);
  };

  return (
    <section aria-labelledby="col-workshop" className="sw">
      <div className="sw__head">
        <h2 id="col-workshop" className="section-title">
          Shard workshop
        </h2>
        <p className="sw__bal" aria-label={`${shards.toLocaleString()} shards`}>
          <Hammer className="h-4 w-4" aria-hidden="true" />
          <span className="font-mono font-bold tabular-nums">{shards.toLocaleString()}</span>
          <span className="sw__bal-u">shards</span>
        </p>
      </div>

      {chosen && variant ? (
        <>
          <div className={cn('sw__forge', ready && 'is-ready', forging && 'is-forging')} style={team ? { ['--sw-club' as string]: team.primaryColor } : undefined}>
            <div className="sw__anvil">
              <div ref={stageRef} className="sw__card">
                <CollectibleCard
                  owned
                  player={chosen.player}
                  tier={chosen.tier}
                  finish="base"
                  variant={variant}
                  ovr={chosen.ovr}
                  number={chosen.number}
                  stats={chosen.stats}
                  setNo={chosen.setNo}
                  setTotal={cards.length}
                />
              </div>
              <span className="sw__plinth" aria-hidden="true" />
            </div>

            <div className="sw__info">
              <p className="sw__kicker">
                <Crown className="h-3.5 w-3.5" aria-hidden="true" /> Legend claim
              </p>
              <p className="sw__name">{chosen.player.name}</p>
              <p className="sw__sub">
                {variantLabel(variant)} art at Base · {owned[chosen.key] ? 'a new art for your binder' : 'not in your binder yet'}
              </p>

              <div className="sw__gauge" role="progressbar" aria-label="Shards toward the Legend claim" aria-valuemin={0} aria-valuemax={cost} aria-valuenow={Math.min(shards, cost)}>
                <span className="sw__gauge-fill" style={{ transform: `scaleX(${share})` }} />
                <span className="sw__gauge-ticks" aria-hidden="true" />
              </div>
              <p className="sw__count">
                <span className="font-mono tabular-nums">
                  {Math.min(shards, cost).toLocaleString()} / {cost.toLocaleString()}
                </span>
                <span>{ready ? 'Ready to forge' : togo}</span>
              </p>

              <button type="button" className="sw__claim" onClick={claim} disabled={!ready}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {ready ? 'Claim his card' : `${(cost - shards).toLocaleString()} shards to go`}
              </button>
              <p className="sw__note">Then upgrade it a finish at a time from the card view.</p>
            </div>
          </div>

          <ul className="sw__strip" aria-label="Choose a Legendary player">
            {claimable.map((c) => {
              const t = findNFLTeam(c.cardTeam);
              const on = chosen.key === c.key;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    className={cn('sw__pick', on && 'is-on')}
                    aria-pressed={on}
                    onClick={() => choose(c.key)}
                    style={t ? { ['--sw-club' as string]: t.primaryColor } : undefined}
                    aria-label={`${c.player.name}, ${owned[c.key] ? 'new art' : 'not owned'}`}
                  >
                    {t?.logoUrl ? <img src={t.logoUrl} alt="" loading="lazy" /> : <span className="sw__pick-fa">FA</span>}
                    <span className="sw__pick-name">{c.player.name.split(' ').slice(-1)[0]}</span>
                    <span className="sw__pick-meta">
                      {c.player.position}
                      {c.ovr != null && ` ${c.ovr}`}
                    </span>
                    <span className={cn('sw__pick-tag', !owned[c.key] && 'is-new')}>{owned[c.key] ? 'New art' : 'Not owned'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Every Legendary art you can claim is in your binder. Upgrade them in the card view.</p>
      )}
    </section>
  );
};

export default ShardWorkshop;
