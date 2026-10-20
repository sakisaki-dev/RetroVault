import { useMemo, useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { HEADLINE_METRIC, evaluatePosition, metricsFor, placeOnBoard, type AdvContext, type MetricRow, type PlacedRow } from '@/config/advanced';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { cn } from '@/lib/utils';
import MetricLabel from './MetricLabel';
import { VIZ, fmtNum, fmtPlus, plusFill } from './viz';
import { keyOf } from '../records';

interface Props {
  players: Player[];
  ctx: AdvContext;
  position: Position;
  /** Real NFL legends, scored against the league boards (never part of the averages). */
  extras?: Player[];
  onSelect: (p: Player) => void;
}

const LEGEND_STEPS = [50, 75, 100, 125, 150];

/**
 * Players × rate stats for one position, each cell a + index (100 = position average).
 * The number is always printed; the diverging fill (blue above, red below, neutral at 100) only reinforces it.
 */
const PlusHeatTable = ({ players, ctx, position, extras = [], onSelect }: Props) => {
  const [showRaw, setShowRaw] = useState(false);
  const metrics = useMemo(() => metricsFor(position).filter((m) => m.plus && !m.styleOnly), [position]);
  const boards = useMemo(() => evaluatePosition(players, position, ctx), [players, position, ctx]);

  const { rows, lookup } = useMemo(() => {
    const lookup = new Map<string, Map<string, MetricRow>>();
    metrics.forEach((m) => {
      boards.get(m.id)?.rows.forEach((r) => {
        const k = keyOf(r.player);
        if (!lookup.has(k)) lookup.set(k, new Map());
        lookup.get(k)!.set(m.id, r);
      });
    });
    const head = HEADLINE_METRIC[position];
    const scoreOf = (p: Player) => lookup.get(keyOf(p))?.get(head)?.plus ?? -1;
    const rows = players
      .filter((p) => p.position === position && lookup.has(keyOf(p)))
      .sort((a, b) => scoreOf(b) - scoreOf(a) || a.name.localeCompare(b.name));
    return { rows, lookup };
  }, [boards, metrics, players, position]);

  const headline = metrics.find((m) => m.id === HEADLINE_METRIC[position]);

  const nflRows = useMemo(
    () =>
      extras
        .filter((p) => p.position === position)
        .map((p) => ({
          player: p,
          cells: new Map(
            metrics.flatMap((m) => {
              const b = boards.get(m.id);
              const r = b ? placeOnBoard(b, p, ctx) : null;
              return r ? [[m.id, r] as [string, PlacedRow]] : [];
            }),
          ),
        }))
        .filter((r) => r.cells.size > 0)
        .sort((a, b) => (b.cells.get(HEADLINE_METRIC[position])?.plus ?? -1) - (a.cells.get(HEADLINE_METRIC[position])?.plus ?? -1)),
    [extras, position, metrics, boards, ctx],
  );

  return (
    <section aria-labelledby="lab-heat-title" className="glass-card flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 id="lab-heat-title" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
            <Grid3x3 className="h-4 w-4 text-gold" aria-hidden="true" />
            {position} + index grid
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Every {POSITION_NAMES[position].toLowerCase()} rate stat as a + index: 100 is the position average, blue is better, red is worse.
            Sorted by {headline?.short ?? 'headline stat'}. A dash means below that stat's minimum sample.
          </p>
        </div>
        <button
          type="button"
          aria-pressed={showRaw}
          onClick={() => setShowRaw((v) => !v)}
          className="shrink-0 rounded-md border border-line bg-night/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {showRaw ? 'Show + index' : 'Show raw values'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground" aria-hidden="true">
        <span>Worse</span>
        <span className="flex overflow-hidden rounded-sm">
          {LEGEND_STEPS.map((s) => (
            <span key={s} className="flex h-5 w-9 items-center justify-center font-mono text-[10px] text-chalk" style={{ background: s === 100 ? 'hsl(var(--panel-2))' : plusFill(s) }}>
              {s}
            </span>
          ))}
        </span>
        <span>Better</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No {position} meets any minimum sample yet.</p>
      ) : (
        <div className="relative max-h-[480px] overflow-auto rounded-md border border-line/60">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              {POSITION_NAMES[position]} {showRaw ? 'raw values' : '+ index (100 = position average)'} by stat
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-20 bg-panel-2 px-2 py-1.5 text-left font-pixel text-[9px] font-normal uppercase text-muted-foreground">
                  Player
                </th>
                {metrics.map((m) => (
                  <th key={m.id} scope="col" className="sticky top-0 z-10 whitespace-nowrap bg-panel-2 px-2 py-1.5 text-center text-xs font-bold text-secondary-foreground">
                    <MetricLabel metric={m} short side="bottom" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const cells = lookup.get(keyOf(p))!;
                return (
                  <tr key={keyOf(p)}>
                    <th scope="row" className="sticky left-0 z-10 max-w-[9rem] border-t border-line/40 bg-panel px-2 py-1 text-left">
                      <button
                        type="button"
                        onClick={() => onSelect(p)}
                        className="block w-full truncate text-left text-xs font-semibold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
                      >
                        {p.name}
                      </button>
                    </th>
                    {metrics.map((m) => {
                      const c = cells.get(m.id);
                      const label = c
                        ? `${m.label}: ${fmtNum(c.value, m.decimals)}${m.suffix ?? ''}, + index ${fmtPlus(c.plus)}`
                        : `${m.label}: below ${m.minLabel}`;
                      return (
                        <td
                          key={m.id}
                          title={label}
                          className={cn('border-l-2 border-t-2 px-2 py-1 text-center font-mono text-xs tabular-nums', c ? 'text-chalk' : 'text-muted-foreground')}
                          style={{ background: c ? plusFill(c.plus) : undefined, borderColor: VIZ.surface }}
                        >
                          <span className="sr-only">{label}</span>
                          <span aria-hidden="true">{c ? (showRaw ? `${fmtNum(c.value, m.decimals)}${m.suffix ?? ''}` : fmtPlus(c.plus)) : '—'}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {nflRows.length > 0 && (
                <tr>
                  <th scope="rowgroup" colSpan={metrics.length + 1} className="sticky left-0 border-t-2 border-flag/50 bg-panel-2 px-2 py-1 text-left font-pixel text-[8px] font-normal uppercase text-muted-foreground">
                    Real NFL players · placed on the league scale, not in the averages
                  </th>
                </tr>
              )}
              {nflRows.map(({ player: p, cells }) => (
                <tr key={`nfl:${keyOf(p)}`}>
                  <th scope="row" className="sticky left-0 z-10 max-w-[9rem] border-t border-line/40 bg-panel px-2 py-1 text-left">
                    <button
                      type="button"
                      onClick={() => onSelect(p)}
                      className="flex w-full items-center gap-1 truncate text-left text-xs font-semibold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
                    >
                      <span className="shrink-0 rounded-sm bg-flag/80 px-0.5 font-pixel text-[6px] text-night">NFL</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  </th>
                  {metrics.map((m) => {
                    const c = cells.get(m.id);
                    const label = c ? `${m.label}: ${fmtNum(c.value, m.decimals)}${m.suffix ?? ''}, + index ${fmtPlus(c.plus)} (real NFL, unranked)` : `${m.label}: below ${m.minLabel}`;
                    return (
                      <td
                        key={m.id}
                        title={label}
                        className={cn('border-l-2 border-t-2 px-2 py-1 text-center font-mono text-xs italic tabular-nums', c ? 'text-chalk' : 'text-muted-foreground')}
                        style={{ background: c ? plusFill(c.plus) : undefined, borderColor: VIZ.surface }}
                      >
                        <span className="sr-only">{label}</span>
                        <span aria-hidden="true">{c ? (showRaw ? `${fmtNum(c.value, m.decimals)}${m.suffix ?? ''}` : fmtPlus(c.plus)) : '—'}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default PlusHeatTable;
