import { useId, useState, type ReactNode } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  /** One sentence: what the chart shows and how to read it (also its aria description). */
  description: string;
  icon?: ReactNode;
  /** Controls in one row above the plot (filters, toggles). */
  controls?: ReactNode;
  /** The chart. Receives nothing; wrap it in role="img" yourself only if it is not interactive. */
  chart: ReactNode;
  /** Accessible table fallback with the same data. */
  table: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Graphic style: big headline title and a "Retro Vault" credit in the corner. */
  poster?: boolean;
}

/** Card for a chart with a title, description, filter row and a chart/table toggle. */
const ChartFrame = ({ title, description, icon, controls, chart, table, footer, className, poster = false }: Props) => {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className={cn('glass-card flex min-w-0 flex-col gap-3 p-3 sm:p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            id={`${id}-t`}
            className={cn(
              'flex items-center gap-2 font-display font-bold uppercase tracking-wide',
              poster ? 'text-2xl font-extrabold italic leading-none sm:text-3xl' : 'text-lg',
            )}
          >
            {icon}
            {title}
          </h3>
          <p id={`${id}-d`} className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {description}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-night/60 px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {asTable ? <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Table2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {asTable ? 'Chart' : 'Table'}
          <span className="sr-only"> view for {title}</span>
        </button>
      </div>
      {controls}
      <div className="min-w-0">{asTable ? table : chart}</div>
      {footer}
      {poster && (
        <p className="flex items-center justify-end gap-1.5 font-pixel text-[8px] uppercase tracking-wider text-muted-foreground/80" aria-hidden="true">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-gold" />
          Retro Vault · League data
        </p>
      )}
    </figure>
  );
};

export default ChartFrame;
