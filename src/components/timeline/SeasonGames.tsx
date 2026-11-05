import { useMemo, useState, type ReactNode } from 'react';
import { BarChart3, CalendarX2, ListOrdered, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  scheduleSeasons,
  useSchedule,
  type CoachGame,
  type GameRecord,
  type ScheduleSeason,
  type TableRow,
} from '@/utils/schedule';
import TeamLogo from './TeamLogo';
import { ClubSplits, SeasonScoreboard } from './SeasonScoreboard';
import { NotableGames, NumbersStrip, WeeklyChart } from './SeasonByNumbers';
import { FormPips, Rating, RESULT_TEXT, ResultChip, color, isResult, rate, roundLabel, signed } from './seasonGamesUi';

/**
 * "Season games" on the Timeline: the coached club's week-by-week log, the league table / power rankings, the
 * season's notable games and the all-time game records. Everything comes from public/data/league/schedule.json
 * (scripts/schedule_content.py); nothing here is hand-written analysis.
 */

/** The streak record carries a range the shared GameRecord type doesn't name. */
type StreakRecord = GameRecord & {
  games?: number;
  from?: { season?: string; week?: number; round?: string };
  to?: { season?: string; week?: number; round?: string };
};

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
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <ListOrdered className="h-4 w-4" aria-hidden /> Week by week
      </h3>
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
/** Phones show one column set at a time; wider screens show both. */
type ColumnSet = 'stats' | 'form';

const SectionTitle = ({ icon: Icon, children }: { icon: typeof Trophy; children: ReactNode }) => (
  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
    <Icon className="h-4 w-4" aria-hidden /> {children}
  </h3>
);

const Toggle = <T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) => (
  <div role="group" aria-label={label} className={cn('inline-flex rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold', className)}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        aria-pressed={value === o.value}
        onClick={() => onChange(o.value)}
        className={cn(
          'min-h-[36px] rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** The club column stays put while the table scrolls sideways. */
const stickyCell = 'sticky left-0 z-[1] bg-card';
const coachCellBg = { background: 'linear-gradient(hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.15)), hsl(var(--card))' };

const TeamCell = ({ row, coach }: { row: TableRow; coach: boolean }) => (
  <th scope="row" className={cn(stickyCell, 'px-2 py-1.5 text-left font-medium')} style={coach ? coachCellBg : undefined}>
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-5 w-1 flex-shrink-0 rounded-full" style={{ background: color(row.team) }} />
      <TeamLogo team={row.team} decorative className="h-5 w-5 flex-shrink-0" />
      <span className="max-w-[7.5rem] truncate sm:max-w-none">{row.team}</span>
      {coach && (
        <span className="rounded bg-primary/25 px-1 text-[9px] font-bold uppercase tracking-wider text-foreground">
          Coached<span className="sr-only"> club</span>
        </span>
      )}
    </span>
  </th>
);

const rowClass = (coach: boolean) => cn('border-t border-border/30', coach ? 'bg-primary/15' : 'hover:bg-secondary/20');
const th = 'sticky top-0 z-[2] bg-card px-2 py-2 font-semibold';
const num = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap';
const diffInk = (d: number) => (d > 0 ? 'text-[hsl(145_63%_52%)]' : d < 0 ? 'text-[hsl(357_80%_68%)]' : '');
/** Hide a column set on phones when the other one is picked. */
const only = (set: ColumnSet, cols: ColumnSet) => (set === cols ? '' : 'hidden sm:table-cell');

const FORM_HEADS = [
  { key: 'streak', label: 'Strk', title: 'Streak at season end' },
  { key: 'last5', label: 'Last 5', title: 'Last five games, oldest first' },
  { key: 'home', label: 'Home', title: 'Home record' },
  { key: 'away', label: 'Away', title: 'Away record' },
  { key: 'one', label: '1-score', title: 'Record in games decided by 8 or fewer' },
];
const FormHeads = ({ cols }: { cols: ColumnSet }) => (
  <>
    {FORM_HEADS.map((h) => (
      <th key={h.key} scope="col" className={cn(th, 'text-right', only('form', cols))}>
        <abbr title={h.title} className="no-underline">
          {h.label}
        </abbr>
      </th>
    ))}
  </>
);
const FormCells = ({ r, cols }: { r: TableRow; cols: ColumnSet }) => {
  const c = only('form', cols);
  const s = r.streak ?? '';
  return (
    <>
      <td className={cn(num, 'font-display font-bold', c, isResult(s[0] ?? '') && RESULT_TEXT[s[0] as 'W' | 'L' | 'T'])}>{s || '—'}</td>
      <td className={cn(num, c)}>
        <FormPips form={r.last5} label="Last five" />
      </td>
      <td className={cn(num, c)}>{r.home ?? '—'}</td>
      <td className={cn(num, c)}>{r.away ?? '—'}</td>
      <td className={cn(num, c)}>{r.oneScore ?? '—'}</td>
    </>
  );
};

const PowerTable = ({ season, cols }: { season: ScheduleSeason; cols: ColumnSet }) => {
  const rows = useMemo(() => [...season.table].sort((a, b) => a.power - b.power), [season]);
  const st = only('stats', cols);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Power rankings, {season.season}</caption>
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th scope="col" className={cn(th, 'w-8 text-right')}>#</th>
          <th scope="col" className={cn(th, 'left-0 z-[3]')}>Club</th>
          <th scope="col" className={cn(th, 'text-right', st)}>Score</th>
          <th scope="col" className={cn(th, 'text-right')}>W-L-T</th>
          <th scope="col" className={cn(th, 'text-right', st)}>Diff</th>
          <th scope="col" className={cn(th, 'text-right', st)}>
            <abbr title="Strength of schedule" className="no-underline">SOS</abbr>
          </th>
          <FormHeads cols={cols} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const coach = r.team === season.coachTeam;
          return (
            <tr key={r.abbr} className={rowClass(coach)} aria-current={coach ? 'true' : undefined}>
              <td className={cn(num, 'font-display font-bold')}>{r.power}</td>
              <TeamCell row={r} coach={coach} />
              <td className={cn(num, 'font-semibold', st)}>{r.powerScore.toFixed(1)}</td>
              <td className={num}>{`${r.w}-${r.l}-${r.t}`}</td>
              <td className={cn(num, diffInk(r.diff), st)}>{signed(r.diff)}</td>
              <td className={cn(num, 'text-muted-foreground', st)}>{rate(r.sos)}</td>
              <FormCells r={r} cols={cols} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const StandingsTable = ({ season, cols }: { season: ScheduleSeason; cols: ColumnSet }) => {
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
  const st = only('stats', cols);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Standings by division, {season.season}</caption>
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th scope="col" className={cn(th, 'w-8 text-right')}>#</th>
          <th scope="col" className={cn(th, 'left-0 z-[3]')}>Club</th>
          <th scope="col" className={cn(th, 'text-right')}>W-L-T</th>
          <th scope="col" className={cn(th, 'text-right', st)}>PF</th>
          <th scope="col" className={cn(th, 'text-right', st)}>PA</th>
          <th scope="col" className={cn(th, 'text-right', st)}>Diff</th>
          <FormHeads cols={cols} />
        </tr>
      </thead>
      {divisions.map((d) => (
        <tbody key={d.name}>
          <tr className="border-t border-border/50 bg-secondary/30">
            <th scope="colgroup" colSpan={11} className="px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
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
                <td className={cn(num, st)}>{r.pf}</td>
                <td className={cn(num, st)}>{r.pa}</td>
                <td className={cn(num, diffInk(r.diff), st)}>{signed(r.diff)}</td>
                <FormCells r={r} cols={cols} />
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
  const [cols, setCols] = useState<ColumnSet>('stats');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={ListOrdered}>League table</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle<ColumnSet>
            label="Columns"
            value={cols}
            onChange={setCols}
            className="sm:hidden"
            options={[
              { value: 'stats', label: 'Stats' },
              { value: 'form', label: 'Form & splits' },
            ]}
          />
          <Toggle<TableView>
            label="Table view"
            value={view}
            onChange={setView}
            options={[
              { value: 'power', label: 'Power' },
              { value: 'standings', label: 'Standings' },
            ]}
          />
        </div>
      </div>
      {view === 'power' && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Power score = 100 × win % + 1.5 × point differential per game + 40 × (strength of schedule − 0.5), regular season
          only. Strength of schedule is the average final win % of the clubs faced. Form and splits are regular season;
          one-score games were decided by 8 or fewer.
        </p>
      )}
      <div className="max-h-[560px] overflow-auto rounded-lg border border-border/40" tabIndex={0} aria-label={`League table, ${view}`}>
        {view === 'power' ? <PowerTable season={season} cols={cols} /> : <StandingsTable season={season} cols={cols} />}
      </div>
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

const NoScores = ({ season, available, onSeason }: { season: string; available: string[]; onSeason?: (s: string) => void }) => (
  <div className="relative overflow-hidden rounded-xl border border-dashed border-[hsl(var(--line))] bg-[hsl(228_55%_5%)] p-5 text-center">
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-60"
      style={{ backgroundImage: 'radial-gradient(hsl(0 0% 100% / 0.06) 0.8px, transparent 1.2px)', backgroundSize: '4px 4px' }}
    />
    <div className="relative mx-auto max-w-md space-y-2">
      <CalendarX2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-pixel text-[10px] uppercase tracking-widest text-[hsl(var(--gold))]">{season} · No signal</p>
      <p className="font-display text-xl font-bold uppercase tracking-wide">No weekly scores for {season}</p>
      <p className="text-sm text-muted-foreground">
        Upload that season's LEAGUE schedule screens to see its game log, table and records.
      </p>
      {available.length > 0 && onSeason && (
        <div className="flex flex-wrap justify-center gap-1.5 pt-1" role="group" aria-label="Seasons with weekly scores">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSeason(s)}
              className="min-h-[36px] rounded-md border border-[hsl(var(--gold)/0.5)] px-3 py-1.5 text-xs font-semibold tabular-nums text-[hsl(var(--gold))] transition-colors hover:bg-[hsl(var(--gold)/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See {s}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

interface SeasonGamesProps {
  /** The Timeline's shared season ("Y88"); null or left out = the newest season with weekly scores */
  season?: string | null;
  onSeason?: (season: string) => void;
}

const SeasonGames = ({ season: wanted, onSeason }: SeasonGamesProps) => {
  const schedule = useSchedule();
  const seasons = useMemo(() => (schedule ? scheduleSeasons(schedule) : []), [schedule]);
  const [own, setOwn] = useState<string | null>(null);
  const pickedId = wanted !== undefined ? wanted : own;
  const pick = (s: string) => {
    setOwn(s);
    onSeason?.(s);
  };

  if (!schedule || !seasons.length) return null;
  const season = pickedId ? seasons.find((s) => s.season === pickedId) ?? null : seasons[0];
  const label = season?.season ?? pickedId ?? seasons[0].season;

  return (
    <section aria-labelledby="season-games-heading" className="space-y-5 rounded-xl border border-border/40 bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="season-games-heading" className="font-display text-lg font-bold uppercase tracking-wide">
            Season games <span className="text-muted-foreground">{label}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Every score of the season: the coached club's scoreboard, the league by the numbers, the table and the games
            that stood out.
          </p>
        </div>
        {seasons.length > 1 && (
          <div role="group" aria-label="Season" className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold">
            {seasons.map((s) => (
              <button
                key={s.season}
                type="button"
                aria-pressed={s.season === label}
                onClick={() => pick(s.season)}
                className={cn(
                  'min-h-[36px] flex-shrink-0 rounded-md px-3 py-1.5 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  s.season === label ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.season}
              </button>
            ))}
          </div>
        )}
      </div>

      {season ? (
        <>
          <SeasonScoreboard season={season} />
          <ClubSplits season={season} />
          <GameLog season={season} />
          {season.league && (
            <div className="space-y-2">
              <SectionTitle icon={BarChart3}>{season.season} by the numbers</SectionTitle>
              <NumbersStrip season={season} />
              <WeeklyChart season={season} />
            </div>
          )}
          <LeagueTable season={season} />
          <div className="space-y-2">
            <SectionTitle icon={Trophy}>Notable games</SectionTitle>
            <NotableGames season={season} />
          </div>
        </>
      ) : (
        <NoScores season={label} available={seasons.map((s) => s.season)} onSeason={pick} />
      )}
      <GameRecords records={schedule.records} />
    </section>
  );
};

export default SeasonGames;
