import type { CSSProperties, ReactNode } from 'react';
import CoachSprite from '@/components/CoachSprite';
import type { SpriteSize } from '@/components/GameSprite';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { useHasCoachSprite } from '@/utils/gameSprites';

/**
 * The coach (or a coordinator) standing on a plinth, the player banners' pedestal language (ProPlayerBanner.css): a
 * club-colour plinth with its secondary rim, or a gold one when `team` is null (club-neutral: the coach's whole career,
 * drawn in his white neutral polo). Renders `fallback` (or nothing) when this machine has no coach sprite.
 */
const CoachStand = ({
  who = 'head',
  team,
  size = 'm',
  className,
  fallback = null,
  children,
}: {
  who?: string;
  /** Club whose polo he wears and whose colours the plinth takes; null = club-neutral (white polo, gold plinth) */
  team: string | null;
  size?: SpriteSize;
  className?: string;
  fallback?: ReactNode;
  /** Set into the plinth (a logo, a mark) */
  children?: ReactNode;
}) => {
  const has = useHasCoachSprite(who);
  if (!has) return <>{fallback}</>;
  const t = team ? findNFLTeam(team) : null;
  const vars = (
    t ? { ['--stand-a' as string]: t.primaryColor, ['--stand-b' as string]: t.secondaryColor !== t.primaryColor ? t.secondaryColor : '0 0% 92%' } : {}
  ) as CSSProperties;
  return (
    <span className={cn('fo-stand', `fo-stand--${size}`, !t && 'is-neutral', className)} style={vars} aria-hidden="true">
      <CoachSprite who={who} team={t ? t.name : null} size={size} className="fo-stand__fig" />
      <span className="fo-stand__plinth">{children && <span className="fo-stand__mark">{children}</span>}</span>
    </span>
  );
};

export default CoachStand;
