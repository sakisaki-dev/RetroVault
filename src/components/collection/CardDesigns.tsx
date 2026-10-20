import { useMemo } from 'react';
import { Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FINISHES, type Finish, type Tier } from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import type { CardInfo } from './useCardPool';
import { designRows } from './designSamples';

interface CardDesignsProps {
  open: boolean;
  onClose: () => void;
  cards: CardInfo[];
  total: number;
  onOpenCard: (info: CardInfo, tier: Tier, finish: Finish) => void;
  onPreviewPack: () => void;
}

/** Read-only gallery: every tier × finish on a real player, plus the NFL legend look. Touches no saved state. */
const CardDesigns = ({ open, onClose, cards, total, onOpenCard, onPreviewPack }: CardDesignsProps) => {
  const rows = useMemo(() => designRows(cards), [cards]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto border-line bg-night p-3 sm:p-6">
        <div className="flex flex-wrap items-end gap-3 pr-8">
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-2xl uppercase italic">
              Card <span className="text-gold">designs</span>
            </DialogTitle>
            <DialogDescription>Every tier and finish. Preview only, nothing is added.</DialogDescription>
          </div>
          <button
            type="button"
            onClick={onPreviewPack}
            disabled={!rows.length}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gold px-3 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-40"
          >
            <Play className="h-4 w-4" aria-hidden="true" /> Preview pack opening
          </button>
        </div>
        {!rows.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading cards…</p>
        ) : (
          <div className="dz-grid" role="table" aria-label="Card designs by tier and finish">
            <div role="row" className="contents">
              <span role="columnheader" />
              {FINISHES.map((f) => (
                <span key={f.key} role="columnheader" className="dz-head">
                  {f.label}
                </span>
              ))}
            </div>
            {rows.map((r) => (
              <div key={r.key} role="row" className="contents">
                <span role="rowheader" className="dz-row">
                  {r.label}
                </span>
                {FINISHES.map((f) => (
                  <div key={f.key} role="cell" className="min-w-0">
                    <CollectibleCard
                      owned
                      player={r.info.player}
                      tier={r.tier}
                      finish={f.key}
                      ovr={r.info.ovr}
                      number={r.info.number}
                      stats={r.info.stats}
                      setNo={r.info.setNo}
                      setTotal={total}
                      onOpen={() => onOpenCard(r.info, r.tier, f.key)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardDesigns;
