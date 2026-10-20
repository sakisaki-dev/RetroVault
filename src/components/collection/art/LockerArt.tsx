import { useId } from 'react';
import { HelmetShape } from './HelmetArt';
import { JERSEY_PATH, surnameOf, type ArtProps } from './shared';

/** Style: his stall in the locker room: nameplate, helmet on the shelf, game jersey on a hanger, a warm downlight. */
const LockerArt = ({ player, number, pal }: ArtProps) => {
  const id = `l${useId().replace(/:/g, '')}`;
  const name = surnameOf(player.name).toUpperCase();
  const fs = Math.min(7, 44 / ((name.length + 3) * 0.56));
  return (
    <svg className="ra ra--locker" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#24180f" />
          <stop offset="0.5" stopColor="#4a3423" />
          <stop offset="1" stopColor="#24180f" />
        </linearGradient>
        <radialGradient id={`${id}-lamp`} cx="0.5" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#ffe9b8" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffe9b8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.aLight} />
          <stop offset="1" stopColor={pal.aDark} />
        </linearGradient>
        <linearGradient id={`${id}-fab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <clipPath id={`${id}-jc`}>
          <path d={JERSEY_PATH} />
        </clipPath>
      </defs>
      {/* Stall back and boards */}
      <rect width="100" height="100" fill={`url(#${id}-wood)`} />
      {[20, 32, 44, 56, 68, 80].map((x) => (
        <rect key={x} x={x} y="0" width="0.6" height="100" fill="#000" opacity="0.3" />
      ))}
      {/* Side walls in team colour */}
      <path d="M0 0 L12 8 L12 100 L0 100 Z" fill={pal.aDeep} />
      <path d="M100 0 L88 8 L88 100 L100 100 Z" fill={pal.aDeep} />
      <path d="M12 8 L12 100 M88 8 L88 100" stroke={pal.trim} strokeWidth="0.8" opacity="0.7" />
      {/* Nameplate */}
      <rect x="24" y="1.5" width="52" height="9" rx="1.5" fill={`url(#${id}-plate)`} stroke={pal.trim} strokeWidth="0.8" />
      <text x="50" y="8.6" textAnchor="middle" className="ra-display" fontSize={fs} fill={pal.onA} letterSpacing="0.6">
        {name}
        {number != null ? ` ${number}` : ''}
      </text>
      {/* Shelf + helmet */}
      <rect x="12" y="27" width="76" height="3" fill="#2b1d12" />
      <rect x="12" y="30" width="76" height="1" fill="#000" opacity="0.4" />
      <g transform="translate(39 11) scale(0.2)">
        <HelmetShape pal={pal} number={number} id={id} />
      </g>
      {/* Rod, hanger, jersey */}
      <rect x="12" y="37" width="76" height="1.4" rx="0.7" fill="#9aa1ab" />
      <path d="M50 37 c2 -3 -2 -4 -2 -1.5" fill="none" stroke="#c4c9d1" strokeWidth="0.8" />
      <g transform="translate(17 40) scale(0.55)">
        <path d="M14 18 L60 2 L106 18" fill="none" stroke="#6b4a2b" strokeWidth="4" strokeLinecap="round" />
        <path d={JERSEY_PATH} fill={pal.a} />
        <g clipPath={`url(#${id}-jc)`}>
          <path d="M2 40 L22 30 L24 36 L4 46 Z M118 40 L98 30 L96 36 L116 46 Z" fill={pal.trim} />
          <path d="M24 60 L32 60 L32 108 L24 108 Z M88 60 L96 60 L96 108 L88 108 Z" fill="#000" opacity="0.2" />
          <path d="M44 20 C40 50 44 80 50 108 L60 108 C54 80 52 50 52 20 Z" fill="#000" opacity="0.14" />
          <rect width="120" height="110" fill={`url(#${id}-fab)`} />
        </g>
        <path d="M38 8 C44 14 52 17 60 17 C68 17 76 14 82 8 L78 6 C72 11 66 13 60 13 C54 13 48 11 42 6 Z" fill={pal.trim} />
        {number != null && (
          <text x="60" y="80" textAnchor="middle" className="ra-display" fontSize="44" fill={pal.onA} stroke={pal.trim} strokeWidth="2.2" paintOrder="stroke">
            {number}
          </text>
        )}
      </g>
      <rect width="100" height="100" fill={`url(#${id}-lamp)`} />
    </svg>
  );
};

export default LockerArt;
