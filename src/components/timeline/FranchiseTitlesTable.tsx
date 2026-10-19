import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatYearRuns, getAllChampions, getFranchiseTitles, type SuperBowlEntry } from '@/utils/leagueContent';
import TeamLogo from './TeamLogo';
import { teamHsl } from './timelineModel';

type View = 'yours' | 'league';

const FranchiseTitlesTable = ({ superBowls }: { superBowls: SuperBowlEntry[] }) => {
  const [view, setView] = useState<View>('yours');
  const yours = useMemo(() => getFranchiseTitles(superBowls), [superBowls]);
  const league = useMemo(() => getAllChampions(superBowls), [superBowls]);
  const rows =
    view === 'yours'
      ? yours.map((r) => ({ team: r.team, titles: r.titles, years: r.titleYears, extra: `${r.titles}–${r.losses}` }))
      : league.map((r) => ({ team: r.team, titles: r.titles, years: r.titleYears, extra: r.yours ? `${r.yours} yours` : '' }));
  const max = Math.max(1, ...rows.map((r) => r.titles));
  const totalTitles = yours.reduce((s, r) => s + r.titles, 0);
  const totalLosses = yours.reduce((s, r) => s + r.losses, 0);

  return (
    <section aria-labelledby="franchise-titles-title" className="rounded-xl border border-border/40 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-4">
        <div>
          <h2 id="franchise-titles-title" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
            <Trophy className="h-5 w-5 text-[hsl(45_100%_55%)]" aria-hidden /> Franchise titles
          </h2>
          <p className="text-xs text-muted-foreground">
            {view === 'yours'
              ? `Every ring you won, by the franchise you ran. ${totalTitles}–${totalLosses} overall.`
              : 'Every Super Bowl champion in the save, including the years you missed.'}
          </p>
        </div>
        <div role="group" aria-label="Titles view" className="inline-flex rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold">
          {(['yours', 'league'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'yours' ? 'Your franchises' : 'All champions'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {view === 'yours' ? 'Super Bowl titles by your franchise' : 'Super Bowl titles by champion'}
          </caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-semibold">Franchise</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Titles</th>
              <th scope="col" className="hidden w-1/4 px-2 py-2 font-semibold sm:table-cell">
                <span className="sr-only">Share</span>
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">{view === 'yours' ? 'W–L' : 'Yours'}</th>
              <th scope="col" className="hidden px-4 py-2 font-semibold md:table-cell">Years</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const color = teamHsl(r.team) ?? '220 10% 40%';
              return (
                <tr key={r.team} className="border-t border-border/30 hover:bg-secondary/20">
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    <span className="flex items-center gap-2">
                      <TeamLogo team={r.team} decorative className="h-6 w-6 flex-shrink-0" />
                      <span className="truncate">{r.team}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground md:hidden">{formatYearRuns(r.years)}</span>
                  </th>
                  <td className="px-2 py-2 text-right font-display text-xl font-bold tabular-nums">{r.titles}</td>
                  <td className="hidden px-2 py-2 sm:table-cell" aria-hidden>
                    <div className="h-2 rounded-full bg-secondary/40">
                      <div className="h-2 rounded-full" style={{ width: `${(r.titles / max) * 100}%`, background: `hsl(${color})` }} />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">{r.extra || '—'}</td>
                  <td className="hidden px-4 py-2 text-xs text-muted-foreground md:table-cell">{formatYearRuns(r.years)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default FranchiseTitlesTable;
