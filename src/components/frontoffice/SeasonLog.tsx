import { ChevronDown } from 'lucide-react';
import { FINISH_ICONS } from './finishIcons';
import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { FINISH_META, fmtPct, sameTeam, yourScore, type FinishKind, type SeasonRow, type YourGame } from '@/utils/frontOffice';


/** Finish shown as icon + label (never colour alone). */
export const FinishTag = ({ kind, className }: { kind: FinishKind; className?: string }) => {
  const Icon = FINISH_ICONS[kind];
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', `fo-fin--${kind}`, className)}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{FINISH_META[kind].label}</span>
    </span>
  );
};

/** Compact season-by-season table behind a disclosure, closed by default. */
const SeasonLog = ({ rows, games }: { rows: SeasonRow[]; games: YourGame[] }) => {
  const gameByYear = new Map(games.map((g) => [g.year, g]));
  return (
    <details className="fo-log group">
      <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        Season log
        <span className="font-normal">
          · {rows.length} seasons, Y{rows[0].year}–Y{rows.at(-1)!.year}
        </span>
      </summary>
      <div className="max-h-[28rem] overflow-auto border-t border-border/60">
        <table className="stats-table">
          <caption className="sr-only">Season-by-season regular-season record and finish</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Team</th>
              <th scope="col" className="num">W–L–T</th>
              <th scope="col" className="num">Pct</th>
              <th scope="col">Finish</th>
              <th scope="col">Super Bowl</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const g = gameByYear.get(r.year);
              const nfl = findNFLTeam(r.team);
              return (
                <tr key={r.year}>
                  <td className="font-display font-bold">Y{r.year}</td>
                  <td>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <TeamLogo team={nfl ?? r.team} size={18} decorative />
                      {nfl?.fullName ?? r.team}
                    </span>
                  </td>
                  <td className="num font-mono">{`${r.w}–${r.l}–${r.t}`}</td>
                  <td className="num font-mono">{fmtPct(r.pct)}</td>
                  <td className="whitespace-nowrap">
                    <FinishTag kind={r.kind} className="font-semibold" />
                    {r.finish !== FINISH_META[r.kind].label && <span className="ml-1.5 text-[11px] text-muted-foreground">({r.finish})</span>}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {g && sameTeam(g.team, r.team) ? `${g.roman} ${yourScore(g)} ${g.won ? 'W' : 'L'}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default SeasonLog;
