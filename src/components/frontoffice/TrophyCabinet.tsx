import { useState } from 'react';
import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { FINISH_META, seasonRecord, yourScore, type SeasonRow, type YourGame } from '@/utils/frontOffice';
import { staggerStyle, teamColor, teamVars } from './shared';

/** Shared SVG gradients for every trophy on the page (one copy in the DOM). */
const TrophyDefs = () => (
  <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="fo-silver" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8d96a8" />
        <stop offset="0.28" stopColor="#f4f7fb" />
        <stop offset="0.5" stopColor="#c3cad6" />
        <stop offset="0.78" stopColor="#eef1f6" />
        <stop offset="1" stopColor="#7c8597" />
      </linearGradient>
      <linearGradient id="fo-plinth" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#2a2f3d" />
        <stop offset="1" stopColor="#0b0e16" />
      </linearGradient>
    </defs>
  </svg>
);

/** Original generic championship cup: two-handled bowl, stem, tiered base with a team-color band. */
export const TrophyArt = ({ band }: { band: string }) => (
  <svg viewBox="0 0 36 58" aria-hidden="true" focusable="false">
    {/* handles */}
    <path d="M9 7 H4.5 C4.5 15 7 18.5 11 19.5" fill="none" stroke="url(#fo-silver)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M27 7 H31.5 C31.5 15 29 18.5 25 19.5" fill="none" stroke="url(#fo-silver)" strokeWidth="2.2" strokeLinecap="round" />
    {/* bowl */}
    <path d="M8 3.5 H28 V13 C28 21.5 23.5 26.5 18 26.5 C12.5 26.5 8 21.5 8 13 Z" fill="url(#fo-silver)" />
    <path d="M8 3.5 H28 V5.2 H8 Z" fill="#ffffff" opacity="0.55" />
    {/* emblem: four-point star */}
    <path d="M18 9 L19.3 13.2 L23.5 14.5 L19.3 15.8 L18 20 L16.7 15.8 L12.5 14.5 L16.7 13.2 Z" fill="#9aa3b5" opacity="0.85" />
    {/* shine */}
    <path d="M11 7 C10.6 13 11.5 18 14 22" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.7" strokeLinecap="round" />
    {/* stem + knot */}
    <rect x="16.4" y="26" width="3.2" height="9" fill="url(#fo-silver)" />
    <ellipse cx="18" cy="30" rx="3.4" ry="1.5" fill="url(#fo-silver)" />
    <path d="M12 36.5 C12 34.8 14.5 34 18 34 C21.5 34 24 34.8 24 36.5 Z" fill="url(#fo-silver)" />
    {/* base */}
    <rect x="8" y="37" width="20" height="13" rx="1.5" fill="url(#fo-plinth)" />
    <rect x="8" y="41.5" width="20" height="3" fill={`hsl(${band})`} />
    <rect x="6.5" y="50" width="23" height="4" rx="1" fill="url(#fo-plinth)" stroke="#3a4152" strokeWidth="0.5" />
  </svg>
);

interface Shelf {
  team: string;
  games: YourGame[];
  wins: number;
  losses: number;
}

/** "16–1 regular season · Won Super Bowl" from the season history, when it exists. */
const seasonLine = (r?: SeasonRow) => (r ? `${seasonRecord(r)} regular season · ${FINISH_META[r.kind].label}` : '');

const TrophyCabinet = ({ shelves, seasonByYear }: { shelves: Shelf[]; seasonByYear?: Map<number, SeasonRow> }) => {
  const describe = (g: YourGame) => {
    const line = seasonLine(seasonByYear?.get(g.year));
    return `Super Bowl ${g.roman || ''} · Y${g.year} · ${g.won ? 'beat' : 'lost to'} ${g.opponent ?? 'unknown'} ${yourScore(g)}${line ? ` · ${line}` : ''}`;
  };
  const [active, setActive] = useState<number | null>(null);
  const totalW = shelves.reduce((n, s) => n + s.wins, 0);
  const totalL = shelves.reduce((n, s) => n + s.losses, 0);

  return (
    <section aria-labelledby="fo-cabinet" className="fo-panel fo-cabinet space-y-4 p-4 sm:p-6">
      <TrophyDefs />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="fo-cabinet" className="section-title min-w-0 flex-1">
          Trophy cabinet
        </h2>
        <p className="text-xs text-muted-foreground max-sm:basis-full">
          {totalW} trophies, {totalL} runner-up plaques. Hover, focus or tap one for the game.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shelves.map((s, i) => {
          const team = findNFLTeam(s.team);
          const band = teamColor(s.team);
          const current = s.games.find((g) => g.year === active);
          // Last shelf stretches to fill its row so the grid never leaves an empty cell (2 and 3 columns).
          const last = i === shelves.length - 1;
          const r3 = shelves.length % 3;
          const span = last
            ? cn(shelves.length % 2 === 1 && 'md:col-span-2', r3 === 1 ? 'xl:col-span-3' : r3 === 2 ? 'xl:col-span-2' : 'xl:col-span-1')
            : undefined;
          return (
            <li
              key={s.team}
              className={cn('fo-shelf stagger-in', span)}
              style={{ ...teamVars(s.team), ...staggerStyle(i) }}
            >
              <div className="flex items-center gap-2.5">
                <TeamLogo team={team ?? s.team} size={32} decorative />
                <h3 className="min-w-0 flex-1 truncate font-display text-lg uppercase tracking-tight">{team?.fullName ?? s.team}</h3>
                <span className="lamp">
                  <b>{s.wins}</b>–{s.losses}
                </span>
              </div>
              <ul className="fo-shelf__row" aria-label={`${team?.name ?? s.team} trophies and plaques`}>
                {s.games.map((g) =>
                  g.won ? (
                    <li key={g.year}>
                      <button
                        type="button"
                        className="fo-trophy"
                        aria-pressed={active === g.year}
                        aria-label={`Champions: ${describe(g)}`}
                        onClick={() => setActive((a) => (a === g.year ? null : g.year))}
                      >
                        <TrophyArt band={band} />
                        <span className="fo-trophy__year" aria-hidden="true">
                          Y{g.year}
                        </span>
                        <span className="fo-tip" aria-hidden="true">
                          <b className="block font-display text-sm uppercase text-gold">Super Bowl {g.roman}</b>
                          Y{g.year} · beat {g.opponent} {yourScore(g)}
                          {seasonByYear?.get(g.year) && <span className="mt-0.5 block text-muted-foreground">{seasonLine(seasonByYear.get(g.year))}</span>}
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={g.year}>
                      <button
                        type="button"
                        className="fo-plaque"
                        aria-pressed={active === g.year}
                        aria-label={`Runner-up: ${describe(g)}`}
                        onClick={() => setActive((a) => (a === g.year ? null : g.year))}
                      >
                        <span className="fo-plaque__face" aria-hidden="true">
                          2ND
                          <br />Y{g.year}
                        </span>
                        <span className="fo-trophy__year" aria-hidden="true">
                          {g.roman}
                        </span>
                        <span className="fo-tip" aria-hidden="true">
                          <b className="block font-display text-sm uppercase text-destructive">Runner-up · {g.roman}</b>
                          Y{g.year} · lost to {g.opponent} {yourScore(g)}
                          {seasonByYear?.get(g.year) && <span className="mt-0.5 block text-muted-foreground">{seasonLine(seasonByYear.get(g.year))}</span>}
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
              <p className="min-h-[2rem] pb-2.5 text-xs text-muted-foreground" aria-live="polite">
                {current ? (
                  <span className="text-foreground">
                    <span className={cn('font-semibold', current.won ? 'text-gold' : 'text-destructive')}>
                      {current.won ? 'Champions' : 'Runner-up'}
                    </span>{' '}
                    · {describe(current)}
                  </span>
                ) : (
                  <>
                    {s.wins} {s.wins === 1 ? 'title' : 'titles'}
                    {s.losses ? `, ${s.losses} runner-up` : ''} · Y{s.games[0].year}
                    {s.games.length > 1 ? `–${s.games[s.games.length - 1].year}` : ''}
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default TrophyCabinet;
