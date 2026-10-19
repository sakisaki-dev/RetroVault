import { VIZ, ordinal } from './viz';

/** Single-series meter: blue fill on a lighter step of the same hue, 4px rounded data end. */
const PercentileBar = ({ pct, label, className }: { pct: number; label: string; className?: string }) => (
  <div
    role="meter"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(pct)}
    aria-valuetext={`${ordinal(pct)} percentile`}
    className={className ?? 'h-2 w-full overflow-hidden rounded-sm'}
    style={{ background: VIZ.track }}
  >
    <div className="h-full rounded-r-[4px] transition-[width] duration-500" style={{ width: `${Math.max(pct, 1.5)}%`, background: VIZ.bar }} />
  </div>
);

export default PercentileBar;
