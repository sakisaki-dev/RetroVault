import { useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AdvMetric } from '@/config/advanced';

interface Props {
  metric: Pick<AdvMetric, 'label' | 'short' | 'definition' | 'minLabel' | 'lowerIsBetter'>;
  /** Show the short label (table headers) instead of the full one. */
  short?: boolean;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * A metric name that reveals its definition and minimum sample on hover, keyboard focus or tap.
 * The trigger is a real button, so the definition is reachable without a mouse.
 */
const MetricLabel = ({ metric, short = false, className, side = 'top' }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`${metric.label}. ${metric.definition} Minimum sample: ${metric.minLabel}.`}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm text-left underline decoration-dotted decoration-muted-foreground/60 underline-offset-4',
            'hover:decoration-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
            className,
          )}
        >
          {short ? metric.short : metric.label}
          <Info className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[18rem] border-line bg-popover text-left text-xs leading-snug">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-gold">{metric.label}</p>
        <p className="mt-1 text-foreground">{metric.definition}</p>
        <p className="mt-1.5 font-pixel text-[9px] uppercase text-muted-foreground">
          {metric.minLabel}
          {metric.lowerIsBetter ? ' · lower is better' : ''}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

export default MetricLabel;
