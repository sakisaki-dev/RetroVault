import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { SPRITE_BASELINE as BASELINE, SPRITE_BUST as BUST, coachSpriteFor, useGameSprites, type CoachPick } from '@/utils/gameSprites';
import { SPRITE_UNIT, type SpriteSize } from './GameSprite';

/**
 * Retro Bowl's own sprite for the head coach or a coordinator (gameSprites.ts coachSpriteFor): the standing figure the
 * owner's save draws in a club polo, his glasses, beard and hair his own. The club's polo as the save drew it, else his
 * white neutral painted in that club's polo colour exactly as the game paints one (gameKitPaint.ts), else the white
 * neutral. Same size system as GameSprite (figure 64 x 64 / bust 32 x 36 units, s / m / l = 1x / 2x / 3x, centred on
 * his own centre line, feet on row BASELINE) and gated the same way: nothing renders when the sprites are absent.
 */
export interface CoachSpriteProps {
  /** 'head' for the head coach (settings.myface_uid), else a coordinator's name */
  who: string;
  /** Club whose polo he wears (a coordinator defaults to his own club; pass the head coach's) */
  team?: string | null;
  kind?: 'figure' | 'bust';
  size?: SpriteSize;
  className?: string;
  style?: CSSProperties;
  /** A tooltip (and the figure is then exposed to assistive tech under it); unset = decorative */
  title?: string;
}

const usePainted = (pick: CoachPick | null): string | null => {
  const [out, setOut] = useState<{ key: string; url: string } | null>(null);
  const key = pick?.polo ? `${pick.src}|${pick.polo.color}` : '';
  useEffect(() => {
    if (!key || !pick?.polo) return;
    let live = true;
    const { src, polo } = pick;
    import('@/utils/gameKitPaint')
      .then((m) => m.processSprite(src, { polo }))
      .then((url) => live && setOut({ key, url }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key, pick]);
  if (!pick) return null;
  if (!pick.polo) return pick.src;
  return out && out.key === key ? out.url : null;
};

const px = (extra?: CSSProperties): CSSProperties => ({ imageRendering: 'pixelated', ...extra });

const CoachSprite = ({ who, team, kind = 'figure', size = 'm', className, style, title }: CoachSpriteProps) => {
  const sprites = useGameSprites();
  const pick = useMemo(() => coachSpriteFor(sprites?.nfl ?? null, who, team), [sprites, who, team]);
  const src = usePainted(pick);
  if (!pick) return null;
  const u = SPRITE_UNIT[size];
  const cls = cn('game-sprite coach-sprite pointer-events-none relative inline-block shrink-0 select-none', className);
  if (kind === 'bust') {
    return (
      <span aria-hidden={!title} title={title} className={cn(cls, 'overflow-hidden')} style={{ width: BUST.w * u, height: BUST.h * u, ...style }}>
        {src && (
          <img
            src={src}
            alt=""
            decoding="async"
            draggable={false}
            className="absolute max-w-none"
            style={px({ width: 64 * u, height: 64 * u, left: -Math.round((pick.cx - BUST.w / 2) * u), top: -BUST.y * u })}
          />
        )}
      </span>
    );
  }
  return (
    <span aria-hidden={!title} title={title} data-unit={u} className={cls} style={{ width: 64 * u, height: 64 * u, ...style }}>
      {src && (
        <img
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          className="absolute max-w-none"
          style={px({ width: 64 * u, height: 64 * u, left: Math.round((32 - pick.cx) * u), top: (BASELINE - 1 - pick.foot) * u })}
        />
      )}
    </span>
  );
};

export default CoachSprite;
