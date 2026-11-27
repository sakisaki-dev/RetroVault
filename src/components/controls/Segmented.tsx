import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Select } from './Select';
import './controls.css';

/**
 * Segmented: a segmented control, an ARIA radio group with a roving tabindex (arrows, Home and End move and select).
 * Props: options [{value, label, icon?, disabled?}], value, onChange, label (accessible name), size? 'sm' | 'md',
 * wrap? (rows instead of scrolling), className?. A long list (more than 6 options, or more than 32 characters of labels)
 * becomes a Select with the current value; `compact` = 'never' keeps the row.
 */
export interface SegOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}
export const Segmented = <T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  wrap,
  compact = 'auto',
  className,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
  wrap?: boolean;
  compact?: 'auto' | 'never' | 'always';
  className?: string;
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const move = (from: number, to: number) => {
    const o = options[to];
    if (!o) return;
    onChange(o.value);
    refs.current[to]?.focus();
    void from;
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const at = enabled.indexOf(i);
    let to: number | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = enabled[(at + 1) % enabled.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') to = enabled[0];
    else if (e.key === 'End') to = enabled[enabled.length - 1];
    if (to === undefined) return;
    e.preventDefault();
    move(i, to);
  };
  const cur = Math.max(0, options.findIndex((o) => o.value === value));
  const boxRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const placed = useRef(false);
  // the highlight is one pill that slides to the chosen option instead of snapping
  useLayoutEffect(() => {
    if (wrap) return;
    const place = () => {
      const btn = refs.current[cur];
      const th = thumbRef.current;
      if (!btn || !th) return;
      if (!placed.current) th.style.transition = 'none'; // no slide in from the left edge on mount
      th.style.width = `${btn.offsetWidth}px`;
      th.style.height = `${btn.offsetHeight}px`;
      th.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
      th.style.opacity = '1';
      if (!placed.current) {
        void th.offsetWidth;
        th.style.transition = '';
        placed.current = true;
      }
    };
    place();
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(box);
    refs.current.forEach((b) => b && ro.observe(b));
    return () => ro.disconnect();
  }, [cur, wrap, options.length]);
  const chars = options.reduce((n, o) => n + (typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label).length : 4), 0);
  if (!wrap && compact !== 'never' && (compact === 'always' || options.length > 6 || chars > 32)) {
    return (
      <Select
        label={label}
        prefix={label.length <= 10 ? label : undefined}
        className={className}
        value={value}
        onChange={onChange}
        options={options.map((o) => ({ value: o.value, label: o.label, text: typeof o.label === 'string' ? o.label : undefined }))}
      />
    );
  }
  return (
    <div ref={boxRef} role="radiogroup" aria-label={label} className={cn('cs-toggle', `cs-toggle--${size}`, wrap && 'cs-toggle--wrap', !wrap && 'cs-toggle--slide', className)}>
      {!wrap && <span ref={thumbRef} className="cs-toggle__thumb" aria-hidden="true" />}
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === cur ? 0 : -1}
            disabled={o.disabled}
            className={cn('cs-seg', on && 'is-on')}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
};
export default Segmented;
