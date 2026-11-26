import { useEffect, useRef, type ReactNode } from 'react';
import TeamLogo from '../brand/TeamLogo';
import type { ChartZoom } from '@/utils/useChartZoom';

/** Reset chip (only while zoomed) and + / − on the corner of a zoomable plot. Lives inside a `relative` wrapper. */
export const ZoomControls = ({ zoom, className = '' }: { zoom: ChartZoom; className?: string }) => (
  <div className={`pointer-events-none absolute right-1.5 top-1.5 z-20 flex items-center gap-1 ${className}`} data-no-swipe>
    {zoom.zoomed && (
      <button
        type="button"
        onClick={zoom.reset}
        className="pointer-events-auto inline-flex h-7 items-center rounded-full border border-gold/60 bg-night/90 px-2.5 font-display text-[11px] font-bold uppercase tracking-wide text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        Reset
      </button>
    )}
    <button
      type="button"
      onClick={() => zoom.zoomBy(1 / 1.6)}
      aria-label="Zoom in"
      className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-night/90 text-base font-bold leading-none text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      +
    </button>
    <button
      type="button"
      onClick={() => zoom.zoomBy(1.6)}
      disabled={!zoom.zoomed}
      aria-label="Zoom out"
      className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-night/90 text-base font-bold leading-none text-foreground disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      −
    </button>
  </div>
);

export interface PickItem {
  key: string;
  title: string;
  /** a club for its logo */
  team?: string | null;
  sub?: ReactNode;
  badge?: string;
  onPick: (e: { clientX: number; clientY: number; currentTarget: Element }) => void;
}

/** The nearby marks around a tapped spot, nearest first. `at` is relative to the `relative` wrapper of `width`. */
export const ChartPicker = ({ at, items, width, onClose, heading }: { at: { x: number; y: number }; items: PickItem[]; width: number; onClose: () => void; heading?: string }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // a press anywhere else closes it but still reaches what is under it (the chart: double tap, another mark)
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', k);
    document.addEventListener('pointerdown', away, true);
    return () => {
      window.removeEventListener('keydown', k);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [onClose]);
  const w = Math.min(268, Math.max(200, width - 16));
  const left = Math.min(Math.max(8, at.x - w / 2), Math.max(8, width - w - 8));
  return (
    <>
      <div
        ref={ref}
        role="dialog"
        aria-label={heading ?? `${items.length} here`}
        data-no-swipe
        className="absolute z-40 rounded-md border border-line bg-popover p-1 shadow-elevated"
        style={{ left, top: at.y + 16, width: w }}
      >
        <p className="flex items-center justify-between px-2 pb-1 pt-0.5 font-pixel text-[8px] uppercase text-muted-foreground">
          {heading ?? `${items.length} here`}
          <button type="button" onClick={onClose} className="inline-flex h-6 w-6 items-center justify-center rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label="Close">
            ×
          </button>
        </p>
        <ul className="max-h-[300px] overflow-y-auto">
          {items.map((it, i) => (
            <li key={it.key}>
              <button
                type="button"
                autoFocus={i === 0}
                onClick={(e) => {
                  it.onPick(e);
                  onClose();
                }}
                className="flex min-h-[44px] w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-panel-2 focus-visible:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {it.team ? <TeamLogo team={it.team} size={20} decorative backed /> : <span className="w-5 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate font-semibold text-foreground">
                    {it.title}
                    {it.badge && <span className="rounded-sm bg-gold/20 px-1 font-pixel text-[7px] text-gold">{it.badge}</span>}
                  </span>
                  {it.sub && <span className="block truncate font-mono tabular-nums text-muted-foreground">{it.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};
