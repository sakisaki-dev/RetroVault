import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { finishLabel, prizmInfo, prizmSerial, useCollection, variantLabel, type Finish, type OwnedCard, type PrizmCopy, type Variant } from '@/utils/collection';
import { autographPrice, cardPrice, fmtCoins } from '@/utils/cardMarket';
import { autographValue, parallelOf, serialStr } from '@/config/autographs';
import { SELL_RATE, sellCopies, sellPrice, type CopyRef } from '@/utils/economy';
import { useMarket } from '@/utils/useMarket';
import type { CardInfo } from '../useCardPool';
import type { OwnedAuto } from '@/utils/collection';
import './economy.css';

interface SellPanelProps {
  info: CardInfo;
  entry: OwnedCard;
  variant: Variant;
  finish: Finish;
  /** The kit shown (stored id) and its kind */
  kit?: string;
  kitKind: 'home' | 'alt' | 'era';
  kitLabel?: string;
  prizm?: PrizmCopy;
  /** The autograph opened (Autograph art), else his best at this finish is the one sold */
  auto?: OwnedAuto;
  /** After a sale: 'player' when he left the binder, 'combo' when this variant × finish is gone, else null */
  onSold: (gone: 'player' | 'combo' | null) => void;
}

/**
 * "Sell to the market" under the card's value: the copy on show (this variant × finish, in the kit and Prizm parallel
 * shown, or the autograph shown) for SELL_RATE of its price. A duplicate sells in one tap; the last copy of a variant ×
 * finish, and above all a player's only card (he leaves the binder), asks first.
 */
const SellPanel = ({ info, entry, variant, finish, kit, kitKind, kitLabel, prizm, auto, onSold }: SellPanelProps) => {
  const history = useMarket();
  const { state } = useCollection();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [info.key, variant, finish, kit, prizm?.c, prizm?.n, auto?.id]);

  const value = history?.[history.length - 1]?.players[info.key]?.value;
  const v = entry.variants[variant];
  if (value == null || !v || !v.counts[finish]) return null;

  const playerTotal = Object.values(entry.counts).reduce((a, n) => a + (n ?? 0), 0);
  let ref: CopyRef;
  let price: number;
  let of: number;
  let label: string;
  if (variant === 'auto') {
    const mine = state.autos.filter((a) => a.key === info.key && a.finish === finish).sort((a, b) => autographValue(b.roll).total - autographValue(a.roll).total);
    const a = (auto && mine.find((x) => x.id === auto.id)) ?? mine[0];
    // An Autograph copy with no signed item behind it (very old saves) can't be priced or sold
    if (!a) return null;
    ref = { kind: 'auto', key: info.key, id: a.id };
    price = autographPrice(value, autographValue(a.roll).total, finish);
    of = mine.length;
    label = `${variantLabel(variant)} ${finishLabel(finish)} (${parallelOf(a.roll.parallel).label} ${serialStr(a.roll)})`;
  } else {
    ref = { kind: 'card', key: info.key, variant, finish, kit: kit ?? 'home', ...(prizm ? { prizm } : {}) };
    price = cardPrice(value, finish, variant, kitKind, prizm);
    of = v.counts[finish] ?? 1;
    label = [variantLabel(variant), finishLabel(finish), kitKind !== 'home' ? kitLabel : null, prizm ? `${prizmInfo(prizm.c).label} ${prizmSerial(prizm)}` : null].filter(Boolean).join(' ');
  }
  const pay = sellPrice(price);
  const only = playerTotal <= 1;
  const last = of <= 1;

  const sell = () => {
    const got = sellCopies([{ ref, price, label: `${info.player.name} · ${label}` }]);
    setConfirm(false);
    if (got == null) {
      toast('That copy is no longer in your binder.');
      return;
    }
    toast.success(`Sold for ${fmtCoins(got)} coins`, { description: `${info.player.name} · ${label}` });
    onSold(only ? 'player' : last ? 'combo' : null);
  };

  return (
    <section className={cn('ec-sell', confirm && 'is-confirm')} aria-label="Sell to the market">
      <p className="cd__label">Sell to the market · {Math.round(SELL_RATE * 100)}% of value</p>
      <div className="ec-sell__row">
        <p className="ec-sell__pay">
          <Coins className="h-5 w-5 text-gold" aria-hidden="true" />
          <span className="font-display text-2xl font-extrabold tabular-nums">+{fmtCoins(pay)}</span>
          <span className="text-xs text-muted-foreground">coins</span>
        </p>
        {!confirm && (
          <button type="button" className="ec-btn ec-btn--sell" onClick={() => (last ? setConfirm(true) : sell())}>
            Sell 1 copy
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {last ? 'Your only copy of this art and finish.' : `${of} copies of this art and finish; ${of - 1} left after the sale.`}
      </p>
      {confirm && (
        <div className="ec-confirm" role="alertdialog" aria-label="Confirm the sale">
          <p className="text-sm font-semibold">
            {only
              ? `This is your only ${info.player.name} card. Selling it removes him from your binder.`
              : `This is your last ${label}. Selling it removes this finish from his card.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="ec-btn ec-btn--danger" onClick={sell}>
              Sell for {fmtCoins(pay)}
            </button>
            <button type="button" className="ec-btn ec-btn--ghost" onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default SellPanel;
