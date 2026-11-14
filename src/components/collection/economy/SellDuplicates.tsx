import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Coins } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { CollectionState } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { SELL_RATE, sellCopies, sellPrice } from '@/utils/economy';
import { useMarket } from '@/utils/useMarket';
import type { CardInfo } from '../useCardPool';
import { allCopies, duplicateCopies } from './copies';
import './economy.css';

interface SellDuplicatesProps {
  open: boolean;
  onClose: () => void;
  byKey: Map<string, CardInfo>;
  state: CollectionState;
}

/**
 * "Sell duplicates": every copy beyond the best one of each variant × finish, sold to the market for SELL_RATE of its
 * value, with the list and the total shown before anything is sold. By default a copy that is the only one of its kit
 * or Prizm colour in that variant × finish is kept too, and autographs (each unique) are never bulk-sold.
 */
const SellDuplicates = ({ open, onClose, byKey, state }: SellDuplicatesProps) => {
  const history = useMarket();
  const [keepUnique, setKeepUnique] = useState(true);
  const latest = history?.length ? history[history.length - 1] : undefined;
  const list = useMemo(
    () => (open ? duplicateCopies(allCopies(byKey, state.cards, state.autos, latest), keepUnique).sort((a, b) => b.price - a.price) : []),
    [open, byKey, state.cards, state.autos, latest, keepUnique],
  );
  const total = list.reduce((a, c) => a + sellPrice(c.price), 0);
  const players = new Set(list.map((c) => c.info.key)).size;

  const sell = () => {
    const got = sellCopies(list.map((c) => ({ ref: c.ref, price: c.price, label: `${c.info.player.name} · ${c.label}` })));
    if (got == null) {
      toast('Your binder changed; nothing was sold. Try again.');
      return;
    }
    toast.success(`Sold ${list.length} duplicates for ${fmtCoins(got)} coins`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent phoneSheet className="max-h-[calc(var(--safe-h)-1rem)] max-w-xl overflow-y-auto border-line bg-night p-4 sm:p-6">
        <p className="ec-kicker">Sell to the market · {Math.round(SELL_RATE * 100)}% of value</p>
        <DialogTitle className="font-display text-3xl uppercase italic">Sell duplicates</DialogTitle>
        <DialogDescription>Every copy beyond the best one of each art and finish. Your best copy of each always stays.</DialogDescription>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-panel/60 px-3 py-2 text-sm">
          <span>
            Keep one of each kit and Prizm colour
            <span className="block text-xs text-muted-foreground">and every autograph</span>
          </span>
          <Switch checked={keepUnique} onCheckedChange={setKeepUnique} aria-label="Keep one of each kit and Prizm colour" />
        </label>
        {!latest ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading market prices…</p>
        ) : list.length ? (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2">
              <span className="text-sm">
                {list.length} cards · {players} players
              </span>
              <span className="inline-flex items-center gap-1.5 font-display text-2xl font-extrabold tabular-nums">
                <Coins className="h-5 w-5 text-gold" aria-hidden="true" />+{fmtCoins(total)}
              </span>
            </div>
            <ul className="mt-3 max-h-[40vh] space-y-1 overflow-y-auto pr-1 text-sm">
              {list.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-line/40 py-1.5">
                  <span className="min-w-0">
                    <span className="font-semibold">{c.info.player.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums">+{fmtCoins(sellPrice(c.price))}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="ec-btn ec-btn--gold" onClick={sell}>
                Sell {list.length} for {fmtCoins(total)}
              </button>
              <button type="button" className="ec-btn ec-btn--ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No duplicates to sell{keepUnique ? ' (every spare is a different kit or parallel)' : ''}.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SellDuplicates;
