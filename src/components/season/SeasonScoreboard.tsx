import { Crown, Home, Plane, Scale, Star, Swords, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { CoachGame, CoachGameBrief, ScheduleSeason } from '@/utils/schedule';
import TeamLogo from '@/components/timeline/TeamLogo';
import {
  BOARD_BG,
  BoardTile,
  LampGrid,
  RESULT_BG,
  RESULT_WORD,
  color,
  isResult,
  lampText,
  roundLabel,
  signed,
  signedDec,
  stars,
} from './seasonGamesUi';

/**
 * The coached club's season as a stadium scoreboard: W / L / T lamps, the season line, a results ribbon from
 * coachDetail.results, and the club's splits. Numbers straight from schedule.json.
 */

const SHORT_ROUND: Record<string, string> = { Wildcard: 'WC', 'Wild Card': 'WC', Divisional: 'DV', Conference: 'CF', 'Super Bowl': 'SB' };
const shortRound = (g: CoachGame) => (g.playoff ? SHORT_ROUND[g.round] ?? g.round.slice(0, 2).toUpperCase() : String(g.week));

const Lamp = ({ label, value }: { label: string; value: number }) => (
  <div className="flex min-w-[3.5rem] flex-col items-center rounded-md border border-[hsl(var(--line)/0.8)] bg-black/50 px-2 pb-1 pt-1.5 sm:min-w-[4.5rem]">
    <span className="font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
    <span className={cn('font-pixel text-3xl leading-none tabular-nums sm:text-4xl', lampText)}>{value}</span>
  </div>
);

/* ---------------- Results ribbon ---------------- */

const ResultsRibbon = ({ season }: { season: ScheduleSeason }) => {
  const played = season.coachGames.filter((g) => g.result);
  const results = season.coachDetail?.results ?? played.map((g) => g.result).join('');
  const cells = [...results].filter(isResult).map((r, i) => ({ r, g: played[i] as CoachGame | undefined }));
  if (!cells.length) return null;
  const firstPlayoff = cells.findIndex((c) => c.g?.playoff);
  // A season in progress: its weeks still to play, hollow
  const ahead = season.coachGames.filter((g) => !g.result && g.opp);
  return (
    <div className="relative">
      <p className="mb-1 font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">Results ribbon</p>
      <ol className="flex items-end gap-[3px]" aria-label={`Results in order, ${cells.length} games`}>
        {cells.map(({ r, g }, i) => {
          const label = g ? `${roundLabel(g)}: ${RESULT_WORD[r]} ${g.for}–${g.against} ${g.site === 'away' ? 'at' : 'versus'} ${g.opp}` : `Game ${i + 1}: ${RESULT_WORD[r]}`;
          return (
            <li
              key={i}
              title={label}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-1 [animation-fill-mode:both] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300',
                i === firstPlayoff && i > 0 && 'ml-1.5 border-l border-[hsl(var(--gold)/0.6)] pl-1.5',
              )}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="sr-only">{label}</span>
              <span
                aria-hidden
                className={cn(
                  'flex h-7 w-full items-center justify-center rounded-[3px] font-pixel text-[9px] text-[hsl(228_47%_7%)]',
                  g?.playoff && 'ring-1 ring-[hsl(var(--gold))] ring-offset-1 ring-offset-black',
                  r === 'W' && 'h-8',
                )}
                style={{ background: RESULT_BG[r] }}
              >
                <span className="hidden sm:inline">{r}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'max-w-full overflow-hidden font-pixel text-[7px] leading-none sm:text-[8px]',
                  g?.playoff ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground',
                )}
              >
                {g ? shortRound(g) : i + 1}
              </span>
            </li>
          );
        })}
        {ahead.map((g) => (
          <li key={`up-${g.week}`} title={`${roundLabel(g)}: ${g.site === 'away' ? 'at' : 'versus'} ${g.opp}, to play`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="sr-only">{`${roundLabel(g)}: ${g.site === 'away' ? 'at' : 'versus'} ${g.opp}, to play`}</span>
            <span aria-hidden className="flex h-7 w-full rounded-[3px] border border-dashed border-[hsl(var(--gold)/0.55)] bg-black/30" />
            <span aria-hidden className="max-w-full overflow-hidden font-pixel text-[7px] leading-none text-muted-foreground sm:text-[8px]">
              {g.week}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/* ---------------- Scoreboard ---------------- */

/** `status` replaces "Final" for a season in progress ("Live · Week 16 of 18"); `badge` adds a pill beside the champions one. */
export const SeasonScoreboard = ({ season, status, badge }: { season: ScheduleSeason; status?: string; badge?: ReactNode }) => {
  const r = season.coachRecord;
  const d = season.coachDetail;
  const playoffGames = season.coachGames.filter((g) => g.playoff && g.result);
  const finale = playoffGames[playoffGames.length - 1];
  const champions = finale?.round === 'Super Bowl' && finale.result === 'W';
  const lamps = [
    { label: 'Pts for', value: r.pf },
    { label: 'Pts against', value: r.pa },
    { label: 'Diff', value: signed(r.diff) },
    ...(status ? [] : [{ label: 'Playoffs', value: r.playoffs || '—' }]),
    ...(Number.isFinite(r.power) ? [{ label: 'Power rank', value: `#${r.power}` }] : []),
    ...(d ? [{ label: 'Win streak', value: d.longestWinStreak ?? '—' }] : []),
  ];
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[hsl(var(--line))] shadow-[0_8px_24px_hsl(228_60%_2%/0.45)]"
      style={{ background: `linear-gradient(120deg, ${color(season.coachTeam, 0.45)}, ${color(season.coachTeam, 0.08)} 45%, transparent 70%), ${BOARD_BG}` }}
    >
      <LampGrid />
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color(season.coachTeam)}, hsl(var(--gold)))` }} />
      <div className="relative space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo team={season.coachTeam} decorative className="h-12 w-12 flex-shrink-0 drop-shadow-lg sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <p className="font-pixel text-[9px] uppercase tracking-widest text-[hsl(var(--gold))]">
                {season.season} · {status ?? 'Final'}{champions ? ' · Champions' : ''}
              </p>
              <h3 className="truncate font-display text-2xl font-bold uppercase leading-tight tracking-wide sm:text-3xl">
                {season.coachTeam}
              </h3>
              <p className="text-xs text-muted-foreground">The coached club's season, week by week</p>
            </div>
          </div>
          <div className="flex items-stretch gap-1.5" role="group" aria-label={`Record ${r.record}`}>
            <Lamp label="Won" value={r.w} />
            <Lamp label="Lost" value={r.l} />
            <Lamp label="Tied" value={r.t} />
          </div>
        </div>

        {badge && (
          <p className="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--gold)/0.6)] bg-[hsl(var(--gold)/0.12)] px-2 py-1 font-pixel text-[9px] uppercase tracking-widest text-[hsl(var(--gold))]">
            {badge}
          </p>
        )}
        {champions && (
          <p className="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--gold)/0.6)] bg-[hsl(var(--gold)/0.12)] px-2 py-1 font-pixel text-[9px] uppercase tracking-widest text-[hsl(var(--gold))]">
            <Crown className="h-3 w-3" aria-hidden /> Super Bowl champions
          </p>
        )}

        <dl className={cn('grid gap-1.5', lamps.length > 4 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4')}>
          {lamps.map((s) => (
            <div key={s.label} className="min-w-0 rounded-md border border-[hsl(var(--line)/0.6)] bg-black/40 px-2 py-1.5">
              <dt className="truncate font-pixel text-[8px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">{s.label}</dt>
              <dd className={cn('font-display text-xl font-bold tabular-nums leading-tight', lampText)}>{s.value}</dd>
            </div>
          ))}
        </dl>

        <ResultsRibbon season={season} />
      </div>
    </div>
  );
};

/* ---------------- Club splits ---------------- */

/** Two bars to scale from zero: the club's figure against the league average. */
const VsLeague = ({ label, club, league, team, better }: { label: string; club: number; league: number; team: string; better: 'higher' | 'lower' }) => {
  const max = Math.max(club, league) || 1;
  const delta = Math.round((club - league) * 10) / 10;
  const good = better === 'higher' ? delta > 0 : delta < 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="font-pixel text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className={cn('text-[11px] font-semibold tabular-nums', delta === 0 ? 'text-muted-foreground' : good ? 'text-[hsl(145_63%_55%)]' : 'text-[hsl(357_80%_70%)]')}>
          {signedDec(delta)} vs league
        </dd>
      </div>
      <dd className="space-y-1">
        {[
          { who: team, v: club, fill: color(team), ink: 'text-foreground' },
          { who: 'League', v: league, fill: 'hsl(var(--muted-foreground) / 0.55)', ink: 'text-muted-foreground' },
        ].map((b) => (
          <div key={b.who} className="flex items-center gap-2 text-[11px]">
            <span className={cn('w-16 flex-shrink-0 truncate', b.ink)}>{b.who}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-black/40">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-full ring-1 ring-inset ring-white/15"
                style={{ width: `${(b.v / max) * 100}%`, background: b.fill }}
              />
            </span>
            <span className="w-9 flex-shrink-0 text-right font-display text-sm font-bold tabular-nums">{b.v.toFixed(1)}</span>
          </div>
        ))}
      </dd>
    </div>
  );
};

const StarMeter = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-2 text-[11px]">
    <span className="w-16 flex-shrink-0 text-muted-foreground">{label}</span>
    <span className="flex flex-1 gap-0.5" role="img" aria-label={`${label} ${stars(value)} of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} aria-hidden className="relative h-3.5 w-3.5">
            <Star className="absolute inset-0 h-3.5 w-3.5 text-[hsl(var(--line))]" />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-3.5 w-3.5 fill-[hsl(45_100%_55%)] text-[hsl(45_100%_55%)]" />
            </span>
          </span>
        );
      })}
    </span>
    <span className="font-display text-sm font-bold tabular-nums">{stars(value)}</span>
  </div>
);

const Panel = ({ icon: Icon, title, children, className }: { icon: typeof Zap; title: string; children: ReactNode; className?: string }) => (
  <div className={cn('relative overflow-hidden rounded-lg border border-[hsl(var(--line)/0.7)] p-3', className)} style={{ background: BOARD_BG }}>
    <LampGrid />
    <h4 className="relative mb-2 flex items-center gap-1.5 font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
    </h4>
    <div className="relative">{children}</div>
  </div>
);

/** Best win / worst loss as a broadcast lower-third. */
const Marquee = ({ kind, g, team }: { kind: 'best' | 'worst'; g: CoachGameBrief; team: string }) => {
  const best = kind === 'best';
  return (
    <div className="overflow-hidden rounded-lg border border-[hsl(var(--line)/0.7)]" style={{ background: BOARD_BG }}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1">
        <span
          className={cn(
            'inline-flex items-center gap-1 font-pixel text-[9px] uppercase tracking-widest',
            best ? 'text-[hsl(145_63%_55%)]' : 'text-[hsl(357_80%_70%)]',
          )}
        >
          {best ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
          {best ? 'Best win' : 'Worst loss'}
        </span>
        <span className="font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">{g.round}</span>
      </div>
      <div className="flex items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5" style={{ background: `linear-gradient(90deg, ${color(team, 0.45)}, ${color(team, 0.05)})` }}>
          <TeamLogo team={team} decorative className="h-6 w-6 flex-shrink-0" />
          <span className="truncate text-sm font-semibold uppercase">{team}</span>
          <span className={cn('ml-auto font-display text-xl font-bold tabular-nums', best ? lampText : 'text-foreground/70')}>{g.for}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2 px-2.5 py-1.5 text-right" style={{ background: `linear-gradient(270deg, ${color(g.opp, 0.45)}, ${color(g.opp, 0.05)})` }}>
          <TeamLogo team={g.opp} decorative className="h-6 w-6 flex-shrink-0" />
          <span className="truncate text-sm font-semibold uppercase">{g.opp}</span>
          <span className={cn('mr-auto font-display text-xl font-bold tabular-nums', best ? 'text-foreground/70' : lampText)}>{g.against}</span>
        </div>
      </div>
      <p className="px-2.5 py-1 text-[11px] text-muted-foreground">
        {best ? `Won by ${g.margin}` : `Lost by ${Math.abs(g.margin)}`}
      </p>
    </div>
  );
};

export const ClubSplits = ({ season }: { season: ScheduleSeason }) => {
  const d = season.coachDetail;
  if (!d) return null;
  const team = season.coachTeam;
  const tiles = [
    { label: 'Home', value: d.home, sub: 'Regular season', icon: Home },
    { label: 'Away', value: d.away, sub: 'Regular season', icon: Plane },
    { label: 'One-score games', value: d.oneScore, sub: 'Decided by 8 or fewer', icon: Scale },
    { label: 'Vs winning clubs', value: d.vsWinning, sub: `${d.vsWinningGames} games vs clubs above .500`, icon: Swords },
  ];
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Target className="h-4 w-4" aria-hidden /> {team} splits
      </h3>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <BoardTile key={t.label} label={t.label} value={t.value} sub={t.sub} accent={color(team)} />
        ))}
      </dl>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {season.league && (
          <Panel icon={Zap} title="Scoring vs league average" className="xl:col-span-2">
            <dl className="grid gap-3 sm:grid-cols-2">
              <VsLeague label="Points per game" club={d.ppg} league={season.league.ppg} team={team} better="higher" />
              <VsLeague label="Allowed per game" club={d.papg} league={season.league.ppg} team={team} better="lower" />
            </dl>
            <p className="mt-2 text-[11px] text-muted-foreground">Club figures include the playoffs; the league average is per club per regular-season game.</p>
          </Panel>
        )}
        {(d.avgOppOff != null || d.avgOppDef != null) && (
          <Panel icon={Star} title="Average opponent">
            <div className="space-y-1.5">
              {d.avgOppOff != null && <StarMeter label="Offense" value={d.avgOppOff} />}
              {d.avgOppDef != null && <StarMeter label="Defense" value={d.avgOppDef} />}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Season summary ratings of every club faced, 0 to 5 stars.</p>
          </Panel>
        )}
        {(d.bestWin || d.worstLoss) && (
          <div className="grid gap-2">
            {d.bestWin && <Marquee kind="best" g={d.bestWin} team={team} />}
            {d.worstLoss && <Marquee kind="worst" g={d.worstLoss} team={team} />}
          </div>
        )}
      </div>
    </div>
  );
};

