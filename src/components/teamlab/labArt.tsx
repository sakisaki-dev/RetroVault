import { homeUniform } from '@/components/collection/art/sprite/uniforms';
import { helmetFor } from '@/components/collection/art/sprite/helmets';

/**
 * The classic build's player (no private sprites, and NFL legends everywhere): a front-facing pixel footballer in a
 * club's home kit and helmet, drawn as crisp SVG rects on a 16 x 24 grid with his number on the chest.
 */
export const PixelPlayer = ({ club, number, unit = 3 }: { club: string; number?: number | string; unit?: number }) => {
  const k = homeUniform(club);
  const h = helmetFor(club);
  const skin = '#c98e5d';
  const r = (x: number, y: number, w: number, hh: number, fill: string) => <rect x={x} y={y} width={w} height={hh} fill={fill} />;
  return (
    <svg
      aria-hidden="true"
      width={16 * unit}
      height={24 * unit}
      viewBox="0 0 16 24"
      shapeRendering="crispEdges"
      className="lab-pixel-player"
    >
      {/* helmet, stripe, mask */}
      {r(5, 0, 6, 1, h.shell)}
      {r(4, 1, 8, 4, h.shell)}
      {h.stripe !== 'none' && r(7, 0, 2, 3, h.stripes[0])}
      {r(5, 3, 6, 3, skin)}
      {r(5, 4, 6, 1, h.mask)}
      {r(7, 3, 1, 3, h.mask)}
      {/* jersey and sleeves */}
      {r(3, 6, 10, 8, k.jersey)}
      {r(1, 7, 2, 4, k.jersey)}
      {r(13, 7, 2, 4, k.jersey)}
      {r(1, 9, 2, 1, k.trim)}
      {r(13, 9, 2, 1, k.trim)}
      {r(1, 11, 2, 2, skin)}
      {r(13, 11, 2, 2, skin)}
      {r(6, 6, 4, 1, k.collar ?? k.trim)}
      {/* pants, stripe, socks, cleats */}
      {r(4, 14, 8, 5, k.pants)}
      {k.pantsStripe && r(4, 14, 1, 5, k.pantsStripe)}
      {k.pantsStripe && r(11, 14, 1, 5, k.pantsStripe)}
      {r(7, 17, 2, 2, 'rgba(0,0,0,0.25)')}
      {r(4, 19, 3, 3, k.socks)}
      {r(9, 19, 3, 3, k.socks)}
      {r(4, 20, 3, 1, k.sockStripe)}
      {r(9, 20, 3, 1, k.sockStripe)}
      {r(3, 22, 4, 2, k.cleats)}
      {r(9, 22, 4, 2, k.cleats)}
      {number !== undefined && (
        <text x="8" y="12.6" textAnchor="middle" fontSize="5.4" fontWeight="900" fontFamily="var(--font-display, sans-serif)" fill={k.number} stroke={k.numberOutline} strokeWidth="0.5" paintOrder="stroke">
          {number}
        </text>
      )}
    </svg>
  );
};

/** Half-star rating (1 to 10 half-stars) as pixel stars, with the ceiling ghosted after it. */
export const PixelStars = ({ now, ceiling, label }: { now: number; ceiling?: number; label: string }) => (
  <span className="lab-stars" role="img" aria-label={label}>
    {Array.from({ length: 5 }, (_, i) => {
      const fill = Math.max(0, Math.min(2, now - i * 2));
      const room = ceiling !== undefined ? Math.max(0, Math.min(2, ceiling - i * 2)) : 0;
      return <i key={i} className="lab-star" data-fill={fill} data-room={room > fill ? room : 0} />;
    })}
  </span>
);
