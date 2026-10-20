import { useMemo } from 'react';
import { poseFor, skinFor, type ArtProps, type Palette, type Pose } from './shared';

/*
 * Retro Bowl-style pixel player. Each pose is a list of rectangles on a 26 × 34 pixel grid (facing right), painted
 * in order (later wins), then every empty pixel touching the figure becomes a dark outline, like the game's sprites.
 *   H helmet  h helmet stripe / logo  M facemask  s skin  J jersey  j trim  P pants  p pants stripe
 *   K socks  B cleats  F football  f laces
 */
type Key = 'H' | 'h' | 'M' | 's' | 'J' | 'j' | 'P' | 'p' | 'K' | 'B' | 'F' | 'f' | 'N' | 'o';
type Rect = [number, number, number, number, Key];

export const PIX_W = 26;
export const PIX_H = 34;

const head = (x: number, y: number): Rect[] => [
  [x + 2, y, 4, 1, 'H'],
  [x + 1, y + 1, 6, 1, 'H'],
  [x, y + 2, 7, 4, 'H'],
  [x + 1, y + 6, 4, 1, 'H'],
  [x + 2, y, 4, 1, 'h'],
  [x + 1, y + 1, 2, 1, 'h'],
  [x + 1, y + 3, 2, 2, 'h'],
  [x + 5, y + 3, 2, 3, 's'],
  [x + 7, y + 2, 1, 4, 'M'],
  [x + 5, y + 4, 3, 1, 'M'],
];

/** Shoulder pads (w + 2 wide), jersey body, collar and belt. */
const torso = (x: number, y: number, w: number, h: number): Rect[] => [
  [x - 1, y, w + 2, 3, 'J'],
  [x, y + 3, w, h - 3, 'J'],
  [x - 1, y + 1, 1, 2, 'j'],
  [x + w, y + 1, 1, 2, 'j'],
  [x + Math.floor(w / 2) - 1, y, 3, 1, 's'],
  [x, y + h, w, 1, 'j'],
];

const POSES: Record<Pose, { rects: Rect[]; num: [number, number] }> = {
  // Quarterback: ball cocked behind the helmet, front arm pointing downfield, striding
  qb: {
    num: [10, 13],
    rects: [
      ...torso(9, 9, 9, 9),
      [9, 19, 9, 2, 'P'],
      [8, 21, 4, 4, 'P'],
      [7, 25, 3, 4, 'K'],
      [7, 26, 3, 1, 'j'],
      [5, 29, 5, 2, 'B'],
      [14, 21, 4, 3, 'P'],
      [15, 24, 3, 1, 'P'],
      [16, 25, 3, 4, 'K'],
      [16, 26, 3, 1, 'j'],
      [16, 29, 5, 2, 'B'],
      [6, 7, 3, 4, 'J'],
      [6, 7, 3, 1, 'j'],
      [5, 4, 3, 3, 's'],
      [3, 1, 6, 3, 'F'],
      [5, 2, 2, 1, 'f'],
      [19, 10, 3, 2, 'J'],
      [19, 10, 1, 2, 'j'],
      [22, 10, 3, 2, 's'],
      ...head(10, 2),
    ],
  },
  // Running back: leaning into contact, ball tucked high and tight, knee driving
  rb: {
    num: [11, 13],
    rects: [
      [6, 11, 3, 2, 'J'],
      [3, 12, 3, 2, 's'],
      ...torso(10, 9, 9, 9),
      [10, 19, 9, 2, 'P'],
      [17, 18, 5, 3, 'P'],
      [20, 21, 3, 5, 'K'],
      [20, 22, 3, 1, 'j'],
      [20, 26, 5, 2, 'B'],
      [7, 20, 4, 3, 'P'],
      [4, 21, 3, 3, 'K'],
      [5, 21, 1, 3, 'j'],
      [1, 20, 3, 3, 'B'],
      [19, 11, 5, 3, 'F'],
      [21, 12, 2, 1, 'f'],
      [18, 10, 2, 3, 'J'],
      [17, 14, 6, 2, 's'],
      ...head(12, 2),
    ],
  },
  // Receiver: high-pointing the ball over his helmet, one knee up
  wr: {
    num: [10, 17],
    rects: [
      [7, 9, 2, 5, 'J'],
      [7, 9, 2, 1, 'j'],
      [8, 3, 2, 6, 's'],
      [18, 9, 2, 5, 'J'],
      [18, 9, 2, 1, 'j'],
      [17, 3, 2, 6, 's'],
      [10, 0, 7, 4, 'F'],
      [12, 1, 3, 1, 'f'],
      ...torso(9, 13, 9, 9),
      [9, 23, 9, 2, 'P'],
      [9, 25, 4, 4, 'P'],
      [9, 29, 3, 3, 'K'],
      [9, 30, 3, 1, 'j'],
      [8, 32, 5, 2, 'B'],
      [14, 25, 4, 2, 'P'],
      [15, 27, 3, 3, 'K'],
      [15, 28, 3, 1, 'j'],
      [15, 30, 5, 2, 'B'],
      ...head(10, 6),
    ],
  },
  // Lineman: wide pass-pro set, hands punching
  ol: {
    num: [11, 17],
    rects: [
      ...torso(9, 13, 10, 9),
      [19, 14, 3, 3, 'J'],
      [19, 14, 1, 3, 'j'],
      [22, 14, 3, 3, 's'],
      [19, 18, 3, 2, 'J'],
      [22, 18, 2, 2, 's'],
      [9, 23, 10, 2, 'P'],
      [6, 25, 5, 3, 'P'],
      [5, 28, 3, 4, 'K'],
      [5, 29, 3, 1, 'j'],
      [3, 32, 5, 2, 'B'],
      [17, 25, 5, 3, 'P'],
      [19, 28, 3, 4, 'K'],
      [19, 29, 3, 1, 'j'],
      [19, 32, 5, 2, 'B'],
      ...head(11, 6),
    ],
  },
  // Defender: crouched, hands out, ready to fire
  def: {
    num: [10, 19],
    rects: [
      ...torso(9, 15, 10, 9),
      [20, 17, 3, 2, 'J'],
      [20, 17, 1, 2, 'j'],
      [23, 18, 2, 3, 's'],
      [19, 21, 3, 2, 'J'],
      [22, 22, 2, 2, 's'],
      [9, 25, 9, 2, 'P'],
      [6, 27, 4, 2, 'P'],
      [5, 29, 3, 3, 'K'],
      [5, 30, 3, 1, 'j'],
      [3, 32, 5, 2, 'B'],
      [15, 27, 4, 2, 'P'],
      [17, 29, 3, 3, 'K'],
      [17, 30, 3, 1, 'j'],
      [17, 32, 5, 2, 'B'],
      ...head(14, 8),
    ],
  },
};

/** 3 × 5 pixel digits */
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];

const numberRects = (n: number, [x, y]: [number, number]): Rect[] => {
  const s = String(n).slice(0, 2);
  const start = s.length === 1 ? x + 2 : x;
  const out: Rect[] = [];
  [...s].forEach((ch, i) => {
    const bits = DIGITS[Number(ch)] ?? DIGITS[0];
    for (let k = 0; k < 15; k++) if (bits[k] === '1') out.push([start + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1, 'N']);
  });
  return out;
};

const paint = (rects: Rect[]) => {
  const grid: (Key | undefined)[] = new Array(PIX_W * PIX_H);
  rects.forEach(([x, y, w, h, k]) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < PIX_W && j < PIX_H) grid[j * PIX_W + i] = k;
  });
  const out = grid.slice();
  for (let j = 0; j < PIX_H; j++)
    for (let i = 0; i < PIX_W; i++) {
      if (grid[j * PIX_W + i]) continue;
      const near = [
        [i - 1, j],
        [i + 1, j],
        [i, j - 1],
        [i, j + 1],
      ].some(([a, b]) => a >= 0 && b >= 0 && a < PIX_W && b < PIX_H && grid[b * PIX_W + a] && grid[b * PIX_W + a] !== 'o');
      if (near) out[j * PIX_W + i] = 'o';
    }
  // Merge horizontal runs of one colour into single rects
  const runs: Rect[] = [];
  for (let j = 0; j < PIX_H; j++) {
    let i = 0;
    while (i < PIX_W) {
      const k = out[j * PIX_W + i];
      if (!k) {
        i++;
        continue;
      }
      let e = i + 1;
      while (e < PIX_W && out[j * PIX_W + e] === k) e++;
      runs.push([i, j, e - i, 1, k]);
      i = e;
    }
  }
  return runs;
};

const colours = (pal: Palette, skin: string): Record<Key, string> => ({
  H: pal.a,
  h: pal.trim,
  M: '#c9ced6',
  s: skin,
  J: pal.a,
  j: pal.trim,
  P: pal.pants,
  p: pal.a,
  K: pal.a,
  B: '#1a1d24',
  F: '#8a4f22',
  f: '#f4f1ea',
  N: pal.onA,
  o: '#10131a',
});

interface PixelPlayerProps {
  pose: Pose;
  pal: Palette;
  skin: string;
  number?: number | null;
  className?: string;
  transform?: string;
}

/** The sprite as an SVG group in grid units (26 × 34), for embedding in a scene. */
export const PixelPlayer = ({ pose, pal, skin, number, className, transform }: PixelPlayerProps) => {
  const runs = useMemo(() => {
    const p = POSES[pose];
    return paint(number != null ? [...p.rects, ...numberRects(number, p.num)] : p.rects);
  }, [pose, number]);
  const c = colours(pal, skin);
  return (
    <g className={className} transform={transform} shapeRendering="crispEdges">
      {runs.map(([x, y, w, h, k]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={c[k]} />
      ))}
    </g>
  );
};

/** Style: the player as a chunky Retro Bowl sprite on a strip of pixel turf, posed by position. */
const PixelSpriteArt = ({ player, number, pal }: ArtProps) => {
  const skin = skinFor(player);
  const pose = poseFor(player.position);
  return (
    <svg className="ra ra--pixel" viewBox="-6 -3 38 40" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <g shapeRendering="crispEdges">
        {/* Turf with a yard line */}
        <rect x="-6" y="31" width="38" height="6" fill="#2f8f3a" />
        <rect x="-6" y="31" width="38" height="1" fill="#48b552" />
        <rect x="-6" y="33" width="38" height="1" fill="#287d32" />
        <rect x="21" y="31" width="2" height="6" fill="#e9f3e6" opacity="0.9" />
        <rect x="4" y="33" width="16" height="2" fill="#000" opacity="0.28" />
      </g>
      <g transform={pose === 'qb' || pose === 'rb' ? 'translate(0 3)' : undefined}>
        <PixelPlayer className="ra-bob" pose={pose} pal={pal} skin={skin} number={number} />
      </g>
    </svg>
  );
};

export default PixelSpriteArt;
