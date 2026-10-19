import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import type { Rivalry } from '@/utils/leagueContent';
import { findNFLTeam } from '@/utils/nflTeams';
import { rivalryGames, yourScore, type Nemesis, type Resume, type YourGame } from '@/utils/frontOffice';
import { staggerStyle, teamVars } from './shared';

const GameLine = ({ g }: { g: YourGame }) => (
  <li className="flex items-center gap-2 rounded-md bg-black/40 px-2.5 py-1.5 text-sm">
    <span className={cn('fo-chip', g.won ? 'fo-chip--won' : 'fo-chip--lost')}>{g.won ? 'W' : 'L'}</span>
    <span className="font-display text-base">{g.roman || `Y${g.year}`}</span>
    <span className="text-xs text-muted-foreground">Y{g.year}</span>
    <span className="ml-auto flex min-w-0 items-center gap-1.5">
      <TeamLogo team={g.team} size={20} decorative />
      <span className="truncate text-xs text-muted-foreground">{findNFLTeam(g.team)?.name ?? g.team}</span>
      <span className="font-mono tabular-nums">{yourScore(g)}</span>
    </span>
  </li>
);

const record = (games: YourGame[]) => {
  const w = games.filter((g) => g.won).length;
  return `${w}–${games.length - w}`;
};

interface RivalsPanelProps {
  rivalries: Rivalry[];
  nemeses: Nemesis[];
  resume: Resume;
}

const RivalsPanel = ({ rivalries, nemeses, resume }: RivalsPanelProps) => (
  <section aria-labelledby="fo-rivals" className="space-y-3">
    <h2 id="fo-rivals" className="section-title">
      Rivals
    </h2>
    <div className={cn('grid gap-3', rivalries.length && nemeses.length && 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]')}>
      {rivalries.length > 0 && (
        <div className="flex flex-col gap-3">
          {rivalries.map((r, i) => {
            const games = rivalryGames(r, resume);
            const team = findNFLTeam(r.team);
            return (
              <article
                key={r.id}
                className="fo-panel fo-rival stagger-in flex-1 space-y-3 p-4 sm:p-5"
                style={{ ...teamVars(r.team), ...staggerStyle(i) }}
                aria-labelledby={`fo-rival-${r.id}`}
              >
                <div className="flex items-center gap-3">
                  <TeamLogo team={team ?? r.team} size={56} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Featured rivalry{r.era ? ` · ${r.era}` : ''}
                    </p>
                    <h3 id={`fo-rival-${r.id}`} className="font-display text-2xl uppercase leading-tight">
                      {r.rival}
                      {team && <span className="text-muted-foreground">'s {team.name}</span>}
                    </h3>
                  </div>
                  {games.length > 0 && (
                    <div className="text-right">
                      <p className="fo-vs text-3xl leading-none">{record(games)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your SB record</p>
                    </div>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-foreground/85">{r.summary}</p>
                {games.length > 0 && (
                  <ul className="space-y-1.5" aria-label={`Super Bowl meetings with ${r.rival}`}>
                    {games.map((g) => (
                      <GameLine key={g.year} g={g} />
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
      {nemeses.length > 0 && (
        <div className="fo-panel space-y-3 p-4 sm:p-5">
          <div>
            <h3 className="font-display text-lg uppercase">Teams that beat you</h3>
            <p className="text-xs text-muted-foreground">Every Super Bowl loss, with your full head-to-head against that team.</p>
          </div>
          <ul className="divide-y divide-border/50">
            {nemeses.map((n, i) => {
              const team = findNFLTeam(n.team);
              const lossYears = n.games.filter((g) => !g.won).map((g) => `Y${g.year}`);
              return (
                <li key={n.team} className="stagger-in flex items-center gap-3 py-2.5" style={staggerStyle(i)}>
                  <TeamLogo team={team ?? n.team} size={36} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{team?.fullName ?? n.team}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Beat you in {lossYears.join(', ')}
                      {n.wins ? ` · you won ${n.games.filter((g) => g.won).map((g) => `Y${g.year}`).join(', ')}` : ' · no revenge yet'}
                    </p>
                  </div>
                  <span className={cn('lamp', n.wins > n.losses ? 'text-accent' : n.wins < n.losses ? 'text-destructive' : '')}>
                    <span className="sr-only">Head to head: </span>
                    <b>{n.wins}</b>–{n.losses}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  </section>
);

export default RivalsPanel;
