import { useId } from 'react';
import { cn } from '@/lib/utils';
import { getReadableTextOn } from '@/utils/teamColors';

interface Props {
  number: number | null;
  /** HSL triplets */
  primary: string;
  secondary: string;
  /** Gold trim + stitching for a retired number */
  retired?: boolean;
  className?: string;
}

/**
 * Original jersey silhouette in team colors with a tackle-twill style number: a solid fill,
 * a contrasting outline and a dashed "stitch" line just inside it. Decorative; callers
 * announce the number in text.
 */
const StitchedJersey = ({ number, primary, secondary, retired = false, className }: Props) => {
  const id = useId().replace(/:/g, '');
  const ink = getReadableTextOn(primary);
  const trim = retired ? 'hsl(43 100% 62%)' : `hsl(${secondary})`;
  const text = number == null ? '' : String(number);
  const fontSize = text.length > 1 ? 30 : 34;
  return (
    <svg viewBox="0 0 80 72" className={cn('h-14 w-auto shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`jg-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={`hsl(${primary})`} />
          <stop offset="1" stopColor={`hsl(${primary})`} stopOpacity="0.82" />
        </linearGradient>
        <pattern id={`mesh-${id}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.45" fill="#000" opacity="0.18" />
        </pattern>
      </defs>
      {/* body + sleeves */}
      <path
        d="M27 4 L16 8 L3 18 L10 31 L17 27 L17 69 L63 69 L63 27 L70 31 L77 18 L64 8 L53 4 C50 10 45 13 40 13 C35 13 30 10 27 4 Z"
        fill={`url(#jg-${id})`}
        stroke={trim}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M27 4 L16 8 L3 18 L10 31 L17 27 L17 69 L63 69 L63 27 L70 31 L77 18 L64 8 L53 4 C50 10 45 13 40 13 C35 13 30 10 27 4 Z" fill={`url(#mesh-${id})`} />
      {/* collar + sleeve stripes */}
      <path d="M27 4 C30 10 35 13 40 13 C45 13 50 10 53 4" fill="none" stroke={trim} strokeWidth="3" />
      <path d="M5.6 22.6 L12 19.2 M74.4 22.6 L68 19.2" stroke={trim} strokeWidth="2.6" />
      {text && (
        <g fontFamily="var(--font-display)" fontWeight="800" fontSize={fontSize} textAnchor="middle">
          {/* outline (tackle twill border) */}
          <text x="40" y="54" fill={trim} stroke={trim} strokeWidth="5" strokeLinejoin="round">
            {text}
          </text>
          <text x="40" y="54" fill={ink}>
            {text}
          </text>
          {/* stitch line */}
          <text x="40" y="54" fill="none" stroke={trim} strokeWidth="0.7" strokeDasharray="1.6 1.4" opacity="0.9">
            {text}
          </text>
        </g>
      )}
    </svg>
  );
};

export default StitchedJersey;
