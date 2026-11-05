import { useMemo, useRef, useState } from 'react';
import { Signature } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { finishLabel, type OwnedAuto } from '@/utils/collection';
import { useMarket } from '@/utils/useMarket';
import { autographPrice, fmtCoins } from '@/utils/cardMarket';
import { autographValue, fmtMult, parallelOf, serialStr } from '@/config/autographs';
import AutographCanvas from './AutographCanvas';
import AutographDetails, { autographOddsLine } from './AutographDetails';

const PAGE = 48;

/**
 * The Collection's Autographs: a count, a binder of every autograph owned (newest first; each canvas renders only as it
 * scrolls into view, at its small size), and a detail sheet (the large card, every roll with its multiplier, the price
 * and the pull date). Empty: what they are and the odds.
 */
const AutographsSection = ({ autos }: { autos: OwnedAuto[] }) => {
  const history = useMarket();
  const [open, setOpen] = useState<OwnedAuto | null>(null);
  // The last opened autograph stays in the sheet while it animates closed
  const lastRef = useRef<OwnedAuto | null>(null);
  if (open) lastRef.current = open;
  const shown = open ?? lastRef.current;
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(() => [...autos].sort((a, b) => b.pulledAt - a.pulledAt), [autos]);
  const latest = history?.[history.length - 1];
  const valueOf = (a: OwnedAuto) => (history ? (latest?.players[a.key]?.value ?? null) : undefined);
  const total = useMemo(
    () => list.reduce((s, a) => s + (latest?.players[a.key] ? autographPrice(latest.players[a.key].value, autographValue(a.roll).total, a.finish) : 0), 0),
    [list, latest],
  );

  return (
    <section aria-labelledby="col-autos" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="col-autos" className="section-title">
          Autographs
        </h2>
        <span className="text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{list.length}</span> owned
          {list.length > 0 && latest && (
            <>
              {' '}
              · <span className="font-mono text-foreground">{fmtCoins(total)}</span> coins
            </>
          )}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="au-empty">
          <span className="au-empty__card" aria-hidden="true">
            <Signature className="h-7 w-7" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-display text-xl font-extrabold uppercase italic leading-none">No autographs yet</p>
            <p className="text-sm text-muted-foreground">
              The Autograph is the rarest card art: {autographOddsLine()} cards pulled, rarer still on better players and finishes. Each one is
              its own numbered card from a run (Sticker /99 up to a Hall of Famer&apos;s Cut 1/1), signed in the player&apos;s own hand and printed in the
              design of his era. Autographs can&apos;t be claimed or crafted with shards.
            </p>
          </div>
        </div>
      ) : (
        <>
          <ul className="au-grid" aria-label="Your autographs">
            {list.slice(0, limit).map((a) => {
              const v = autographValue(a.roll).total;
              return (
                <li key={a.id} className="min-w-0">
                  <button type="button" className="au-tile" onClick={() => setOpen(a)} aria-label={`${a.snap.name}, ${parallelOf(a.roll.parallel).label} ${serialStr(a.roll)}: details`}>
                    <AutographCanvas snap={a.snap} roll={a.roll} cacheKey={a.id} />
                    <span className="min-w-0 px-0.5">
                      <span className="block truncate text-xs font-semibold">{a.snap.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {serialStr(a.roll)} · <span className="text-gold">{fmtMult(v)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length > limit && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-10 rounded-full border border-line bg-panel px-5 text-sm font-semibold hover:border-gold/60">
                Show more ({list.length - limit})
              </button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[calc(var(--safe-h)-0.5rem)] max-w-3xl overflow-y-auto overflow-x-hidden border-line bg-night p-4 sm:p-6">
          {shown && (
            <>
              <div className="pr-10">
                <DialogTitle className="font-display text-3xl uppercase italic leading-none">{shown.snap.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {parallelOf(shown.roll.parallel).label} · {serialStr(shown.roll)} · {finishLabel(shown.finish)} · worth {fmtMult(autographValue(shown.roll).total)} the card
                </DialogDescription>
              </div>
              <div className="au-detail mt-4">
                <div className="au-detail__card">
                  <AutographCanvas key={shown.id} snap={shown.snap} roll={shown.roll} cacheKey={shown.id} />
                </div>
                <AutographDetails snap={shown.snap} roll={shown.roll} value={valueOf(shown)} pulledAt={shown.pulledAt} pack={shown.pack} finish={shown.finish} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AutographsSection;
