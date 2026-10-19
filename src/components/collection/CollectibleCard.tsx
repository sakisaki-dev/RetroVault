import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import { POSITION_NAMES } from '@/utils/playerMeta';
import type { GamePlayer } from '@/config/ovr';
import { isHallOfFamer } from '@/config/stats';
import { finishLabel, tierLabel, type Finish, type Tier } from '@/utils/collection';
import { FINISH_ICON } from './rarityIcons';
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

const TIER_SHORT: Record<Tier, string> = { common: 'Com', rare: 'Rare', epic: 'Epic', legendary: 'Leg' };

export interface CollectibleCardProps {
  player: GamePlayer;
  /** Player tier (Common to Legendary) */
  tier: Tier;
  /** Finish shown (the best owned in the binder); ignored while locked */
  finish: Finish;
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
  /** Pack reveal stamp ("New", "Upgrade", "Dupe +5") */
  badge?: string;
  /** Provenance badges (e.g. a Perfect Season pack) */
  marks?: string[];
  className?: string;
  style?: CSSProperties;
}

/**
 * A collectible frame around ProPlayerBanner. The finish sets the treatment: Base matte (real NFL
 * legends get a black-gold Legend frame instead), Silver brushed metal, Gold foil, Holo animated
 * holographic shimmer (pointer-tilt parallax on desktop). The footer shows finish and player tier.
 * Locked cards show the sealed banner and the tier's pull odds.
 */
const CollectibleCard = ({
  player,
  tier,
  finish,
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
  marks,
  className,
  style,
}: CollectibleCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const realLegend = !!player.isRealLegend;
  // Frame treatment: the finish, except a real legend's Base is the black-gold Legend frame
  const look = !owned ? 'base' : finish === 'base' && realLegend ? 'legend' : finish;
  const Icon = FINISH_ICON[finish];
  const shiny = look === 'holo' || look === 'legend' || look === 'gold';
  const tilts = owned && !mini && shiny;
  const photo = owned && realLegend && player.photo?.url ? player.photo : null;
  const mark = owned && marks?.length ? marks[marks.length - 1] : null;
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
      hallOfFamer={!realLegend && isHallOfFamer(player)}
      retiredBy={!realLegend ? retiredBy : null}
      photoUrl={photo?.url ?? null}
      photoCredit={photo ? photoCreditOf(player) : null}
      interactive={!!onOpen}
    />
  ) : (
    <ProPlayerBanner size={mini ? 'compact' : 'card'} name="Mystery player" position="" sealed sealedHint={player.position} />
  );

  const label = owned
    ? `${player.name}, ${posName}, ${finishLabel(finish)} finish, ${tierLabel(tier)} player${ovr != null ? `, OVR ${ovr}` : ''}${setLabel ? `, card ${setNo} of ${setTotal}` : ''}${mark ? `, ${mark}` : ''}${onOpen ? '. Open player details' : ''}`
    : `Locked ${tierLabel(tier)} card, ${posName}${hint ? `. ${hint}` : ''}`;

  const body = (
    <>
      <span className="cc__frame">
        {banner}
        {owned && look !== 'base' && <span className="cc__foil" aria-hidden="true" />}
        {owned && shiny && <span className="cc__glare" aria-hidden="true" />}
      </span>
      <span className="cc__foot" aria-hidden="true">
        <span className="cc__rarity">
          {owned ? <Icon className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {owned ? finishLabel(finish) : 'Locked'}
        </span>
        <span className={cn('cc__tier', `cc__tier--${tier}`)}>{TIER_SHORT[tier]}</span>
        {mark && (
          <span className="cc__mark" title={mark}>
            18–0
          </span>
        )}
        {badge && <span className={cn('cc__badge', badge.startsWith('Dupe') && 'cc__badge--muted')}>{badge}</span>}
        {!mini && !owned && hint && <span className="cc__hint">{hint}</span>}
        {setLabel && (owned || mini) && !badge && <span className="cc__setno">{setLabel}</span>}
      </span>
    </>
  );

  return (
    <div
      ref={ref}
      className={cn('cc', `cc--${look}`, !owned && 'cc--locked', mini && 'cc--mini', className)}
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
