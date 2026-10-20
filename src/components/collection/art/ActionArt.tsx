import { useId } from 'react';
import { poseFor, type ArtProps, type Pose } from './shared';

type P = [number, number];
interface Figure {
  head: P;
  neck: P;
  hip: P;
  /** Far arm / leg (drawn darker, behind the torso), then near */
  arms: [[P, P, P], [P, P, P]];
  legs: [[P, P], [P, P]];
  ball?: [number, number, number];
  /** Speed streak rows (y) behind the figure */
  streaks: number[];
}

/** Pictogram poses in a 100 × 100 box, moving left to right. */
const FIGURES: Record<Pose, Figure> = {
  qb: {
    head: [54, 19],
    neck: [51, 30],
    hip: [46, 58],
    arms: [
      [
        [53, 33],
        [63, 40],
        [72, 37],
      ],
      [
        [48, 33],
        [36, 27],
        [33, 15],
      ],
    ],
    legs: [
      [
        [36, 73],
        [25, 89],
      ],
      [
        [58, 72],
        [66, 90],
      ],
    ],
    ball: [32, 10, -40],
    streaks: [30, 46, 64, 80],
  },
  rb: {
    head: [66, 22],
    neck: [60, 31],
    hip: [44, 54],
    arms: [
      [
        [58, 34],
        [45, 42],
        [35, 36],
      ],
      [
        [60, 34],
        [69, 44],
        [61, 49],
      ],
    ],
    legs: [
      [
        [33, 68],
        [16, 76],
      ],
      [
        [62, 62],
        [61, 82],
      ],
    ],
    ball: [66, 45, -20],
    streaks: [26, 42, 58, 74],
  },
  wr: {
    head: [74, 35],
    neck: [66, 40],
    hip: [40, 52],
    arms: [
      [
        [67, 42],
        [79, 37],
        [89, 31],
      ],
      [
        [65, 41],
        [77, 30],
        [87, 23],
      ],
    ],
    legs: [
      [
        [27, 60],
        [12, 60],
      ],
      [
        [26, 47],
        [12, 40],
      ],
    ],
    ball: [93, 24, -30],
    streaks: [38, 50, 62, 70],
  },
  ol: {
    head: [61, 30],
    neck: [56, 38],
    hip: [40, 57],
    arms: [
      [
        [56, 42],
        [65, 53],
        [75, 52],
      ],
      [
        [57, 41],
        [67, 46],
        [77, 42],
      ],
    ],
    legs: [
      [
        [52, 73],
        [58, 90],
      ],
      [
        [29, 72],
        [22, 90],
      ],
    ],
    streaks: [34, 52, 68],
  },
  def: {
    head: [68, 37],
    neck: [61, 43],
    hip: [38, 52],
    arms: [
      [
        [60, 46],
        [72, 56],
        [83, 58],
      ],
      [
        [61, 45],
        [74, 39],
        [85, 45],
      ],
    ],
    legs: [
      [
        [48, 70],
        [45, 90],
      ],
      [
        [27, 67],
        [14, 84],
      ],
    ],
    streaks: [30, 46, 62, 78],
  },
};

const line = (a: P, b: P, c?: P) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}${c ? ` L${c[0]} ${c[1]}` : ''}`;

/** The figure as strokes: far limbs, torso, near limbs, helmet. Painted once per layer (rim, body). */
const body = (f: Figure, far: string, near: string, w = 1) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={line(f.arms[0][0], f.arms[0][1], f.arms[0][2])} stroke={far} strokeWidth={8 * w} />
    <path d={line(f.hip, f.legs[0][0], f.legs[0][1])} stroke={far} strokeWidth={10 * w} />
    <path d={line(f.neck, f.hip)} stroke={near} strokeWidth={17 * w} />
    <path d={line(f.hip, f.legs[1][0], f.legs[1][1])} stroke={near} strokeWidth={10 * w} />
    <path d={line(f.arms[1][0], f.arms[1][1], f.arms[1][2])} stroke={near} strokeWidth={8 * w} />
    <circle cx={f.head[0]} cy={f.head[1]} r={7.6 * w} fill={near} stroke="none" />
  </g>
);

/** Style: a dynamic position pose (throw, cut, layout catch, punch, tackle) in team colours with speed streaks. */
const ActionArt = ({ player, number, pal }: ArtProps) => {
  const id = `a${useId().replace(/:/g, '')}`;
  const f = FIGURES[poseFor(player.position)];
  const mid: P = [(f.neck[0] + f.hip[0]) / 2, (f.neck[1] + f.hip[1]) / 2];
  const tilt = (Math.atan2(f.hip[1] - f.neck[1], f.hip[0] - f.neck[0]) * 180) / Math.PI - 90;
  return (
    <svg className="ra ra--action" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={pal.aLight} />
          <stop offset="0.5" stopColor={pal.a} />
          <stop offset="1" stopColor={pal.aDark} />
        </linearGradient>
        <linearGradient id={`${id}-streak`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={pal.trim} stopOpacity="0" />
          <stop offset="1" stopColor={pal.trim} stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`${id}-burst`} cx="0.6" cy="0.45" r="0.55">
          <stop offset="0" stopColor={pal.trim} stopOpacity="0.45" />
          <stop offset="1" stopColor={pal.trim} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="58" cy="48" r="48" fill={`url(#${id}-burst)`} />
      <g className="ra-streaks">
        {f.streaks.map((y, i) => (
          <rect key={y} x={-4 + (i % 2) * 8} y={y} width={44 - (i % 3) * 8} height={i % 2 ? 1.6 : 2.6} rx="1.3" fill={`url(#${id}-streak)`} style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </g>
      {/* Ghost trail, rim light, body */}
      <g opacity="0.18" transform="translate(-9 0)">
        {body(f, pal.trim, pal.trim)}
      </g>
      <g transform="translate(-1.4 -1.2)">{body(f, pal.trim, pal.trim, 1.1)}</g>
      {body(f, pal.aDark, `url(#${id}-fill)`)}
      {/* Facemask stub */}
      <path d={`M${f.head[0] + 5} ${f.head[1] + 1} l5 1 m-5 3 l5 0`} stroke="#d5d9e0" strokeWidth="1.6" strokeLinecap="round" />
      {f.ball && (
        <ellipse cx={f.ball[0]} cy={f.ball[1]} rx="5.4" ry="3.4" fill="#8a4f22" stroke="#3b200e" strokeWidth="0.8" transform={`rotate(${f.ball[2]} ${f.ball[0]} ${f.ball[1]})`} />
      )}
      {number != null && (
        <text x={mid[0]} y={mid[1] + 4} textAnchor="middle" className="ra-display" fontSize="12" fill={pal.onA} stroke={pal.trim} strokeWidth="0.9" paintOrder="stroke" transform={`rotate(${tilt} ${mid[0]} ${mid[1]})`}>
          {number}
        </text>
      )}
    </svg>
  );
};

export default ActionArt;
