import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import './controls.css';

/**
 * PillScroller: a single-choice list of pills in one row that scrolls sideways (the site's pattern for long
 * lists like seasons or weeks, where a dropdown hides the choices). The chosen pill is centred on mount and whenever
 * it changes; swipe on a phone, wheel or the arrow buttons on a desktop (arrows show only when there is more to scroll);
 * arrow keys move the choice. Pills wear the site gold.
 */
export interface PillOption<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

export const PillScroller = <T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  lead,
  trail,
}: {
  options: PillOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  /** small kicker before the pills (stays put) */
  lead?: ReactNode;
  /** a fixed control after the pills (stays put) */
  trail?: ReactNode;
}) => {
  const box = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    setEdge({ l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  const centre = useCallback((smooth: boolean) => {
    const el = box.current;
    const on = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !on) return;
    const to = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, to), behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  const first = useRef(true);
  useLayoutEffect(() => {
    centre(!first.current);
    first.current = false;
    measure();
  }, [value, centre, measure]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    ro?.observe(el);
    // a vertical wheel scrolls the row sideways (a trackpad's own sideways swipe is left alone)
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { ro?.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [measure]);
  const page = (d: number) => box.current?.scrollBy({ left: d * box.current.clientWidth * 0.7, behavior: 'smooth' });
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const cur = options.findIndex((o) => o.value === value);
  const onKey = (e: React.KeyboardEvent) => {
    const at = enabled.indexOf(cur);
    let to: number | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = enabled[Math.min(enabled.length - 1, at + 1)];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = enabled[Math.max(0, at - 1)];
    else if (e.key === 'Home') to = enabled[0];
    else if (e.key === 'End') to = enabled[enabled.length - 1];
    if (to === undefined) return;
    e.preventDefault();
    onChange(options[to].value);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true }));
  };
  return (
    <div className={cn('ctl-pills', className)}>
      {lead}
      <button type="button" className="ctl-pills__arrow" aria-label={`${label}: scroll back`} tabIndex={-1} hidden={!edge.l && !edge.r} disabled={!edge.l} onClick={() => page(-1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <div ref={box} role="radiogroup" aria-label={label} className="ctl-pills__row" data-l={edge.l ? '' : undefined} data-r={edge.r ? '' : undefined} onScroll={measure} onKeyDown={onKey}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (cur < 0 && i === enabled[0]) ? 0 : -1}
              disabled={o.disabled}
              title={o.title}
              className={cn('ctl-pills__pill', on && 'is-on')}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <button type="button" className="ctl-pills__arrow" aria-label={`${label}: scroll forward`} tabIndex={-1} hidden={!edge.l && !edge.r} disabled={!edge.r} onClick={() => page(1)}>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
      {trail}
    </div>
  );
};
export default PillScroller;
