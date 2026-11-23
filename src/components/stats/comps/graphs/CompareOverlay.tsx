import { useMemo, useState } from 'react';
import type { Player, Position } from '@/types/player';
import { similarPlayers } from '@/config/advanced';
import { cn } from '@/lib/utils';
import { peekProps } from '@/components/peek/peekProps';
import { GOLD } from '../../visual/chartKit';
import { VIZ } from '../../analytics/viz';
import type { LeagueSeasons, SeasonPoint } from './careerModel';
import type { Career } from './careerStory';
import { MetricChips } from './CareerHero';
import MultiLine, { type LineSeries } from './MultiLine';
import type { GraphMetric } from './graphKit';

type Mode = 'comp' | 'top' | 'avg';
const posOf = (k: string) => k.slice(0, k.indexOf(':')) as Position;
const nameOf = (k: string) => k.slice(k.indexOf(':') + 1);

const byCareerYear = (pts: SeasonPoint[], m: GraphMetric) => {
  const out = new Map<number, number>();
  pts.forEach((p) => {
    const v = m.get(p);
    if (p.careerYear != null && v != null && Number.isFinite(v)) out.set(p.careerYear, v);
  });
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
};

const quart = (s: number[], q: number) => {
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
};

/**
 * His curve by career year against a comparable (closest overall, config/advanced.ts similarity), the position's top
 * five by Career Legacy, or the league average at his position with its middle half shaded.
 */
const CompareOverlay = ({
  player,
  players,
  career,
  league,
  metrics,
  idx,
}: {
  idx: number;
  player: Player;
  players: Player[];
  career: Career;
  league: LeagueSeasons;
  metrics: GraphMetric[];
}) => {
  const [mode, setMode] = useState<Mode>('avg');
  const [metricId, setMetricId] = useState('szn');
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const comps = useMemo(
    () => similarPlayers(players, player, 8, 'level').filter((c) => league.byKey.get(`${c.player.position}:${c.player.name}`)?.some((p) => p.careerYear != null)),
    [players, player, league],
  );
  const [compKey, setCompKey] = useState('');
  const comp = comps.find((c) => `${c.player.position}:${c.player.name}` === compKey) ?? comps[0];

  const { series, band, note } = useMemo(() => {
    const mine: LineSeries = { key: career.key, label: player.name.split(' ').slice(-1)[0], color: GOLD, points: byCareerYear(career.points, metric), width: 3 };
    if (mode === 'avg') {
      const at = new Map<number, number[]>();
      league.byKey.forEach((pts, k) => {
        if (posOf(k) !== player.position) return;
        byCareerYear(pts, metric).forEach(({ x, y }) => at.set(x, [...(at.get(x) ?? []), y]));
      });
      const rows = [...at.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => a[0] - b[0]);
      const avg: LineSeries = { key: 'avg', label: 'League avg', color: VIZ.muted, dash: '5 4', width: 2, points: rows.map(([x, v]) => ({ x, y: v.reduce((s, n) => s + n, 0) / v.length })) };
      const band = rows.map(([x, v]) => {
        const s = [...v].sort((a, b) => a - b);
        return { x, lo: quart(s, 0.25), hi: quart(s, 0.75) };
      });
      return { series: [avg, mine], band, note: `Every recorded ${player.position}'s ${metric.label.toLowerCase()} by career year (3+ players a year); shaded: the middle half.` };
    }
    if (mode === 'comp' && comp) {
      const k = `${comp.player.position}:${comp.player.name}`;
      return {
        series: [{ key: k, label: comp.player.name.split(' ').slice(-1)[0], color: VIZ.series[0], points: byCareerYear(league.byKey.get(k) ?? [], metric), width: 2, peekKey: k }, mine],
        band: undefined,
        note: `${comp.player.name}: ${Math.round(comp.similarity)} closest overall (level + style of their career rates).`,
      };
    }
    const top = [...league.byKey.entries()]
      .filter(([k]) => posOf(k) === player.position && k !== career.key)
      .map(([k, pts]) => ({ k, pts, legacy: pts[pts.length - 1].legacy }))
      .sort((a, b) => b.legacy - a.legacy)
      .slice(0, 5);
    return {
      series: [
        ...top.map((t, i) => ({ key: t.k, label: nameOf(t.k).split(' ').slice(-1)[0], color: i < 3 ? VIZ.series[i] : VIZ.muted, dash: i >= 3 ? '3 3' : undefined, points: byCareerYear(t.pts, metric), width: 1.5, peekKey: t.k })),
        mine,
      ],
      band: undefined,
      note: `The five ${player.position}s with the highest Career Legacy. Careers that began before the records start at the career year their games put them in.`,
    };
  }, [mode, career, metric, league, player, comp]);

  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b), [series]);
  return (
    <div className="cg-card glass-card cg-span">
      <h3>Side by side</h3>
      <p className="cg-sub">His curve by career year (1 = rookie season). {note}</p>
      <div className="cg-pick" role="radiogroup" aria-label="Compare with">
        {(
          [
            ['avg', 'League average'],
            ['comp', 'Comparable'],
            ['top', `Top 5 ${player.position}s`],
          ] as const
        ).map(([m, l]) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn('cg-chip', mode === m && 'cg-chip--on')}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'comp' && comps.length > 0 && (
        <div className="cg-chips scrollbar-none" data-no-swipe-x role="radiogroup" aria-label="Comparable player">
          {comps.map((c) => {
            const k = `${c.player.position}:${c.player.name}`;
            const on = comp === c;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setCompKey(k)} className={cn('cg-chip', on && 'cg-chip--on')} {...peekProps(c.player)}>
                {c.player.name} <span className="opacity-70">{Math.round(c.similarity)}</span>
              </button>
            );
          })}
        </div>
      )}
      <MetricChips metrics={metrics.filter((m) => !m.invert)} value={metric.id} onChange={setMetricId} label="Comparison metric" />
      {xs.length > 1 ? (
        <MultiLine series={series} xs={xs} xLabel={(x) => `Yr ${x}`} yFmt={(v) => metric.fmt(v)} band={band} zero={!['szn', 'car', 'skill'].includes(metric.id)} ariaLabel={`${player.name} against ${mode === 'avg' ? 'the league average' : mode === 'comp' ? 'a comparable' : 'the top five'} by career year`} selX={career.points[idx]?.careerYear ?? null} />
      ) : (
        <p className="cg-note">Not enough seasons with {metric.label.toLowerCase()} to compare.</p>
      )}
    </div>
  );
};

export default CompareOverlay;
