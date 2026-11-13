import { useMemo } from 'react';
import type { Player } from '@/types/player';
import { legacyMix } from '@/config/advanced';
import { getLegacyTier, isHallOfFamer } from '@/config/stats';
import { hofClassLabel, hofStandingOf, useHallOfFame } from '@/utils/hallOfFame';
import { findNFLTeam } from '@/utils/nflTeams';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useLeagueContent } from '@/utils/leagueContent';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import CareerArc from '../../player/CareerArc';
import { buildCareerArc } from '../../player/arcData';
import { teamThemeVars } from '../../player/teamTheme';
import '../../player/playerCard.css';
import { VIZ, fmtNum, ordinal } from '../analytics/viz';
import { DdBar } from './ddParts';

export interface PosStat {
  key: string;
  label: string;
  title: string;
  value: number;
  decimals: number;
  pct: number | null;
}

/** Career arc, legacy composition, talent numbers vs the position, and Hall of Fame status / pace. */
const DdCareer = ({ player, posStats }: { player: Player; posStats: PosStat[] }) => {
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const { retiredInfo } = useJerseyNumbers();
  const card = extras.cards[normalizeName(player.name)];
  const retired = retiredInfo(player);
  const tier = getLegacyTier(player.careerLegacy);
  const stints = extras.stints[normalizeName(player.name)];
  const arc = useMemo(
    () => buildCareerArc({ player, content, card, retired, hofTier: tier?.label ?? null, stints }),
    [player, content, card, retired, tier, stints],
  );
  const theme = teamThemeVars(findNFLTeam(player.team));
  const mix = legacyMix(player);
  const parts = [
    { key: 'talent', label: 'Talent', value: mix.talent, color: VIZ.series[0], note: '6.8 × True Talent' },
    { key: 'awards', label: 'Awards', value: mix.awards, color: 'hsl(43 100% 62%)', note: '4 × award points' },
    { key: 'longevity', label: 'Longevity', value: mix.longevity, color: VIZ.series[2], note: '2 × games' },
  ];
  const total = Math.max(mix.total, 1);

  // Hall of Fame status (scripts/hall_of_fame.py): member, ballot, near miss or the active watch list, as score vs the bar
  const { data: hof } = useHallOfFame();
  const bar = hof?.bar ?? 65;
  const standing = hofStandingOf(hof, `${player.position}:${player.name}`);
  const inHall = standing?.kind === 'member' || isHallOfFamer(player);
  const score = standing?.entry.score ?? null;
  const progress = score == null ? 0 : inHall ? score : Math.min(100, (score / bar) * 100);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="pc-root glass-card min-w-0 space-y-3 rounded-xl p-3 sm:p-4" style={theme.vars}>
        <h3 id="dd-arc-title" className="font-display text-base font-bold uppercase tracking-wide">
          Career arc
        </h3>
        <CareerArc arc={arc} headingId="dd-arc-title" />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="glass-card space-y-2 p-3 sm:p-4">
          <h3 className="flex items-baseline justify-between font-display text-base font-bold uppercase tracking-wide">
            Hall of Fame
            <span className="font-mono text-xs font-normal normal-case text-muted-foreground">{score != null ? `Score ${score} · ` : ''}{fmtNum(player.careerLegacy, 0)} legacy</span>
          </h3>
          {standing?.kind === 'member' ? (
            <p className="text-sm">
              <b className="text-gold">
                Inducted · {hofClassLabel(standing.entry.class)}
                {standing.entry.firstBallot ? ' · First ballot' : standing.entry.veteran ? ' · Veteran' : ''}.
              </b>{' '}
              <span className="text-muted-foreground">
                Hall of Fame Score {standing.entry.score} of 100 (bar {bar}), {ordinal(standing.entry.rank)} {player.position} by Career Legacy when he retired.
              </span>
            </p>
          ) : inHall ? (
            <p className="text-sm">
              <b className="text-gold">Inducted.</b>
            </p>
          ) : standing?.kind === 'ballot' ? (
            <p className="text-sm">
              <b>On the ballot: score {standing.entry.score}</b> (bar {bar}).{' '}
              <span className="text-muted-foreground">Over the bar, waiting for a place in a class (at most {hof?.cap ?? 3} a year).</span>
            </p>
          ) : standing?.kind === 'near' ? (
            <p className="text-sm">
              <b>Score {standing.entry.score}</b>, {bar - standing.entry.score} short of the bar ({bar}).{' '}
              <span className="text-muted-foreground">His case froze in {standing.entry.frozenSeason}, so it is closed.</span>
            </p>
          ) : standing?.kind === 'watch' ? (
            <p className="text-sm">
              <b>Hall of Fame Score today {standing.entry.score}</b> (bar {bar}).{' '}
              <span className="text-muted-foreground">
                {standing.entry.score >= bar ? 'On track: ' : `${bar - standing.entry.score} to go. `}
                eligible when he retires.
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not on the Hall of Fame ballot or watch list (a score of {bar - 15}+ against the bar of {bar}).
            </p>
          )}
          <DdBar pct={progress} color="hsl(43 100% 62%)" label={inHall ? 'Hall of Fame Score out of 100' : `Hall of Fame Score against the bar of ${bar}`} />
        </div>

        <div className="glass-card space-y-2 p-3 sm:p-4">
          <h3 className="font-display text-base font-bold uppercase tracking-wide">Legacy composition</h3>
          <div className="flex h-4 w-full overflow-hidden rounded" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
            {parts.map((p) => (
              <span key={p.key} style={{ width: `${(Math.max(0, p.value) / total) * 100}%`, background: p.color }} />
            ))}
          </div>
          <ul className="grid grid-cols-3 gap-2 text-xs">
            {parts.map((p) => (
              <li key={p.key} title={p.note}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
                  {p.label}
                </span>
                <span className="font-mono tabular-nums text-chalk">{fmtNum(p.value, 0)}</span>{' '}
                <span className="text-muted-foreground">{Math.round((p.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card space-y-2.5 p-3 sm:p-4">
          <h3 className="font-display text-base font-bold uppercase tracking-wide">Vs. every {player.position}</h3>
          {posStats.map((s) => (
            <div key={s.key} className="space-y-1" title={s.title}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{s.label}</span>
                <span className="font-mono text-xs tabular-nums">
                  {fmtNum(s.value, s.decimals)} <span className="text-muted-foreground">{s.pct == null ? '' : `· ${ordinal(s.pct)}`}</span>
                </span>
              </div>
              <DdBar pct={s.pct} label={`${s.label} percentile among ${player.position}s`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DdCareer;
