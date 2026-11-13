import { cn } from '@/lib/utils';

/** The 0-100 Hall of Fame Score as a small gold medal. */
export const ScoreMedal = ({ score, size = 'md', className }: { score: number; size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const dim = size === 'lg' ? 'h-16 w-16 text-3xl' : size === 'sm' ? 'h-8 w-8 text-base' : 'h-10 w-10 text-xl';
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-display font-extrabold italic leading-none tabular-nums text-night', dim, className)}
      style={{
        background: 'radial-gradient(circle at 32% 28%, hsl(45 100% 86%), hsl(43 100% 62%) 45%, hsl(36 90% 40%) 100%)',
        boxShadow: 'inset 0 0 0 2px hsl(36 80% 32% / 0.7), 0 2px 6px hsl(228 60% 3% / 0.6)',
      }}
      aria-label={`Hall of Fame Score ${score} of 100`}
      role="img"
    >
      <span aria-hidden="true">{score}</span>
    </span>
  );
};

/** FIRST BALLOT (gold) / VETERAN (silver) badge. */
export const BallotBadge = ({ firstBallot, veteran, className }: { firstBallot?: boolean; veteran?: boolean; className?: string }) => {
  if (!firstBallot && !veteran) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 font-pixel text-[8px] uppercase leading-none tracking-wide',
        firstBallot ? 'bg-gold text-night' : 'bg-slate-300 text-night',
        className,
      )}
    >
      {firstBallot ? 'First ballot' : 'Veteran'}
    </span>
  );
};

/** A 0-100 score bar with a tick at the bar; gold once it reaches the bar. */
export const ScoreGauge = ({ score, bar, label, className }: { score: number; bar: number; label: string; className?: string }) => {
  const over = score >= bar;
  return (
    <div
      className={cn('relative h-2.5 w-full rounded-full bg-muted', className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={`${score} of 100; the bar is ${bar}`}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: over ? 'linear-gradient(90deg, hsl(36 90% 45%), hsl(43 100% 62%))' : 'hsl(var(--sky) / 0.75)' }}
      />
      <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 rounded bg-chalk" style={{ left: `calc(${bar}% - 1px)` }} />
    </div>
  );
};
