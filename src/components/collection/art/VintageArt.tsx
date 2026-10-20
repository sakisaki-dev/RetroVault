import { useId } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { HelmetShape } from './HelmetArt';
import type { ArtProps } from './shared';
import { logoFor, teamStyleFor } from './teamStyle';
import { homeUniform, sleeveBands } from './sprite/uniforms';

const BUST = 'M8 108 C10 84 24 70 44 66 L76 66 C92 70 100 84 100 108 Z';

/** Printed ink: a uniform colour pulled towards the card's deep ink, like a two-colour press run. */
const ink = (c: string, deep: string, f = 0.68) => `color-mix(in srgb, ${c} ${Math.round(f * 100)}%, ${deep})`;

/**
 * Style: a 1970s/80s Topps-style photo window, a halftone bust in helmet and pads printed in the uniform's colours
 * (the card's uniform: home, or a rolled alternate, with its helmet), and a team pennant.
 */
const VintageArt = ({ player, number, pal, uniform }: ArtProps) => {
  const id = `v${useId().replace(/:/g, '')}`;
  const team = (findNFLTeam(player.team)?.name ?? 'Retro Vault').toUpperCase();
  const fs = Math.min(9, 54 / (team.length * 0.55));
  const u = uniform ?? homeUniform(player.team);
  const style = teamStyleFor(player, u);
  const body = ink(u.jersey, pal.aDeep);
  const stripes = sleeveBands(u).filter(([c]) => c).map(([c]) => c as string);
  const logo = logoFor(player);
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
        <path d={BUST} fill={body} />
        <rect x="52" y="54" width="18" height="14" fill={ink(u.jersey, pal.aDeep, 0.5)} />
        <g transform="translate(26 6) scale(0.6)">
          <HelmetShape pal={pal} id={id} flat ink={pal.aDeep} style={style} />
        </g>
        <g clipPath={`url(#${id}-bust)`} mask={`url(#${id}-hm)`}>
          <rect width="100" height="108" fill={`url(#${id}-hi)`} opacity="0.85" />
        </g>
        {number != null && (
          <text x="76" y="88" textAnchor="middle" className="ra-display" fontSize="18" fill={ink(u.number, '#f4ead2', 0.75)} stroke={u.numberStyle === 'solid' ? 'none' : ink(u.numberOutline, pal.aDeep, 0.8)} strokeWidth="1" paintOrder="stroke" opacity="0.92">
            {number}
          </text>
        )}
        {/* Shoulder yoke / cap, sleeve stripes and collar, in the uniform's colours */}
        {(u.sleeve === 'yoke' || u.sleeve === 'tiger') && u.yoke && <path d="M14 72 C20 64 30 62 40 64 L36 70 C28 69 21 71 16 76 Z M86 72 C80 64 72 62 64 64 L66 70 C72 69 79 71 84 76 Z" fill={ink(u.yoke, pal.aDeep, 0.8)} opacity="0.9" />}
        {u.shoulder && <path d="M14 70 L34 62 M86 70 L70 62" stroke={ink(u.shoulder, '#f4ead2', 0.8)} strokeWidth="1.6" opacity="0.8" />}
        {stripes.slice(0, 3).map((c, i) => (
          <path key={i} d={`M${12 - i} ${76 + i * 2} L${32 - i} ${67 + i * 2} M${88 + i} ${76 + i * 2} L${70 + i} ${67 + i * 2}`} stroke={ink(c, '#f4ead2', 0.85)} strokeWidth="1.4" opacity="0.85" />
        ))}
        {u.sleeve === 'bolt' && <path d="M12 76 L20 70 L19 73 L30 66 M88 76 L80 70 L81 73 L70 66" fill="none" stroke={ink(u.trim, '#f4ead2', 0.85)} strokeWidth="1.6" />}
        <path d="M50 66 L60 76 L70 66" fill="none" stroke={ink(u.collar ?? u.trim, '#f4ead2', 0.85)} strokeWidth="2" opacity="0.85" />
      </g>
      {/* Frame: team colour rule + cream inner line */}
      <rect x="7" y="6" width="86" height="94" rx="7" fill="none" stroke={pal.a} strokeWidth="3.2" />
      <rect x="9.8" y="8.8" width="80.4" height="88.4" rx="5" fill="none" stroke="#f4ead2" strokeWidth="0.8" opacity="0.8" />
      {/* Team badge, top right (like the old cards' team crest) */}
      {logo && (
        <g>
          <circle cx="83" cy="17" r="8.5" fill="#efe4c8" stroke={pal.a} strokeWidth="1.6" />
          <image href={logo} x="76.5" y="10.5" width="13" height="13" preserveAspectRatio="xMidYMid meet" />
        </g>
      )}
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
