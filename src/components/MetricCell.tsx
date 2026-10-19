import { TierMetric } from './tables/cells';

interface MetricCellProps {
  value: number;
  metric: string;
  isLeader?: boolean;
  format?: 'number' | 'decimal';
  decimalPlaces?: number;
  /** Show the visible tier label next to the value (default true) */
  showLabel?: boolean;
}

/**
 * Advanced metric with tier color and a visible tier label. Thin wrapper over the table cell
 * so every view renders metrics the same way (leader crown is a Lucide icon with sr-only text).
 */
const MetricCell = ({ value, metric, isLeader = false, format = 'decimal', decimalPlaces = 2, showLabel = true }: MetricCellProps) => (
  <TierMetric
    value={value}
    metric={metric}
    isLeader={isLeader}
    format={format}
    decimalPlaces={decimalPlaces}
    showLabel={showLabel}
  />
);

export default MetricCell;
