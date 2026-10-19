import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** Row of toggle chips (one pressed at a time). Wraps on narrow screens. */
const Chips = <T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<NoInfer<T>>[];
  value: T;
  onChange: (v: NoInfer<T>) => void;
  label: string;
  className?: string;
}) => (
  <div role="group" aria-label={label} className={cn('flex flex-wrap gap-1', className)}>
    {options.map((o) => {
      const on = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          aria-pressed={on}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-[32px] rounded px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
            on ? 'bg-gold text-night' : 'bg-night/60 text-muted-foreground hover:bg-panel-2 hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export default Chips;
