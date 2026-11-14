import { useMemo, type CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { useGameSprites } from '@/utils/gameSprites';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import GameSprite from '../GameSprite';
import TeamLogo from '../brand/TeamLogo';

/**
 * The champions' team photo on a Season Story lead (the owner's private Retro Bowl sprites; nothing on the public
 * site): every league player whose career stints give him a ring with the winning club that season (the stint rule's
 * ring holders), in the club's kit, two rows deep. The star stands front and centre in the celebrate pose: the first
 * player the lead story names who is in the photo (the data keeps no per-season Super Bowl MVP).
 */
interface Props {
  /** "Y92" */
  season: string;
  winner: string;
  players: Player[];
  /** Names the lead story features, in its order */
  featured: string[];
}

const TeamPhoto = ({ season, winner, players, featured }: Props) => {
  const sprites = useGameSprites();
  const extras = usePlayerExtras();
  const year = Number(season.replace(/\D/g, ''));
  const team = findNFLTeam(winner);

  const roster = useMemo(() => {
    if (!team || !year) return [];
    return players
      .filter((p) => !p.isRealLegend)
      .filter((p) => extras.stints[normalizeName(p.name)]?.stints.some((s) => findNFLTeam(s.team)?.id === team.id && s.rings.includes(year)))
      .sort((a, b) => (b.careerLegacy || 0) - (a.careerLegacy || 0));
  }, [players, extras, team, year]);

  if (!sprites || !team || roster.length < 2) return null;
  const starName = featured.find((n) => roster.some((p) => p.name === n));
  const star = roster.find((p) => p.name === starName) ?? roster[0];
  const rest = roster.filter((p) => p !== star);
  const back = rest.slice(0, Math.ceil(rest.length / 2));
  const front = rest.slice(back.length);
  // the star stands in the middle of the front row
  const mid = Math.floor(front.length / 2);
  const vars = { '--tp-c1': `hsl(${team.primaryColor})`, '--tp-c2': `hsl(${team.secondaryColor})`, '--tp-fg': getReadableTextOn(team.primaryColor) } as CSSProperties;

  return (
    <figure className="tp" style={vars} aria-label={`${season} ${team.name} team photo: ${roster.map((p) => p.name).join(', ')}`}>
      <div className="tp-stage">
        <span className="tp-banner" aria-hidden="true">
          <TeamLogo team={team} size={18} decorative />
          {season} {team.name} · Champions
        </span>
        <div className="tp-row tp-row--back" aria-hidden="true">
          {back.map((p) => (
            <GameSprite key={p.name} player={p} team={team.name} kind="figure" size="m" />
          ))}
        </div>
        <div className="tp-row tp-row--front" aria-hidden="true">
          {front.slice(0, mid).map((p) => (
            <GameSprite key={p.name} player={p} team={team.name} kind="figure" size="m" />
          ))}
          <GameSprite player={star} team={team.name} kind="figure" size="l" action="celebrate" className="tp-star" />
          {front.slice(mid).map((p) => (
            <GameSprite key={p.name} player={p} team={team.name} kind="figure" size="m" />
          ))}
        </div>
      </div>
      <figcaption className="tp-cap">
        Front and centre: <b>{star.name}</b> · {roster.length} ring holders
      </figcaption>
    </figure>
  );
};

export default TeamPhoto;
