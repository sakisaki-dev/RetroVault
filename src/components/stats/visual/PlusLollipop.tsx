import type { Player } from '@/types/player';
import type { MetricBoard, MetricRow } from '@/config/advanced';

type Row = MetricRow & { nfl?: boolean };
import { cn } from '@/lib/utils';
import TeamLogo from '../../brand/TeamLogo';
import { VIZ, fmtNum, fmtPlus, ordinal } from '../analytics/viz';
import { keyOf } from '../records';
import { niceTicks } from './chartKit';

const ABOVE = `rgb(${VIZ.above})`;
const BELOW = `rgb(${VIZ.below})`;
const GRID = 'grid grid-cols-[1.1rem_minmax(0,6.25rem)_minmax(0,1fr)_3.4rem] items-center gap-x-2 sm:grid-cols-[1.25rem_minmax(0,9rem)_minmax(0,1fr)_4rem]';

interface Scale {
  /** Value plotted for a row (+ index when the metric has one, else the raw value). */
  of: (r: MetricRow) => number;
  ref: number;
  lo: number;
  hi: number;
  ticks: number[];
  fmtTick: (v: number) => string;
}

const buildScale = (board: MetricBoard, all: Row[]): Scale => {
  const usePlus = !!board.metric.plus;
  const of = (r: MetricRow) => (usePlus ? r.plus ?? 100 : r.value);
  const ref = usePlus ? 100 : board.mean;
  const vals = all.map(of);
  const { ticks, domain } = niceTicks(Math.min(ref, ...vals), Math.max(ref, ...vals), 4);
  return { of, ref, lo: domain[0], hi: domain[1], ticks, fmtTick: (v) => (usePlus ? String(Math.round(v)) : fmtNum(v, board.metric.decimals)) };
};

const LollipopRow = ({ r, board, scale, onSelect }: { r: Row; board: MetricBoard; scale: Scale; onSelect: (p: Player) => void }) => {
  const m = board.metric;
  const suffix = m.suffix ?? '';
  const x = (v: number) => ((v - scale.lo) / (scale.hi - scale.lo || 1)) * 100;
  const v = scale.of(r);
  const better = m.plus ? v >= 100 : m.lowerIsBetter ? r.value <= board.mean : r.value >= board.mean;
  const color = better ? ABOVE : BELOW;
  const a = x(Math.min(v, scale.ref));
  const b = x(Math.max(v, scale.ref));
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(r.player)}
        aria-label={`${r.nfl ? 'Real NFL, unranked' : `Rank ${r.rank}`}: ${r.player.name}, ${fmtNum(r.value, m.decimals)}${suffix}${r.plus != null ? `, + index ${fmtPlus(r.plus)}` : ''}, ${ordinal(r.pct)} percentile. Open player`}
        className={cn(GRID, 'h-7 w-full rounded px-1 text-left hover:bg-panel-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold')}
      >
        <span className={cn('text-center font-pixel text-[9px]', r.rank === 1 ? 'text-gold' : 'text-muted-foreground')} aria-hidden="true">
          {r.nfl ? <span className="rounded-sm bg-flag/80 px-0.5 text-[6px] text-night">NFL</span> : r.rank}
        </span>
        <span className="flex min-w-0 items-center gap-1.5" aria-hidden="true">
          {r.player.team ? <TeamLogo team={r.player.team} size={16} decorative /> : <span className="w-4" />}
          <span className="truncate text-xs font-semibold sm:text-sm">{r.player.name}</span>
        </span>
        <span className="relative h-full" aria-hidden="true">
          <span className="absolute inset-y-0 w-px border-l border-dashed" style={{ left: `${x(scale.ref)}%`, borderColor: VIZ.muted }} />
          <span className="absolute top-1/2 h-0.5 -translate-y-1/2 motion-safe:transition-all motion-safe:duration-500" style={{ left: `${a}%`, width: `${b - a}%`, background: color }} />
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:transition-all motion-safe:duration-500"
            style={
              r.nfl
                ? { left: `${x(v)}%`, background: VIZ.surface, border: `2px solid ${color}`, borderRadius: 2 }
                : { left: `${x(v)}%`, background: color, boxShadow: `0 0 0 2px ${VIZ.surface}` }
            }
          />
        </span>
        <span className="text-right font-mono text-xs font-bold tabular-nums text-chalk sm:text-sm" aria-hidden="true">
          {fmtNum(r.value, m.decimals)}
          {suffix}
        </span>
      </button>
    </li>
  );
};

/**
 * Lollipop chart of every qualifier: each stem runs from the position average (dashed line) to the player, on the
 * + index axis (100 = average) when the metric has one, else on raw values. Blue = better than average, red = worse;
 * the side of the line says the same thing without colour.
 */
const PlusLollipop = ({ board, rows, allRows, onSelect }: { board: MetricBoard; rows: Row[]; allRows?: Row[]; onSelect: (p: Player) => void }) => {
  const scale = buildScale(board, allRows ?? board.rows);
  const x = (v: number) => ((v - scale.lo) / (scale.hi - scale.lo || 1)) * 100;
  return (
    <div className="min-w-0">
      <div className={cn(GRID, 'px-1 pb-1')} aria-hidden="true">
        <span />
        <span className="font-pixel text-[8px] uppercase text-muted-foreground">Player</span>
        <span className="relative h-4 text-[10px] text-muted-foreground">
          <span className="absolute -translate-x-1/2 whitespace-nowrap font-pixel text-[8px] uppercase" style={{ left: `${x(scale.ref)}%` }}>
            {board.metric.plus ? 'avg = 100' : 'avg'}
          </span>
        </span>
        <span className="text-right font-pixel text-[8px] uppercase text-muted-foreground">{board.metric.short}</span>
      </div>
      <ol aria-label={`${board.position}s by ${board.metric.label}`}>
        {rows.map((r) => (
          <LollipopRow key={`${r.nfl ? 'nfl:' : ''}${keyOf(r.player)}`} r={r} board={board} scale={scale} onSelect={onSelect} />
        ))}
      </ol>
      <div className={cn(GRID, 'px-1 pt-1')} aria-hidden="true">
        <span />
        <span className="text-[10px] text-muted-foreground">{board.metric.plus ? '+ index' : board.metric.short}</span>
        <span className="relative h-4 border-t" style={{ borderColor: VIZ.axis }}>
          {scale.ticks.map((t, i) => (
            <span
              key={t}
              className={cn('absolute top-0.5 font-mono text-[10px] tabular-nums text-muted-foreground', i === 0 ? '' : i === scale.ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2')}
              style={{ left: `${x(t)}%` }}
            >
              {scale.fmtTick(t)}
            </span>
          ))}
        </span>
        <span />
      </div>
    </div>
  );
};

export default PlusLollipop;
