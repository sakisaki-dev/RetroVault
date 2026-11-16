import type { CSSProperties } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { liftForDarkBg } from '@/utils/teamColors';

/** A club's colours as CSS variables: `--<prefix>` the deep fill, `-2` the trim, `-ink` readable text on the dark page */
export const clubVars = (club: string, prefix: string): CSSProperties => {
  const t = findNFLTeam(club);
  const p = t?.primaryColor ?? '226 33% 30%';
  const s = t && t.secondaryColor !== t.primaryColor ? t.secondaryColor : '0 0% 75%';
  return { [`--${prefix}`]: p, [`--${prefix}-2`]: s, [`--${prefix}-ink`]: liftForDarkBg(p, 66) } as CSSProperties;
};
