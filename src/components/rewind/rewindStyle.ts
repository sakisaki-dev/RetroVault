import type { CSSProperties } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn, getTeamTextColor } from '@/utils/teamColors';

/** A club's colours as Season Rewind CSS vars: --rw-c1 primary, --rw-c2 secondary, --rw-fg text on the primary, --rw-ink lifted */
export const clubStyle = (club?: string | null): CSSProperties => {
  const t = findNFLTeam(club);
  if (!t) return {};
  return {
    '--rw-c1': `hsl(${t.primaryColor})`,
    '--rw-c2': `hsl(${t.secondaryColor})`,
    '--rw-fg': getReadableTextOn(t.primaryColor),
    '--rw-ink': getTeamTextColor(t.name) ?? '#fff',
  } as CSSProperties;
};
