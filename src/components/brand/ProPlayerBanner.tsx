import { useEffect, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { POSITION_NAMES } from '@/utils/playerMeta';
import type { Position } from '@/types/player';
import TeamLogo, { resolveTeam } from './TeamLogo';
import GameSprite from '../GameSprite';
import { statureScale, useGameSprites } from '@/utils/gameSprites';
import { splitPlayerName } from './ProPlayerBanner.utils';
import './ProPlayerBanner.css';

export type ProPlayerBannerSize = 'hero' | 'card' | 'compact';

export interface ProPlayerBannerProps {
  name: string;
  position: Position | string;
  /** Team string from player data, or a resolved NFLTeam. Unknown/missing teams get a neutral navy look. */
  team?: string | NFLTeam | null;
  /** Jersey number (see useJerseyNumbers). Omit to hide the number. */
  number?: number | null;
  /** hero: player card header · card: grids (HOF, rosters) · compact: list rows */
  size?: ProPlayerBannerSize;
  /** OVR-style rating slot (e.g. overallRating()); omit to hide */
  ovr?: number | null;
  ovrLabel?: string;
  /** Metallic gold edge + HOF tag */
  hallOfFamer?: boolean;
  /** Team nickname ("Bills") when the player's number is retired; shows a tag */
  retiredBy?: string | null;
  nickname?: string;
  /** Small line above the name area (hero/card), e.g. "Quarterback · AFC East" */
  eyebrow?: ReactNode;
  /** Mystery mode: hides name, team, logo, number, photo, rating and HOF edge */
  sealed?: boolean;
  /** Optional text shown in the chip while sealed (e.g. a position hint). Nothing is shown by default. */
  sealedHint?: string;
  /** Optional cutout-style photo; falls back to the number + logo design when missing or broken */
  photoUrl?: string | null;
  photoCredit?: string | null;
  /** Link for the credit tag (the photo's license/source page). Ignored when `interactive` (no links inside buttons). */
  photoHref?: string | null;
  /** Element used for the name (e.g. DialogTitle). Defaults to a span. */
  nameAs?: ElementType;
  /** Extra content rendered at the top right of hero/card (e.g. badges) */
  topRight?: ReactNode;
  /**
   * Pixel figure standing on the nameplate's top edge (compact: a small bust in the row), above the number and logo.
   * Default: the player's private Retro Bowl sprite (GameSprite), which renders nothing on the public site, so the
   * banner stays exactly as it was there. Pass a node to choose the look, or null for none (real NFL legends).
   */
  figure?: ReactNode;
  /** Career numbers shown beside the pedestal (hero, only when the sprite stands there), e.g. careerLine(p) */
  stats?: { label: string; value: string | number }[];
  /** Adds the hover sheen; use when the banner sits inside a button or link */
  interactive?: boolean;
  className?: string;
}

const NEUTRAL_PRIMARY = '226 33% 24%';
const NEUTRAL_SECONDARY = '226 33% 40%';
const LOGO_SIZE: Record<ProPlayerBannerSize, number> = { hero: 260, card: 160, compact: 46 };

/**
 * Original broadcast-style player banner: team gradient with angled bands and grain, a huge outlined
 * jersey number, the team logo as a watermark, a dark nameplate (first name small, LAST NAME big),
 * a position/number chip, an OVR slot and a metallic edge for Hall of Famers. Pure CSS/SVG.
 */
const ProPlayerBanner = ({
  name,
  position,
  team,
  number,
  size = 'card',
  ovr,
  ovrLabel = 'OVR',
  hallOfFamer = false,
  retiredBy,
  nickname,
  eyebrow,
  sealed = false,
  sealedHint,
  photoUrl,
  photoCredit,
  photoHref,
  nameAs: NameTag = 'span',
  topRight,
  figure: figureProp,
  stats,
  interactive = false,
  className,
}: ProPlayerBannerProps) => {
  const resolved = sealed ? null : resolveTeam(team);
  const primary = resolved?.primaryColor ?? NEUTRAL_PRIMARY;
  // Same-color secondaries (Browns) still need a visible accent
  const secondary =
    resolved && resolved.secondaryColor !== resolved.primaryColor ? resolved.secondaryColor : resolved ? '0 0% 100%' : NEUTRAL_SECONDARY;
  const stature = statureScale(useGameSprites(), name);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [photoUrl]);
  const showPhoto = !sealed && !!photoUrl && !photoFailed;
  const hof = hallOfFamer && !sealed;
  const hasNumber = !sealed && number != null;

  const { first, last } = sealed ? { first: 'Mystery player', last: '? ? ?' } : splitPlayerName(name);
  const posLabel = POSITION_NAMES[position as Position] ?? position;
  const chipPos = sealed ? sealedHint : position;

  const vars = {
    '--ppb-primary': primary,
    '--ppb-secondary': secondary,
    '--ppb-fg': getReadableTextOn(primary),
    '--ppb-chip-fg': getReadableTextOn(secondary),
  } as CSSProperties;

  const accessibleName = sealed
    ? 'Mystery player'
    : `${name}${nickname ? ` "${nickname}"` : ''}, ${posLabel}${hasNumber ? `, number ${number}` : ''}${resolved ? `, ${resolved.fullName}` : ''}`;

  const bigNumber = sealed ? '?' : hasNumber ? String(number) : null;

  const chip =
    chipPos || hasNumber ? (
      <span className="ppb__chip" aria-hidden="true">
        {chipPos && <span className="ppb__chip-pos">{chipPos}</span>}
        {hasNumber && <span className="ppb__chip-num">#{number}</span>}
      </span>
    ) : null;

  const ovrBadge =
    ovr != null && !sealed ? (
      <span className="ppb__ovr" title={`${ovrLabel} ${ovr}`}>
        <b>{ovr}</b>
        <span>{ovrLabel}</span>
      </span>
    ) : null;

  const decor = (
    <>
      <span className="ppb__layer ppb__bands" aria-hidden="true" />
      <span className="ppb__layer ppb__texture" aria-hidden="true" />
      {resolved && (
        <span className="ppb__layer ppb__logo" aria-hidden="true">
          <TeamLogo team={resolved} size={LOGO_SIZE[size]} decorative />
        </span>
      )}
      {bigNumber && size !== 'compact' && (
        <>
          <span className="ppb__layer ppb__number ppb__number--fill" aria-hidden="true">{bigNumber}</span>
          <span className="ppb__layer ppb__number ppb__number--stroke" aria-hidden="true">{bigNumber}</span>
        </>
      )}
      {showPhoto && (
        // Framed portrait window: Commons photos are ordinary rectangular shots (not cutouts),
        // so they sit in an angled, team-bordered panel and fade into the banner.
        <span className="ppb__layer ppb__photo-frame" aria-hidden="true">
          <img
            className="ppb__photo"
            src={photoUrl!}
            alt=""
            loading={size === 'hero' ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setPhotoFailed(true)}
          />
          <span className="ppb__photo-fade" />
        </span>
      )}
      {showPhoto && photoCredit &&
        (photoHref && !interactive ? (
          <a className="ppb__credit" href={photoHref} target="_blank" rel="noopener noreferrer" title={`Photo: ${photoCredit} (opens license page)`}>
            Photo: {photoCredit}
          </a>
        ) : (
          <span className="ppb__credit" title={`Photo: ${photoCredit}`}>
            Photo: {photoCredit}
          </span>
        ))}
      <span className="ppb__layer ppb__vignette" aria-hidden="true" />
      <span className="ppb__layer ppb__sheen" aria-hidden="true" />
    </>
  );

  const teamName = resolved?.name ?? (typeof team === 'string' ? team : undefined);
  const figure =
    figureProp !== undefined ? (
      figureProp
    ) : (
      <GameSprite player={{ name, position }} team={teamName} kind="figure" size={size === 'hero' ? 'l' : 'm'} />
    );
  // Compact rows: the figure stands in the row. Hero and card: the centre pedestal (owner's pick, 2026-11-13), the
  // player on a club-colour plinth with his logo set in it, the giant number behind him. The pedestal layout only
  // switches on when a sprite actually renders (CSS :has(.game-sprite)), so the public build keeps the classic banner.
  const figureLayer =
    figure && !sealed && !showPhoto ? (
      <span className="ppb__figure" aria-hidden="true">
        {figure}
      </span>
    ) : null;
  const stage =
    figure && !sealed && !showPhoto ? (
      <span className="ppb__stage" aria-hidden="true">
        <span className="ppb__stage-fig" style={stature !== 1 ? ({ '--ppb-stature': stature } as CSSProperties) : undefined}>
          {figure}
        </span>
        <span className="ppb__pedestal">
          {resolved && (
            <span className="ppb__pedestal-logo">
              <TeamLogo team={resolved} size={size === 'hero' ? 48 : 30} decorative />
            </span>
          )}
        </span>
      </span>
    ) : null;
  const statBlock =
    stats && stats.length > 0 && !sealed ? (
      <span className="ppb__stats" aria-hidden="true">
        {stats.map((st) => (
          <span key={st.label} className="ppb__stat">
            <b>{typeof st.value === 'number' ? Math.round(st.value).toLocaleString('en-US') : st.value}</b>
            <span>{st.label}</span>
          </span>
        ))}
      </span>
    ) : null;

  const nameBlock = (
    <span className="ppb__names">
      <NameTag className="m-0 p-0" style={{ color: 'inherit', font: 'inherit' }}>
        <span className="sr-only">{accessibleName}</span>
        <span aria-hidden="true">
          {first && <span className="ppb__first">{first}</span>}
          <span className={cn('ppb__last', last.length > 9 && 'ppb__last--long')}>{last}</span>
        </span>
      </NameTag>
      {nickname && !sealed && size === 'hero' && (
        <span className="ppb__nick" aria-hidden="true">
          "{nickname}"
        </span>
      )}
    </span>
  );

  const root = cn(
    'ppb',
    `ppb--${size}`,
    hof && 'ppb--hof',
    sealed && 'ppb--sealed',
    showPhoto && 'ppb--has-photo',
    interactive && 'ppb--interactive',
    className,
  );

  if (size === 'compact') {
    return (
      <div className={root} style={vars}>
        <div className="ppb__field">
          {decor}
          <div className="ppb__content">
            <span className="ppb__numplate" aria-hidden="true">
              {sealed ? '?' : hasNumber ? number : position}
            </span>
            {figureLayer}
            <span className="ppb__row">
              {nameBlock}
              {ovrBadge}
              {chipPos && (
                <span className="ppb__chip" aria-hidden="true">
                  <span className="ppb__chip-pos">{chipPos}</span>
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={root} style={vars}>
      <div className="ppb__field">
        {decor}
        <div className="ppb__content">
          {stage}
          <div className="ppb__top flex items-start gap-3">
            {ovrBadge}
            <div className="min-w-0 flex-1 space-y-1.5">
              {eyebrow && !sealed && <p className="ppb__eyebrow">{eyebrow}</p>}
              {(hof || retiredBy) && (
                <div className="flex flex-wrap gap-1.5">
                  {hof && (
                    <span className="ppb__tag ppb__hof-tag">
                      <Trophy className="h-3 w-3" aria-hidden="true" />
                      {size === 'hero' ? 'Hall of Fame' : 'HOF'}
                    </span>
                  )}
                  {retiredBy && !sealed && (
                    <span className="ppb__tag">
                      {size === 'hero' ? `Number retired by the ${retiredBy}` : `#${number ?? ''} retired`}
                    </span>
                  )}
                </div>
              )}
            </div>
            {topRight}
          </div>
          <div className="ppb__plate">
            {nameBlock}
            <span className="ppb__side">
              {statBlock}
              {chip}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProPlayerBanner;
