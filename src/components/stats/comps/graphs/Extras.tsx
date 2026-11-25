import type { Player } from '@/types/player';
import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import { fmtFixed } from '@/utils/numberFormat';
import { useSchedule } from '@/utils/schedule';
import { GOLD } from '../../visual/chartKit';
import { VIZ, ordinal } from '../../analytics/viz';
import type { Career } from './careerStory';
import { seasonScore } from './careerModel';
import { BOX, groupOf, seasonRates } from './statDefs';
import { clubInk, shortNum, yLabel, type GraphMetric } from './graphKit';

/**
 * Season-by-season sparklines, one per metric (every box stat and the card numbers): the value at the cursor, his
 * career best, and a tap to chart it on the timeline above.
 */
export const SparkRows = ({ career, metrics, metricId, onMetric, idx, wide }: { career: Career; metrics: GraphMetric[]; metricId: string; onMetric: (id: string) => void; idx: number; wide: boolean }) => {
  // a phone gets the card numbers and box stats; a desktop, beside the tall season panel, every rate too
  const rows = metrics.filter((m) => (wide || m.group !== 'Rate') && m.id !== 'skill');
  const n = career.points.length;
  const W = 120;
  const H = 22;
  return (
    <ul className="cg-sparks" aria-label="Every metric by season">
      {rows.map((m) => {
        const vals = career.points.map((p) => m.get(p));
        const fin = vals.filter((v): v is number => v != null && Number.isFinite(v));
        if (!fin.length) return null;
        const lo = Math.min(...fin);
        const hi = Math.max(...fin);
        const y = (v: number) => {
          const t = (v - lo) / (hi - lo || 1);
          return m.invert ? 3 + t * (H - 6) : H - 3 - t * (H - 6);
        };
        const x = (i: number) => (n === 1 ? W / 2 : 2 + (i * (W - 4)) / (n - 1));
        const d = vals.map((v, i) => (v == null || !Number.isFinite(v) ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).reduce<string[]>((acc, pt, i, arr) => {
          if (pt) acc.push(`${i > 0 && arr[i - 1] ? 'L' : 'M'}${pt}`);
          return acc;
        }, []);
        const best = m.invert ? lo : hi;
        const bi = vals.findIndex((v) => v === best);
        const cur = vals[idx];
        return (
          <li key={m.id}>
            <button type="button" onClick={() => onMetric(m.id)} className={cn('cg-spark', m.id === metricId && 'cg-spark--on')} aria-pressed={m.id === metricId}>
              <span className="cg-spark__label">{m.short}</span>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cg-spark__svg" aria-hidden="true">
                <path d={d.join(' ')} fill="none" stroke={m.id === metricId ? GOLD : VIZ.series[0]} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
                {cur != null && Number.isFinite(cur) && <circle cx={x(idx)} cy={y(cur)} r={2.2} fill={GOLD} />}
              </svg>
              <span className="cg-spark__now">{cur == null || !Number.isFinite(cur) ? '—' : m.fmt(cur)}</span>
              <span className="cg-spark__best">
                best {m.fmt(best)} <span className="opacity-70">{bi >= 0 ? `'${career.points[bi].year % 100}` : ''}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

/** Career splits by club: the seasons, games, rings and box-stat totals and per-game rates he put up at each stop. */
export const ClubSplits = ({ player, career }: { player: Player; career: Career }) => {
  const box = BOX[groupOf(player.position)];
  const by = new Map<string, { seasons: number[]; games: number; rings: number; tot: Record<string, number>; score: number[] }>();
  career.points.forEach((p, i) => {
    const c = career.clubs[i];
    if (!c || !p.box) return;
    const r = by.get(c) ?? { seasons: [], games: 0, rings: 0, tot: {}, score: [] };
    r.seasons.push(p.year);
    r.games += p.games;
    r.rings += p.awards?.rings ?? 0;
    box.forEach((b) => (r.tot[b.key] = (r.tot[b.key] ?? 0) + (p.box![b.key] ?? 0)));
    const s = seasonScore(player.position, p);
    if (s != null) r.score.push(s);
    by.set(c, r);
  });
  const rows = [...by.entries()];
  if (!rows.length) return null;
  return (
    <div className="cg-card glass-card">
      <h3>Splits by club</h3>
      <p className="cg-sub">His recorded seasons at each stop (totals, per game, rings, average season score), then every season in order.</p>
      <div className="cg-fill">
        {rows.map(([club, r]) => {
          const ink = clubInk(club);
          const avg = r.score.length ? r.score.reduce((a, b) => a + b, 0) / r.score.length : null;
          return (
            <div key={club} className="cg-split" style={{ borderColor: ink.mark }}>
              <div className="flex items-center gap-2">
                {ink.team && <TeamLogo team={ink.team} size={26} decorative />}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold uppercase leading-none" style={{ color: ink.mark }}>
                    {club}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {yLabel(r.seasons[0])}
                    {r.seasons.length > 1 ? `–${yLabel(r.seasons[r.seasons.length - 1])}` : ''} · {r.seasons.length} season{r.seasons.length === 1 ? '' : 's'} · {r.games} games
                    {r.rings ? ` · ${r.rings} ring${r.rings === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                {avg != null && (
                  <span className="text-right">
                    <span className="block font-display text-xl font-bold leading-none tabular-nums text-chalk">{Math.round(avg)}</span>
                    <span className="font-pixel text-[7px] uppercase text-muted-foreground">avg score</span>
                  </span>
                )}
              </div>
              <dl className="cg-split__stats">
                {box.map((b) => (
                  <div key={b.key}>
                    <dt>{b.short}</dt>
                    <dd>
                      {fmtFixed(r.tot[b.key] ?? 0, 0)}
                      <span>{r.games ? fmtFixed((r.tot[b.key] ?? 0) / r.games, 1) : '—'}/G</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
        <p className="font-pixel text-[8px] uppercase text-muted-foreground">Season log</p>
        <ul className="cg-fill__list cg-log">
          {career.points.map((p, i) => {
            if (!p.box) return null;
            const ink = clubInk(career.clubs[i]);
            const s = seasonScore(player.position, p);
            return (
              <li key={p.year}>
                <span className="cg-log__row" style={{ borderLeftColor: ink.mark }}>
                  <span className="w-9 font-display font-bold text-chalk">{yLabel(p.year)}</span>
                  <span className="w-7 text-muted-foreground">{p.games}G</span>
                  <span className="min-w-0 flex-1 truncate text-secondary-foreground">{box.map((b) => `${shortNum(p.box![b.key] ?? 0)} ${b.short.toLowerCase()}`).join(' · ')}</span>
                  <span className="relative h-1.5 w-12 overflow-hidden rounded-sm bg-panel-2" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0" style={{ width: `${Math.max(3, s ?? 0)}%`, background: s == null ? 'transparent' : `hsl(213 80% ${42 + (s / 100) * 26}%)` }} />
                  </span>
                  <span className="w-6 text-right font-mono text-chalk">{s == null ? '—' : Math.round(s)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/** His best and worst recorded seasons by season score, each with its line, plus his percentile ranks at a glance. */
export const BestSeasons = ({ player, career, onIdx }: { player: Player; career: Career; onIdx: (i: number) => void }) => {
  const schedule = useSchedule();
  const box = BOX[groupOf(player.position)];
  const scored = career.points
    .map((p, i) => ({ p, i, s: seasonScore(player.position, p) }))
    .filter((r): r is { p: (typeof career.points)[number]; i: number; s: number } => r.s != null && r.p.status === 'played');
  if (!scored.length) return null;
  const sorted = [...scored].sort((a, b) => b.s - a.s);
  const best = sorted.slice(0, 3);
  const worst = sorted.length > 4 ? sorted.slice(-2).reverse() : [];
  const top10 = scored.filter((r) => r.s >= 90).length;
  const profile = seasonRates(player.position)
    .filter((r) => r.trait)
    .map((r) => {
      const v = scored.map((s) => s.p.pct[r.id]).filter((x) => Number.isFinite(x));
      return { id: r.id, name: r.name, n: v.length, avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN };
    })
    .filter((t) => t.n >= 2);
  const Row = ({ r, rank, tone }: { r: (typeof scored)[number]; rank: string; tone: 'best' | 'worst' }) => {
    const ink = clubInk(career.clubs[r.i]);
    // the club's record that season (only seasons with weekly scores), and what he won in it
    const row = schedule?.seasons[`Y${r.p.year}`]?.table.find((t) => t.team === ink.team?.name || t.abbr === ink.team?.abbreviation);
    const aw = r.p.awards ?? {};
    const honours = [
      aw.rings > 0 ? 'Ring' : '',
      aw.mvp > 0 ? 'MVP' : '',
      aw.opoy > 0 ? 'OPOY' : '',
      aw.dpoy > 0 ? 'DPOY' : '',
      aw.sbmvp > 0 ? 'SB MVP' : '',
    ].filter(Boolean);
    return (
      <li>
        <button type="button" className="cg-season" onClick={() => onIdx(r.i)} style={{ borderLeftColor: ink.mark }}>
          {ink.team && <TeamLogo team={ink.team.name} size={26} decorative />}
          <span className={cn('cg-season__rank', tone === 'worst' && 'cg-season__rank--low')}>{rank}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-bold uppercase leading-tight text-chalk">
              {yLabel(r.p.year)} <span style={{ color: ink.mark }}>{career.clubs[r.i] ?? ''}</span>
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {r.p.games} G · {box.map((b) => `${shortNum(r.p.box?.[b.key] ?? 0)} ${b.short.toLowerCase()}`).join(' · ')}
            </span>
            {(row || honours.length > 0 || r.p.ovr != null) && (
              <span className="cg-season__tags">
                {row && <span className="cg-season__tag">Club {row.record}</span>}
                {r.p.ovr != null && <span className="cg-season__tag">SZN {Math.round(r.p.ovr)}</span>}
                {honours.map((h) => (
                  <span key={h} className="cg-season__tag cg-season__tag--gold">{h}</span>
                ))}
              </span>
            )}
          </span>
          <span className="cg-season__score">{Math.round(r.s)}</span>
        </button>
      </li>
    );
  };
  return (
    <div className="cg-card glass-card">
      <h3>Best and worst seasons</h3>
      <p className="cg-sub">
        Ranked by season score (his trait percentiles that season). {top10} of his {scored.length} full seasons scored 90 or better.
      </p>
      <div className="cg-fill">
      <p className="font-pixel text-[8px] uppercase text-gold">Peak seasons</p>
      <ul className="cg-fill__list">
        {best.map((r, k) => (
          <Row key={r.p.year} r={r} rank={ordinal(k + 1).replace(/(\d+)/, '$1')} tone="best" />
        ))}
      </ul>
      {worst.length > 0 && (
        <>
          <p className="font-pixel text-[8px] uppercase text-muted-foreground">Quietest seasons</p>
          <ul className="cg-fill__list">
            {worst.map((r) => (
              <Row key={r.p.year} r={r} rank="▼" tone="worst" />
            ))}
          </ul>
        </>
      )}
      {profile.length > 0 && (
        <>
          <p className="font-pixel text-[8px] uppercase text-muted-foreground">Career trait profile · average season percentile</p>
          <ul className="space-y-1">
            {profile.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-[11.5px]" title={`${t.name}: ${Math.round(t.avg)} average percentile over ${t.n} seasons`}>
                <span className="w-28 shrink-0 truncate font-semibold text-secondary-foreground">{t.name}</span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-sm bg-panel-2" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0" style={{ width: `${Math.max(3, t.avg)}%`, background: `hsl(213 80% ${42 + (t.avg / 100) * 26}%)` }} />
                </span>
                <span className="w-9 text-right font-mono tabular-nums text-chalk">{ordinal(t.avg)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      </div>
    </div>
  );
};
