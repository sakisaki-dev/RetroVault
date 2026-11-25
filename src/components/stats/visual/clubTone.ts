import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { bannerTeamOf } from '@/utils/playerExtras';

/** The club's two colours as CSS variables for a `cs-card` (his banner club: where he is best known) */
export const clubStyle = (player: Pick<Player, 'name' | 'team'> & { bannerTeam?: string }): CSSProperties => {
  const t = findNFLTeam(bannerTeamOf(player as Player));
  return (t ? { '--cs-1': `hsl(${t.primaryColor})`, '--cs-2': `hsl(${t.secondaryColor})`, ...flatVars(t.primaryColor, t.secondaryColor) } : {}) as CSSProperties;
};

const lightOf = (hsl: string) => parseFloat(hsl.trim().split(/[\s,]+/)[2] ?? '50');

/**
 * Flat plaque colours (owner: "don't do gradients here"): the club's primary, or its secondary where the primary is
 * near-black, with a chalk or ink text colour that reads on it.
 */
const flatVars = (primary: string, secondary: string) => {
  const flat = lightOf(primary) < 20 && lightOf(secondary) > lightOf(primary) ? secondary : primary;
  // the card toned the colour into the night panel (clubStage.css .cs-flat), so chalk text always reads
  const [h, sat] = flat.trim().split(/[\s,]+/);
  // a pale club colour (silver) would wash the panel out, so the tint uses it no lighter than 42%
  const tint = lightOf(flat) > 42 ? `hsl(${h} ${sat} 42%)` : `hsl(${flat})`;
  return { '--cs-flat': `hsl(${flat})`, '--cs-flat-bg': tint, '--cs-flat-ink': '#ffffff' };
};

/** Gold, silver and bronze for the top three of a ranked list */
export const MEDAL = ['#ffc62f', '#c9ced8', '#d08a4e'];

