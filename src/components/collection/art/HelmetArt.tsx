import { useId } from 'react';
import type { ArtProps, Palette } from './shared';

/** Helmet shell, 3/4 view facing right, in a 100 × 100 box. */
const SHELL =
  'M17 70 C9 44 24 16 53 13 C74 11 89 25 91 43 L89 54 L75 56 C71 58 70 64 72 71 L75 81 C58 86 33 85 17 70 Z';
/** Centre stripe over the crown, clipped to the shell */
const STRIPE = 'M88 36 C79 19 55 10 34 19 C21 26 14 41 15 58';

interface HelmetShapeProps {
  pal: Palette;
  number?: number | null;
  /** Unique prefix for gradient / clip ids */
  id: string;
  /** Flat two-tone fill (vintage print), no gloss */
  flat?: boolean;
  /** Override shell fill (e.g. a duotone ink) */
  ink?: string;
}

/** A football helmet as an SVG group: shell, stripe, side number, ear hole, facemask and chin strap. */
export const HelmetShape = ({ pal, number, id, flat = false, ink }: HelmetShapeProps) => {
  const shell = ink ?? (flat ? pal.a : `url(#${id}-shell)`);
  return (
    <g>
      {!flat && (
        <defs>
          <radialGradient id={`${id}-shell`} cx="0.36" cy="0.3" r="0.8">
            <stop offset="0" stopColor={pal.aLight} />
            <stop offset="0.45" stopColor={pal.a} />
            <stop offset="1" stopColor={pal.aDeep} />
          </radialGradient>
          <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-mask`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f2f4f7" />
            <stop offset="1" stopColor="#8d96a3" />
          </linearGradient>
        </defs>
      )}
      <clipPath id={`${id}-clip`}>
        <path d={SHELL} />
      </clipPath>
      {/* Facemask behind the shell edge */}
      <g fill="none" stroke={flat ? (ink ?? pal.aDeep) : `url(#${id}-mask)`} strokeLinecap="round" strokeWidth="3.4">
        <path d="M76 58 L95 57" />
        <path d="M77 68 C85 69 92 68 97 66" />
        <path d="M76 77 C84 79 91 77 96 74" />
        <path d="M95 55 C99 62 99 70 95 77" />
        <path d="M84 57 L86 78" />
      </g>
      <path d={SHELL} fill={shell} />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={STRIPE} fill="none" stroke={ink ? '#fff' : pal.trim} strokeWidth="9" opacity={ink ? 0.25 : 1} />
        <path d={STRIPE} fill="none" stroke={ink ?? pal.aDeep} strokeWidth="2.4" opacity="0.5" />
        {!flat && <path d="M17 70 C33 85 58 86 75 81 L74 74 C56 79 34 78 17 64 Z" fill="#000" opacity="0.28" />}
      </g>
      {/* Front edge (face opening) */}
      <path d="M89 54 L75 56 C71 58 70 64 72 71 L75 81" fill="none" stroke={flat ? '#000' : pal.aDeep} strokeWidth="2.2" opacity="0.7" />
      {/* Ear hole + snap */}
      <circle cx="62" cy="62" r="4.2" fill="#0d0f14" />
      <circle cx="62" cy="62" r="5.6" fill="none" stroke={ink ? '#fff' : pal.trim} strokeWidth="1.2" opacity={ink ? 0.3 : 0.8} />
      {number != null && (
        <text x="40" y="58" textAnchor="middle" className="ra-display" fontSize="22" fill={ink ? '#fff' : pal.onA} stroke={ink ? 'none' : pal.trim} strokeWidth="1.4" paintOrder="stroke" transform="rotate(-8 40 52) skewX(-6)" opacity={ink ? 0.85 : 1}>
          {number}
        </text>
      )}
      {/* Chin strap */}
      <path d="M66 70 C70 80 78 86 88 84" fill="none" stroke={flat ? '#1a1d24' : '#e8e9ec'} strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
      {!flat && (
        <>
          <ellipse cx="42" cy="27" rx="20" ry="7" fill={`url(#${id}-gloss)`} transform="rotate(-24 42 27)" />
          <path d="M23 64 C19 46 26 30 40 22" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </g>
  );
};

/** Style: one big glossy helmet in team colours, number on the side, on a team-colour spotlight. */
const HelmetArt = ({ number, pal }: ArtProps) => {
  const id = `h${useId().replace(/:/g, '')}`;
  return (
    <svg className="ra ra--helmet" viewBox="0 2 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-spot`} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor={pal.trim} stopOpacity="0.55" />
          <stop offset="1" stopColor={pal.trim} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="52" cy="54" r="46" fill={`url(#${id}-spot)`} />
      <ellipse cx="54" cy="92" rx="36" ry="5" fill="#000" opacity="0.4" />
      <g transform="translate(-2 6) scale(1.02)">
        <HelmetShape pal={pal} number={number} id={id} />
      </g>
    </svg>
  );
};

export default HelmetArt;
