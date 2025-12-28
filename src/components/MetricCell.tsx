import { getMetricColor, getMetricBgColor, formatNumber, formatDecimal } from '@/utils/metricColors';

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
  const color = getMetricColor(value, metric);
  const bgColor = getMetricBgColor(value, metric);
  const formattedValue = format === 'number' ? formatNumber(value) : formatDecimal(value, decimalPlaces);

  return (
    <span 
      className={`font-mono font-medium px-2 py-1 rounded ${isLeader ? 'relative pl-6' : ''}`}
      style={{ 
        color,
        backgroundColor: bgColor,
      }}
    >
      {isLeader && (
        <span className="absolute left-1 text-xs">👑</span>
      )}
      {formattedValue}
    </span>
  );
};

export default MetricCell;
