import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { GamePlayer } from '@/config/ovr';
import { bodyFor } from '@/config/bodyTypes';
import { SPRITE_BASELINE, nflSpriteFor, useGameSprites, type SpriteAction } from '@/utils/gameSprites';
import type { Uniform } from '../art/sprite/uniforms';

/**
 * The walkout runner: his Retro Bowl sprite (the owner's private sprites, GameSprite's source and rules) in the kit the
 * pull rolled: home is his club's kit as the save drew it (else the neutral kit painted), an alternate or a throwback
 * paints the neutral kit into that uniform (toppsPortrait.ts paintUniform), then his body roll (gameKitPaint.ts
 * processSprite). A whole figure in the 64-unit box at 3x (GameSprite size l), centred on his centre line and stood on
 * the shared baseline. Only in a build with the private sprites; nothing for a real NFL legend (cards are league
 * players) or a player the save can't draw, and the caller falls back to the old silhouette.
 */
export const KIT_SPRITES = typeof __PRIVATE_SPRITES__ !== 'undefined' && __PRIVATE_SPRITES__;

const U = 3;

interface Job {
  key: string;
  src: string;
  uniform?: Uniform;
  paint?: string;
  rows: number;
  cols: number;
  cx: number;
  foot: number;
}

const cache = new Map<string, Promise<string | null>>();
const run = (job: Job): Promise<string | null> => {
  let p = cache.get(job.key);
  if (!p) {
    p = (async () => {
      const painted = job.uniform ? await import('@/utils/toppsPortrait').then((m) => m.paintUniform(job.src, job.uniform!)) : job.src;
      const m = await import('@/utils/gameKitPaint');
      return m.processSprite(painted, { paint: job.paint, rows: job.rows, cols: job.cols, cx: job.cx, foot: job.foot });
    })().catch(() => null);
    cache.set(job.key, p);
    if (cache.size > 60) cache.delete(cache.keys().next().value!);
  }
  return p;
};

/** The figure for `action` in `uniform`: 'none' when it can't be drawn here, 'loading', or the image and its anchors. */
export const useKitFigure = (player: GamePlayer, uniform: Uniform | null, action: SpriteAction) => {
  const sprites = useGameSprites();
  const job = useMemo<Job | null>(() => {
    const nfl = sprites?.nfl;
    if (!KIT_SPRITES || !nfl || player.isRealLegend || !uniform) return null;
    const key = `${player.position}:${player.name}`;
    const looks = sprites?.looks ?? sprites?.regular?.skins;
    const locked = looks?.[player.name]?.skin;
    const tone = typeof locked === 'string' ? locked : player.spriteSkin;
    const home = uniform.id === 'home';
    const pick = home ? nflSpriteFor(nfl, key, player.team, player.team, action, false, tone, 1) : nflSpriteFor(nfl, key, undefined, undefined, action, false, tone, 1);
    if (!pick) return null;
    const body = bodyFor(key, looks?.[player.name]);
    const paintKit = !home && pick.kit === 'neutral';
    return {
      key: `${pick.src}|${home ? pick.paint ?? '' : uniform.id + JSON.stringify(uniform.jersey + uniform.pants + uniform.trim)}|${body.rows},${body.cols}`,
      src: pick.src,
      uniform: paintKit ? uniform : undefined,
      paint: home ? pick.paint : undefined,
      rows: body.rows,
      cols: body.cols,
      cx: pick.cx,
      foot: pick.foot,
    };
  }, [sprites, player.position, player.name, player.team, player.spriteSkin, player.isRealLegend, uniform, action]);
  const [out, setOut] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!job) return;
    let live = true;
    run(job).then((url) => live && setOut({ key: job.key, url }));
    return () => {
      live = false;
    };
    // job.key stands for the job
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.key]);
  if (!KIT_SPRITES || (sprites && !sprites.nfl) || (sprites && !job)) return { status: 'none' as const };
  if (!job || !out || out.key !== job.key) return { status: 'loading' as const };
  return out.url ? { status: 'ready' as const, url: out.url, cx: job.cx, foot: job.foot } : { status: 'none' as const };
};

export type KitFigure = ReturnType<typeof useKitFigure>;

/** Draws a ready figure (64-unit box at 3x, pixel-crisp). */
export const KitFigureImg = ({ fig, className, style }: { fig: KitFigure; className?: string; style?: CSSProperties }) => {
  if (fig.status !== 'ready') return null;
  return (
    <span className={className} style={{ position: 'relative', display: 'block', width: 64 * U, height: 64 * U, ...style }}>
      <img
        src={fig.url}
        alt=""
        draggable={false}
        decoding="async"
        style={{
          position: 'absolute',
          maxWidth: 'none',
          imageRendering: 'pixelated',
          width: 64 * U,
          height: 64 * U,
          left: Math.round((32 - fig.cx) * U),
          top: (SPRITE_BASELINE - 1 - fig.foot) * U,
        }}
      />
    </span>
  );
};
