import { useMemo, useState, type KeyboardEvent } from 'react';
import { ScatterChart as SwarmIcon } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { POSITIONS, quantile } from '@/config/advanced';
import { playerKey } from '@/config/ovr';
import { HOF_THRESHOLD, LEGACY_TIERS, isHallOfFamer } from '@/config/stats';
import { POSITION_NAMES } from '@/utils/playerMeta';
import TeamLogo from '../../brand/TeamLogo';
import ChartFrame from '../analytics/ChartFrame';
import Chips from '../analytics/Chips';
import { VIZ, fmtNum } from '../analytics/viz';
import { keyOf } from '../records';
import { GOLD, fmtShort, niceTicks, swarm, useRoving, useWidth } from './chartKit';
import { ChartTip, Legend } from './chartParts';

type MetricId = 'legacy' | 'ovr' | 'tpg';

const METRICS: { id: MetricId; label: string; short: string; decimals: number }[] = [
  { id: 'legacy', label: 'Career Legacy', short: 'Legacy', decimals: 0 },
  { id: 'ovr', label: 'Official OVR', short: 'OVR', decimals: 0 },
  { id: 'tpg', label: 'Talent per game', short: 'TPG', decimals: 2 },
];

const R = 4.5;
const LABEL_W = 34;
const PAD_R = 14;
const AXIS_H = 26;
const TOP_H = 18;
const ROW_PAD = 8;

interface Dot {
  key: string;
  player: Player;
  value: number;
  hof: boolean;
  cx: number;
  /** Offset from the row's centre line. */
  dy: number;
}

interface Row {
  pos: Position;
  dots: Dot[];
  top: number;
  height: number;
  median: number;
}

const DotMark = ({
  dot,
  cy,
  decimals,
  tabIndex,
  onSelect,
  onKey,
  onShow,
}: {
  dot: Dot;
  cy: number;
  decimals: number;
  tabIndex: number;
  onSelect: (p: Player) => void;
  onKey: (e: KeyboardEvent) => void;
  onShow: (d: Dot | null) => void;
}) => (
  <g
    role="button"
    tabIndex={tabIndex}
    data-rk={dot.key}
    aria-label={`${dot.player.name}, ${dot.player.position}${dot.player.team ? `, ${dot.player.team}` : ''}: ${fmtNum(dot.value, decimals)}${dot.hof ? ', Hall of Famer' : ''}. Open player`}
    className="cursor-pointer outline-none [&:focus-visible>.ring]:stroke-[hsl(43_100%_62%)]"
    onClick={() => onSelect(dot.player)}
    onKeyDown={onKey}
    onMouseEnter={() => onShow(dot)}
    onFocus={() => onShow(dot)}
    onBlur={() => onShow(null)}
  >
    <circle className="ring" cx={dot.cx} cy={cy} r={12} fill="transparent" stroke="transparent" strokeWidth={2} />
    {dot.hof ? (
      <rect x={dot.cx - R} y={cy - R} width={R * 2} height={R * 2} rx={1.5} transform={`rotate(45 ${dot.cx} ${cy})`} fill={GOLD} stroke={VIZ.surface} strokeWidth={1.5} />
    ) : (
      <circle cx={dot.cx} cy={cy} r={R} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={1.5} />
    )}
  </g>
);

/**
 * Distribution of a career metric at every position, one beeswarm row each (shared axis). Hall of Famers are gold
 * diamonds; Career Legacy shows the Hall of Fame line and tier lines.
 */
const DistributionSwarm = ({ players, ovrMap, onSelect }: { players: Player[]; ovrMap: Map<string, number>; onSelect: (p: Player) => void }) => {
  const [metric, setMetric] = useState<MetricId>('legacy');
  const [hover, setHover] = useState<Dot | null>(null);
  const [boxRef, width] = useWidth();
  const m = METRICS.find((x) => x.id === metric) ?? METRICS[0];

  const valueOf = useMemo(
    () =>
      (p: Player): number | null => {
        if (metric === 'legacy') return p.careerLegacy > 0 ? p.careerLegacy : null;
        if (metric === 'tpg') return p.tpg > 0 ? p.tpg : null;
        return ovrMap.get(playerKey(p)) ?? null;
      },
    [metric, ovrMap],
  );

  const base = useMemo(() => {
    const vals = players.map((p) => ({ p, v: valueOf(p) })).filter((x): x is { p: Player; v: number } => x.v != null);
    const all = vals.map((x) => x.v);
    const hi = metric === 'legacy' ? Math.max(...all, HOF_THRESHOLD) : Math.max(...all, 1);
    const { ticks, domain } = niceTicks(metric === 'ovr' ? Math.min(...all) : 0, hi, 5);
    return { vals, ticks, domain };
  }, [players, valueOf, metric]);

  const plotW = Math.max(width - LABEL_W - PAD_R, 60);
  const x = (v: number) => LABEL_W + ((v - base.domain[0]) / (base.domain[1] - base.domain[0] || 1)) * plotW;

  const { rows, height, order } = useMemo(() => {
    let top = TOP_H;
    const rows: Row[] = [];
    POSITIONS.forEach((pos) => {
      const list = base.vals.filter((x0) => x0.p.position === pos).sort((a, b) => a.v - b.v || a.p.name.localeCompare(b.p.name));
      if (!list.length) return;
      const cxs = list.map((it) => ({ cx: x(it.v) }));
      const dys = swarm(cxs, R);
      const span = Math.max(...dys.map(Math.abs), 0);
      const h = span * 2 + R * 2 + ROW_PAD * 2;
      rows.push({
        pos,
        top,
        height: h,
        median: quantile(
          list.map((it) => it.v),
          50,
        ),
        dots: list.map((it, i) => ({ key: keyOf(it.p), player: it.p, value: it.v, hof: isHallOfFamer(it.p), cx: cxs[i].cx, dy: dys[i] })),
      });
      top += h;
    });
    return { rows, height: top + AXIS_H, order: rows.flatMap((r) => r.dots.map((d) => d.key)) };
    // x depends on plotW and the domain
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, plotW]);

  const roving = useRoving(order);
  const plotBottom = height - AXIS_H;
  const hofCount = base.vals.filter((v) => isHallOfFamer(v.p)).length;
  const lines =
    metric === 'legacy'
      ? [
          { v: HOF_THRESHOLD, label: `HOF ${fmtShort(HOF_THRESHOLD)}`, strong: true },
          ...LEGACY_TIERS.filter((t) => t.min > HOF_THRESHOLD && t.min <= base.domain[1]).map((t) => ({ v: t.min, label: '', strong: false })),
        ]
      : [];
  const hoverRow = hover ? rows.find((r) => r.pos === hover.player.position) : null;

  const summary = rows
    .map((r) => `${r.pos}: median ${fmtNum(r.median, m.decimals)}, ${r.dots.filter((d) => d.hof).length} of ${r.dots.length} in the Hall`)
    .join('; ');

  return (
    <ChartFrame
      title="How the league is spread"
      icon={<SwarmIcon className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`Every league player as a dot, one row per position, by ${m.label}. Gold diamonds are the ${hofCount} Hall of Famers (Career Legacy ${fmtShort(HOF_THRESHOLD)}+)${metric === 'legacy' ? '; the gold line is the Hall of Fame bar and the faint lines the Great, Elite and Legendary tiers' : '; the tick in each row is the position median'}.`}
      controls={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chips label="Distribution metric" value={metric} onChange={setMetric} options={METRICS.map((x0) => ({ value: x0.id, label: x0.short, title: x0.label }))} />
          <Legend
            items={[
              {
                key: 'hof',
                label: 'Hall of Famer',
                swatch: (
                  <svg width="12" height="12" aria-hidden="true">
                    <rect x="2.5" y="2.5" width="7" height="7" transform="rotate(45 6 6)" fill={GOLD} />
                  </svg>
                ),
              },
              {
                key: 'rest',
                label: 'Everyone else',
                swatch: <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: VIZ.series[0] }} />,
              },
            ]}
          />
        </div>
      }
      chart={
        <div ref={boxRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
          <p className="sr-only">{summary}.</p>
          {width > 0 && (
            <div ref={roving.container}>
              <svg width={width} height={height} role="group" aria-label={`Beeswarm of ${m.label} by position. Arrow keys move between players, Enter opens one.`} className="block">
                {/* Grid + axis */}
                {base.ticks.map((t) => (
                  <g key={t} aria-hidden="true">
                    <line x1={x(t)} x2={x(t)} y1={TOP_H} y2={plotBottom} stroke={VIZ.grid} />
                    <text x={x(t)} y={plotBottom + 16} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
                      {metric === 'tpg' ? t.toFixed(1) : fmtShort(t)}
                    </text>
                  </g>
                ))}
                {lines.map((l) => (
                  <g key={l.v} aria-hidden="true">
                    <line x1={x(l.v)} x2={x(l.v)} y1={TOP_H - 4} y2={plotBottom} stroke={GOLD} strokeOpacity={l.strong ? 0.9 : 0.35} strokeWidth={l.strong ? 2 : 1} strokeDasharray={l.strong ? undefined : '3 3'} />
                    {l.label && (
                      <text x={x(l.v)} y={TOP_H - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill={GOLD}>
                        {l.label}
                      </text>
                    )}
                  </g>
                ))}
                {rows.map((r, i) => {
                  const cy = r.top + r.height / 2;
                  return (
                    <g key={r.pos}>
                      {i > 0 && <line x1={0} x2={width} y1={r.top} y2={r.top} stroke={VIZ.grid} strokeDasharray="2 4" aria-hidden="true" />}
                      <text x={0} y={cy + 4} fontSize={11} fontWeight={700} fill={VIZ.ink} className="font-display" aria-hidden="true">
                        {r.pos}
                      </text>
                      {metric !== 'legacy' && <line x1={x(r.median)} x2={x(r.median)} y1={r.top + 3} y2={r.top + r.height - 3} stroke={VIZ.muted} strokeWidth={2} aria-hidden="true" />}
                      {r.dots.map((d) => (
                        <DotMark
                          key={d.key}
                          dot={d}
                          cy={cy + d.dy}
                          decimals={m.decimals}
                          tabIndex={roving.tabIndex(d.key)}
                          onSelect={onSelect}
                          onShow={(dd) => {
                            setHover(dd);
                            if (dd) roving.setActive(dd.key);
                          }}
                          onKey={(e) => roving.onKeyDown(d.key, e, () => onSelect(d.player))}
                        />
                      ))}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
          {hover && hoverRow && (
            <ChartTip x={hover.cx} y={hoverRow.top + hoverRow.height / 2 + hover.dy} width={width}>
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                {hover.player.team && <TeamLogo team={hover.player.team} size={16} decorative />}
                {hover.player.name} <span className="text-muted-foreground">· {hover.player.position}</span>
              </p>
              <p className="mt-0.5 font-mono tabular-nums text-secondary-foreground">
                {m.short} {fmtNum(hover.value, m.decimals)}
                {hover.hof ? ' · Hall of Famer' : ''}
              </p>
              <p className="mt-0.5 text-muted-foreground">Click to open the player</p>
            </ChartTip>
          )}
        </div>
      }
      table={
        <div className="relative max-h-[420px] overflow-auto rounded-md border border-line/60">
          <table className="w-full text-sm">
            <caption className="sr-only">{m.label} of every league player, by position</caption>
            <thead className="sticky top-0 bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-normal">Pos</th>
                <th scope="col" className="px-2 py-1.5 font-normal">Player</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">{m.short}</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">HOF</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((r) =>
                [...r.dots].reverse().map((d) => (
                  <tr key={d.key} className="border-t border-line/40">
                    <td className="px-2 py-1 text-muted-foreground" title={POSITION_NAMES[r.pos]}>{r.pos}</td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => onSelect(d.player)} className="font-semibold hover:text-gold">
                        {d.player.name}
                      </button>
                    </td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{fmtNum(d.value, m.decimals)}</td>
                    <td className="px-2 py-1 text-right text-xs">{d.hof ? 'Yes' : ''}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      }
    />
  );
};

export default DistributionSwarm;
