import { findNFLTeam } from '@/utils/nflTeams';
import { ALT_VALUE_BONUS, ERA_VALUE_BONUS } from '@/utils/cardMarket';
import { seedOf } from '../shared';
import { HELMETS, type Helmet } from './helmets';

/**
 * Uniforms, simplified from each club's real look (no logos): jersey, sleeve stripes, shoulder yoke / cap, number
 * colour with one or two outlines, collar, pants with their side stripe, socks with stripes, cleats. One table drives
 * every art style: the sprite (render.ts), and the Jersey, Jersey back, Locker and Topps art (JerseyGarment,
 * JerseyBackArt, LockerArt, VintageArt, teamStyle.ts).
 *
 * Standardisation rule: every card wears the team's HOME uniform, except a small, stable share (ALT_CHANCE, decided
 * per player × variant × finish) that rolls one of the club's ALTERNATES (at most two, all real, well-known sets).
 *
 * Widths of stripes are in half sprite pixels (the sprite's fine grid), so a 3-band Bills stripe is 1.5 px wide.
 */

/** One sleeve / pants / sock band: colour (null = the jersey / garment colour, i.e. a gap) and width in half pixels */
export type Band = [color: string | null, width?: number];

export interface Uniform {
  /** "home", or the alternate's id */
  id: string;
  /** Shown on the card back for alternates, e.g. "Bucs Creamsicle" or "1985 Bears" (era kits add " (era)") */
  label: string;
  /** A famous era kit (rarer tier of the roll, higher market bonus) */
  era?: boolean;
  jersey: string;
  /** Main trim colour (sleeve stripes, pad piping, collar by default) */
  trim: string;
  /**
   * Sleeve treatment: 'stripes2' / 'stripes3' sleeve stripes (drawn from `bands` when set), 'yoke' a shoulder yoke,
   * 'bolt' (Chargers), 'tiger' (Bengals: yoke-coloured sleeves with stripes), 'bands' (bumblebee: hoops round the
   * body, plus sleeve stripes), 'none'.
   */
  sleeve: 'stripes2' | 'stripes3' | 'yoke' | 'bolt' | 'tiger' | 'none' | 'bands';
  /** Shoulder yoke colour ('yoke'; also the tiger cap for 'tiger') */
  yoke?: string;
  number: string;
  numberOutline: string;
  numberStyle: 'outlined' | 'double' | 'solid';
  pants: string;
  pantsStripe: string | null;
  socks: string;
  sockStripe: string;
  cleats: string;
  /** Alternates can change the helmet (Creamsicle white, Kelly green…) */
  helmet?: Partial<Helmet>;
  // ---- Optional detail (added later; every reader falls back when absent) ----
  /** Sleeve stripes from the shoulder side down to the hem */
  bands?: Band[];
  /** Thin cap along the top of the shoulder (Seahawks wolf grey, Lions white) */
  shoulder?: string;
  /** Collar trim (default: trim) */
  collar?: string;
  /** Outer number outline for 'double' (default: trim) */
  numberOutline2?: string;
  /** Pants side stripe, left to right in half pixels (default: [pantsStripe] as one full pixel) */
  pantsStripes?: string[];
  /** Sock stripes, top down, in half-pixel rows (default: [sockStripe]) */
  sockStripes?: string[];
}

const W = '#f4f5f7';
const K = '#14161b';
const WC = '#eceef1';

type Home = Partial<Omit<Uniform, 'id' | 'label'>> & { jersey: string; trim: string };

// Team colours used more than once
const BILLS = '#00338d', BILLS_RED = '#c60c30';
const AQUA = '#008e97', MIA_ORANGE = '#fc4c02', MIA_NAVY = '#005778';
const NE_NAVY = '#002244', NE_RED = '#c60c30';
const NYJ = '#115740';
const BAL = '#241773', BAL_GOLD = '#9e7c0c';
const CIN = '#fb4f14';
const CLE_BROWN = '#311d00', CLE_ORANGE = '#ff3c00';
const GOLD_PIT = '#ffb612';
const HOU = '#03202f', HOU_RED = '#a71930';
const IND = '#002c5f';
const JAX = '#006778', JAX_GOLD = '#d7a22a';
const TEN = '#0c2340', TEN_BLUE = '#4b92db', TEN_RED = '#c8102e';
const DEN = '#fb4f14', DEN_NAVY = '#002244';
const KC = '#e31837', KC_GOLD = '#ffb81c';
const SILVER = '#a5acaf';
const LAC = '#0080c6', LAC_GOLD = '#ffc20e', LAC_NAVY = '#0b2a50';
const DAL = '#003594', DAL_SILVER = '#869397', DAL_PANTS = '#a9b6ad';
const NYG = '#0b2265', NYG_RED = '#a71930', NYG_GREY = '#a5acaf';
const PHI = '#004c54';
const WAS = '#5a1414', WAS_GOLD = '#ffb612';
const CHI = '#0b162a', CHI_ORANGE = '#c83803';
const DET = '#0076b6', DET_SILVER = '#b0b7bc';
const GB = '#203731', GB_GOLD = '#ffb612';
const MIN = '#4f2683', MIN_GOLD = '#ffc62f';
const ATL_RED = '#a71930';
const CAR = '#0085ca', CAR_SILVER = '#bfc0bf';
const NO_GOLD = '#d3bc8d';
const TB = '#d50a0a', PEWTER = '#5b5752', TB_ORANGE = '#ff7900';
const ARI = '#97233f';
const SF = '#aa0000', SF_GOLD = '#b3995d';
const SEA = '#002244', SEA_GREEN = '#69be28', WOLF = '#a5acaf';
const LAR = '#003594', LAR_GOLD = '#ffd100';

/**
 * Home uniforms (current NFL home sets, simplified; Retro Bowl's in-game look where the two differ, e.g. the
 * Panthers in black). Anything left out: number white with a trim outline, white pants with a jersey-colour stripe,
 * socks in the jersey colour, white cleats.
 */
const HOME: Record<string, Home> = {
  // AFC East
  bills: { jersey: BILLS, trim: BILLS_RED, sleeve: 'stripes2', bands: [[W, 1], [BILLS_RED, 2], [W, 1]], collar: BILLS_RED, number: W, numberOutline: BILLS_RED, pants: W, pantsStripes: [BILLS, BILLS_RED, BILLS], socks: BILLS, sockStripes: [BILLS_RED, W] },
  dolphins: { jersey: AQUA, trim: MIA_ORANGE, sleeve: 'stripes2', bands: [[W, 1], [MIA_ORANGE, 1], [W, 1]], collar: W, number: W, numberOutline: MIA_NAVY, pants: W, pantsStripes: [AQUA, MIA_ORANGE], socks: AQUA, sockStripes: [W] },
  patriots: { jersey: NE_NAVY, trim: NE_RED, sleeve: 'stripes2', bands: [[NE_RED, 1], [W, 1], [NE_RED, 1]], collar: NE_RED, number: W, numberOutline: NE_RED, pants: W, pantsStripes: [NE_NAVY, NE_RED, NE_NAVY], socks: NE_NAVY, sockStripes: [NE_RED, W] },
  jets: { jersey: NYJ, trim: W, sleeve: 'stripes2', bands: [[W, 1], [null, 1], [W, 1]], collar: W, number: W, numberOutline: NYJ, numberStyle: 'solid', pants: W, pantsStripes: [NYJ, NYJ], socks: NYJ, sockStripes: [W, NYJ, W] },
  // AFC North
  ravens: { jersey: BAL, trim: K, sleeve: 'none', shoulder: K, collar: K, number: W, numberOutline: K, numberStyle: 'double', numberOutline2: BAL_GOLD, pants: W, pantsStripes: [K, BAL, K], socks: K, sockStripes: [BAL], cleats: K },
  bengals: { jersey: K, trim: CIN, sleeve: 'tiger', yoke: CIN, collar: CIN, number: W, numberOutline: CIN, pants: W, pantsStripes: [CIN, K, CIN], socks: K, sockStripes: [CIN, CIN], cleats: K },
  browns: { jersey: CLE_BROWN, trim: CLE_ORANGE, sleeve: 'stripes2', bands: [[CLE_ORANGE, 1], [W, 1], [CLE_ORANGE, 1]], collar: CLE_ORANGE, number: CLE_ORANGE, numberOutline: W, pants: W, pantsStripes: [CLE_ORANGE, CLE_BROWN, CLE_ORANGE], socks: CLE_BROWN, sockStripes: [CLE_ORANGE, W, CLE_ORANGE] },
  steelers: { jersey: K, trim: GOLD_PIT, sleeve: 'stripes2', bands: [[GOLD_PIT, 1], [null, 1], [GOLD_PIT, 1]], collar: GOLD_PIT, number: GOLD_PIT, numberOutline: K, numberStyle: 'solid', pants: GOLD_PIT, pantsStripes: [K, W, K], socks: K, sockStripes: [GOLD_PIT, GOLD_PIT], cleats: K },
  // AFC South
  texans: { jersey: HOU, trim: HOU_RED, sleeve: 'stripes2', bands: [[HOU_RED, 1], [W, 1]], shoulder: HOU_RED, collar: HOU_RED, number: W, numberOutline: HOU_RED, pants: W, pantsStripes: [HOU, HOU_RED], socks: HOU, sockStripes: [HOU_RED] },
  colts: { jersey: IND, trim: W, sleeve: 'stripes2', bands: [[W, 1], [null, 1], [W, 1]], collar: W, number: W, numberOutline: IND, numberStyle: 'solid', pants: W, pantsStripes: [IND, IND], socks: IND, sockStripes: [W, IND, W] },
  jaguars: { jersey: JAX, trim: JAX_GOLD, sleeve: 'yoke', yoke: K, collar: K, number: W, numberOutline: K, numberStyle: 'double', numberOutline2: JAX_GOLD, pants: W, pantsStripes: [K, JAX], socks: K, sockStripes: [JAX] },
  titans: { jersey: TEN, trim: TEN_BLUE, sleeve: 'yoke', yoke: TEN_BLUE, collar: TEN_BLUE, number: W, numberOutline: TEN_BLUE, numberStyle: 'double', numberOutline2: TEN_RED, pants: W, pantsStripes: [TEN_BLUE, TEN_RED], socks: TEN, sockStripes: [TEN_BLUE] },
  // AFC West
  broncos: { jersey: DEN, trim: DEN_NAVY, sleeve: 'yoke', yoke: DEN_NAVY, collar: DEN_NAVY, number: DEN_NAVY, numberOutline: W, pants: W, pantsStripes: [DEN_NAVY, DEN, DEN_NAVY], socks: DEN_NAVY, sockStripes: [DEN] },
  chiefs: { jersey: KC, trim: W, sleeve: 'stripes2', bands: [[W, 1], [KC_GOLD, 1], [W, 1]], collar: W, number: W, numberOutline: KC_GOLD, pants: W, pantsStripes: [KC, KC_GOLD, KC], socks: KC, sockStripes: [W, KC_GOLD, W] },
  raiders: { jersey: K, trim: SILVER, sleeve: 'none', collar: SILVER, number: W, numberOutline: SILVER, pants: SILVER, pantsStripes: [K, W, K], socks: K, sockStripes: [SILVER], cleats: K },
  chargers: { jersey: LAC, trim: LAC_GOLD, sleeve: 'bolt', collar: LAC_GOLD, number: W, numberOutline: LAC_NAVY, pants: LAC_GOLD, pantsStripes: [LAC, LAC], socks: LAC, sockStripes: [LAC_GOLD] },
  // NFC East
  cowboys: { jersey: W, trim: DAL, sleeve: 'stripes2', bands: [[DAL, 1], [null, 1], [DAL, 1]], collar: DAL, number: DAL, numberOutline: DAL_SILVER, pants: DAL_PANTS, pantsStripes: [DAL, W, DAL], socks: DAL, sockStripes: [W] },
  giants: { jersey: NYG, trim: NYG_RED, sleeve: 'none', collar: NYG_RED, number: W, numberOutline: NYG_RED, pants: NYG_GREY, pantsStripes: [NYG, NYG_RED, NYG], socks: NYG_RED, sockStripes: [NYG], cleats: K },
  eagles: { jersey: PHI, trim: SILVER, sleeve: 'stripes2', bands: [[K, 1], [SILVER, 1], [W, 1]], collar: K, number: W, numberOutline: K, numberStyle: 'double', numberOutline2: SILVER, pants: W, pantsStripes: [PHI, K], socks: PHI, sockStripes: [K, W], cleats: K },
  commanders: { jersey: WAS, trim: WAS_GOLD, sleeve: 'stripes2', bands: [[WAS_GOLD, 1], [W, 1], [WAS_GOLD, 1]], collar: WAS_GOLD, number: W, numberOutline: WAS_GOLD, pants: WAS_GOLD, pantsStripes: [WAS, W, WAS], socks: WAS, sockStripes: [WAS_GOLD] },
  // NFC North
  bears: { jersey: CHI, trim: CHI_ORANGE, sleeve: 'stripes2', bands: [[W, 1], [CHI_ORANGE, 1], [W, 1], [CHI_ORANGE, 1], [W, 1]], collar: CHI_ORANGE, number: W, numberOutline: CHI_ORANGE, pants: W, pantsStripes: [CHI, CHI_ORANGE, CHI], socks: CHI, sockStripes: [CHI_ORANGE, W, CHI_ORANGE], cleats: K },
  lions: { jersey: DET, trim: W, sleeve: 'none', shoulder: W, collar: W, number: W, numberOutline: DET_SILVER, pants: DET_SILVER, pantsStripes: [DET, DET], socks: DET, sockStripes: [W] },
  packers: { jersey: GB, trim: GB_GOLD, sleeve: 'stripes2', bands: [[GB_GOLD, 1], [W, 1], [GB_GOLD, 1]], collar: GB_GOLD, number: W, numberOutline: GB, numberStyle: 'solid', pants: GB_GOLD, pantsStripes: [GB, W, GB], socks: GB, sockStripes: [GB_GOLD, W] },
  vikings: { jersey: MIN, trim: MIN_GOLD, sleeve: 'stripes2', bands: [[MIN_GOLD, 2], [W, 1]], shoulder: MIN_GOLD, collar: MIN_GOLD, number: W, numberOutline: MIN_GOLD, pants: W, pantsStripes: [MIN, MIN_GOLD], socks: MIN, sockStripes: [MIN_GOLD] },
  // NFC South
  falcons: { jersey: K, trim: ATL_RED, sleeve: 'none', shoulder: ATL_RED, collar: ATL_RED, number: W, numberOutline: ATL_RED, pants: W, pantsStripes: [K, ATL_RED], socks: K, sockStripes: [ATL_RED] },
  panthers: { jersey: K, trim: CAR, sleeve: 'none', shoulder: CAR, collar: CAR, number: W, numberOutline: CAR, numberStyle: 'double', numberOutline2: CAR_SILVER, pants: CAR_SILVER, pantsStripes: [CAR, K], socks: K, sockStripes: [CAR] },
  saints: { jersey: K, trim: NO_GOLD, sleeve: 'none', shoulder: NO_GOLD, collar: NO_GOLD, number: NO_GOLD, numberOutline: W, pants: NO_GOLD, pantsStripes: [K, K], socks: K, sockStripes: [NO_GOLD], cleats: K },
  buccaneers: { jersey: TB, trim: PEWTER, sleeve: 'stripes2', bands: [[PEWTER, 1], [K, 1]], collar: PEWTER, number: W, numberOutline: K, numberStyle: 'double', numberOutline2: TB_ORANGE, pants: PEWTER, pantsStripes: [TB, K], socks: TB, sockStripes: [PEWTER], cleats: K },
  // NFC West
  cardinals: { jersey: ARI, trim: W, sleeve: 'none', collar: K, number: W, numberOutline: K, pants: W, pantsStripes: [ARI, K], socks: ARI, sockStripes: [K] },
  '49ers': { jersey: SF, trim: W, sleeve: 'stripes2', bands: [[W, 1], [K, 1], [W, 1]], collar: W, number: W, numberOutline: K, numberStyle: 'double', numberOutline2: SF_GOLD, pants: SF_GOLD, pantsStripes: [SF, W, SF], socks: SF, sockStripes: [W] },
  seahawks: { jersey: SEA, trim: SEA_GREEN, sleeve: 'stripes2', bands: [[WOLF, 1], [SEA_GREEN, 1]], shoulder: WOLF, collar: SEA_GREEN, number: W, numberOutline: WOLF, numberStyle: 'double', numberOutline2: SEA_GREEN, pants: WOLF, pantsStripes: [SEA, SEA_GREEN], socks: SEA, sockStripes: [SEA_GREEN, WOLF], cleats: K },
  rams: { jersey: LAR, trim: LAR_GOLD, sleeve: 'stripes2', bands: [[LAR_GOLD, 2], [null, 1], [LAR_GOLD, 1]], collar: LAR_GOLD, number: W, numberOutline: LAR_GOLD, pants: LAR_GOLD, pantsStripes: [LAR, LAR], socks: LAR, sockStripes: [LAR_GOLD] },
};

type Alt = Partial<Uniform> & Pick<Uniform, 'id' | 'label' | 'jersey' | 'trim'>;
/** A few real, well-known alternates (at most two per club): Color Rush sets and throwbacks. */
const ALTS: Record<string, Alt[]> = {
  buccaneers: [
    { id: 'creamsicle', label: 'Bucs Creamsicle', jersey: '#f58025', trim: TB, sleeve: 'stripes2', bands: [[TB, 1], [W, 1], [TB, 1]], collar: TB, number: W, numberOutline: TB, pants: W, pantsStripes: [TB, '#f58025', TB], socks: W, sockStripes: [TB, '#f58025'], cleats: WC, helmet: { logoVariant: 'bucs-bruce', shell: W, stripe: 'single', stripes: [TB, '#f58025'], mask: TB } },
  ],
  titans: [
    { id: 'oilers', label: 'Oilers Columbia Blue', jersey: '#7ab2dd', trim: TEN_RED, sleeve: 'stripes2', bands: [[W, 1], [TEN_RED, 1], [W, 1]], collar: TEN_RED, number: W, numberOutline: TEN_RED, pants: W, pantsStripes: [TEN_RED, '#7ab2dd', TEN_RED], socks: '#7ab2dd', sockStripes: [W, TEN_RED], cleats: WC, helmet: { logoVariant: 'titans-oilers', shell: '#7ab2dd', stripe: 'triple', stripes: [TEN_RED, W], mask: W } },
  ],
  jets: [
    { id: 'stealth', label: 'Jets Stealth Black', jersey: '#1b1d20', trim: NYJ, sleeve: 'stripes2', bands: [[NYJ, 1], [null, 1], [NYJ, 1]], collar: NYJ, number: W, numberOutline: NYJ, pants: '#1b1d20', pantsStripes: [NYJ, NYJ], socks: '#1b1d20', sockStripes: [NYJ], cleats: K, helmet: { shell: '#1b1d20', stripe: 'none', mask: K } },
    { id: 'nytitans', label: 'New York Titans Throwback', jersey: '#1d2a5c', trim: '#c9a227', sleeve: 'stripes2', bands: [['#c9a227', 1], [null, 1], ['#c9a227', 1]], collar: '#c9a227', number: '#c9a227', numberOutline: W, pants: '#c9a227', pantsStripes: ['#1d2a5c', '#1d2a5c'], socks: '#1d2a5c', sockStripes: ['#c9a227', '#c9a227'], cleats: K, helmet: { logoVariant: 'none', shell: '#1d2a5c', stripe: 'single', stripes: ['#c9a227', '#1d2a5c'], mask: '#9aa3ad' } },
  ],
  patriots: [
    { id: 'pat', label: 'Pat Patriot Red', jersey: NE_RED, trim: W, sleeve: 'stripes2', bands: [[W, 1], [NE_NAVY, 1], [W, 1]], collar: W, number: W, numberOutline: NE_NAVY, pants: W, pantsStripes: [NE_RED, NE_NAVY, NE_RED], socks: NE_RED, sockStripes: [W, NE_NAVY, W], cleats: WC, helmet: { logoVariant: 'patriots-pat', shell: W, stripe: 'triple', stripes: [NE_RED, NE_NAVY], mask: W } },
  ],
  seahawks: [
    { id: 'action', label: 'Seahawks Action Green', jersey: SEA_GREEN, trim: SEA, sleeve: 'stripes2', bands: [[SEA, 1], [WOLF, 1]], shoulder: SEA, collar: SEA, number: SEA, numberOutline: W, pants: SEA_GREEN, pantsStripes: [SEA, SEA], socks: SEA_GREEN, sockStripes: [SEA], cleats: WC },
    { id: 'throwback', label: 'Seahawks 1990 Throwback', jersey: '#2b4b8c', trim: SEA_GREEN, sleeve: 'stripes2', bands: [[W, 1], [SEA_GREEN, 1], [W, 1]], collar: W, number: W, numberOutline: SEA_GREEN, pants: SILVER, pantsStripes: ['#2b4b8c', SEA_GREEN, '#2b4b8c'], socks: '#2b4b8c', sockStripes: [W, SEA_GREEN, W], cleats: K, helmet: { shell: SILVER, stripe: 'triple', stripes: ['#2b4b8c', W], mask: '#2b4b8c' } },
  ],
  rams: [
    { id: 'throwback', label: 'Rams Royal & Gold Throwback', jersey: LAR, trim: LAR_GOLD, sleeve: 'stripes2', bands: [[LAR_GOLD, 1], [W, 1], [LAR_GOLD, 1]], collar: LAR_GOLD, number: LAR_GOLD, numberOutline: W, pants: LAR_GOLD, pantsStripes: [LAR, W, LAR], socks: LAR, sockStripes: [LAR_GOLD, W], cleats: K, helmet: { shell: LAR, stripe: 'none', stripes: [LAR_GOLD, W], mask: LAR_GOLD } },
  ],
  eagles: [
    { id: 'kelly', label: 'Eagles Kelly Green', jersey: '#4c9a2a', trim: W, sleeve: 'stripes2', bands: [[W, 1], [null, 1], [W, 1]], collar: W, number: W, numberOutline: SILVER, pants: W, pantsStripes: ['#4c9a2a', '#4c9a2a'], socks: '#4c9a2a', sockStripes: [W, W], cleats: WC, helmet: { shell: '#4c9a2a', mask: SILVER } },
    { id: 'black', label: 'Eagles Black Alternate', jersey: '#101214', trim: SILVER, sleeve: 'stripes2', bands: [[PHI, 1], [SILVER, 1], [W, 1]], collar: PHI, number: W, numberOutline: PHI, pants: '#101214', pantsStripes: [PHI, SILVER], socks: '#101214', sockStripes: [PHI], cleats: K, helmet: { shell: '#101214', mask: K } },
  ],
  steelers: [
    { id: 'bumblebee', label: 'Steelers Bumblebee', jersey: K, trim: GOLD_PIT, sleeve: 'bands', bands: [[GOLD_PIT, 2], [null, 1], [GOLD_PIT, 2]], collar: GOLD_PIT, number: K, numberOutline: GOLD_PIT, pants: GOLD_PIT, pantsStripes: [K, K], socks: GOLD_PIT, sockStripes: [K, GOLD_PIT, K], cleats: K },
    { id: 'colorrush', label: 'Steelers All-Black Color Rush', jersey: K, trim: GOLD_PIT, sleeve: 'stripes2', bands: [[GOLD_PIT, 1], [null, 1], [GOLD_PIT, 1]], collar: GOLD_PIT, number: GOLD_PIT, numberOutline: K, pants: K, pantsStripes: [GOLD_PIT, GOLD_PIT], socks: K, sockStripes: [GOLD_PIT, GOLD_PIT], cleats: K },
  ],
  bills: [
    { id: 'colorrush', label: 'Bills Color Rush Red', jersey: BILLS_RED, trim: BILLS, sleeve: 'stripes2', bands: [[W, 1], [BILLS, 2], [W, 1]], collar: BILLS, number: W, numberOutline: BILLS, pants: BILLS_RED, pantsStripes: [W, BILLS, W], socks: BILLS_RED, sockStripes: [W, BILLS], cleats: WC },
  ],
  giants: [
    { id: 'century', label: 'Giants Century Red', jersey: NYG_RED, trim: NYG, sleeve: 'stripes2', bands: [[W, 1], [NYG, 1], [W, 1]], collar: NYG, number: W, numberOutline: NYG, pants: W, pantsStripes: [NYG, NYG_RED, NYG], socks: NYG_RED, sockStripes: [W], cleats: WC },
  ],
  packers: [
    { id: 'acme', label: 'Packers Acme Throwback', jersey: '#1d2847', trim: GB_GOLD, sleeve: 'none', collar: '#1d2847', number: GB_GOLD, numberOutline: GB_GOLD, numberStyle: 'solid', pants: '#c4a65a', pantsStripe: null, pantsStripes: [], socks: '#1d2847', sockStripes: [GB_GOLD, '#1d2847', GB_GOLD], cleats: K, helmet: { logoVariant: 'none', shell: '#5b3a22', stripe: 'none', mask: '#5b3a22' } },
  ],
  falcons: [
    { id: 'throwback', label: 'Falcons Red Throwback', jersey: ATL_RED, trim: K, sleeve: 'stripes2', bands: [[K, 1], [W, 1], [K, 1]], collar: K, number: W, numberOutline: K, pants: W, pantsStripes: [K, ATL_RED, K], socks: ATL_RED, sockStripes: [W, K, W], cleats: K, helmet: { shell: K, stripe: 'triple', stripes: [ATL_RED, W], mask: '#9aa3ad' } },
  ],
  bengals: [
    { id: 'whitebengal', label: 'Bengals White Bengal', jersey: W, trim: CIN, sleeve: 'tiger', yoke: W, collar: K, number: K, numberOutline: CIN, pants: W, pantsStripes: [CIN, K, CIN], socks: W, sockStripes: [CIN, K], cleats: K, helmet: { shell: W, stripe: 'none', mask: K } },
  ],
  texans: [
    { id: 'battlered', label: 'Texans Battle Red', jersey: HOU_RED, trim: HOU, sleeve: 'stripes2', bands: [[HOU, 1], [W, 1]], shoulder: HOU, collar: HOU, number: W, numberOutline: HOU, pants: HOU, pantsStripes: [HOU_RED, HOU_RED], socks: HOU_RED, sockStripes: [HOU], cleats: WC, helmet: { shell: HOU_RED, stripe: 'none', mask: HOU } },
    { id: 'htownblue', label: 'Texans H-Town Blue', jersey: '#6f9fd8', trim: HOU, sleeve: 'stripes2', bands: [[HOU, 1], [HOU_RED, 1]], shoulder: HOU, collar: HOU, number: HOU, numberOutline: HOU_RED, pants: '#6f9fd8', pantsStripes: [HOU, HOU_RED], socks: '#6f9fd8', sockStripes: [HOU], cleats: WC, helmet: { shell: '#6f9fd8', mask: HOU } },
  ],
  chargers: [
    { id: 'colorrush', label: 'Chargers Navy Color Rush', jersey: LAC_NAVY, trim: LAC_GOLD, sleeve: 'bolt', collar: LAC_GOLD, number: LAC_GOLD, numberOutline: W, pants: LAC_NAVY, pantsStripes: [LAC_GOLD, LAC], socks: LAC_NAVY, sockStripes: [LAC_GOLD], cleats: WC, helmet: { shell: LAC_NAVY, mask: LAC_GOLD } },
  ],
  cowboys: [
    { id: 'navy', label: 'Cowboys Navy Alternate', jersey: '#041e42', trim: DAL_SILVER, sleeve: 'stripes2', bands: [[W, 1], [DAL_SILVER, 1], [W, 1]], collar: DAL_SILVER, number: W, numberOutline: DAL_SILVER, numberStyle: 'double', numberOutline2: '#041e42', pants: DAL_PANTS, pantsStripes: ['#041e42', W, '#041e42'], socks: '#041e42', sockStripes: [W], cleats: WC },
    { id: 'colorrush', label: 'Cowboys White Color Rush', jersey: W, trim: '#041e42', sleeve: 'stripes2', bands: [['#041e42', 2], [null, 1], ['#041e42', 2]], collar: '#041e42', number: '#041e42', numberOutline: DAL_SILVER, pants: W, pantsStripes: ['#041e42', '#041e42'], socks: W, sockStripes: ['#041e42', '#041e42'], cleats: WC },
  ],
  vikings: [
    { id: 'throwback', label: 'Vikings 1961 Throwback', jersey: MIN, trim: W, sleeve: 'stripes2', bands: [[W, 1], [MIN_GOLD, 1], [W, 1]], collar: W, number: W, numberOutline: MIN_GOLD, pants: W, pantsStripes: [MIN, MIN_GOLD, MIN], socks: MIN, sockStripes: [W, MIN_GOLD, W], cleats: K },
    { id: 'winterwarrior', label: 'Vikings Winter Warrior', jersey: W, trim: MIN, sleeve: 'stripes2', bands: [[MIN, 1], [MIN_GOLD, 1], [MIN, 1]], collar: MIN, number: MIN, numberOutline: MIN_GOLD, pants: W, pantsStripes: [MIN, MIN], socks: W, sockStripes: [MIN, MIN_GOLD], cleats: WC, helmet: { shell: W, mask: MIN } },
  ],
  '49ers': [
    { id: 'throwback', label: '49ers 1994 Throwback', jersey: SF, trim: W, sleeve: 'stripes2', bands: [[W, 1], [null, 1], [W, 1], [null, 1], [W, 1]], collar: W, number: W, numberOutline: K, pants: SF_GOLD, pantsStripes: [SF, W, SF], socks: SF, sockStripes: [W, W], cleats: K, helmet: { mask: '#9aa3ad' } },
    { id: 'colorrush', label: '49ers All-White Color Rush', jersey: W, trim: SF, sleeve: 'stripes2', bands: [[SF, 1], [SF_GOLD, 1], [SF, 1]], collar: SF, number: SF, numberOutline: SF_GOLD, pants: W, pantsStripes: [SF, SF_GOLD, SF], socks: W, sockStripes: [SF, SF], cleats: WC },
  ],
  broncos: [
    { id: 'orangecrush', label: 'Broncos Orange Crush 1977', jersey: DEN, trim: '#1f3c88', sleeve: 'stripes2', bands: [['#1f3c88', 1], [W, 1], ['#1f3c88', 1]], collar: '#1f3c88', number: W, numberOutline: '#1f3c88', pants: W, pantsStripes: ['#1f3c88', DEN, '#1f3c88'], socks: DEN, sockStripes: [W, '#1f3c88', W], cleats: K, helmet: { logoVariant: 'broncos-d', shell: '#1f3c88', stripe: 'triple', stripes: [W, DEN], mask: W } },
  ],
  colts: [
    { id: 'indiananights', label: 'Colts Indiana Nights', jersey: '#111318', trim: '#1c5aa8', sleeve: 'stripes2', bands: [['#1c5aa8', 1], [null, 1], ['#1c5aa8', 1]], collar: '#1c5aa8', number: '#3f86e0', numberOutline: W, pants: '#111318', pantsStripes: ['#1c5aa8', '#1c5aa8'], socks: '#111318', sockStripes: ['#1c5aa8'], cleats: K, helmet: { shell: '#111318', stripe: 'single', stripes: ['#1c5aa8', '#111318'], mask: '#1c5aa8' } },
  ],
  lions: [
    { id: 'black', label: 'Lions Black Alternate', jersey: '#121418', trim: DET, sleeve: 'none', shoulder: DET, collar: DET, number: '#2a94dc', numberOutline: W, pants: '#121418', pantsStripes: [DET, DET], socks: '#121418', sockStripes: [DET], cleats: K, helmet: { shell: '#121418', mask: DET } },
  ],
  panthers: [
    { id: 'blue', label: 'Panthers Blue Alternate', jersey: CAR, trim: K, sleeve: 'none', shoulder: K, collar: K, number: W, numberOutline: K, pants: W, pantsStripes: [K, CAR], socks: CAR, sockStripes: [K], cleats: K, helmet: { shell: K, mask: K } },
  ],
  cardinals: [
    { id: 'black', label: 'Cardinals Black Alternate', jersey: '#121418', trim: ARI, sleeve: 'none', shoulder: ARI, collar: ARI, number: W, numberOutline: ARI, pants: '#121418', pantsStripes: [ARI, ARI], socks: '#121418', sockStripes: [ARI], cleats: K, helmet: { shell: '#121418', mask: ARI } },
  ],
  browns: [
    { id: 'whitehelmet', label: 'Browns White Helmet Throwback', jersey: W, trim: CLE_BROWN, sleeve: 'stripes2', bands: [[CLE_BROWN, 1], [CLE_ORANGE, 1], [CLE_BROWN, 1]], collar: CLE_BROWN, number: CLE_BROWN, numberOutline: CLE_ORANGE, pants: W, pantsStripes: [CLE_BROWN, CLE_ORANGE, CLE_BROWN], socks: CLE_BROWN, sockStripes: [CLE_ORANGE, W, CLE_ORANGE], cleats: K, helmet: { logoVariant: 'none', shell: W, stripe: 'triple', stripes: [CLE_ORANGE, CLE_BROWN], mask: CLE_BROWN } },
  ],
  commanders: [
    { id: 'black', label: 'Commanders Black Alternate', jersey: '#141416', trim: WAS_GOLD, sleeve: 'none', shoulder: WAS, collar: WAS_GOLD, number: WAS_GOLD, numberOutline: WAS, pants: '#141416', pantsStripes: [WAS_GOLD, WAS], socks: '#141416', sockStripes: [WAS_GOLD], cleats: K, helmet: { shell: '#141416', stripe: 'none', mask: K } },
  ],
  ravens: [
    { id: 'purplerising', label: 'Ravens Purple Rising', jersey: BAL, trim: K, sleeve: 'none', shoulder: K, collar: K, number: W, numberOutline: K, pants: BAL, pantsStripes: [K, BAL_GOLD, K], socks: BAL, sockStripes: [K], cleats: K, helmet: { shell: K, mask: K } },
  ],
  raiders: [
    { id: 'colorrush', label: 'Raiders All-White Color Rush', jersey: W, trim: K, sleeve: 'none', shoulder: K, collar: K, number: K, numberOutline: SILVER, pants: W, pantsStripes: [K, SILVER, K], socks: W, sockStripes: [K, K], cleats: WC },
  ],
  dolphins: [
    { id: 'colorrush', label: 'Dolphins Orange Color Rush', jersey: MIA_ORANGE, trim: AQUA, sleeve: 'stripes2', bands: [[AQUA, 1], [W, 1], [AQUA, 1]], collar: AQUA, number: W, numberOutline: AQUA, pants: MIA_ORANGE, pantsStripes: [AQUA, W, AQUA], socks: MIA_ORANGE, sockStripes: [AQUA], cleats: WC },
  ],
  bears: [
    { id: 'orange', label: 'Bears Orange Alternate', jersey: CHI_ORANGE, trim: CHI, sleeve: 'stripes2', bands: [[CHI, 1], [W, 1], [CHI, 1]], collar: CHI, number: CHI, numberOutline: W, pants: CHI, pantsStripes: [CHI_ORANGE, W, CHI_ORANGE], socks: CHI, sockStripes: [CHI_ORANGE, W], cleats: K },
  ],
  saints: [
    { id: 'colorrush', label: 'Saints White Color Rush', jersey: W, trim: NO_GOLD, sleeve: 'none', shoulder: NO_GOLD, collar: NO_GOLD, number: '#9c8350', numberOutline: K, pants: W, pantsStripes: [NO_GOLD, K, NO_GOLD], socks: W, sockStripes: [NO_GOLD, K], cleats: K },
  ],
  chiefs: [
    { id: 'colorrush', label: 'Chiefs All-Red Color Rush', jersey: KC, trim: KC_GOLD, sleeve: 'stripes2', bands: [[W, 1], [KC_GOLD, 1], [W, 1]], collar: W, number: W, numberOutline: KC_GOLD, pants: KC, pantsStripes: [W, KC_GOLD, W], socks: KC, sockStripes: [KC_GOLD], cleats: WC },
  ],
};

/**
 * Famous era kits: the uniforms tied to legendary teams, labelled by era (no player names). One per club at most,
 * on top of its (up to two) modern alternates. Kits that the clubs have since revived as throwbacks (Creamsicle,
 * Kelly Green, Vikings 1961, 49ers 1955-style, Packers Acme) stay in ALTS instead.
 */
const ERAS: Record<string, Alt> = {
  dolphins: { id: 'era1972', label: '1972 Dolphins', jersey: '#00a3ad', trim: MIA_ORANGE, sleeve: 'stripes2', bands: [[W, 1], [MIA_ORANGE, 2], [W, 1]], collar: W, number: W, numberOutline: MIA_ORANGE, pants: W, pantsStripes: ['#00a3ad', MIA_ORANGE, '#00a3ad'], socks: '#00a3ad', sockStripes: [W, MIA_ORANGE, W], cleats: K, helmet: { logoVariant: 'dolphins-1972', stripe: 'triple', stripes: [MIA_ORANGE, '#00a3ad'], mask: '#00a3ad' } },
  steelers: { id: 'era1970s', label: '1970s Steelers', jersey: K, trim: GOLD_PIT, sleeve: 'stripes2', bands: [[GOLD_PIT, 1], [W, 1], [GOLD_PIT, 1]], collar: GOLD_PIT, number: GOLD_PIT, numberOutline: K, pants: GOLD_PIT, pantsStripes: [K, W, K], socks: K, sockStripes: [GOLD_PIT, W, GOLD_PIT], cleats: K, helmet: { mask: '#9aa3ad' } },
  bears: { id: 'era1985', label: '1985 Bears', jersey: CHI, trim: CHI_ORANGE, sleeve: 'stripes2', bands: [[CHI_ORANGE, 1], [W, 1], [CHI_ORANGE, 1]], collar: CHI, number: W, numberOutline: CHI_ORANGE, pants: W, pantsStripes: [CHI, CHI_ORANGE, CHI], socks: CHI, sockStripes: [CHI_ORANGE, W, CHI_ORANGE], cleats: K, helmet: { mask: '#9aa3ad' } },
  '49ers': { id: 'era1980s', label: '1980s 49ers', jersey: SF, trim: W, sleeve: 'stripes2', bands: [[W, 1], [K, 1], [W, 1]], collar: SF, number: W, numberOutline: K, pants: SF_GOLD, pantsStripes: [SF, W, SF], socks: SF, sockStripes: [W, K, W], cleats: K, helmet: { logoVariant: '49ers-80s', mask: '#9aa3ad' } },
  packers: { id: 'era1960s', label: '1960s Packers', jersey: GB, trim: W, sleeve: 'stripes2', bands: [[W, 1], [GB_GOLD, 1], [W, 1]], collar: GB, number: W, numberOutline: GB, pants: GB_GOLD, pantsStripes: [GB, W, GB], socks: GB, sockStripes: [W, GB_GOLD, W], cleats: K, helmet: { logoVariant: 'packers-60s', mask: '#9aa3ad' } },
  broncos: { id: 'era1998', label: '1998 Broncos', jersey: '#0a2343', trim: DEN, sleeve: 'none', shoulder: DEN, collar: DEN, number: W, numberOutline: DEN, pants: W, pantsStripes: ['#0a2343', DEN], socks: '#0a2343', sockStripes: [DEN], cleats: K, helmet: { shell: '#0a2343', mask: '#0a2343' } },
  rams: { id: 'era1999', label: '1999 Rams', jersey: '#0d2b56', trim: '#c9af74', sleeve: 'stripes2', bands: [['#c9af74', 2], [null, 1], ['#c9af74', 1]], collar: '#c9af74', number: W, numberOutline: '#c9af74', pants: '#c9af74', pantsStripes: ['#0d2b56', '#0d2b56'], socks: '#0d2b56', sockStripes: ['#c9af74'], cleats: K, helmet: { colors: ['#c9af74'], shell: '#0d2b56', stripes: ['#c9af74', W], mask: '#0d2b56' } },
  giants: { id: 'era1986', label: '1986 Giants', jersey: '#1f3a93', trim: NYG_RED, sleeve: 'stripes2', bands: [[W, 1], [NYG_RED, 1], [W, 1]], collar: NYG_RED, number: W, numberOutline: NYG_RED, pants: W, pantsStripes: ['#1f3a93', NYG_RED, '#1f3a93'], socks: '#1f3a93', sockStripes: [W, NYG_RED, W], cleats: K, helmet: { mask: '#9aa3ad' } },
  commanders: { id: 'era1980s', label: '1980s Washington', jersey: '#651c32', trim: '#feb71c', sleeve: 'stripes2', bands: [['#feb71c', 1], [W, 1], ['#feb71c', 1]], collar: '#feb71c', number: W, numberOutline: '#feb71c', pants: '#feb71c', pantsStripes: ['#651c32', W, '#651c32'], socks: '#7f364c', sockStripes: [W, '#feb71c', W], cleats: K, helmet: { logoVariant: 'commanders-r', shell: '#651c32', stripe: 'triple', stripes: ['#feb71c', W], mask: '#9aa3ad' } },
  chiefs: { id: 'era1969', label: '1969 Chiefs', jersey: KC, trim: W, sleeve: 'stripes2', bands: [[W, 1], [null, 1], [W, 1]], collar: W, number: W, numberOutline: K, pants: W, pantsStripes: [KC, W, KC], socks: KC, sockStripes: [W, W], cleats: K, helmet: { mask: '#9aa3ad' } },
  lions: { id: 'era1990s', label: '1990s Lions', jersey: DET, trim: W, sleeve: 'stripes2', bands: [[W, 1], [DET_SILVER, 1], [W, 1]], collar: W, number: W, numberOutline: DET_SILVER, pants: DET_SILVER, pantsStripes: [DET, W, DET], socks: DET, sockStripes: [W, DET_SILVER], cleats: K, helmet: { logoVariant: 'lions-90s' } },
  browns: { id: 'era1960s', label: '1960s Browns', jersey: CLE_BROWN, trim: W, sleeve: 'stripes2', bands: [[W, 1], [CLE_ORANGE, 1], [W, 1], [CLE_ORANGE, 1], [W, 1]], collar: CLE_BROWN, number: W, numberOutline: CLE_BROWN, pants: W, pantsStripes: [CLE_BROWN, CLE_ORANGE, CLE_BROWN], socks: CLE_BROWN, sockStripes: [W, CLE_ORANGE, W], cleats: K, helmet: { mask: '#9aa3ad' } },
  colts: { id: 'era1950s', label: '1950s Colts', jersey: '#003b7b', trim: W, sleeve: 'stripes2', bands: [[W, 2], [null, 1], [W, 2]], collar: '#003b7b', number: W, numberOutline: '#003b7b', pants: W, pantsStripes: ['#003b7b', '#003b7b'], socks: '#003b7b', sockStripes: [W, W], cleats: K, helmet: { mask: '#9aa3ad' } },
  patriots: { id: 'era2001', label: '2001 Patriots', jersey: NE_NAVY, trim: NE_RED, sleeve: 'stripes2', bands: [[NE_RED, 1], [W, 1], [NE_RED, 1]], collar: NE_RED, number: W, numberOutline: NE_RED, pants: '#b0b7bc', pantsStripes: [NE_NAVY, NE_RED, NE_NAVY], socks: NE_NAVY, sockStripes: [NE_RED], cleats: K },
  raiders: { id: 'era1970s', label: '1970s Raiders', jersey: K, trim: '#c4c8cc', sleeve: 'none', collar: K, number: '#c4c8cc', numberOutline: W, pants: SILVER, pantsStripes: [K, W, K], socks: K, sockStripes: ['#c4c8cc'], cleats: K },
};

/** Share of cards that roll a non-home uniform (for clubs that have one). Clubs with an era kit split it: */
export const ALT_CHANCE = 0.08;
/** … ERA_CHANCE for the era kit, the rest (6%) for the modern alternates. */
export const ERA_CHANCE = 0.02;
/** Market bonuses (applied by src/utils/cardMarket.ts cardPrice) */
export { ALT_VALUE_BONUS, ERA_VALUE_BONUS };

/** Fill the derived fields so every reader can use the plain legacy fields too. */
const complete = (id: string, label: string, h: Home): Uniform => {
  const pantsStripes = h.pantsStripes ?? (h.pantsStripe ? [h.pantsStripe] : undefined);
  const socks = h.socks ?? h.jersey;
  const sockStripes = h.sockStripes ?? (h.sockStripe ? [h.sockStripe] : []);
  return {
    ...h,
    id,
    label,
    sleeve: h.sleeve ?? 'stripes2',
    number: h.number ?? W,
    numberOutline: h.numberOutline ?? h.trim,
    numberStyle: h.numberStyle ?? 'outlined',
    pants: h.pants ?? W,
    pantsStripe: h.pantsStripe !== undefined ? h.pantsStripe : (pantsStripes?.[Math.floor((pantsStripes.length - 1) / 2)] ?? h.jersey),
    pantsStripes,
    socks,
    sockStripe: h.sockStripe ?? sockStripes[0] ?? socks,
    sockStripes,
    cleats: h.cleats ?? WC,
  };
};

const homeCache = new Map<string, Uniform>();
/** The team's home uniform (derived from the team colours for clubs outside the table). */
export const homeUniform = (team: string | undefined): Uniform => {
  const t = findNFLTeam(team);
  const key = t?.id ?? '';
  const hit = homeCache.get(key);
  if (hit) return hit;
  const h: Home = (t && HOME[t.id]) || {
    jersey: t ? `hsl(${t.primaryColor})` : '#1f2c4d',
    trim: t ? `hsl(${t.secondaryColor})` : '#f2c14a',
  };
  const u = complete('home', 'Home', h);
  homeCache.set(key, u);
  return u;
};

const ALTERNATES: Record<string, Uniform[]> = Object.fromEntries(Object.entries(ALTS).map(([team, list]) => [team, list.map((a) => complete(a.id, a.label, a))]));
const ERA_KITS: Record<string, Uniform> = Object.fromEntries(Object.entries(ERAS).map(([team, a]) => [team, { ...complete(a.id, a.label, a), era: true }]));

/**
 * The uniform a card shows: home, or (rarely, stable per player × variant × finish) a non-home kit. One roll r in
 * [0, 1): a club with both kinds gives r < ERA_CHANCE its era kit and r < ALT_CHANCE a modern alternate (split
 * evenly); a club with only alternates gives them the whole ALT_CHANCE; a club with only an era kit, ERA_CHANCE.
 */
export const uniformFor = (player: { name: string; team?: string }, variant?: string, finish?: string): Uniform => {
  const home = homeUniform(player.team);
  const t = findNFLTeam(player.team);
  const alts = (t && ALTERNATES[t.id]) || [];
  const era = t ? ERA_KITS[t.id] : undefined;
  if ((!alts.length && !era) || !variant) return home;
  const roll = seedOf(`${player.name}|${variant}|${finish ?? ''}|uniform`);
  const r = (roll % 1000) / 1000;
  if (era && r < ERA_CHANCE) return era;
  if (alts.length && r < ALT_CHANCE) return alts[(roll >>> 10) % alts.length];
  return home;
};

/** Which kind of kit this card (player × variant × finish) wears. */
export const uniformKind = (player: { name: string; team?: string }, variant?: string, finish?: string): 'home' | 'alt' | 'era' => {
  const u = uniformFor(player, variant, finish);
  return u.era ? 'era' : u.id === 'home' ? 'home' : 'alt';
};
/** True when this card rolled a non-home uniform (alternate or era kit). */
export const isAlternate = (player: { name: string; team?: string }, variant?: string, finish?: string) => uniformKind(player, variant, finish) !== 'home';
/** Card-back label: "Bucs Creamsicle", "1985 Bears (era)". */
export const uniformLabel = (u: Uniform) => (u.era ? `${u.label} (era)` : u.label);

/** The helmet worn with a uniform (alternates may change the shell, stripe or mask). */
export const helmetWith = (base: Helmet, u: Uniform): Helmet => (u.helmet ? { ...base, ...u.helmet, fine: u.helmet.shell ? undefined : base.fine } : base);

/**
 * Sleeve stripes as bands from the shoulder side to the hem (null = jersey colour), for any uniform: its `bands`,
 * else a pattern derived from the legacy `sleeve` kind ('yoke', 'bolt', 'tiger' and 'none' have no bands).
 */
export const sleeveBands = (u: Uniform): Band[] => {
  if (u.bands) return u.bands;
  if (u.sleeve === 'stripes2') return [[u.trim, 1], [null, 1], [u.trim, 1]];
  if (u.sleeve === 'stripes3') return [[u.trim, 1], [null, 1], [u.trim, 1], [null, 1], [u.trim, 1]];
  if (u.sleeve === 'bands') return [[u.trim, 2], [null, 1], [u.trim, 2]];
  return [];
};
/** Pants side stripe as half-pixel columns (empty = none). */
export const pantsBands = (u: Uniform): string[] => u.pantsStripes ?? (u.pantsStripe ? [u.pantsStripe, u.pantsStripe] : []);
/** Sock stripes as half-pixel rows. */
export const sockBands = (u: Uniform): string[] => u.sockStripes ?? [u.sockStripe, u.sockStripe];

/** Every home uniform (Art lab strips), in table order. */
export const allHomes = () => Object.keys(HOME).map((team) => ({ team, u: homeUniform(team) }));
/** Every modern alternate (Art lab). */
export const allAlternates = () => Object.entries(ALTERNATES).flatMap(([team, list]) => list.map((u) => ({ team, u })));
/** Every famous era kit (Art lab "Era kits"). */
export const allEraKits = () => Object.entries(ERA_KITS).map(([team, u]) => ({ team, u }));
export { HELMETS };
