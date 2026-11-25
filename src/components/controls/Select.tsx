import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './controls.css';

/**
 * Select: an accessible dropdown styled as an arcade menu (replaces a native select). A button (aria-haspopup
 * listbox) opens a pixel-bordered listbox; arrows, Home, End, Enter, Space, Escape and type-ahead work, a tap outside
 * closes it, and it opens upward when there is no room below. Props: options [{value, label, hint?}], value, onChange,
 * label (accessible name), prefix? (a pixel kicker inside the button, e.g. "SEASON"), placeholder?, className?. The menu
 * is absolutely positioned under the button, so an ancestor with overflow hidden can clip it: keep it out of those.
 *
 * Stepper: a ◀ value ▶ stepper for a number or a year. Props: value, onChange, label, and either min/max/step or
 * values (an explicit list, e.g. the seasons played), format? (value to text), wrap?. It is a spinbutton (ArrowLeft and
 * ArrowRight, Down and Up, Home and End step it); the arrows disable at the ends.
 */
export interface SelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  text?: string;
}
export const Select = <T extends string | number>({
  options,
  value,
  onChange,
  label,
  prefix,
  placeholder = 'Select',
  className,
}: {
  options: SelectOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  label: string;
  prefix?: ReactNode;
  placeholder?: string;
  className?: string;
}) => {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const sel = options.findIndex((o) => o.value === value);
  const [active, setActive] = useState(Math.max(0, sel));
  const typed = useRef({ s: '', t: 0 });

  const show = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    setUp(!!r && r.bottom + 260 > window.innerHeight && r.top > 260);
    setActive(Math.max(0, sel));
    setOpen(true);
  }, [sel]);
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  }, []);
  const pick = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, close]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKey = (e: KeyboardEvent) => {
    const n = options.length;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape') return e.preventDefault(), close();
    if (e.key === 'Tab') return close(false);
    if (e.key === 'ArrowDown') return e.preventDefault(), setActive((a) => Math.min(n - 1, a + 1));
    if (e.key === 'ArrowUp') return e.preventDefault(), setActive((a) => Math.max(0, a - 1));
    if (e.key === 'Home') return e.preventDefault(), setActive(0);
    if (e.key === 'End') return e.preventDefault(), setActive(n - 1);
    if (e.key === 'Enter' || e.key === ' ') return e.preventDefault(), pick(active);
    if (e.key.length === 1) {
      const now = Date.now();
      typed.current.s = now - typed.current.t > 700 ? e.key : typed.current.s + e.key;
      typed.current.t = now;
      const q = typed.current.s.toLowerCase();
      const hit = options.findIndex((o) => (o.text ?? String(o.label)).toLowerCase().startsWith(q));
      if (hit >= 0) setActive(hit);
    }
  };

  const cur = sel >= 0 ? options[sel] : null;
  return (
    <div ref={root} className={cn('cs-select', open && 'is-open', up && 'is-up', className)}>
      <button
        ref={btn}
        type="button"
        className="cs-select__btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        aria-label={label}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
      >
        {prefix && <span className="cs-kicker">{prefix}</span>}
        <span className="cs-select__val">{cur ? cur.label : placeholder}</span>
        <span className="cs-select__caret" aria-hidden="true" />
      </button>
      {open && (
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label={label} className="cs-select__menu">
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === sel}
              className={cn('cs-select__opt', i === active && 'is-active', i === sel && 'is-sel')}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <span>{o.label}</span>
              {o.hint && <span className="cs-select__hint">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const Stepper = ({
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
  values,
  format,
  wrap,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  values?: number[];
  format?: (v: number) => string;
  wrap?: boolean;
  className?: string;
}) => {
  const idx = values ? values.indexOf(value) : -1;
  const lo = values ? 0 : (min ?? -Infinity);
  const hi = values ? values.length - 1 : (max ?? Infinity);
  const pos = values ? idx : value;
  const go = (d: number) => {
    let n = pos + d * (values ? 1 : step);
    if (n < lo) n = wrap ? hi : lo;
    if (n > hi) n = wrap ? lo : hi;
    onChange(values ? values[n] : n);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      go(1);
    }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      go(-1);
    }
    else if (e.key === 'Home' && Number.isFinite(lo)) {
      e.preventDefault();
      onChange(values ? values[0] : lo);
    }
    else if (e.key === 'End' && Number.isFinite(hi)) {
      e.preventDefault();
      onChange(values ? values[hi] : hi);
    }
  };
  return (
    <div className={cn('cs-stepper', className)} role="group" aria-label={label}>
      <button type="button" className="cs-stepper__btn" aria-label={`${label}: previous`} disabled={!wrap && pos <= lo} onClick={() => go(-1)}>
        <span className="cs-tri cs-tri--l" aria-hidden="true" />
      </button>
      <span className="cs-stepper__val" role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={value} aria-valuemin={Number.isFinite(lo) ? (values ? values[0] : lo) : undefined} aria-valuemax={Number.isFinite(hi) ? (values ? values[hi] : hi) : undefined} onKeyDown={onKey}>
        {format ? format(value) : value}
      </span>
      <button type="button" className="cs-stepper__btn" aria-label={`${label}: next`} disabled={!wrap && pos >= hi} onClick={() => go(1)}>
        <span className="cs-tri cs-tri--r" aria-hidden="true" />
      </button>
    </div>
  );
};
export default Select;
