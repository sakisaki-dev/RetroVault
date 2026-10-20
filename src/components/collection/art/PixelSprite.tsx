import { useMemo } from 'react';
import type { GamePlayer } from '@/config/ovr';
import type { ArtProps, Palette } from './shared';
import { teamStyleFor } from './teamStyle';
import { F, GROUND, PIX_H, PIX_W, PIX_X, type Key, type Rect } from './sprite/grid';
import { lookFor, useSpriteTable, type HeadOpts, type SpriteLook } from './sprite/faces';
import { frontHead, helmetColours, helmetFor, miniHelmet, sideHead, tqHead, type Helmet } from './sprite/helmets';
import { helmetWith, homeUniform, type Uniform } from './sprite/uniforms';
import { poseKeyFor, standInsFor, turfFor, type PoseOut, type StandIn } from './sprite/poses';
import { buildSprite, colours, fieldMarkFor, rasterise, runsOf, STAND_IN_HELMET, STAND_IN_LOOK, STAND_IN_UNIFORM, standInColours } from './sprite/render';
import { paint, useBitmap } from './bitmap';

/*
 * React wrapper for the Retro Bowl sprite (see ./sprite/README.md for the modules): PixelPlayer (one figure),
 * the stand-in opponents, PixelHelmet / PixelHead (Art lab), and PixelSpriteArt (the "Retro Bowl sprite" card art).
 *
 * Every figure is painted once into a cached bitmap (./bitmap.ts) and shown as a single pixelated image, so a page
 * of sprites costs one DOM node each instead of hundreds of <rect>s.
 */

const GRID_W = PIX_W * F;
const GRID_H = PIX_H * F;

/** The sprite grid as one pixelated SVG image in grid units (x −4…54, y 0…64); empty until the bitmap is ready. */
const GridImage = ({ url, className, transform, opacity }: { url: string | undefined; className?: string; transform?: string; opacity?: number }) => (
  <g className={className} transform={transform} opacity={opacity}>
    {url && <image href={url} x={PIX_X} y={0} width={PIX_W} height={PIX_H} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />}
  </g>
);

interface PixelPlayerProps {
  player: GamePlayer;
  pal: Palette;
  number?: number | null;
  /** Pose override (Art lab); else his locked pose, else one from his position by name */
  pose?: string;
  /** Uniform worn (home unless the card rolled an alternate) */
  uniform?: Uniform;
  className?: string;
  transform?: string;
}

/** The sprite as an SVG group in grid units (x −4…54, y 0…64), for embedding in a scene. */
export const PixelPlayer = ({ player, pal, number, pose, uniform, className, transform }: PixelPlayerProps) => {
  const table = useSpriteTable();
  const look = useMemo(() => lookFor(player, table), [player, table]);
  const style = useMemo(() => teamStyleFor(player), [player]);
  const uni = useMemo(() => uniform ?? homeUniform(player.team), [uniform, player.team]);
  const hel = useMemo(() => helmetWith(helmetFor(player.team), uni), [player.team, uni]);
  const poseKey = pose ?? poseKeyFor(player.name, player.position, look.pose);
  const custom = !!look.image && !pose;
  const key = useMemo(
    () => (custom ? '' : JSON.stringify(['player', look, poseKey, style, hel, number ?? null, player.name, uni, pal])),
    [custom, look, poseKey, style, hel, number, player.name, uni, pal],
  );
  const bmp = useBitmap(key, () => paint(buildSprite(look, poseKey, style, hel, number, player.name, uni), colours(pal, look, style, hel, uni), GRID_W, GRID_H));
  if (custom) {
    return (
      <g className={className} transform={transform}>
        <image href={`${import.meta.env.BASE_URL}data/sprites/${look.image}`} x={PIX_X} y={0} width={PIX_W} height={GROUND + 1} preserveAspectRatio="xMidYMax meet" style={{ imageRendering: 'pixelated' }} />
      </g>
    );
  }
  return <GridImage url={bmp?.url} className={className} transform={transform} />;
};

// ---------- Stand-in opponent (contact poses) ----------

/** Palette for the stand-in's derived keys (his own colours come from standInColours) */
const GREY_PAL: Palette = { a: '#7c828c', b: '#a3a8b0', aDark: '#5f646d', aDeep: '#3d4048', aLight: '#a9aeb6', bDark: '#6d7179', onA: '#c9ccd2', trim: '#9da2aa', pants: '#b4b8bf' };
const GREY_STYLE = { ...teamStyleFor({ team: '' }), sleeve: 'none' as const, pantsStripe: '#9da2aa' };

/** A generic opponent (render.ts STAND_IN_*): the card players' normal frame in flat greys, no logo or number. */
const StandInSprite = ({ s, i }: { s: StandIn; i: number }) => {
  const bmp = useBitmap(`stand-in|${s.pose}|${i}`, () =>
    paint(buildSprite(STAND_IN_LOOK, s.pose, GREY_STYLE, STAND_IN_HELMET, null, `stand-in-${i}`, STAND_IN_UNIFORM), standInColours(GREY_PAL, GREY_STYLE), GRID_W, GRID_H),
  );
  // Built around x = 22 facing right; mirrored to face the player when flip. Opaque, so his greys stay flat.
  const t = s.flip ? `translate(${s.x + 22} ${s.dy ?? 0}) scale(-1 1)` : `translate(${s.x - 22} ${s.dy ?? 0})`;
  return <GridImage url={bmp?.url} transform={t} />;
};

/** One team's helmet on its own (mini helmet, as carried by the sprites). */
export const PixelHelmet = ({ team, className = 'ra-helmet' }: { team: string; className?: string }) => {
  const hel = helmetFor(team);
  const bmp = useBitmap(`mini|${JSON.stringify(hel)}`, () => {
    // The mini helmet's round-out cap sits one row above its template (y − 1), so it starts at y = 2 in a 12-row box
    const runs = runsOf(rasterise(miniHelmet(PIX_X + 1, 2, hel)), true).filter(([x, y]) => x < 14 * F && y < 12 * F);
    return paint(runs, { ...helmetColours(hel), o: '#10131a' }, 14 * F, 12 * F);
  });
  return bmp ? <img className={className} src={bmp.url} alt="" draggable={false} /> : <span className={className} aria-hidden="true" />;
};

export type HeadView = 'front' | 'tq' | 'side';
const HEADS: Record<HeadView, (hx: number, hy: number, o: HeadOpts) => Rect[]> = { front: frontHead, tq: tqHead, side: sideHead };
const STILL: PoseOut = {
  frontArm: [[0, 0], [0, 0], [0, 0]],
  backArm: [[0, 0], [0, 0], [0, 0]],
  frontLeg: [[0, 0], [0, 0], [0, 0]],
  backLeg: [[0, 0], [0, 0], [0, 0]],
  look: 'side',
  expr: 'line',
  lean: 0,
  crouch: 0,
};

interface PixelHeadProps {
  /** Whose palette and face (the team comes from player.team) */
  player: GamePlayer;
  look: SpriteLook;
  pal: Palette;
  view: HeadView;
  uniform?: Uniform;
  label: string;
  className?: string;
}

/** A helmeted head on its own (front, three-quarter or side), cropped to its outline: the Art lab's helmet views. */
export const PixelHead = ({ player, look, pal, view, uniform, label, className }: PixelHeadProps) => {
  const uni = uniform ?? homeUniform(player.team);
  const hel = helmetWith(helmetFor(player.team), uni);
  const style = teamStyleFor(player);
  const bmp = useBitmap(JSON.stringify(['head', view, look, hel, style, uni, pal]), () => {
    // Helmet views are icons: they keep the 1-px black outline (STYLE_GUIDE.md §3)
    const runs = runsOf(rasterise(HEADS[view](PIX_X + 4, 4, { look, pose: STILL, style, hel })), true);
    const c: Record<Key, string> = colours(pal, look, style, hel, uni);
    return paint(runs, c, GRID_W, GRID_H, true, 1);
  });
  return bmp ? (
    <img className={className} src={bmp.url} width={bmp.w} height={bmp.h} style={{ width: `calc(var(--px, 2px) * ${bmp.w})`, height: 'auto' }} alt={label} draggable={false} />
  ) : (
    <span className={className} role="img" aria-label={label} />
  );
};

/** Pixel light rays from above (signature praise pose): stepped columns, no gradients. */
const HALO = [
  [14, 2, 0.16],
  [19, 3, 0.22],
  [24, 4, 0.3],
  [30, 3, 0.22],
  [35, 2, 0.16],
] as const;

interface SpriteArtProps extends ArtProps {
  pose?: string;
}

/** Variant "Retro Bowl sprite": the player as a chunky pixel sprite on a strip of turf. */
const PixelSpriteArt = ({ player, number, pal, pose, uniform }: SpriteArtProps) => {
  const table = useSpriteTable();
  const look = lookFor(player, table);
  const key = pose ?? poseKeyFor(player.name, player.position, look.pose);
  // Turf mark the pose needs (goal line under a reaching ball, sideline under a toe-tap's toes)
  const mark = look.image && !pose ? null : fieldMarkFor(look, key, player.name);
  const turf = look.image && !pose ? null : turfFor(key);
  return (
    <svg className="ra ra--pixel" viewBox={`${PIX_X} 0 ${PIX_W} ${PIX_H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      {/* Stand-in opponents first, behind everything */}
      {standInsFor(key).map((st, i) => (
        <StandInSprite key={i} s={st} i={i} />
      ))}
      <g shapeRendering="crispEdges">
        {key === 'sig-praise' &&
          HALO.map(([x, w, o]) => [0, 12, 24, 36].map((y, i) => <rect key={`${x}-${y}`} x={x - i % 2} y={y} width={w} height={12} fill="#fff3c4" opacity={o * (1 - i * 0.2)} />))}
        {/* Turf only where the pose needs it (something on the ground, a sideline or goal line): a patch as wide as
            needed, with the mark in it. Everyone else stands on the flat shadow alone. */}
        {turf && (
          <>
            <rect x={turf[0] + 1} y={GROUND} width={turf[1] - turf[0] - 2} height="1" fill="#48b552" />
            <rect x={turf[0]} y={GROUND + 1} width={turf[1] - turf[0]} height={PIX_H - GROUND - 1} fill="#2f8f3a" />
            <rect x={turf[0]} y={GROUND + 3} width={turf[1] - turf[0]} height="1" fill="#287d32" />
            {mark?.kind === 'sideline' && <rect x={turf[0]} y={GROUND} width={mark.x - turf[0]} height={PIX_H - GROUND} fill="#5d7a55" />}
            {mark && <rect x={mark.x} y={GROUND} width="2" height={PIX_H - GROUND} fill="#f4f5f7" />}
          </>
        )}
        {/* Flat shadow under the feet: three stacked rows, a pixel ellipse (STYLE_GUIDE.md §9) */}
        <rect x="9" y={GROUND} width="26" height="1" fill="#000" opacity="0.28" />
        <rect x="7" y={GROUND + 1} width="30" height="1" fill="#000" opacity="0.28" />
        <rect x="11" y={GROUND + 2} width="22" height="1" fill="#000" opacity="0.28" />
      </g>
      {mark?.kind === 'goal' && (
        // Pylon on the goal line, the ball reaching past it
        <g shapeRendering="crispEdges">
          <rect x={mark.x - 1} y={GROUND - 6} width="4" height="7" fill="#10131a" />
          <rect x={mark.x} y={GROUND - 5} width="2" height="5" fill="#ff6b1a" />
          <rect x={mark.x} y={GROUND - 3} width="2" height="1" fill="#f4f5f7" />
        </g>
      )}
      <PixelPlayer player={player} pal={pal} number={number} pose={pose} uniform={uniform} />
    </svg>
  );
};

export default PixelSpriteArt;

