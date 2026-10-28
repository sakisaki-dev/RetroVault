import { useEffect, useState } from 'react';
import { Radar, X } from 'lucide-react';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import TeamLogo from '../../brand/TeamLogo';
import { teamMark } from '../visual/chartKit';
import type { LPoint } from '../visual/landscape';
import { openInCompFinder } from '../comps/compFinderLink';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { dur } from '@/utils/motion';
import './graphMobile.css';

/**
 * Phone Graph Builder: the tapped dot's compact preview, docked at the bottom (non-modal, so the next dot can be
 * tapped straight away). Team banner, name, the two plotted values, and Open card / Deep Dive. Swipe down or × closes.
 */
const GraphPreview = ({
  pt,
  xLabel,
  yLabel,
  xShort,
  yShort,
  onClose,
  onOpen,
}: {
  pt: LPoint | null;
  xLabel: string;
  yLabel: string;
  xShort: string;
  yShort: string;
  onClose: () => void;
  onOpen: (p: Player) => void;
}) => {
  // Keep the last point while the sheet glides away
  const [shown, setShown] = useState<LPoint | null>(pt);
  const [open, setOpen] = useState(!!pt);
  useEffect(() => {
    if (pt) {
      setShown(pt);
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    const t = window.setTimeout(() => setShown(null), dur.xslow);
    return () => window.clearTimeout(t);
  }, [pt]);
  const swipeRef = useSwipeToDismiss<HTMLDivElement>({ onDismiss: onClose, handoff: true });
  if (!shown) return null;
  const p = shown.player;
  const color = shown.color ?? teamMark(p.team);
  const hof = !shown.nfl && isHallOfFamer(p);
  const value = (text: string, short: string) => text.replace(` ${short}`, '');
  return (
    <div
      ref={swipeRef}
      role="region"
      aria-label={`${p.name}: ${shown.xText}, ${shown.yText}`}
      className="gp-sheet"
      data-open={open ? 'true' : 'false'}
    >
      <div className="gp-banner" style={{ ['--gp-team' as string]: color }} data-swipe-handle>
        <span className="gp-grab" aria-hidden="true" />
        {p.team && <TeamLogo team={p.team} size={34} decorative />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-extrabold uppercase italic leading-tight text-chalk">{p.name}</p>
          <p className="truncate text-xs text-white/80">
            {p.position}
            {p.team ? ` · ${p.team}` : ''}
            {shown.nfl ? ' · Real NFL (unranked)' : hof ? ' · Hall of Famer' : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close preview" className="gp-x">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-2 px-4 pt-3">
        <div className="rounded-md border border-line/70 bg-night/60 px-3 py-2">
          <dt className="truncate text-xs text-muted-foreground">{xLabel}</dt>
          <dd className="font-mono text-lg font-bold tabular-nums text-foreground">{value(shown.xText, xShort)}</dd>
        </div>
        <div className="rounded-md border border-line/70 bg-night/60 px-3 py-2">
          <dt className="truncate text-xs text-muted-foreground">{yLabel}</dt>
          <dd className="font-mono text-lg font-bold tabular-nums text-foreground">{value(shown.yText, yShort)}</dd>
        </div>
      </dl>
      <div className="grid grid-cols-2 gap-2 px-4 pb-3 pt-3">
        <button type="button" onClick={() => onOpen(p)} className="inline-flex h-11 items-center justify-center rounded-md bg-gold font-display text-sm font-bold uppercase tracking-wide text-night">
          Open card
        </button>
        <button
          type="button"
          disabled={shown.nfl}
          onClick={() => {
            onClose();
            openInCompFinder(p);
          }}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-line bg-night/60 font-display text-sm font-bold uppercase tracking-wide text-foreground disabled:opacity-40"
        >
          <Radar className="h-4 w-4 text-gold" aria-hidden="true" />
          Deep Dive
        </button>
      </div>
    </div>
  );
};

export default GraphPreview;
