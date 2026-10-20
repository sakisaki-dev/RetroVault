import { useEffect, useId, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { isLite } from '@/hooks/usePerfMode';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { findNFLTeam } from '@/utils/nflTeams';
import type { GamePlayer } from '@/config/ovr';
import { finishLabel, tierLabel, variantLabel, variantShort, type Finish, type Tier, type Variant } from '@/utils/collection';
import VariantArt from './art/VariantArt';
import type { FaceStat } from './cardStats';
import { FINISH_ICON } from './rarityIcons';
import './collection.css';

const motionOk = () => {
  try {
    return !isLite() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
/** Surname for the name bar ("Odell Beckham Jr." → "Beckham"). */
const surnameOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  while (parts.length > 1 && SUFFIX.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] ?? name;
};

/**
 * League players have no photos: a game-worn jersey in team colours (shoulder stripes, collar, sleeve numbers and the
 * big chest number), shaded so it reads as fabric. Locked cards show the same jersey as a dark silhouette.
 */
export const PlayerJersey = ({ number, id }: { number?: number | null; id: string }) => (
  <svg className="fut__sil fut__jersey" viewBox="0 0 120 110" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-fab`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.35" />
      </linearGradient>
      <clipPath id={`${id}-clip`}>
        <path d="M38 8 C44 14 52 17 60 17 C68 17 76 14 82 8 L104 18 L118 46 L100 56 L96 48 L96 108 L24 108 L24 48 L20 56 L2 46 L16 18 Z" />
      </clipPath>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <rect className="fut__jersey-body" x="0" y="0" width="120" height="110" />
      {/* Shoulder / sleeve stripes */}
      <path className="fut__jersey-trim" d="M2 40 L22 30 L24 36 L4 46 Z M118 40 L98 30 L96 36 L116 46 Z" />
      <path className="fut__jersey-trim" d="M8 34 L20 28 L21 31 L9 37 Z M112 34 L100 28 L99 31 L111 37 Z" />
      {/* Side panels */}
      <path className="fut__jersey-panel" d="M24 60 L32 60 L32 108 L24 108 Z M88 60 L96 60 L96 108 L88 108 Z" />
      <rect x="0" y="0" width="120" height="110" fill={`url(#${id}-fab)`} />
    </g>
    {/* Collar */}
    <path className="fut__jersey-collar" d="M38 8 C44 14 52 17 60 17 C68 17 76 14 82 8 L78 6 C72 11 66 13 60 13 C54 13 48 11 42 6 Z" />
    <path className="fut__jersey-seam" d="M38 8 L16 18 L2 46 L20 56 L24 48 L24 108 L96 108 L96 48 L100 56 L118 46 L104 18 L82 8" fill="none" />
    {number != null && (
      <>
        <text x="60" y="80" textAnchor="middle" className="fut__jersey-num">
          {number}
        </text>
        <text x="11" y="47" textAnchor="middle" className="fut__jersey-sleeve" transform="rotate(-24 11 47)">
          {number}
        </text>
        <text x="109" y="47" textAnchor="middle" className="fut__jersey-sleeve" transform="rotate(24 109 47)">
          {number}
        </text>
      </>
    )}
  </svg>
);

const SPARKS = [
  [12, 18],
  [84, 12],
  [90, 46],
  [8, 58],
  [70, 30],
  [30, 8],
  [50, 88],
  [22, 82],
] as const;

export interface CollectibleCardProps {
  player: GamePlayer;
  /** Player tier (Common to Legendary): sets the card colour (bronze, silver, gold, black-gold icon) */
  tier: Tier;
  /** Finish (Base, Silver, Gold, Holo): the treatment on top; ignored while locked */
  finish: Finish;
  /** Art variant (Prizm number … Retro Bowl sprite); omitted = the plain baseline jersey */
  variant?: Variant;
  owned: boolean;
  ovr?: number | null;
  number?: number | null;
  /** Six face stats (cardStats.faceStatsFor) */
  stats?: FaceStat[];
  /** Set number, e.g. 12 of 185 */
  setNo?: number;
  setTotal?: number;
  /** Shown to screen readers on locked cards */
  hint?: string;
  /** Makes the card a button (Enter / click opens it); gets the card's on-screen box for the fly-in to the large view */
  onOpen?: (from?: DOMRect) => void;
  /** Large detail size: mouse / pen tilt, plus device tilt where allowed */
  large?: boolean;
  /** Keep shimmer/sparkle running (otherwise only on hover/focus, so a full binder stays idle) */
  live?: boolean;
  /** Pack reveal stamp ("New", "Upgrade", "Dupe +5") */
  badge?: string;
  /** Provenance badges (e.g. a Perfect Season pack) */
  marks?: string[];
  /** Custom player art (art lab); replaces the photo / jersey inside .fut__art when given */
  art?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * FUT-style collectible: a shield-shaped card with the OVR, position, team logo and jersey number top left,
 * player art (a real legend's photo, or a team-coloured silhouette), the surname on a name bar and six 0–99
 * face stats in two columns. The TIER sets the card (bronze, silver, gold, black-gold "icon" for Legendary,
 * with shimmer, sparkles, glow and a LEGEND ribbon); the FINISH adds a treatment (Silver sheen, Gold foil,
 * Holo prismatic overlay that follows the pointer / device tilt). Locked cards are dark silhouettes.
 */
const CollectibleCard = ({
  player,
  tier,
  finish,
  variant,
  owned,
  ovr,
  number,
  stats,
  setNo,
  setTotal,
  hint,
  onOpen,
  large = false,
  live = false,
  badge,
  marks,
  art,
  className,
  style,
}: CollectibleCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const realLegend = !!player.isRealLegend;
  const team = findNFLTeam(player.team);
  const photo = owned && realLegend && player.photo?.url ? player.photo : null;
  const jerseyId = `j${useId().replace(/:/g, '')}`;
  const posName = POSITION_NAMES[player.position] ?? player.position;
  const mark = owned && marks?.length ? marks[marks.length - 1] : null;
  const FinishIcon = FINISH_ICON[finish];
  const surname = surnameOf(player.name);
  // Every owned card tilts toward the pointer: mouse only in grids, mouse or pen at detail size. Never a finger: a
  // touch drag there is a scroll or a swipe-to-close, and phones tilt the large card with the device instead.
  const tilts = owned;

  const setVars = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--fut-rx', `${(0.5 - y) * (large ? 18 : 12)}deg`);
    el.style.setProperty('--fut-ry', `${(x - 0.5) * (large ? 22 : 14)}deg`);
    el.style.setProperty('--fut-mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--fut-my', `${(y * 100).toFixed(1)}%`);
    el.dataset.tilt = 'on';
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!tilts || !el || e.pointerType === 'touch' || (!large && e.pointerType !== 'mouse') || !motionOk()) return;
    const r = el.getBoundingClientRect();
    setVars((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    ['--fut-rx', '--fut-ry', '--fut-mx', '--fut-my'].forEach((k) => el.style.removeProperty(k));
    delete el.dataset.tilt;
  };

  // Large view: device tilt drives the same variables (iOS asks permission on the first tap)
  useEffect(() => {
    if (!large || !owned || typeof window === 'undefined' || !('DeviceOrientationEvent' in window) || !motionOk()) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const x = Math.min(1, Math.max(0, 0.5 + e.gamma / 50));
      const y = Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 60));
      setVars(x, y);
    };
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    let asked = false;
    const ask = () => {
      if (asked || typeof DOE.requestPermission !== 'function') return;
      asked = true;
      DOE.requestPermission()
        .then((r) => r === 'granted' && window.addEventListener('deviceorientation', onTilt))
        .catch(() => undefined);
    };
    const el = ref.current;
    if (typeof DOE.requestPermission === 'function') el?.addEventListener('pointerdown', ask);
    else window.addEventListener('deviceorientation', onTilt);
    return () => {
      el?.removeEventListener('pointerdown', ask);
      window.removeEventListener('deviceorientation', onTilt);
    };
    // setVars only touches the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [large, owned]);

  const vars = {
    ...style,
    ...(team ? { '--fut-a': `hsl(${team.primaryColor})`, '--fut-b': `hsl(${team.secondaryColor})` } : {}),
  } as CSSProperties;

  const setLabel = setNo != null && setTotal ? `card ${setNo} of ${setTotal}` : null;
  const label = owned
    ? `${player.name}, ${variant ? `${variantLabel(variant)} variant, ` : ''}${tierLabel(tier)} tier, ${finishLabel(finish)} finish, ${ovr != null ? `OVR ${ovr}, ` : ''}${posName}${team ? `, ${team.name}` : ''}${number != null ? `, number ${number}` : ''}${setLabel ? `, ${setLabel}` : ''}${mark ? `, ${mark}` : ''}${onOpen ? '. Open card' : ''}`
    : `Locked ${tierLabel(tier)} card, ${posName}${hint ? `. ${hint}` : ''}`;

  const face = (
    <span className="fut__shape" aria-hidden="true">
      <span className="fut__face">
        <span className="fut__pattern" />
        <span className={cn('fut__art', art == null && photo && 'fut__art--photo')}>
          {art != null ? (
            art
          ) : photo ? (
            <img src={photo.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} />
          ) : owned && variant ? (
            <VariantArt variant={variant} player={player} number={number} finish={finish} />
          ) : (
            <PlayerJersey number={owned ? number : null} id={jerseyId} />
          )}
        </span>
        <span className="fut__meta">
          <span className="fut__ovr">{owned ? (ovr ?? '–') : '?'}</span>
          <span className="fut__pos">{player.position}</span>
          {owned && (
            <span className="fut__logo">
              {realLegend && !team ? <span className="fut__star">★</span> : <TeamLogo team={player.team} size={48} decorative />}
            </span>
          )}
          {owned && number != null && <span className="fut__num">#{number}</span>}
        </span>
        <span className={cn('fut__name', surname.length > 9 && 'fut__name--long', surname.length > 12 && 'fut__name--xl')}>
          {owned ? surname : '? ? ?'}
        </span>
        <span className="fut__stats">
          {(stats ?? []).slice(0, 6).map((s) => (
            <span key={s.code} className="fut__stat">
              <b>{owned ? (s.value ?? '–') : '··'}</b>
              <span>{s.code}</span>
            </span>
          ))}
        </span>
        {owned && (
          <span className="fut__pip">
            <FinishIcon />
            {finishLabel(finish)}
            {variant && <span className="fut__vtag">· {variantShort(variant)}</span>}
          </span>
        )}
        {owned && finish !== 'base' && <span className="fut__foil" />}
        {owned && finish === 'holo' && <span className="fut__holo" />}
        {owned && <span className="fut__glare" />}
        {owned && tier === 'legendary' && (
          <span className="fut__sparks">
            {SPARKS.map(([x, y], i) => (
              <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 0.37).toFixed(2)}s` }} />
            ))}
          </span>
        )}
      </span>
    </span>
  );

  const extras = (
    <>
      {owned && tier === 'legendary' && (
        <span className="fut__ribbon" aria-hidden="true">
          {realLegend ? 'NFL Legend' : 'Legend'}
        </span>
      )}
      {badge && (
        <span className={cn('fut__badge', badge.startsWith('Dupe') && 'fut__badge--muted')} aria-hidden="true">
          {badge}
        </span>
      )}
      {mark && (
        <span className="fut__mark" aria-hidden="true" title={mark}>
          18–0
        </span>
      )}
    </>
  );

  return (
    <div
      ref={ref}
      className={cn(
        'fut',
        owned ? [`fut--${tier}`, `fut--f-${finish}`, variant && `fut--v-${variant}`] : 'fut--locked',
        realLegend && owned && 'fut--nfl',
        large && 'fut--lg',
        live && 'fut--live',
        className,
      )}
      style={vars}
      onPointerMove={tilts ? onMove : undefined}
      onPointerLeave={tilts ? onLeave : undefined}
    >
      {onOpen ? (
        <button type="button" className="fut__card" onClick={() => onOpen(ref.current?.getBoundingClientRect())} aria-label={label}>
          {face}
          {extras}
        </button>
      ) : (
        <div className="fut__card" role="img" aria-label={label}>
          {face}
          {extras}
        </div>
      )}
    </div>
  );
};

export default CollectibleCard;
