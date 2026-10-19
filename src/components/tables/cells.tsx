import type { ReactNode } from 'react';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { useJerseyNumbers } from '@/utils/jerseys';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatDecimal,
  formatNumber,
  getMetricBgColor,
  getMetricColor,
  getMetricTier,
  getTierLabel,
  type MetricTier,
} from '@/utils/metricColors';

/** Short on-screen tier labels so tiers are never conveyed by color alone. */
export const TIER_SHORT: Record<MetricTier, string> = {
  legendary: 'LGND',
  goat: 'GOAT',
  elite: 'ELITE',
  veryGood: 'V.GOOD',
  average: 'AVG',
  belowAvg: 'LOW',
};

const LEGACY_SHORT: Record<MetricTier, string> = { ...TIER_SHORT, goat: 'ELITE', elite: 'GREAT', veryGood: 'HOF' };

/** Plain stat number; league leaders get a gold crown icon plus screen-reader text. */
export const LeaderStat = ({ value, isLeader = false, decimals }: { value: number; isLeader?: boolean; decimals?: number }) => {
  const text = decimals != null ? formatDecimal(value ?? 0, decimals) : formatNumber(value ?? 0);
  return (
    <span className={cn('inline-flex items-center justify-end gap-1 font-mono tabular-nums', isLeader ? 'font-bold text-gold' : 'text-foreground')}>
      {isLeader && (
        <>
          <Crown className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Leader: </span>
        </>
      )}
      {text}
    </span>
  );
};

/** Color-coded advanced metric with a visible tier label. */
export const TierMetric = ({
  value,
  metric,
  isLeader = false,
  format = 'decimal',
  decimalPlaces = 2,
  showLabel = true,
}: {
  value: number;
  metric: string;
  isLeader?: boolean;
  format?: 'number' | 'decimal';
  decimalPlaces?: number;
  showLabel?: boolean;
}) => {
  const v = value ?? 0;
  const tier = getMetricTier(v, metric);
  const color = getMetricColor(v, metric);
  const text = format === 'number' ? formatNumber(Math.round(v)) : formatDecimal(v, decimalPlaces);
  return (
    <span className="inline-flex items-center justify-end gap-1.5" title={`${getTierLabel(tier, metric)}${isLeader ? ' · Leader' : ''}`}>
      {isLeader && (
        <>
          <Crown className="h-3 w-3 text-gold" aria-hidden="true" />
          <span className="sr-only">Leader: </span>
        </>
      )}
      <span
        className="font-mono font-semibold tabular-nums rounded px-1 py-0.5"
        style={{ color, backgroundColor: getMetricBgColor(v, metric) }}
      >
        {text}
      </span>
      {showLabel ? (
        <span className="w-[3.25rem] text-left text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>
          <span aria-hidden="true">{(metric === 'careerLegacy' ? LEGACY_SHORT : TIER_SHORT)[tier]}</span>
          <span className="sr-only">({getTierLabel(tier, metric)})</span>
        </span>
      ) : (
        <span className="sr-only">({getTierLabel(tier, metric)})</span>
      )}
    </span>
  );
};

/** Column header with an accessible tooltip (focusable, works on hover and keyboard focus). */
export const HeaderTip = ({ label, tip, children }: { label: ReactNode; tip?: string; children?: ReactNode }) => {
  if (!tip) return <>{children ?? label}</>;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children ?? <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">{label}</span>}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[16rem] text-xs normal-case tracking-normal">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
};

/** Player name button for stat tables: name, small jersey number, and nickname. */
export const PlayerNameCell = ({
  player,
  onSelect,
  compact = false,
}: {
  player: Pick<Player, 'name' | 'position' | 'nickname'>;
  onSelect: () => void;
  /** One line: the nickname moves into the tooltip */
  compact?: boolean;
}) => {
  const { numberFor } = useJerseyNumbers();
  const number = numberFor(player);
  return (
    <button
      type="button"
      className="flex flex-col items-start text-left min-w-0 max-w-full rounded"
      title={compact && player.nickname ? `"${player.nickname}"` : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className="flex items-baseline gap-1.5 min-w-0 max-w-full">
        <span className="font-semibold text-foreground truncate hover:text-gold">{player.name}</span>
        <span className="shrink-0 font-display text-xs font-bold italic tabular-nums text-muted-foreground">
          <span aria-hidden="true">#{number}</span>
          <span className="sr-only">, number {number}</span>
        </span>
      </span>
      {player.nickname && !compact && <span className="text-xs text-muted-foreground italic truncate max-w-full">"{player.nickname}"</span>}
    </button>
  );
};
