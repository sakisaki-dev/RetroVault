import { findNFLTeam } from '@/utils/nflTeams';
import { seedOf } from '../shared';
import { HELMETS, type Helmet } from './helmets';

/**
 * Uniforms, simplified from each club's real look (no logos): jersey, shoulder yoke, sleeve stripes, number colour and
 * outline, collar, pants with their side stripe, socks with a stripe, cleats. Used by the sprite, and (jersey / trim /
 * numbers) by the Jersey, Locker and Topps art through the palette. Every card wears the home uniform, except a
 * small, stable share (ALT_CHANCE, decided per player × variant × finish) that rolls one of the club's ALTERNATES.
 */
export interface Uniform {
  /** "home", or the alternate's id */
  id: string;
  /** Shown on the card back for alternates, e.g. "Bucs Creamsicle" */
  label: string;
  jersey: string;
  /** Sleeve / shoulder trim and collar */
  trim: string;
  sleeve: 'stripes2' | 'stripes3' | 'yoke' | 'bolt' | 'tiger' | 'none' | 'bands';
  /** Shoulder yoke colour (sleeve 'yoke') */
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
}

const W = '#f4f5f7';
const K = '#14161b';
const WC = '#eceef1';

type Home = Partial<Omit<Uniform, 'id' | 'label'>>;
/** Home uniforms (anything left out is derived from the team colours). */
const HOME: Record<string, Home> = {
  bills: { jersey: '#00338d', trim: '#c60c30', sleeve: 'stripes2', number: W, numberOutline: '#c60c30', pants: W, pantsStripe: '#c60c30', sockStripe: '#c60c30' },
  dolphins: { jersey: '#008e97', trim: '#fc4c02', sleeve: 'stripes2', number: W, numberOutline: '#005778', pants: W, pantsStripe: '#008e97' },
  patriots: { jersey: '#002244', trim: '#c60c30', sleeve: 'stripes2', number: W, numberOutline: '#c60c30', pants: '#b0b7bc', pantsStripe: '#002244' },
  jets: { jersey: '#125740', trim: W, sleeve: 'stripes2', number: W, numberOutline: '#125740', pants: W, pantsStripe: '#125740' },
  ravens: { jersey: '#241773', trim: K, sleeve: 'yoke', yoke: '#241773', number: W, numberOutline: K, numberStyle: 'double', pants: W, pantsStripe: '#241773', cleats: K },
  bengals: { jersey: '#fb4f14', trim: K, sleeve: 'tiger', number: K, numberOutline: W, pants: K, pantsStripe: '#fb4f14', socks: K, sockStripe: '#fb4f14', cleats: K },
  browns: { jersey: '#311d00', trim: '#ff3c00', sleeve: 'stripes3', number: '#ff3c00', numberOutline: W, numberStyle: 'solid', pants: W, pantsStripe: '#ff3c00', sockStripe: '#ff3c00' },
  steelers: { jersey: K, trim: '#ffb612', sleeve: 'stripes2', number: '#ffb612', numberOutline: K, numberStyle: 'solid', pants: '#ffb612', pantsStripe: K, socks: K, sockStripe: '#ffb612', cleats: K },
  texans: { jersey: '#03202f', trim: '#a71930', sleeve: 'yoke', yoke: '#03202f', number: W, numberOutline: '#a71930', pants: W, pantsStripe: '#a71930' },
  colts: { jersey: '#002c5f', trim: W, sleeve: 'stripes2', number: W, numberOutline: '#002c5f', numberStyle: 'solid', pants: W, pantsStripe: '#002c5f' },
  jaguars: { jersey: '#006778', trim: '#d7a22a', sleeve: 'yoke', yoke: K, number: W, numberOutline: '#d7a22a', pants: W, pantsStripe: K, cleats: K },
  titans: { jersey: '#0c2340', trim: '#4b92db', sleeve: 'yoke', yoke: '#4b92db', number: W, numberOutline: '#c8102e', pants: W, pantsStripe: '#4b92db' },
  broncos: { jersey: '#fb4f14', trim: '#002244', sleeve: 'yoke', yoke: '#002244', number: W, numberOutline: '#002244', pants: W, pantsStripe: '#002244' },
  chiefs: { jersey: '#e31837', trim: W, sleeve: 'stripes3', number: W, numberOutline: '#ffb81c', pants: W, pantsStripe: '#e31837' },
  raiders: { jersey: K, trim: '#a5acaf', sleeve: 'none', number: W, numberOutline: '#a5acaf', numberStyle: 'solid', pants: '#a5acaf', pantsStripe: K, socks: K, sockStripe: '#a5acaf', cleats: K },
  chargers: { jersey: '#0080c6', trim: '#ffc20e', sleeve: 'bolt', number: W, numberOutline: '#ffc20e', numberStyle: 'double', pants: '#ffc20e', pantsStripe: '#0080c6' },
  cowboys: { jersey: W, trim: '#003594', sleeve: 'stripes2', number: '#003594', numberOutline: '#869397', pants: '#b0b7bc', pantsStripe: '#003594', sockStripe: '#003594' },
  giants: { jersey: '#0b2265', trim: '#a71930', sleeve: 'stripes2', number: W, numberOutline: '#a71930', pants: '#a5acaf', pantsStripe: '#a71930' },
  eagles: { jersey: '#004c54', trim: '#a5acaf', sleeve: 'yoke', yoke: '#004c54', number: W, numberOutline: '#a5acaf', pants: W, pantsStripe: '#004c54', cleats: K },
  commanders: { jersey: '#5a1414', trim: '#ffb612', sleeve: 'stripes3', number: W, numberOutline: '#ffb612', pants: '#ffb612', pantsStripe: '#5a1414' },
  bears: { jersey: '#0b162a', trim: '#c83803', sleeve: 'stripes3', number: W, numberOutline: '#c83803', numberStyle: 'solid', pants: W, pantsStripe: '#c83803', sockStripe: '#c83803' },
  lions: { jersey: '#0076b6', trim: W, sleeve: 'stripes2', number: W, numberOutline: '#b0b7bc', pants: '#b0b7bc', pantsStripe: '#0076b6' },
  packers: { jersey: '#203731', trim: '#ffb612', sleeve: 'stripes3', number: W, numberOutline: '#203731', numberStyle: 'solid', pants: '#ffb612', pantsStripe: '#203731', sockStripe: '#ffb612' },
  vikings: { jersey: '#4f2683', trim: '#ffc62f', sleeve: 'stripes2', number: W, numberOutline: '#ffc62f', pants: W, pantsStripe: '#4f2683' },
  falcons: { jersey: K, trim: '#a71930', sleeve: 'yoke', yoke: K, number: W, numberOutline: '#a71930', pants: W, pantsStripe: '#a71930', cleats: K },
  panthers: { jersey: '#0085ca', trim: K, sleeve: 'yoke', yoke: '#0085ca', number: W, numberOutline: K, pants: '#bfc0bf', pantsStripe: '#0085ca', cleats: K },
  saints: { jersey: K, trim: '#d3bc8d', sleeve: 'stripes2', number: '#d3bc8d', numberOutline: W, numberStyle: 'solid', pants: '#d3bc8d', pantsStripe: K, socks: K, sockStripe: '#d3bc8d', cleats: K },
  buccaneers: { jersey: '#d50a0a', trim: '#34302b', sleeve: 'yoke', yoke: '#d50a0a', number: W, numberOutline: '#ff7900', numberStyle: 'double', pants: '#5b5752', pantsStripe: '#d50a0a' },
  cardinals: { jersey: '#97233f', trim: W, sleeve: 'stripes2', number: W, numberOutline: K, pants: W, pantsStripe: '#97233f', cleats: K },
  '49ers': { jersey: '#aa0000', trim: W, sleeve: 'stripes3', number: W, numberOutline: '#b3995d', pants: '#b3995d', pantsStripe: '#aa0000', sockStripe: '#aa0000' },
  seahawks: { jersey: '#002244', trim: '#69be28', sleeve: 'yoke', yoke: '#a5acaf', number: W, numberOutline: '#a5acaf', numberStyle: 'double', pants: '#a5acaf', pantsStripe: '#002244', socks: '#002244', sockStripe: '#a5acaf', cleats: K },
  rams: { jersey: '#003594', trim: '#ffd100', sleeve: 'stripes2', number: W, numberOutline: '#ffd100', pants: '#ffd100', pantsStripe: '#003594' },
};

/** A few real, well-known alternates (at most two per club). */
const ALTERNATES: Record<string, Uniform[]> = {
  buccaneers: [
    { id: 'creamsicle', label: 'Bucs Creamsicle', jersey: '#f58025', trim: '#d50a0a', sleeve: 'stripes2', number: W, numberOutline: '#d50a0a', numberStyle: 'outlined', pants: W, pantsStripe: '#f58025', socks: W, sockStripe: '#f58025', cleats: WC, helmet: { shell: W, stripe: 'single', stripes: ['#d50a0a', '#f58025'], mask: '#d50a0a' } },
  ],
  titans: [
    { id: 'oilers', label: 'Oilers Columbia Blue', jersey: '#7ab2dd', trim: '#c8102e', sleeve: 'stripes2', number: W, numberOutline: '#c8102e', numberStyle: 'outlined', pants: W, pantsStripe: '#c8102e', socks: W, sockStripe: '#7ab2dd', cleats: WC, helmet: { shell: '#7ab2dd', stripe: 'triple', stripes: ['#c8102e', W], mask: W } },
  ],
  jets: [
    { id: 'legacy', label: 'Jets Legacy Green', jersey: '#115740', trim: W, sleeve: 'stripes3', number: W, numberOutline: '#115740', numberStyle: 'solid', pants: W, pantsStripe: '#115740', socks: '#115740', sockStripe: W, cleats: WC, helmet: { shell: W, stripe: 'triple', stripes: ['#115740', '#115740'], mask: '#115740' } },
  ],
  patriots: [
    { id: 'pat', label: 'Pat Patriot Red', jersey: '#c60c30', trim: W, sleeve: 'stripes2', number: W, numberOutline: '#002244', numberStyle: 'outlined', pants: W, pantsStripe: '#c60c30', socks: W, sockStripe: '#c60c30', cleats: WC, helmet: { shell: W, stripe: 'triple', stripes: ['#c60c30', '#002244'], mask: W } },
  ],
  seahawks: [
    { id: 'action', label: 'Seahawks Action Green', jersey: '#69be28', trim: '#002244', sleeve: 'yoke', yoke: '#002244', number: '#002244', numberOutline: W, numberStyle: 'outlined', pants: '#69be28', pantsStripe: '#002244', socks: '#69be28', sockStripe: '#002244', cleats: WC },
  ],
  rams: [
    { id: 'throwback', label: 'Rams Royal & Gold Throwback', jersey: '#003594', trim: '#ffd100', sleeve: 'stripes3', number: '#ffd100', numberOutline: W, numberStyle: 'solid', pants: '#ffd100', pantsStripe: '#003594', socks: '#003594', sockStripe: '#ffd100', cleats: K },
  ],
  eagles: [
    { id: 'kelly', label: 'Eagles Kelly Green', jersey: '#4c9a2a', trim: W, sleeve: 'stripes2', number: W, numberOutline: '#a5acaf', numberStyle: 'outlined', pants: W, pantsStripe: '#4c9a2a', socks: W, sockStripe: '#4c9a2a', cleats: WC, helmet: { shell: '#4c9a2a', mask: '#a5acaf' } },
  ],
  steelers: [
    { id: 'bumblebee', label: 'Steelers Bumblebee', jersey: K, trim: '#ffb612', sleeve: 'bands', number: K, numberOutline: '#ffb612', numberStyle: 'outlined', pants: '#ffb612', pantsStripe: K, socks: K, sockStripe: '#ffb612', cleats: K },
  ],
  bills: [
    { id: 'colorrush', label: 'Bills Color Rush Red', jersey: '#c60c30', trim: '#00338d', sleeve: 'stripes2', number: W, numberOutline: '#00338d', numberStyle: 'outlined', pants: '#c60c30', pantsStripe: W, socks: '#c60c30', sockStripe: W, cleats: WC },
  ],
  giants: [
    { id: 'century', label: 'Giants Century Red', jersey: '#a71930', trim: '#0b2265', sleeve: 'stripes2', number: W, numberOutline: '#0b2265', numberStyle: 'outlined', pants: W, pantsStripe: '#0b2265', socks: '#a71930', sockStripe: W, cleats: WC },
  ],
  packers: [
    { id: 'acme', label: 'Packers Acme Throwback', jersey: '#1d2847', trim: '#ffb612', sleeve: 'none', number: '#ffb612', numberOutline: '#ffb612', numberStyle: 'solid', pants: '#c4a65a', pantsStripe: null, socks: '#1d2847', sockStripe: '#ffb612', cleats: K, helmet: { shell: '#5b3a22', stripe: 'none', mask: '#5b3a22' } },
  ],
  falcons: [
    { id: 'throwback', label: 'Falcons Throwback Red', jersey: '#a71930', trim: K, sleeve: 'stripes3', number: W, numberOutline: K, numberStyle: 'outlined', pants: W, pantsStripe: K, socks: '#a71930', sockStripe: W, cleats: K },
  ],
};

/** Share of cards that roll an alternate (for clubs that have one). */
export const ALT_CHANCE = 0.08;
/** Market bonus for an alternate-uniform card */
export const ALT_VALUE_BONUS = 1.1;

/** The team's home uniform (derived from the team colours where HOME leaves gaps). */
export const homeUniform = (team: string | undefined): Uniform => {
  const t = findNFLTeam(team);
  const h = (t && HOME[t.id]) || {};
  const jersey = h.jersey ?? (t ? `hsl(${t.primaryColor})` : '#1f2c4d');
  const trim = h.trim ?? (t ? `hsl(${t.secondaryColor})` : '#f2c14a');
  return {
    id: 'home',
    label: 'Home',
    jersey,
    trim,
    sleeve: h.sleeve ?? 'stripes2',
    yoke: h.yoke,
    number: h.number ?? W,
    numberOutline: h.numberOutline ?? trim,
    numberStyle: h.numberStyle ?? 'outlined',
    pants: h.pants ?? W,
    pantsStripe: h.pantsStripe === undefined ? jersey : h.pantsStripe,
    socks: h.socks ?? W,
    sockStripe: h.sockStripe ?? jersey,
    cleats: h.cleats ?? WC,
  };
};

/** The uniform a card shows: home, or (rarely, stable per player × variant × finish) one of the club's alternates. */
export const uniformFor = (player: { name: string; team?: string }, variant?: string, finish?: string): Uniform => {
  const home = homeUniform(player.team);
  const t = findNFLTeam(player.team);
  const alts = (t && ALTERNATES[t.id]) || [];
  if (!alts.length || !variant) return home;
  const roll = seedOf(`${player.name}|${variant}|${finish ?? ''}|uniform`);
  if ((roll % 1000) / 1000 >= ALT_CHANCE) return home;
  return alts[(roll >>> 10) % alts.length];
};

/** The helmet worn with a uniform (alternates may change the shell, stripe or mask). */
export const helmetWith = (base: Helmet, u: Uniform): Helmet => (u.helmet ? { ...base, ...u.helmet, fine: u.helmet.shell ? undefined : base.fine } : base);

/** Every alternate (Art lab). */
export const allAlternates = () => Object.entries(ALTERNATES).flatMap(([team, list]) => list.map((u) => ({ team, u })));
export { HELMETS };
