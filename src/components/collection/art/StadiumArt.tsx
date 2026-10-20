import { useId } from 'react';
import { PixelPlayer } from './PixelSprite';
import type { ArtProps } from './shared';

const FLASHES = [
  [14, 46],
  [33, 42],
  [61, 47],
  [80, 43],
  [92, 50],
  [47, 51],
] as const;
const YARD = [-60, -30, 0, 30, 60, 90, 120, 150];

/** Style: the pixel player under the lights: night sky, light towers, a packed stand with flashbulbs, striped turf. */
const StadiumArt = ({ player, number, pal }: ArtProps) => {
  const id = `s${useId().replace(/:/g, '')}`;
  return (
    <svg className="ra ra--stadium" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070c" />
          <stop offset="1" stopColor={pal.aDeep} />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff8dc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-turf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6b2a" />
          <stop offset="1" stopColor="#38a245" />
        </linearGradient>
        <pattern id={`${id}-crowd`} width="5" height="4" patternUnits="userSpaceOnUse">
          <rect width="5" height="4" fill="#141821" />
          <circle cx="1.2" cy="1.2" r="0.9" fill={pal.a} />
          <circle cx="3.7" cy="1.6" r="0.9" fill="#3a4152" />
          <circle cx="2.4" cy="3.2" r="0.9" fill={pal.trim} opacity="0.75" />
        </pattern>
        <clipPath id={`${id}-field`}>
          <path d="M-20 62 L120 62 L140 100 L-40 100 Z" />
        </clipPath>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-sky)`} />
      {/* Stand */}
      <path d="M-5 40 C30 34 70 34 105 40 L105 62 L-5 62 Z" fill={`url(#${id}-crowd)`} />
      <path d="M-5 40 C30 34 70 34 105 40" fill="none" stroke={pal.a} strokeWidth="2" />
      <rect x="-5" y="58" width="110" height="4" fill={pal.a} />
      <rect x="-5" y="58" width="110" height="0.8" fill={pal.trim} />
      <g className="ra-flashes">
        {FLASHES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.3" fill="#fff" style={{ animationDelay: `${(i * 0.53).toFixed(2)}s` }} />
        ))}
      </g>
      {/* Light towers and beams */}
      {[10, 90].map((x) => (
        <g key={x}>
          <path d={`M${x} 18 L${x < 50 ? x + 46 : x - 46} 100 L${x < 50 ? x + 12 : x - 12} 100 Z`} fill={`url(#${id}-beam)`} />
          <rect x={x - 0.8} y="18" width="1.6" height="24" fill="#2a2f3d" />
          <rect x={x - 7} y="10" width="14" height="8" rx="1" fill="#2a2f3d" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={x - 5 + c * 3.3} cy={12 + r * 2.4} r="1.05" fill="#fffbe8" />),
          )}
          <circle cx={x} cy="14" r="12" fill="#fff8dc" opacity="0.18" />
        </g>
      ))}
      {/* Turf: mowed stripes, perspective yard lines, team logo spot */}
      <path d="M-20 62 L120 62 L140 100 L-40 100 Z" fill={`url(#${id}-turf)`} />
      <g clipPath={`url(#${id}-field)`}>
        {[66, 74, 84].map((y) => (
          <rect key={y} x="-40" y={y} width="180" height={y === 84 ? 8 : 4} fill="#fff" opacity="0.06" />
        ))}
        {YARD.map((x) => (
          <path key={x} d={`M${x * 0.55 + 22} 62 L${x * 1.4 - 20} 100`} stroke="#fff" strokeWidth="0.8" opacity="0.65" />
        ))}
        <ellipse cx="50" cy="90" rx="22" ry="5.5" fill={pal.a} stroke={pal.trim} strokeWidth="0.9" opacity="0.9" />
      </g>
      <ellipse cx="50" cy="96" rx="15" ry="2.4" fill="#000" opacity="0.4" />
      <g transform="translate(31.3 46.8) scale(0.85)">
        <PixelPlayer player={player} pal={pal} number={number} />
      </g>
    </svg>
  );
};

export default StadiumArt;
