import type { ReactNode } from 'react';
import { CloudRain, Snowflake, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pctText } from '@/utils/stadiumWeather';
import type { Weather } from '@/utils/seasonLive';
import { BOARD_BG, ScoreSide } from './seasonGamesUi';

/**
 * The Season page's one game card: the notable-games lower-third (SeasonByNumbers) as a score bar, away @ home, both
 * clubs' colours and logos, the winner's score lit, and a pixel footer. Used by Around the league and the coached
 * club's week by week, so every game on the page reads the same.
 */

/** Weather odds as small icons: a roof, else rain and snow chances for that week (stadiumWeather.ts). */
export const WeatherIcons = ({ w }: { w: Weather }) =>
  w.kind === 'roof' ? (
    <span className="inline-flex items-center gap-1" title="Covered stadium">
      <Warehouse className="h-3 w-3" aria-hidden /> Roof
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 tabular-nums" title="Chance of rain and snow at the home stadium, by the game's own rule">
      <span className="inline-flex items-center gap-0.5">
        <CloudRain className="h-3 w-3" aria-hidden />
        <span className="sr-only">Rain</span>
        {pctText(w.rain)}
      </span>
      {w.snow > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <Snowflake className="h-3 w-3" aria-hidden />
          <span className="sr-only">Snow</span>
          {pctText(w.snow)}
        </span>
      )}
    </span>
  );

interface ScoreBarProps {
  away: string;
  home: string;
  awayScore?: number;
  homeScore?: number;
  /** The coached club plays in it: a gold rim */
  coach?: boolean;
  /** Not played yet (dimmed unless `next`) */
  upcoming?: boolean;
  next?: boolean;
  playoff?: boolean;
  /** Footer, left: pixel kicker ("Week 15 · Final") */
  kicker: ReactNode;
  /** Footer, right */
  aside?: ReactNode;
  srText: string;
}

const ScoreBar = ({ away, home, awayScore, homeScore, coach, upcoming, next, playoff, kicker, aside, srText }: ScoreBarProps) => {
  const played = awayScore !== undefined && homeScore !== undefined;
  const tie = played && awayScore === homeScore;
  return (
    <li
      className={cn(
        'overflow-hidden rounded-lg border shadow-[0_6px_18px_hsl(228_60%_2%/0.35)]',
        next || playoff ? 'border-[hsl(var(--gold)/0.75)]' : coach ? 'border-[hsl(var(--gold)/0.45)]' : 'border-[hsl(var(--line)/0.7)]',
        next && 'shadow-[0_0_16px_hsl(var(--gold)/0.22)]',
        upcoming && !next && 'opacity-60',
      )}
      style={{ background: BOARD_BG }}
    >
      <p className="sr-only">{srText}</p>
      <div className="flex items-stretch" aria-hidden>
        <ScoreSide team={away} score={awayScore} won={!played || tie ? null : awayScore! > homeScore!} />
        <span className="flex items-center bg-black/60 px-1.5 font-pixel text-[9px] text-muted-foreground">@</span>
        <ScoreSide team={home} score={homeScore} won={!played || tie ? null : homeScore! > awayScore!} align="right" />
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 text-[11px] text-muted-foreground" aria-hidden>
        <span className={cn('font-pixel text-[9px] uppercase tracking-widest', (next || playoff) && 'text-[hsl(var(--gold))]')}>{kicker}</span>
        {aside && <span className="flex items-center gap-2">{aside}</span>}
      </div>
    </li>
  );
};

/** A slim muted bar for the coached club's bye week. */
export const ByeBar = ({ week }: { week: number }) => (
  <li className="flex min-h-[34px] items-center justify-between rounded-lg border border-dashed border-border/40 px-2.5 text-muted-foreground">
    <span className="font-pixel text-[9px] uppercase tracking-widest">Week {week}</span>
    <span className="text-[11px]">Bye week</span>
  </li>
);

export default ScoreBar;
