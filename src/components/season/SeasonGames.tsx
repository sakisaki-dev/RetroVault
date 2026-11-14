import { useMemo, useState, type ReactNode } from 'react';
import { CalendarX2, ListOrdered, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameRecord } from '@/utils/schedule';
import type { LogGame, SeasonTableRow, SeasonView } from '@/utils/seasonLive';
import ScoreBar, { ByeBar, WeatherIcons } from './ScoreBar';
import TeamLogo from '@/components/timeline/TeamLogo';
import ClubStrip from '@/components/brand/ClubStrip';
import { useHubRoute } from '@/components/stats/hub/hashRoute';
import { BOARD_BG, FormPips, LampGrid, Rating, RESULT_TEXT, ResultChip, ScoreSide, color, isResult, lampText, rate, roundLabel, signed } from './seasonGamesUi';

/**
 * The Season page's backbone, the design that lived on the Timeline as "Season games": the coached club's
 * week-by-week log, the league table / power rankings and the all-time game records. Past seasons come from
 * public/data/league/schedule.json (scripts/schedule_content.py); the live season from the save, in the same shape
 * (src/utils/seasonLive.ts liveSeasonView), with its upcoming weeks greyed and their weather. Rules only.
 */

type ScheduleSeason = SeasonView;
type TableRow = SeasonTableRow;
type CoachGame = LogGame;

/** The streak record carries a range the shared GameRecord type doesn't name. */
type StreakRecord = GameRecord & {
  games?: number;
  from?: { season?: string; week?: number; round?: string };
  to?: { season?: string; week?: number; round?: string };
};

/** Opens a club's team sheet (Stats › Teams), the club strips' action. */
export const useOpenTeam = () => {
  const { navigate } = useHubRoute();
  return (team: string) => navigate({ tab: 'career', sub: 'teams', p: team });
};

/* ---------------- Game log ---------------- */

/** One coached-club game as the page's score bar: away @ home, the coached club's card rimmed in gold, the result and
 * the opponent's record in the footer; a week to play shows the stadium's weather odds, the next one lit. */
const GameRow = ({ g, coachTeam }: { g: CoachGame; coachTeam: string }) => {
  if (!g.opp) return <ByeBar week={g.week} />;
  const home = g.site === 'home';
  const [away, homeTeam] = home ? [g.opp, coachTeam] : [coachTeam, g.opp];
  const played = g.for !== undefined && g.against !== undefined && !!g.result;
  const [awayScore, homeScore] = played ? (home ? [g.against, g.for] : [g.for, g.against]) : [undefined, undefined];
  const round = roundLabel(g);
  const kicker = g.next ? `${round} · Next up` : played ? `${round} · Final` : `${round} · Upcoming`;
  const aside = played ? (
    <>
      {g.oppRecord && <span className="tabular-nums">{g.opp} {g.oppRecord}</span>}
      <span className="tabular-nums">{signed(g.margin ?? 0)}</span>
      <ResultChip result={g.result} small />
    </>
  ) : (
    <>
      {g.oppRecord && <span className="tabular-nums">{g.opp} {g.oppRecord} now</span>}
      {g.weather && <WeatherIcons w={g.weather} />}
    </>
  );
  return (
    <ScoreBar
      away={away}
      home={homeTeam}
      awayScore={awayScore}
      homeScore={homeScore}
      coach
      upcoming={!played}
      next={g.next}
      playoff={g.playoff}
      kicker={kicker}
      aside={aside}
      srText={
        played
          ? `${round}: ${g.result === 'W' ? 'won' : g.result === 'L' ? 'lost' : 'tied'} ${g.for}–${g.against} ${home ? 'against' : 'at'} ${g.opp}${g.oppRecord ? ` (${g.oppRecord})` : ''}`
          : `${round}: ${home ? 'against' : 'at'} ${g.opp}, ${g.next ? 'next up' : 'upcoming'}`
      }
    />
  );
};

export const GameLog = ({ season }: { season: ScheduleSeason }) => {
  const regular = season.coachGames.filter((g) => !g.playoff);
  const playoffs = season.coachGames.filter((g) => g.playoff);
  const r = season.coachRecord;
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <ListOrdered className="h-4 w-4" aria-hidden /> Week by week
      </h3>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Regular season">
        {regular.map((g) => (
          <GameRow key={`${g.week}-${g.round}`} g={g} coachTeam={season.coachTeam} />
        ))}
      </ol>
      {playoffs.length > 0 && (
        <>
          <h4 className="flex items-center gap-1.5 pt-1 text-xs font-bold uppercase tracking-widest text-[hsl(45_100%_60%)]">
            <Trophy className="h-3.5 w-3.5" aria-hidden /> Playoffs {r.playoffs && <span className="tabular-nums">({r.playoffs})</span>}
          </h4>
          <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Playoffs">
            {playoffs.map((g) => (
              <GameRow key={`${g.week}-${g.round}`} g={g} coachTeam={season.coachTeam} />
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

export const SectionTitle = ({ icon: Icon, children }: { icon: typeof Trophy; children: ReactNode }) => (
  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
    <Icon className="h-4 w-4" aria-hidden /> {children}
  </h3>
);

export const Toggle = <T extends string>({
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

const TeamCell = ({ row, coach }: { row: TableRow; coach: boolean }) => {
  const openTeam = useOpenTeam();
  return (
  <th scope="row" className={cn(stickyCell, 'px-2 py-1.5 text-left font-medium')} style={coach ? coachCellBg : undefined}>
    <span className="flex items-center gap-2">
      <ClubStrip team={row.team} size="sm" className="max-w-[8.5rem] sm:max-w-none" onClick={() => openTeam(row.team)} ariaLabel={`${row.team}: open the team`} />
      {coach && (
        <span className="rounded bg-primary/25 px-1 text-[9px] font-bold uppercase tracking-wider text-foreground">
          Coached<span className="sr-only"> club</span>
        </span>
      )}
    </span>
  </th>
  );
};

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

/** A live 1-10 rating from the save as a number and a short bar. */
const RatingBar = ({ value, label }: { value?: number; label: string }) =>
  value === undefined ? (
    <span className="text-muted-foreground">–</span>
  ) : (
    <span className="inline-flex items-center justify-end gap-1.5" role="img" aria-label={`${label} ${value} of 10`}>
      <span aria-hidden>{value}</span>
      <span aria-hidden className="relative hidden h-1.5 w-8 overflow-hidden rounded-full bg-black/40 sm:inline-block">
        <span className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--gold))]" style={{ width: `${value * 10}%` }} />
      </span>
    </span>
  );

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
  const points = season.table.some((r) => Number.isFinite(r.pf));
  const ratings = season.table.some((r) => r.off !== undefined);
  const form = season.table.some((r) => !!r.last5);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Standings by division, {season.season}</caption>
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th scope="col" className={cn(th, 'w-8 text-right')}>#</th>
          <th scope="col" className={cn(th, 'left-0 z-[3]')}>Club</th>
          <th scope="col" className={cn(th, 'text-right')}>W-L-T</th>
          {points ? (
            <>
              <th scope="col" className={cn(th, 'text-right', st)}>PF</th>
              <th scope="col" className={cn(th, 'text-right', st)}>PA</th>
              <th scope="col" className={cn(th, 'text-right', st)}>Diff</th>
            </>
          ) : (
            <th scope="col" className={cn(th, 'text-right')}>Pct</th>
          )}
          {ratings && (
            <>
              <th scope="col" className={cn(th, 'text-right')}>
                <abbr title="Offense rating in the save, 1 to 10" className="no-underline">Off</abbr>
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                <abbr title="Defense rating in the save, 1 to 10" className="no-underline">Def</abbr>
              </th>
            </>
          )}
          {form && <FormHeads cols={cols} />}
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
                {points ? (
                  <>
                    <td className={cn(num, st)}>{r.pf}</td>
                    <td className={cn(num, st)}>{r.pa}</td>
                    <td className={cn(num, diffInk(r.diff), st)}>{signed(r.diff)}</td>
                  </>
                ) : (
                  <td className={cn(num, 'text-muted-foreground')}>{rate(r.pct)}</td>
                )}
                {ratings && (
                  <>
                    <td className={num}>
                      <RatingBar value={r.off} label="Offense" />
                    </td>
                    <td className={num}>
                      <RatingBar value={r.def} label="Defense" />
                    </td>
                  </>
                )}
                {form && <FormCells r={r} cols={cols} />}
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
};

export const LeagueTable = ({ season }: { season: ScheduleSeason }) => {
  const live = !!season.live && !season.table.some((r) => Number.isFinite(r.powerScore));
  const [pick, setView] = useState<TableView>('power');
  const view: TableView = live ? 'standings' : pick;
  const [cols, setCols] = useState<ColumnSet>('stats');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={ListOrdered}>League table</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          {!live && (
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
          )}
          {!live && (
          <Toggle<TableView>
            label="Table view"
            value={view}
            onChange={setView}
            options={[
              { value: 'power', label: 'Power' },
              { value: 'standings', label: 'Standings' },
            ]}
          />
          )}
        </div>
      </div>
      {live && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Records and offense / defense ratings as they stand in the save, week {season.live?.week} of {season.live?.weeks}. Points, strength of schedule and the power score
          arrive with the season's weekly scores.
        </p>
      )}
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

/** The all-time game records as scoreboard lower-thirds: lamp kicker and figure, the game as a broadcast score bar. */
export const GameRecords = ({ records }: { records: GameRecord[] }) => {
  if (!records.length) return null;
  return (
    <div className="space-y-2">
      <SectionTitle icon={Trophy}>Game records</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {records.map((rec) => {
          const r = rec as StreakRecord;
          const isGame = !!(r.away && r.home && r.awayScore !== undefined && r.homeScore !== undefined);
          const label = r.id === 'coach-win-streak' ? 'Longest winning streak' : r.label;
          const where = isGame ? spot(r) : [spot(r.from), r.to ? `to ${spot(r.to)}` : ''].filter(Boolean).join(' ');
          return (
            <li key={r.id} className="relative overflow-hidden rounded-lg border border-[hsl(var(--line)/0.7)] shadow-[0_6px_18px_hsl(228_60%_2%/0.35)]" style={{ background: BOARD_BG }}>
              <LampGrid />
              <div className="relative flex items-end justify-between gap-2 px-3 pb-1.5 pt-2">
                <div className="min-w-0">
                  <p className="truncate font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className={cn('font-display text-3xl font-bold tabular-nums leading-none', lampText)}>
                    {r.value}
                    {r.id === 'coach-win-streak' && <span className="ml-1 text-sm text-muted-foreground">games</span>}
                  </p>
                </div>
                {where && <span className="flex-shrink-0 text-right font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">{where}</span>}
              </div>
              {isGame ? (
                <>
                  <p className="sr-only">
                    {r.away} {r.awayScore} at {r.home} {r.homeScore}
                  </p>
                  <div className="relative flex items-stretch" aria-hidden>
                    <ScoreSide team={r.away!} score={r.awayScore} won={r.awayScore! > r.homeScore!} />
                    <span className="flex items-center bg-black/60 px-1.5 font-pixel text-[9px] text-muted-foreground">@</span>
                    <ScoreSide team={r.home!} score={r.homeScore} won={r.homeScore! > r.awayScore!} align="right" />
                  </div>
                </>
              ) : (
                r.team && (
                  <div
                    className="relative flex items-center gap-2 px-3 py-1.5"
                    style={{ background: `linear-gradient(90deg, ${color(r.team, 0.5)}, ${color(r.team, 0.08)})` }}
                  >
                    <TeamLogo team={r.team} decorative className="h-6 w-6 flex-shrink-0 drop-shadow" />
                    <span className="truncate text-sm font-semibold uppercase tracking-wide">{r.team}</span>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/* ---------------- Section ---------------- */

export const NoScores = ({ season, available, onSeason }: { season: string; available: string[]; onSeason?: (s: string) => void }) => (
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
