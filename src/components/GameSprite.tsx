import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { reducedMotion } from '@/utils/motion';
import { bannerTeamOf } from '@/utils/playerExtras';
import { findNFLTeam } from '@/utils/nflTeams';
import { bodyFor, rolePose } from '@/config/bodyTypes';
import { REGULAR_POSE, faceFor, nflSpriteFor, useGameSprites, type BodyPose, type FaceSubject, type SpriteAction } from '@/utils/gameSprites';

/**
 * Retro Bowl's own sprite for a player (the owner's private sprites, src/utils/gameSprites.ts). Renders nothing when
 * this machine has none (the public site), so callers can drop it in anywhere; useGameSprites() lets them choose a
 * fallback. Pixel-crisp (integer scales, image-rendering: pixelated), reduced-motion safe.
 *
 * Source, in order: the kit the owner's NFL save drew for his club; the save's neutral kit painted into the club's
 * colours (gameKitPaint.ts); for a league player the save doesn't have, one of the game's own look templates (a
 * stand-in, painted the same way), so every player is drawn in one style; the regular game's sprite recoloured to the
 * club's kit only when the save's sprites are absent; nothing.
 *
 * ONE STYLE, ONE SIZE SYSTEM. Two looks, three sizes (`size`: s = 1x, m = 2x, l = 3x):
 *   figure  the whole player in a 64 x 64 box (s 64 px, m 128, l 192), feet on the box's baseline (row 59). The NFL
 *           sprite fills it; the regular fallback is his full-body on-field sprite at three times the unit (it is
 *           16 px tall to the NFL's 51), never a portrait, so both styles stand the same height side by side.
 *   bust    head and shoulders in a 32 x 36 box (s 32 x 36, m 64 x 72, l 96 x 108): the NFL sprite cropped at the same
 *           rows for everyone, or the regular portrait. Only where every player in the view is a bust.
 *   Sizes in use: s for list rows, search, slabs, the formation and team photos; m for banners, Hall of Fame busts,
 *   game cards and the Deep Dive on a phone; l for the Deep Dive hero and the player card stage.
 *
 * `action` picks a pose with meaning (gameSprites.ts SpriteAction); the regular game's celebrate, run and stiff arm
 * animate, nothing cycles at random, and reduced motion shows the first frame.
 */
export type SpriteSize = 's' | 'm' | 'l';
export const SPRITE_UNIT: Record<SpriteSize, number> = { s: 1, m: 2, l: 3 };

export interface GameSpriteProps {
  player: FaceSubject & { team?: string; bannerTeam?: string };
  /** Club whose kit he wears (default: his banner club); his current club is used only when that is unknown */
  team?: string;
  kind?: 'figure' | 'bust' | 'helmet' | 'face' | 'body';
  size?: SpriteSize;
  action?: SpriteAction;
  /** A real NFL legend: his save sprite, for the arcade games only (never league pages or the Collection) */
  legend?: boolean;
  /** A small tag when the kit isn't his club's (an unpainted neutral kit, another club's kit) */
  showKit?: boolean;
  className?: string;
  style?: CSSProperties;
  // ---- v1 props, still read (other pages use them): kind 'face' = bust, 'body' = figure; pose → action; scale /
  // nflScale → size; animate and fps are ignored (poses carry meaning now) ----
  /** @deprecated use action */
  pose?: BodyPose;
  /** @deprecated use size */
  scale?: number;
  /** @deprecated use size */
  nflScale?: number;
  /** @deprecated */
  animate?: boolean;
  /** @deprecated */
  fps?: number;
  /** @deprecated */
  withBody?: boolean;
}

const LEGACY_ACTION: Partial<Record<BodyPose, SpriteAction>> = { celebrate: 'celebrate', run: 'run', jump: 'run', dive: 'run', stiffarm: 'stiffarm' };
const sizeOf = (n: number | undefined): SpriteSize | undefined => (n === undefined ? undefined : n <= 1 ? 's' : n === 2 ? 'm' : 'l');

/** The NFL sprite's head and shoulders: 32 x 36 from row 6, centred on his centre line (the body spans y 8-58). */
const BUST = { y: 6, w: 32, h: 36 };
/**
 * Every figure is centred on its own centre line (the middle of his legs: index anchors for the NFL sprites, measured
 * per frame for the regular ones), not on its canvas, and stands with the bottom of his feet on row BASELINE of the
 * 64-unit box, so every sprite sits centred in its slot at every size.
 */
const BASELINE = 59;

const useTicker = (on: boolean, fps: number) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on || reducedMotion()) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000 / fps);
    return () => window.clearInterval(id);
  }, [on, fps]);
  return tick;
};

/**
 * The NFL sprite as drawn: painted into his club's kit when it is the neutral one, and reshaped to his body roll
 * (config/bodyTypes.ts) pixel for pixel (gameKitPaint.ts processSprite, cached per file x club x body). Null until
 * ready; the plain file when there is nothing to do.
 */
const useProcessed = (src: string | undefined, paint: string | undefined, rows: number, cols: number, cx: number, foot: number): string | null => {
  const [out, setOut] = useState<{ key: string; url: string } | null>(null);
  const plain = !!src && !paint && !rows && !cols;
  const key = src && !plain ? `${src}|${paint ?? ''}|${rows},${cols}|${cx},${foot}` : '';
  useEffect(() => {
    if (!key) return;
    let live = true;
    import('@/utils/gameKitPaint')
      .then((m) => m.processSprite(src!, { paint, rows, cols, cx, foot }))
      .then((url) => live && setOut({ key, url }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key, src, paint, rows, cols, cx, foot]);
  if (plain) return src;
  return out && out.key === key ? out.url : null;
};

/*
 * Sprite images are not lazy: each is a small file or an already-processed data URL in a fixed box, and a lazy one
 * arriving mid-scroll repainted the page under the finger.
 */
const px = (extra?: CSSProperties): CSSProperties => ({ imageRendering: 'pixelated', ...extra });

const GameSprite = (props: GameSpriteProps) => {
  const { player, team, legend = false, showKit = false, className, style } = props;
  const kind = props.kind === 'face' ? 'bust' : props.kind === 'body' || !props.kind ? 'figure' : props.kind;
  const size: SpriteSize = props.size ?? (kind === 'bust' ? sizeOf(props.scale) : sizeOf(props.nflScale ?? props.scale)) ?? 'm';
  const action: SpriteAction = props.action ?? (props.pose ? LEGACY_ACTION[props.pose] ?? 'idle' : 'idle');
  const sprites = useGameSprites();
  const club = team ?? bannerTeamOf(player);
  const { name, position, spriteSkin, gameFace } = player;
  const current = player.team;
  const u = SPRITE_UNIT[size];

  const nfl = useMemo(
    () => {
      if (kind === 'helmet') return null;
      const locked = (sprites?.looks ?? sprites?.regular?.skins)?.[name]?.skin;
      const tone = typeof locked === 'string' ? locked : spriteSkin;
      // playstyle: a figure standing idle holds his role's pose (bodyTypes.ts rolePose); busts stand
      const role = kind === 'figure' ? rolePose(position) : 1;
      return nflSpriteFor(sprites?.nfl ?? null, `${position ?? ''}:${name}`, club, current, kind === 'bust' ? 'idle' : action, legend, tone, role);
    },
    [sprites, kind, position, name, club, current, action, legend, spriteSkin],
  );
  // his body (bodyTypes.ts): the stable roll for his position, or his locked look (sprites.json)
  const body = useMemo(
    () => bodyFor(`${position ?? ''}:${name}`, (sprites?.looks ?? sprites?.regular?.skins)?.[name]),
    [sprites, position, name],
  );
  const shaped = useProcessed(nfl?.src, nfl?.paint, nfl ? body.rows : 0, nfl ? body.cols : 0, nfl?.cx ?? 31.5, nfl?.foot ?? 58);

  const regular = useMemo(() => {
    const r = sprites?.regular;
    if (!r || nfl || legend) return [];
    const face = faceFor({ name, position, spriteSkin, gameFace }, r.skins);
    if (kind === 'helmet') return [r.art.helmetImage(r, club)];
    if (kind === 'bust') return [r.art.facePortrait(r, face, club)];
    const frames = r.art.bodyFrames(r, face, club, REGULAR_POSE[action]);
    return action === 'idle' ? frames.slice(0, 1) : frames;
  }, [sprites, nfl, legend, kind, club, action, name, position, spriteSkin, gameFace]);

  const tick = useTicker(regular.length > 1, action === 'run' ? 10 : 6);
  const cls = cn('game-sprite pointer-events-none relative inline-block shrink-0 select-none', className);

  const kitTag = (() => {
    if (!showKit || !nfl) return null;
    if (nfl.kit === 'neutral') return 'Away';
    const want = findNFLTeam(club || current)?.id;
    const drawn = findNFLTeam(nfl.kit);
    return want && drawn && drawn.id !== want ? `${drawn.abbreviation} kit` : null;
  })();
  const tag = kitTag ? (
    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-black/80 px-1 font-pixel text-[7px] uppercase leading-[11px] text-white">{kitTag}</span>
  ) : null;

  if (nfl) {
    const src = shaped;
    if (kind === 'bust') {
      return (
        <span aria-hidden="true" className={cn(cls, 'overflow-hidden')} style={{ width: BUST.w * u, height: BUST.h * u, ...style }}>
          {src && (
            <img
              src={src}
              alt=""
              decoding="async"
              draggable={false}
              className="absolute max-w-none"
              // a taller body lifts the head by its extra rows: the crop follows the head
              style={px({ width: 64 * u, height: 64 * u, left: -Math.round((nfl.cx - BUST.w / 2) * u), top: -(BUST.y - body.rows) * u })}
            />
          )}
        </span>
      );
    }
    return (
      <span aria-hidden="true" data-unit={u} className={cls} style={{ width: 64 * u, height: 64 * u, ...style }}>
        {src && (
          <img
            src={src}
            alt=""
            decoding="async"
            draggable={false}
            className="absolute max-w-none"
            // centred on his legs and stood on the baseline, not on the canvas
            style={px({ width: 64 * u, height: 64 * u, left: Math.round((32 - nfl.cx) * u), top: (BASELINE - 1 - nfl.foot) * u })}
          />
        )}
        {tag}
      </span>
    );
  }

  if (!regular.length) return null;
  const img = regular[tick % regular.length];
  if (kind === 'figure') {
    const s = 3 * u;
    return (
      <span aria-hidden="true" data-unit={u} className={cls} style={{ width: 64 * u, height: 64 * u, ...style }}>
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={px({ width: img.w * s, height: img.h * s, left: Math.round(32 * u - (img.cx ?? img.w / 2) * s), top: BASELINE * u - ((img.foot ?? img.h - 1) + 1) * s })}
        />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cls} style={{ width: img.w * u, height: img.h * u, ...style }}>
      <img src={img.src} alt="" draggable={false} className="absolute left-0 top-0 max-w-none" style={px({ width: img.w * u, height: img.h * u })} />
    </span>
  );
};

export default GameSprite;
