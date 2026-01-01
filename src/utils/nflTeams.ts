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

/**
 * Find an NFL team by matching the team name string from player data
 */
export const findNFLTeam = (teamName?: string): NFLTeam | null => {
  if (!teamName) return null;
  
  const normalized = teamName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  // Direct match
  const directMatch = NFL_TEAMS.find(t => 
    t.id === normalized || 
    t.name.toLowerCase() === normalized ||
    t.abbreviation.toLowerCase() === normalized
  );
  if (directMatch) return directMatch;
  
  // Special cases
  if (normalized === '49ers' || normalized.includes('niners') || normalized.includes('sanfrancisco')) {
    return NFL_TEAMS.find(t => t.id === '49ers') || null;
  }
  
  // Partial match
  for (const team of NFL_TEAMS) {
    if (normalized.includes(team.id) || 
        normalized.includes(team.name.toLowerCase()) ||
        team.fullName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized)) {
      return team;
    }
  }
  
  return null;
};

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
