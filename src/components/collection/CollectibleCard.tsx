import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { findNFLTeam } from '@/utils/nflTeams';
import type { GamePlayer } from '@/config/ovr';
import { finishLabel, tierLabel, type Finish, type Tier } from '@/utils/collection';
import type { FaceStat } from './cardStats';
import { FINISH_ICON } from './rarityIcons';
import './collection.css';

const motionOk = () => {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/** Generic helmet-and-shoulders bust for league players (no photos exist); filled with team colours by CSS. */
const PlayerSilhouette = ({ number }: { number?: number | null }) => (
  <svg className="fut__sil" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <path className="fut__sil-body" d="M6 100 C8 80 20 71 36 67 L64 67 C80 71 92 80 94 100 Z" />
    <path className="fut__sil-body" d="M42 54 h16 v15 h-16 Z" />
    <path className="fut__sil-helmet" d="M28 40 C28 22 40 12 53 12 C68 12 77 24 77 37 C77 46 74 52 69 56 L52 59 C45 59 38 56 34 52 C30 48 28 45 28 40 Z" />
    <path className="fut__sil-mask" d="M63 39 L81 41 M63 46 L79 47 M70 35 L72 55" fill="none" />
    <path className="fut__sil-stripe" d="M50 12 C46 22 45 32 46 44" fill="none" />
    {number != null && (
      <text x="50" y="96" textAnchor="middle" className="fut__sil-num">
        {number}
      </text>
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
  /** Makes the card a button (Enter / click opens it) */
  onOpen?: () => void;
  /** Large detail size: pointer tilt on any input, plus device tilt where allowed */
  large?: boolean;
  /** Keep shimmer/sparkle running (otherwise only on hover/focus, so a full binder stays idle) */
  live?: boolean;
  /** Pack reveal stamp ("New", "Upgrade", "Dupe +5") */
  badge?: string;
  /** Provenance badges (e.g. a Perfect Season pack) */
  marks?: string[];
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
  className,
  style,
}: CollectibleCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const realLegend = !!player.isRealLegend;
  const team = findNFLTeam(player.team);
  const photo = owned && realLegend && player.photo?.url ? player.photo : null;
  const posName = POSITION_NAMES[player.position] ?? player.position;
  const mark = owned && marks?.length ? marks[marks.length - 1] : null;
  const FinishIcon = FINISH_ICON[finish];
  const surname = surnameOf(player.name);
  const tilts = owned && (large || finish === 'holo' || tier === 'legendary' || finish === 'gold');

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
    if (!tilts || !el || (!large && e.pointerType !== 'mouse') || !motionOk()) return;
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
    ? `${player.name}, ${tierLabel(tier)} ${finishLabel(finish)} card, ${ovr != null ? `OVR ${ovr}, ` : ''}${posName}${team ? `, ${team.name}` : ''}${number != null ? `, number ${number}` : ''}${setLabel ? `, ${setLabel}` : ''}${mark ? `, ${mark}` : ''}${onOpen ? '. Open card' : ''}`
    : `Locked ${tierLabel(tier)} card, ${posName}${hint ? `. ${hint}` : ''}`;

  const face = (
    <span className="fut__shape" aria-hidden="true">
      <span className="fut__face">
        <span className="fut__pattern" />
        <span className="fut__art">
          {photo ? (
            <img src={photo.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} />
          ) : (
            <PlayerSilhouette number={owned ? number : null} />
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
        owned ? [`fut--${tier}`, `fut--f-${finish}`] : 'fut--locked',
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
        <button type="button" className="fut__card" onClick={onOpen} aria-label={label}>
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
