import { ovrLabelOf } from '@/utils/useOfficialOvr';
import type { Player } from '@/types/player';
import type { NFLTeam } from '@/utils/nflTeams';
import { AWARD_META, POSITION_NAMES } from '@/utils/playerMeta';
import { isDefensivePosition } from '@/config/stats';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import GameSprite from '@/components/GameSprite';
import { bannerStats } from '@/components/hof/hofUtils';
import { headlineStats } from '@/components/player/statLines';
import { teamThemeVars } from '@/components/player/teamTheme';
import SharePosterFrame from './SharePosterFrame';

const num = (v: number | null, decimals = 0) =>
  v == null || !Number.isFinite(v) ? '–' : v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * The player card as a picture: his banner (club colours, number, OVR, his sprite on the pedestal with his headline
 * totals), his nickname, the card's key numbers and his awards. Numbers come from the same helpers the card uses.
 */
const PlayerSharePoster = ({
  player,
  team,
  number,
  ovr,
  hallOfFamer,
  retiredBy,
}: {
  player: Player;
  team: NFLTeam | null;
  number: number | null;
  ovr: number | null;
  hallOfFamer: boolean;
  retiredBy: string | null;
}) => {
  const theme = teamThemeVars(team);
  const awards = AWARD_META[isDefensivePosition(player.position) ? 'defense' : 'offense'].filter((a) => a.key !== 'rings' && (player[a.key] ?? 0) > 0);
  const tiles = [
    { key: 'ovr', label: ovrLabelOf(player), value: num(ovr), gold: true },
    { key: 'rings', label: player.rings === 1 ? 'Ring' : 'Rings', value: num(player.rings ?? 0), gold: true },
    { key: 'legacy', label: 'Career Legacy', value: player.trueTalent > 0 ? num(player.careerLegacy) : '–' },
    { key: 'games', label: 'Games', value: num(player.games) },
    ...headlineStats(player).map((s) => ({ key: s.key, label: s.label, value: num(s.value, s.decimals ?? 0), gold: false })),
  ];
  return (
    <SharePosterFrame
      width={600}
      style={{
        ...theme.vars,
        background: `repeating-linear-gradient(rgb(0 0 0 / 0.1) 0 1px, transparent 1px 3px) top / 100% 120px no-repeat, linear-gradient(180deg, hsl(${theme.p} / 0.4), hsl(${theme.p} / 0.08) 420px, transparent 700px), hsl(var(--night))`,
      }}
    >
      <ProPlayerBanner
        size="hero"
        name={player.name}
        position={player.position}
        team={team ?? player.team}
        number={number}
        ovr={ovr}
        hallOfFamer={hallOfFamer}
        retiredBy={retiredBy}
        eyebrow={`${POSITION_NAMES[player.position] ?? player.position}${team ? ` · ${team.fullName}` : ''}`}
        figure={player.isRealLegend ? null : <GameSprite player={player} team={team?.name ?? player.team} kind="figure" size="l" />}
        stats={player.isRealLegend ? undefined : bannerStats(player)}
        className="rounded-xl"
      />
      {player.nickname && <p className="shr-nick">&ldquo;{player.nickname}&rdquo;</p>}
      <dl className="shr-tiles">
        {tiles.map((t) => (
          <div key={t.key} className={t.gold ? 'shr-tile shr-tile--gold' : 'shr-tile'}>
            <dd>{t.value}</dd>
            <dt>{t.label}</dt>
          </div>
        ))}
      </dl>
      {awards.length > 0 && (
        <ul className="shr-awards">
          {awards.map((a) => {
            const n = player[a.key] ?? 0;
            return (
              <li key={a.key} className="shr-award" style={{ color: `hsl(${a.hsl})` }}>
                <a.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {n > 1 ? `${n}× ` : ''}
                  {a.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SharePosterFrame>
  );
};

export default PlayerSharePoster;
