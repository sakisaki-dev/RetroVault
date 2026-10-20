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
  titans: { shell: '#0c2340', stripe: 'triple', stripes: ['#c8102e', '#4b92db'], mask: W, colors: ['#0c2340', W, '#c8102e'], logo: ['.22222.', '2311112', '2221222', '2221222', '.22222.'] },
  broncos: { shell: '#002244', stripe: 'none', stripes: ['#fb4f14', W], mask: '#002244', colors: ['#fb4f14', W], logo: ['.11....', '11112..', '.11111.', '..11.1.', '..1....'] },
  chiefs: { shell: '#e31837', stripe: 'none', stripes: [W, W], mask: W, colors: [W, '#e31837'], logo: ['...1...', '..111..', '.12121.', '1112111', '...1...'] },
  raiders: { shell: '#a5acaf', stripe: 'single', stripes: [K, W], mask: K, colors: [K, '#a5acaf'], logo: ['1111111', '1222221', '1212121', '.12221.', '..111..'] },
  chargers: { shell: '#0080c6', stripe: 'none', stripes: ['#ffc20e', W], mask: '#0b2a50', colors: ['#ffc20e', W], logo: ['...112.', '..112..', '.11111.', '..211..', '.211...'] },
  cowboys: { shell: '#b0b7bc', stripe: 'triple', stripes: [W, '#003594'], mask: '#6f7b86', colors: ['#003594', W], logo: ['...1...', '..111..', '1111111', '.11.11.', '.1...1.'] },
  giants: { shell: '#0b2265', stripe: 'triple', stripes: ['#a71930', W], mask: GREY, colors: [W], logo: ['.......', '11..1.1', '1.1.1.1', '1.1..1.', '....1..'] },
  eagles: { shell: '#004c54', stripe: 'none', stripes: [W, W], mask: K, colors: ['#a5acaf', W], logo: ['......2', '....122', '..1111.', '11111..', '1......'] },
  commanders: { shell: '#5a1414', stripe: 'none', stripes: ['#ffb612', W], mask: K, colors: ['#ffb612'], logo: ['1.....1', '1..1..1', '1..1..1', '.11.11.', '.1...1.'] },
  bears: { shell: '#0b162a', stripe: 'triple', stripes: ['#c83803', W], mask: '#0b162a', colors: ['#c83803', W], logo: ['.1111..', '11.....', '11.....', '11.....', '.1111..'] },
  lions: { shell: '#0076b6', stripe: 'none', stripes: [W, '#b0b7bc'], mask: '#b0b7bc', colors: ['#b0b7bc', W], logo: ['..11...', '.1111..', '11111.1', '.1.111.', '1...1..'] },
  packers: { shell: '#203731', stripe: 'triple', stripes: [W, '#3f7a5c'], mask: '#ffb612', colors: ['#203731', W], logo: ['.22222.', '2111122', '2122112', '2111112', '.22222.'] },
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

export const helmetFor = (team: string | undefined): Helmet => {
  const t = findNFLTeam(team);
  const h = (t && HELMETS[t.id]) || DEFAULT_HELMET;
  if (!t) return { ...h, pants: WHITE_PANTS };
  const pattern = t.id === 'bengals' ? 'tiger' : t.id === 'rams' ? 'rams' : undefined;
  return { ...h, pants: PANTS[t.id] ?? WHITE_PANTS, fine: pattern ? undefined : HAND_FINE[t.id], pattern };
};

// ---------- Logos ----------

/**
 * Hand-drawn fine-grid logos (2 cells per sprite pixel, up to 16 × 14 cells, nominally 14 × 12, facing forward), one
 * per club with a decal. Authored in scripts/build_helmet_logos.py, which writes helmetLogos.ts.
 */
export const HAND_FINE: Record<string, { rows: string[]; colors: string[] }> = HELMET_LOGOS;

// ---------- Shell designs (unit grid, clipped to the view's shell cells): Bengals stripes, Rams horn ----------

type DesignView = 'side' | 'tq' | 'front' | 'mini';
/**
 * Per view, in the head template's own coordinates ('1' = the design colour). Bengals: six bold, jagged tiger stripes
 * sweeping back from the crown and the front. Rams: a thick gold horn from the forehead, back over the crown and down
 * the back of the shell, curling into a spiral round the ear hole.
 */
export const SHELL_DESIGNS: Record<'tiger' | 'rams', Record<DesignView, string[]>> = {
  tiger: {
    side: [
      '....................',
      '....................',
      '....................',
      '....................',
      '............111.....',
      '........111.1111....',
      '.......111..111....1',
      '......111..111....11',
      '.....11...1111...111',
      '....11....11....111.',
      '....1....11....11...',
      '........1.....1.....',
      '..11......1111......',
      '..111....1111.......',
      '..11....111.........',
      '..1....11...11......',
      '...........111......',
      '.........111........',
      '........11..........',
    ],
    tq: [
      '......11.11.......',
      '....111.111..11...',
      '..111..111..111...',
      '.11...11...111....',
      '11...11...11......',
      '1...11............',
      '...11.............',
      '11................',
      '111...............',
      '11..111...........',
      '.....11...........',
      '...111............',
      '..11..............',
    ],
    front: [
      '......1....1......',
      '...11..1..1..11...',
      '..11..11..11..11..',
      '.11..11....11..11.',
      '11..11......11..11',
      '1..11........11..1',
    ],
    mini: ['.....11.....', '..11..11....', '.11..11..11.', '11..11..11..', '...11.......', '11....111...', '1...111.....', '..111.......'],
  },
  rams: {
    side: [
      '....................',
      '......11111111......',
      '....11111111111111..',
      '...111.........1111.',
      '..111...........111.',
      '.111................',
      '.11.................',
      '11......1111........',
      '11.....11..11.......',
      '11....11.1..1.......',
      '11....1..11.1.......',
      '11....11...11.......',
      '.11....11111........',
      '..1111..............',
    ],
    tq: [
      '..................',
      '....11111111......',
      '..111.....1111....',
      '.11........111....',
      '11................',
      '11..111...........',
      '1..11.11..........',
      '1..1.1.1..........',
      '11..1..1..........',
      '.11...11..........',
      '..11111...........',
    ],
    front: ['..................', '...111......111...', '..11..11..11..11..', '.11....1111....11.', '11......11......11'],
    mini: ['...1111.....', '.111..1111..', '11.......11.', '1..111......', '1.1..1......', '1.1.11......', '11.11.......', '.111........'],
  },
};

// ---------- Helmet renderer: on the head (side / three-quarter / front), in hand, on the ground ----------

/**
 * Helmet from the side (18 × 15 inside a 20 × 17 box, so the anchors stay put): a compact round dome, wider than tall,
 * crown higher than the forehead, sitting on the head; every build wears the same one. The face is in profile behind the facemask (brow, one eye, a nose bump, mouth, chin); two thin bars and
 * a vertical connector stick forward from the shell; the chin strap runs under the jaw; an ear hole on the shell.
 */
export const HEAD_SIDE = [
  '....................',
  '....................',
  '......HHHHHHH.......',
  '....HHHHHHHHHHH.....',
  '...HHHHHHHHHHHHHH...',
  '..HHHHHHHHHHHHHHHH..',
  '..HHHHHHHHHHHHHHHHM.',
  '..HHHHHHHHHHssssssMM',
  '..HHHHHHHHHHsEEEss.M',
  '..HHHHHHHHHHswess..M',
  '..HHHHHHHHkHdssssssM',
  '..HHHHHHHHkHdsssMMMM',
  '..HHHHHHHHHHdssmmm.M',
  '...HHHHHHHHHdsssMMMM',
  '...HHHHHHHH.ddsss..M',
  '....HHHHHH...CCCC.MM',
  '.....HHHH...........',
];
/** Helmet in three-quarter view (18 wide): the face turned toward us, the logo side of the shell still showing. */
export const HEAD_TQ = [
  '..................',
  '....HHHHHHHH......',
  '..HHHHHHHHHHHH....',
  '.HHHHHHHHHHHHHHH..',
  'HHHHHHHHHHHHHHHHH.',
  'HHHHHHHsssssssssH.',
  'HHHHHHHsEEsssEEsM.',
  'HHHHHHHdwesssewsM.',
  'HHHHHHHdssssssssM.',
  'HHHHHHMMMMMMMMMMM.',
  'HHHHHHHdssssnnssM.',
  '.HHHHHHdsssmmmmsM.',
  '..HHHHMMMMMMMMMMM.',
  '...HHH.ddsssssddM.',
  '........ddddddd...',
  '........CCCCCC....',
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
export const MINI_HELMET = ['...HHHHH....', '.HHHHHHHHH..', 'HHHHHHHHHHH.', 'HHHHHHHHHHH.', 'HHHHHHHHkk.M', 'HHHHHHHHkMMM', 'HHHHHHHHk..M', '.HHHHHHHkMMM', '..HHHHH.....'];
export const LOGO_KEYS: Record<string, Key> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4' };

/** A helmet off the head (side view), at (x, y). */
export const miniHelmet = (x: number, y: number, hel: Helmet): Rect[] => {
  const R = stamp(MINI_HELMET, x, y);
  if (hel.stripe !== 'none') R.push(...stamp(['hhhhh'], x + 3, y));
  R.push(...stamp(['ll'], x + 2, y + 1));
  if (hel.pattern) tiger(R, MINI_HELMET, x, y, hel, 'mini');
  shellLogo(R, x + 0.5, y + 1.5, hel, [MINI_HELMET, x, y]);
  return R;
};

/** Team logo on the side of a shell: the detailed fine-grid logo when there is one, else the hand-drawn mark. */
export const shellLogo = (R: Rect[], x: number, y: number, hel: Helmet, clip?: [string[], number, number]) => {
  // Optionally clipped to a head template's shell cells (template, its x, its y)
  const onShell = (px: number, py: number) => !clip || clip[0][Math.floor(py - clip[2])]?.[Math.floor(px - clip[1])] === 'H';
  if (hel.fine) {
    // Glyphs are centred on the nominal 14 × 12 box at (x, y), whatever their own size
    const { rows } = hel.fine;
    const ox = x + Math.floor((LOGO_BOX[0] - Math.max(...rows.map((r) => r.length))) / 2) / F;
    const oy = y + Math.floor((LOGO_BOX[1] - rows.length) / 2) / F;
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && onShell(ox + i / F, oy + j / F) && R.push([ox + i / F, oy + j / F, 1 / F, 1 / F, `F${ch}`])));
  } else if (hel.logo.length && !hel.pattern) R.push(...stamp(hel.logo, x, y + 0.5, LOGO_KEYS));
};
/** Nominal logo box in fine cells (glyphs may be up to 16 × 14 and are centred on it) */
const LOGO_BOX = [14, 12] as const;

/** Shell designs (Bengals stripes, Rams horn) for a view, clipped to the template's shell cells. */
export const tiger = (R: Rect[], tpl: string[], hx: number, hy: number, hel?: Helmet, view: DesignView = 'side') => {
  const design = SHELL_DESIGNS[hel?.pattern ?? 'tiger'][view];
  design.forEach((row, j) => [...row].forEach((ch, i) => ch === '1' && tpl[j]?.[i] === 'H' && R.push([hx + i, hy + j, 1, 1, 'L1'])));
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
  // The stripe runs along the crown one row in from the top edge (so dark stripes don't merge with the outline)
  if (hel.stripe === 'single' || hel.stripe === 'triple') R.push(...stamp(['hhhhhhhhh'], hx + 5, hy + 3), ...stamp(['hhhhhhhhhhhh'], hx + 4, hy + 4));
  if (hel.stripe === 'triple') R.push(...stamp(['gggggggggggggg'], hx + 3, hy + 5));
  if (hel.stripe === 'double') R.push(...stamp(['hhhhhhhhh'], hx + 5, hy + 3), ...stamp(['hhhhhhhhhhhhhh'], hx + 3, hy + 5));
  if (hel.pattern) tiger(R, HEAD_SIDE, hx, hy, hel, 'side');
  R.push(...stamp(['ll', '.l'], hx + 4, hy + 4));
  shellLogo(R, hx + 3, hy + 5, hel, [HEAD_SIDE, hx, hy]);
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
  if (hel.stripe !== 'none') R.push(...stamp(['hh', 'hh', 'hh', 'hh'], hx + 7, hy + 1));
  if (hel.pattern) tiger(R, HEAD_TQ.map((r, j) => (j < 5 ? r : r.slice(0, 7))), hx, hy, hel, 'tq');
  R.push(...stamp(['ll', 'l.'], hx + 3, hy + 2));
  shellLogo(R, hx, hy + 4, hel, [HEAD_TQ.map((r, j) => (j < 5 ? r : r.slice(0, 7))), hx, hy]);
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
  if (hel.pattern) tiger(R, HEAD_FRONT.slice(0, 6), hx, hy, hel, 'front');
  R.push(...stamp(['ll', 'l.'], hx + 4, hy + 2));
  return R;
};

/** Colours of the helmet keys (shell, gloss, stripes, mask, strap, ear hole, logos) */
/**
 * Facemask colour as drawn: a black mask would vanish into the outline, a dark beard and the shadowed face, so
 * near-black masks are drawn in a dark graphite that still reads as black but keeps the cage bars visible.
 */
const cageColour = (mask: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(mask);
  if (!m) return mask;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.12 ? '#4a4f58' : mask;
};

export const helmetColours = (hel: Helmet): Record<Key, string> => ({
  H: hel.shell,
  l: `color-mix(in srgb, ${hel.shell} 55%, #fff)`,
  h: hel.stripes[0],
  g: hel.stripes[1],
  M: cageColour(hel.mask),
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
