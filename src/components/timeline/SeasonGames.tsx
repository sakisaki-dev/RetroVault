import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BarChart3, Flame, ListOrdered, Shield, Star, Swords, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  scheduleSeasons,
  useSchedule,
  type CoachGame,
  type GameRecord,
  type GameRef,
  type ScheduleSeason,
  type TableRow,
} from '@/utils/schedule';
import TeamLogo from './TeamLogo';
import { teamHsl } from './timelineModel';

/**
 * "Season games" on the Timeline: the coached club's week-by-week log, the league table / power rankings, the
 * season's notable games and the all-time game records. Everything comes from public/data/league/schedule.json
 * (scripts/schedule_content.py); nothing here is hand-written analysis.
 */

const NEUTRAL = '220 10% 40%';
const color = (team?: string | null) => `hsl(${teamHsl(team) ?? NEUTRAL})`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const rate = (n: number) => n.toFixed(3).replace(/^0/, '');
const roundLabel = (g: { week?: number; round?: string }) => g.round ?? (g.week ? `Week ${g.week}` : '');

/** The streak record carries a range the shared GameRecord type doesn't name. */
type StreakRecord = GameRecord & {
  games?: number;
  from?: { season?: string; week?: number; round?: string };
  to?: { season?: string; week?: number; round?: string };
};

const RESULT_STYLE: Record<'W' | 'L' | 'T', string> = {
  W: 'bg-[hsl(145_63%_42%)] text-[hsl(145_80%_8%)]',
  L: 'bg-[hsl(357_80%_62%)] text-[hsl(357_80%_10%)]',
  T: 'bg-muted text-foreground',
};
const RESULT_WORD: Record<'W' | 'L' | 'T', string> = { W: 'Win', L: 'Loss', T: 'Tie' };

const ResultChip = ({ result, small = false }: { result?: 'W' | 'L' | 'T'; small?: boolean }) =>
  result ? (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded font-display font-bold',
        small ? 'h-5 w-5 text-[11px]' : 'h-7 w-7 text-sm',
        RESULT_STYLE[result],
      )}
      aria-label={RESULT_WORD[result]}
      role="img"
    >
      {result}
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded border border-dashed border-border/60 text-[9px] font-semibold uppercase text-muted-foreground',
        small ? 'h-5 w-5' : 'h-7 w-7',
      )}
      aria-label="Bye"
      role="img"
    >
      –
    </span>
  );

const Rating = ({ label, value }: { label: string; value?: number }) =>
  value === undefined ? null : (
    <span className="inline-flex items-center gap-0.5" aria-label={`${label} ${value} of 5 stars`}>
      <span aria-hidden className="text-muted-foreground">
        {label[0]}
      </span>
      <Star aria-hidden className="h-3 w-3 fill-[hsl(45_100%_55%)] text-[hsl(45_100%_55%)]" />
      <span aria-hidden className="tabular-nums">
        {value.toFixed(1)}
      </span>
    </span>
  );

/* ---------------- Game log ---------------- */

const GameRow = ({ g }: { g: CoachGame }) => {
  if (!g.opp) {
    return (
      <li className="flex min-h-[52px] items-center gap-3 rounded-lg border border-dashed border-border/40 px-3 py-2 text-sm text-muted-foreground">
        <span className="w-[4.25rem] flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide">{roundLabel(g)}</span>
        <ResultChip />
        <span>Bye week</span>
      </li>
    );
  }
  return (
    <li
      className={cn(
        'relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 text-sm',
        g.playoff ? 'border-[hsl(45_100%_55%/0.55)] bg-[hsl(45_100%_55%/0.07)]' : 'border-border/40 bg-background/40',
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color(g.opp) }} />
      <span
        className={cn(
          'w-[4.25rem] flex-shrink-0 text-[10px] font-semibold uppercase leading-tight tracking-wide',
          g.playoff ? 'text-[hsl(45_100%_60%)]' : 'text-muted-foreground',
        )}
      >
        {roundLabel(g)}
      </span>
      <ResultChip result={g.result} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="w-4 flex-shrink-0 text-xs text-muted-foreground" aria-label={g.site === 'away' ? 'at' : 'versus'}>
            {g.site === 'away' ? '@' : 'vs'}
          </span>
          <TeamLogo team={g.opp} decorative className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">{g.opp}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          {g.oppRecord && <span className="tabular-nums">{g.oppRecord}</span>}
          <Rating label="Offense" value={g.oppOff} />
          <Rating label="Defense" value={g.oppDef} />
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="font-display text-lg font-bold tabular-nums leading-none">
          {g.for}–{g.against}
        </p>
        {g.margin !== undefined && (
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{signed(g.margin)}</p>
        )}
      </div>
    </li>
  );
};

const GameLog = ({ season }: { season: ScheduleSeason }) => {
  const regular = season.coachGames.filter((g) => !g.playoff);
  const playoffs = season.coachGames.filter((g) => g.playoff);
  const r = season.coachRecord;
  const summary = [
    { label: 'Record', value: r.record },
    { label: 'Pts for', value: r.pf },
    { label: 'Pts against', value: r.pa },
    { label: 'Diff', value: signed(r.diff) },
    { label: 'Playoffs', value: r.playoffs || '—' },
    { label: 'Power rank', value: `#${r.power}` },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <TeamLogo team={season.coachTeam} decorative className="h-10 w-10 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold uppercase leading-tight">
            {season.coachTeam} <span className="text-muted-foreground">{season.season}</span>
          </h3>
          <p className="text-xs text-muted-foreground">The coached club's season, week by week</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {summary.map((s) => (
          <div key={s.label} className="rounded-lg border border-border/40 bg-background/60 px-2.5 py-1.5">
            <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</dt>
            <dd className="font-display text-lg font-bold tabular-nums leading-tight">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* At-a-glance strip */}
      <ol className="flex flex-wrap gap-1" aria-label="Results by week">
        {season.coachGames.map((g) => (
          <li
            key={`${g.week}-${g.round}`}
            title={g.opp ? `${roundLabel(g)}: ${g.result} ${g.for}–${g.against} ${g.site === 'away' ? '@' : 'vs'} ${g.opp}` : `${roundLabel(g)}: bye`}
            className={cn('rounded', g.playoff && 'ring-1 ring-[hsl(45_100%_55%)] ring-offset-1 ring-offset-card')}
          >
            <span className="sr-only">{roundLabel(g)}: </span>
            <ResultChip result={g.result} small />
          </li>
        ))}
      </ol>

      <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" aria-label="Regular season">
        {regular.map((g) => (
          <GameRow key={`${g.week}-${g.round}`} g={g} />
        ))}
      </ol>
      {playoffs.length > 0 && (
        <>
          <h4 className="flex items-center gap-1.5 pt-1 text-xs font-bold uppercase tracking-widest text-[hsl(45_100%_60%)]">
            <Trophy className="h-3.5 w-3.5" aria-hidden /> Playoffs {r.playoffs && <span className="tabular-nums">({r.playoffs})</span>}
          </h4>
          <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" aria-label="Playoffs">
            {playoffs.map((g) => (
              <GameRow key={`${g.week}-${g.round}`} g={g} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

/* ---------------- League table ---------------- */

type TableView = 'power' | 'standings';

const TeamCell = ({ row, coach }: { row: TableRow; coach: boolean }) => (
  <th scope="row" className="px-2 py-1.5 text-left font-medium">
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-5 w-1 flex-shrink-0 rounded-full" style={{ background: color(row.team) }} />
      <TeamLogo team={row.team} decorative className="h-5 w-5 flex-shrink-0" />
      <span className="truncate">{row.team}</span>
      {coach && (
        <span className="rounded bg-primary/25 px-1 text-[9px] font-bold uppercase tracking-wider text-foreground">
          Coached<span className="sr-only"> club</span>
        </span>
      )}
    </span>
  </th>
);

const rowClass = (coach: boolean) => cn('border-t border-border/30', coach ? 'bg-primary/15' : 'hover:bg-secondary/20');
const th = 'px-2 py-2 font-semibold';
const num = 'px-2 py-1.5 text-right tabular-nums';

const PowerTable = ({ season }: { season: ScheduleSeason }) => {
  const rows = useMemo(() => [...season.table].sort((a, b) => a.power - b.power), [season]);
  return (
    <table className="w-full min-w-[520px] text-sm">
      <caption className="sr-only">Power rankings, {season.season}</caption>
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th scope="col" className={cn(th, 'w-8 text-right')}>#</th>
          <th scope="col" className={th}>Club</th>
          <th scope="col" className={cn(th, 'text-right')}>Score</th>
          <th scope="col" className={cn(th, 'text-right')}>W-L-T</th>
          <th scope="col" className={cn(th, 'text-right')}>Diff</th>
          <th scope="col" className={cn(th, 'text-right')}>
            <abbr title="Strength of schedule" className="no-underline">SOS</abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const coach = r.team === season.coachTeam;
          return (
            <tr key={r.abbr} className={rowClass(coach)} aria-current={coach ? 'true' : undefined}>
              <td className={cn(num, 'font-display font-bold')}>{r.power}</td>
              <TeamCell row={r} coach={coach} />
              <td className={cn(num, 'font-semibold')}>{r.powerScore.toFixed(1)}</td>
              <td className={num}>{`${r.w}-${r.l}-${r.t}`}</td>
              <td className={cn(num, r.diff > 0 ? 'text-[hsl(145_63%_52%)]' : r.diff < 0 ? 'text-[hsl(357_80%_68%)]' : '')}>
                {signed(r.diff)}
              </td>
              <td className={cn(num, 'text-muted-foreground')}>{rate(r.sos)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const StandingsTable = ({ season }: { season: ScheduleSeason }) => {
  const divisions = useMemo(() => {
    const map = new Map<string, TableRow[]>();
    for (const r of season.table) {
      const key = r.division ?? r.conference ?? 'League';
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rows]) => ({
        name,
        rows: rows.sort((a, b) => (a.divisionRank ?? 99) - (b.divisionRank ?? 99) || b.pct - a.pct),
      }));
  }, [season]);
  return (
    <table className="w-full min-w-[520px] text-sm">
      <caption className="sr-only">Standings by division, {season.season}</caption>
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th scope="col" className={cn(th, 'w-8 text-right')}>#</th>
          <th scope="col" className={th}>Club</th>
          <th scope="col" className={cn(th, 'text-right')}>W-L-T</th>
          <th scope="col" className={cn(th, 'text-right')}>PF</th>
          <th scope="col" className={cn(th, 'text-right')}>PA</th>
          <th scope="col" className={cn(th, 'text-right')}>Diff</th>
        </tr>
      </thead>
      {divisions.map((d) => (
        <tbody key={d.name}>
          <tr className="border-t border-border/50 bg-secondary/30">
            <th scope="colgroup" colSpan={6} className="px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {d.name}
            </th>
          </tr>
          {d.rows.map((r) => {
            const coach = r.team === season.coachTeam;
            return (
              <tr key={r.abbr} className={rowClass(coach)} aria-current={coach ? 'true' : undefined}>
                <td className={cn(num, 'text-muted-foreground')}>{r.divisionRank ?? '—'}</td>
                <TeamCell row={r} coach={coach} />
                <td className={cn(num, 'font-semibold')}>{`${r.w}-${r.l}-${r.t}`}</td>
                <td className={num}>{r.pf}</td>
                <td className={num}>{r.pa}</td>
                <td className={cn(num, r.diff > 0 ? 'text-[hsl(145_63%_52%)]' : r.diff < 0 ? 'text-[hsl(357_80%_68%)]' : '')}>
                  {signed(r.diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
};

const LeagueTable = ({ season }: { season: ScheduleSeason }) => {
  const [view, setView] = useState<TableView>('power');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <ListOrdered className="h-4 w-4" aria-hidden /> League table
        </h3>
        <div role="group" aria-label="Table view" className="inline-flex rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold">
          {(['power', 'standings'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                'min-h-[36px] rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'power' ? 'Power' : 'Standings'}
            </button>
          ))}
        </div>
      </div>
      {view === 'power' && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Power score = 100 × win % + 1.5 × point differential per game + 40 × (strength of schedule − 0.5), regular season
          only. Strength of schedule is the average final win % of the clubs faced.
        </p>
      )}
      <div className="max-h-[560px] overflow-auto rounded-lg border border-border/40" tabIndex={0} aria-label={`League table, ${view}`}>
        {view === 'power' ? <PowerTable season={season} /> : <StandingsTable season={season} />}
      </div>
    </div>
  );
};

/* ---------------- Season notes ---------------- */

const GameLine = ({ g }: { g: GameRef }) => (
  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
    <TeamLogo team={g.away} decorative className="h-5 w-5" />
    <span className={cn(g.winner === g.away ? 'font-semibold' : 'text-muted-foreground')}>{g.away}</span>
    <span className="font-display font-bold tabular-nums">{g.awayScore}</span>
    <span aria-label="at" className="text-muted-foreground">@</span>
    <TeamLogo team={g.home} decorative className="h-5 w-5" />
    <span className={cn(g.winner === g.home ? 'font-semibold' : 'text-muted-foreground')}>{g.home}</span>
    <span className="font-display font-bold tabular-nums">{g.homeScore}</span>
  </p>
);

const NoteCard = ({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: typeof Flame;
  title: string;
  accent: string;
  children: ReactNode;
}) => (
  <li className="relative overflow-hidden rounded-lg border border-border/40 bg-background/40 p-3">
    <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
    <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
    </h4>
    {children}
  </li>
);

const SeasonNotes = ({ season }: { season: ScheduleSeason }) => {
  const byTeam = useMemo(() => new Map(season.table.map((r) => [r.team, r])), [season]);
  const { upset, blowout, shootout, leaders } = season;
  const leaderRows = [
    { label: 'Best offense', team: leaders?.bestOffense, stat: (r: TableRow) => `${r.ppg.toFixed(1)} pts/game` },
    { label: 'Best defense', team: leaders?.bestDefense, stat: (r: TableRow) => `${r.papg.toFixed(1)} allowed/game` },
    { label: 'Best differential', team: leaders?.bestDiff, stat: (r: TableRow) => `${signed(r.diff)}` },
    { label: 'Leakiest defense', team: leaders?.worstDefense, stat: (r: TableRow) => `${r.papg.toFixed(1)} allowed/game` },
  ].filter((l) => l.team);
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <BarChart3 className="h-4 w-4" aria-hidden /> Season notes
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {upset && (
          <NoteCard icon={Zap} title={`Upset · Week ${upset.week}`} accent={color(upset.winner)}>
            <GameLine g={upset} />
            {upset.winnerRecord && upset.loserRecord && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {upset.winner} ({upset.winnerRecord}) beat {upset.loser} ({upset.loserRecord}) by {upset.margin}
              </p>
            )}
          </NoteCard>
        )}
        {blowout && (
          <NoteCard icon={Swords} title={`Blowout · Week ${blowout.week}`} accent={color(blowout.winner)}>
            <GameLine g={blowout} />
            <p className="mt-1 text-[11px] text-muted-foreground">Won by {blowout.margin}</p>
          </NoteCard>
        )}
        {shootout && (
          <NoteCard icon={Flame} title={`Shootout · Week ${shootout.week}`} accent={color(shootout.winner)}>
            <GameLine g={shootout} />
            <p className="mt-1 text-[11px] text-muted-foreground">{shootout.total} combined points</p>
          </NoteCard>
        )}
        {leaderRows.length > 0 && (
          <NoteCard icon={Shield} title="Leaders" accent="hsl(45 100% 55%)">
            <dl className="space-y-1 text-sm">
              {leaderRows.map((l) => {
                const row = byTeam.get(l.team!);
                return (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <dt className="w-28 flex-shrink-0 text-[11px] text-muted-foreground">{l.label}</dt>
                    <dd className="flex min-w-0 items-center gap-1.5">
                      <TeamLogo team={l.team} decorative className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate font-medium">{l.team}</span>
                      {row && <span className="flex-shrink-0 text-[11px] tabular-nums text-muted-foreground">{l.stat(row)}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </NoteCard>
        )}
      </ul>
    </div>
  );
};

/* ---------------- Game records ---------------- */

const spot = (p?: { season?: string; week?: number; round?: string }) =>
  p ? [p.season, p.round ?? (p.week ? `Week ${p.week}` : '')].filter(Boolean).join(' ') : '';

const GameRecords = ({ records }: { records: GameRecord[] }) => {
  if (!records.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Trophy className="h-4 w-4" aria-hidden /> Game records
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {records.map((rec) => {
          const r = rec as StreakRecord;
          const isGame = r.away && r.home && r.awayScore !== undefined && r.homeScore !== undefined;
          const label = r.id === 'coach-win-streak' ? 'Longest winning streak' : r.label;
          return (
            <li key={r.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="font-display text-3xl font-bold tabular-nums leading-tight text-[hsl(45_100%_60%)]">
                {r.value}
                {r.id === 'coach-win-streak' && <span className="ml-1 text-sm text-muted-foreground">games</span>}
              </p>
              {isGame ? (
                <>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
                    <TeamLogo team={r.away} decorative className="h-4 w-4" />
                    <span>{r.away}</span>
                    <span className="tabular-nums font-semibold">{r.awayScore}</span>
                    <span aria-label="at" className="text-muted-foreground">@</span>
                    <TeamLogo team={r.home} decorative className="h-4 w-4" />
                    <span>{r.home}</span>
                    <span className="tabular-nums font-semibold">{r.homeScore}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{spot(r)}</p>
                </>
              ) : (
                <>
                  {r.team && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs">
                      <TeamLogo team={r.team} decorative className="h-4 w-4" />
                      <span>{r.team}</span>
                    </p>
                  )}
                  {(r.from || r.to) && (
                    <p className="text-[11px] text-muted-foreground">
                      {spot(r.from)}
                      {r.to ? ` to ${spot(r.to)}` : ''}
                    </p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/* ---------------- Section ---------------- */

const SeasonGames = () => {
  const schedule = useSchedule();
  const seasons = useMemo(() => (schedule ? scheduleSeasons(schedule) : []), [schedule]);
  const [picked, setPicked] = useState<string | null>(null);
  // Drop a pick that no longer exists after an update.
  useEffect(() => {
    if (picked && !seasons.some((s) => s.season === picked)) setPicked(null);
  }, [picked, seasons]);

  if (!schedule || !seasons.length) return null;
  const season = seasons.find((s) => s.season === picked) ?? seasons[0];

  return (
    <section aria-labelledby="season-games-heading" className="space-y-5 rounded-xl border border-border/40 bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="season-games-heading" className="font-display text-lg font-bold uppercase tracking-wide">
            Season games
          </h2>
          <p className="text-xs text-muted-foreground">
            Every score of the season: the coached club's log, the league table and the games that stood out.
          </p>
        </div>
        {seasons.length > 1 && (
          <div role="group" aria-label="Season" className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold">
            {seasons.map((s) => (
              <button
                key={s.season}
                type="button"
                aria-pressed={s.season === season.season}
                onClick={() => setPicked(s.season)}
                className={cn(
                  'min-h-[36px] flex-shrink-0 rounded-md px-3 py-1.5 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  s.season === season.season ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.season}
              </button>
            ))}
          </div>
        )}
      </div>

      <GameLog season={season} />
      <LeagueTable season={season} />
      <SeasonNotes season={season} />
      <GameRecords records={schedule.records} />
    </section>
  );
};

export default SeasonGames;
