import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { liftForDarkBg } from '@/utils/teamColors';
import TeamLogo from '../brand/TeamLogo';
import { POWER_WEIGHTS, type FranchiseRecord, type TeamSummary } from './teamStats';

export type PowerMetric = 'power' | 'titles' | 'hof' | 'legacy' | 'ovr';

const METRICS: { key: PowerMetric; label: string; unit: string }[] = [
  { key: 'power', label: 'Power', unit: 'power score' },
  { key: 'titles', label: 'Titles', unit: 'Super Bowl titles' },
  { key: 'hof', label: 'HOF', unit: 'Hall of Famers' },
  { key: 'legacy', label: 'Legacy', unit: 'combined Career Legacy' },
  { key: 'ovr', label: 'Best OVR', unit: 'best player OVR' },
];

const valueOf = (r: FranchiseRecord | undefined, m: PowerMetric): number => {
  if (!r) return 0;
  switch (m) {
    case 'titles':
      return r.titles;
    case 'hof':
      return r.hof.length;
    case 'legacy':
      return r.legacy;
    case 'ovr':
      return r.bestOvr ?? 0;
    default:
      return r.power;
  }
};

const fmt = (v: number, m: PowerMetric) => (m === 'legacy' && v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString());

const SHOWN = 10;

interface PowerRankingProps {
  teams: TeamSummary[];
  records: Map<string, FranchiseRecord>;
  onOpen: (key: string) => void;
  /** Team key being hovered or focused elsewhere on the page */
  highlight: string | null;
  onHighlight: (key: string | null) => void;
  /** Latest season in the data (Y1–N for the titles metric) */
  lastSeason?: number;
}

/** Franchise power ranking as a team-coloured logo bar chart; every bar is a button that opens the team page. */
const PowerRanking = ({ teams, records, onOpen, highlight, onHighlight, lastSeason }: PowerRankingProps) => {
  const [metric, setMetric] = useState<PowerMetric>('power');
  const [all, setAll] = useState(false);
  const meta = METRICS.find((m) => m.key === metric)!;

  const rows = useMemo(
    () =>
      teams
        .map((t) => ({ t, v: valueOf(records.get(t.key), metric) }))
        .sort((a, b) => b.v - a.v || (records.get(a.t.key)?.powerRank ?? 99) - (records.get(b.t.key)?.powerRank ?? 99)),
    [teams, records, metric],
  );
  const max = Math.max(1, ...rows.map((r) => r.v));
  // Best OVR bars start near the worst value so the differences show
  const floor = metric === 'ovr' ? Math.max(0, Math.min(...rows.filter((r) => r.v > 0).map((r) => r.v)) - 8) : 0;
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <section className="glass-card p-4 sm:p-5 min-w-0" aria-labelledby="power-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-pixel text-[9px] uppercase text-gold">Franchise power ranking</p>
          <h2 id="power-heading" className="font-display text-2xl sm:text-3xl font-extrabold italic uppercase leading-none">
            Who runs the league
          </h2>
        </div>
        <div role="group" aria-label="Rank by" className="flex max-w-full gap-1 overflow-x-auto scrollbar-none rounded-lg bg-secondary/50 p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors',
                metric === m.key ? 'bg-gold text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {metric === 'power'
          ? `Power blends Super Bowl titles (${POWER_WEIGHTS.titles * 100}%), all-time Hall of Famers (${POWER_WEIGHTS.hof * 100}%), combined Career Legacy of everyone who played there (${POWER_WEIGHTS.legacy * 100}%) and the best player's OVR (${POWER_WEIGHTS.ovr * 100}%), each scaled to the top franchise.`
          : `Ranked by ${meta.unit}${metric === 'titles' ? ` (Y1–${lastSeason || 'now'}, any coach)` : metric === 'ovr' ? '' : ', counting everyone who ever played there'}.`}
      </p>

      <ol className="mt-4 space-y-1.5" aria-label={`Franchises by ${meta.unit}`}>
        {shown.map(({ t, v }, i) => {
          const primary = t.team?.primaryColor ?? '226 33% 40%';
          const pct = v <= 0 ? 0 : Math.max(2, ((v - floor) / Math.max(1, max - floor)) * 100);
          const dim = highlight != null && highlight !== t.key;
          return (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => onOpen(t.key)}
                onMouseEnter={() => onHighlight(t.key)}
                onMouseLeave={() => onHighlight(null)}
                onFocus={() => onHighlight(t.key)}
                onBlur={() => onHighlight(null)}
                aria-label={`${i + 1}. ${t.label}: ${fmt(v, metric)} ${meta.unit}. Open team page`}
                className={cn(
                  'group grid w-full grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left transition-opacity hover:bg-secondary/40',
                  dim && 'opacity-40',
                )}
              >
                <span className={cn('font-pixel text-[10px] tabular-nums', i < 3 ? 'text-gold' : 'text-muted-foreground')}>{i + 1}</span>
                <TeamLogo team={t.team ?? t.label} size={28} decorative />
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-bold uppercase leading-tight group-hover:text-gold">
                    {t.team?.name ?? t.label}
                  </span>
                  <span className="mt-1 block h-2.5 rounded-sm bg-secondary/60" aria-hidden="true">
                    <span
                      className="block h-full rounded-sm transition-[width] duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, hsl(${primary}), ${liftForDarkBg(primary, 50)})`,
                        boxShadow: i === 0 ? '0 0 10px hsl(var(--gold) / 0.45)' : undefined,
                      }}
                    />
                  </span>
                </span>
                <span className={cn('min-w-[3ch] text-right font-display text-lg font-extrabold tabular-nums', i === 0 && 'text-gold')}>
                  {fmt(v, metric)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {rows.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className="mt-3 w-full rounded-md border border-border py-1.5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-line hover:text-foreground"
        >
          {all ? 'Show top 10' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
};

export default PowerRanking;
