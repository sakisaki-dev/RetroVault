// Complete NFL team data with logos and colors

export interface NFLTeam {
  id: string;
  name: string;
  city: string;
  fullName: string;
  abbreviation: string;
  conference: 'AFC' | 'NFC';
  division: 'East' | 'North' | 'South' | 'West';
  primaryColor: string; // HSL format
  secondaryColor: string; // HSL format
  logoUrl: string;
}

export const NFL_TEAMS: NFLTeam[] = [
  // AFC East
  { id: 'bills', name: 'Bills', city: 'Buffalo', fullName: 'Buffalo Bills', abbreviation: 'BUF', conference: 'AFC', division: 'East', primaryColor: '217 89% 35%', secondaryColor: '0 92% 45%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png' },
  { id: 'dolphins', name: 'Dolphins', city: 'Miami', fullName: 'Miami Dolphins', abbreviation: 'MIA', conference: 'AFC', division: 'East', primaryColor: '173 94% 37%', secondaryColor: '21 100% 54%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png' },
  { id: 'patriots', name: 'Patriots', city: 'New England', fullName: 'New England Patriots', abbreviation: 'NE', conference: 'AFC', division: 'East', primaryColor: '221 72% 26%', secondaryColor: '0 77% 41%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png' },
  { id: 'jets', name: 'Jets', city: 'New York', fullName: 'New York Jets', abbreviation: 'NYJ', conference: 'AFC', division: 'East', primaryColor: '140 100% 22%', secondaryColor: '0 0% 100%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png' },
  
  // AFC North
  { id: 'ravens', name: 'Ravens', city: 'Baltimore', fullName: 'Baltimore Ravens', abbreviation: 'BAL', conference: 'AFC', division: 'North', primaryColor: '264 73% 33%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png' },
  { id: 'bengals', name: 'Bengals', city: 'Cincinnati', fullName: 'Cincinnati Bengals', abbreviation: 'CIN', conference: 'AFC', division: 'North', primaryColor: '24 100% 50%', secondaryColor: '0 0% 0%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png' },
  { id: 'browns', name: 'Browns', city: 'Cleveland', fullName: 'Cleveland Browns', abbreviation: 'CLE', conference: 'AFC', division: 'North', primaryColor: '24 76% 35%', secondaryColor: '24 76% 35%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png' },
  { id: 'steelers', name: 'Steelers', city: 'Pittsburgh', fullName: 'Pittsburgh Steelers', abbreviation: 'PIT', conference: 'AFC', division: 'North', primaryColor: '45 100% 50%', secondaryColor: '0 0% 0%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png' },
  
  // AFC South
  { id: 'texans', name: 'Texans', city: 'Houston', fullName: 'Houston Texans', abbreviation: 'HOU', conference: 'AFC', division: 'South', primaryColor: '217 100% 23%', secondaryColor: '0 100% 48%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png' },
  { id: 'colts', name: 'Colts', city: 'Indianapolis', fullName: 'Indianapolis Colts', abbreviation: 'IND', conference: 'AFC', division: 'South', primaryColor: '225 100% 35%', secondaryColor: '0 0% 100%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png' },
  { id: 'jaguars', name: 'Jaguars', city: 'Jacksonville', fullName: 'Jacksonville Jaguars', abbreviation: 'JAX', conference: 'AFC', division: 'South', primaryColor: '175 100% 30%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png' },
  { id: 'titans', name: 'Titans', city: 'Tennessee', fullName: 'Tennessee Titans', abbreviation: 'TEN', conference: 'AFC', division: 'South', primaryColor: '210 100% 40%', secondaryColor: '0 77% 41%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png' },
  
  // AFC West
  { id: 'broncos', name: 'Broncos', city: 'Denver', fullName: 'Denver Broncos', abbreviation: 'DEN', conference: 'AFC', division: 'West', primaryColor: '20 100% 50%', secondaryColor: '217 89% 35%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png' },
  { id: 'chiefs', name: 'Chiefs', city: 'Kansas City', fullName: 'Kansas City Chiefs', abbreviation: 'KC', conference: 'AFC', division: 'West', primaryColor: '0 92% 45%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png' },
  { id: 'raiders', name: 'Raiders', city: 'Las Vegas', fullName: 'Las Vegas Raiders', abbreviation: 'LV', conference: 'AFC', division: 'West', primaryColor: '0 0% 45%', secondaryColor: '0 0% 20%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png' },
  { id: 'chargers', name: 'Chargers', city: 'Los Angeles', fullName: 'Los Angeles Chargers', abbreviation: 'LAC', conference: 'AFC', division: 'West', primaryColor: '206 100% 42%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png' },
  
  // NFC East
  { id: 'cowboys', name: 'Cowboys', city: 'Dallas', fullName: 'Dallas Cowboys', abbreviation: 'DAL', conference: 'NFC', division: 'East', primaryColor: '217 89% 35%', secondaryColor: '0 0% 75%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png' },
  { id: 'giants', name: 'Giants', city: 'New York', fullName: 'New York Giants', abbreviation: 'NYG', conference: 'NFC', division: 'East', primaryColor: '217 100% 35%', secondaryColor: '0 77% 41%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png' },
  { id: 'eagles', name: 'Eagles', city: 'Philadelphia', fullName: 'Philadelphia Eagles', abbreviation: 'PHI', conference: 'NFC', division: 'East', primaryColor: '167 91% 24%', secondaryColor: '0 0% 0%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png' },
  { id: 'commanders', name: 'Commanders', city: 'Washington', fullName: 'Washington Commanders', abbreviation: 'WAS', conference: 'NFC', division: 'East', primaryColor: '345 80% 36%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png' },
  
  // NFC North
  { id: 'bears', name: 'Bears', city: 'Chicago', fullName: 'Chicago Bears', abbreviation: 'CHI', conference: 'NFC', division: 'North', primaryColor: '217 89% 25%', secondaryColor: '24 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png' },
  { id: 'lions', name: 'Lions', city: 'Detroit', fullName: 'Detroit Lions', abbreviation: 'DET', conference: 'NFC', division: 'North', primaryColor: '206 100% 42%', secondaryColor: '0 0% 75%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png' },
  { id: 'packers', name: 'Packers', city: 'Green Bay', fullName: 'Green Bay Packers', abbreviation: 'GB', conference: 'NFC', division: 'North', primaryColor: '100 69% 28%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png' },
  { id: 'vikings', name: 'Vikings', city: 'Minnesota', fullName: 'Minnesota Vikings', abbreviation: 'MIN', conference: 'NFC', division: 'North', primaryColor: '264 73% 40%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png' },
  
  // NFC South
  { id: 'falcons', name: 'Falcons', city: 'Atlanta', fullName: 'Atlanta Falcons', abbreviation: 'ATL', conference: 'NFC', division: 'South', primaryColor: '0 92% 45%', secondaryColor: '0 0% 0%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png' },
  { id: 'panthers', name: 'Panthers', city: 'Carolina', fullName: 'Carolina Panthers', abbreviation: 'CAR', conference: 'NFC', division: 'South', primaryColor: '200 100% 35%', secondaryColor: '0 0% 0%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png' },
  { id: 'saints', name: 'Saints', city: 'New Orleans', fullName: 'New Orleans Saints', abbreviation: 'NO', conference: 'NFC', division: 'South', primaryColor: '45 100% 50%', secondaryColor: '0 0% 0%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png' },
  { id: 'buccaneers', name: 'Buccaneers', city: 'Tampa Bay', fullName: 'Tampa Bay Buccaneers', abbreviation: 'TB', conference: 'NFC', division: 'South', primaryColor: '0 77% 41%', secondaryColor: '0 0% 10%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png' },
  
  // NFC West
  { id: 'cardinals', name: 'Cardinals', city: 'Arizona', fullName: 'Arizona Cardinals', abbreviation: 'ARI', conference: 'NFC', division: 'West', primaryColor: '350 84% 38%', secondaryColor: '0 0% 0%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png' },
  { id: '49ers', name: '49ers', city: 'San Francisco', fullName: 'San Francisco 49ers', abbreviation: 'SF', conference: 'NFC', division: 'West', primaryColor: '350 84% 38%', secondaryColor: '45 80% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png' },
  { id: 'seahawks', name: 'Seahawks', city: 'Seattle', fullName: 'Seattle Seahawks', abbreviation: 'SEA', conference: 'NFC', division: 'West', primaryColor: '217 89% 25%', secondaryColor: '97 100% 45%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png' },
  { id: 'rams', name: 'Rams', city: 'Los Angeles', fullName: 'Los Angeles Rams', abbreviation: 'LAR', conference: 'NFC', division: 'West', primaryColor: '217 100% 35%', secondaryColor: '45 100% 50%', logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png' },
];

const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

/** Common alternate spellings, old names and short forms. Keys are normalized. */
const TEAM_ALIASES: Record<string, string> = {
  niners: '49ers',
  sf49ers: '49ers',
  bucs: 'buccaneers',
  tampabaybucs: 'buccaneers',
  pats: 'patriots',
  wsh: 'commanders',
  was: 'commanders',
  washingtonfootballteam: 'commanders',
  footballteam: 'commanders',
  redskins: 'commanders',
  washingtonredskins: 'commanders',
  jac: 'jaguars',
  jags: 'jaguars',
  lvr: 'raiders',
  oak: 'raiders',
  oaklandraiders: 'raiders',
  sd: 'chargers',
  sdg: 'chargers',
  sandiegochargers: 'chargers',
  la: 'rams',
  stl: 'rams',
  stlouisrams: 'rams',
  gnb: 'packers',
  kan: 'chiefs',
  nwe: 'patriots',
  nor: 'saints',
  tam: 'buccaneers',
  sfo: '49ers',
  phx: 'cardinals',
  houstonoilers: 'titans',
  oilers: 'titans',
  tennesseeoilers: 'titans',
  baltimorecolts: 'colts',
};

// Exact-match index: id, nickname, abbreviation, full name, city + nickname, and aliases.
const EXACT_INDEX: Map<string, NFLTeam> = (() => {
  const map = new Map<string, NFLTeam>();
  const put = (key: string, team: NFLTeam) => {
    if (key && !map.has(key)) map.set(key, team);
  };
  NFL_TEAMS.forEach((t) => {
    put(t.id, t);
    put(normalize(t.name), t);
    put(normalize(t.abbreviation), t);
    put(normalize(t.fullName), t);
  });
  // Cities only when unambiguous (New York and Los Angeles have two teams).
  const cityCounts = new Map<string, number>();
  NFL_TEAMS.forEach((t) => cityCounts.set(normalize(t.city), (cityCounts.get(normalize(t.city)) ?? 0) + 1));
  NFL_TEAMS.forEach((t) => {
    if (cityCounts.get(normalize(t.city)) === 1) put(normalize(t.city), t);
  });
  Object.entries(TEAM_ALIASES).forEach(([alias, id]) => {
    const team = NFL_TEAMS.find((t) => t.id === id);
    if (team) put(alias, team);
  });
  return map;
})();

const lookupCache = new Map<string, NFLTeam | null>();

/**
 * Find an NFL team from a free-form team string (sheet value, user edit, etc.).
 *
 * Matching order, first hit wins:
 *  1. Exact match on abbreviation ("CHI", "PHI"), nickname ("Chiefs"), full name, unique city, or alias.
 *  2. Whole-word nickname match ("KC Chiefs", "Buccaneers (2)").
 *  3. A single unambiguous team whose full name starts with / contains the input (min 4 chars).
 *
 * Short strings are never substring-matched, so "CHI" can no longer resolve to the Chiefs
 * and "PHI" can no longer resolve to the Dolphins.
 */
export const findNFLTeam = (teamName?: string | null): NFLTeam | null => {
  if (!teamName) return null;
  const normalized = normalize(teamName);
  if (!normalized) return null;

  const cached = lookupCache.get(normalized);
  if (cached !== undefined) return cached;

  const resolve = (): NFLTeam | null => {
    const exact = EXACT_INDEX.get(normalized);
    if (exact) return exact;

    // Whole-word nickname / alias match
    const words = teamName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const word of words) {
      const team = NFL_TEAMS.find((t) => normalize(t.name) === word) ?? null;
      if (team) return team;
    }
    for (const word of words) {
      if (word.length < 3) continue;
      const aliasId = TEAM_ALIASES[word];
      if (aliasId) return NFL_TEAMS.find((t) => t.id === aliasId) ?? null;
    }

    // Unambiguous prefix/containment against full name (e.g. "Kansas City", "Tampa")
    if (normalized.length >= 4) {
      const candidates = NFL_TEAMS.filter((t) => {
        const full = normalize(t.fullName);
        return full.startsWith(normalized) || full.includes(normalized);
      });
      if (candidates.length === 1) return candidates[0];
    }

    return null;
  };

  const result = resolve();
  lookupCache.set(normalized, result);
  return result;
};

/** Look up a team by its stable id (e.g. "49ers", "chiefs"). */
export const getNFLTeamById = (id?: string | null): NFLTeam | null =>
  (id && NFL_TEAMS.find((t) => t.id === id)) || null;

/**
 * Get all unique teams from player data
 */
export const getUniqueTeamsFromPlayers = (players: { team?: string }[]): NFLTeam[] => {
  const teamNames = new Set<string>();
  players.forEach(p => {
    if (p.team) teamNames.add(p.team);
  });
  
  const teams: NFLTeam[] = [];
  teamNames.forEach(name => {
    const team = findNFLTeam(name);
    if (team && !teams.find(t => t.id === team.id)) {
      teams.push(team);
    }
  });
  
  // Sort by conference then division then name
  return teams.sort((a, b) => {
    if (a.conference !== b.conference) return a.conference.localeCompare(b.conference);
    if (a.division !== b.division) return a.division.localeCompare(b.division);
    return a.name.localeCompare(b.name);
  });
};
