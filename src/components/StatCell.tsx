import { formatNumber } from '@/utils/metricColors';

interface StatCellProps {
  value: number;
  isLeader?: boolean;
  className?: string;
}

const StatCell = ({ value, isLeader = false, className = '' }: StatCellProps) => {
  return (
    <span className={`font-mono ${isLeader ? 'font-bold text-primary relative pl-5' : 'text-foreground'} ${className}`}>
      {isLeader && (
        <span className="absolute left-0 text-xs">👑</span>
      )}
      {formatNumber(value)}
    </span>
  );
};

export default StatCell;
