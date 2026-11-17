import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type OwnedAuto } from '@/utils/collection';
import { autographValue, fmtMult, parallelOf, serialStr } from '@/config/autographs';
import AutographCanvas from './AutographCanvas';

interface AutographCarouselProps {
  autos: OwnedAuto[];
  /** The one on show (the card detail): ringed, kept in view, and the counter follows it */
  selectedId?: string;
  onSelect: (auto: OwnedAuto, from: DOMRect) => void;
  /** 'thumb' (card detail, 88px) or 'card' (the Collection's browse view, up to 200px) */
  size?: 'thumb' | 'card';
  label: string;
}

/**
 * A horizontal scroll-snap row of autographs: swipe or scroll it, the arrows (hover devices) and the dots step one at a
 * time, and the counter says where you are. Sideways scrollers are left alone by swipe-to-dismiss and the tab swipes;
 * data-no-swipe-x makes that explicit. Each canvas draws only as it scrolls near the screen (AutographCanvas).
 */
const AutographCarousel = ({ autos, selectedId, onSelect, size = 'card', label }: AutographCarouselProps) => {
  const row = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  const selIdx = selectedId ? autos.findIndex((a) => a.id === selectedId) : -1;

  // The item nearest the row's centre
  const onScroll = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const li = c as HTMLElement;
      const d = Math.abs(li.offsetLeft + li.offsetWidth / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setAt(best);
  }, []);

  const go = useCallback((i: number, smooth = true) => {
    const el = row.current;
    const li = el?.children[i] as HTMLElement | undefined;
    if (!el || !li) return;
    let behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) behavior = 'auto';
    } catch {
      /* no matchMedia */
    }
    el.scrollTo({ left: li.offsetLeft - (el.clientWidth - li.offsetWidth) / 2, behavior });
  }, []);

  // The selected one starts (and stays) in view
  useEffect(() => {
    if (selIdx >= 0) go(selIdx, false);
  }, [selIdx, go]);

  const shown = selIdx >= 0 ? selIdx : at;
  return (
    <div className={cn('ag-car', `ag-car--${size}`)} data-no-swipe-x>
      <div className="ag-car__bar">
        <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
          <span className="text-foreground">{shown + 1}</span> / {autos.length}
        </span>
        <span className="ag-car__arrows">
          <button type="button" className="ag-car__arrow" aria-label="Previous autograph" disabled={at <= 0} onClick={() => go(at - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="ag-car__arrow" aria-label="Next autograph" disabled={at >= autos.length - 1} onClick={() => go(at + 1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </span>
      </div>
      <ul className="ag-car__row" ref={row} onScroll={onScroll} aria-label={label} tabIndex={0}>
        {autos.map((a) => (
          <li key={a.id} className="ag-car__item">
            <button
              type="button"
              className={cn('ag-car__tile', a.id === selectedId && 'is-selected')}
              aria-current={a.id === selectedId ? 'true' : undefined}
              onClick={(e) => onSelect(a, e.currentTarget.getBoundingClientRect())}
              aria-label={`${a.snap.name}, ${parallelOf(a.roll.parallel).label} ${serialStr(a.roll)}`}
            >
              <AutographCanvas snap={a.snap} roll={a.roll} cacheKey={a.id} />
              <span className="ag-car__cap">
                <span className="block truncate text-xs font-semibold">{size === 'card' ? a.snap.name : parallelOf(a.roll.parallel).label}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {serialStr(a.roll)}
                  {size === 'card' && (
                    <>
                      {' '}
                      · <span className="text-gold">{fmtMult(autographValue(a.roll).total)}</span>
                    </>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {autos.length > 1 && autos.length <= 12 && (
        <div className="ag-car__dots" role="presentation">
          {autos.map((a, i) => (
            <button key={a.id} type="button" tabIndex={-1} aria-hidden="true" className={cn('ag-car__dot', i === shown && 'is-on')} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AutographCarousel;
