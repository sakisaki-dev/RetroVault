import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import type { SuperBowlEntry } from '@/utils/leagueContent';
import { teamKeyFor } from './teamStats';

interface DynastyGridProps {
  superBowls: SuperBowlEntry[];
  /** Team keys that have a team page */
  openable: Set<string>;
  onOpen: (key: string) => void;
  highlight: string | null;
  onHighlight: (key: string | null) => void;
}

/** Every Super Bowl champion, Y1 to the latest season, as a decade-by-decade wall of team-coloured tiles (abbreviation on each). */
const DynastyGrid = ({ superBowls, openable, onOpen, highlight, onHighlight }: DynastyGridProps) => {
  const byYear = useMemo(() => new Map(superBowls.map((sb) => [sb.year, sb])), [superBowls]);
  const yours = superBowls.filter((sb) => sb.yourResult === 'won').length;
  const last = superBowls.reduce((m, sb) => Math.max(m, sb.year), 0);
  const decades = useMemo(() => Array.from({ length: Math.ceil(last / 10) }, (_, i) => i * 10 + 1), [last]);

  return (
    <section className="glass-card p-4 sm:p-5 min-w-0" aria-labelledby="dynasty-heading">
      <p className="font-pixel text-[9px] uppercase text-gold">Dynasty timeline</p>
      <h2 id="dynasty-heading" className="font-display text-2xl sm:text-3xl font-extrabold italic uppercase leading-none">
        {last} years of champions
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Each tile is one Super Bowl winner. A gold star marks the {yours} titles you coached. Select a tile to open that franchise.
      </p>

      <div className="mt-4 space-y-1">
        {decades.map((start) => (
          <div key={start} className="grid grid-cols-[2.6rem_minmax(0,1fr)] items-center gap-1.5">
            <span className="font-pixel text-[8px] uppercase text-muted-foreground tabular-nums">
              Y{start}–{start + 9}
            </span>
            <ol className="grid grid-cols-10 gap-[3px]" aria-label={`Champions Y${start} to Y${start + 9}`}>
              {Array.from({ length: 10 }, (_, j) => start + j).map((year) => {
                const sb = byYear.get(year);
                const team = findNFLTeam(sb?.winner);
                const key = teamKeyFor(sb?.winner);
                const mine = sb?.yourResult === 'won';
                const label = sb?.winner
                  ? `Y${year}: ${team?.fullName ?? sb.winner}${sb.loser ? ` beat the ${sb.loser}` : ''}${sb.score ? ` ${sb.score}` : ''}${mine ? ', your title' : ''}`
                  : `Y${year}: no champion recorded`;
                const bg = team ? `hsl(${team.primaryColor})` : 'hsl(var(--secondary))';
                const fg = team ? getReadableTextOn(team.primaryColor) : 'hsl(var(--muted-foreground))';
                const dim = highlight != null && highlight !== key;
                const cell = (
                  <>
                    <span className="font-pixel text-[7px] sm:text-[8px] leading-none">{team?.abbreviation ?? (sb?.winner ? sb.winner.slice(0, 3).toUpperCase() : '—')}</span>
                    {mine && (
                      <span aria-hidden="true" className="absolute -right-1 -top-1.5 text-[11px] leading-none text-gold drop-shadow-[0_1px_0_#000]">
                        ★
                      </span>
                    )}
                  </>
                );
                const cls = cn(
                  'relative flex h-7 w-full items-center justify-center rounded-[3px] transition-opacity',
                  mine && 'ring-1 ring-gold',
                  dim && 'opacity-25',
                );
                return (
                  <li key={year} className="min-w-0">
                    {key && openable.has(key) ? (
                      <button
                        type="button"
                        title={label}
                        aria-label={`${label}. Open team page`}
                        onClick={() => onOpen(key)}
                        onMouseEnter={() => onHighlight(key)}
                        onMouseLeave={() => onHighlight(null)}
                        onFocus={() => onHighlight(key)}
                        onBlur={() => onHighlight(null)}
                        className={cn(cls, 'hover:brightness-125')}
                        style={{ background: bg, color: fg }}
                      >
                        {cell}
                      </button>
                    ) : (
                      <span role="img" title={label} aria-label={label} className={cls} style={{ background: bg, color: fg }}>
                        {cell}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DynastyGrid;
