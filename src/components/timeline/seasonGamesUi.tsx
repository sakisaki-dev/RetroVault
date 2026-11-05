import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import TeamLogo from './TeamLogo';
import { teamHsl } from './timelineModel';

/**
 * Shared pieces of the Timeline's "Season games" section (SeasonGames.tsx, SeasonScoreboard.tsx,
 * SeasonByNumbers.tsx): club colours, result chips and the scoreboard-style tiles. Presentation only.
 */

export const NEUTRAL = '220 10% 40%';
/** A club's primary colour as an HSL triplet ("217 100% 23%"), neutral when unknown. */
export const hslOf = (team?: string | null) => teamHsl(team) ?? NEUTRAL;
export const color = (team?: string | null, alpha?: number) =>
  alpha === undefined ? `hsl(${hslOf(team)})` : `hsl(${hslOf(team)} / ${alpha})`;
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
export const signedDec = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n < 0 ? `−${Math.abs(n).toFixed(1)}` : '0.0');
export const rate = (n: number) => n.toFixed(3).replace(/^0/, '');
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const roundLabel = (g: { week?: number; round?: string }) => g.round ?? (g.week ? `Week ${g.week}` : '');
/** Star ratings as stored (4.0, 3.85). */
export const stars = (n: number) => (Math.round(n * 10) === n * 10 ? n.toFixed(1) : String(Math.round(n * 100) / 100));

export type Result = 'W' | 'L' | 'T';
export const isResult = (c: string): c is Result => c === 'W' || c === 'L' || c === 'T';

export const RESULT_BG: Record<Result, string> = {
  W: 'hsl(145 63% 42%)',
  L: 'hsl(357 80% 62%)',
  T: 'hsl(225 20% 55%)',
};
export const RESULT_STYLE: Record<Result, string> = {
  W: 'bg-[hsl(145_63%_42%)] text-[hsl(145_80%_8%)]',
  L: 'bg-[hsl(357_80%_62%)] text-[hsl(357_80%_10%)]',
  T: 'bg-muted text-foreground',
};
export const RESULT_TEXT: Record<Result, string> = {
  W: 'text-[hsl(145_63%_55%)]',
  L: 'text-[hsl(357_80%_70%)]',
  T: 'text-muted-foreground',
};
export const RESULT_WORD: Record<Result, string> = { W: 'Win', L: 'Loss', T: 'Tie' };

export const ResultChip = ({ result, small = false }: { result?: Result; small?: boolean }) =>
  result ? (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded font-display font-bold',
        small ? 'h-5 w-5 text-[11px]' : 'h-7 w-7 text-sm',
        RESULT_STYLE[result],
      )}
      aria-label={RESULT_WORD[result]}
      role="img"
    >
      {result}
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded border border-dashed border-border/60 text-[9px] font-semibold uppercase text-muted-foreground',
        small ? 'h-5 w-5' : 'h-7 w-7',
      )}
      aria-label="Bye"
      role="img"
    >
      –
    </span>
  );

/** Small W/L/T squares, oldest first ("WWLWW"). */
export const FormPips = ({ form, label = 'Form' }: { form?: string; label?: string }) => {
  const chars = [...(form ?? '')].filter(isResult);
  if (!chars.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      role="img"
      aria-label={`${label}, oldest first: ${chars.map((c) => RESULT_WORD[c].toLowerCase()).join(', ')}`}
      className="inline-flex items-center gap-[3px]"
    >
      {chars.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] font-pixel text-[7px] leading-none text-[hsl(228_47%_7%)]"
          style={{ background: RESULT_BG[c] }}
        >
          {c}
        </span>
      ))}
    </span>
  );
};

export const Rating = ({ label, value }: { label: string; value?: number }) =>
  value === undefined ? null : (
    <span className="inline-flex items-center gap-0.5" aria-label={`${label} ${value} of 5 stars`}>
      <span aria-hidden className="text-muted-foreground">
        {label[0]}
      </span>
      <Star aria-hidden className="h-3 w-3 fill-[hsl(45_100%_55%)] text-[hsl(45_100%_55%)]" />
      <span aria-hidden className="tabular-nums">
        {value.toFixed(1)}
      </span>
    </span>
  );

/** The dark scoreboard surface: deep navy, a faint lamp grid, an optional club-colour wash. */
export const BOARD_BG = 'hsl(228 55% 5%)';
export const LampGrid = ({ className }: { className?: string }) => (
  <span
    aria-hidden
    className={cn('pointer-events-none absolute inset-0 opacity-60', className)}
    style={{
      backgroundImage: 'radial-gradient(hsl(0 0% 100% / 0.06) 0.8px, transparent 1.2px)',
      backgroundSize: '4px 4px',
    }}
  />
);

/** Gold "lamp" digits for scoreboard numbers. */
export const lampText = 'text-[hsl(var(--gold))] [text-shadow:0_0_10px_hsl(var(--gold)/0.45)]';

/** A scoreboard tile: pixel kicker, lamp number, muted caption. */
export const BoardTile = ({
  label,
  value,
  sub,
  className,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
  accent?: string;
}) => (
  <div
    className={cn('relative min-w-0 overflow-hidden rounded-lg border border-[hsl(var(--line)/0.7)] px-3 py-2', className)}
    style={{ background: BOARD_BG }}
  >
    <LampGrid />
    {accent && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />}
    <dt className="relative truncate font-pixel text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
    <dd className={cn('relative font-display text-2xl font-bold tabular-nums leading-tight', lampText)}>{value}</dd>
    {sub && <dd className="relative truncate text-[11px] text-muted-foreground">{sub}</dd>}
  </div>
);

/** One side of a broadcast score bar: club-colour wash, logo, name, score. */
export const ScoreSide = ({
  team,
  score,
  won,
  align = 'left',
}: {
  team: string;
  score: number;
  won: boolean | null;
  align?: 'left' | 'right';
}) => (
  <div
    className={cn('flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5', align === 'right' && 'flex-row-reverse text-right')}
    style={{
      background: `linear-gradient(${align === 'left' ? '90deg' : '270deg'}, ${color(team, 0.5)}, ${color(team, 0.08)})`,
    }}
  >
    <TeamLogo team={team} decorative className="h-6 w-6 flex-shrink-0 drop-shadow" />
    <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide', won === false && 'text-foreground/60')}>
      {/* Phones show the abbreviation so the name never clips; the full name is in the sr-only line */}
      <span className="sm:hidden">{findNFLTeam(team)?.abbreviation ?? team}</span>
      <span className="hidden sm:inline">{team}</span>
    </span>
    <span
      className={cn(
        'flex-shrink-0 font-display text-xl font-bold tabular-nums leading-none',
        won === false ? 'text-foreground/60' : won ? lampText : 'text-foreground',
      )}
    >
      {score}
    </span>
  </div>
);
