import { useEffect, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoundGame, SeasonView } from '@/utils/seasonLive';
import ScoreBar, { WeatherIcons } from './ScoreBar';
import { SectionTitle } from './SeasonGames';

/**
 * "Around the league": pick a week, see every game as the original lower-third score bar (both clubs' colours and
 * logos). Played weeks show the finals; the live season's weeks still to play show the matchups and the home
 * stadium's weather. From schedule.json's games (past) or the save's league games (live). Rules only.
 */

const GameBar = ({ g, week, coach }: { g: RoundGame; week: number; coach: boolean }) => {
  const played = g.awayScore !== undefined && g.homeScore !== undefined;
  const tie = played && g.awayScore === g.homeScore;
  return (
    <ScoreBar
      away={g.away}
      home={g.home}
      awayScore={g.awayScore}
      homeScore={g.homeScore}
      coach={coach}
      upcoming={!played}
      kicker={`Week ${week} · ${played ? `Final${tie ? ' · Tie' : ''}` : 'To play'}`}
      aside={played ? <span className="tabular-nums">{g.awayScore! + g.homeScore!} combined</span> : g.weather ? <WeatherIcons w={g.weather} /> : null}
      srText={played ? `${g.away} ${g.awayScore} at ${g.home} ${g.homeScore}` : `${g.away} at ${g.home}, to play`}
    />
  );
};

const AroundTheLeague = ({ season }: { season: SeasonView }) => {
  const weeks = season.weeks ?? [];
  const lastPlayed = [...weeks].reverse().find((w) => w.games.some((g) => g.awayScore !== undefined))?.week;
  const [pick, setPick] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const week = weeks.find((w) => w.week === pick) ?? weeks.find((w) => w.week === lastPlayed) ?? weeks[weeks.length - 1];
  // Keep the shown week's pill in view inside the scrolling picker (never scrolls the page)
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && bar.current) bar.current.scrollLeft = el.offsetLeft - bar.current.clientWidth / 2 + el.offsetWidth / 2;
  }, [week?.week]);
  if (!weeks.length || !week) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Globe2}>Around the league</SectionTitle>
        <div ref={bar} role="group" aria-label="Week" className="scrollbar-none relative flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold">
          {weeks.map((w) => {
            const toPlay = !w.games.some((g) => g.awayScore !== undefined);
            return (
              <button
                key={w.week}
                type="button"
                aria-pressed={w.week === week.week}
                aria-label={`Week ${w.week}${toPlay ? ', to play' : ''}`}
                onClick={() => setPick(w.week)}
                className={cn(
                  'min-h-[36px] min-w-[36px] flex-shrink-0 rounded-md px-2 py-1.5 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  w.week === week.week ? 'bg-background text-foreground shadow-sm' : toPlay ? 'text-muted-foreground/60 hover:text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {w.week}
              </button>
            );
          })}
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {week.games.map((g) => (
          <GameBar key={`${g.away}-${g.home}`} g={g} week={week.week} coach={[g.away, g.home].some((t) => t === season.coachTeam || t === season.coachAbbr)} />
        ))}
      </ul>
    </div>
  );
};

export default AroundTheLeague;
