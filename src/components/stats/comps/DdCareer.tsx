import { useMemo } from 'react';
import type { Player } from '@/types/player';
import { legacyMix } from '@/config/advanced';
import { HOF_THRESHOLD, LEGACY_TIERS, getLegacyTier } from '@/config/stats';
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

/** 16-game seasons, as the record-pace tracker uses. */
const SEASON_GAMES = 16;

/** Career arc, legacy composition, talent numbers vs the position, and Hall of Fame status / pace. */
const DdCareer = ({ player, posStats }: { player: Player; posStats: PosStat[] }) => {
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const { retiredInfo } = useJerseyNumbers();
  const card = extras.cards[normalizeName(player.name)];
  const retired = retiredInfo(player);
  const tier = getLegacyTier(player.careerLegacy);
  const arc = useMemo(() => buildCareerArc({ player, content, card, retired, hofTier: tier?.label ?? null }), [player, content, card, retired, tier]);
  const theme = teamThemeVars(findNFLTeam(player.team));
  const mix = legacyMix(player);
  const parts = [
    { key: 'talent', label: 'Talent', value: mix.talent, color: VIZ.series[0], note: '6.8 × True Talent' },
    { key: 'awards', label: 'Awards', value: mix.awards, color: 'hsl(43 100% 62%)', note: '4 × award points' },
    { key: 'longevity', label: 'Longevity', value: mix.longevity, color: VIZ.series[2], note: '2 × games' },
  ];
  const total = Math.max(mix.total, 1);

  // Hall of Fame status: next tier, or distance + pace to the 7,000 line.
  const perGame = player.games > 0 ? player.careerLegacy / player.games : 0;
  const nextTier = [...LEGACY_TIERS].reverse().find((t) => t.min > player.careerLegacy);
  const target = tier ? nextTier?.min : HOF_THRESHOLD;
  const remaining = target != null ? target - player.careerLegacy : 0;
  const gamesNeeded = perGame > 0 ? Math.ceil(remaining / perGame) : Infinity;
  const progress = Math.min(100, (player.careerLegacy / ((target ?? player.careerLegacy) || 1)) * 100);

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
            <span className="font-mono text-xs font-normal normal-case text-muted-foreground">{fmtNum(player.careerLegacy, 0)} legacy</span>
          </h3>
          {tier ? (
            <p className="text-sm">
              <b className="text-gold">Inducted · {tier.label} tier.</b>{' '}
              {nextTier ? (
                <span className="text-muted-foreground">
                  {fmtNum(remaining, 0)} from {nextTier.label}
                  {player.status === 'Active' && Number.isFinite(gamesNeeded) ? ` (~${gamesNeeded} games, ${Math.max(1, Math.round(gamesNeeded / SEASON_GAMES))} seasons at his rate)` : ''}.
                </span>
              ) : (
                <span className="text-muted-foreground">The top tier there is.</span>
              )}
            </p>
          ) : (
            <p className="text-sm">
              <b>{fmtNum(remaining, 0)}</b> Career Legacy short of the Hall ({fmtNum(HOF_THRESHOLD, 0)}).{' '}
              <span className="text-muted-foreground">
                {player.status === 'Retired'
                  ? 'Retired, so the case is closed.'
                  : Number.isFinite(gamesNeeded)
                    ? `At ${fmtNum(perGame, 1)} per game: ~${gamesNeeded} more games (${Math.max(1, Math.round(gamesNeeded / SEASON_GAMES))} seasons).`
                    : 'No pace yet.'}
              </span>
            </p>
          )}
          <DdBar pct={progress} color="hsl(43 100% 62%)" label={tier ? 'Progress to the next tier' : 'Progress to the Hall of Fame'} />
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
