import { useMemo } from 'react';
import type { GamePlayer } from '@/config/ovr';
import type { ArtProps, Palette } from './shared';
import { teamStyleFor } from './teamStyle';
import { F, GROUND, PIX_H, PIX_W, PIX_X, type Key } from './sprite/grid';
import { lookFor, useSpriteTable, type SpriteLook } from './sprite/faces';
import { helmetColours, helmetFor, miniHelmet, type Helmet } from './sprite/helmets';
import { helmetWith, homeUniform, type Uniform } from './sprite/uniforms';
import { poseKeyFor, standInsFor, type StandIn } from './sprite/poses';
import { buildSprite, colours, rasterise, runsOf } from './sprite/render';

/*
 * React wrapper for the Retro Bowl sprite (see ./sprite/README.md for the modules): PixelPlayer (one figure),
 * the stand-in opponents, PixelHelmet (Art lab), and PixelSpriteArt (the "Retro Bowl sprite" card art).
 */

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
  const runs = useMemo(() => buildSprite(look, poseKey, style, hel, number, player.name, uni), [look, poseKey, style, hel, number, player.name, uni]);
  const c = colours(pal, look, style, hel, uni);
  if (look.image && !pose) {
    return (
      <g className={className} transform={transform}>
        <image href={`${import.meta.env.BASE_URL}data/sprites/${look.image}`} x={PIX_X} y={0} width={PIX_W} height={GROUND + 1} preserveAspectRatio="xMidYMax meet" style={{ imageRendering: 'pixelated' }} />
      </g>
    );
  }
  return (
    <g className={className} transform={transform} shapeRendering="crispEdges">
      <g transform={`translate(${PIX_X} 0) scale(${1 / F})`}>
        {runs.map(([x, y, w, h, k]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={c[k]} />
        ))}
      </g>
    </g>
  );
};

// ---------- Stand-in opponent (contact poses) ----------

/** A generic opponent in a plain grey uniform: no logo, no stripe, desaturated, so the card's player stays the focus. */
const GREY_PAL: Palette = { a: '#7c828c', b: '#a3a8b0', aDark: '#5f646d', aDeep: '#3d4048', aLight: '#a9aeb6', bDark: '#6d7179', onA: '#c9ccd2', trim: '#9da2aa', pants: '#b4b8bf' };
const GREY_HELMET: Helmet = { shell: '#8a8f98', stripe: 'none', stripes: ['#8a8f98', '#8a8f98'], mask: '#5c616b', colors: [], logo: [] };
const GREY_LOOK: SpriteLook = { skin: 'tan', hair: { style: 'short', color: 'darkbrown' }, facial: 'none', accessories: [], build: 'normal', height: 'normal', locked: false };
const GREY_STYLE = { ...teamStyleFor({ team: '' }), sleeve: 'none' as const, pantsStripe: '#9da2aa' };
const GREY_UNIFORM: Uniform = { id: 'stand-in', label: 'Stand-in', jersey: '#7c828c', trim: '#9da2aa', sleeve: 'none', number: '#c9ccd2', numberOutline: '#7c828c', numberStyle: 'solid', pants: '#b4b8bf', pantsStripe: null, socks: '#b4b8bf', sockStripe: '#9da2aa', cleats: '#6d7179' };

const StandInSprite = ({ s, i }: { s: StandIn; i: number }) => {
  const runs = useMemo(() => buildSprite(GREY_LOOK, s.pose, GREY_STYLE, GREY_HELMET, null, `stand-in-${i}`, GREY_UNIFORM), [s.pose, i]);
  // Desaturated skin too, so nothing on the stand-in competes with the card's player
  const c = { ...colours(GREY_PAL, GREY_LOOK, GREY_STYLE, GREY_HELMET, GREY_UNIFORM), s: '#9c948f', x: '#857e7a', X: '#7a7470', d: '#857e7a', u: '#aaa29d', m: '#6d6763' };
  // Built around x = 22 facing right; mirrored to face the player when flip
  const t = s.flip ? `translate(${s.x + 22} ${s.dy ?? 0}) scale(-1 1)` : `translate(${s.x - 22} ${s.dy ?? 0})`;
  return (
    <g transform={t} shapeRendering="crispEdges" opacity="0.92">
      <g transform={`translate(${PIX_X} 0) scale(${1 / F})`}>
        {runs.map(([x, y, w, h, k]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={c[k]} />
        ))}
      </g>
    </g>
  );
};

/** One team's helmet on its own (Art lab "Helmets" row): the same pixel helmet the sprites wear and carry. */
export const PixelHelmet = ({ team }: { team: string }) => {
  const hel = helmetFor(team);
  const runs = useMemo(() => runsOf(rasterise(miniHelmet(PIX_X + 1, 1, hel))), [hel]);
  const c: Record<Key, string> = { ...helmetColours(hel), o: '#10131a' };
  return (
    <svg className="ra-helmet" viewBox={`0 0 ${14 * F} ${11 * F}`} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      {runs
        .filter(([x, y]) => x < 14 * F && y < 11 * F)
        .map(([x, y, w, h, k]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={c[k]} />
        ))}
    </svg>
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
  const key = pose ?? poseKeyFor(player.name, player.position, lookFor(player, table).pose);
  return (
    <svg className="ra ra--pixel" viewBox={`${PIX_X} 0 ${PIX_W} ${PIX_H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <g shapeRendering="crispEdges">
        {key === 'sig-praise' &&
          HALO.map(([x, w, o]) => [0, 12, 24, 36].map((y, i) => <rect key={`${x}-${y}`} x={x - i % 2} y={y} width={w} height={12} fill="#fff3c4" opacity={o * (1 - i * 0.2)} />))}
        {/* Turf with a yard line and hash marks */}
        <rect x={PIX_X} y={GROUND} width={PIX_W} height={PIX_H - GROUND} fill="#2f8f3a" />
        <rect x={PIX_X} y={GROUND} width={PIX_W} height="1" fill="#48b552" />
        <rect x={PIX_X} y={GROUND + 3} width={PIX_W} height="1" fill="#287d32" />
        <rect x="44" y={GROUND} width="2" height={PIX_H - GROUND} fill="#e9f3e6" opacity="0.9" />
        <rect x="4" y={GROUND + 1} width="34" height="2" fill="#000" opacity="0.28" />
      </g>
      {standInsFor(key).map((st, i) => (
        <StandInSprite key={i} s={st} i={i} />
      ))}
      {key === 'rb-dive' || key === 'qb-sneak' ? <rect x="40" y={GROUND - 1} width="2" height={PIX_H - GROUND + 1} fill="#f4f5f7" shapeRendering="crispEdges" /> : null}
      <PixelPlayer className="ra-bob" player={player} pal={pal} number={number} pose={pose} uniform={uniform} />
    </svg>
  );
};

export default PixelSpriteArt;

