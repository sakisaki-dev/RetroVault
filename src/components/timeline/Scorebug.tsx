import { cn } from '@/lib/utils';
import TeamLogo from './TeamLogo';
import type { YearSlot } from './timelineModel';

const RESULT_BADGE: Record<string, { text: string; cls: string }> = {
  won: { text: 'Champions', cls: 'bg-[hsl(45_100%_55%)] text-black' },
  lost: { text: 'Lost', cls: 'bg-destructive text-destructive-foreground' },
  'not in it': { text: 'Not in it', cls: 'bg-secondary text-muted-foreground' },
  'not captured': { text: 'Not captured', cls: 'border border-dashed border-muted-foreground/60 text-muted-foreground' },
};

interface ScorebugProps {
  slot: YearSlot | null;
  eraName?: string;
  season?: string;
}

/** Broadcast-style readout for the hovered / focused Super Bowl. Announced politely to screen readers. */
const Scorebug = ({ slot, eraName, season }: ScorebugProps) => {
  const sb = slot?.sb ?? null;
  const [wScore, lScore] = (sb?.score ?? '').split(/[-–]/).map((s) => s.trim());
  const badge = sb ? RESULT_BADGE[sb.yourResult] ?? RESULT_BADGE['not in it'] : null;
  const yourSide = sb?.yourResult === 'won' ? 'winner' : sb?.yourResult === 'lost' ? 'loser' : null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="flex min-h-[64px] flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2 sm:px-4"
    >
      {!slot ? (
        <p className="text-sm text-muted-foreground">Hover, focus or tap a year to see its Super Bowl.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums">Y{slot.year}</span>
            {sb?.roman && (
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">SB {sb.roman}</span>
            )}
          </div>

          {sb && sb.winner ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:gap-3">
              <TeamSide team={sb.winner} score={wScore} winner highlight={yourSide === 'winner'} />
              <span className="text-muted-foreground/60" aria-hidden>
                def.
              </span>
              <span className="sr-only">defeated</span>
              <TeamSide team={sb.loser} score={lScore} highlight={yourSide === 'loser'} />
            </div>
          ) : (
            <p className="flex-1 text-sm text-muted-foreground">
              {sb ? 'Result not captured in the save.' : `${season === `Y${slot.year}` ? 'Season in progress' : 'No Super Bowl on record'}.`}
            </p>
          )}

          <div className="flex items-center gap-2">
            {badge && (
              <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', badge.cls)}>
                {badge.text}
                {sb?.yourTeam && (sb.yourResult === 'won' || sb.yourResult === 'lost') ? ` · ${sb.yourTeam}` : ''}
              </span>
            )}
            {eraName && <span className="hidden text-xs text-muted-foreground lg:inline">{eraName}</span>}
          </div>
        </>
      )}
    </div>
  );
};

const TeamSide = ({ team, score, winner, highlight }: { team: string | null; score?: string; winner?: boolean; highlight?: boolean }) => (
  <span className={cn('flex min-w-0 items-center gap-1.5', !winner && 'opacity-80')}>
    <TeamLogo team={team} decorative className="h-6 w-6 flex-shrink-0" />
    <span className={cn('truncate', highlight ? 'font-bold text-foreground' : 'text-foreground/85')}>
      {team ?? 'Unknown'}
      {highlight && <span className="sr-only"> (you)</span>}
    </span>
    {score && <span className={cn('font-mono tabular-nums', winner ? 'font-bold' : 'text-muted-foreground')}>{score}</span>}
  </span>
);

export default Scorebug;
