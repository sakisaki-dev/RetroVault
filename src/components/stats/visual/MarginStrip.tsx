import type { RecordBoardData } from '../records';
import { GOLD } from './chartKit';
import { VIZ } from '../analytics/viz';

/**
 * "How far ahead": a dot strip of the top five (scale = #5 … #1, so the gaps are readable even when the marks
 * are close), the holder as the large gold dot and a gold bracket spanning his margin over #2. Decorative: the
 * margin is always printed next to it.
 */
const MarginStrip = ({ board, className }: { board: RecordBoardData; className?: string }) => {
  const top = board.entries.slice(0, 5);
  if (top.length < 2) return null;
  const hi = top[0].value;
  const lo = top[top.length - 1].value;
  const x = (v: number) => (hi > lo ? 6 + ((v - lo) / (hi - lo)) * 88 : 94);
  const x1 = x(top[1].value);
  const x0 = x(top[0].value);
  return (
    <span aria-hidden="true" className={className ?? 'relative block h-4 w-full'}>
      <span className="absolute inset-x-0 top-1/2 h-px" style={{ background: VIZ.axis }} />
      <span className="absolute top-0 h-[3px] rounded-full" style={{ left: `${x1}%`, width: `${Math.max(x0 - x1, 0.5)}%`, background: GOLD, opacity: 0.8 }} />
      {top
        .slice(1)
        .reverse()
        .map((e, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(e.value)}%`, background: VIZ.muted, boxShadow: `0 0 0 1.5px ${VIZ.surface}` }}
          />
        ))}
      <span
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]"
        style={{ left: `${x0}%`, background: GOLD, boxShadow: `0 0 0 2px ${VIZ.surface}` }}
      />
    </span>
  );
};

export default MarginStrip;
