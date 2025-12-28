// NFL team colors for banners
export const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  // AFC East
  bills: { primary: '217 89% 35%', secondary: '0 92% 45%' },
  dolphins: { primary: '173 94% 37%', secondary: '21 100% 54%' },
  patriots: { primary: '221 72% 26%', secondary: '0 77% 41%' },
  jets: { primary: '140 100% 22%', secondary: '0 0% 100%' },
  
  // AFC North
  ravens: { primary: '264 73% 33%', secondary: '45 100% 50%' },
  bengals: { primary: '24 100% 50%', secondary: '0 0% 0%' },
  browns: { primary: '24 76% 35%', secondary: '24 76% 35%' },
  steelers: { primary: '45 100% 50%', secondary: '0 0% 0%' },
  
  // AFC South
  texans: { primary: '217 100% 23%', secondary: '0 100% 48%' },
  colts: { primary: '225 100% 35%', secondary: '0 0% 100%' },
  jaguars: { primary: '175 100% 30%', secondary: '45 100% 50%' },
  titans: { primary: '210 100% 40%', secondary: '0 77% 41%' },
  
  // AFC West
  broncos: { primary: '20 100% 50%', secondary: '217 89% 35%' },
  chiefs: { primary: '0 92% 45%', secondary: '45 100% 50%' },
  raiders: { primary: '0 0% 10%', secondary: '0 0% 75%' },
  chargers: { primary: '206 100% 42%', secondary: '45 100% 50%' },
  
  // NFC East
  cowboys: { primary: '217 89% 35%', secondary: '0 0% 75%' },
  giants: { primary: '217 100% 35%', secondary: '0 77% 41%' },
  eagles: { primary: '167 91% 24%', secondary: '0 0% 0%' },
  commanders: { primary: '345 80% 36%', secondary: '45 100% 50%' },
  
  // NFC North
  bears: { primary: '217 89% 25%', secondary: '24 100% 50%' },
  lions: { primary: '206 100% 42%', secondary: '0 0% 75%' },
  packers: { primary: '100 69% 28%', secondary: '45 100% 50%' },
  vikings: { primary: '264 73% 40%', secondary: '45 100% 50%' },
  
  // NFC South
  falcons: { primary: '0 92% 45%', secondary: '0 0% 0%' },
  panthers: { primary: '200 100% 35%', secondary: '0 0% 0%' },
  saints: { primary: '45 100% 50%', secondary: '0 0% 0%' },
  buccaneers: { primary: '0 77% 41%', secondary: '0 0% 10%' },
  
  // NFC West
  cardinals: { primary: '350 84% 38%', secondary: '0 0% 0%' },
  '49ers': { primary: '350 84% 38%', secondary: '45 80% 50%' },
  seahawks: { primary: '217 89% 25%', secondary: '97 100% 45%' },
  rams: { primary: '217 100% 35%', secondary: '45 100% 50%' },
};

export const getTeamColors = (teamName?: string): { primary: string; secondary: string } | null => {
  if (!teamName) return null;
  
  // Normalize: lowercase, trim, remove all non-alphanumeric
  const normalized = teamName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  // Direct match first
  if (TEAM_COLORS[normalized]) return TEAM_COLORS[normalized];
  
  // Check for '49ers' special case (becomes '49ers' after normalization)
  if (normalized === '49ers' || normalized.includes('49ers') || normalized.includes('niners')) {
    return TEAM_COLORS['49ers'];
  }
  
  // Partial match (e.g., "Buccaneers " -> "buccaneers")
  for (const [key, colors] of Object.entries(TEAM_COLORS)) {
    // Skip numeric keys for partial matching
    if (/^\d/.test(key)) continue;
    if (normalized.includes(key) || key.includes(normalized)) {
      return colors;
    }
  }
  
  return null;
};

export const getTeamGradient = (teamName?: string): string | null => {
  const colors = getTeamColors(teamName);
  if (!colors) return null;
  
  return `linear-gradient(135deg, hsl(${colors.primary}) 0%, hsl(${colors.secondary}) 100%)`;
};

export const getTeamBorderColor = (teamName?: string): string | null => {
  const colors = getTeamColors(teamName);
  if (!colors) return null;
  
  return `hsl(${colors.primary})`;
};
