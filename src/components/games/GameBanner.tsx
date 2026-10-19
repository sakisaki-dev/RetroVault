import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { isHallOfFamer } from '@/config/stats';
import { useJerseyNumbers } from '@/utils/jerseys';
import ProPlayerBanner, { type ProPlayerBannerSize } from '../brand/ProPlayerBanner';
import { isLegend, legendLabel, type GamePlayer } from './gameUtils';

/** "Author · License" for a legend's Commons photo, or null when there is nothing to credit. */
const photoCreditOf = (p: GamePlayer): string | null => {
  const ph = p.photo;
  if (!ph?.url) return null;
  const parts = [ph.author, ph.license].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Wikimedia Commons';
};

export interface GameBannerProps {
  player: GamePlayer;
  size?: ProPlayerBannerSize;
  /** Mystery card: no name, team, logo, number, photo, rating or legend hint */
  sealed?: boolean;
  /** Text in the sealed chip (e.g. the draft slot). Nothing by default. */
  sealedHint?: string;
  /** Official OVR; hidden while sealed */
  ovr?: number | null;
  /** Answer is out: show the NFL Legend tag, the legend's real photo and the HOF / retired-number tags
   * (hidden before, since they hint at the rating). */
  reveal?: boolean;
  eyebrow?: ReactNode;
  topRight?: ReactNode;
  nameAs?: ElementType;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * The site's ProPlayerBanner, wired for the arcade: real jersey numbers (legends get theirs),
 * HOF edge / retired tag for league players, and the legend's Commons photo once revealed.
 * Sealed cards get placeholder props only, so nothing about the player reaches the DOM.
 */
const GameBanner = ({
  player,
  size = 'card',
  sealed = false,
  sealedHint,
  ovr,
  reveal = false,
  eyebrow,
  topRight,
  nameAs,
  interactive,
  className,
  style,
}: GameBannerProps) => {
  const { numberFor, retiredInfo } = useJerseyNumbers();

  if (sealed) {
    return (
      <div className={cn('gb', className)} style={style}>
        <ProPlayerBanner name="Mystery player" position="" size={size} sealed sealedHint={sealedHint} topRight={topRight} nameAs={nameAs} />
      </div>
    );
  }

  const legend = isLegend(player);
  const photo = reveal && legend && player.photo?.url ? player.photo : null;
  const credit = photo ? photoCreditOf(player) : null;
  const tag = reveal && legend ? legendLabel(player) : null;
  const eyebrowText = eyebrow && tag ? (
    <>
      {eyebrow} · {tag}
    </>
  ) : (
    eyebrow ?? tag
  );

  return (
    <div className={cn('gb', className)} style={style}>
      <ProPlayerBanner
        name={player.name}
        nickname={player.nickname}
        position={player.position}
        team={player.team}
        number={numberFor(player)}
        size={size}
        ovr={ovr}
        hallOfFamer={reveal && !legend && isHallOfFamer(player)}
        retiredBy={reveal && !legend ? retiredInfo(player)?.teamLabel ?? null : null}
        eyebrow={eyebrowText}
        photoUrl={photo?.url ?? null}
        photoCredit={credit}
        photoHref={photo?.page ?? null}
        topRight={topRight}
        nameAs={nameAs}
        interactive={interactive}
      />
    </div>
  );
};

export default GameBanner;

/** Board slot (Blind Rank, Keep 3/Cut 3): a banner with the slot marker and an optional result strip. */
export const BoardCard = ({
  player,
  no,
  ovr,
  reveal = false,
  meta,
  children,
  className,
  delay,
}: {
  player: GamePlayer;
  no: ReactNode;
  ovr?: number | null;
  reveal?: boolean;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
  delay?: number;
}) => (
  <div className={cn('b5p', className)} style={{ animationDelay: delay != null ? `${delay}s` : undefined }}>
    <GameBanner player={player} ovr={ovr} reveal={reveal} />
    {/* Slot marker sits in the strip, not on the banner, so a revealed legend's photo credit never covers it */}
    <div className="b5p-foot">
      <span className="b5p-no" aria-hidden="true">
        {no}
      </span>
      {meta && <span className="b5p-meta">{meta}</span>}
      {children}
    </div>
  </div>
);
