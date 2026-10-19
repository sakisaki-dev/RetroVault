import { useMemo, useState, type CSSProperties } from 'react';
import { Info } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import {
  buildContext,
  evaluatePosition,
  legacyMix,
  metricsFor,
  plusIndex,
  type AdvMetric,
  type MetricFamily,
} from '@/config/advanced';
import { getRawTrueTalent } from '@/config/stats';
import { getMetricTier, getTierBgColor, getTierColor, getTierLabel } from '@/utils/metricColors';
import MetricLabel from '@/components/stats/analytics/MetricLabel';
import PercentileBar from '@/components/stats/analytics/PercentileBar';
import { VIZ, fmtNum, fmtPlus, ordinal } from '@/components/stats/analytics/viz';
import CountUp from '@/components/brand/CountUp';

interface MetricResult {
  metric: AdvMetric;
  qualifies: boolean;
  value: number | null;
  plus: number | null;
  pct: number | null;
  rank: number | null;
  pool: number;
  mean: number;
}

/** Mid-rank percentile of `v` against a list of qualifier values (direction-aware), as if added to it. */
const pctAgainst = (v: number, values: number[], lowerIsBetter: boolean) => {
  if (!values.length) return 100;
  let below = 0;
  let equal = 0;
  values.forEach((o) => {
    if (lowerIsBetter ? o > v : o < v) below += 1;
    else if (o === v) equal += 1;
  });
  return ((below + equal / 2) / values.length) * 100;
};

const FAMILY_LABEL: Record<MetricFamily, string> = {
  Passing: 'Passing',
  Skill: 'Skill position',
  Defense: 'Defense',
  Line: 'Line play',
  Value: 'Value (all positions)',
};

const RATING_METRICS = [
  { key: 'trueTalent', label: 'True Talent', decimals: 1, note: 'Production rating, position-adjusted' },
  { key: 'dominance', label: 'Dominance', decimals: 1, note: '0.7 × TT + award points' },
  { key: 'careerLegacy', label: 'Career Legacy', decimals: 0, note: '4·TT + 4·Dom + 2·Games' },
  { key: 'tpg', label: 'TPG', decimals: 2, note: 'True Talent ÷ (games + 50)' },
] as const;

const fmt = (v: number | null, d: number, suffix = '') => (v == null || !Number.isFinite(v) ? '—' : `${fmtNum(v, d)}${suffix}`);

const LEGACY_PARTS = [
  { key: 'talent', label: 'Talent', note: '6.8 × True Talent', color: VIZ.series[0] },
  { key: 'awards', label: 'Awards', note: '4 × award points', color: VIZ.series[1] },
  { key: 'longevity', label: 'Longevity', note: '2 × games', color: VIZ.series[2] },
] as const;

const LegacyComposition = ({ player }: { player: Player }) => {
  const mix = legacyMix(player);
  const [hover, setHover] = useState<string | null>(null);
  if (!(mix.total > 0)) return null;
  const parts = LEGACY_PARTS.map((p) => ({ ...p, value: mix[p.key] as number, share: (mix[p.key] as number) / mix.total }));
  const active = parts.find((p) => p.key === hover);
  return (
    <figure className="pc-panel p-3 sm:p-4" aria-labelledby="legacy-mix-title">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span id="legacy-mix-title" className="font-display text-base font-bold uppercase tracking-wide">
          Where his Career Legacy comes from
        </span>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmtNum(mix.total, 0)} total</span>
      </figcaption>
      <div className="relative mt-3">
        <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.share * 100)}%`).join(', ')}>
          {parts.map((p) =>
            p.share > 0 ? (
              <button
                key={p.key}
                type="button"
                className="h-full min-w-[3px] transition-opacity first:rounded-l-[4px] last:rounded-r-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk"
                style={{ width: `${p.share * 100}%`, background: p.color, opacity: hover && hover !== p.key ? 0.45 : 1 }}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.key)}
                onBlur={() => setHover(null)}
                aria-label={`${p.label}: ${fmtNum(p.value, 0)} (${Math.round(p.share * 100)}%), ${p.note}`}
              />
            ) : null,
          )}
        </div>
        {active && (
          <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-popover px-2.5 py-1.5 text-xs shadow-lg">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: active.color }} aria-hidden="true" />
            <b>{active.label}</b> {fmtNum(active.value, 0)} · {Math.round(active.share * 100)}%
            <span className="ml-1 text-muted-foreground">({active.note})</span>
          </div>
        )}
      </div>
      {/* Legend doubles as the table view */}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {parts.map((p) => (
          <div key={p.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
              {p.label}
            </dt>
            <dd className="mt-0.5 font-mono font-semibold tabular-nums text-chalk">
              {fmtNum(p.value, 0)} <span className="font-normal text-muted-foreground">· {Math.round(p.share * 100)}%</span>
            </dd>
            <dd className="text-[10px] text-muted-foreground">{p.note}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
};

interface Props {
  player: Player;
  /** League players (no legends): the comparison pool */
  players: Player[];
}

const AdvancedPanel = ({ player, players }: Props) => {
  const pos = player.position;
  const ctx = useMemo(() => buildContext(players), [players]);
  const boards = useMemo(() => evaluatePosition(players, pos, ctx), [players, pos, ctx]);

  const results: MetricResult[] = useMemo(
    () =>
      metricsFor(pos).map((metric) => {
        const board = boards.get(metric.id)!;
        const row = board.rows.find((r) => r.player.name === player.name && !player.isRealLegend);
        const base = { metric, pool: board.rows.length, mean: board.mean };
        if (row) return { ...base, qualifies: true, value: row.value, plus: row.plus, pct: row.pct, rank: row.rank };
        const qualifies = metric.qualifies(player);
        const v = qualifies ? metric.value(player, ctx) : NaN;
        if (!qualifies || !Number.isFinite(v)) return { ...base, qualifies: false, value: null, plus: null, pct: null, rank: null };
        return {
          ...base,
          qualifies: true,
          value: v,
          plus: metric.plus ? plusIndex(v, board.mean, metric.lowerIsBetter) : null,
          pct: pctAgainst(
            v,
            board.rows.map((r) => r.value),
            !!metric.lowerIsBetter,
          ),
          rank: null,
        };
      }),
    [boards, ctx, player, pos],
  );

  const families = [...new Set(results.map((r) => r.metric.family))];
  const rawTT = getRawTrueTalent(player);
  const factor = player.positionFactor ?? 1;
  const adjusted = Math.abs(factor - 1) > 0.0005;
  const rated = player.trueTalent > 0;

  return (
    <div className="space-y-5">
      {rated ? (
        <section aria-labelledby="pc-rating-model" className="space-y-3">
          <h4 id="pc-rating-model" className="pc-subtitle">Rating model</h4>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATING_METRICS.map((m, i) => {
              const value = player[m.key] ?? 0;
              const tier = getMetricTier(value, m.key);
              const color = getTierColor(tier);
              return (
                <div key={m.key} className="pc-tile pc-enter flex flex-col p-3" style={{ '--i': i } as CSSProperties}>
                  <dt className="font-pixel text-[9px] uppercase text-muted-foreground">{m.label}</dt>
                  <dd className="mt-1 font-display text-3xl font-bold leading-none tabular-nums text-chalk">
                    <CountUp value={value} decimals={m.decimals} />
                  </dd>
                  <dd className="mt-1.5">
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color, backgroundColor: getTierBgColor(tier) }}
                    >
                      {getTierLabel(tier, m.key)}
                    </span>
                  </dd>
                  <dd className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{m.note}</dd>
                </div>
              );
            })}
          </dl>
          <div className="pc-panel flex gap-2 p-3 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--tc-accent)]" aria-hidden="true" />
            <p>
              <b className="text-chalk">Raw vs position-adjusted True Talent.</b> The sheet's {pos} formula gives a raw True Talent of{' '}
              <b className="font-mono text-chalk">{fmtNum(rawTT, 1)}</b>.{' '}
              {adjusted ? (
                <>
                  Positions aren't rated on the same scale, so every {pos}'s raw value is multiplied by{' '}
                  <b className="font-mono text-chalk">{factor.toFixed(3)}</b> (league reference ÷ the mean of the top 3 raw {pos}s), giving{' '}
                  <b className="font-mono text-chalk">{fmtNum(player.trueTalent, 1)}</b>. Dominance, Career Legacy and TPG are recomputed from the
                  adjusted value.
                </>
              ) : (
                <>
                  {pos} is already on the league reference scale (factor 1.000), so raw and adjusted are the same.
                </>
              )}
            </p>
          </div>
          <LegacyComposition player={player} />
        </section>
      ) : (
        <p className="pc-panel p-3 text-xs text-muted-foreground">
          Imported legends aren't rated on the league's True Talent scale, so there is no Dominance, Career Legacy or legacy breakdown. The
          metrics below rank his real NFL totals against league {pos}s.
        </p>
      )}

      {families.map((fam) => (
        <section key={fam} aria-labelledby={`pc-fam-${fam}`} className="space-y-2">
          <h4 id={`pc-fam-${fam}`} className="pc-subtitle">
            {FAMILY_LABEL[fam]}
          </h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {results
              .filter((r) => r.metric.family === fam)
              .map((r, i) => (
                <li key={r.metric.id} className={cn('pc-tile pc-enter p-3', !r.qualifies && 'opacity-70')} style={{ '--i': i } as CSSProperties}>
                  <div className="flex items-start justify-between gap-2">
                    <MetricLabel metric={r.metric} className="text-sm font-semibold text-chalk" />
                    <span className="shrink-0 font-display text-2xl font-bold leading-none tabular-nums text-chalk">
                      {fmt(r.value, r.metric.decimals, r.metric.suffix)}
                    </span>
                  </div>
                  {r.qualifies && r.pct != null ? (
                    <>
                      <PercentileBar
                        pct={r.pct}
                        label={`${r.metric.label}: ${ordinal(r.pct)} percentile among ${r.pool} qualifying ${pos}s`}
                        className="mt-2.5 h-2 w-full overflow-hidden rounded-sm"
                      />
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>
                          <b className="text-chalk">{ordinal(r.pct)}</b> pct
                        </span>
                        {r.metric.plus && (
                          <span title="100 = position average among qualifiers; 130 = 30% better">
                            <b className="text-chalk">{fmtPlus(r.plus)}</b> {r.metric.short}+
                          </span>
                        )}
                        {r.rank != null ? (
                          <span>
                            #{r.rank} of {r.pool} {pos}s
                          </span>
                        ) : (
                          <span>vs {r.pool} league {pos}s</span>
                        )}
                        <span>
                          avg {fmt(r.mean, r.metric.decimals, r.metric.suffix)}
                        </span>
                        {r.metric.lowerIsBetter && <span>lower is better</span>}
                        {r.metric.styleOnly && <span>style marker</span>}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">Below the minimum sample ({r.metric.minLabel}); not ranked.</p>
                  )}
                  <p className="mt-1 font-pixel text-[8px] uppercase text-muted-foreground/80">{r.metric.minLabel}</p>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Percentiles and + indexes compare against qualifying league {pos}s (imported legends excluded). "+" is 100 at the position average; tap a
        metric name for its definition.
      </p>
    </div>
  );
};

export default AdvancedPanel;
