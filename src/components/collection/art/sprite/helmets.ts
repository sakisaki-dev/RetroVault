import { findNFLTeam } from '@/utils/nflTeams';
import { HELMET_LOGOS } from './helmetLogos';
import { F, line, stamp, type Key, type Rect } from './grid';
import { eyes, faceHair, mouth, type HeadOpts } from './faces';
import { set } from './grid';

/**
 * Every club's helmet, low-res: shell colour, crown stripe, facemask colour and a 7 × 5 pixel logo for the side of
 * the shell (Retro Bowl menu-helmet style). Used by the sprite (helmet on, in hand, on the ground), by the Art lab's
 * Helmets row, and (shell / stripe / mask) by the Helmet hero, Locker and Topps art through teamStyle.ts.
 *
 *   stripe   'none' | 'single' (one centre stripe) | 'double' (two thin) | 'triple' (centre + two edges)
 *   stripes  [centre, edge] colours
 *   logo     5 rows of 7: digits index `colors`, '.' = shell
 */
export interface Helmet {
  shell: string;
  stripe: 'none' | 'single' | 'double' | 'triple';
  stripes: [string, string];
  mask: string;
  logo: string[];
  colors: string[];
  /** Pants colour (the team's usual home pants) */
  pants?: string;
  /** Detailed logo on the fine grid (2 cells per sprite pixel), from scripts/build_helmet_logos.py */
  fine?: { rows: string[]; colors: string[] };
  /** Shell design instead of a decal (Bengals tiger stripes, Rams horn) */
  pattern?: 'tiger' | 'rams';
}

const W = '#f4f5f7';
const K = '#14161b';
const GREY = '#9aa3ad';

export const HELMETS: Record<string, Helmet> = {
  bills: { shell: W, stripe: 'triple', stripes: ['#c60c30', '#00338d'], mask: '#00338d', colors: ['#c60c30', '#00338d'], logo: ['..111..', '.111111', '1111111', '.1.1.1.', '2222...'] },
  dolphins: { shell: W, stripe: 'triple', stripes: ['#008e97', '#fc4c02'], mask: '#008e97', colors: ['#008e97', '#fc4c02'], logo: ['..22...', '.2222..', '111111.', '..1111.', '....11.'] },
  patriots: { shell: '#b0b7bc', stripe: 'none', stripes: ['#002244', '#c60c30'], mask: '#002244', colors: ['#002244', '#c60c30', W], logo: ['.333...', '3111111', '.112222', '..11...', '.......'] },
  jets: { shell: '#125740', stripe: 'none', stripes: [W, W], mask: W, colors: [W], logo: ['1.1.1.1', '111.1.1', '111..1.', '1.1..1.', '.......'] },
  ravens: { shell: '#1a1a1a', stripe: 'none', stripes: ['#241773', '#9e7c0c'], mask: '#1a1a1a', colors: ['#5b3fa8', '#d4a82c', W], logo: ['.1111..', '111121.', '.11113.', '..11...', '.......'] },
  bengals: { shell: '#fb4f14', stripe: 'none', stripes: [K, K], mask: K, colors: [K], logo: ['1..1..1', '.1..1..', '..1..1.', '.1..1..', '1..1..1'] },
  browns: { shell: '#ff3c00', stripe: 'triple', stripes: ['#311d00', W], mask: '#311d00', colors: [], logo: [] },
  steelers: { shell: K, stripe: 'single', stripes: ['#ffb612', K], mask: K, colors: ['#ffb612', W, '#c60c30', '#00539b'], logo: ['.22222.', '2212322', '2222222', '2224222', '.22222.'] },
  texans: { shell: '#03202f', stripe: 'none', stripes: ['#a71930', W], mask: '#03202f', colors: ['#a71930', W], logo: ['1.....1', '.11211.', '.12221.', '..111..', '...1...'] },
  colts: { shell: W, stripe: 'single', stripes: ['#002c5f', W], mask: '#002c5f', colors: ['#002c5f'], logo: ['1.....1', '1.....1', '11...11', '.11.11.', '..111..'] },
  jaguars: { shell: K, stripe: 'none', stripes: ['#006778', '#d7a22a'], mask: K, colors: ['#d7a22a', '#006778'], logo: ['.11.11.', '1111111', '1221221', '.11111.', '..111..'] },
  titans: { shell: '#0c2340', stripe: 'triple', stripes: ['#4b92db', '#c8102e'], mask: '#0c2340', colors: ['#0c2340', W, '#c8102e'], logo: ['.22222.', '2311112', '2221222', '2221222', '.22222.'] },
  broncos: { shell: '#002244', stripe: 'none', stripes: ['#fb4f14', W], mask: '#002244', colors: ['#fb4f14', W], logo: ['.11....', '11112..', '.11111.', '..11.1.', '..1....'] },
  chiefs: { shell: '#e31837', stripe: 'none', stripes: [W, W], mask: '#c9ced6', colors: [W, '#e31837'], logo: ['...1...', '..111..', '.12121.', '1112111', '...1...'] },
  raiders: { shell: '#a5acaf', stripe: 'single', stripes: [K, W], mask: K, colors: [K, '#a5acaf'], logo: ['1111111', '1222221', '1212121', '.12221.', '..111..'] },
  chargers: { shell: '#0080c6', stripe: 'none', stripes: ['#ffc20e', W], mask: '#0b2a50', colors: ['#ffc20e', W], logo: ['...112.', '..112..', '.11111.', '..211..', '.211...'] },
  cowboys: { shell: '#b0b7bc', stripe: 'triple', stripes: [W, '#003594'], mask: '#6f7b86', colors: ['#003594', W], logo: ['...1...', '..111..', '1111111', '.11.11.', '.1...1.'] },
  giants: { shell: '#0b2265', stripe: 'triple', stripes: [W, '#a71930'], mask: GREY, colors: [W], logo: ['.......', '11..1.1', '1.1.1.1', '1.1..1.', '....1..'] },
  eagles: { shell: '#004c54', stripe: 'none', stripes: [W, W], mask: K, colors: ['#a5acaf', W], logo: ['......2', '....122', '..1111.', '11111..', '1......'] },
  commanders: { shell: '#5a1414', stripe: 'none', stripes: ['#ffb612', W], mask: K, colors: ['#ffb612'], logo: ['1.....1', '1..1..1', '1..1..1', '.11.11.', '.1...1.'] },
  bears: { shell: '#0b162a', stripe: 'triple', stripes: [W, '#c83803'], mask: '#0b162a', colors: ['#c83803', W], logo: ['.1111..', '11.....', '11.....', '11.....', '.1111..'] },
  lions: { shell: '#0076b6', stripe: 'none', stripes: [W, '#b0b7bc'], mask: '#b0b7bc', colors: ['#b0b7bc', W], logo: ['..11...', '.1111..', '11111.1', '.1.111.', '1...1..'] },
  packers: { shell: '#203731', stripe: 'triple', stripes: [W, '#ffb612'], mask: '#ffb612', colors: ['#203731', W], logo: ['.22222.', '2111122', '2122112', '2111112', '.22222.'] },
  vikings: { shell: '#4f2683', stripe: 'none', stripes: [W, '#ffc62f'], mask: K, colors: [W, '#ffc62f'], logo: ['2......', '12.....', '.112...', '..1112.', '...111.'] },
  falcons: { shell: K, stripe: 'none', stripes: ['#a71930', W], mask: K, colors: ['#a71930', W], logo: ['...11..', '.1111.2', '11111..', '..11...', '.1.....'] },
  panthers: { shell: '#bfc0bf', stripe: 'none', stripes: ['#0085ca', K], mask: K, colors: [K, '#0085ca'], logo: ['.1..1..', '1111111', '1121211', '.11111.', '..111..'] },
  saints: { shell: '#d3bc8d', stripe: 'triple', stripes: [K, W], mask: K, colors: [K], logo: ['...1...', '.1.1.1.', '.11111.', '...1...', '..111..'] },
  buccaneers: { shell: '#5b5752', stripe: 'none', stripes: ['#d50a0a', W], mask: K, colors: ['#d50a0a', W, K], logo: ['3111111', '3122211', '3112111', '3111111', '3......'] },
  cardinals: { shell: W, stripe: 'none', stripes: [K, '#97233f'], mask: K, colors: ['#97233f', '#ffb612', K], logo: ['..11...', '.1111.3', '111122.', '.111...', '..1....'] },
  '49ers': { shell: '#b3995d', stripe: 'triple', stripes: ['#aa0000', W], mask: GREY, colors: ['#aa0000', W], logo: ['.22222.', '2111112', '2121212', '2111112', '.22222.'] },
  seahawks: { shell: '#002244', stripe: 'single', stripes: ['#a5acaf', '#69be28'], mask: '#a5acaf', colors: ['#a5acaf', '#69be28', W], logo: ['..111..', '.11111.', '1112132', '..11...', '.......'] },
  rams: { shell: '#003594', stripe: 'none', stripes: ['#ffd100', W], mask: '#ffd100', colors: ['#ffd100'], logo: ['.111...', '1...11.', '1....11', '.1..11.', '..111..'] },
};

/** Free agents and unknown clubs: a plain Retro Vault navy shell with a gold stripe. */
export const DEFAULT_HELMET: Helmet = { shell: '#1f2c4d', stripe: 'single', stripes: ['#f2c14a', '#1f2c4d'], mask: GREY, colors: [], logo: [] };

/** Home pants per club (Retro Bowl uses the team's pants colour; white where the club wears white). */
const PANTS: Record<string, string> = {
  '49ers': '#b3995d', buccaneers: '#5b5752', steelers: '#ffb612', packers: '#ffb612', saints: '#d3bc8d', commanders: '#ffb612',
  raiders: '#a5acaf', cowboys: '#b0b7bc', lions: '#b0b7bc', giants: '#a5acaf', panthers: '#bfc0bf', patriots: '#b0b7bc',
  seahawks: '#a5acaf', bengals: '#14161b', titans: '#4b92db', jaguars: '#d7a22a', rams: '#ffd100', chargers: '#ffc20e',
};
const WHITE_PANTS = '#eef0f3';
const FINE = HELMET_LOGOS;

export const helmetFor = (team: string | undefined): Helmet => {
  const t = findNFLTeam(team);
  const h = (t && HELMETS[t.id]) || DEFAULT_HELMET;
  if (!t) return { ...h, pants: WHITE_PANTS };
  const pattern = t.id === 'bengals' ? 'tiger' : t.id === 'rams' ? 'rams' : undefined;
  return { ...h, pants: PANTS[t.id] ?? WHITE_PANTS, fine: pattern ? undefined : (HAND_FINE[t.id] ?? FINE[t.id]), pattern };
};

// ---------- Hand-drawn fine logos (letter marks that don't survive downscaling) ----------

/** Adds a 1-cell outline / drop in colour '2' around the '1' cells of a mark (dx, dy = 0, 0 for an outline). */
const outlined = (rows: string[], drop = false): string[] => {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(w, '.').split(''));
  const is1 = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] === '1';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== '.') continue;
      const hit = drop ? is1(x - 1, y - 1) || is1(x - 1, y) || is1(x, y - 1) : is1(x - 1, y) || is1(x + 1, y) || is1(x, y - 1) || is1(x, y + 1);
      if (hit) g[y][x] = '2';
    }
  return g.map((r) => r.join(''));
};

/** 14 × 12 fine-grid marks with 2-cell strokes: '1' main, '2' outline / second colour, '3' third. */
export const HAND_FINE: Record<string, { rows: string[]; colors: string[] }> = {
  giants: {
    colors: [W, '#a71930'],
    rows: outlined(['.............', '11111..11..11', '111111.11..11', '11..11.11..11', '11..11.11..11', '11..11.111111', '11..11..11111', '11..11.....11', '...........11', '........1111.', '.............', '.............'], true),
  },
  jets: {
    colors: [W, '#0b3d2c'],
    rows: outlined(['.............', '.............', '11..11.11..11', '111.11.11..11', '111111..1111.', '111111...11..', '11.111...11..', '11..11...11..', '11..11...11..', '.............', '.............', '.............'], true),
  },
  packers: {
    colors: ['#203731', W],
    rows: ['...22222222...', '.222222222222.', '222.111111.222', '22211111111222', '22211222222222', '22211221111222', '22211222211222', '22211111111222', '222.111111.222', '22222222222222', '.222222222222.', '...22222222...'],
  },
  bears: {
    colors: ['#c83803', W],
    rows: outlined(['..............', '....111111....', '...1111111....', '..111.........', '..11..........', '..11..........', '..11..........', '..111.........', '...1111111....', '....111111....', '..............', '..............']),
  },
  chiefs: {
    colors: [W, '#e31837'],
    rows: ['......11......', '.....1111.....', '....111111....', '...11111111...', '..1111111111..', '.112112112221.', '.112121121111.', '.112211121111.', '.112121121111.', '..1121111222..', '...11111111...', '.....1111.....'],
  },
  titans: {
    colors: ['#0c2340', W, '#c8102e'],
    rows: ['....222222....', '..2222222233..', '.211111111113.', '22111111111122', '22222211222222', '22222211222222', '22222211222222', '22222211222222', '.222221122222.', '..2222112222..', '....222222....', '..............'],
  },
  raiders: {
    colors: [K, '#a5acaf'],
    rows: ['22222222222222', '21111111111112', '21211111111212', '21121111112112', '21112111121112', '21111211211112', '21111122111112', '.211121121112.', '..2121111212..', '...22111122...', '.....2222.....', '..............'],
  },
};

// ---------- Shell designs (unit grid over the side shell): Rams horn, Bengals stripes ----------

/** Rams: a thick gold horn from the front-top, back over the crown, down the back and spiralling round the ear. */
export const RAMS_HORN = [
  '......2222222......',
  '....22111111122....',
  '...2111111111112...',
  '..21112222222112...',
  '.2112.........2....',
  '.211...........',
  '.211...2222....',
  '.2112.211112...',
  '..21112112112..',
  '...2211211.12..',
  '.....2.21112...',
  '.......222.....',
];

/** Bengals: bold irregular tiger stripes sweeping back from the front and crown (start, end, width). */
export const TIGER_STRIPES: [[number, number], [number, number], number][] = [
  [[13, 1], [8, 4], 2],
  [[16, 4], [9, 7], 2],
  [[9, 1], [3, 5], 2],
  [[11, 8], [4, 11], 2],
  [[6, 7], [1, 9], 1],
  [[16, 7], [12, 9], 1],
  [[8, 12], [3, 14], 1],
];

// ---------- Helmet renderer: on the head (side / three-quarter / front), in hand, on the ground ----------

/**
 * Helmet from the side (20 wide): a rounded dome, higher at the crown and curving down the back of the skull, sitting
 * on the head. The face is in profile behind the facemask (brow, one eye, a nose bump, mouth, chin); two thin bars and
 * a vertical connector stick forward from the shell; the chin strap runs under the jaw; an ear hole on the shell.
 */
export const HEAD_SIDE = [
  '........HHHHHH......',
  '......HHHHHHHHHH....',
  '....HHHHHHHHHHHHHH..',
  '...HHHHHHHHHHHHHHHH.',
  '..HHHHHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHHHHHH.',
  '.HHHHHHHHHHHHHHHHHMM',
  'HHHHHHHHHHHHssssss.M',
  'HHHHHHHHHHHHsEEEss.M',
  'HHHHHHHHHHHHswess..M',
  'HHHHHHHHHHkHdssssssM',
  'HHHHHHHHHHkHdsssMMMM',
  'HHHHHHHHHHHHdssmmm.M',
  '.HHHHHHHHHHHdsssMMMM',
  '..HHHHHHHHH.ddsss..M',
  '...HHHHHHH..CCCCC...',
  '....HHHHH...........',
];
/** Helmet in three-quarter view (18 wide): the face turned toward us, the logo side of the shell still showing. */
export const HEAD_TQ = [
  '.....HHHHHHH......',
  '...HHHHHHHHHHH....',
  '..HHHHHHHHHHHHHH..',
  '.HHHHHHHHHHHHHHHH.',
  'HHHHHHHHHHHHHHHHHH',
  'HHHHHHHsssssssssHM',
  'HHHHHHHsEEsssEEsHM',
  'HHHHHHHdwesssewsHM',
  'HHHHHHHdssssssssHM',
  'HHHHHHMMMMMMMMMMMM',
  'HHHHHHHdssssnnssHM',
  'HHHHHHHdsssmmmmsHM',
  'HHHHHHMMMMMMMMMMMM',
  '.HHHHHHddsssssddM.',
  '..HHHHH.ddddddd...',
  '...HHH..CCCCCC....',
];
/** Helmet facing out (18 wide), bars across the face. */
export const HEAD_FRONT = [
  '......HHHHHH......',
  '...HHHHHHHHHHHH...',
  '..HHHHHHHHHHHHHH..',
  '.HHHHHHHHHHHHHHHH.',
  'HHHHHHHHHHHHHHHHHH',
  'HHHHssssssssssHHHH',
  'HHHHsEEssssEEsHHHH',
  'HHHHswwessewwsHHHH',
  'HHHHssssssssssHHHH',
  'HHHMMMMMMMMMMMMHHH',
  'HHHHssssnnssssHHHH',
  'HHHHsssmmmmsssHHHH',
  'HHHMMMMMMMMMMMMHHH',
  '.HHHdssssssssdHHH.',
  '..HHHddddddddHHH..',
  '...HH.CCCCCC.HH...',
];
/** Helmet in hand / on the ground (12 × 9), the team's real helmet: shell, stripe, logo, facemask. */
export const MINI_HELMET = ['...HHHHH....', '.HHHHHHHHH..', 'HHHHHHHHHHH.', 'HHHHHHHHkkHM', 'HHHHHHHHkkHM', 'HHHHHHHHkMMM', 'HHHHHHHHkkkM', '.HHHHHHHMMMM', '..HHHHH.....'];
export const LOGO_KEYS: Record<string, Key> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4' };

/** A helmet off the head (side view), at (x, y). */
export const miniHelmet = (x: number, y: number, hel: Helmet): Rect[] => {
  const R = stamp(MINI_HELMET, x, y);
  if (hel.stripe !== 'none') R.push(...stamp(['hhhhh'], x + 3, y));
  R.push(...stamp(['ll'], x + 2, y + 1));
  if (hel.pattern) tiger(R, MINI_HELMET.map((r) => r.slice(0, 8)), x - 4, y - 2, hel);
  shellLogo(R, x + 0.5, y + 1.5, hel);
  return R;
};

/** Team logo on the side of a shell: the detailed fine-grid logo when there is one, else the hand-drawn mark. */
export const shellLogo = (R: Rect[], x: number, y: number, hel: Helmet) => {
  if (hel.fine) {
    hel.fine.rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && R.push([x + i / F, y + j / F, 1 / F, 1 / F, `F${ch}`])));
  } else if (hel.logo.length) R.push(...stamp(hel.logo, x, y + 0.5, LOGO_KEYS));
};

/** Shell designs, clipped to the template's shell cells: Bengals tiger stripes, the Rams horn. */
export const tiger = (R: Rect[], tpl: string[], hx: number, hy: number, hel?: Helmet) => {
  const shell = (x: number, y: number) => tpl[y]?.[x] === 'H';
  const marks: Rect[] = [];
  if (!hel || hel.pattern === 'tiger')
    TIGER_STRIPES.forEach(([a, b, w]) => {
      marks.push(...line(a, b, 1, 'L1'));
      if (w > 1) marks.push(...line(a, b, 2, 'L1', 0.2, 0.75));
    });
  else if (hel.pattern === 'rams') marks.push(...stamp(RAMS_HORN, 0, 0, { 1: 'L1', 2: 'C' }));
  marks.forEach(([x, y, w, h, k]) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (shell(i, j)) R.push([hx + i, hy + j, 1, 1, k]);
  });
};

/** Side helmet head at (hx, hy): profile face behind the bars (face x 12–18). */
export const sideHead = (hx: number, hy: number, { look, pose, hel }: HeadOpts): Rect[] => {
  const R = stamp(HEAD_SIDE, hx, hy);
  const up = pose.look === 'up';
  if (up) R.push(...stamp(['sEEEss', 'swess.', 'ssssss'], hx + 12, hy + 7));
  const ex = pose.expr ?? 'line';
  const f = look.facial;
  const p = (x: number, y: number) => set(R, hx + x, hy + y, 'r');
  // Facial hair in profile: sideburn, jaw and chin, a moustache under the nose
  if (f === 'stubble') [[13, 13], [15, 14], [13, 14]].forEach(([x, y]) => p(x, y));
  if (f !== 'none' && f !== 'stubble') {
    for (let y = f === 'fullbeard' || f === 'chinstrap' ? 10 : 11; y <= 13; y++) p(12, y);
    if (f !== 'jawline' && f !== 'chinstrap') [14, 15].forEach((x) => p(x, 11));
    if (f === 'goatee') [[16, 13], [15, 14], [16, 14]].forEach(([x, y]) => p(x, y));
    else for (let x = 12; x <= 16; x++) p(x, 14);
    if (f === 'shortbeard' || f === 'beard' || f === 'fullbeard') [13, 14, 15].forEach((x) => p(x, 13));
    if (f === 'beard' || f === 'fullbeard') for (let x = 12; x <= 16; x++) p(x, 15);
  }
  // Mouth by expression (profile, x 15–17)
  if (ex === 'grimace') R.push(...stamp(['mTT'], hx + 15, hy + 12));
  if (ex === 'open') R.push(...stamp(['moo'], hx + 15, hy + 12));
  if (ex === 'smile') R.push(...stamp(['mTm'], hx + 15, hy + 12));
  if (look.eyes === 'intense') R.push(...stamp(['EEEE', 'wew.'], hx + 12, hy + (up ? 7 : 8)));
  const acc = look.accessories;
  if (acc.includes('eyeblack')) R.push(...stamp(['kk'], hx + 13, hy + (up ? 9 : 10)));
  // A visor is a tinted strip over the eye line only
  if (acc.includes('visor') || acc.includes('visor-gold')) R.push(...stamp(['VVVv'], hx + 15, hy + (up ? 8 : 9)));
  // Crown stripe along the top of the dome, gloss, ear hole, logo
  if (hel.stripe === 'single' || hel.stripe === 'triple') R.push(...stamp(['hhhhhh'], hx + 8, hy), ...stamp(['hhhhhhhhhh'], hx + 6, hy + 1));
  if (hel.stripe === 'triple') R.push(...stamp(['gggggggggggggg'], hx + 4, hy + 2));
  if (hel.stripe === 'double') R.push(...stamp(['hhhhhh'], hx + 8, hy), ...stamp(['hhhhhhhhhhhhhh'], hx + 4, hy + 2));
  if (hel.pattern) tiger(R, HEAD_SIDE.map((r, j) => (j < 6 ? r : r.slice(0, 12))), hx, hy, hel);
  R.push(...stamp(['lll', '.ll', '..l'], hx + 4, hy + 3));
  shellLogo(R, hx + 2, hy + 6, hel);
  R.push(...stamp(['k', 'k'], hx + 10, hy + 10));
  return R;
};

/** Three-quarter helmet head at (hx, hy): face x 7–15 behind two bars, the logo side of the shell at the left. */
export const tqHead = (hx: number, hy: number, { look, pose, hel }: HeadOpts): Rect[] => {
  const R = stamp(HEAD_TQ, hx, hy);
  const ex = pose.expr ?? 'line';
  faceHair(R, hx + 7, 9, { must: null, mouth: hy + 11, jaw: hy + 13, chin: hy + 14, under: hy + 15, cheek: hy + 8 }, look.facial);
  mouth(R, hx + 11, hy + 11, ex === 'exalted' ? undefined : ex);
  eyes(R, hx + 8, hx + 13, hy + 6, look, ex);
  if (look.accessories.includes('eyeblack')) R.push(...stamp(['kk...kk'], hx + 8, hy + 8));
  if (look.accessories.some((a) => a.startsWith('visor'))) R.push(...stamp(['VVVVVVVV'], hx + 8, hy + 7));
  R.push(...stamp(['MMMMMMMMMMMM'], hx + 6, hy + 9), ...stamp(['MMMMMMMMMMMM'], hx + 6, hy + 12));
  if (hel.stripe !== 'none') R.push(...stamp(['hh', 'hh', 'hh', 'hh'], hx + 7, hy));
  if (hel.pattern) tiger(R, HEAD_TQ.map((r, j) => (j < 5 ? r : r.slice(0, 7))), hx - 4, hy, hel);
  R.push(...stamp(['ll', 'l.'], hx + 3, hy + 2));
  shellLogo(R, hx - 0.5, hy + 4, hel);
  // The face stays in front of the logo
  R.push(...stamp(['s', 'd', 'd', 'd'], hx + 7, hy + 5));
  return R;
};

/** Face-out helmet head at (hx, hy). Face window x 4–13. */
export const frontHead = (hx: number, hy: number, { look, pose, hel }: HeadOpts): Rect[] => {
  const R = stamp(HEAD_FRONT, hx, hy);
  const ex = pose.expr ?? 'line';
  faceHair(R, hx + 4, 10, { must: null, mouth: hy + 11, jaw: hy + 13, chin: hy + 14, under: hy + 15, cheek: hy + 8 }, look.facial);
  mouth(R, hx + 7, hy + 11, ex === 'open' || ex === 'grimace' ? ex : ex === 'smile' ? 'smile' : ex === 'stern' ? 'stern' : undefined);
  eyes(R, hx + 5, hx + 10, hy + 6, look, ex);
  if (look.accessories.includes('eyeblack')) R.push(...stamp(['kk....kk'], hx + 5, hy + 8));
  if (look.accessories.some((a) => a.startsWith('visor'))) R.push(...stamp(['VVVVVVVVVV', 'VVVVVVVVvV'], hx + 4, hy + 6));
  // Bars stay in front of the face
  R.push(...stamp(['MMMMMMMMMMMM'], hx + 3, hy + 9), ...stamp(['MMMMMMMMMMMM'], hx + 3, hy + 12));
  if (hel.stripe !== 'none') R.push(...stamp(hel.stripe === 'double' ? ['h..h', 'h..h', 'h..h', 'h..h'] : ['hh', 'hh', 'hh', 'hh'], hel.stripe === 'double' ? hx + 7 : hx + 8, hy));
  if (hel.stripe === 'triple') R.push(...stamp(['g..g', 'g..g', 'g..g', 'g..g'], hx + 7, hy));
  if (hel.pattern) tiger(R, HEAD_FRONT.slice(0, 5), hx, hy, hel);
  R.push(...stamp(['ll', 'l.'], hx + 4, hy + 2));
  return R;
};

/** Colours of the helmet keys (shell, gloss, stripes, mask, strap, ear hole, logos) */
export const helmetColours = (hel: Helmet): Record<Key, string> => ({
  H: hel.shell,
  l: `color-mix(in srgb, ${hel.shell} 55%, #fff)`,
  h: hel.stripes[0],
  g: hel.stripes[1],
  M: hel.mask,
  C: '#e8e9ec',
  k: '#0d0e12',
  L1: hel.colors[0] ?? hel.mask,
  L2: hel.colors[1] ?? hel.mask,
  L3: hel.colors[2] ?? hel.mask,
  L4: hel.colors[3] ?? hel.mask,
  F1: hel.fine?.colors[0] ?? hel.mask,
  F2: hel.fine?.colors[1] ?? hel.mask,
  F3: hel.fine?.colors[2] ?? hel.mask,
  F4: hel.fine?.colors[3] ?? hel.mask,
});
