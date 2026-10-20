import { useId } from 'react';
import { JERSEY_BACK_PATH, surnameOf, type ArtProps } from './shared';
import { UniformSleeves } from './JerseyGarment';
import { homeUniform } from './sprite/uniforms';

/**
 * Style: the back of the card's jersey (home, or a rolled alternate) on a hanger: sleeve stripes, collar, surname
 * arched over the big number in the uniform's number colours, with fabric folds.
 */
const JerseyBackArt = ({ player, number, pal, uniform }: ArtProps) => {
  const id = `b${useId().replace(/:/g, '')}`;
  const u = uniform ?? homeUniform(player.team);
  const outline = u.numberStyle === 'solid' ? 'none' : u.numberOutline;
  const name = surnameOf(player.name).toUpperCase();
  const fs = Math.min(14, 70 / (name.length * 0.56));
  return (
    <svg className="ra ra--back" viewBox="0 -14 120 126" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={JERSEY_BACK_PATH} />
        </clipPath>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <path id={`${id}-arc`} d="M28 42 Q60 26 92 42" />
        <pattern id={`${id}-mesh`} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.45" fill="#000" opacity="0.18" />
        </pattern>
      </defs>
      {/* Hanger */}
      <path d="M60 -10 c4 0 5 4 2 6 c-2 1 -2 3 -2 5" fill="none" stroke="#b9bec7" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 16 L60 1 L98 16" fill="none" stroke="#6b4a2b" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="60" cy="110" rx="42" ry="3" fill="#000" opacity="0.35" />
      <g>
        <path d={JERSEY_BACK_PATH} fill={u.jersey} />
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="0" y="0" width="120" height="112" fill={`url(#${id}-mesh)`} />
          {/* Sleeve stripes / yoke / shoulder cap, and the cuffs */}
          <UniformSleeves u={u} />
          <path d="M2 46 L20 56 L21.2 53.6 L3.6 43.6 Z M118 46 L100 56 L98.8 53.6 L116.4 43.6 Z" fill={`color-mix(in srgb, ${u.jersey} 62%, #000)`} />
          {/* Folds and sheen */}
          <path d="M30 60 C40 70 38 90 30 108 L40 108 C46 90 46 72 34 58 Z" fill={`url(#${id}-fold)`} />
          <path d="M86 56 C80 70 82 92 90 108 L80 108 C74 92 74 70 82 54 Z" fill={`url(#${id}-fold)`} />
          <path d="M50 18 C46 40 50 70 56 108 L66 108 C60 70 56 40 58 18 Z" fill={`url(#${id}-sheen)`} />
          <rect x="0" y="0" width="120" height="112" fill={`url(#${id}-light)`} />
        </g>
        <path d="M40 8 C46 11 53 12 60 12 C67 12 74 11 80 8 L78 6 C72 9 66 10 60 10 C54 10 48 9 42 6 Z" fill={u.collar ?? u.trim} />
        <text className="ra-display" fontSize={fs} fill={u.number} letterSpacing="0.5">
          <textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">
            {name}
          </textPath>
        </text>
        {number != null && u.numberStyle === 'double' && (
          <text x="60" y="94" textAnchor="middle" className="ra-display" fontSize="50" letterSpacing="-1" fill="none" stroke={u.numberOutline2 ?? u.trim} strokeWidth="5.4" strokeLinejoin="round">
            {number}
          </text>
        )}
        {number != null && (
          <text x="60" y="94" textAnchor="middle" className="ra-display" fontSize="50" letterSpacing="-1" fill={u.number} stroke={outline} strokeWidth="2.6" strokeLinejoin="round" paintOrder="stroke">
            {number}
          </text>
        )}
      </g>
    </svg>
  );
};

export default JerseyBackArt;
