import { NFL_TEAMS, type NFLTeam } from '@/utils/nflTeams';

/**
 * Clubs in the header's quick search (owner, 2026-11-17: "allow me to search teams in the quick search"): a club
 * matches when every typed word starts a word of its name, city, full name or abbreviation ("eag", "phi", "new york",
 * "ny"). Name starts rank first, then city, then the rest; at most `limit`.
 */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const searchTeams = (query: string, limit = 4): NFLTeam[] => {
  const q = fold(query).trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  const scored = NFL_TEAMS.map((t) => {
    const tokens = fold(`${t.name} ${t.city} ${t.fullName} ${t.abbreviation}`).split(/[\s.-]+/).filter(Boolean);
    if (!words.every((w) => tokens.some((x) => x.startsWith(w)))) return null;
    const name = fold(t.name);
    const score = name.startsWith(q) ? 3 : fold(t.abbreviation) === q ? 2.5 : fold(t.city).startsWith(q) ? 2 : 1;
    return { t, score };
  }).filter((x): x is { t: NFLTeam; score: number } => !!x);
  return scored
    .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
    .slice(0, limit)
    .map((x) => x.t);
};

/** Fired with the club's name so an open Teams page shows its sheet even when the hash didn't change */
export const OPEN_TEAM_EVENT = 'retrovault:open-team';

/** Opens a club's team sheet (Stats › Teams), from anywhere: the hash route plus an event for a page already there. */
export const openTeamPage = (name: string) => {
  const hash = `#stats/teams?p=${encodeURIComponent(name)}`;
  if (window.location.hash !== hash) window.location.hash = hash;
  window.dispatchEvent(new CustomEvent(OPEN_TEAM_EVENT, { detail: name }));
};

/** How well the clubs found match what was typed, on the scale the player scores use (exact 900, name start 700, abbreviation or city start 600, other 400). */
export const clubsScore = (query: string, clubs: NFLTeam[]): number => {
  const q = fold(query).trim();
  let best = 0;
  for (const t of clubs) {
    const exact = [t.name, t.abbreviation, t.city, t.fullName].some((x) => fold(x) === q);
    const s = exact ? 900 : fold(t.name).startsWith(q) ? 700 : fold(t.abbreviation).startsWith(q) || fold(t.city).startsWith(q) ? 600 : 400;
    best = Math.max(best, s);
  }
  return best;
};
