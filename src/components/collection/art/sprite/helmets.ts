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
  /** Club id (set by helmetFor), so the club's detailed logo survives a uniform's shell override */
  team?: string;
  /**
   * A uniform's logo choice (its helmet override): a period glyph key from scripts/build_helmet_logos.py VARIANTS
   * ('broncos-d', 'dolphins-1972', …), or 'none' for a plain helmet. Unset = the club's own logo.
   */
  logoVariant?: string;
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
  packers: { shell: '#ffb612', stripe: 'triple', stripes: [W, '#203731'], mask: '#203731', colors: ['#203731', W], logo: ['.22222.', '2111122', '2122112', '2111112', '.22222.'] },
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
  return { ...h, pants: PANTS[t.id] ?? WHITE_PANTS, fine: pattern ? undefined : HAND_FINE[t.id], pattern, team: t.id };
};

// ---------- Logos ----------

/**
 * Hand-drawn fine-grid logos (2 cells per sprite pixel, up to 16 × 14 cells, nominally 14 × 12, facing forward), one
 * per club with a decal. Authored in scripts/build_helmet_logos.py, which writes helmetLogos.ts.
 */
export const HAND_FINE: Record<string, { rows: string[]; colors: string[]; shell?: string }> = HELMET_LOGOS;

/**
 * The detailed logo a helmet shows: the uniform's period variant ('none' = plain), else its own fine glyph, else its
 * club's glyph (a uniform that overrides the shell keeps the club logo; helmetColours recolours it for the shell).
 */
export const fineOf = (hel: Helmet): { rows: string[]; colors: string[]; shell?: string } | undefined => {
  if (hel.logoVariant === 'none') return undefined;
  if (hel.logoVariant && HAND_FINE[hel.logoVariant]) return HAND_FINE[hel.logoVariant];
  if (hel.pattern) return undefined;
  return hel.fine ?? (hel.team ? HAND_FINE[hel.team] : undefined);
};

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
 * Helmet from the side (shell 16 × 16 inside a 20 × 17 box, so the face and chin anchors stay put): a full, ball-like
 * dome, crown runs 8 → 12 → 14 → 15 → 16, the back curving in toward the neck; every build wears the same one. The face is in profile behind the facemask (brow, one eye, a nose bump, mouth, chin); two thin bars and
 * a vertical connector stick forward from the shell; the chin strap runs under the jaw; an ear hole on the shell.
 */
export const HEAD_SIDE = [
  '.......HHHHHH.......',
  '......HHHHHHHH......',
  '.....HHHHHHHHHH.....',
  '....HHHHHHHHHHHH....',
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
  '....HHHHHHH.ddsss..M',
  '.....HHHHH...CCCC.MM',
  '......HHH...........',
];
/** Helmet in three-quarter view (18 wide): the face turned toward us, the logo side of the shell still showing. */
export const HEAD_TQ = [
  '....HHHHHHHH......',
  '...HHHHHHHHHH.....',
  '..HHHHHHHHHHHH....',
  '.HHHHHHHHHHHHHH...',
  'HHHHHHHHHHHHHHHH..',
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
  '.....HHHHHHHH.....',
  '....HHHHHHHHHH....',
  '...HHHHHHHHHHHH...',
  '..HHHHHHHHHHHHHH..',
  '.HHHHHHHHHHHHHHHH.',
  '.HHHssssssssssHHH.',
  '.HHHsEEssssEEsHHH.',
  '.HHHswwessewwsHHH.',
  '.HHHssssssssssHHH.',
  '.HHMMMMMMMMMMMMHH.',
  '.HHHssssnnssssHHH.',
  '.HHHsssmmmmsssHHH.',
  '.HHMMMMMMMMMMMMHH.',
  '..HHdssssssssdHH..',
  '...HHddddddddHH...',
  '....H.CCCCCC.H....',
];
/** Helmet in hand / on the ground (12 × 9): a full round 10 × 9 dome (6 → 8 → 10 across the crown) with the face opening and facemask in front. */
export const MINI_HELMET = [
  '..HHHHHH....',
  '.HHHHHHHH...',
  'HHHHHHHHHH..',
  'HHHHHHHHHHM.',
  'HHHHHHHHkkMM',
  'HHHHHHHHkMMM',
  'HHHHHHHHk..M',
  '.HHHHHHHkMMM',
  '..HHHHH.....',
];
/**
 * Round-out caps: one row above the top of the three-quarter, front and mini templates (drawn at y − 1, so every
 * anchor inside the templates is unchanged), 1 px in on each side from the row under it. Every crown row steps in by at
 * most 1 px per side from the row below (scripts/check_sprites.ts asserts it), so the crown is one even stepped curve.
 * The side template carries its cap in its own row 0.
 */
export const HEAD_TQ_CAP = '.....HHHHHH.......';
export const HEAD_FRONT_CAP = '......HHHHHH......';
export const MINI_CAP = '...HHHH.....';
export const LOGO_KEYS: Record<string, Key> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4' };

/** A helmet off the head (side view), at (x, y). */
export const miniHelmet = (x: number, y: number, hel: Helmet): Rect[] => {
  const R = [...stamp([MINI_CAP], x, y - 1), ...stamp(MINI_HELMET, x, y)];
  R.push(...stamp(['.l', 'l.'], x + 3, y - 1));
  // The crown stripe runs over the round-out cap and the top row, and down a step at each end
  if (hel.stripe !== 'none') R.push(...stamp(['hhhh'], x + 3, y - 1), ...onShell(MINI_HELMET, ['..hhhhhh....', '.h......h...'], 0, 0, x, y));
  if (hel.pattern) tiger(R, MINI_HELMET, x, y, hel, 'mini');
  shellLogo(R, x + 0.5, y + 1.5, hel, [MINI_HELMET, x, y]);
  return R;
};

/** Team logo on the side of a shell: the detailed fine-grid logo when there is one, else the hand-drawn mark. */
export const shellLogo = (R: Rect[], x: number, y: number, hel: Helmet, clip?: [string[], number, number]) => {
  // Optionally clipped to a head template's shell cells (template, its x, its y)
  const onShell = (px: number, py: number) => !clip || clip[0][Math.floor(py - clip[2])]?.[Math.floor(px - clip[1])] === 'H';
  const fine = fineOf(hel);
  if (fine) {
    // Glyphs are centred on the nominal 14 × 12 box at (x, y), whatever their own size
    const { rows } = fine;
    const ox = x + Math.floor((LOGO_BOX[0] - Math.max(...rows.map((r) => r.length))) / 2) / F;
    const oy = y + Math.floor((LOGO_BOX[1] - rows.length) / 2) / F;
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && onShell(ox + i / F, oy + j / F) && R.push([ox + i / F, oy + j / F, 1 / F, 1 / F, `F${ch}`])));
  } else if (hel.logo.length && !hel.pattern && hel.logoVariant !== 'none') R.push(...stamp(hel.logo, x, y + 0.5, LOGO_KEYS));
};
/** Nominal logo box in fine cells (glyphs may be up to 16 × 14 and are centred on it) */
const LOGO_BOX = [14, 12] as const;

/** A template (rows at (x, y) in a head template's coordinates) kept only on the template's shell cells, placed at (hx, hy). */
const onShell = (tpl: string[], rows: string[], x: number, y: number, hx: number, hy: number): Rect[] =>
  stamp(rows, x, y).filter(([px, py]) => tpl[py]?.[px] === 'H').map(([px, py, w, h, k]) => [hx + px, hy + py, w, h, k]);

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
  // The stripe runs along the crown one row in from the top edge, clipped to the dome
  const crown = (rows: string[], x: number, y: number) => R.push(...onShell(HEAD_SIDE, rows, x, y, hx, hy));
  // Gloss in the rounded crown, then the stripes over it: they run over the top rows (the round-out cap and the
  // row under it) and the triple's edge stripes bend down the front and back of the dome
  R.push(...stamp(['.l', 'l.'], hx + 6, hy));
  if (hel.stripe === 'single' || hel.stripe === 'triple') crown(['hhhhhhhh', 'hhhhhhhh'], 6, 0);
  if (hel.stripe === 'triple') crown(['gg........gg'], 4, 2);
  if (hel.stripe === 'double') crown(['hhhhhhhh', '........', 'hhhhhhhhhh'], 6, 0);
  if (hel.pattern) tiger(R, HEAD_SIDE, hx, hy, hel, 'side');
  shellLogo(R, hx + 3.5, hy + 5, hel, [HEAD_SIDE, hx, hy]);
  R.push(...stamp(['k', 'k'], hx + 10, hy + 10));
  return R;
};

/** Three-quarter helmet head at (hx, hy): face x 7–15 behind two bars, the logo side of the shell at the left. */
export const tqHead = (hx: number, hy: number, { look, pose, hel }: HeadOpts): Rect[] => {
  const R = [...stamp([HEAD_TQ_CAP], hx, hy - 1), ...stamp(HEAD_TQ, hx, hy)];
  const ex = pose.expr ?? 'line';
  faceHair(R, hx + 7, 9, { must: null, mouth: hy + 11, jaw: hy + 13, chin: hy + 14, under: hy + 15, cheek: hy + 8 }, look.facial);
  mouth(R, hx + 11, hy + 11, ex === 'exalted' ? undefined : ex);
  eyes(R, hx + 8, hx + 13, hy + 6, look, ex);
  if (look.accessories.includes('eyeblack')) R.push(...stamp(['kk...kk'], hx + 8, hy + 8));
  if (look.accessories.some((a) => a.startsWith('visor'))) R.push(...stamp(['VVVVVVVV'], hx + 8, hy + 7));
  R.push(...stamp(['MMMMMMMMMMMM'], hx + 6, hy + 9), ...stamp(['MMMMMMMMMMMM'], hx + 6, hy + 12));
  R.push(...stamp(['.l', 'l.'], hx + 5, hy - 1));
  if (hel.stripe !== 'none') R.push(...stamp(['hh', 'hh', 'hh', 'hh', 'hh', 'hh'], hx + 7, hy - 1));
  if (hel.pattern) tiger(R, HEAD_TQ.map((r, j) => (j < 5 ? r : r.slice(0, 7))), hx, hy, hel, 'tq');
  shellLogo(R, hx, hy + 4, hel, [HEAD_TQ.map((r, j) => (j < 5 ? r : r.slice(0, 7))), hx, hy]);
  // The face stays in front of the logo
  R.push(...stamp(['s', 'd', 'd', 'd'], hx + 7, hy + 5));
  return R;
};

/** Face-out helmet head at (hx, hy). Face window x 4–13. */
export const frontHead = (hx: number, hy: number, { look, pose, hel }: HeadOpts): Rect[] => {
  const R = [...stamp([HEAD_FRONT_CAP], hx, hy - 1), ...stamp(HEAD_FRONT, hx, hy)];
  const ex = pose.expr ?? 'line';
  faceHair(R, hx + 4, 10, { must: null, mouth: hy + 11, jaw: hy + 13, chin: hy + 14, under: hy + 15, cheek: hy + 8 }, look.facial);
  mouth(R, hx + 7, hy + 11, ex === 'open' || ex === 'grimace' ? ex : ex === 'smile' ? 'smile' : ex === 'stern' ? 'stern' : undefined);
  eyes(R, hx + 5, hx + 10, hy + 6, look, ex);
  if (look.accessories.includes('eyeblack')) R.push(...stamp(['kk....kk'], hx + 5, hy + 8));
  if (look.accessories.some((a) => a.startsWith('visor'))) R.push(...stamp(['VVVVVVVVVV', 'VVVVVVVVvV'], hx + 4, hy + 6));
  // Bars stay in front of the face
  R.push(...stamp(['MMMMMMMMMMMM'], hx + 3, hy + 9), ...stamp(['MMMMMMMMMMMM'], hx + 3, hy + 12));
  R.push(...stamp(['.l', 'l.'], hx + 6, hy - 1));
  if (hel.stripe !== 'none') R.push(...stamp(hel.stripe === 'double' ? ['h..h', 'h..h', 'h..h', 'h..h', 'h..h'] : ['hh', 'hh', 'hh', 'hh', 'hh'], hel.stripe === 'double' ? hx + 7 : hx + 8, hy - 1));
  if (hel.stripe === 'triple') R.push(...stamp(['g..g', 'g..g', 'g..g', 'g..g', 'g..g'], hx + 7, hy - 1));
  if (hel.pattern) tiger(R, HEAD_FRONT.slice(0, 6), hx, hy, hel, 'front');
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
  ...fineColours(hel),
});

const rgbOf = (c: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Colour distance, 0 (same) … 1 (black vs white); 1 when either isn't a plain hex colour. */
const dist = (a: string, b: string) => {
  const p = rgbOf(a);
  const q = rgbOf(b);
  return p && q ? Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / 441.7 : 1;
};
const lumOf = (c: string) => {
  const p = rgbOf(c);
  return p ? (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255 : 0.5;
};

/**
 * Logo colours (F1–F4) for the shell the helmet actually has. A glyph is drawn for one shell (its `shell`): a glyph
 * colour equal to that shell is the shell "showing through" (the Jets' green letters), so it follows the new shell; a
 * colour that would vanish against the new shell takes the glyph's own shell colour, or white / near-black, instead.
 */
const fineColours = (hel: Helmet): Record<Key, string> => {
  const fine = fineOf(hel);
  const out: Record<Key, string> = {};
  [0, 1, 2, 3].forEach((i) => {
    const c = fine?.colors[i] ?? hel.mask;
    const own = fine?.shell;
    let v = c;
    if (fine && own && own !== hel.shell) {
      if (dist(c, own) < 0.04) v = hel.shell;
      else if (dist(c, hel.shell) < 0.2) v = dist(own, hel.shell) >= 0.25 ? own : lumOf(hel.shell) < 0.5 ? W : K;
    }
    out[`F${i + 1}`] = v;
  });
  return out;
};
