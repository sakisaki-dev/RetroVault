import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PACKS, openPack, packCount, readCollection, tierRank, type CollectionState, type PackCard, type PackType } from '@/utils/collection';
import { TIERS, tierLabel } from '@/config/cardTiers';
import type { Tier } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import type { CardInfo } from './useCardPool';
import CollectibleCard from './CollectibleCard';
import { isAuto, isPrizmChase, isThrowback } from './walkoutBeats';
import { KIT_SOURCE } from './kits';
import type { AutographFreezer, TierPool } from '@/utils/collection';
import { peekProps } from '@/components/peek/peekProps';

/**
 * "Open all" (owner: "give me an option to open all packs at once"): every owned pack of one type, or everything, in
 * one go through the normal pull path (openPack: the same odds, kits, Prizm rolls, autographs, duplicate shards and
 * storage), with no tunnel and no walkouts, then one summary: cards, new players, tiers, the best pulls as tappable
 * card tiles, shards and coins. A confirm first, because it is a lot of packs.
 */
interface Summary {
  packs: number;
  cards: PackCard[];
  shards: number;
  coins: number;
}

const best = (c: PackCard) => c.tier === 'legendary' || isAuto(c) || isPrizmChase(c) || isThrowback(c) || c.finish === 'holo';
const rare = (c: PackCard) => (isAuto(c) ? 8 : 0) + (isPrizmChase(c) ? 6 : 0) + (isThrowback(c) ? 3 : 0) + (c.finish === 'holo' ? 3 : 0) + (c.tier === 'legendary' ? 1 : 0);
const why = (c: PackCard) =>
  isAuto(c) ? 'Autograph' : isPrizmChase(c) ? `Prizm ${c.prizm!.c}` : c.tier === 'legendary' ? 'Legendary' : c.finish === 'holo' ? 'Holo' : isThrowback(c) ? 'Throwback' : '';

const OpenAll = ({
  state,
  types,
  disabled,
  tierPool,
  freeze,
  byKey,
  onCard,
}: {
  state: CollectionState;
  types: PackType[];
  disabled: boolean;
  tierPool: TierPool;
  freeze: AutographFreezer;
  byKey: Map<string, CardInfo>;
  onCard: (c: CardInfo) => void;
}) => {
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState<PackType[] | null>(null);
  const [busy, setBusy] = useState<{ done: number; of: number } | null>(null);
  const [sum, setSum] = useState<Summary | null>(null);
  const counts = types.map((t) => ({ t, n: packCount(state, t) })).filter((x) => x.n > 0);
  const total = counts.reduce((a, x) => a + x.n, 0);
  if (total < 2 && !sum && !busy && !ask) return null; // the summary outlives the packs it opened

  const run = async (list: PackType[]) => {
    setAsk(null);
    const before = readCollection();
    const plan = list.flatMap((t) => Array.from({ length: packCount(before, t) }, () => t));
    const cards: PackCard[] = [];
    setBusy({ done: 0, of: plan.length });
    for (let i = 0; i < plan.length; i++) {
      const got = openPack(plan[i], tierPool, freeze, KIT_SOURCE);
      if (got) cards.push(...got);
      if (i % 8 === 7) {
        setBusy({ done: i + 1, of: plan.length });
        await new Promise((r) => window.setTimeout(r, 0));
      }
    }
    const after = readCollection();
    setBusy(null);
    setSum({ packs: plan.length, cards, shards: after.shards - before.shards, coins: (after.coins ?? 0) - (before.coins ?? 0) });
  };

  const tierCounts = (s: Summary) => TIERS.map(({ key }) => ({ key, n: s.cards.filter((c) => c.tier === key).length })).filter((x) => x.n);
  const bestPulls = (s: Summary) => s.cards.filter(best).sort((a, b) => rare(b) - rare(a) || tierRank(b.tier) - tierRank(a.tier)).slice(0, 36);

  return (
    <>
      <div className="flex items-center gap-2" aria-label="Open many packs at once">
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled || !!busy || total < 2}
              className="inline-flex h-7 items-center gap-1.5 rounded-sm border-2 border-gold/70 bg-night px-2.5 font-pixel text-[9px] uppercase tracking-wider text-gold shadow-[2px_2px_0_hsl(var(--gold)/0.35)] transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
            >
              <Layers className="h-3 w-3" aria-hidden="true" /> Open all
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 border-2 border-line bg-night p-1.5">
            <p className="px-2 pb-1 pt-1 font-pixel text-[8px] uppercase tracking-wider text-muted-foreground">Open all unopened packs</p>
            <ul>
              {counts.length > 1 &&
                counts.map(({ t, n }) => (
                  <li key={t}>
                    <button type="button" onClick={() => { setMenu(false); setAsk([t]); }} className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none">
                      <span className="font-semibold">{PACKS[t].label.replace(/ Pack$/, '')}</span>
                      <span className="font-pixel text-[10px] tabular-nums text-gold">&times;{n}</span>
                    </button>
                  </li>
                ))}
              <li className={cn(counts.length > 1 && 'mt-1 border-t border-line pt-1')}>
                <button type="button" onClick={() => { setMenu(false); setAsk(counts.map((x) => x.t)); }} className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm text-gold hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none">
                  <span className="font-semibold">Everything</span>
                  <span className="font-pixel text-[10px] tabular-nums">&times;{total}</span>
                </button>
              </li>
            </ul>
          </PopoverContent>
        </Popover>
        {busy && (
          <span className="font-pixel text-[9px] uppercase tracking-wider text-muted-foreground" role="status">
            Opening {busy.done} / {busy.of}
          </span>
        )}
      </div>

      <Dialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent className="max-w-md border-line bg-night p-5">
          <DialogTitle className="font-display text-xl font-bold uppercase">Open {ask ? ask.reduce((a, t) => a + packCount(state, t), 0) : 0} packs?</DialogTitle>
          <DialogDescription>
            Same odds as opening them one by one, but with no tunnel or walkouts: you get one summary. This cannot be undone.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="link-chip" onClick={() => setAsk(null)}>
              Cancel
            </button>
            <button type="button" className="link-chip text-gold" onClick={() => ask && void run(ask)}>
              Open them all
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sum} onOpenChange={(o) => !o && setSum(null)}>
        <DialogContent phoneSheet className="max-h-[calc(var(--safe-h)-1rem)] max-w-3xl overflow-y-auto border-line bg-night p-4 sm:p-6">
          <DialogTitle className="font-display text-2xl font-bold uppercase">{sum?.packs} packs opened</DialogTitle>
          <DialogDescription className="sr-only">Summary of every card pulled</DialogDescription>
          {sum && (
            <div className="space-y-4">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Cards', sum.cards.length.toLocaleString('en-US')],
                  ['New players', String(sum.cards.filter((c) => c.isNew).length)],
                  ['Shards', `+${sum.shards.toLocaleString('en-US')}`],
                  ['Coins', sum.coins ? `+${fmtCoins(sum.coins)}` : '0'],
                ].map(([k, v]) => (
                  <li key={k} className="rounded-lg border border-line bg-black/30 p-3 text-center">
                    <p className="font-display text-2xl font-bold tabular-nums text-gold">{v}</p>
                    <p className="font-pixel text-[8px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-wrap gap-2 text-xs">
                {tierCounts(sum).map(({ key, n }) => (
                  <li key={key} className="rounded-full border border-line px-2.5 py-1 font-semibold">
                    {tierLabel(key as Tier)} <b className="tabular-nums text-gold">{n}</b>
                  </li>
                ))}
                <li className="rounded-full border border-line px-2.5 py-1">
                  New variants <b className="tabular-nums text-gold">{sum.cards.filter((c) => c.newVariant).length}</b>
                </li>
                <li className="rounded-full border border-line px-2.5 py-1">
                  New kits <b className="tabular-nums text-gold">{sum.cards.filter((c) => c.newKit).length}</b>
                </li>
              </ul>
              {bestPulls(sum).length > 0 && (
                <div>
                  <h3 className="mb-2 font-pixel text-[10px] uppercase tracking-wider text-gold">Best pulls</h3>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {bestPulls(sum).map((c, i) => {
                      const info = byKey.get(`${c.player.position}:${c.player.name}`);
                      return (
                        <li key={i} className={cn('relative')} {...peekProps(c.player)}>
                          <CollectibleCard
                            player={info?.player ?? c.player}
                            tier={c.tier}
                            finish={c.finish}
                            variant={c.variant}
                            kit={c.kit}
                            prizm={c.prizm ? { c: c.prizm.c, n: c.prizm.n } : undefined}
                            owned
                            ovr={info?.ovr}
                            number={info?.number}
                            stats={info?.stats}
                            badge={why(c)}
                            onOpen={info ? () => { setSum(null); onCard(info); } : undefined}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OpenAll;
