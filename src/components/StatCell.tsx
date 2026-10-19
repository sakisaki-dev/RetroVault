import { cn } from '@/lib/utils';
import { LeaderStat } from './tables/cells';

interface StatCellProps {
  value: number;
  isLeader?: boolean;
  decimals?: number;
  className?: string;
}

/** Plain stat number; leaders get a gold Lucide crown plus screen-reader text. */
const StatCell = ({ value, isLeader = false, decimals, className }: StatCellProps) => (
  <span className={cn('inline-flex', className)}>
    <LeaderStat value={value} isLeader={isLeader} decimals={decimals} />
  </span>
);

export default StatCell;
