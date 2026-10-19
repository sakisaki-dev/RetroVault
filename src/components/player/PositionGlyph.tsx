import type { Position } from '@/types/player';
import { cn } from '@/lib/utils';

/**
 * Original, minimal line glyphs per position (24×24, stroke = currentColor).
 * QB football in hand · RB cleat · WR catching hands · TE ball + block shield · OL shield ·
 * LB helmet · DB helmet with speed lines · DL three-point stance.
 */
const PATHS: Record<Position, JSX.Element> = {
  QB: (
    <>
      {/* football */}
      <ellipse cx="13" cy="7.5" rx="6.2" ry="3.6" transform="rotate(-28 13 7.5)" />
      <path d="M10.6 8.6l4.8-2.4M11.8 6.6l.7 1.3M13.3 5.9l.7 1.3" />
      {/* cupped hand */}
      <path d="M4 20.5v-5.2c0-1.1.7-2 1.8-2.2l5.3-1c.9-.2 1.7.5 1.6 1.4 0 .6-.5 1.1-1.1 1.2L9 15.2" />
      <path d="M8.5 15.3l5.7-.9c.9-.1 1.8.4 2 1.3.2.8-.2 1.6-1 1.9l-4.6 1.8c-1.2.5-2.6.6-3.9.4L4 19.5" />
    </>
  ),
  RB: (
    <>
      {/* cleat profile */}
      <path d="M3 15.5V9.8c0-.6.5-1 1.1-.9l3.2.6 2.4 2.6 8.1 1.6c1.9.4 3.2 1.4 3.2 2.8v.2c0 .5-.4.8-.9.8H3.9A.9.9 0 0 1 3 15.5Z" />
      <path d="M7.3 9.5V6.3M9.2 11.6l1.4-1.8M11.3 12.1l1.3-1.6" />
      {/* studs */}
      <path d="M5 16.9v2.1M9 16.9v2.1M13 16.9v2.1M17 16.9v2.1" />
    </>
  ),
  WR: (
    <>
      {/* two open hands reaching up */}
      <path d="M5 21v-4.5L3.4 11c-.2-.7.2-1.3.9-1.4.5 0 .9.2 1.1.7l1.1 2.6V6.5c0-.6.4-1 1-1s1 .4 1 1v5" />
      <path d="M8.5 11V5.2c0-.6.4-1 1-1s1 .4 1 1V11M10.5 11V6.6c0-.6.4-1 1-1s1 .4 1 1V12.5c0 2.2-.6 4-1.9 5.3V21" />
      <path d="M19 21v-4.5l1.6-5.5c.2-.7-.2-1.3-.9-1.4-.5 0-.9.2-1.1.7l-1.1 2.6" />
      <path d="M17.5 13.4V6.5c0-.6-.4-1-1-1s-1 .4-1 1v4.7M15.5 12.5V7.6" />
      <circle cx="12" cy="2.6" r="1.1" />
    </>
  ),
  TE: (
    <>
      {/* block shield on the left, ball on the right */}
      <path d="M3 5.5l5-2 5 2v5.2c0 4-2.2 6.6-5 8.3-2.8-1.7-5-4.3-5-8.3V5.5Z" />
      <path d="M8 6.5v8" />
      <ellipse cx="17.5" cy="15" rx="4.4" ry="2.6" transform="rotate(-35 17.5 15)" />
      <path d="M15.8 15.9l3.4-1.8" />
    </>
  ),
  OL: (
    <>
      <path d="M12 2.8l7.5 2.8v6c0 4.9-3.2 8.2-7.5 9.9-4.3-1.7-7.5-5-7.5-9.9v-6L12 2.8Z" />
      <path d="M8 9.5h8M8 13h8M12 6.5v12" />
    </>
  ),
  LB: (
    <>
      {/* helmet facing right */}
      <path d="M4 14.8C4 8.8 7.9 4.5 13 4.5c4.3 0 7 2.9 7 6.5v1.2h-6.2l-1.1 4.6H6.2A2.2 2.2 0 0 1 4 14.8Z" />
      <path d="M13.8 12.2h6.7M15.5 12.2v4.6l4.6.2v-4.8M12.7 16.8l2.8 2.6h4.6" />
      <circle cx="9.5" cy="10.5" r="1.4" />
    </>
  ),
  DB: (
    <>
      <path d="M7 14.8C7 9.6 10.4 5.8 14.8 5.8c3.7 0 6.2 2.5 6.2 5.6v1h-5.4l-1 4H8.9A1.9 1.9 0 0 1 7 14.8Z" />
      <path d="M15.6 12.4h5.4M17 12.4v4l3.9.2" />
      {/* speed lines */}
      <path d="M1.5 9h3.2M1 12.5h4M2 16h3" />
    </>
  ),
  DL: (
    <>
      {/* low three-point stance: helmet, back, planted hand */}
      <circle cx="17.5" cy="8" r="2.6" />
      <path d="M15.2 9.2 7.5 10.8 4 15.5M7.5 10.8l2.5 4.7-1.2 4.5M15.6 10.3l1 9.7" />
      <path d="M2.5 20h19" />
    </>
  ),
};

interface Props {
  position: Position;
  className?: string;
  /** Accessible label; omit when the position name is already visible next to it */
  title?: string;
}

const PositionGlyph = ({ position, className, title }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('h-6 w-6 shrink-0', className)}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    {PATHS[position] ?? PATHS.OL}
  </svg>
);

export default PositionGlyph;
