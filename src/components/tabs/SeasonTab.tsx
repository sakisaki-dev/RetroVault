import { useCallback, useMemo, useState } from 'react';
import { BarChart3, History, Loader2, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { scheduleSeasons, useSchedule } from '@/utils/schedule';
import { SEASON_WEEKS, awardRaces, leaderBoards, liveSeasonView, recordText, scheduleWeeks, seasonEntries, useLiveSchedule, useLiveSeason, type LiveSeason, type SeasonView } from '@/utils/seasonLive';
import { ClubSplits, SeasonScoreboard } from '@/components/season/SeasonScoreboard';
import { NotableGames, NumbersStrip, WeeklyChart } from '@/components/season/SeasonByNumbers';
import { GameLog, GameRecords, LeagueTable, NoScores, SectionTitle } from '@/components/season/SeasonGames';
import { AwardRaces, InjuryReport, Leaders, type PlayerLookup } from '@/components/season/LivePanels';
import { HeadToHeadGrid } from '@/components/season/scheduleParts';
import PlayoffHistory from '@/components/season/PlayoffHistory';
import AroundTheLeague from '@/components/season/AroundTheLeague';
import '@/components/season/season.css';

/**
 * The Season page. Its backbone is the design that lived on the Timeline as "Season games" (scoreboard, club splits,
 * week-by-week log, by the numbers, the league table, notable games, game records), for every season with weekly
 * scores and, fed the same way, for the season in progress from the game's save. The live season adds its own
 * sections between them: the perfect-season watch, the award race, the league leaders and the injury report; the
 * all-time block adds the playoff history and head-to-head. Everything is computed from data.
 */

const keyOf = (p: Pick<Player, 'name' | 'position'>) => `${p.position}:${p.name}`;
const seasonNum = (id: string) => Number(id.replace(/\D/g, ''));

/** The live season's scoreboard kicker and its perfect-season pill (the scoreboard's own pill style). */
const liveStatus = (view: SeasonView) => {
  const l = view.live!;
  const date = l.updated ? ` · ${l.updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
  return `Live from the save · Week ${l.week} of ${l.weeks}${date}`;
};
const perfectWatch = (s: LiveSeason, view: SeasonView) => {
  const club = s.clubs[s.club];
  if (!club || club.l !== 0 || club.t !== 0 || club.w === 0) return undefined;
  const left = view.live!.left;
  return (
    <>
      <Trophy className="h-3 w-3" aria-hidden /> Perfect season watch · {recordText(club)}
      {left > 0 ? ` · ${left} to play` : ''}
    </>
  );
};

const LiveSections = {
  /** Between the game log and the league table: the award race and the leaders */
  Players: ({ s, lookup }: { s: LiveSeason; lookup: PlayerLookup }) => {
    const entries = useMemo(() => seasonEntries(s), [s]);
    const races = useMemo(() => awardRaces(s, entries), [s, entries]);
    const boards = useMemo(() => leaderBoards(entries), [entries]);
    return (
      <>
        <AwardRaces races={races} lookup={lookup} weeksPlayed={Math.max(0, Math.min(s.week, SEASON_WEEKS + 1) - 1)} />
        <Leaders boards={boards} lookup={lookup} />
      </>
    );
  },
  Injuries: ({ s }: { s: LiveSeason }) => {
    const entries = useMemo(() => seasonEntries(s), [s]);
    return <InjuryReport entries={entries} />;
  },
};

const SeasonTab = () => {
  const live = useLiveSeason();
  const liveSched = useLiveSchedule();
  const schedule = useSchedule();
  const { getAllPlayers, dataVersion } = useLeague();
  const players = useMemo(() => {
    const m = new Map<string, Player>();
    getAllPlayers().forEach((p) => m.set(keyOf(p), p));
    return m;
    // dataVersion: a new league load is a new player list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllPlayers, dataVersion]);
  const lookup = useCallback<PlayerLookup>((k) => players.get(k), [players]);

  const past = useMemo(() => (schedule ? scheduleSeasons(schedule) : []), [schedule]);
  const liveId = live ? `Y${live.season}` : null;
  const liveView = useMemo(() => (live ? liveSeasonView(live, liveSched ?? past.find((p) => p.season === `Y${live.season}`)) : null), [live, liveSched, past]);
  const options = useMemo(() => {
    const ids = past.map((p) => p.season).filter((id) => id !== liveId);
    return [...(liveId ? [liveId] : []), ...ids].sort((a, b) => seasonNum(b) - seasonNum(a));
  }, [past, liveId]);
  const [picked, setPicked] = useState<string | null>(null);

  if (live === undefined || liveSched === undefined || !schedule) {
    return (
      <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-24 text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading the season…
      </div>
    );
  }

  const shown = picked && options.includes(picked) ? picked : options[0] ?? null;
  const isLive = !!shown && shown === liveId && !!live && !!liveView;
  const pastSeason = past.find((p) => p.season === shown);
  const season: SeasonView | null = isLive ? liveView : pastSeason ? { ...pastSeason, weeks: scheduleWeeks(pastSeason) } : null;
  const span = past.length ? `${past[past.length - 1].season}–${past[0].season}` : '';

  return (
    <div className="season container mx-auto space-y-4 px-4 py-4 sm:py-6">
      <section aria-labelledby="season-heading" className="space-y-4 rounded-xl border border-border/40 bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 id="season-heading" className="font-display text-lg font-bold uppercase tracking-wide">
              Season <span className="text-muted-foreground">{shown ?? ''}</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {isLive
                ? "The season in progress, read from the game's save: the coached club's scoreboard, the award race, the leaders and the table."
                : "Every score of the season: the coached club's scoreboard, the league by the numbers, the table and the games that stood out."}
            </p>
          </div>
          {options.length > 1 && (
            <div role="group" aria-label="Season" className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold">
              {options.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id === shown}
                  onClick={() => setPicked(id)}
                  className={cn(
                    'inline-flex min-h-[36px] flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    id === shown ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {id === liveId && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[hsl(357_90%_60%)] shadow-[0_0_6px_hsl(357_90%_60%)]" />}
                  {id}
                  {id === liveId && <span className="sr-only"> (live)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {season ? (
          <>
            <SeasonScoreboard season={season} status={isLive ? liveStatus(season) : undefined} badge={isLive ? perfectWatch(live!, season) : undefined} />
            <ClubSplits season={season} />
            <GameLog season={season} />
            <AroundTheLeague season={season} />
            {isLive && <LiveSections.Players s={live!} lookup={lookup} />}
            {season.league && (
              <div className="space-y-2">
                <SectionTitle icon={BarChart3}>{season.season} by the numbers</SectionTitle>
                <NumbersStrip season={season} />
                <WeeklyChart season={season} />
              </div>
            )}
            <LeagueTable season={season} />
            {!isLive && (
              <div className="space-y-2">
                <SectionTitle icon={Trophy}>Notable games</SectionTitle>
                <NotableGames season={season} />
              </div>
            )}
            {isLive && <LiveSections.Injuries s={live!} />}
          </>
        ) : (
          <NoScores season={shown ?? 'This season'} available={options} onSeason={setPicked} />
        )}
      </section>

      {(schedule.records.length > 0 || Object.keys(schedule.headToHead).length > 0 || !!live?.coachHistory?.length) && (
        <section aria-labelledby="alltime-heading" className="space-y-4 rounded-xl border border-border/40 bg-card p-3 sm:p-4">
          <div>
            <h2 id="alltime-heading" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
              <History className="h-5 w-5 text-[hsl(var(--gold))]" aria-hidden /> All-time
            </h2>
            <p className="text-xs text-muted-foreground">The coach's playoff history from the save; game records and head-to-head from every season with weekly scores{span ? ` (${span})` : ''}.</p>
          </div>
          {!!live?.coachHistory?.length && <PlayoffHistory history={live.coachHistory} />}
          <GameRecords records={schedule.records} />
          <HeadToHeadGrid h2h={schedule.headToHead} span={span || undefined} />
        </section>
      )}
    </div>
  );
};

export default SeasonTab;
