import { findNFLTeam } from '@/utils/nflTeams';
import type { GamePlayer } from '@/config/ovr';
import { HELMETS } from './sprite/helmets';

/**
 * Per-team uniform details for the card art (jersey, sprite, locker, Topps), on top of the primary / secondary
 * colours in nflTeams.ts. Simplified from each club's real look; anything left out falls back to DEFAULT_STYLE.
 *
 *   accent       third colour (outline of the numbers, stripe edges)
 *   sleeve       shoulder/sleeve trim: 'stripes2' / 'stripes3' (Northwestern stripes), 'yoke' (a solid shoulder cap),
 *                'bolt' (Chargers), 'tiger' (Bengals), 'none'
 *   numbers      'outlined' (fill + outline), 'double' (fill + two outlines), 'solid' (no outline)
 *   collar       'v' or 'round', in the trim colour ('contrast') or the jersey colour
 *   helmet       shell colour (CSS); undefined = primary
 *   stripe       crown stripe: 'single', 'triple' (centre + two thin), 'none'
 *   stripeColors [main, edge] for the crown stripe
 *   mask         facemask colour (CSS)
 *   pants        pants colour (CSS); undefined = the palette's pants
 *   pantsStripe  stripe down the pants (CSS) or null
 */
export interface TeamStyle {
  accent: string;
  sleeve: 'stripes2' | 'stripes3' | 'yoke' | 'bolt' | 'tiger' | 'none';
  numbers: 'outlined' | 'double' | 'solid';
  collar: 'v' | 'round';
  contrastCollar: boolean;
  helmet?: string;
  stripe: 'single' | 'triple' | 'none';
  stripeColors?: [string, string];
  mask: string;
  pants?: string;
  pantsStripe: string | null;
}

const W = '#f4f5f7';
const BLK = '#14161b';
const GREY = '#9aa3ad';

export const DEFAULT_STYLE: TeamStyle = {
  accent: W,
  sleeve: 'stripes2',
  numbers: 'outlined',
  collar: 'v',
  contrastCollar: true,
  stripe: 'single',
  mask: GREY,
  pantsStripe: null,
};

const S: Record<string, Partial<TeamStyle>> = {
  bills: { accent: '#c60c30', sleeve: 'stripes2', helmet: W, stripe: 'triple', stripeColors: ['#c60c30', '#00338d'], mask: '#00338d', pantsStripe: '#c60c30' },
  dolphins: { accent: '#005778', sleeve: 'stripes2', helmet: W, stripe: 'triple', stripeColors: ['#008e97', '#fc4c02'], mask: '#008e97', pantsStripe: '#fc4c02' },
  patriots: { accent: '#b0b7bc', sleeve: 'yoke', helmet: '#b0b7bc', stripe: 'single', stripeColors: ['#002244', '#c60c30'], mask: '#002244', pantsStripe: '#002244' },
  jets: { accent: BLK, sleeve: 'stripes2', helmet: '#125740', stripe: 'single', stripeColors: [W, '#125740'], mask: W, pantsStripe: '#125740' },
  ravens: { accent: '#9e7c0c', sleeve: 'yoke', helmet: '#1a1a1a', stripe: 'none', mask: '#1a1a1a', numbers: 'double', pantsStripe: '#241773' },
  bengals: { accent: W, sleeve: 'tiger', helmet: '#fb4f14', stripe: 'none', mask: BLK, pantsStripe: BLK },
  browns: { accent: '#ff3c00', sleeve: 'stripes3', helmet: '#ff3c00', stripe: 'triple', stripeColors: ['#311d00', W], mask: '#311d00', pants: W, pantsStripe: '#ff3c00', numbers: 'solid' },
  steelers: { accent: W, sleeve: 'stripes2', helmet: BLK, stripe: 'single', stripeColors: ['#ffb612', BLK], mask: BLK, pants: '#ffb612', pantsStripe: BLK, numbers: 'solid' },
  texans: { accent: '#a71930', sleeve: 'yoke', helmet: '#03202f', stripe: 'single', stripeColors: [W, '#a71930'], mask: '#03202f', pantsStripe: '#a71930' },
  colts: { accent: W, sleeve: 'stripes2', helmet: W, stripe: 'single', stripeColors: ['#002c5f', W], mask: '#002c5f', numbers: 'solid', collar: 'round' },
  jaguars: { accent: '#d7a22a', sleeve: 'yoke', helmet: BLK, stripe: 'single', stripeColors: ['#006778', '#d7a22a'], mask: BLK, pantsStripe: '#006778' },
  titans: { accent: '#c8102e', sleeve: 'yoke', helmet: '#0c2340', stripe: 'triple', stripeColors: ['#4b92db', '#c8102e'], mask: '#0c2340', pantsStripe: '#4b92db' },
  broncos: { accent: W, sleeve: 'yoke', helmet: '#002244', stripe: 'single', stripeColors: ['#fb4f14', W], mask: '#002244', pantsStripe: '#fb4f14', collar: 'round' },
  chiefs: { accent: W, sleeve: 'stripes3', helmet: '#e31837', stripe: 'none', mask: GREY, pantsStripe: '#e31837', numbers: 'outlined' },
  raiders: { accent: W, sleeve: 'none', helmet: '#a5acaf', stripe: 'single', stripeColors: [BLK, W], mask: GREY, pants: '#a5acaf', pantsStripe: BLK },
  chargers: { accent: '#0080c6', sleeve: 'bolt', helmet: W, stripe: 'none', mask: '#ffc20e', pantsStripe: '#ffc20e', numbers: 'double' },
  cowboys: { accent: '#869397', sleeve: 'stripes2', helmet: '#b0b7bc', stripe: 'triple', stripeColors: ['#003594', W], mask: GREY, pants: '#b0b7bc', pantsStripe: '#003594', numbers: 'outlined' },
  giants: { accent: '#a71930', sleeve: 'stripes2', helmet: '#0b2265', stripe: 'none', mask: GREY, pantsStripe: '#a71930', collar: 'round' },
  eagles: { accent: '#a5acaf', sleeve: 'yoke', helmet: '#004c54', stripe: 'none', mask: BLK, pantsStripe: '#004c54' },
  commanders: { accent: W, sleeve: 'stripes3', helmet: '#5a1414', stripe: 'single', stripeColors: ['#ffb612', W], mask: '#ffb612', pants: '#ffb612', pantsStripe: '#5a1414' },
  bears: { accent: W, sleeve: 'stripes3', helmet: '#0b162a', stripe: 'triple', stripeColors: ['#c83803', W], mask: '#0b162a', pantsStripe: '#c83803', collar: 'round' },
  lions: { accent: W, sleeve: 'stripes2', helmet: '#b0b7bc', stripe: 'single', stripeColors: ['#0076b6', BLK], mask: BLK, pants: '#b0b7bc', pantsStripe: '#0076b6' },
  packers: { accent: W, sleeve: 'stripes3', helmet: '#ffb612', stripe: 'triple', stripeColors: ['#203731', W], mask: GREY, pants: '#ffb612', pantsStripe: '#203731', numbers: 'solid' },
  vikings: { accent: W, sleeve: 'stripes2', helmet: '#4f2683', stripe: 'single', stripeColors: [W, '#ffc62f'], mask: BLK, pantsStripe: '#ffc62f' },
  falcons: { accent: '#a5acaf', sleeve: 'yoke', helmet: BLK, stripe: 'single', stripeColors: ['#a71930', W], mask: BLK, pantsStripe: '#a71930' },
  panthers: { accent: '#bfc0bf', sleeve: 'yoke', helmet: '#bfc0bf', stripe: 'single', stripeColors: ['#0085ca', BLK], mask: BLK, pantsStripe: '#0085ca' },
  saints: { accent: W, sleeve: 'yoke', helmet: '#d3bc8d', stripe: 'single', stripeColors: [BLK, W], mask: BLK, pants: '#d3bc8d', pantsStripe: BLK },
  buccaneers: { accent: '#ff7900', sleeve: 'yoke', helmet: '#34302b', stripe: 'none', mask: BLK, pants: '#34302b', pantsStripe: '#d50a0a', numbers: 'double' },
  '49ers': { accent: W, sleeve: 'stripes3', helmet: '#b3995d', stripe: 'triple', stripeColors: ['#aa0000', W], mask: GREY, pants: '#b3995d', pantsStripe: '#aa0000' },
  seahawks: { accent: '#69be28', sleeve: 'yoke', helmet: '#002244', stripe: 'single', stripeColors: ['#a5acaf', '#69be28'], mask: '#002244', pantsStripe: '#69be28', numbers: 'double' },
  rams: { accent: '#ffd100', sleeve: 'yoke', helmet: '#003594', stripe: 'none', mask: '#003594', pants: '#ffd100', pantsStripe: '#003594' },
  cardinals: { accent: W, sleeve: 'stripes2', helmet: W, stripe: 'single', stripeColors: [BLK, '#97233f'], mask: BLK, pantsStripe: '#97233f', collar: 'round' },
};

/** Uniform details for a player's current team (defaults for free agents and unknown teams). */
export const teamStyleFor = (player: Pick<GamePlayer, 'team'>): TeamStyle => {
  const team = findNFLTeam(player.team);
  const base = { ...DEFAULT_STYLE, ...(team ? S[team.id] : {}) };
  // Helmet shell, crown stripe and facemask come from the one helmet table (helmets.ts), shared with the sprite
  const h = team ? HELMETS[team.id] : undefined;
  return h ? { ...base, helmet: h.shell, mask: h.mask, stripe: h.stripe === 'none' ? 'none' : h.stripe === 'single' ? 'single' : 'triple', stripeColors: h.stripes } : base;
};

/** Team logo URL (ESPN CDN) for a small decal / patch, or null. */
export const logoFor = (player: Pick<GamePlayer, 'team'>) => findNFLTeam(player.team)?.logoUrl ?? null;
