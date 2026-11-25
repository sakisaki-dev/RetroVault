import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { bannerTeamOf } from '@/utils/playerExtras';
import { useGameSprites } from '@/utils/gameSprites';
import type { SpriteAction } from '@/utils/gameSprites';
import GameSprite from '../../GameSprite';
import TeamLogo from '../../brand/TeamLogo';
import { MEDAL } from './clubTone';
import './clubStage.css';

/*
 * Club staging for the Stats › Players page (owner, 2026-11-17: "the stats players page now feels really dry, look it
 * over for more immersion graphics color"): a card tinted in the leader's club colours (`cs-card`, `clubStyle`) with
 * his own game sprite standing on a club-colour floor glow (`StageFigure`), the way the Record Book's cards stand
 * their holders. The public build (no private sprites) shows his club's logo in the sprite's place.
 */

export const RankMedal = ({ rank, className }: { rank: number; className?: string }) =>
  rank <= 3 ? (
    <span className={cn('cs-medal', className)} style={{ '--cs-medal': MEDAL[rank - 1] } as CSSProperties} aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  ) : (
    <span className={cn('cs-rank', className)}>{rank}</span>
  );

/** His figure on a club-colour floor glow (decorative: the card's text names him) */
export const StageFigure = ({
  player,
  action = 'idle',
  size = 's',
  className,
}: {
  player: Player;
  action?: SpriteAction;
  size?: 's' | 'm';
  className?: string;
}) => {
  const sprites = useGameSprites();
  const club = bannerTeamOf(player);
  return (
    <span className={cn('cs-fig', `cs-fig--${size}`, className)} aria-hidden="true">
      <span className="cs-fig__floor" />
      {sprites && !player.isRealLegend ? (
        <GameSprite player={player} kind="figure" size={size} action={action} className="cs-fig__sprite" />
      ) : club ? (
        <span className="cs-fig__logo">
          <TeamLogo team={club} size={size === 'm' ? 72 : 44} decorative />
        </span>
      ) : null}
    </span>
  );
};

/** The big cropped club logo behind a flat-colour card (the club wall cards' watermark) */
export const ClubWatermark = ({ player, team, size = 150 }: { player?: Player | null; team?: string | null; size?: number }) => {
  const club = (player && !player.isRealLegend ? bannerTeamOf(player) : '') || team;
  if (!club) return null;
  return (
    <span className="cs-wm" aria-hidden="true">
      <TeamLogo team={club} size={size} decorative />
    </span>
  );
};
