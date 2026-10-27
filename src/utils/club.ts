import { useLeagueContent, type LeagueContent } from '@/utils/leagueContent';

/**
 * The owner's current club, derived from the data (never hard-coded): coach.json `currentStint` (a club switch
 * recorded before the new club has played a season), else the club of the last coached season, else the club in
 * the latest Super Bowl the owner played. Historical labels (who won which year) never use this.
 */
export const currentClub = (content: LeagueContent | null | undefined): string | null => {
  if (!content) return null;
  const stint = content.coach?.currentStint?.team;
  if (stint) return stint;
  const season = content.coach?.seasons.at(-1)?.team;
  if (season) return season;
  return [...content.superBowls].reverse().find((sb) => sb.yourTeam)?.yourTeam ?? null;
};

/** The current club for components (null until content.json loads). */
export const useCurrentClub = (): string | null => currentClub(useLeagueContent().content);
