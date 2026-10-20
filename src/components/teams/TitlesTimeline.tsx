import { formatYearRuns } from '@/utils/leagueContent';
import { liftForDarkBg } from '@/utils/teamColors';

interface TitlesTimelineProps {
  teamName: string;
  primary: string;
  titleYears: number[];
  lossYears: number[];
  /** Seasons the owner coached here */
  coachedYears: number[];
  years?: number;
}

/**
 * Y1–80 strip for one franchise: tall gold bars are titles, short outlined bars are Super Bowl losses, and the
 * striped band underneath marks the seasons you coached here. Shapes differ, so colour is never the only cue;
 * the same facts are written out below the strip.
 */
const TitlesTimeline = ({ teamName, primary, titleYears, lossYears, coachedYears, years = 80 }: TitlesTimelineProps) => {
  const won = new Set(titleYears);
  const lost = new Set(lossYears);
  const coached = new Set(coachedYears);
  const band = liftForDarkBg(primary, 48);

  return (
    <figure className="min-w-0">
      <div
        className="relative rounded-lg border border-border bg-secondary/25 px-2 pt-3 pb-1"
        role="img"
        aria-label={`${teamName} Super Bowl timeline, Y1 to Y${years}. ${titleYears.length} titles${lossYears.length ? `, ${lossYears.length} losses` : ''}${coachedYears.length ? `, you coached ${coachedYears.length} seasons here` : ''}. Details listed below.`}
      >
        <div className="flex h-14 items-end gap-px" aria-hidden="true">
          {Array.from({ length: years }, (_, i) => i + 1).map((y) => (
            <span key={y} className="relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`Y${y}${won.has(y) ? ': won the Super Bowl' : lost.has(y) ? ': lost the Super Bowl' : ''}${coached.has(y) ? ' (you coached)' : ''}`}>
              {won.has(y) ? (
                <span className="block h-full rounded-t-[2px] bg-gold shadow-[0_0_6px_hsl(var(--gold)/0.5)]" />
              ) : lost.has(y) ? (
                <span className="block h-1/2 rounded-t-[2px] border border-b-0 border-chalk/70 bg-transparent" />
              ) : (
                <span className="block h-[3px] bg-border/70" />
              )}
            </span>
          ))}
        </div>
        <div className="mt-1 flex h-1.5 gap-px" aria-hidden="true">
          {Array.from({ length: years }, (_, i) => i + 1).map((y) => (
            <span
              key={y}
              className="min-w-0 flex-1"
              style={
                coached.has(y)
                  ? { background: `repeating-linear-gradient(135deg, ${band} 0 3px, transparent 3px 5px)` }
                  : undefined
              }
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-pixel text-[8px] text-muted-foreground" aria-hidden="true">
          {[1, 20, 40, 60, 80].map((y) => (
            <span key={y}>Y{y}</span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 space-y-1 text-xs text-muted-foreground">
        <span className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-2 rounded-t-[2px] bg-gold" /> Title</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-2 rounded-t-[2px] border border-b-0 border-chalk/70" /> Super Bowl loss</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-4" style={{ background: `repeating-linear-gradient(135deg, ${band} 0 3px, transparent 3px 5px)` }} /> You coached
          </span>
        </span>
        <span className="block">
          <b className="text-foreground">Titles:</b> {titleYears.length ? formatYearRuns(titleYears) : 'none yet'}
          {lossYears.length > 0 && (
            <>
              {' · '}
              <b className="text-foreground">Lost:</b> {formatYearRuns(lossYears)}
            </>
          )}
          {coachedYears.length > 0 && (
            <>
              {' · '}
              <b className="text-foreground">You coached:</b> {formatYearRuns(coachedYears)}
            </>
          )}
        </span>
      </figcaption>
    </figure>
  );
};

export default TitlesTimeline;
