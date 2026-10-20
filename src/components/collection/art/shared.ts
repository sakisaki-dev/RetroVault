import type { GamePlayer } from '@/config/ovr';
import { findNFLTeam } from '@/utils/nflTeams';

/** Every art style takes the same props: the player, his jersey number and a palette built from his team colours. */
export interface ArtProps {
  player: GamePlayer;
  number?: number | null;
  pal: Palette;
}

export interface Palette {
  /** Primary / secondary team colours */
  a: string;
  b: string;
  aDark: string;
  aDeep: string;
  aLight: string;
  bDark: string;
  /** Readable ink on top of the primary colour (white, or near-black on very light primaries) */
  onA: string;
  /** Accent that always contrasts with the primary (secondary, or a gold/white fallback when the two are too close) */
  trim: string;
  /** Pants colour for the pixel sprite (light secondary, else white) */
  pants: string;
}

type HSL = [number, number, number];

const parse = (s: string | undefined, fallback: HSL): HSL => {
  const m = s?.match(/(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : fallback;
};
const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const css = ([h, s, l]: HSL) => `hsl(${h} ${clamp(s)}% ${clamp(l)}%)`;

/** Team palette (Retro Vault navy / gold for free agents and legends without a club). */
export const paletteFor = (player: GamePlayer): Palette => {
  const team = findNFLTeam(player.team);
  const a = parse(team?.primaryColor, [222, 45, 32]);
  const b = parse(team?.secondaryColor, [43, 100, 62]);
  const [ah, as, al] = a;
  const [bh, bs, bl] = b;
  const close = Math.abs(al - bl) < 14 && (Math.abs(ah - bh) < 30 || bs < 15 || as < 15);
  const trim: HSL = close ? (al > 60 ? [222, 40, 18] : [43, 100, 62]) : b;
  return {
    a: css(a),
    b: css(b),
    aDark: css([ah, as, al * 0.62]),
    aDeep: css([ah, as * 0.8, Math.max(6, al * 0.32)]),
    aLight: css([ah, as, al + (100 - al) * 0.35]),
    bDark: css([bh, bs, bl * 0.6]),
    onA: al > 68 ? '#141821' : '#ffffff',
    trim: css(trim),
    pants: bl > 55 ? css(b) : '#eef0f3',
  };
};

const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
export const surnameOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  while (parts.length > 1 && SUFFIX.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] ?? name;
};

/** Small stable hash, for per-player variety (skin tone, sock stripes). */
export const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export const SKIN = ['#f1c7a1', '#d9a07a', '#b97850', '#8d5537', '#6a3d26'];
export const skinFor = (player: GamePlayer) => SKIN[seedOf(player.name) % SKIN.length];

export type Pose = 'qb' | 'rb' | 'wr' | 'ol' | 'def';
export const poseFor = (position: string): Pose => {
  switch (position) {
    case 'QB':
      return 'qb';
    case 'RB':
      return 'rb';
    case 'WR':
    case 'TE':
      return 'wr';
    case 'OL':
      return 'ol';
    default:
      return 'def';
  }
};

/** Front jersey outline (same silhouette as the baseline card jersey), 120 × 110 box. */
export const JERSEY_PATH =
  'M38 8 C44 14 52 17 60 17 C68 17 76 14 82 8 L104 18 L118 46 L100 56 L96 48 L96 108 L24 108 L24 48 L20 56 L2 46 L16 18 Z';
/** Back of the jersey: same body, a higher, flatter collar. */
export const JERSEY_BACK_PATH =
  'M40 8 C46 11 53 12 60 12 C67 12 74 11 80 8 L104 18 L118 46 L100 56 L96 48 L96 108 L24 108 L24 48 L20 56 L2 46 L16 18 Z';
