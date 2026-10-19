import { useMemo, useState } from 'react';
import { ListOrdered } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import { evaluateMetric, metricsFor, type AdvContext } from '@/config/advanced';
import { POSITION_NAMES } from '@/utils/playerMeta';
import TeamLogo from '../../brand/TeamLogo';
import MetricLabel from './MetricLabel';
import PercentileBar from './PercentileBar';
import Chips from './Chips';
import { fmtNum, fmtPlus, ordinal } from './viz';
import { keyOf } from '../records';

const SHOWN = 10;

interface Props {
  players: Player[];
  ctx: AdvContext;
  position: Position;
  onSelect: (p: Player) => void;
}

/** Position leaderboard for any advanced metric: value, + index and percentile per qualifier. */
const MetricLeaderboard = ({ players, ctx, position, onSelect }: Props) => {
  const metrics = metricsFor(position);
  const [picked, setPicked] = useState<Partial<Record<Position, string>>>({});
  const [expanded, setExpanded] = useState(false);
  const metric = metrics.find((m) => m.id === picked[position]) ?? metrics[0];
  const board = useMemo(() => evaluateMetric(players, metric, position, ctx), [players, metric, position, ctx]);
  const rows = expanded ? board.rows : board.rows.slice(0, SHOWN);
  const suffix = metric.suffix ?? '';

  return (
    <section aria-labelledby="lab-board-title" className="glass-card flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div>
        <h3 id="lab-board-title" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
          <ListOrdered className="h-4 w-4 text-gold" aria-hidden="true" />
          {POSITION_NAMES[position]} leaderboard
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Pick a metric. <b className="text-foreground">+</b> is a position index (100 = average qualifier, 120 = 20% better); the bar is the percentile among qualifiers.
        </p>
      </div>

      <Chips
        label="Metric"
        value={metric.id}
        onChange={(id) => {
          setPicked((s) => ({ ...s, [position]: id }));
          setExpanded(false);
        }}
        options={metrics.map((m) => ({ value: m.id, label: m.short, title: m.label }))}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-y border-line/70 py-2 text-sm">
        <MetricLabel metric={metric} className="font-display font-bold uppercase tracking-wide text-foreground" />
        <span className="font-pixel text-[9px] uppercase text-muted-foreground">
          {metric.minLabel} · avg {fmtNum(board.mean, metric.decimals)}
          {suffix}
        </span>
      </div>

      {board.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No {position} meets the minimum sample yet.</p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">
            {POSITION_NAMES[position]}s ranked by {metric.label} ({metric.minLabel})
          </caption>
          <thead>
            <tr className="text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <th scope="col" className="w-7 pb-1 font-normal">
                #
              </th>
              <th scope="col" className="pb-1 font-normal">
                Player
              </th>
              <th scope="col" className="w-16 pb-1 text-right font-normal">
                {metric.short}
              </th>
              <th scope="col" className="w-11 pb-1 text-right font-normal">
                <abbr title="Position index, 100 = average" className="no-underline">
                  +
                </abbr>
              </th>
              <th scope="col" className="hidden w-[28%] pb-1 pl-3 font-normal sm:table-cell">
                Percentile
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={keyOf(r.player)} className="group border-t border-line/40">
                <td className={cn('py-1.5 font-pixel text-[10px]', r.rank === 1 ? 'text-gold' : 'text-muted-foreground')}>{r.rank}</td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(r.player)}
                    className="flex w-full min-w-0 items-center gap-1.5 rounded text-left font-semibold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    {r.player.team ? <TeamLogo team={r.player.team} size={18} decorative /> : <span className="w-[18px]" aria-hidden="true" />}
                    <span className="truncate">{r.player.name}</span>
                  </button>
                  {/* Mobile: percentile under the name */}
                  <PercentileBar
                    pct={r.pct}
                    label={`${r.player.name} percentile`}
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-sm sm:hidden"
                  />
                </td>
                <td className="py-1.5 text-right font-mono font-bold tabular-nums text-chalk">
                  {fmtNum(r.value, metric.decimals)}
                  {suffix}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums text-secondary-foreground">{fmtPlus(r.plus)}</td>
                <td className="hidden py-1.5 pl-3 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <PercentileBar pct={r.pct} label={`${r.player.name} percentile`} className="h-2 flex-1 overflow-hidden rounded-sm" />
                    <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{ordinal(r.pct)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {board.rows.length} qualified{board.belowMin > 0 ? ` · ${board.belowMin} below ${metric.minLabel}` : ''}
        </span>
        {board.rows.length > SHOWN && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="rounded font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {expanded ? 'Show top 10' : `Show all ${board.rows.length}`}
          </button>
        )}
      </div>
    </section>
  );
};

export default MetricLeaderboard;
