import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import TeamLogo from '@/components/timeline/TeamLogo';
import { openInCompFinder } from '@/components/stats/comps/compFinderLink';
import type { Player } from '@/types/player';
import './clubStrip.css';

/**
 * A name as a small club banner strip: the site's one click affordance for player and club names (never an
 * underline). The club's primary is the strip, its secondary the leading edge, its real logo in a dark socket, the
 * text in getReadableTextOn(primary). Interactive strips are buttons that brighten and lift on hover, with the gold
 * focus ring; without an action it is a plain label in the same look.
 *
 *   <ClubStrip team="Eagles" />                                  a club (onClick: open the team)
 *   <PlayerStrip name="Bones Crawford" position="QB" team="Eagles" />   a player (opens his Deep Dive)
 */
export interface ClubStripProps {
  team: string;
  /** Text on the strip (default: the club's name) */
  label?: ReactNode;
  /** A short tag after the text ("Coach", "No card") */
  tag?: ReactNode;
  size?: 'sm' | 'md';
  onClick?: () => void;
  /** Accessible name for the button (default: the visible text) */
  ariaLabel?: string;
  title?: string;
  className?: string;
}

export const stripVars = (team: string): CSSProperties => {
  const nfl = findNFLTeam(team);
  if (!nfl) return {};
  return {
    ['--cs-bg' as string]: `hsl(${nfl.primaryColor})`,
    ['--cs-edge' as string]: `hsl(${nfl.secondaryColor})`,
    ['--cs-fg' as string]: getReadableTextOn(nfl.primaryColor),
  };
};

const ClubStrip = ({ team, label, tag, size = 'md', onClick, ariaLabel, title, className }: ClubStripProps) => {
  const body = (
    <>
      <span className="club-strip__logo" aria-hidden>
        <TeamLogo team={team} decorative />
      </span>
      <span className="club-strip__text">{label ?? team}</span>
      {tag && <span className="club-strip__tag">{tag}</span>}
    </>
  );
  const cls = cn('club-strip', `club-strip--${size}`, className);
  return onClick ? (
    <button type="button" className={cls} style={stripVars(team)} onClick={onClick} aria-label={ariaLabel} title={title}>
      {body}
    </button>
  ) : (
    <span className={cls} style={stripVars(team)} title={title}>
      {body}
    </span>
  );
};

/** A player's name on his club's strip; a button to his Deep Dive unless `card` is false (no card yet: a "No card" tag). */
export const PlayerStrip = ({
  name,
  position,
  team,
  card = true,
  tag,
  size,
  className,
}: {
  name: string;
  position: string;
  team: string;
  card?: boolean;
  tag?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) => (
  <ClubStrip
    team={team}
    label={name}
    tag={card ? tag : 'No card'}
    size={size}
    className={className}
    onClick={card ? () => openInCompFinder({ position, name } as Pick<Player, 'position' | 'name'> as Player) : undefined}
    ariaLabel={card ? `${name}, ${position}, ${team}: open in the Deep Dive` : undefined}
  />
);

export default ClubStrip;
