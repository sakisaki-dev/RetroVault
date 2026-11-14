import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { reducedMotion } from '@/utils/motion';
import { bannerTeamOf } from '@/utils/playerExtras';
import { faceFor, nflSpriteFor, poseForPosition, useGameSprites, type BodyPose, type FaceSubject } from '@/utils/gameSprites';

/**
 * Retro Bowl's own sprite for a player (the owner's private sprites, src/utils/gameSprites.ts). Renders nothing when
 * this machine has none (the public site), so callers can drop it in anywhere; useGameSprites() lets them choose a
 * fallback. Pixel-crisp: integer scales, image-rendering: pixelated.
 *
 * Source, in order: his sprite from the owner's NFL save (his banner club's kit, else his current club's, else the
 * neutral white kit), else the regular game's sheets recoloured to the club's kit, else nothing.
 *
 *   kind 'face'    a bust: the NFL sprite's head and shoulders (32 x 36 crop), or the regular portrait
 *   kind 'figure'  the whole player: the NFL sprite (64 x 64), or the regular portrait (with `withBody`, an on-field
 *                  pose beside it); `animate` cycles the NFL sprite's poses in that kit
 *   kind 'body'    an on-field pose: the NFL sprite, or the regular pose (default from his position)
 *   kind 'helmet'  the club's big helmet (regular sheets only)
 */
export interface GameSpriteProps {
  player: FaceSubject & { team?: string; bannerTeam?: string };
  /** Club whose kit he wears (default: his banner club); his current club is the next choice */
  team?: string;
  kind?: 'face' | 'figure' | 'body' | 'helmet';
  pose?: BodyPose;
  /** Fixed frame of a regular pose (default 0) */
  frame?: number;
  animate?: boolean;
  /** Frames per second of a regular pose when animating */
  fps?: number;
  /** Integer scale of the regular sprite and of the NFL bust crop */
  scale?: number;
  /** Integer scale of the full NFL sprite (64 x 64; default: scale) */
  nflScale?: number;
  /** 'figure' fallback: the regular on-field pose beside the portrait */
  withBody?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** The NFL sprite's head and shoulders: x 17-48, y 6-41 of the 64 x 64 frame (the body spans x 18-51, y 8-59). */
const BUST = { x: 17, y: 6, w: 32, h: 36 };
const NFL_POSE_MS = 2400;

const useTicker = (on: boolean, ms: number) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on || reducedMotion()) return;
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [on, ms]);
  return tick;
};

const pixel = (w: number, h: number, extra?: CSSProperties): CSSProperties => ({ imageRendering: 'pixelated', width: w, height: h, ...extra });

const GameSprite = ({ player, team, kind = 'face', pose, frame = 0, animate = false, fps = 8, scale = 2, nflScale, withBody = false, className, style }: GameSpriteProps) => {
  const sprites = useGameSprites();
  const club = team ?? bannerTeamOf(player);
  const { name, position, spriteSkin, gameFace } = player;
  const current = player.team;

  const nfl = useMemo(
    () => (kind === 'helmet' ? null : nflSpriteFor(sprites?.nfl ?? null, `${position ?? ''}:${name}`, [club, current])),
    [sprites, kind, position, name, club, current],
  );

  const regular = useMemo(() => {
    const r = sprites?.regular;
    if (!r || nfl) return { main: [], body: [] };
    const face = faceFor({ name, position, spriteSkin, gameFace }, r.skins);
    if (kind === 'helmet') return { main: [r.art.helmetImage(r, club)], body: [] };
    if (kind === 'body') return { main: r.art.bodyFrames(r, face, club, pose ?? poseForPosition(position)), body: [] };
    return {
      main: [r.art.facePortrait(r, face, club)],
      body: kind === 'figure' && withBody ? r.art.bodyFrames(r, face, club, pose ?? poseForPosition(position)) : [],
    };
  }, [sprites, nfl, kind, club, pose, name, position, spriteSkin, gameFace, withBody]);

  const s = Math.max(1, Math.round(scale));
  const nflCycles = !!nfl && animate && kind !== 'face' && nfl.poses.length > 1;
  const nflTick = useTicker(nflCycles, NFL_POSE_MS);
  const regularMoving = animate && (regular.main.length > 1 || regular.body.length > 1);
  const tick = useTicker(regularMoving, 1000 / Math.max(1, fps));

  const cls = cn('game-sprite pointer-events-none select-none', className);

  if (nfl) {
    if (kind === 'face') {
      return (
        <span aria-hidden="true" className={cn(cls, 'relative inline-block overflow-hidden')} style={{ width: BUST.w * s, height: BUST.h * s, ...style }}>
          <img src={nfl.src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute max-w-none" style={pixel(64 * s, 64 * s, { left: -BUST.x * s, top: -BUST.y * s })} />
        </span>
      );
    }
    const n = Math.max(1, Math.round(nflScale ?? scale));
    const src = nflCycles ? nfl.poses[nflTick % nfl.poses.length] : nfl.src;
    return <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} width={64 * n} height={64 * n} className={cls} style={pixel(64 * n, 64 * n, style)} />;
  }

  if (!regular.main.length) return null;
  const img = regular.main[(regularMoving ? tick : frame) % regular.main.length];
  const main = <img src={img.src} alt="" aria-hidden="true" draggable={false} width={img.w * s} height={img.h * s} className={cls} style={pixel(img.w * s, img.h * s, style)} />;
  if (!regular.body.length) return main;
  const b = regular.body[(regularMoving ? tick : frame) % regular.body.length];
  const bs = Math.max(1, s - 1);
  return (
    <>
      <img src={b.src} alt="" aria-hidden="true" draggable={false} width={b.w * bs} height={b.h * bs} className={cls} style={pixel(b.w * bs, b.h * bs)} />
      {main}
    </>
  );
};

export default GameSprite;
