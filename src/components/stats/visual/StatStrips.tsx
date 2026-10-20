import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Player, Position } from '@/types/player';
import { evaluateMetric, metricsFor, type AdvContext, type MetricBoard, type MetricRow } from '@/config/advanced';
import { isHallOfFamer } from '@/config/stats';
import TeamLogo from '../../brand/TeamLogo';
import MetricLabel from '../analytics/MetricLabel';
import { VIZ, fmtNum, fmtPlus, ordinal } from '../analytics/viz';
import { keyOf } from '../records';
import { GOLD, niceTicks, swarm, teamMark, useWidth } from './chartKit';
import { ChartTip } from './chartParts';

const R = 5;
const PAD_X = 10;
const LABEL_SPACE = 16;
const AXIS_H = 16;

interface StripDot {
  row: MetricRow;
  cx: number;
  dy: number;
  label: 'above' | 'below' | null;
}

interface Strip {
  board: MetricBoard;
  dots: StripDot[];
  height: number;
  mid: number;
  ticks: number[];
  x: (v: number) => number;
}

const fmtV = (b: MetricBoard, v: number) => `${fmtNum(v, b.metric.decimals)}${b.metric.suffix ?? ''}`;

const buildStrip = (board: MetricBoard, width: number): Strip => {
  const vals = board.rows.map((r) => r.value);
  const { ticks, domain } = niceTicks(Math.min(...vals, board.mean), Math.max(...vals, board.mean), width < 480 ? 4 : 6);
  const x = (v: number) => PAD_X + ((v - domain[0]) / (domain[1] - domain[0] || 1)) * (width - PAD_X * 2);
  const ordered = [...board.rows].sort((a, b) => a.value - b.value);
  const dys = swarm(
    ordered.map((r) => ({ cx: x(r.value) })),
    R,
  );
  // Name the best two and the worst qualifier (rows come best first).
  const best = new Set(board.rows.slice(0, 2).map((r) => keyOf(r.player)));
  // Two leaders close together: the second one's name goes below so they don't overprint.
  const [b1, b2] = board.rows;
  const second = b1 && b2 && Math.abs(x(b1.value) - x(b2.value)) < 80 ? keyOf(b2.player) : null;
  const worst = board.rows.length > 4 ? keyOf(board.rows[board.rows.length - 1].player) : null;
  const span = Math.max(...dys.map(Math.abs), 0);
  const mid = LABEL_SPACE + span + R + 2;
  return {
    board,
    ticks,
    x,
    mid,
    height: mid + span + R + 2 + LABEL_SPACE + AXIS_H,
    dots: ordered.map((r, i) => {
      const k = keyOf(r.player);
      return { row: r, cx: x(r.value), dy: dys[i], label: k === second ? 'below' : best.has(k) ? 'above' : k === worst ? 'below' : null };
    }),
  };
};

const StripDotMark = ({
  d,
  strip,
  onSelect,
  onShow,
}: {
  d: StripDot;
  strip: Strip;
  onSelect: (p: Player) => void;
  onShow: (v: { d: StripDot; strip: Strip } | null) => void;
}) => {
  const p = d.row.player;
  const cy = strip.mid + d.dy;
  const hof = isHallOfFamer(p);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(p);
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${p.name}${p.team ? `, ${p.team}` : ''}: ${fmtV(strip.board, d.row.value)} ${strip.board.metric.short}, rank ${d.row.rank} of ${strip.board.rows.length}${hof ? ', Hall of Famer' : ''}. Open player`}
      className="cursor-pointer outline-none [&:focus-visible>.ring]:stroke-[hsl(43_100%_62%)]"
      onClick={() => onSelect(p)}
      onKeyDown={onKey}
      onMouseEnter={() => onShow({ d, strip })}
      onFocus={() => onShow({ d, strip })}
      onBlur={() => onShow(null)}
    >
      <circle className="ring" cx={d.cx} cy={cy} r={12} fill="transparent" stroke="transparent" strokeWidth={2} />
      <circle cx={d.cx} cy={cy} r={R} fill={teamMark(p.team)} stroke={hof ? GOLD : VIZ.surface} strokeWidth={hof ? 2 : 1.25} />
    </g>
  );
};

const StripSvg = ({ strip, width, onSelect, onShow }: { strip: Strip; width: number; onSelect: (p: Player) => void; onShow: (v: { d: StripDot; strip: Strip } | null) => void }) => {
  const axisY = strip.height - AXIS_H;
  const ax = strip.x(strip.board.mean);
  return (
    <svg width={width} height={strip.height} role="group" aria-label={`${strip.board.metric.label}: ${strip.board.rows.length} qualifiers`} className="block overflow-visible">
      <g aria-hidden="true">
        <line x1={PAD_X} x2={width - PAD_X} y1={axisY} y2={axisY} stroke={VIZ.axis} />
        {strip.ticks.map((t) => (
          <text key={t} x={strip.x(t)} y={axisY + 12} textAnchor="middle" fontSize={10} fill={VIZ.muted}>
            {fmtNum(t, strip.board.metric.decimals > 1 ? 2 : strip.board.metric.decimals)}
          </text>
        ))}
        <line x1={ax} x2={ax} y1={LABEL_SPACE - 4} y2={axisY} stroke={VIZ.muted} strokeDasharray="3 3" />
      </g>
      {strip.dots.map((d) => (
        <StripDotMark key={keyOf(d.row.player)} d={d} strip={strip} onSelect={onSelect} onShow={onShow} />
      ))}
      <g aria-hidden="true" pointerEvents="none">
        {strip.dots
          .filter((d) => d.label)
          .map((d) => {
            const anchor = d.cx > width * 0.75 ? 'end' : d.cx < width * 0.25 ? 'start' : 'middle';
            const y = d.label === 'above' ? strip.mid + d.dy - R - 5 : strip.mid + d.dy + R + 12;
            return (
              <text key={keyOf(d.row.player)} x={d.cx} y={y} textAnchor={anchor} fontSize={10.5} fontWeight={700} fill={d.label === 'above' ? VIZ.ink : VIZ.muted} stroke={VIZ.surface} strokeWidth={3} paintOrder="stroke">
                {d.row.player.name.split(' ').slice(-1)[0]}
              </text>
            );
          })}
      </g>
    </svg>
  );
};

/** One beeswarm strip per rate stat at a position: every qualifier, the dashed line is the average, best two and worst named. */
const StatStrips = ({ players, ctx, position, onSelect }: { players: Player[]; ctx: AdvContext; position: Position; onSelect: (p: Player) => void }) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<{ d: StripDot; strip: Strip } | null>(null);
  const boards = useMemo(
    () =>
      metricsFor(position)
        .filter((m) => !m.styleOnly)
        .map((m) => evaluateMetric(players, m, position, ctx))
        .filter((b) => b.rows.length >= 2),
    [players, ctx, position],
  );
  const strips = useMemo(() => (width > 0 ? boards.map((b) => buildStrip(b, width)) : []), [boards, width]);

  // Tooltip position: offset of each strip inside the list.
  const offsets = strips.reduce<number[]>((acc, s, i) => [...acc, (acc[i - 1] ?? 0) + (i ? strips[i - 1].height + 36 : 0)], []);

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {boards.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No {position} meets a minimum sample yet.</p>}
      <ol className="space-y-3">
        {strips.map((s) => (
          <li key={s.board.metric.id} className="space-y-1">
            <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
              <MetricLabel metric={s.board.metric} className="font-display font-bold uppercase tracking-wide" />
              <span className="font-pixel text-[8px] uppercase text-muted-foreground">
                {s.board.metric.minLabel} · avg {fmtV(s.board, s.board.mean)} · best:{' '}
                <button type="button" onClick={() => onSelect(s.board.rows[0].player)} className="normal-case text-gold hover:underline">
                  {s.board.rows[0].player.name}
                </button>
              </span>
            </p>
            <StripSvg strip={s} width={width} onSelect={onSelect} onShow={setHover} />
          </li>
        ))}
      </ol>
      {hover && (
        <ChartTip x={hover.d.cx} y={offsets[strips.indexOf(hover.strip)] + 24 + hover.strip.mid + hover.d.dy} width={width}>
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            {hover.d.row.player.team && <TeamLogo team={hover.d.row.player.team} size={16} decorative />}
            {hover.d.row.player.name}
          </p>
          <p className="mt-0.5 font-mono tabular-nums text-secondary-foreground">
            {fmtV(hover.strip.board, hover.d.row.value)} {hover.strip.board.metric.short}
            {hover.d.row.plus != null ? ` · ${fmtPlus(hover.d.row.plus)}+` : ''} · {ordinal(hover.d.row.pct)} pct
          </p>
          <p className="mt-0.5 text-muted-foreground">Rank {hover.d.row.rank} of {hover.strip.board.rows.length} · click to open</p>
        </ChartTip>
      )}
    </div>
  );
};

export default StatStrips;

/** Table fallback for the strips: every qualifier per stat, best first. */
export const StatStripsTable = ({ players, ctx, position, onSelect }: { players: Player[]; ctx: AdvContext; position: Position; onSelect: (p: Player) => void }) => {
  const boards = useMemo(
    () =>
      metricsFor(position)
        .filter((m) => !m.styleOnly)
        .map((m) => evaluateMetric(players, m, position, ctx))
        .filter((b) => b.rows.length >= 2),
    [players, ctx, position],
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {boards.map((b) => (
        <table key={b.metric.id} className="w-full text-sm">
          <caption className="pb-1 text-left font-display text-sm font-bold uppercase">
            {b.metric.label} <span className="font-sans text-xs font-normal normal-case text-muted-foreground">({b.metric.minLabel}, avg {fmtV(b, b.mean)})</span>
          </caption>
          <tbody>
            {b.rows.map((r) => (
              <tr key={keyOf(r.player)} className="border-t border-line/40">
                <td className="w-6 py-0.5 font-pixel text-[9px] text-muted-foreground">{r.rank}</td>
                <td className="py-0.5">
                  <button type="button" onClick={() => onSelect(r.player)} className="font-semibold hover:text-gold">
                    {r.player.name}
                  </button>
                </td>
                <td className="py-0.5 text-right font-mono text-xs tabular-nums">{fmtV(b, r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
};
