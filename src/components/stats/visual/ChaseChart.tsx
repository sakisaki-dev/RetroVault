import { useMemo } from 'react';
import { Timer } from 'lucide-react';
import type { Player } from '@/types/player';
import PositionBadge from '../../PositionBadge';
import TeamLogo from '../../brand/TeamLogo';
import ChartFrame from '../analytics/ChartFrame';
import { VIZ, fmtNum } from '../analytics/viz';
import { MIN, PACE_MAX_SEASONS, keyOf, type PaceEntry } from '../records';
import { GOLD, teamMark } from './chartKit';

type Select = (p: Player) => void;

interface Row {
  pace: PaceEntry;
  /** Percent of the record now, per season of pace, and at the ETA season. */
  cur: number;
  step: number;
  atEta: number;
}

const seasons = (n: number) => `${n} ${n === 1 ? 'season' : 'seasons'}`;

const ChaseRow = ({ row, max, onSelect }: { row: Row; max: number; onSelect: Select }) => {
  const { pace, cur, step } = row;
  const pos = (pct: number) => `${(Math.min(pct, max) / max) * 100}%`;
  const ticks = Array.from({ length: pace.seasonsToBreak }, (_, i) => cur + (i + 1) * step);
  const p = pace.player;
  return (
    <li className="space-y-1.5 border-t border-line/40 pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {p.team && <TeamLogo team={p.team} size={20} decorative />}
          <button type="button" onClick={() => onSelect(p)} className="truncate rounded font-display text-base font-bold uppercase hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            {p.name}
          </button>
          <PositionBadge position={p.position} className="min-w-[2rem] px-1.5 py-0.5 text-[10px]" />
          <span className="text-xs text-muted-foreground">
            chasing <span className="font-semibold text-gold">{pace.recordName}</span> ·{' '}
            <button type="button" onClick={() => onSelect(pace.recordHolder)} className="rounded font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {pace.recordHolder.name}
            </button>
          </span>
        </div>
        <span className="lamp shrink-0">
          ETA <b>{pace.seasonsToBreak}</b> {pace.seasonsToBreak === 1 ? 'season' : 'seasons'}
        </span>
      </div>

      {/* Track: solid = done so far, dotted ticks = each projected 16-game season, gold diamond = the season he passes it */}
      <div
        role="img"
        aria-label={`${p.name}: ${fmtNum(cur, 0)}% of the record now, projected to pass it in ${seasons(pace.seasonsToBreak)}`}
        className="relative h-5"
      >
        <span className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-sm bg-night/80" />
        <span
          className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-r-[4px] motion-safe:transition-[width] motion-safe:duration-700"
          style={{ width: pos(cur), background: teamMark(p.team) }}
        />
        <span className="absolute top-1/2 h-0 -translate-y-1/2 border-t-2 border-dotted" style={{ left: pos(cur), width: `calc(${pos(row.atEta)} - ${pos(cur)})`, borderColor: VIZ.muted }} />
        {ticks.map((t, i) => {
          const eta = i === ticks.length - 1;
          return (
            <span
              key={i}
              className={eta ? 'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]' : 'absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2'}
              style={eta ? { left: pos(t), background: GOLD, boxShadow: `0 0 0 2px ${VIZ.surface}` } : { left: pos(t), borderColor: VIZ.muted, background: VIZ.surface }}
            />
          );
        })}
        <span className="absolute -bottom-0.5 -top-0.5 w-0.5 -translate-x-1/2 rounded-full" style={{ left: pos(100), background: GOLD }} />
      </div>

      <p className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">
          <b className="text-chalk">{fmtNum(pace.currentValue, 0)}</b> of <b className="text-gold">{fmtNum(pace.recordValue, 0)}</b> ({fmtNum(cur, 0)}%)
        </span>
        <span>~{fmtNum(Math.round(pace.pacePerSeason), 0)} per 16 G</span>
      </p>
    </li>
  );
};

/** Players on pace to pass a career record: progress toward the mark plus a season-by-season projection to the ETA. */
const ChaseChart = ({ pace, onSelect, title = 'Chasing history', intro }: { pace: PaceEntry[]; onSelect: Select; title?: string; intro?: string }) => {
  const rows: Row[] = useMemo(
    () =>
      pace.map((p) => {
        const step = (p.pacePerSeason / p.recordValue) * 100;
        return { pace: p, cur: p.percentToRecord, step, atEta: p.percentToRecord + p.seasonsToBreak * step };
      }),
    [pace],
  );
  if (rows.length === 0) return null;
  const max = Math.min(Math.ceil(Math.max(100, ...rows.map((r) => r.atEta)) / 10) * 10, 200);

  return (
    <ChartFrame
      title={title}
      icon={<Timer className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`${intro ?? `Players (min ${MIN.games} games)`} on pace to pass a career record within ${PACE_MAX_SEASONS} seasons at their per-16-game rate. The bar is how much of the record they have; dotted ticks project each future season; the gold diamond is the season they pass the gold record line.`}
      chart={
        <div className="space-y-2">
          <div className="relative h-4 text-[10px] text-muted-foreground" aria-hidden="true">
            <span className="absolute left-0">0%</span>
            <span className="absolute -translate-x-1/2 font-pixel uppercase text-gold" style={{ left: `${(100 / max) * 100}%` }}>
              Record
            </span>
            {max > 115 && <span className="absolute right-0">{max}%</span>}
          </div>
          <ol className="space-y-3" aria-label="Record chases">
            {rows.map((r) => (
              <ChaseRow key={`${keyOf(r.pace.player)}:${r.pace.recordName}`} row={r} max={max} onSelect={onSelect} />
            ))}
          </ol>
        </div>
      }
      table={
        <div className="overflow-x-auto rounded-md border border-line/60">
          <table className="w-full text-sm">
            <caption className="sr-only">Players on pace to pass a career record</caption>
            <thead className="bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-normal">Player</th>
                <th scope="col" className="px-2 py-1.5 font-normal">Record (holder)</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Now</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Record</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Per 16 G</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">ETA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ pace: p, cur }) => (
                <tr key={`${keyOf(p.player)}:${p.recordName}`} className="border-t border-line/40">
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => onSelect(p.player)} className="font-semibold hover:text-gold">
                      {p.player.name}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-xs">
                    {p.recordName} ({p.recordHolder.name})
                  </td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">
                    {fmtNum(p.currentValue, 0)} <span className="text-muted-foreground">({fmtNum(cur, 0)}%)</span>
                  </td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{fmtNum(p.recordValue, 0)}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{fmtNum(Math.round(p.pacePerSeason), 0)}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{seasons(p.seasonsToBreak)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
};

export default ChaseChart;
