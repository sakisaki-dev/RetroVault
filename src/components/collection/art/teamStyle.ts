import { findNFLTeam } from '@/utils/nflTeams';
import type { GamePlayer } from '@/config/ovr';
import { HELMETS } from './sprite/helmets';
import { helmetWith, homeUniform, type Uniform } from './sprite/uniforms';

/**
 * Per-team uniform summary for the card art (jersey, sprite, locker, Topps). Derived from sprite/uniforms.ts (the
 * home uniform, or the card's alternate) and sprite/helmets.ts; only the collar cut is kept here.
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

/** Collar cut per club (everything else comes from the uniform and helmet tables). */
const COLLARS: Record<string, Partial<TeamStyle>> = {
  colts: { collar: 'round' },
  broncos: { collar: 'round' },
  giants: { collar: 'round' },
  bears: { collar: 'round' },
  cardinals: { collar: 'round' },
  raiders: { collar: 'round', contrastCollar: false },
  packers: { collar: 'round' },
  steelers: { collar: 'round' },
  browns: { collar: 'round' },
};

const SLEEVE: Record<Uniform['sleeve'], TeamStyle['sleeve']> = { stripes2: 'stripes2', stripes3: 'stripes3', bands: 'stripes2', yoke: 'yoke', bolt: 'bolt', tiger: 'tiger', none: 'none' };

/**
 * Uniform details for a player's team (defaults for free agents and unknown teams), derived from the one uniform
 * table (sprite/uniforms.ts) and helmet table (sprite/helmets.ts) the sprite uses, so every art style agrees. Pass
 * the card's uniform to follow an alternate (its colours, and any helmet change).
 */
export const teamStyleFor = (player: Pick<GamePlayer, 'team'>, uniform?: Uniform): TeamStyle => {
  const team = findNFLTeam(player.team);
  const base: TeamStyle = { ...DEFAULT_STYLE, ...(team ? COLLARS[team.id] : {}) };
  const u = uniform ?? (team ? homeUniform(player.team) : undefined);
  const fromUniform: Partial<TeamStyle> = u
    ? {
        accent: u.numberStyle === 'double' ? (u.numberOutline2 ?? u.trim) : u.trim,
        sleeve: SLEEVE[u.sleeve],
        numbers: u.numberStyle,
        pants: u.pants,
        pantsStripe: u.pantsStripe,
      }
    : {};
  const h0 = team ? HELMETS[team.id] : undefined;
  const h = h0 && u ? helmetWith(h0, u) : h0;
  return {
    ...base,
    ...fromUniform,
    ...(h ? { helmet: h.shell, mask: h.mask, stripe: h.stripe === 'none' ? 'none' : h.stripe === 'single' ? 'single' : 'triple', stripeColors: h.stripes } : {}),
  };
};

/** Team logo URL (ESPN CDN) for a small decal / patch, or null. */
export const logoFor = (player: Pick<GamePlayer, 'team'>) => findNFLTeam(player.team)?.logoUrl ?? null;
