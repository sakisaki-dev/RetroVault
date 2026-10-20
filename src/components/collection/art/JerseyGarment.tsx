import { JERSEY_PATH, type Palette } from './shared';
import type { TeamStyle } from './teamStyle';
import { sleeveBands, type Uniform } from './sprite/uniforms';

/** Mirror a path drawn on the left sleeve (x → 120 − x) for the right one. */
const mirror = (d: string) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x: string, y: string) => `${120 - Number(x)} ${y}`);
const both = (d: string) => `${d} ${mirror(d)}`;
const dark = (c: string, f = 0.62) => `color-mix(in srgb, ${c} ${Math.round(f * 100)}%, #000)`;

const YOKE = 'M38 8 C42 12 46 14.5 50 15.8 L30 27 L10 36.5 L16 18 Z';
const YOKE_EDGE = 'M10 36.5 L30 27 L31 29.4 L9.2 39.4 Z';
const BOLT = 'M3 43 L11 36.5 L11.6 39.6 L18 32 L17.4 35.4 L23 31 L16.5 39.5 L16 36.6 L9.6 42.4 L9.2 39.8 Z';
const TIGER = ['M6 30 L14 34 L9 36 Z', 'M10 25 L20 31 L13 32 Z', 'M15 21 L23 28 L17 27.6 Z', 'M3 38 L11 41 L5 43 Z'];

/** Legacy sleeve / shoulder trim per team style (no uniform given), left sleeve first (mirrored for the right). */
const SLEEVE: Record<TeamStyle['sleeve'], { d: string; tone: 'trim' | 'accent' }[]> = {
  stripes2: [
    { d: 'M2 41 L22 31 L23.5 35.5 L4 45.5 Z', tone: 'trim' },
    { d: 'M5.5 36 L20.5 28.5 L21.3 31 L6.6 38.6 Z', tone: 'trim' },
  ],
  stripes3: [
    { d: 'M2.5 43 L22.5 33 L23.5 36 L3.8 46 Z', tone: 'trim' },
    { d: 'M4.5 38.5 L21.5 30 L22.4 32.6 L5.6 41.2 Z', tone: 'accent' },
    { d: 'M6.6 34 L20.5 27 L21.3 29.4 L7.6 36.5 Z', tone: 'trim' },
  ],
  yoke: [
    { d: YOKE, tone: 'trim' },
    { d: YOKE_EDGE, tone: 'accent' },
  ],
  bolt: [{ d: BOLT, tone: 'trim' }],
  tiger: TIGER.map((d) => ({ d, tone: 'accent' as const })),
  none: [],
};
/** The whole left sleeve (tiger sleeves are filled in the yoke colour) */
const SLEEVE_D = 'M16 18 L38 8 C40 10 41 11 42 12 L30 27 L24 48 L20 56 L2 46 Z';
/** Thin cap along the top of the shoulder */
const SHOULDER_D = 'M16 18 L38 8 L40.2 10.4 L17.4 21 Z';

const f2 = (n: number) => n.toFixed(2);
/**
 * Sleeve stripes from the uniform's bands, as strips parallel to the cuff (A → B), stacked from just above the cuff
 * towards the shoulder (bands are listed shoulder first). Widths are half sprite pixels → 1.5 units each.
 */
const bandPaths = (u: Uniform): { d: string; fill: string }[] => {
  const bands = sleeveBands(u);
  const A: [number, number] = [0.5, 45.2];
  const B: [number, number] = [18.9, 55.4];
  const n: [number, number] = [0.486, -0.874];
  const unit = 1.5;
  let d = 4.2;
  const out: { d: string; fill: string }[] = [];
  [...bands].reverse().forEach(([col, w]) => {
    const d1 = d + (w ?? 1) * unit;
    if (col) {
      const p = (q: [number, number], k: number) => `${f2(q[0] + n[0] * k)} ${f2(q[1] + n[1] * k)}`;
      out.push({ d: `M${p(A, d)} L${p(B, d)} L${p(B, d1)} L${p(A, d1)} Z`, fill: col });
    }
    d = d1;
  });
  return out;
};

/** Sleeve and shoulder trim (and bumblebee hoops) for a uniform, front or back: draw inside the jersey's clip. */
export const UniformSleeves = ({ u }: { u: Uniform }) => (
  <>
    {u.sleeve === 'tiger' && u.yoke && <path d={both(SLEEVE_D)} fill={u.yoke} />}
    {u.sleeve === 'tiger' && TIGER.map((d, i) => <path key={i} d={both(d)} fill={u.yoke && u.yoke !== u.jersey ? u.jersey : u.trim} />)}
    {u.sleeve === 'yoke' && <path d={both(YOKE)} fill={u.yoke ?? u.trim} />}
    {u.sleeve === 'yoke' && <path d={both(YOKE_EDGE)} fill={u.trim} />}
    {u.sleeve === 'bolt' && <path d={both(BOLT)} fill={u.trim} />}
    {u.sleeve !== 'tiger' && u.sleeve !== 'bolt' && bandPaths(u).map((b, i) => <path key={i} d={both(b.d)} fill={b.fill} />)}
    {u.shoulder && <path d={both(SHOULDER_D)} fill={u.shoulder} />}
    {/* Bumblebee hoops round the body */}
    {u.sleeve === 'bands' && [44, 58, 72, 86, 100].map((y) => <rect key={y} x="0" y={y} width="120" height="5" fill={u.trim} />)}
  </>
);

const COLLAR = {
  v: { outer: 'M38 8 L60 27 L82 8 L77.5 6 L60 21 L42.5 6 Z', inner: 'M42.5 6 L60 21 L77.5 6' },
  round: { outer: 'M38 8 C44 14 52 17 60 17 C68 17 76 14 82 8 L78 6 C72 11 66 13 60 13 C54 13 48 11 42 6 Z', inner: 'M42 6 C48 11 54 13 60 13 C66 13 72 11 78 6' },
};

interface JerseyGarmentProps {
  pal: Palette;
  style: TeamStyle;
  number?: number | null;
  logo?: string | null;
  /** Unique id prefix for clip paths / gradients */
  id: string;
  /** Lighter detail for small renders (no mesh, no folds) */
  simple?: boolean;
  /** The uniform to draw (jersey, sleeve bands, collar, numbers); without it, the palette + team style */
  uniform?: Uniform;
}

/**
 * A front game jersey in a 120 × 110 box, with the team's real details: sleeve stripes / yoke / bolt / tiger
 * sleeves and shoulder cap (from the uniform, the same table as the sprite), a contrast V or round collar, a team
 * logo patch on the chest, TV numbers on the shoulders, the big chest number with one or two outlines, side panels,
 * and fabric shading (mesh, folds, a light from the top left).
 */
const JerseyGarment = ({ pal, style, number, logo, id, simple = false, uniform: u }: JerseyGarmentProps) => {
  const tone = (t: 'trim' | 'accent') => (t === 'trim' ? pal.trim : style.accent);
  const collar = COLLAR[style.collar];
  const num = number != null ? String(number) : null;
  const numFs = num && num.length > 1 ? 44 : 50;
  const body = u?.jersey ?? pal.a;
  const trim = u?.trim ?? pal.trim;
  const numFill = u?.number ?? pal.onA;
  const numLine = u?.numberOutline ?? pal.trim;
  const numLine2 = u ? (u.numberOutline2 ?? u.trim) : style.accent;
  const numbers = u?.numberStyle ?? style.numbers;
  const collarFill = u ? (u.collar ?? u.trim) : style.contrastCollar ? pal.trim : pal.aDark;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-jc`}>
          <path d={JERSEY_PATH} />
        </clipPath>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.26" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.42" />
        </linearGradient>
        {!simple && (
          <pattern id={`${id}-mesh`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="0.45" fill="#000" opacity="0.16" />
          </pattern>
        )}
      </defs>
      <path d={JERSEY_PATH} fill={body} />
      <g clipPath={`url(#${id}-jc)`}>
        {/* Side panels */}
        <path d="M24 58 L31 58 L31 108 L24 108 Z M89 58 L96 58 L96 108 L89 108 Z" fill="#000" opacity="0.18" />
        <path d="M31 58 L32 58 L32 108 L31 108 Z M88 58 L89 58 L89 108 L88 108 Z" fill={trim} opacity="0.7" />
        {/* Sleeve trim */}
        {u ? <UniformSleeves u={u} /> : SLEEVE[style.sleeve].map((s, i) => <path key={i} d={both(s.d)} fill={tone(s.tone)} />)}
        {/* Sleeve cuffs */}
        <path d={both('M2 46 L20 56 L21.2 53.6 L3.6 43.6 Z')} fill={u ? dark(body) : pal.aDark} />
        {!simple && (
          <>
            <rect width="120" height="110" fill={`url(#${id}-mesh)`} />
            {/* Folds: under the arms, down the chest, a crease at the belly */}
            <path d="M26 50 C30 66 28 86 30 108 L36 108 C33 86 34 66 31 50 Z M94 50 C90 66 92 86 90 108 L84 108 C87 86 86 66 89 50 Z" fill="#000" opacity="0.14" />
            <path d="M46 30 C43 52 45 80 50 108 L55 108 C50 80 49 52 50 30 Z" fill="#000" opacity="0.08" />
            <path d="M70 34 C74 54 72 82 69 108 L73 108 C77 82 78 54 74 34 Z" fill="#fff" opacity="0.07" />
            <path d="M28 98 C46 94 74 94 92 98 L92 101 C74 97 46 97 28 101 Z" fill="#000" opacity="0.12" />
          </>
        )}
        <rect width="120" height="110" fill={`url(#${id}-light)`} />
      </g>
      {/* Collar */}
      <path d={collar.outer} fill={collarFill} stroke="#000" strokeOpacity="0.3" strokeWidth="0.6" />
      <path d={collar.inner} fill="none" stroke={u ? body : style.accent} strokeWidth="0.9" opacity="0.8" />
      <path d={JERSEY_PATH} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
      {/* Logo patch */}
      {logo && (
        <g>
          <rect x="70.5" y="25" width="11" height="11" rx="2" fill="#fff" opacity="0.92" />
          <image href={logo} x="71" y="25.5" width="10" height="10" preserveAspectRatio="xMidYMid meet" />
        </g>
      )}
      {num && (
        <>
          {/* TV numbers on the shoulders */}
          {[
            [21, 26, -24],
            [99, 26, 24],
          ].map(([x, y, r]) => (
            <text key={x} x={x} y={y} textAnchor="middle" className="ra-display" fontSize="8.5" fill={numFill} stroke={numbers === 'solid' ? 'none' : numLine} strokeWidth="0.8" paintOrder="stroke" transform={`rotate(${r} ${x} ${y})`}>
              {num}
            </text>
          ))}
          {numbers === 'double' && (
            <text x="60" y="84" textAnchor="middle" className="ra-display" fontSize={numFs} letterSpacing="-1" fill="none" stroke={numLine2} strokeWidth="5" strokeLinejoin="round">
              {num}
            </text>
          )}
          <text
            x="60"
            y="84"
            textAnchor="middle"
            className="ra-display"
            fontSize={numFs}
            letterSpacing="-1"
            fill={numFill}
            stroke={numbers === 'solid' ? 'none' : numLine}
            strokeWidth="2.4"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {num}
          </text>
          {/* Twill sheen on the number */}
          <text x="60" y="84" textAnchor="middle" className="ra-display" fontSize={numFs} letterSpacing="-1" fill={`url(#${id}-light)`} opacity="0.8">
            {num}
          </text>
        </>
      )}
    </g>
  );
};

export default JerseyGarment;
