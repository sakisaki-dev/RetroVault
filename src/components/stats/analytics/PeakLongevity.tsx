import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { Player, Position } from '@/types/player';
import { POSITIONS, quantile } from '@/config/advanced';
import { cn } from '@/lib/utils';
import ChartFrame from './ChartFrame';
import Chips from './Chips';
import { UNITS, VIZ, fmtNum, unitOf, usePrefersReducedMotion } from './viz';
import { keyOf } from '../records';

interface Pt {
  x: number;
  y: number;
  player: Player;
  label: boolean;
  /** Label sits left of the dot (right half of the plot) so it never runs off the edge. */
  flip: boolean;
}

type Highlight = 'ALL' | Position;

const PointShape = ({
  cx,
  cy,
  payload,
  fill,
  dim,
  onSelect,
}: {
  cx?: number;
  cy?: number;
  payload?: Pt;
  fill: string;
  dim: boolean;
  onSelect: (p: Player) => void;
}) => {
  if (cx == null || cy == null || !payload) return null;
  const anchorEnd = payload.flip;
  return (
    <g style={{ cursor: 'pointer' }} opacity={dim ? 0.18 : 1} onClick={() => onSelect(payload.player)}>
      {/* Hit target larger than the mark */}
      <circle cx={cx} cy={cy} r={11} fill="transparent" />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke={VIZ.surface} strokeWidth={2} />
      {payload.label && !dim && (
        <text
          x={anchorEnd ? cx - 9 : cx + 9}
          y={cy + 4}
          textAnchor={anchorEnd ? 'end' : 'start'}
          fontSize={11}
          fontWeight={600}
          fill={VIZ.ink}
          stroke={VIZ.surface}
          strokeWidth={3}
          paintOrder="stroke"
        >
          {payload.player.name}
        </text>
      )}
    </g>
  );
};

const TipContent = ({ active, payload }: TooltipProps<number, string>) => {
  const pt = active ? (payload?.[0]?.payload as Pt | undefined) : undefined;
  if (!pt) return null;
  return (
    <div className="rounded-md border border-line bg-popover px-3 py-2 text-xs shadow-elevated">
      <p className="font-semibold text-foreground">
        {pt.player.name} <span className="text-muted-foreground">· {pt.player.position}</span>
      </p>
      <p className="mt-0.5 font-mono tabular-nums text-secondary-foreground">
        TPG {fmtNum(pt.y, 2)} · {pt.x} games
      </p>
      <p className="mt-0.5 text-muted-foreground">Click to open the player</p>
    </div>
  );
};

/** TPG (peak rate) against games (longevity). One dot per player, colored by unit. */
const PeakLongevity = ({ players, onSelect }: { players: Player[]; onSelect: (p: Player) => void }) => {
  const reduced = usePrefersReducedMotion();
  const [highlight, setHighlight] = useState<Highlight>('ALL');

  const { byUnit, medX, medY, all, xTicks } = useMemo(() => {
    const pool = players.filter((p) => p.games > 0 && p.tpg > 0);
    const topTpg = new Set([...pool].sort((a, b) => b.tpg - a.tpg).slice(0, 3).map(keyOf));
    const topGames = new Set([...pool].sort((a, b) => b.games - a.games).slice(0, 1).map(keyOf));
    const maxX = Math.max(...pool.map((p) => p.games), 1);
    const pts: Pt[] = pool.map((p) => ({
      x: p.games,
      y: p.tpg,
      player: p,
      label: topTpg.has(keyOf(p)) || topGames.has(keyOf(p)),
      flip: p.games > maxX * 0.55,
    }));
    return {
      all: pts,
      byUnit: UNITS.map((u) => ({ unit: u, pts: pts.filter((pt) => unitOf(pt.player.position).key === u.key) })),
      xTicks: Array.from({ length: Math.ceil(maxX / 100) + 1 }, (_, i) => i * 100),
      medX: quantile(pool.map((p) => p.games), 50),
      medY: quantile(pool.map((p) => p.tpg), 50),
    };
  }, [players]);

  // When a position is highlighted, label its top three by TPG instead of the league outliers.
  const highlightLabels = useMemo(() => {
    if (highlight === 'ALL') return null;
    return new Set(
      all
        .filter((pt) => pt.player.position === highlight)
        .sort((a, b) => b.y - a.y)
        .slice(0, 3)
        .map((pt) => keyOf(pt.player)),
    );
  }, [all, highlight]);

  const isDim = (pt: Pt) => highlight !== 'ALL' && pt.player.position !== highlight;
  const withLabels = (pts: Pt[]) => (highlightLabels ? pts.map((pt) => ({ ...pt, label: highlightLabels.has(keyOf(pt.player)) })) : pts);

  const sorted = [...all].sort((a, b) => b.y - a.y);

  return (
    <ChartFrame
      title="Peak vs longevity"
      icon={<Activity className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`Talent per game (TPG, peak rate) against games played (longevity) for ${all.length} players. Lines mark the league medians (${fmtNum(medX, 0)} games, ${fmtNum(medY, 2)} TPG): top right is great for a long time.`}
      controls={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chips
            label="Highlight position"
            value={highlight}
            onChange={setHighlight}
            options={[{ value: 'ALL' as Highlight, label: 'All' }, ...POSITIONS.map((p) => ({ value: p as Highlight, label: p }))]}
          />
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary-foreground" aria-label="Legend">
            {UNITS.map((u) => (
              <li key={u.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: u.color }} />
                {u.short}
              </li>
            ))}
          </ul>
        </div>
      }
      chart={
        <div role="img" aria-label="Scatter plot of TPG against games played. Use the table view for every value." className="h-[300px] w-full sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 22, left: 0 }}>
              <CartesianGrid stroke={VIZ.grid} strokeDasharray="0" />
              <XAxis
                type="number"
                dataKey="x"
                name="Games"
                tick={{ fill: VIZ.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: VIZ.axis }}
                domain={[0, xTicks[xTicks.length - 1]]}
                ticks={xTicks}
                label={{ value: 'Games played', position: 'insideBottom', offset: -12, fill: VIZ.muted, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="TPG"
                width={40}
                tick={{ fill: VIZ.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: VIZ.axis }}
                domain={[0, 'auto']}
                label={{ value: 'TPG', angle: -90, position: 'insideLeft', offset: 14, fill: VIZ.muted, fontSize: 11 }}
              />
              <ReferenceLine x={medX} stroke={VIZ.muted} strokeOpacity={0.55} label={{ value: 'median G', position: 'insideTopRight', fill: VIZ.muted, fontSize: 10 }} />
              <ReferenceLine y={medY} stroke={VIZ.muted} strokeOpacity={0.55} label={{ value: 'median TPG', position: 'insideBottomLeft', fill: VIZ.muted, fontSize: 10 }} />
              <Tooltip content={<TipContent />} cursor={false} isAnimationActive={!reduced} />
              {byUnit.map(({ unit, pts }) => (
                <Scatter
                  key={unit.key}
                  name={unit.label}
                  data={withLabels(pts)}
                  fill={unit.color}
                  isAnimationActive={!reduced}
                  shape={(props: { cx?: number; cy?: number; payload?: Pt }) => (
                    <PointShape {...props} fill={unit.color} dim={!!props.payload && isDim(props.payload)} onSelect={onSelect} />
                  )}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <div className="relative max-h-[360px] overflow-auto rounded-md border border-line/60">
          <table className="w-full text-sm">
            <caption className="sr-only">TPG and games played per player</caption>
            <thead className="sticky top-0 bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-normal">Player</th>
                <th scope="col" className="px-2 py-1.5 font-normal">Pos</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">TPG</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Games</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((pt) => (
                <tr key={keyOf(pt.player)} className={cn('border-t border-line/40', isDim(pt) && 'opacity-50')}>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => onSelect(pt.player)} className="font-semibold hover:text-gold">
                      {pt.player.name}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{pt.player.position}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{fmtNum(pt.y, 2)}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{pt.x}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
};

export default PeakLongevity;
