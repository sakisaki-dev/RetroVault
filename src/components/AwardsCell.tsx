import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AWARD_META, type AwardKey } from '@/utils/playerMeta';

interface AwardsCellProps {
  rings?: number;
  mvp?: number;
  opoy?: number; // OPOY for offense, DPOY for defense
  sbmvp?: number;
  roty?: number;
  isDefense?: boolean;
  className?: string;
}

/**
 * Compact award chips (icon + count) for tables. Each chip is keyboard-focusable and opens a
 * tooltip on hover or focus; screen readers get the full text without needing the tooltip.
 */
const AwardsCell = ({ rings = 0, mvp = 0, opoy = 0, sbmvp = 0, roty = 0, isDefense = false, className }: AwardsCellProps) => {
  const counts: Record<AwardKey, number> = { rings, mvp, opoy, sbmvp, roty };
  const awards = AWARD_META[isDefense ? 'defense' : 'offense'].filter((a) => counts[a.key] > 0);

  if (awards.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No awards</span>
      </span>
    );
  }

  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)} aria-label="Awards">
      {awards.map(({ key, long, Icon, hsl }) => {
        const n = counts[key];
        const text = `${n}× ${long}`;
        return (
          <li key={key}>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums cursor-help"
                  style={{ backgroundColor: `hsl(${hsl} / 0.14)`, color: `hsl(${hsl})`, boxShadow: `inset 0 0 0 1px hsl(${hsl} / 0.3)` }}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  <span aria-hidden="true">{n}</span>
                  <span className="sr-only">{text}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {text}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
};

export default AwardsCell;
