import { useId } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { HelmetShape } from './HelmetArt';
import type { ArtProps } from './shared';

const BUST = 'M8 108 C10 84 24 70 44 66 L76 66 C92 70 100 84 100 108 Z';

/** Style: a 1970s/80s Topps-style photo window, a duotone halftone bust in helmet and pads, and a team pennant. */
const VintageArt = ({ player, number, pal }: ArtProps) => {
  const id = `v${useId().replace(/:/g, '')}`;
  const team = (findNFLTeam(player.team)?.name ?? 'Retro Vault').toUpperCase();
  const fs = Math.min(9, 54 / (team.length * 0.55));
  return (
    <svg className="ra ra--vintage" viewBox="0 0 100 108" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${id}-dots`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
          <circle cx="1.5" cy="1.5" r="0.75" fill={pal.aDeep} />
        </pattern>
        <pattern id={`${id}-hi`} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
          <circle cx="1.2" cy="1.2" r="0.7" fill="#f4ead2" />
        </pattern>
        <radialGradient id={`${id}-light`} cx="0.25" cy="0.15" r="0.7">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-hm`}>
          <rect width="100" height="108" fill={`url(#${id}-light)`} />
        </mask>
        <clipPath id={`${id}-win`}>
          <rect x="7" y="6" width="86" height="94" rx="7" />
        </clipPath>
        <clipPath id={`${id}-bust`}>
          <path d={BUST} />
          <rect x="52" y="54" width="18" height="14" />
          <g transform="translate(26 6) scale(0.6)">
            <path d="M17 70 C9 44 24 16 53 13 C74 11 89 25 91 43 L89 54 L75 56 C71 58 70 64 72 71 L75 81 C58 86 33 85 17 70 Z" />
          </g>
        </clipPath>
      </defs>
      {/* Card stock */}
      <rect width="100" height="108" fill="#efe4c8" />
      <g clipPath={`url(#${id}-win)`}>
        <rect width="100" height="108" fill={pal.aLight} opacity="0.55" />
        <rect width="100" height="108" fill={`url(#${id}-dots)`} opacity="0.22" />
        {/* Duotone bust */}
        <path d={BUST} fill={pal.aDeep} />
        <rect x="52" y="54" width="18" height="14" fill={pal.aDeep} />
        <g transform="translate(26 6) scale(0.6)">
          <HelmetShape pal={pal} id={id} flat ink={pal.aDeep} />
        </g>
        <g clipPath={`url(#${id}-bust)`} mask={`url(#${id}-hm)`}>
          <rect width="100" height="108" fill={`url(#${id}-hi)`} opacity="0.85" />
        </g>
        {number != null && (
          <text x="76" y="88" textAnchor="middle" className="ra-display" fontSize="18" fill="#f4ead2" opacity="0.9">
            {number}
          </text>
        )}
        <path d="M14 70 L34 62 M86 70 L70 62" stroke="#f4ead2" strokeWidth="2.4" opacity="0.6" />
      </g>
      {/* Frame: team colour rule + cream inner line */}
      <rect x="7" y="6" width="86" height="94" rx="7" fill="none" stroke={pal.a} strokeWidth="3.2" />
      <rect x="9.8" y="8.8" width="80.4" height="88.4" rx="5" fill="none" stroke="#f4ead2" strokeWidth="0.8" opacity="0.8" />
      {/* Pennant */}
      <g transform="translate(0 4) rotate(-8 30 84)">
        <path d="M4 76 L66 80 L58 86 L66 92 L4 94 Z" fill={pal.trim} stroke={pal.aDeep} strokeWidth="1" />
        <text x="8" y="88.5" className="ra-display ra-italic" fontSize={fs} fill={pal.aDeep} letterSpacing="0.4">
          {team}
        </text>
      </g>
    </svg>
  );
};

export default VintageArt;
