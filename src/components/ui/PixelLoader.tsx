import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import './pixelLoader.css';

/*
 * The site's one loading indicator: a pixel football that hops end over end above its shadow, three gold marquee
 * bulbs and an optional one-word pixel label. It stays invisible for its first ~180 ms (pixelLoader.css), so a fast
 * load shows nothing at all; past that it fades in. Content that replaces it fades in with `.rv-load-in`.
 *
 *   block    (default) centred in a box that reserves the space the content will take (`minHeight`), so nothing
 *            jumps when it lands
 *   inline   a small row for a slot inside a panel ("Loading market…" lines)
 *   overlay  a dimmed full-screen layer (a lazy dialog's code on its way)
 *
 * Reduced motion: the ball rests, the bulbs stay lit. Transforms and opacity only.
 */

// 16 × 9 pixel football: O outline, b leather, h highlight, W laces and stripes
const BALL = [
  '.....OOOOOO.....',
  '...OOhhhhhhOO...',
  '.ObWbbbbbbbbWbO.',
  'ObbWbbWbbWbbWbbO',
  'ObbWbWWWWWWbWbbO',
  'ObbWbbWbbWbbWbbO',
  '.ObWbbbbbbbbWbO.',
  '...OObbbbbbOO...',
  '.....OOOOOO.....',
];
const INK: Record<string, string> = { O: '#2a140a', b: '#9b5426', h: '#c27a3f', W: '#f6ecd9' };
const RECTS = BALL.flatMap((row, y) =>
  [...row].flatMap((c, x) => (INK[c] ? [<rect key={`${x}-${y}`} x={x} y={y} width={1.04} height={1.04} fill={INK[c]} />] : [])),
);

export const PixelBall = ({ className }: { className?: string }) => (
  <svg className={cn('pl-ball', className)} viewBox="0 0 16 9" shapeRendering="crispEdges" aria-hidden="true">
    {RECTS}
  </svg>
);

interface Props {
  /** One word in the pixel font under the ball ("Loading", "Kickoff"); read out to screen readers either way */
  label?: string;
  /** What is loading, for screen readers ("the season") */
  what?: string;
  variant?: 'block' | 'inline' | 'overlay';
  /** block: the space to hold (a CSS length), so the content lands without moving anything */
  minHeight?: number | string;
  /** sm: inside cards and panels; md (default): pages and sections */
  size?: 'sm' | 'md';
  /** Show at once (no grace delay): a load already known to be slow */
  immediate?: boolean;
  className?: string;
  style?: CSSProperties;
}

const PixelLoader = ({ label, what, variant = 'block', minHeight, size = 'md', immediate = false, className, style }: Props) => (
  <div
    role="status"
    aria-live="polite"
    className={cn('pl', `pl--${variant}`, `pl--${size}`, immediate && 'pl--now', className)}
    style={variant === 'block' && minHeight !== undefined ? { minHeight, ...style } : style}
  >
    <span className="sr-only">{what ? `Loading ${what}` : 'Loading'}</span>
    <span className="pl-stage" aria-hidden="true">
      <span className="pl-hop">
        <PixelBall />
      </span>
      <span className="pl-shadow" />
    </span>
    <span className="pl-row" aria-hidden="true">
      {label && <span className="pl-label">{label}</span>}
      <span className="pl-dots">
        <i />
        <i />
        <i />
      </span>
    </span>
  </div>
);

export default PixelLoader;
