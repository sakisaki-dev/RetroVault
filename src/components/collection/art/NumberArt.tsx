import { useId } from 'react';
import type { ArtProps } from './shared';

const RAYS = Array.from({ length: 20 }, (_, i) => i);

/** Style: a giant 3D-extruded jersey number over refractor rays and halftone, Prizm style. */
const NumberArt = ({ player, number, pal }: ArtProps) => {
  const id = `n${useId().replace(/:/g, '')}`;
  const label = number != null ? String(number) : player.position;
  const fs = label.length > 1 ? 70 : 86;
  const x = 52;
  const y = 82;
  return (
    <svg className="ra ra--number" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-fade`} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-m`}>
          <rect width="100" height="100" fill={`url(#${id}-fade)`} />
        </mask>
        <pattern id={`${id}-dots`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2" cy="2" r="1.05" fill={pal.trim} />
        </pattern>
        <pattern id={`${id}-fine`} width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="1.1" cy="1.1" r="0.55" fill="#000" opacity="0.35" />
        </pattern>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.48" stopColor={pal.aLight} />
          <stop offset="0.52" stopColor={pal.a} />
          <stop offset="1" stopColor={pal.aDark} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-txt`}>
          <text x={x} y={y} textAnchor="middle" className="ra-display ra-italic" fontSize={fs} letterSpacing="-2">
            {label}
          </text>
        </clipPath>
      </defs>
      {/* Refractor rays + halftone, fading out from the centre */}
      <g mask={`url(#${id}-m)`}>
        {RAYS.map((i) => (
          <path key={i} d="M50 55 L48 -40 L52 -40 Z" fill={i % 2 ? pal.trim : pal.a} opacity={i % 2 ? 0.35 : 0.6} transform={`rotate(${i * 18} 50 55)`} />
        ))}
        <rect width="100" height="100" fill={`url(#${id}-dots)`} opacity="0.5" />
      </g>
      {/* Extrude */}
      {Array.from({ length: 9 }, (_, i) => 9 - i).map((i) => (
        <text key={i} x={x + i * 0.7} y={y + i * 0.7} textAnchor="middle" className="ra-display ra-italic" fontSize={fs} letterSpacing="-2" fill={i > 7 ? '#000' : pal.aDeep} opacity={i > 7 ? 0.5 : 1}>
          {label}
        </text>
      ))}
      <text x={x} y={y} textAnchor="middle" className="ra-display ra-italic" fontSize={fs} letterSpacing="-2" fill={`url(#${id}-face)`} stroke={pal.trim} strokeWidth="1.8" paintOrder="stroke">
        {label}
      </text>
      <g clipPath={`url(#${id}-txt)`}>
        <rect width="100" height="100" fill={`url(#${id}-fine)`} />
        <rect className="ra-shine" x="-60" width="100" height="100" fill={`url(#${id}-shine)`} />
      </g>
    </svg>
  );
};

export default NumberArt;
