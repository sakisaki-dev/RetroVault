import { useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { fmtFixed } from '@/utils/numberFormat';
import { VIZ } from '../../analytics/viz';
import { ChartTip } from '../../visual/chartParts';
import { GOLD, niceTicks, useWidth } from '../../visual/chartKit';
import type { Career } from './careerStory';
import { seasonScore, type SeasonPoint } from './careerModel';
import { groupOf, type Group } from './statDefs';
import { clubInk, linear, shortNum, yLabel } from './graphKit';

const M = { l: 36, r: 40, t: 14, b: 22 };

/** Bars (one per season, club-coloured) against a line on a second axis, with an optional shaded window. */
const BarLine = ({
  career,
  bars,
  line,
  barLabel,
  lineLabel,
  barFmt,
  lineFmt,
  shade,
  peak,
  idx,
  onIdx,
  ariaLabel,
  barDomain,
}: {
  career: Career;
  bars: (number | null)[];
  line: (number | null)[];
  barLabel: string;
  lineLabel: string;
  barFmt: (v: number) => string;
  lineFmt: (v: number) => string;
  shade?: { from: number; to: number; label: string } | null;
  peak?: number | null;
  idx: number;
  onIdx: (i: number) => void;
  ariaLabel: string;
  barDomain?: [number, number];
}) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const height = 210;
  const pts = career.points;
  const n = pts.length;
  const geo = useMemo(() => {
    if (!width) return null;
    const colW = (width - M.l - M.r) / n;
    const bv = bars.filter((v): v is number => v != null && Number.isFinite(v));
    const lv = line.filter((v): v is number => v != null && Number.isFinite(v));
    const bt = barDomain ? { ticks: [0, 25, 50, 75, 100].filter((t) => t <= barDomain[1]), domain: barDomain } : niceTicks(0, Math.max(1, ...bv), 4);
    const lt = niceTicks(Math.min(0, ...lv), Math.max(1, ...lv), 4);
    return {
      colW,
      x: (i: number) => M.l + (i + 0.5) * colW,
      by: linear(bt.domain[0], bt.domain[1], height - M.b, M.t),
      ly: linear(lt.domain[0], lt.domain[1], height - M.b, M.t),
      bt: bt.ticks,
      lt: lt.ticks,
    };
  }, [width, n, bars, line, barDomain]);
  const at = (clientX: number, el: Element) => {
    if (!geo) return null;
    const i = Math.floor((clientX - el.getBoundingClientRect().left - M.l) / geo.colW);
    return i >= 0 && i < n ? i : null;
  };
  const linePath = geo
    ? line
        .map((v, i) => (v == null || !Number.isFinite(v) ? null : `${geo.x(i).toFixed(1)},${geo.ly(v).toFixed(1)}`))
        .reduce<string[]>((acc, p, i, arr) => {
          if (p) acc.push(`${i > 0 && arr[i - 1] ? 'L' : 'M'}${p}`);
          return acc;
        }, [])
        .join(' ')
    : '';
  const hi = hover ?? null;
  return (
    <div ref={ref} className="cg-svgbox" data-no-swipe-x>
      {geo && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="block"
          onPointerMove={(e) => setHover(at(e.clientX, e.currentTarget))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const i = at(e.clientX, e.currentTarget);
            if (i != null) onIdx(i);
          }}
        >
          {shade &&
            (() => {
              const a = pts.findIndex((p) => p.year === shade.from);
              const b = pts.findIndex((p) => p.year === shade.to);
              if (a < 0 || b < 0) return null;
              return (
                <g>
                  <rect x={M.l + a * geo.colW} y={M.t - 4} width={(b - a + 1) * geo.colW} height={height - M.b - M.t + 4} fill="hsl(43 100% 62% / 0.1)" stroke="hsl(43 100% 62% / 0.45)" strokeDasharray="3 3" />
                  <text x={M.l + a * geo.colW + 4} y={M.t + 6} fontSize="9" fontWeight={800} fill={GOLD}>
                    {shade.label}
                  </text>
                </g>
              );
            })()}
          {geo.bt.map((t) => (
            <g key={`b${t}`}>
              <line x1={M.l} x2={width - M.r} y1={geo.by(t)} y2={geo.by(t)} stroke={VIZ.grid} strokeDasharray="2 3" />
              <text x={M.l - 5} y={geo.by(t) + 3.5} textAnchor="end" fontSize="10" fill={VIZ.muted} className="tabular-nums">
                {barFmt(t)}
              </text>
            </g>
          ))}
          {geo.lt.map((t) => (
            <text key={`l${t}`} x={width - M.r + 5} y={geo.ly(t) + 3.5} fontSize="10" fill={VIZ.series[0]} className="tabular-nums">
              {lineFmt(t)}
            </text>
          ))}
          {bars.map((v, i) => {
            if (v == null || !Number.isFinite(v)) return null;
            const ink = clubInk(career.clubs[i]);
            const w = Math.max(3, geo.colW * 0.62);
            const y0 = geo.by(Math.max(0, v));
            return (
              <rect
                key={i}
                x={geo.x(i) - w / 2}
                y={y0}
                width={w}
                height={Math.max(1, height - M.b - y0)}
                rx={2}
                fill={ink.mark}
                opacity={i === idx ? 1 : pts[i].status === 'short' ? 0.35 : 0.7}
                stroke={i === idx ? GOLD : undefined}
                strokeWidth={i === idx ? 2 : undefined}
              />
            );
          })}
          {peak != null && bars[peak] != null && (
            <text x={geo.x(peak)} y={geo.by(bars[peak] as number) - 4} textAnchor="middle" fontSize="12" fill={GOLD}>
              ★
            </text>
          )}
          <path d={linePath} fill="none" stroke={VIZ.series[0]} strokeWidth={2.25} strokeLinejoin="round" />
          {line.map((v, i) => (v == null || !Number.isFinite(v) ? null : <circle key={i} cx={geo.x(i)} cy={geo.ly(v)} r={2.6} fill={VIZ.surface} stroke={VIZ.series[0]} strokeWidth={1.5} />))}
          {pts.map((p, i) =>
            i % Math.max(1, Math.ceil(n / Math.floor((width - M.l - M.r) / 30))) === 0 || i === n - 1 ? (
              <text key={p.year} x={geo.x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill={i === idx ? GOLD : VIZ.muted} className="tabular-nums">
                {geo.colW >= 26 ? yLabel(p.year) : `'${p.year % 100}`}
              </text>
            ) : null,
          )}
          <line x1={M.l} x2={width - M.r} y1={height - M.b} y2={height - M.b} stroke={VIZ.axis} />
        </svg>
      )}
      {geo && hi != null && (
        <ChartTip x={geo.x(hi)} y={M.t + 40} width={width}>
          <p className="mb-1 font-semibold">
            {yLabel(pts[hi].year)}
            {career.clubs[hi] ? ` · ${career.clubs[hi]}` : ''}
          </p>
          <p className="tabular-nums">
            {barLabel}: <b>{bars[hi] == null ? '—' : barFmt(bars[hi] as number)}</b>
          </p>
          <p className="tabular-nums">
            {lineLabel}: <b>{line[hi] == null ? '—' : lineFmt(line[hi] as number)}</b>
          </p>
        </ChartTip>
      )}
      <ul className="cg-legend mt-1">
        <li>
          <span className="cg-swatch" style={{ background: 'hsl(226 30% 60%)', height: 8, width: 10 }} /> {barLabel} (bars, club colours)
        </li>
        <li>
          <span className="cg-swatch" style={{ background: VIZ.series[0] }} /> {lineLabel} (line, right axis)
        </li>
      </ul>
    </div>
  );
};

/**
 * Peak vs longevity: each season's score (the mean percentile of his skill-grade traits that season, a per-game
 * production grade like TPG) against his career games, with his prime (best three straight seasons) shaded.
 */
export const PeakChart = ({ player, career, idx, onIdx }: { player: Player; career: Career; idx: number; onIdx: (i: number) => void }) => {
  const bars = career.points.map((p) => seasonScore(player.position, p));
  const games = career.points.map((p) => p.totals.g ?? null);
  const fin = bars.map((v, i) => [v, i] as const).filter(([v]) => v != null) as [number, number][];
  const peak = fin.length ? fin.reduce((a, b) => (b[0] > a[0] ? b : a))[1] : null;
  const prime = career.prime;
  const seasons = career.points.filter((p) => p.games > 0).length;
  return (
    <div className="cg-card glass-card">
      <h3>Peak vs longevity</h3>
      <p className="cg-sub">
        Bars: season score, the mean percentile of his skill-grade traits that season (0–100). Line: career games. {seasons} recorded seasons played
        {peak != null ? `; peak ${yLabel(career.points[peak].year)} (${Math.round(bars[peak] as number)})` : ''}
        {prime ? `; prime ${yLabel(prime.from)}–${yLabel(prime.to)} averaged ${Math.round(prime.mean)}` : ''}.
      </p>
      <BarLine
        career={career}
        bars={bars}
        line={games}
        barLabel="Season score"
        lineLabel="Career games"
        barFmt={(v) => fmtFixed(v, 0)}
        lineFmt={shortNum}
        shade={prime ? { ...prime, label: 'PRIME' } : null}
        peak={peak}
        idx={idx}
        onIdx={onIdx}
        barDomain={[0, 100]}
        ariaLabel={`${player.name} season score and career games by season`}
      />
    </div>
  );
};

interface Pair {
  id: string;
  label: string;
  vol: string;
  eff: string;
  volOf: (p: SeasonPoint) => number | null;
  effOf: (p: SeasonPoint, pos: Player['position']) => number | null;
  effFmt: (v: number) => string;
}
const bx = (k: string) => (p: SeasonPoint) => (p.box ? p.box[k] ?? 0 : null);
const ratio = (a: string[], b: string[], scale = 1) => (p: SeasonPoint) => {
  if (!p.box) return null;
  const num = a.reduce((s, k) => s + (p.box![k] ?? 0), 0);
  const den = b.reduce((s, k) => s + (p.box![k] ?? 0), 0);
  return den > 0 ? (scale * num) / den : null;
};
const perG = (keys: string[]) => (p: SeasonPoint) => (p.box && p.games > 0 ? keys.reduce((s, k) => s + (p.box![k] ?? 0), 0) / p.games : null);
const f1 = (v: number) => fmtFixed(v, 1);
const f2 = (v: number) => fmtFixed(v, 2);

const PAIRS: Record<Group, Pair[]> = {
  QB: [
    { id: 'tdint', label: 'Volume vs care', vol: 'Passing yards', eff: 'TD:INT', volOf: bx('yds'), effOf: (p) => (p.box ? (p.box.td ?? 0) / Math.max(1, p.box.int ?? 0) : null), effFmt: f1 },
    { id: 'ydtd', label: 'Volume vs scoring', vol: 'Passing yards', eff: 'Pass TD per 100 yds', volOf: bx('yds'), effOf: ratio(['td'], ['yds'], 100), effFmt: f2 },
  ],
  RB: [
    { id: 'scrim', label: 'Workload vs scoring', vol: 'Scrimmage yards', eff: 'TD per 100 yds', volOf: (p) => (p.box ? (p.box.ryds ?? 0) + (p.box.recyds ?? 0) : null), effOf: ratio(['rtd', 'rectd'], ['ryds', 'recyds'], 100), effFmt: f2 },
    { id: 'rec', label: 'Targets vs yards a catch', vol: 'Catches', eff: 'Yds/catch', volOf: bx('rec'), effOf: ratio(['recyds'], ['rec']), effFmt: f1 },
  ],
  WR: [
    { id: 'ypr', label: 'Catches vs yards a catch', vol: 'Catches', eff: 'Yds/catch', volOf: bx('rec'), effOf: ratio(['yds'], ['rec']), effFmt: f1 },
    { id: 'tdr', label: 'Catches vs TD rate', vol: 'Catches', eff: 'TD per catch %', volOf: bx('rec'), effOf: ratio(['td'], ['rec'], 100), effFmt: f1 },
  ],
  TE: [
    { id: 'ypr', label: 'Catches vs yards a catch', vol: 'Catches', eff: 'Yds/catch', volOf: bx('rec'), effOf: ratio(['yds'], ['rec']), effFmt: f1 },
    { id: 'tdr', label: 'Catches vs TD rate', vol: 'Catches', eff: 'TD per catch %', volOf: bx('rec'), effOf: ratio(['td'], ['rec'], 100), effFmt: f1 },
  ],
  OL: [{ id: 'blk', label: 'Games vs blocks a game', vol: 'Games', eff: 'Blocks/G', volOf: (p) => (p.box ? p.games : null), effOf: perG(['blk']), effFmt: f2 }],
  DEF: [
    { id: 'tkl', label: 'Tackles vs big plays', vol: 'Tackles', eff: 'Sacks + INT + FF a game', volOf: bx('tkl'), effOf: perG(['sck', 'int', 'ff']), effFmt: f2 },
    { id: 'tklg', label: 'Games vs tackles a game', vol: 'Games', eff: 'Tackles/G', volOf: (p) => (p.box ? p.games : null), effOf: perG(['tkl']), effFmt: f1 },
  ],
};

// The live save's attempt and carry keys give QBs Y/A and RBs Y/C on the seasons that have them
const LIVE_PAIRS: Partial<Record<Group, Pair>> = {
  QB: { id: 'ya', label: 'Attempts vs Y/A', vol: 'Attempts', eff: 'Yds/att', volOf: bx('att'), effOf: ratio(['yds'], ['att']), effFmt: f1 },
  RB: { id: 'ypc', label: 'Carries vs Y/C', vol: 'Carries', eff: 'Yds/carry', volOf: bx('ratt'), effOf: ratio(['ryds'], ['ratt']), effFmt: f2 },
};

/** Rate stability and volume: one volume per season (bars) against one efficiency rate (line, second axis). */
export const VolumeRate = ({ player, career, idx, onIdx }: { player: Player; career: Career; idx: number; onIdx: (i: number) => void }) => {
  const g = groupOf(player.position);
  const live = LIVE_PAIRS[g];
  const pairs = [...PAIRS[g], ...(live && career.points.some((p) => p.box?.[live.id === 'ya' ? 'att' : 'ratt']) ? [live] : [])];
  const [id, setId] = useState(pairs[0].id);
  const pair = pairs.find((p) => p.id === id) ?? pairs[0];
  const bars = career.points.map(pair.volOf);
  const line = career.points.map((p) => pair.effOf(p, player.position));
  const eff = line.filter((v): v is number => v != null);
  const mean = eff.length ? eff.reduce((s, v) => s + v, 0) / eff.length : 0;
  const sd = eff.length > 1 ? Math.sqrt(eff.reduce((s, v) => s + (v - mean) ** 2, 0) / (eff.length - 1)) : 0;
  const cv = mean ? sd / mean : 0;
  return (
    <div className="cg-card glass-card">
      <h3>Volume vs efficiency</h3>
      <p className="cg-sub">
        {pair.vol} each season against {pair.eff}. Across {eff.length} seasons his {pair.eff} averaged {pair.effFmt(mean)}, varying {Math.round(cv * 100)}% season to season (
        {cv < 0.12 ? 'rock steady' : cv < 0.25 ? 'steady' : 'streaky'}).
      </p>
      {pairs.length > 1 && (
        <div className="cg-pick" role="radiogroup" aria-label="Volume and rate">
          {pairs.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={p.id === pair.id} onClick={() => setId(p.id)} className={cn('cg-chip', p.id === pair.id && 'cg-chip--on')}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <BarLine
        career={career}
        bars={bars}
        line={line}
        barLabel={pair.vol}
        lineLabel={pair.eff}
        barFmt={shortNum}
        lineFmt={pair.effFmt}
        idx={idx}
        onIdx={onIdx}
        ariaLabel={`${player.name}: ${pair.vol} and ${pair.eff} by season`}
      />
    </div>
  );
};
