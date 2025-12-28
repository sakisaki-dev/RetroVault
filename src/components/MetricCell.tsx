import { getMetricClass, formatNumber, formatDecimal } from '@/utils/metricColors';

interface MetricCellProps {
  value: number;
  metric: string;
  isLeader?: boolean;
  format?: 'number' | 'decimal';
  decimalPlaces?: number;
}

const MetricCell = ({ 
  value, 
  metric, 
  isLeader = false, 
  format = 'decimal',
  decimalPlaces = 2 
}: MetricCellProps) => {
  const colorClass = getMetricClass(value, metric);
  const formattedValue = format === 'number' ? formatNumber(value) : formatDecimal(value, decimalPlaces);

  return (
    <span className={`font-mono font-medium ${colorClass} ${isLeader ? 'relative pl-5' : ''}`}>
      {isLeader && (
        <span className="absolute left-0 text-xs">👑</span>
      )}
      {formattedValue}
    </span>
  );
};

export default MetricCell;
