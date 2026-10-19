import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import TeamLogo from '@/components/brand/TeamLogo';
import { isHallOfFamer } from '@/config/stats';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { FEATURED_PER_STINT, yourScore, type Stint } from '@/utils/frontOffice';
import { staggerStyle, teamVars, yearSpan } from './shared';

interface FranchiseHistoryProps {
  stints: Stint[];
  onPlayerSelect: (p: Player) => void;
  numberFor: (p: Player) => number | null | undefined;
}


const FranchiseHistory = ({ stints, onPlayerSelect, numberFor }: FranchiseHistoryProps) => {

  return (
    <section aria-labelledby="fo-history" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="fo-history" className="section-title min-w-0 flex-1">
          Franchise history
        </h2>
        <p className="text-xs text-muted-foreground">
          {stints.length} stints in order. Years span each stint's Super Bowl seasons.
        </p>
      </div>
      <ol className="space-y-2.5">
        {stints.map((s, i) => {
          const team = findNFLTeam(s.team);
          const record = `${s.wins}–${s.losses}`;
          const players = s.keyPlayers.slice(0, FEATURED_PER_STINT);
          const more = s.keyPlayers.length - players.length;
          return (
            <li key={s.id} className="fo-stint stagger-in" style={{ ...teamVars(s.team), ...staggerStyle(i) }}>
              <div className="flex min-w-0 items-center gap-3">
                <TeamLogo team={team ?? s.team} size={48} decorative />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span>{s.current ? `Y${s.firstYear}–now` : yearSpan(s.firstYear, s.lastYear)}</span>
                    {s.current && <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">Current club</span>}
                  </p>
                  <h3 className="truncate font-display text-xl uppercase tracking-tight text-foreground">{team?.fullName ?? s.team}</h3>
                  <p className="truncate text-xs text-muted-foreground">{s.eras.map((e) => e.name).join(' · ') || 'Era not recorded'}</p>
                </div>
              </div>

              <div className="min-w-0 space-y-1.5">
                <p className="text-sm">
                  <span className="font-display text-lg text-foreground">{record}</span>{' '}
                  <span className="text-muted-foreground">
                    in Super Bowls · {s.wins} {s.wins === 1 ? 'title' : 'titles'}
                  </span>
                </p>
                <ul className="flex flex-wrap gap-1" aria-label={`${team?.name ?? s.team} Super Bowls`}>
                  {s.games.map((g) => (
                    <li
                      key={g.year}
                      className={cn('fo-chip', g.won ? 'fo-chip--won' : 'fo-chip--lost')}
                      title={`Super Bowl ${g.roman}, Y${g.year}: ${g.won ? 'beat' : 'lost to'} ${g.opponent ?? 'unknown'} ${yourScore(g)}`}
                    >
                      <span aria-hidden="true">{g.won ? 'W' : 'L'}</span>
                      <span>Y{g.year}</span>
                      <span className="sr-only">
                        {g.won ? 'won' : 'lost'} Super Bowl {g.roman} {g.won ? 'over' : 'to'} {g.opponent ?? 'unknown'}, {yourScore(g)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                {players.length ? (
                  <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Key players">
                    {players.map((k) =>
                      k.player ? (
                        <li key={k.raw}>
                          <button
                            type="button"
                            onClick={() => onPlayerSelect(k.player!)}
                            className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`${k.player.name}, ${k.player.position}. Open player card`}
                          >
                            <ProPlayerBanner
                              size="compact"
                              name={k.player.name}
                              position={k.player.position}
                              team={k.player.team}
                              number={numberFor(k.player) ?? null}
                              hallOfFamer={isHallOfFamer(k.player)}
                              interactive
                            />
                          </button>
                        </li>
                      ) : (
                        <li key={k.raw} className="truncate rounded-lg border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
                          {k.display}
                        </li>
                      ),
                    )}
                    {more > 0 && (
                      <li className="text-[11px] text-muted-foreground sm:col-span-2">
                        +{more} more from {s.eras.length === 1 ? 'this era' : 'these eras'}:{' '}
                        {s.keyPlayers
                          .slice(FEATURED_PER_STINT, FEATURED_PER_STINT + 3)
                          .map((k) => k.player?.name ?? k.display)
                          .join(', ')}
                        {more > 3 ? '…' : ''}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No key players recorded for this stint.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default FranchiseHistory;
