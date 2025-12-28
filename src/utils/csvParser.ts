import type { 
  LeagueData, 
  QBPlayer, 
  RBPlayer, 
  WRPlayer, 
  TEPlayer, 
  OLPlayer, 
  LBPlayer, 
  DBPlayer, 
  DLPlayer,
  Status,
  Position 
} from '@/types/player';

// Parse numeric value from CSV, handling commas and quotes
const parseNum = (val: string): number => {
  if (!val || val.trim() === '') return 0;
  // Remove quotes and commas, then parse
  const cleaned = val.replace(/["',]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Parse status
const parseStatus = (val: string): Status => {
  const lower = val?.toLowerCase().trim() || '';
  return lower === 'active' ? 'Active' : 'Retired';
};

// Find position sections in the CSV
const findPositionSections = (lines: string[][]): Map<Position, { headerRow: number; dataStart: number; dataEnd: number }> => {
  const sections = new Map<Position, { headerRow: number; dataStart: number; dataEnd: number }>();
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
  
  for (let i = 0; i < lines.length; i++) {
    const firstCell = lines[i][0]?.trim().toUpperCase();
    if (positions.includes(firstCell as Position)) {
      const pos = firstCell as Position;
      // Header is the next row
      const headerRow = i + 1;
      const dataStart = i + 2;
      
      // Find where this section ends (next position marker or empty rows)
      let dataEnd = lines.length;
      for (let j = dataStart; j < lines.length; j++) {
        const cell = lines[j][0]?.trim().toUpperCase();
        if (positions.includes(cell as Position) || (lines[j].every(c => !c?.trim()) && j > dataStart)) {
          dataEnd = j;
          break;
        }
      }
      
      sections.set(pos, { headerRow, dataStart, dataEnd });
    }
  }
  
  return sections;
};

// Parse QB data
const parseQB = (row: string[], headerRow: string[]): QBPlayer | null => {
  const name = row[0]?.trim();
  if (!name) return null;
  
  return {
    position: 'QB',
    name,
    status: parseStatus(row[1]),
    games: parseNum(row[2]),
    attempts: parseNum(row[3]),
    completions: parseNum(row[4]),
    passYds: parseNum(row[5]),
    passTD: parseNum(row[6]),
    interceptions: parseNum(row[7]),
    sacks: parseNum(row[8]),
    rushAtt: parseNum(row[9]),
    rushYds: parseNum(row[10]),
    rushTD: parseNum(row[11]),
    rings: parseNum(row[12]),
    mvp: parseNum(row[13]),
    opoy: parseNum(row[14]),
    sbmvp: parseNum(row[15]),
    roty: parseNum(row[16]),
    trueTalent: parseNum(row[18]),
    dominance: parseNum(row[19]),
    careerLegacy: parseNum(row[20]),
    tpg: parseNum(row[21]),
    nickname: row[23]?.trim() || undefined,
  };
};

// Parse RB data
const parseRB = (row: string[]): RBPlayer | null => {
  const name = row[0]?.trim();
  if (!name) return null;
  
  return {
    position: 'RB',
    name,
    status: parseStatus(row[1]),
    games: parseNum(row[2]),
    rushAtt: parseNum(row[3]),
    rushYds: parseNum(row[4]),
    rushTD: parseNum(row[5]),
    fumbles: parseNum(row[6]),
    receptions: parseNum(row[7]),
    recYds: parseNum(row[8]),
    recTD: parseNum(row[9]),
    rings: parseNum(row[12]),
    mvp: parseNum(row[13]),
    opoy: parseNum(row[14]),
    sbmvp: parseNum(row[15]),
    roty: parseNum(row[16]),
    trueTalent: parseNum(row[18]),
    dominance: parseNum(row[19]),
    careerLegacy: parseNum(row[20]),
    tpg: parseNum(row[21]),
    nickname: row[23]?.trim() || undefined,
  };
};

// Parse WR data
const parseWR = (row: string[]): WRPlayer | null => {
  const name = row[0]?.trim();
  if (!name) return null;
  
  return {
    position: 'WR',
    name,
    status: parseStatus(row[1]),
    games: parseNum(row[2]),
    receptions: parseNum(row[3]),
    recYds: parseNum(row[4]),
    recTD: parseNum(row[5]),
    fumbles: parseNum(row[6]),
    longest: parseNum(row[7]),
    rings: parseNum(row[12]),
    mvp: parseNum(row[13]),
    opoy: parseNum(row[14]),
    sbmvp: parseNum(row[15]),
    roty: parseNum(row[16]),
    trueTalent: parseNum(row[18]),
    dominance: parseNum(row[19]),
    careerLegacy: parseNum(row[20]),
    tpg: parseNum(row[21]),
    nickname: row[23]?.trim() || undefined,
  };
};

// Parse TE data - same structure as WR
const parseTE = (row: string[]): TEPlayer | null => {
  const wr = parseWR(row);
  if (!wr) return null;
  return { ...wr, position: 'TE' } as TEPlayer;
};

// Parse OL data
const parseOL = (row: string[]): OLPlayer | null => {
  const name = row[0]?.trim();
  if (!name) return null;
  
  return {
    position: 'OL',
    name,
    status: parseStatus(row[1]),
    games: parseNum(row[2]),
    blocks: parseNum(row[3]),
    rings: parseNum(row[12]),
    mvp: parseNum(row[13]),
    opoy: parseNum(row[14]),
    sbmvp: parseNum(row[15]),
    roty: parseNum(row[16]),
    trueTalent: parseNum(row[18]),
    dominance: parseNum(row[19]),
    careerLegacy: parseNum(row[20]),
    tpg: parseNum(row[21]),
    nickname: row[23]?.trim() || undefined,
  };
};

// Parse defensive player data (LB, DB, DL)
const parseDefensive = <T extends 'LB' | 'DB' | 'DL'>(row: string[], position: T): (LBPlayer | DBPlayer | DLPlayer) | null => {
  const name = row[0]?.trim();
  if (!name) return null;
  
  return {
    position,
    name,
    status: parseStatus(row[1]),
    games: parseNum(row[2]),
    tackles: parseNum(row[3]),
    interceptions: parseNum(row[4]),
    sacks: parseNum(row[5]),
    forcedFumbles: parseNum(row[6]),
    rings: parseNum(row[12]),
    mvp: parseNum(row[13]),
    opoy: parseNum(row[14]), // DPOY for defense
    sbmvp: parseNum(row[15]),
    roty: parseNum(row[16]),
    trueTalent: parseNum(row[18]),
    dominance: parseNum(row[19]),
    careerLegacy: parseNum(row[20]),
    tpg: parseNum(row[21]),
    nickname: row[23]?.trim() || undefined,
  };
};

// Parse CSV content that may have quoted fields with commas
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
};

export const parseCSV = (csvContent: string): LeagueData => {
  const lines = csvContent.split('\n').map(line => parseCSVLine(line));
  const sections = findPositionSections(lines);
  
  const data: LeagueData = {
    quarterbacks: [],
    runningbacks: [],
    widereceivers: [],
    tightends: [],
    offensiveline: [],
    linebackers: [],
    defensivebacks: [],
    defensiveline: [],
  };
  
  // Parse each section
  const qbSection = sections.get('QB');
  if (qbSection) {
    const headerRow = lines[qbSection.headerRow];
    for (let i = qbSection.dataStart; i < qbSection.dataEnd; i++) {
      const player = parseQB(lines[i], headerRow);
      if (player) data.quarterbacks.push(player);
    }
  }
  
  const rbSection = sections.get('RB');
  if (rbSection) {
    for (let i = rbSection.dataStart; i < rbSection.dataEnd; i++) {
      const player = parseRB(lines[i]);
      if (player) data.runningbacks.push(player);
    }
  }
  
  const wrSection = sections.get('WR');
  if (wrSection) {
    for (let i = wrSection.dataStart; i < wrSection.dataEnd; i++) {
      const player = parseWR(lines[i]);
      if (player) data.widereceivers.push(player);
    }
  }
  
  const teSection = sections.get('TE');
  if (teSection) {
    for (let i = teSection.dataStart; i < teSection.dataEnd; i++) {
      const player = parseTE(lines[i]);
      if (player) data.tightends.push(player);
    }
  }
  
  const olSection = sections.get('OL');
  if (olSection) {
    for (let i = olSection.dataStart; i < olSection.dataEnd; i++) {
      const player = parseOL(lines[i]);
      if (player) data.offensiveline.push(player);
    }
  }
  
  const lbSection = sections.get('LB');
  if (lbSection) {
    for (let i = lbSection.dataStart; i < lbSection.dataEnd; i++) {
      const player = parseDefensive(lines[i], 'LB');
      if (player) data.linebackers.push(player as LBPlayer);
    }
  }
  
  const dbSection = sections.get('DB');
  if (dbSection) {
    for (let i = dbSection.dataStart; i < dbSection.dataEnd; i++) {
      const player = parseDefensive(lines[i], 'DB');
      if (player) data.defensivebacks.push(player as DBPlayer);
    }
  }
  
  const dlSection = sections.get('DL');
  if (dlSection) {
    for (let i = dlSection.dataStart; i < dlSection.dataEnd; i++) {
      const player = parseDefensive(lines[i], 'DL');
      if (player) data.defensiveline.push(player as DLPlayer);
    }
  }
  
  return data;
};

// Calculate stat leaders for a position group
export const calculateLeaders = (players: any[], statKeys: string[]): Map<string, { name: string; value: number }> => {
  const leaders = new Map<string, { name: string; value: number }>();
  
  for (const key of statKeys) {
    let maxPlayer = { name: '', value: -Infinity };
    for (const player of players) {
      const val = player[key];
      if (typeof val === 'number' && val > maxPlayer.value) {
        maxPlayer = { name: player.name, value: val };
      }
    }
    if (maxPlayer.name) {
      leaders.set(key, maxPlayer);
    }
  }
  
  return leaders;
};
