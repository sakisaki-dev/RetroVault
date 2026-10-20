import { useMemo } from "react";
import { Palette, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FINISHES,
  VARIANTS,
  packOdds,
  type Finish,
  type Tier,
  type Variant,
} from "@/utils/collection";
import CollectibleCard from "./CollectibleCard";
import type { CardInfo } from "./useCardPool";
import { designRows } from "./designSamples";

interface CardDesignsProps {
  open: boolean;
  onClose: () => void;
  cards: CardInfo[];
  total: number;
  onOpenCard: (
    info: CardInfo,
    tier: Tier,
    finish: Finish,
    variant: Variant,
    from?: DOMRect,
  ) => void;
  onPreviewPack: () => void;
  /** Opens the Art lab (alternative card-art styles) */
  onArtLab?: () => void;
}

/** Finish shown per tier in the variants table (every finish appears once across it). */
const VARIANT_FINISH: Record<Tier, Finish> = {
  legendary: "holo",
  epic: "gold",
  rare: "silver",
  common: "base",
};
const STANDARD = packOdds("standard");
const pctOf = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

/** Read-only gallery: every tier × finish, then every art variant per tier, on league players. Touches no saved state. */
const CardDesigns = ({
  open,
  onClose,
  cards,
  total,
  onOpenCard,
  onPreviewPack,
  onArtLab,
}: CardDesignsProps) => {
  const rows = useMemo(() => designRows(cards), [cards]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto border-line bg-night p-3 sm:p-6">
        <div className="flex flex-wrap items-end gap-3 pr-8">
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-2xl uppercase italic">
              Card <span className="text-gold">designs</span>
            </DialogTitle>
            <DialogDescription>
              Every tier and finish. Preview only, nothing is added.
              {onArtLab && (
                <>
                  {" "}
                  To browse every variant × finish on any player, plus poses,
                  helmets, uniforms and faces, open the{" "}
                  <button
                    type="button"
                    onClick={onArtLab}
                    className="font-semibold text-gold underline-offset-2 hover:underline"
                  >
                    Art lab
                  </button>
                  .
                </>
              )}
            </DialogDescription>
          </div>
          {onArtLab && (
            <button
              type="button"
              onClick={onArtLab}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gold/60 px-3 text-sm font-bold text-gold hover:bg-gold/10"
            >
              <Palette className="h-4 w-4" aria-hidden="true" /> Open Art lab
            </button>
          )}
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
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading cards…
          </p>
        ) : (
          <div
            className="dz-grid"
            role="table"
            aria-label="Card designs by tier and finish"
          >
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
                      variant="jersey"
                      onOpen={(from) =>
                        onOpenCard(r.info, r.tier, f.key, "jersey", from)
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <>
            <h3 className="mt-6 font-display text-xl uppercase italic">
              Art <span className="text-gold">variants</span>
            </h3>
            <p className="text-sm text-muted-foreground">
              A third rarity layer: every pull also rolls its art. Standard pack
              odds per card:{" "}
              {VARIANTS.map(
                (v) => `${v.label} ${pctOf(STANDARD.variants[v.key])}`,
              ).join(" · ")}
              .
            </p>
            <div className="dz-scroll">
              <div
                className="dz-grid dz-grid--v"
                role="table"
                aria-label="Card art variants by tier"
              >
                <div role="row" className="contents">
                  <span role="columnheader" />
                  {VARIANTS.map((v) => (
                    <span key={v.key} role="columnheader" className="dz-head">
                      {v.short}
                    </span>
                  ))}
                </div>
                {rows.map((r) => (
                  <div key={r.key} role="row" className="contents">
                    <span role="rowheader" className="dz-row">
                      {r.label}
                    </span>
                    {VARIANTS.map((v) => (
                      <div key={v.key} role="cell" className="min-w-0">
                        <CollectibleCard
                          owned
                          player={r.info.player}
                          tier={r.tier}
                          finish={VARIANT_FINISH[r.tier]}
                          variant={v.key}
                          ovr={r.info.ovr}
                          number={r.info.number}
                          stats={r.info.stats}
                          setNo={r.info.setNo}
                          setTotal={total}
                          onOpen={(from) =>
                            onOpenCard(
                              r.info,
                              r.tier,
                              VARIANT_FINISH[r.tier],
                              v.key,
                              from,
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardDesigns;
