import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { bannerTeamOf } from '@/utils/playerExtras';

/** The club's two colours as CSS variables for a `cs-card` (his banner club: where he is best known) */
export const clubStyle = (player: Pick<Player, 'name' | 'team'> & { bannerTeam?: string }): CSSProperties => {
  const t = findNFLTeam(bannerTeamOf(player as Player));
  return (t ? { '--cs-1': `hsl(${t.primaryColor})`, '--cs-2': `hsl(${t.secondaryColor})` } : {}) as CSSProperties;
};

/** Gold, silver and bronze for the top three of a ranked list */
export const MEDAL = ['#ffc62f', '#c9ced8', '#d08a4e'];

