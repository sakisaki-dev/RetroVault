import type { Player } from '@/types/player';
import { metricsFor, type AdvMetric, type MetricBoard } from '@/config/advanced';
import MetricLabel from '../analytics/MetricLabel';
import PercentileBar from '../analytics/PercentileBar';
import { fmtNum, fmtPlus, ordinal } from '../analytics/viz';

type Group = 'Efficiency' | 'Volume' | 'Value' | 'Hardware';
const GROUPS: { key: Group; blurb: string }[] = [
  { key: 'Efficiency', blurb: 'How well, per play' },
  { key: 'Volume', blurb: 'How much, per game' },
  { key: 'Value', blurb: 'Worth over a replacement' },
  { key: 'Hardware', blurb: 'Awards per game played' },
];
const GROUP_OF: Record<string, Group> = {
  passerRating: 'Efficiency',
  ayPerAtt: 'Efficiency',
  tdPct: 'Efficiency',
  intPct: 'Efficiency',
  rushShare: 'Efficiency',
  ydsPerTouch: 'Efficiency',
  fumbleRate: 'Efficiency',
  scrimPerGame: 'Volume',
  tdPer16: 'Volume',
  impactPerGame: 'Volume',
  takeawaysPer16: 'Volume',
  tacklesPerGame: 'Volume',
  blocksPerGame: 'Volume',
  scorePerGame: 'Value',
  vor: 'Value',
  vorPer16: 'Value',
  awardRate: 'Hardware',
};
const groupOf = (m: AdvMetric): Group => GROUP_OF[m.id] ?? (m.family === 'Value' ? 'Value' : 'Efficiency');

/** Every advanced metric that applies to his position: percentile bar, + index and rank among qualifiers. */
const DdAdvanced = ({ player, boards }: { player: Player; boards: Map<string, MetricBoard> }) => {
  const metrics = metricsFor(player.position);
  const rows = metrics.map((m) => {
    const board = boards.get(m.id);
    return { m, board, row: board?.rows.find((r) => r.player.name === player.name && r.player.position === player.position) };
  });
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {GROUPS.map(({ key, blurb }) => {
        const items = rows.filter((r) => groupOf(r.m) === key);
        if (!items.length) return null;
        return (
          <div key={key} className="glass-card space-y-2.5 p-3 sm:p-4">
            <h3 className="flex items-baseline justify-between gap-2 font-display text-base font-bold uppercase tracking-wide">
              {key}
              <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">{blurb}</span>
            </h3>
            <ul className="space-y-2" aria-label={`${player.name} ${key.toLowerCase()} percentiles among ${player.position}s`}>
              {items.map(({ m, board, row }) => (
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)_7.5rem]">
                  <MetricLabel metric={m} className="text-xs font-semibold text-secondary-foreground sm:text-sm" />
                  {row && board ? (
                    <>
                      <span className="text-right font-mono text-xs tabular-nums text-chalk sm:order-last">
                        {fmtNum(row.value, m.decimals)}
                        {m.suffix ?? ''}
                        {row.plus != null && <span className="ml-1.5 text-muted-foreground">{fmtPlus(row.plus)}+</span>}
                      </span>
                      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                        <PercentileBar pct={row.pct} label={`${m.label} percentile`} className="h-2 flex-1 overflow-hidden rounded-sm" />
                        <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{ordinal(row.pct)}</span>
                        <span className="w-12 text-right font-mono text-[10px] tabular-nums text-muted-foreground" title={`Rank among ${board.rows.length} qualifiers`}>
                          #{row.rank}/{board.rows.length}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="col-span-1 text-right text-xs text-muted-foreground sm:col-span-2">Below {m.minLabel}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default DdAdvanced;
