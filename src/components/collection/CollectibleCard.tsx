import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import { POSITION_NAMES } from '@/utils/playerMeta';
import type { GamePlayer } from '@/config/ovr';
import { RARITIES, type Rarity } from '@/utils/collection';
import { RARITY_ICON } from './rarityIcons';
import './collection.css';


/** "Author · License" for a legend's Commons photo (kept inside the card). */
const photoCreditOf = (p: GamePlayer): string | null => {
  const ph = p.photo;
  if (!ph?.url) return null;
  const parts = [ph.author, ph.license].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Wikimedia Commons';
};

const canTilt = () => {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export interface CollectibleCardProps {
  player: GamePlayer;
  rarity: Rarity;
  owned: boolean;
  ovr?: number | null;
  number?: number | null;
  retiredBy?: string | null;
  /** Set number, e.g. 12 of 196 */
  setNo?: number;
  setTotal?: number;
  /** Shown on locked cards */
  hint?: string;
  /** Owned cards become buttons when given */
  onOpen?: () => void;
  /** Compact banner, used in toasts */
  mini?: boolean;
  /** Pack reveal "new" stamp */
  badge?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A collectible frame around ProPlayerBanner. Rarity sets the treatment: Base matte, Silver brushed
 * metal, Gold foil, Hall of Fame holographic shimmer (pointer-tilt parallax on desktop) and Legend
 * black-gold with the player's Commons photo. Locked cards show the sealed banner and an unlock hint.
 */
const CollectibleCard = ({
  player,
  rarity,
  owned,
  ovr,
  number,
  retiredBy,
  setNo,
  setTotal,
  hint,
  onOpen,
  mini = false,
  badge,
  className,
  style,
}: CollectibleCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const meta = RARITIES.find((r) => r.key === rarity)!;
  const Icon = RARITY_ICON[rarity];
  const legend = rarity === 'legend';
  const tilts = owned && !mini && (rarity === 'hof' || legend || rarity === 'gold');
  const photo = owned && legend && player.photo?.url ? player.photo : null;
  const posName = POSITION_NAMES[player.position] ?? player.position;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!tilts || !el || e.pointerType !== 'mouse' || !canTilt()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--cc-rx', `${(0.5 - y) * 10}deg`);
    el.style.setProperty('--cc-ry', `${(x - 0.5) * 12}deg`);
    el.style.setProperty('--cc-mx', `${x * 100}%`);
    el.style.setProperty('--cc-my', `${y * 100}%`);
    el.dataset.tilt = 'on';
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty('--cc-rx');
    el.style.removeProperty('--cc-ry');
    el.style.removeProperty('--cc-mx');
    el.style.removeProperty('--cc-my');
    delete el.dataset.tilt;
  };

  const setLabel = setNo != null && setTotal ? `${String(setNo).padStart(3, '0')}/${setTotal}` : null;
  const banner = owned ? (
    <ProPlayerBanner
      size={mini ? 'compact' : 'card'}
      name={player.name}
      nickname={player.nickname}
      position={player.position}
      team={player.team}
      number={number}
      ovr={ovr}
      hallOfFamer={rarity === 'hof'}
      retiredBy={!legend ? retiredBy : null}
      photoUrl={photo?.url ?? null}
      photoCredit={photo ? photoCreditOf(player) : null}
      interactive={!!onOpen}
    />
  ) : (
    <ProPlayerBanner size={mini ? 'compact' : 'card'} name="Mystery player" position="" sealed sealedHint={player.position} />
  );

  const label = owned
    ? `${player.name}, ${posName}, ${meta.label} card${ovr != null ? `, OVR ${ovr}` : ''}${setLabel ? `, card ${setNo} of ${setTotal}` : ''}${onOpen ? '. Open player details' : ''}`
    : `Locked ${meta.label} card, ${posName}${hint ? `. ${hint}` : ''}`;

  const body = (
    <>
      <span className="cc__frame">
        {banner}
        {owned && rarity !== 'base' && <span className="cc__foil" aria-hidden="true" />}
        {owned && (rarity === 'hof' || legend || rarity === 'gold') && <span className="cc__glare" aria-hidden="true" />}
      </span>
      <span className="cc__foot" aria-hidden="true">
        <span className="cc__rarity">
          {owned ? <Icon className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {meta.short}
        </span>
        {badge && <span className={cn('cc__badge', badge === 'Dupe' && 'cc__badge--muted')}>{badge}</span>}
        {!mini && !owned && hint && <span className="cc__hint">{hint}</span>}
        {setLabel && (owned || mini) && <span className="cc__setno">{setLabel}</span>}
      </span>
    </>
  );

  return (
    <div
      ref={ref}
      className={cn('cc', `cc--${rarity}`, !owned && 'cc--locked', mini && 'cc--mini', className)}
      style={style}
      onPointerMove={tilts ? onMove : undefined}
      onPointerLeave={tilts ? onLeave : undefined}
    >
      {owned && onOpen ? (
        <button type="button" className="cc__card" onClick={onOpen} aria-label={label}>
          {body}
        </button>
      ) : (
        <div className="cc__card" role="img" aria-label={label}>
          {body}
        </div>
      )}
    </div>
  );
};

export default CollectibleCard;
