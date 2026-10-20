import { useId } from 'react';
import { HelmetShape } from './HelmetArt';
import JerseyGarment from './JerseyGarment';
import { surnameOf, type ArtProps } from './shared';
import { logoFor, teamStyleFor } from './teamStyle';

/** Style: his stall in the locker room: nameplate, helmet on the shelf, game jersey on a hanger, a warm downlight. */
const LockerArt = ({ player, number, pal }: ArtProps) => {
  const id = `l${useId().replace(/:/g, '')}`;
  const name = surnameOf(player.name).toUpperCase();
  const fs = Math.min(7, 44 / ((name.length + 3) * 0.56));
  const style = teamStyleFor(player);
  const logo = logoFor(player);
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
        <HelmetShape pal={pal} number={number} id={id} style={style} logo={logo} />
      </g>
      {/* Rod, hanger, jersey */}
      <rect x="12" y="37" width="76" height="1.4" rx="0.7" fill="#9aa1ab" />
      <path d="M50 37 c2 -3 -2 -4 -2 -1.5" fill="none" stroke="#c4c9d1" strokeWidth="0.8" />
      <g transform="translate(17 40) scale(0.55)">
        <path d="M14 18 L60 2 L106 18" fill="none" stroke="#6b4a2b" strokeWidth="4" strokeLinecap="round" />
        <JerseyGarment pal={pal} style={style} number={number} logo={logo} id={`${id}-g`} />
      </g>
      {/* Cleats on the floor, in team colours */}
      <g transform="translate(66 92)">
        <path d="M0 4 C0 1 3 0 6 0 L12 2 C15 3 16 5 16 6 L0 6 Z" fill="#1a1d24" />
        <path d="M2 2 L12 3.4" stroke={pal.trim} strokeWidth="1.2" />
      </g>
      <rect width="100" height="100" fill={`url(#${id}-lamp)`} />
    </svg>
  );
};

export default LockerArt;
