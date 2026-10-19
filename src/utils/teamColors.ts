import { NFL_TEAMS, findNFLTeam } from './nflTeams';

export interface TeamColors {
  primary: string; // HSL triplet, e.g. "0 92% 45%"
  secondary: string;
}

/**
 * Team colors keyed by team id. Derived from NFL_TEAMS so colors and logos
 * always come from the same record.
 */
export const TEAM_COLORS: Record<string, TeamColors> = Object.fromEntries(
  NFL_TEAMS.map((t) => [t.id, { primary: t.primaryColor, secondary: t.secondaryColor }]),
);

/**
 * Resolve a team string (abbreviation, nickname, city or full name) to its colors.
 * Goes through findNFLTeam, which matches exact values first, so "CHI" is the Bears
 * (not the Chiefs) and "PHI" is the Eagles (not the Dolphins).
 */
export const getTeamColors = (teamName?: string | null): TeamColors | null => {
  const team = findNFLTeam(teamName);
  if (!team) return null;
  return { primary: team.primaryColor, secondary: team.secondaryColor };
};

export const getTeamGradient = (teamName?: string | null): string | null => {
  const colors = getTeamColors(teamName);
  if (!colors) return null;
  return `linear-gradient(135deg, hsl(${colors.primary}) 0%, hsl(${colors.secondary}) 100%)`;
};

export const getTeamBorderColor = (teamName?: string | null): string | null => {
  const colors = getTeamColors(teamName);
  if (!colors) return null;
  return `hsl(${colors.primary})`;
};

const parseHsl = (triplet: string): [number, number, number] | null => {
  const m = triplet.match(/(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** Relative luminance (WCAG) of an HSL triplet. */
const luminance = (triplet: string): number => {
  const parsed = parseHsl(triplet);
  if (!parsed) return 0;
  const [h, s, l] = [parsed[0], parsed[1] / 100, parsed[2] / 100];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
};

/** Black or white, whichever reads better on a solid fill of the given HSL triplet. */
export const getReadableTextOn = (triplet: string): string =>
  luminance(triplet) > 0.35 ? 'hsl(228 47% 7%)' : 'hsl(0 0% 100%)';

/**
 * A version of a team color that stays readable as text on the dark UI:
 * lifts lightness to at least 62% while keeping the hue.
 */
export const getTeamTextColor = (teamName?: string | null): string | null => {
  const colors = getTeamColors(teamName);
  if (!colors) return null;
  return liftForDarkBg(colors.primary);
};

export const liftForDarkBg = (triplet: string, minLightness = 62): string => {
  const parsed = parseHsl(triplet);
  if (!parsed) return `hsl(${triplet})`;
  const [h, s, l] = parsed;
  // Pure greys (e.g. Raiders silver) stay grey; everything else keeps its hue.
  return `hsl(${h} ${Math.min(s, 90)}% ${Math.max(l, minLightness)}%)`;
};
