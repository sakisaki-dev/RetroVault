import { useMemo, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { FINISH_META, fmtPct, seasonRecord, type CoachFacts, type SeasonRow } from '@/utils/frontOffice';
import { ROLLING_WINDOW, type CoachAnalytics } from '@/utils/coachAnalytics';
import type { CoachInfo } from '@/utils/leagueContent';
import { FinishTag } from './SeasonLog';
import { FINISH_ICONS } from './finishIcons';
import { staggerStyle, teamColor, yearSpan } from './shared';

const abbrOf = (team: string) => findNFLTeam(team)?.abbreviation ?? team;
const pct1 = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmtPct(Math.abs(n))}`;

const Group = ({ id, title, note, children, className }: { id: string; title: string; note?: string; children: ReactNode; className?: string }) => (
  <section aria-labelledby={id} className={cn('fo-group', className)}>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h3 id={id} className="fo-group__title">
        {title}
      </h3>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
    {children}
  </section>
);

const DataTable = ({ summary, children }: { summary: string; children: ReactNode }) => (
  <details className="fo-data mt-2">
    <summary className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ChevronDown className="fo-data__chev h-3.5 w-3.5" aria-hidden="true" /> {summary}
    </summary>
    <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border/60">{children}</div>
  </details>
);

// ---------------------------------------------------------------------------
// Win % over time
// ---------------------------------------------------------------------------

const WinPctChart = ({ a }: { a: CoachAnalytics }) => {
  const pts = a.rolling;
  const n = pts.length;
  const first = pts[0].year;
  const vals = pts.map((p) => p.pct).filter((v): v is number => v != null);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.02) * 20) / 20);
  const hi = 1;
  const y = (v: number) => (1 - (v - lo) / (hi - lo)) * 100;
  const line = pts
    .map((p, i) => (p.pct == null ? null : `${i + 0.5},${y(p.pct).toFixed(2)}`))
    .filter(Boolean)
    .join(' ');
  const startI = pts.findIndex((p) => p.pct != null);
  const area = `${startI + 0.5},100 ${line} ${n - 0.5},100`;
  const ticks = [];
  for (let v = Math.ceil(lo * 10) / 10; v <= hi + 1e-9; v += 0.1) ticks.push(Math.round(v * 10) / 10);
  const peak = pts.reduce((m, p) => ((p.pct ?? -1) > (m.pct ?? -1) ? p : m), pts[0]);
  const low = pts.reduce((m, p) => (p.pct != null && p.pct < (m.pct ?? 2) ? p : m), pts[startI]);
  const xLabels = pts.filter((p) => p.year === first || p.year % 20 === 0);

  return (
    <>
      <div
        className="fo-chart"
        role="img"
        aria-label={`Rolling ${ROLLING_WINDOW}-season regular-season win percentage, Y${first} to Y${pts.at(-1)!.year}. Peak ${fmtPct(peak.pct ?? 0)} through Y${peak.year}, low ${fmtPct(low.pct ?? 0)} through Y${low.year}. ${a.titles} title seasons marked.`}
      >
        <div className="fo-chart__axis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ top: `${y(t)}%` }}>
              {fmtPct(t)}
            </span>
          ))}
        </div>
        <div className="fo-chart__plot" aria-hidden="true">
          {a.stints.map(({ stint: s, seasons }) => (
            <div
              key={s.id}
              className="fo-chart__band"
              style={{
                left: `${((s.firstYear - first) / n) * 100}%`,
                width: `${(seasons / n) * 100}%`,
                ['--fo-team' as string]: teamColor(s.team),
              }}
            >
              <span className={cn('fo-chart__logo', seasons < 5 && 'max-sm:hidden', seasons < 3 && 'hidden')}>
                <TeamLogo team={findNFLTeam(s.team) ?? s.team} size={16} decorative />
              </span>
            </div>
          ))}
          {ticks.map((t) => (
            <span key={t} className="fo-chart__grid" style={{ top: `${y(t)}%` }} />
          ))}
          <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="fo-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="hsl(var(--gold))" stopOpacity="0.35" />
                <stop offset="1" stopColor="hsl(var(--gold))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill="url(#fo-area)" />
            <polyline points={line} fill="none" stroke="hsl(var(--gold))" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="fo-chart__rail" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {pts.map((p) => (
            <span key={p.year} className={cn(p.row.kind === 'champions' && 'is-title', p.row.kind === 'missed' && 'is-missed')} />
          ))}
        </div>
        <div className="fo-chart__x" aria-hidden="true">
          {xLabels.map((p) => (
            <span key={p.year} style={{ left: `${((p.year - first + 0.5) / n) * 100}%` }}>
              Y{p.year}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          <span className="fo-key fo-key--line" aria-hidden="true" /> {ROLLING_WINDOW}-season rolling win %
        </span>
        <span>
          <span className="fo-key fo-key--title" aria-hidden="true" /> Title season (▲)
        </span>
        <span>
          <span className="fo-key fo-key--missed" aria-hidden="true" /> Missed playoffs (×)
        </span>
        <span>Shaded bands: each coaching stint, with its logo</span>
      </p>
      <DataTable summary="Show data table">
        <table className="stats-table">
          <caption className="sr-only">Season record and rolling win percentage</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Team</th>
              <th scope="col" className="num">Record</th>
              <th scope="col" className="num">{ROLLING_WINDOW}-yr %</th>
              <th scope="col">Finish</th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p) => (
              <tr key={p.year}>
                <td className="font-display font-bold">Y{p.year}</td>
                <td>{abbrOf(p.row.team)}</td>
                <td className="num font-mono">{seasonRecord(p.row)}</td>
                <td className="num font-mono">{p.pct == null ? '—' : fmtPct(p.pct)}</td>
                <td className="whitespace-nowrap">
                  <FinishTag kind={p.row.kind} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </>
  );
};

// ---------------------------------------------------------------------------
// Stint report card
// ---------------------------------------------------------------------------

const StintReport = ({ a }: { a: CoachAnalytics }) => {
  const ranked = [...a.stints].sort((x, y) => x.rank - y.rank);
  const minPct = Math.min(...ranked.map((r) => r.pct));
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="stats-table fo-report">
        <caption className="sr-only">Coaching stints ranked by regular-season win percentage, graded by percentile among stints</caption>
        <thead>
          <tr>
            <th scope="col" className="num">#</th>
            <th scope="col">Grade</th>
            <th scope="col">Stint</th>
            <th scope="col" className="num">W–L–T</th>
            <th scope="col">Win %</th>
            <th scope="col" className="num">Titles</th>
            <th scope="col" className="num"><abbr title="Titles per season" className="no-underline">Per yr</abbr></th>
            <th scope="col" className="num"><abbr title="Titles / playoff trips" className="no-underline">Conv</abbr></th>
            <th scope="col" className="num"><abbr title="Season of the first title at this stop" className="no-underline">1st title</abbr></th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => {
            const s = r.stint;
            return (
              <tr key={s.id}>
                <td className="num font-mono">{r.rank}</td>
                <td>
                  <span className="fo-grade" style={{ background: r.grade.color }} title={`${Math.round(r.percentile)}th percentile among stints`}>
                    {r.grade.grade}
                  </span>
                </td>
                <td>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <TeamLogo team={findNFLTeam(s.team) ?? s.team} size={18} decorative />
                    <b className="font-display">{abbrOf(s.team)}</b>
                    <span className="text-muted-foreground">{yearSpan(s.firstYear, s.lastYear)}</span>
                  </span>
                </td>
                <td className="num font-mono whitespace-nowrap">{`${r.w}–${r.l}–${r.t}`}</td>
                <td>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{fmtPct(r.pct)}</span>
                    <span className="fo-minibar" aria-hidden="true">
                      <span style={{ width: `${8 + ((r.pct - minPct) / Math.max(0.001, 1 - minPct)) * 92}%`, ['--fo-team' as string]: teamColor(s.team) }} />
                    </span>
                  </span>
                </td>
                <td className="num font-display font-bold text-gold">{r.titles}</td>
                <td className="num font-mono">{r.titlesPerSeason.toFixed(2)}</td>
                <td className="num font-mono whitespace-nowrap">{`${r.titles}/${r.playoffTrips}`}</td>
                <td className="num font-mono">{r.firstTitleIn ? `Yr ${r.firstTitleIn}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Title conversion, rebuild speed, conference split, playoff edge
// ---------------------------------------------------------------------------

const TitleConversion = ({ a }: { a: CoachAnalytics }) => {
  const parts = a.finishes.filter((f) => f.count > 0);
  return (
    <>
      <p className="fo-big">
        {a.titles}
        <span className="text-muted-foreground"> / {a.playoffTrips}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {pct1(a.titles / Math.max(1, a.playoffTrips))} of playoff trips ended with a ring · {a.playoffTrips} trips in {a.seasons} seasons
      </p>
      <div className="fo-stack mt-3" role="img" aria-label={parts.map((p) => `${FINISH_META[p.kind].label} ${p.count}`).join(', ')}>
        {parts.map((p) => (
          <span key={p.kind} className={`fo-stack__seg fo-seg--${p.kind}`} style={{ flexGrow: p.count }} title={`${FINISH_META[p.kind].label}: ${p.count}`}>
            {p.count / a.seasons >= 0.06 ? p.count : ''}
          </span>
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs xl:grid-cols-1" aria-label="Finish distribution">
        {parts.map((p) => {
          const Icon = FINISH_ICONS[p.kind];
          return (
            <li key={p.kind} className="flex min-w-0 items-center gap-1.5">
              <span className={`fo-swatch fo-seg--${p.kind}`} aria-hidden="true" />
              <Icon className={`h-3.5 w-3.5 shrink-0 fo-fin--${p.kind}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{FINISH_META[p.kind].label}</span>
              <b className="font-mono tabular-nums">{p.count}</b>
            </li>
          );
        })}
      </ul>
    </>
  );
};

const RebuildSpeed = ({ a }: { a: CoachAnalytics }) => {
  const max = Math.max(1, ...a.rebuild.map((b) => b.count));
  return (
    <>
      <p className="fo-big">
        {a.yearOneTitles}
        <span className="text-muted-foreground"> / {a.stints.length}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        stops where he won it all in year 1
        {a.avgToFirstTitle != null && ` · avg ${a.avgToFirstTitle.toFixed(1)} seasons to a first title (${a.stintsWithTitle} stops with one)`}
      </p>
      <ul className="mt-3 space-y-1.5" aria-label="Stints by season of first title">
        {a.rebuild.map((b) => (
          <li key={b.bucket} className="grid grid-cols-[4.25rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{b.bucket}</span>
            <span className="fo-minibar fo-minibar--tall" aria-hidden="true">
              <span className={cn(b.bucket === 'Never' && 'is-never')} style={{ width: `${(b.count / max) * 100}%` }} />
            </span>
            <b className="text-right font-mono tabular-nums">{b.count}</b>
          </li>
        ))}
      </ul>
    </>
  );
};

const ConferenceSplit = ({ a }: { a: CoachAnalytics }) => {
  const [afc, nfc] = a.conferences;
  const total = Math.max(1, afc.titles + nfc.titles);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {a.conferences.map((c) => (
          <div key={c.conf} className="rounded-md border border-border/60 bg-black/30 p-2">
            <p className="font-pixel text-[9px] uppercase text-muted-foreground">{c.conf}</p>
            <p className="font-display text-lg leading-tight">{seasonRecord(c)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtPct(c.pct)} · <b className="text-gold">{c.titles}</b> titles · {c.seasons} yrs
            </p>
            <p className="mt-1 flex flex-wrap gap-0.5" aria-label={`${c.conf} teams: ${c.teams.join(', ')}`}>
              {c.teams.map((t) => (
                <TeamLogo key={t} team={findNFLTeam(t) ?? t} size={16} decorative />
              ))}
            </p>
          </div>
        ))}
      </div>
      <div className="fo-stack mt-2" role="img" aria-label={`Titles: AFC ${afc.titles}, NFC ${nfc.titles}`}>
        <span className="fo-stack__seg fo-seg--afc" style={{ flexGrow: afc.titles || 0.001 }}>
          AFC {afc.titles}
        </span>
        <span className="fo-stack__seg fo-seg--nfc" style={{ flexGrow: nfc.titles || 0.001 }}>
          NFC {nfc.titles}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Titles split · AFC {pct1(afc.titles / total)}</p>
    </>
  );
};

const PlayoffEdge = ({ a }: { a: CoachAnalytics }) => {
  if (!a.playoff) return <p className="text-sm text-muted-foreground">Playoff record not captured.</p>;
  const rows = [
    { label: 'Regular season', pct: a.regular.pct, rec: `${a.regular.w}–${a.regular.l}${a.regular.t ? `–${a.regular.t}` : ''}` },
    { label: 'Playoffs', pct: a.playoff.pct, rec: `${a.playoff.w}–${a.playoff.l}` },
  ];
  return (
    <>
      <p className="fo-big">
        {signed(a.clutch ?? 0)}
        <span className="ml-1 text-sm font-semibold uppercase text-muted-foreground">clutch</span>
      </p>
      <p className="text-xs text-muted-foreground">playoff win % minus regular-season win %</p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {r.label}
              <span className="block font-mono text-[10px]">{r.rec}</span>
            </span>
            <span className="fo-minibar fo-minibar--tall" aria-hidden="true">
              <span className={i ? 'is-gold' : undefined} style={{ width: `${r.pct * 100}%` }} />
            </span>
            <b className="text-right font-mono">{fmtPct(r.pct)}</b>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Per title: <b className="text-foreground">{(a.playoff.w / Math.max(1, a.titles)).toFixed(1)}</b> playoff wins,{' '}
        <b className="text-foreground">{(a.playoff.l / Math.max(1, a.titles)).toFixed(2)}</b> losses
      </p>
    </>
  );
};

// ---------------------------------------------------------------------------
// Streak tiles
// ---------------------------------------------------------------------------

const span = (s: { start: number | null; end: number | null }) => (s.start != null && s.end != null ? yearSpan(s.start, s.end) : '—');
const yearsList = (rows: SeasonRow[], n = 3) =>
  rows.length ? rows.slice(0, n).map((r) => `Y${r.year}`).join(', ') + (rows.length > n ? ` +${rows.length - n}` : '') : 'never';

const tiles = (f: CoachFacts, a: CoachAnalytics) => [
  { label: 'Title streak', value: f.titleStreak.length, sub: `${span(f.titleStreak)} · straight` },
  { label: 'Title drought', value: a.drought.length, sub: `${span(a.drought)} · longest without` },
  { label: 'Perfect 17–0', value: f.perfect.length, sub: `${f.perfectChampions.length} won the title` },
  { label: 'Best decade', value: a.bestDecade?.titles ?? '—', sub: a.bestDecade ? `titles · ${yearSpan(a.bestDecade.start, a.bestDecade.end)} · ${fmtPct(a.bestDecade.pct)}` : '' },
  { label: 'Best record', value: f.best ? seasonRecord(f.best) : '—', sub: f.best ? `${f.bestTies.length}× · ${yearsList(f.bestTies, 2)}` : '' },
  { label: 'Worst record', value: f.worst ? seasonRecord(f.worst) : '—', sub: f.worst ? `Y${f.worst.year} · ${abbrOf(f.worst.team)}` : '' },
  { label: 'Playoff streak', value: f.playoffStreak.length, sub: `${span(f.playoffStreak)} · straight trips` },
  { label: 'Winning seasons', value: `${f.winningSeasons}/${f.seasons}`, sub: `${f.fifteenWin} with 15+ wins` },
  { label: 'Unbeaten', value: f.unbeaten.length, sub: 'seasons with no losses' },
  { label: 'Missed playoffs', value: f.missed.length, sub: yearsList(f.missed) },
];

// ---------------------------------------------------------------------------
// Single-game bests rail
// ---------------------------------------------------------------------------

const parseGame = (raw: string) => {
  const m = raw.match(/^([A-Z]{2,3})\s+(\d+)\s*-\s*(\d+)\s+([A-Z]{2,3})(?:\s*\((\d+)\))?$/);
  return m ? { a: m[1], as: Number(m[2]), bs: Number(m[3]), b: m[4], extra: m[5] } : null;
};

interface BestItem {
  key: string;
  label: string;
  raw: string;
  /** Show exactly as the save lists it (no side inference) */
  asListed?: boolean;
  extraUnit?: string;
}

const BestCard = ({ item, coachedAbbrs }: { item: BestItem; coachedAbbrs: Set<string> }) => {
  const g = parseGame(item.raw);
  if (!g) {
    return (
      <li className="fo-best">
        <span className="fo-best__label">{item.label}</span>
        <span className="font-display text-lg">{item.raw}</span>
      </li>
    );
  }
  const aYours = coachedAbbrs.has(g.a);
  const bYours = coachedAbbrs.has(g.b);
  const flip = !item.asListed && bYours && !aYours;
  const known = !item.asListed && aYours !== bYours;
  const [t1, s1, t2, s2] = flip ? [g.b, g.bs, g.a, g.as] : [g.a, g.as, g.b, g.bs];
  const result = known ? (s1 > s2 ? 'W' : s1 < s2 ? 'L' : 'T') : null;
  const side = (abbr: string, pts: number) => (
    <span className="inline-flex items-center gap-1">
      <TeamLogo team={findNFLTeam(abbr) ?? abbr} size={18} decorative />
      <span className="font-pixel text-[9px]">{abbr}</span>
      <span>{pts}</span>
    </span>
  );
  return (
    <li className="fo-best">
      <span className="fo-best__label">{item.label}</span>
      <span className="fo-score flex-wrap">
        {result && (
          <span className={cn('fo-result', result === 'W' ? 'is-w' : 'is-l')} aria-label={result === 'W' ? 'Win' : 'Loss'}>
            {result}
          </span>
        )}
        {side(t1, s1)}
        <span className="text-muted-foreground" aria-hidden="true">
          –
        </span>
        {side(t2, s2)}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {known ? `as ${t1} · ${s1 > s2 ? '+' : '−'}${Math.abs(s1 - s2)}` : 'as the game lists it'}
        {g.extra && ` · ${g.extra} ${item.extraUnit ?? ''}`}
      </span>
    </li>
  );
};

const BestsRail = ({ coach, rows }: { coach: CoachInfo; rows: SeasonRow[] }) => {
  const b = coach.bests ?? {};
  const coachedAbbrs = useMemo(() => new Set(rows.map((r) => r.abbr ?? abbrOf(r.team))), [rows]);
  const candidates: (BestItem | '' | undefined)[] = [
    b.biggestWin && { key: 'win', label: 'Biggest win', raw: b.biggestWin },
    b.biggestLoss && { key: 'loss', label: 'Biggest loss', raw: b.biggestLoss },
    b.mostTDs && { key: 'tds', label: 'Most TDs', raw: b.mostTDs, extraUnit: 'TDs' },
    b.mostPoints && { key: 'pts', label: 'Most points (as listed)', raw: b.mostPoints, asListed: true },
  ];
  const items = candidates.filter((x): x is BestItem => !!x);
  if (!items.length) return null;
  const list = (
    <ul className="space-y-2">
      {items.map((it) => (
        <BestCard key={it.key} item={it} coachedAbbrs={coachedAbbrs} />
      ))}
    </ul>
  );
  return (
    <aside aria-labelledby="fo-bests" className="fo-rail">
      {/* Desktop: always-open sticky rail */}
      <div className="hidden lg:block">
        <h3 id="fo-bests" className="fo-group__title mb-2">
          Single-game bests
        </h3>
        {list}
      </div>
      {/* Mobile: collapsible */}
      <details className="fo-log lg:hidden">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown className="fo-data__chev h-4 w-4" aria-hidden="true" /> Single-game bests
        </summary>
        <div className="border-t border-border/60 p-3">{list}</div>
      </details>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface AdvancedStatsProps {
  analytics: CoachAnalytics;
  facts: CoachFacts;
  coach: CoachInfo;
  rows: SeasonRow[];
}

const AdvancedStats = ({ analytics: a, facts, coach, rows }: AdvancedStatsProps) => (
  <section aria-labelledby="fo-advanced" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h2 id="fo-advanced" className="section-title min-w-0 flex-1 whitespace-nowrap">
        Advanced statistics
      </h2>
      <p className="text-xs text-muted-foreground">
        Computed from {a.seasons} seasons of results and the staff-screen record.
      </p>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="fo-panel fo-adv space-y-5 p-3 sm:p-5">
        <Group id="fo-adv-streaks" title="Streaks & records">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {tiles(facts, a).map((t, i) => (
              <li key={t.label} className="fo-lamp fo-lamp--sm stagger-in" style={staggerStyle(i)}>
                <span className="fo-lamp__label">{t.label}</span>
                <span className="fo-lamp__value">{t.value}</span>
                <span className="fo-lamp__sub">{t.sub}</span>
              </li>
            ))}
          </ul>
        </Group>

        <Group id="fo-adv-trend" title="Win % over time" note={`Trailing ${ROLLING_WINDOW}-season regular-season win %`}>
          <WinPctChart a={a} />
        </Group>

        <Group id="fo-adv-stints" title="Stint report card" note="Ranked by win %; grade = percentile among stints (S–F)">
          <StintReport a={a} />
        </Group>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Group id="fo-adv-conv" title="Title conversion">
            <TitleConversion a={a} />
          </Group>
          <Group id="fo-adv-rebuild" title="Rebuild speed">
            <RebuildSpeed a={a} />
          </Group>
          <Group id="fo-adv-conf" title="AFC vs NFC">
            <ConferenceSplit a={a} />
          </Group>
          <Group id="fo-adv-edge" title="Playoff edge">
            <PlayoffEdge a={a} />
          </Group>
        </div>
      </div>
      <BestsRail coach={coach} rows={rows} />
    </div>
  </section>
);

export default AdvancedStats;
