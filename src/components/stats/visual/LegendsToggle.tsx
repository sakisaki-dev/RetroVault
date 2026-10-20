import { cn } from '@/lib/utils';
import { useIncludeLegends } from './useIncludeLegends';

/** Switch for overlaying real NFL players on the Lab charts (league baselines never change). */
const LegendsToggle = ({ className }: { className?: string }) => {
  const [on, setOn] = useIncludeLegends();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      title="Adds real NFL legends from the arcade pool as extra, unranked points. Averages, percentiles and medians stay league-only."
      className={cn(
        'inline-flex min-h-[32px] items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        on ? 'border-gold/70 bg-gold/10 text-foreground' : 'border-line bg-night/60 text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('flex h-4 w-8 shrink-0 items-center rounded-full px-0.5 transition-colors', on ? 'justify-end bg-gold' : 'justify-start bg-panel-2')}>
        <span className={cn('h-3 w-3 rounded-full', on ? 'bg-night' : 'bg-muted-foreground')} />
      </span>
      Include real NFL players
      <span className="rounded-sm bg-flag/80 px-1 font-pixel text-[7px] text-night">NFL</span>
    </button>
  );
};

export default LegendsToggle;
