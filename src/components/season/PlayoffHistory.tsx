import { useMemo, useState, type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatYearRuns, useLeagueContent } from '@/utils/leagueContent';
import { playoffStage, playoffsByClub, recordText, type CoachSeason, type PlayoffStage } from '@/utils/seasonLive';
import TeamLogo from '@/components/timeline/TeamLogo';
import { HorizontalTrack } from '@/components/timeline/EraTrack';
import Scorebug from '@/components/timeline/Scorebug';
import { MarkerGlyph } from '@/components/timeline/SuperBowlMarker';
import { buildTimelineModel, teamHsl, type YearSlot } from '@/components/timeline/timelineModel';
import { BoardTile, color } from './seasonGamesUi';
import { findNFLTeam } from '@/utils/nflTeams';
import { teamVars } from '@/components/frontoffice/shared';
import '@/components/frontoffice/frontoffice.css';
import { SectionTitle, Toggle } from './SeasonGames';

/**
 * The coach's playoff history from the save (coachHistory, the game's history.list), drawn with the Timeline's own
 * parts: its stat tiles, the era-band track (bands tinted by the club he ran, EraTrack's HorizontalTrack) with a
 * marker per season for how far the playoffs went, its scorebug for the hovered or tapped season, and the per-club
 * record in the Franchise titles table's style. A compact decade grid is the second view. Rules over the data only.
 */

const BADGE: Record<PlayoffStage, string> = {
  title: 'bg-[hsl(45_100%_55%)] text-black',
  'super-bowl': 'bg-destructive text-destructive-foreground',
  conference: 'bg-[hsl(var(--sky))] text-[hsl(228_47%_7%)]',
  divisional: 'bg-secondary text-foreground',
  first: 'bg-secondary text-muted-foreground',
  missed: 'border border-dashed border-muted-foreground/60 text-muted-foreground',
};

/** A season's marker: the Timeline's glyphs for a title, a lost Super Bowl and a miss; sky rings for the rounds between. */
const StageGlyph = ({ stage, team, active }: { stage: PlayoffStage; team?: string; active?: boolean }) => {
  const grow = cn(active && 'scale-125', 'group-hover:scale-125');
  if (stage === 'title') return <MarkerGlyph kind="won" color={teamHsl(team)} className={grow} />;
  if (stage === 'super-bowl') return <MarkerGlyph kind="lost" className={grow} />;
  if (stage === 'missed') return <MarkerGlyph kind="out" className={grow} />;
  const cls =
    stage === 'conference'
      ? 'h-2.5 w-2.5 border-2 border-[hsl(var(--sky))] bg-[hsl(var(--sky)/0.2)]'
      : stage === 'divisional'
        ? 'h-2 w-2 bg-[hsl(var(--sky)/0.75)]'
        : 'h-1.5 w-1.5 bg-muted-foreground/80';
  return <span aria-hidden className={cn('block rounded-full transition-transform', cls, grow)} />;
};

const LEGEND: { stage: PlayoffStage; label: string }[] = [
  { stage: 'title', label: 'Won it all (club colour)' },
  { stage: 'super-bowl', label: 'Lost the Super Bowl' },
  { stage: 'conference', label: 'Conference final' },
  { stage: 'divisional', label: 'Divisional' },
  { stage: 'first', label: 'First game' },
  { stage: 'missed', label: 'Missed' },
];

/** The decade grid (second view): every season as a tile, gold ★ for a title. */
const DecadeGrid = ({ history }: { history: CoachSeason[] }) => {
  const decades = new Map<number, CoachSeason[]>();
  history.forEach((h) => {
    const d = Math.floor((h.year - 1) / 10);
    decades.set(d, [...(decades.get(d) ?? []), h]);
  });
  return (
    <div className="sz-po__grid">
      {[...decades.entries()].map(([d, rows]) => (
        <div key={d} className="sz-po__row">
          <span className="sz-po__dec">Y{d * 10 + 1}</span>
          <ol className="sz-po__cells" aria-label={`Seasons Y${d * 10 + 1} to Y${d * 10 + 10}`}>
            {rows.map((h) => {
              const st = playoffStage(h);
              const text = `Y${h.year} ${h.team} ${recordText(h)}, playoffs ${h.pw}-${h.pl}: ${st.label}`;
              return (
                <li key={h.year} className={`sz-po__cell is-${st.stage}`} style={{ ['--club' as string]: color(h.team) }} title={text} tabIndex={0}>
                  <span className="sr-only">{text}</span>
                  <span aria-hidden>{st.stage === 'title' ? '★' : h.year % 10 === 0 ? 10 : h.year % 10}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
};

const longestTitleRun = (history: CoachSeason[]) => {
  let best = { n: 0, start: 0, end: 0 };
  let run = { n: 0, start: 0 };
  history.forEach((h) => {
    if (playoffStage(h).stage === 'title') {
      run = run.n ? { n: run.n + 1, start: run.start } : { n: 1, start: h.year };
      if (run.n > best.n) best = { n: run.n, start: run.start, end: h.year };
    } else run = { n: 0, start: 0 };
  });
  return best;
};

const PlayoffHistory = ({ history }: { history: CoachSeason[] }) => {
  const { content } = useLeagueContent();
  const model = useMemo(() => (content ? buildTimelineModel(content) : null), [content]);
  const byYear = useMemo(() => new Map(history.map((h) => [h.year, h])), [history]);
  // Phones open on the decade grid (the era track is wide; it scrolls sideways there, as on the Timeline)
  const [view, setView] = useState<'track' | 'grid'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches ? 'grid' : 'track',
  );
  const [activeYear, setActiveYear] = useState<number | null>(history[history.length - 1]?.year ?? null);
  if (!history.length) return null;

  const clubs = playoffsByClub(history);
  const yearsOf = (team: string) => history.filter((h) => h.team === team).map((h) => h.year);
  const titles = clubs.reduce((t, c) => t + c.titles, 0);
  const pw = clubs.reduce((t, c) => t + c.pw, 0);
  const pl = clubs.reduce((t, c) => t + c.pl, 0);
  const apps = clubs.reduce((t, c) => t + c.appearances, 0);
  const run = longestTitleRun(history);

  const tiles: { label: string; value: ReactNode; sub: string }[] = [
    { label: 'Titles', value: titles, sub: `${history.length} seasons` },
    { label: 'Playoff record', value: `${pw}–${pl}`, sub: `${apps} appearances` },
    { label: 'Longest title streak', value: run.n, sub: run.n ? `Y${run.start}–${run.end}` : '—' },
    { label: 'Clubs coached', value: clubs.length, sub: `${clubs[clubs.length - 1]?.team ?? ''} now` },
  ];

  const marker = (slot: YearSlot) => {
    const h = byYear.get(slot.year);
    if (!h) return { glyph: <MarkerGlyph kind="pending" />, label: `Y${slot.year}: season not complete` };
    const st = playoffStage(h);
    return {
      glyph: <StageGlyph stage={st.stage} team={h.team} active={activeYear === slot.year} />,
      label: `Y${h.year} ${h.team} ${recordText(h)}, playoffs ${h.pw}-${h.pl}: ${st.label}`,
    };
  };
  const activeSlot = model?.years.find((y) => y.year === activeYear) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Trophy}>
          Playoff history · Y{history[0].year}–Y{history[history.length - 1].year}
        </SectionTitle>
        <Toggle<'track' | 'grid'>
          label="Playoff history view"
          value={view}
          onChange={setView}
          options={[
            { value: 'track', label: 'Eras' },
            { value: 'grid', label: 'Decades' },
          ]}
        />
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <BoardTile key={t.label} label={t.label} value={t.value} sub={t.sub} accent="hsl(var(--gold))" />
        ))}
      </dl>

      {view === 'track' && model ? (
        <div className="space-y-2">
          <Scorebug
            slot={activeSlot}
            hint="Hover, focus or tap a season to see how far the playoffs went."
            custom={(slot) => {
              const h = byYear.get(slot.year);
              if (!h) return { middle: <span className="text-muted-foreground">Season in progress</span> };
              const st = playoffStage(h);
              return {
                middle: (
                  <>
                    <TeamLogo team={h.team} decorative className="h-6 w-6 flex-shrink-0" />
                    <span className="truncate font-semibold">{h.team}</span>
                    <span className="whitespace-nowrap font-mono tabular-nums">{recordText(h)}</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      playoffs <span className="font-mono tabular-nums text-foreground">{h.pw}-{h.pl}</span>
                    </span>
                  </>
                ),
                badge: { text: st.label, cls: BADGE[st.stage] },
              };
            }}
          />
          <div data-po-track>
            <HorizontalTrack
              model={model}
              selectedEraId={null}
              activeYear={activeYear}
              detailId="sz-po-track"
              onSelectEra={() => undefined}
              onActiveYear={(y) => y !== null && setActiveYear(y)}
              marker={marker}
            />
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
            {LEGEND.map((l) => (
              <li key={l.stage} className="flex items-center gap-1.5">
                <span className="flex h-3 w-3 items-center justify-center">
                  <StageGlyph stage={l.stage} team="Ravens" />
                </span>
                {l.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <DecadeGrid history={history} />
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Playoff record by club coached">
        {clubs.map((c, i) => {
          const seasons = history.filter((h) => h.team === c.team);
          const nfl = findNFLTeam(c.team);
          return (
            <li
              key={c.team}
              className={cn(
                'fo-shelf stagger-in',
                // The last shelf fills its row, as in the trophy cabinet, so the grid never ends on an empty cell
                i === clubs.length - 1 && clubs.length % 2 === 1 && 'md:col-span-2',
                i === clubs.length - 1 && (clubs.length % 3 === 1 ? 'xl:col-span-3' : clubs.length % 3 === 2 ? 'xl:col-span-2' : 'xl:col-span-1'),
              )}
              style={{ ...teamVars(c.team), ['--i' as string]: i }}
            >
              <div className="flex items-center gap-2.5">
                <TeamLogo team={c.team} decorative className="h-8 w-8 flex-shrink-0" />
                <h4 className="min-w-0 flex-1 truncate font-display text-lg uppercase tracking-tight">{nfl?.fullName ?? c.team}</h4>
                <span className="lamp" title="Playoff record">
                  <b>{c.pw}</b>–{c.pl}
                </span>
              </div>
              {/* Each season's playoff run: a green block per win, red for the game that ended it, a gold star on a title */}
              <ol className="fo-shelf__row !items-end !gap-x-1" aria-label={`${c.team} playoff runs`}>
                {seasons.map((h) => {
                  const st = playoffStage(h);
                  const text = `Y${h.year} ${recordText(h)}, playoffs ${h.pw}-${h.pl}: ${st.label}`;
                  return (
                    <li key={h.year} title={text} tabIndex={0} className="relative z-[1] flex w-5 flex-col items-center gap-[2px] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="sr-only">{text}</span>
                      <span aria-hidden className={cn('h-3 text-[10px] leading-none', st.stage === 'title' ? 'text-[hsl(45_100%_60%)]' : 'text-transparent')}>
                        ★
                      </span>
                      <span aria-hidden className="flex flex-col-reverse gap-[2px]">
                        {Array.from({ length: h.pw }, (_, k) => (
                          <i key={k} className={cn('block h-2 w-4 rounded-[2px]', st.stage === 'title' ? 'bg-[hsl(45_100%_55%)]' : 'bg-[hsl(145_63%_45%)]')} />
                        ))}
                        {h.pl > 0 && <i className="order-first block h-2 w-4 rounded-[2px] bg-[hsl(357_80%_62%)]" />}
                        {h.pw + h.pl === 0 && <i className="block h-2 w-4 rounded-[2px] border border-dashed border-muted-foreground/50" />}
                      </span>
                      <span aria-hidden className="font-pixel text-[7px] leading-none text-muted-foreground">{h.year}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="pb-2.5 text-xs text-muted-foreground">
                {c.titles} {c.titles === 1 ? 'title' : 'titles'} · {c.appearances} of {c.seasons} in the playoffs · {formatYearRuns(yearsOf(c.team))}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PlayoffHistory;
