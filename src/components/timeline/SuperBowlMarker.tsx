import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { YearSlot } from './timelineModel';

export const GOLD = '45 100% 55%';

export type MarkerKind = 'won' | 'lost' | 'out' | 'unknown' | 'pending';

export const markerKind = (slot: YearSlot): MarkerKind => {
  if (!slot.sb) return 'pending';
  switch (slot.sb.yourResult) {
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
    case 'not captured':
      return 'unknown';
    default:
      return 'out';
  }
};

/** The glyph only — reused by the legend. */
export const MarkerGlyph = ({ kind, color, className }: { kind: MarkerKind; color?: string | null; className?: string }) => {
  const base = 'block rounded-full transition-transform';
  switch (kind) {
    case 'won':
      return (
        <span
          aria-hidden
          className={cn(base, 'h-2.5 w-2.5', className)}
          style={{
            background: `hsl(${color ?? GOLD})`,
            boxShadow: `0 0 0 2px hsl(${GOLD}), 0 0 8px hsl(${GOLD} / 0.55)`,
          }}
        />
      );
    case 'lost':
      return <span aria-hidden className={cn(base, 'h-2.5 w-2.5 border-2 border-destructive bg-destructive/15', className)} />;
    case 'unknown':
      return <span aria-hidden className={cn(base, 'h-2.5 w-2.5 border border-dashed border-muted-foreground/70', className)} />;
    case 'pending':
      return <span aria-hidden className={cn(base, 'h-2 w-2 border-2 border-primary motion-safe:animate-pulse', className)} />;
    default:
      return <span aria-hidden className={cn(base, 'h-1 w-1 bg-muted-foreground/45', className)} />;
  }
};

interface MarkerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  yearSlot: YearSlot;
  label: string;
  active?: boolean;
  variant: 'column' | 'chip';
}

/** One Super Bowl year: a slim column on the desktop track, a labelled chip on mobile. */
export const MarkerButton = forwardRef<HTMLButtonElement, MarkerButtonProps>(
  ({ yearSlot: slot, label, active, variant, className, ...rest }, ref) => {
    const kind = markerKind(slot);

    if (variant === 'column') {
      return (
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={cn(
            'group relative flex h-8 w-full items-center justify-center rounded-sm outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            active ? 'bg-foreground/10' : 'hover:bg-foreground/5',
            className,
          )}
          {...rest}
        >
          <MarkerGlyph kind={kind} color={slot.color} className={cn(active && 'scale-125', 'group-hover:scale-125')} />
        </button>
      );
    }

    const won = kind === 'won';
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          'relative flex h-8 min-w-0 items-center justify-center rounded-md text-[10px] font-mono font-semibold tabular-nums outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          kind === 'lost' && 'border-2 border-destructive text-destructive bg-destructive/10',
          kind === 'out' && 'bg-secondary/40 text-muted-foreground/70',
          kind === 'unknown' && 'border border-dashed border-muted-foreground/60 text-muted-foreground',
          kind === 'pending' && 'border-2 border-primary/70 text-primary motion-safe:animate-pulse',
          won && 'text-white',
          active && 'ring-2 ring-foreground/70',
          className,
        )}
        style={
          won
            ? {
                background: `hsl(${slot.color ?? GOLD})`,
                boxShadow: `inset 0 -3px 0 hsl(${GOLD})`,
                textShadow: '0 1px 2px rgb(0 0 0 / 0.6)',
              }
            : undefined
        }
        {...rest}
      >
        {slot.year}
      </button>
    );
  },
);
MarkerButton.displayName = 'MarkerButton';
