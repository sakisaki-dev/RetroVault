import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Crown, Hammer, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIERS, claimCard, claimCost, claimVariant, packsToGo, tierLabel, variantLabel, type OwnedCard, type Tier } from '@/utils/collection';
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

/** Accent- and case-blind name match */
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’.]/g, '').toLowerCase();
const STRIP_MAX = 60;

/**
 * Shard workshop, the forge (owner, 2026-11-17: "rework the shard workshop as well"): the deliberate path to a coveted
 * card. Shards (every pack, plus duplicates) buy a claim, a chosen player's Base card in the most
 * common art he is missing; finish upgrades happen in the card detail. The chosen legend's card stands on the anvil
 * beside a shard gauge (the balance against the claim, the packs still to go) and the Claim button. Any player can be
 * claimed (owner, 2026-11-17: "shouldn't we be able to trade for anybody"), priced by his tier (CLAIM_COST: Common 150,
 * Rare 300, Epic 600, Legendary 1,000): tier chips (Legendary first) and a name search pick who the swipeable strip
 * shows (club logo, surname, position and OVR, price, not owned / new art), the best OVR first, up to STRIP_MAX.
 */
const ShardWorkshop = ({ cards, owned, shards, perPack, onOpen }: Props) => {
  const [tier, setTier] = useState<Tier | 'all'>('legendary');
  const [q, setQ] = useState('');
  // Everyone with an art left to claim, best OVR first
  const claimable = useMemo(
    () => cards.filter((c) => !c.player.isRealLegend && claimVariant(owned[c.key])).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || a.setNo - b.setNo),
    [cards, owned],
  );
  const shown = useMemo(() => {
    const t = fold(q.trim());
    return claimable.filter((c) => (t ? fold(c.player.name).includes(t) || fold(c.player.nickname ?? '').includes(t) : tier === 'all' || c.tier === tier));
  }, [claimable, tier, q]);
  const [pick, setPick] = useState<string | null>(null);
  const [forging, setForging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const chosen = claimable.find((c) => c.key === pick) ?? shown.find((c) => !owned[c.key]) ?? shown[0] ?? claimable[0];
  if (!cards.length) return null;
  const cost = chosen ? claimCost(chosen.tier) : claimCost('legendary');
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
    toast.success(`Claimed: ${chosen.player.name}`, {
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
                <Crown className="h-3.5 w-3.5" aria-hidden="true" /> {tierLabel(chosen.tier)} claim · {cost.toLocaleString()} shards
              </p>
              <p className="sw__name">{chosen.player.name}</p>
              <p className="sw__sub">
                {variantLabel(variant)} art at Base · {owned[chosen.key] ? 'a new art for your binder' : 'not in your binder yet'}
              </p>

              <div className="sw__gauge" role="progressbar" aria-label={`Shards toward claiming ${chosen.player.name}`} aria-valuemin={0} aria-valuemax={cost} aria-valuenow={Math.min(shards, cost)}>
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

          <div className="sw__pickbar">
            <label className="sw__search">
              <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Any player" aria-label="Find any player to claim" autoComplete="off" spellCheck={false} />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label="Clear the search">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="sw__tiers" role="group" aria-label="Tier to claim from">
              {[...TIERS].reverse().map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={cn('sw__tier', !q && tier === t.key && 'is-on')}
                  aria-pressed={!q && tier === t.key}
                  onClick={() => {
                    setQ('');
                    setTier(t.key);
                  }}
                >
                  <span className={cn('col-dot', `col-gem--${t.key}`)} aria-hidden="true" />
                  {t.label}
                  <span className="sw__tier-cost">{claimCost(t.key).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 && <p className="text-sm text-muted-foreground">Nobody to claim there: every art is already in your binder, or no name matches.</p>}
          <ul className="sw__strip" aria-label="Choose a player to claim">
            {shown.slice(0, STRIP_MAX).map((c) => {
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
                    <span className={cn('sw__pick-tag', !owned[c.key] && 'is-new')}>
                      {owned[c.key] ? 'New art' : 'Not owned'} · {claimCost(c.tier).toLocaleString()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Every art you can claim is in your binder. Upgrade them in the card view.</p>
      )}
    </section>
  );
};

export default ShardWorkshop;
