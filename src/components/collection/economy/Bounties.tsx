import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CollectionState } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { BOUNTY_PRICE_SHARE, bountiesDone, bountyPayout, turnInBounty, type Bounty } from '@/utils/economy';
import CopyRow from './CopyRow';
import { consumes, factsOf, type OwnedCopy } from './copies';

interface BountiesProps {
  bounties: Bounty[];
  seed: number;
  editionLabel?: string;
  state: CollectionState;
  copies: OwnedCopy[];
  /** Base value change since the previous market snapshot, per card key */
  change: (key: string) => number | null;
}

const LIST = 12;

/**
 * Bounty board: this edition's requests (picked from the edition seed, the same on every device). Turning a matching
 * copy in pays the bounty plus BOUNTY_PRICE_SHARE of the copy's value, once per bounty until the next update. Spares
 * are listed first; a last copy says so before it goes.
 */
const Bounties = ({ bounties, seed, editionLabel, state, copies, change }: BountiesProps) => {
  const done = bountiesDone(state, seed);
  const [open, setOpen] = useState<string | null>(null);
  const [pickId, setPickId] = useState<string | null>(null);
  const [limit, setLimit] = useState(LIST);
  const matches = useMemo(() => {
    const m = new Map<string, OwnedCopy[]>();
    bounties.forEach((b) =>
      m.set(
        b.id,
        copies.filter((c) => b.test(factsOf(c, change(c.info.key)))).sort((a, b2) => Number(a.of <= 1) - Number(b2.of <= 1) || a.price - b2.price),
      ),
    );
    return m;
  }, [bounties, copies, change]);

  const turnIn = (b: Bounty, c: OwnedCopy) => {
    const pay = turnInBounty(seed, b, { ref: c.ref, price: c.price, label: `${c.info.player.name} · ${c.label}` });
    if (pay == null) {
      toast('That bounty is closed or the card is gone.');
      return;
    }
    toast.success(`Bounty paid: +${fmtCoins(pay)} coins`, { description: `${c.info.player.name} · ${c.label}` });
    setOpen(null);
    setPickId(null);
  };

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        {editionLabel ? `${editionLabel} board. ` : ''}New bounties come with every league update. Each pays its reward plus {Math.round(BOUNTY_PRICE_SHARE * 100)}% of the card&apos;s
        value (a market sale pays 40%), and takes the card.
      </p>
      <ul className="ec-bounties">
        {bounties.map((b, i) => {
          const isDone = done.includes(b.id);
          const list = matches.get(b.id) ?? [];
          const isOpen = open === b.id;
          const picked = list.find((c) => c.id === pickId);
          const warn = picked ? consumes([picked]) : null;
          return (
            <li key={b.id} className={cn('ec-bounty', isDone && 'is-done')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="ec-bounty__wanted">Wanted · No. {i + 1}</p>
                  <h3 className="ec-bounty__title">{b.title}</h3>
                </div>
                <span className="ec-reward shrink-0">
                  <span className="ec-coin ec-coin--sm" aria-hidden="true" />+{fmtCoins(b.reward)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isDone ? (
                  <span className="ec-stamp">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Paid
                  </span>
                ) : (
                  <button
                    type="button"
                    className={cn('ec-btn ec-btn--sm', list.length ? 'ec-btn--gold' : 'ec-btn--ghost')}
                    aria-expanded={isOpen}
                    disabled={!list.length}
                    onClick={() => {
                      setOpen(isOpen ? null : b.id);
                      setPickId(null);
                      setLimit(LIST);
                    }}
                  >
                    {list.length ? (isOpen ? 'Close' : `Turn in (${list.length} match${list.length === 1 ? '' : 'es'})`) : 'No match in your binder'}
                  </button>
                )}
              </div>
              {isOpen && !isDone && (
                <div className="mt-3 space-y-2">
                  <ul className="ec-copies">
                    {list.slice(0, limit).map((c) => (
                      <li key={c.id}>
                        <CopyRow copy={c} pressed={pickId === c.id} onClick={() => setPickId(pickId === c.id ? null : c.id)} coins={bountyPayout(b, c.price)} coinsLabel="pays" showTier />
                      </li>
                    ))}
                  </ul>
                  {list.length > limit && (
                    <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => setLimit((l) => l + LIST * 2)}>
                      Show more ({list.length - limit})
                    </button>
                  )}
                  {picked && (
                    <div className="space-y-2">
                      {warn && (warn.leaving.length > 0 || warn.lastCombos.length > 0) && (
                        <p className="ec-warn" role="alert">
                          {warn.leaving.length
                            ? `This is your only ${picked.info.player.name} card: turning it in removes him from your binder.`
                            : `This is your last ${picked.label} of ${picked.info.player.name}.`}
                        </p>
                      )}
                      <button type="button" className={cn('ec-btn', warn?.lastCombos.length ? 'ec-btn--danger' : 'ec-btn--gold')} onClick={() => turnIn(b, picked)}>
                        Turn in for {fmtCoins(bountyPayout(b, picked.price))} coins
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Bounties;
