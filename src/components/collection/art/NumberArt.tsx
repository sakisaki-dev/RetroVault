import { useId } from 'react';
import { prizmInfo, prizmSerial, type PrizmParallel } from '@/config/cardTiers';
import type { ArtProps } from './shared';

const RAYS = Array.from({ length: 20 }, (_, i) => i);

/**
 * Refractor colours per Prizm parallel: the ray colour, its highlight (alternate rays, halftone, the number's outline)
 * and the wash behind them. A Black is dark rays with silver highlights over a near-black wash.
 */
const PARALLEL_INK: Record<PrizmParallel, { ray: string; hi: string; wash: string }> = {
  red: { ray: '#e2363f', hi: '#ff9ea3', wash: '#e2363f' },
  blue: { ray: '#2f7be6', hi: '#a6ccff', wash: '#2f7be6' },
  green: { ray: '#1fae5a', hi: '#9aeabd', wash: '#1fae5a' },
  gold: { ray: '#f0b93a', hi: '#fff2bf', wash: '#f0b93a' },
  black: { ray: '#08090c', hi: '#cfd4de', wash: '#000000' },
};

/**
 * Style: a giant 3D-extruded jersey number over refractor rays and halftone, Prizm style. A colour parallel (`prizm`)
 * turns the rays, halftone and number outline to its colour over a wash of it, and stamps its serial ("27/99") in the
 * art window's top-right corner, clear of the number.
 */
const NumberArt = ({ player, number, pal, prizm }: ArtProps) => {
  const id = `n${useId().replace(/:/g, '')}`;
  const ink = prizm ? PARALLEL_INK[prizm.c] : null;
  const rayA = ink?.ray ?? pal.a;
  const rayB = ink?.hi ?? pal.trim;
  const serial = prizm ? prizmSerial(prizm) : null;
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
          <circle cx="2" cy="2" r="1.05" fill={rayB} />
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
      {/* Refractor rays + halftone, fading out from the centre (a parallel: in its colour, over a wash of it) */}
      <g mask={`url(#${id}-m)`}>
        {ink && <rect width="100" height="100" fill={ink.wash} opacity={prizm!.c === 'black' ? 0.7 : 0.45} />}
        {RAYS.map((i) => (
          <path key={i} d="M50 55 L48 -40 L52 -40 Z" fill={i % 2 ? rayB : rayA} opacity={i % 2 ? (ink ? 0.5 : 0.35) : ink ? 0.8 : 0.6} transform={`rotate(${i * 18} 50 55)`} />
        ))}
        <rect width="100" height="100" fill={`url(#${id}-dots)`} opacity="0.5" />
      </g>
      {/* Extrude */}
      {Array.from({ length: 9 }, (_, i) => 9 - i).map((i) => (
        <text key={i} x={x + i * 0.7} y={y + i * 0.7} textAnchor="middle" className="ra-display ra-italic" fontSize={fs} letterSpacing="-2" fill={i > 7 ? '#000' : pal.aDeep} opacity={i > 7 ? 0.5 : 1}>
          {label}
        </text>
      ))}
      <text x={x} y={y} textAnchor="middle" className="ra-display ra-italic" fontSize={fs} letterSpacing="-2" fill={`url(#${id}-face)`} stroke={ink ? ink.hi : pal.trim} strokeWidth="1.8" paintOrder="stroke">
        {label}
      </text>
      <g clipPath={`url(#${id}-txt)`}>
        <rect width="100" height="100" fill={`url(#${id}-fine)`} />
        <rect className="ra-shine" x="-60" width="100" height="100" fill={`url(#${id}-shine)`} />
      </g>
      {/* Serial stamp: foil numbering in the top-right corner, above the rays and clear of the number */}
      {serial && prizm && (
        <g className="ra-serial">
          <rect x={96 - serial.length * 3.6 - 3} y="3" width={serial.length * 3.6 + 6} height="9" rx="2" fill="#0b0d14" fillOpacity="0.72" stroke={ink!.hi} strokeWidth="0.6" />
          <text x="96" y="10" textAnchor="end" className="ra-display" fontSize="6.4" fill={prizm.c === 'black' ? '#e8ebf2' : ink!.hi} letterSpacing="0.2">
            <title>{`${prizmInfo(prizm.c).label} parallel, serial ${serial}`}</title>
            {serial}
          </text>
        </g>
      )}
    </svg>
  );
};

export default NumberArt;
