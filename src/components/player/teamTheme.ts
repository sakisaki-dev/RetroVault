import type { CSSProperties } from 'react';
import type { NFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn, liftForDarkBg } from '@/utils/teamColors';

const NEUTRAL_PRIMARY = '226 33% 30%';
const NEUTRAL_SECONDARY = '226 33% 48%';

/** CSS custom properties that theme the player card (see playerCard.css). */
export const teamThemeVars = (team: NFLTeam | null) => {
  const p = team?.primaryColor ?? NEUTRAL_PRIMARY;
  // Same-color secondaries (Browns) still need a visible accent
  const s = team ? (team.secondaryColor !== team.primaryColor ? team.secondaryColor : '0 0% 100%') : NEUTRAL_SECONDARY;
  const accent = liftForDarkBg(p);
  return {
    p,
    s,
    vars: {
      '--tc-p': p,
      '--tc-s': s,
      '--tc-ink': getReadableTextOn(p),
      '--tc-accent': accent,
      '--tc-accent-2': liftForDarkBg(s),
      '--tc-track': accent.replace(/\)$/, ' / 0.18)'),
    } as CSSProperties,
  };
};
