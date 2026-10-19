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
  Position,
} from '@/types/player';
import { withDerivedMetrics } from '@/config/stats';

// ---------- CSV parsing helpers (RFC4180-ish) ----------

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result;
};

const normalizeHeader = (val: string) =>
  (val || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');

type HeaderIndex = Record<string, number[]>;

const buildHeaderIndex = (headerRow: string[]): HeaderIndex => {
  const idx: HeaderIndex = {};
  headerRow.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (!key) return;
    if (!idx[key]) idx[key] = [];
    idx[key].push(i);
  });
  return idx;
};

const getField = (row: string[], header: HeaderIndex, key: string, occurrence = 0): string => {
  const k = normalizeHeader(key);
  const indices = header[k];
  if (!indices || indices.length <= occurrence) return '';
  return (row[indices[occurrence]] ?? '').trim();
};

// Get field by index directly (for metrics that aren't in all headers)
const getByIndex = (row: string[], index: number): string => {
  return (row[index] ?? '').trim();
};

const parseNum = (val: string): number => {
  if (!val || val.trim() === '') return 0;
  const cleaned = val.replace(/["',]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const parseStatus = (val: string): Status => {
  const lower = val?.toLowerCase().trim() || '';
  return lower === 'active' ? 'Active' : 'Retired';
};

const parseText = (val: string): string | undefined => {
  const t = (val || '').trim();
  return t ? t.replace(/^"|"$/g, '').trim() : undefined;
};

// ---------- Section detection ----------

const findPositionSections = (
  lines: string[][],
): Map<Position, { headerRow: number; dataStart: number; dataEnd: number }> => {
  const sections = new Map<Position, { headerRow: number; dataStart: number; dataEnd: number }>();
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];

  for (let i = 0; i < lines.length; i++) {
    const firstCell = (lines[i][0] ?? '').trim().toUpperCase();
    if (!positions.includes(firstCell as Position)) continue;

    const pos = firstCell as Position;
    const headerRow = i + 1;
    const dataStart = i + 2;

    let dataEnd = lines.length;
    for (let j = dataStart; j < lines.length; j++) {
      const cell = (lines[j][0] ?? '').trim().toUpperCase();
      if (positions.includes(cell as Position)) {
        dataEnd = j;
        break;
      }
    }

    sections.set(pos, { headerRow, dataStart, dataEnd });
  }

  return sections;
};

// ---------- Metric columns ----------
// The sheet usually labels the metric columns only in the first (QB) header row; other
// sections leave them blank but keep the data in the same columns. We locate them from
// whichever header row labels them, falling back to the legacy fixed layout.
type MetricColumns = { trueTalent: number; dominance: number; careerLegacy: number; tpg: number; nicknames: number };

const LEGACY_METRIC_COLUMNS: MetricColumns = {
  trueTalent: 20,
  dominance: 21,
  careerLegacy: 22,
  tpg: 23,
  nicknames: 25,
};

const findMetricColumns = (headerRows: string[][]): MetricColumns => {
  const cols = { ...LEGACY_METRIC_COLUMNS };
  const labels: Record<keyof MetricColumns, string[]> = {
    trueTalent: ['truetalent'],
    dominance: ['dominance'],
    careerLegacy: ['careerlegacy'],
    tpg: ['tpg'],
    nicknames: ['nicknames', 'nickname'],
  };
  (Object.keys(labels) as (keyof MetricColumns)[]).forEach((key) => {
    for (const row of headerRows) {
      const idx = row.findIndex((h) => labels[key].includes(normalizeHeader(h)));
      if (idx >= 0) {
        cols[key] = idx;
        return;
      }
    }
  });
  return cols;
};

// ---------- Row parsers ----------

const baseFields = (row: string[], header: HeaderIndex, metricCols: MetricColumns, isDefense = false) => {
  const name = parseText(getField(row, header, 'Name'));
  if (!name) return null;

  const age = parseText(getField(row, header, 'Age'));
  const team = parseText(getField(row, header, 'Team'));
  const status = parseStatus(getField(row, header, 'Status'));

  const metric = (label: string, col: number) => parseNum(getField(row, header, label) || getByIndex(row, col));
  const nickname =
    parseText(getField(row, header, 'Nicknames')) ??
    parseText(getField(row, header, 'Nickname')) ??
    parseText(getByIndex(row, metricCols.nicknames));

  return withDerivedMetrics({
    name,
    age,
    team,
    status,
    games: parseNum(getField(row, header, 'Games')),
    rings: parseNum(getField(row, header, 'Rings')),
    mvp: parseNum(getField(row, header, 'MVP')),
    opoy: parseNum(getField(row, header, 'OPOY')) || parseNum(getField(row, header, 'DPOY')),
    sbmvp: parseNum(getField(row, header, 'SBMVP')),
    roty: parseNum(getField(row, header, 'ROTY')),
    trueTalent: metric('True Talent', metricCols.trueTalent),
    dominance: metric('Dominance', metricCols.dominance),
    careerLegacy: metric('Career Legacy', metricCols.careerLegacy),
    tpg: metric('TPG', metricCols.tpg),
    nickname,
  }, isDefense);
};

const parseQB = (row: string[], header: HeaderIndex, metricCols: MetricColumns): QBPlayer | null => {
  const base = baseFields(row, header, metricCols);
  if (!base) return null;

  const passAttempts = parseNum(getField(row, header, 'Att', 0));
  const rushAttempts = parseNum(getField(row, header, 'Att', 1));

  return {
    position: 'QB',
    ...base,
    attempts: passAttempts,
    completions: parseNum(getField(row, header, 'Cmp')),
    passYds: parseNum(getField(row, header, 'Pass Yds')),
    passTD: parseNum(getField(row, header, 'Pass TD')),
    interceptions: parseNum(getField(row, header, 'INT')),
    sacks: parseNum(getField(row, header, 'Sacks')),
    rushAtt: rushAttempts,
    rushYds: parseNum(getField(row, header, 'Rush Yds')),
    rushTD: parseNum(getField(row, header, 'Rush TD')),
  };
};

const parseRB = (row: string[], header: HeaderIndex, metricCols: MetricColumns): RBPlayer | null => {
  const base = baseFields(row, header, metricCols);
  if (!base) return null;

  return {
    position: 'RB',
    ...base,
    rushAtt: parseNum(getField(row, header, 'Rush Att')),
    rushYds: parseNum(getField(row, header, 'Rush Yds')),
    rushTD: parseNum(getField(row, header, 'Rush TD')),
    fumbles: parseNum(getField(row, header, 'Fum')),
    receptions: parseNum(getField(row, header, 'Rec')),
    recYds: parseNum(getField(row, header, 'Rec Yds')),
    recTD: parseNum(getField(row, header, 'Rec TD')),
  };
};

const parseReceiver = (row: string[], header: HeaderIndex, metricCols: MetricColumns, position: 'WR' | 'TE'): (WRPlayer | TEPlayer) | null => {
  const base = baseFields(row, header, metricCols);
  if (!base) return null;

  const recTD = parseNum(getField(row, header, 'Rec TD')) || parseNum(getField(row, header, 'TDs'));

  return {
    position,
    ...base,
    receptions: parseNum(getField(row, header, 'Rec')),
    recYds: parseNum(getField(row, header, 'Rec Yds')),
    recTD,
    fumbles: parseNum(getField(row, header, 'Fumbles')) || parseNum(getField(row, header, 'Fum')),
    longest: parseNum(getField(row, header, 'Longest')),
  } as WRPlayer | TEPlayer;
};

const parseOL = (row: string[], header: HeaderIndex, metricCols: MetricColumns): OLPlayer | null => {
  const base = baseFields(row, header, metricCols);
  if (!base) return null;

  return {
    position: 'OL',
    ...base,
    blocks: parseNum(getField(row, header, 'Blocks')),
  };
};

const parseDefensive = <T extends 'LB' | 'DB' | 'DL'>(
  row: string[],
  header: HeaderIndex,
  metricCols: MetricColumns,
  position: T,
): (LBPlayer | DBPlayer | DLPlayer) | null => {
  const base = baseFields(row, header, metricCols, true);
  if (!base) return null;

  return {
    position,
    ...base,
    tackles: parseNum(getField(row, header, 'Tackles')),
    interceptions: parseNum(getField(row, header, 'INT')),
    sacks: parseNum(getField(row, header, 'Sacks')),
    forcedFumbles: parseNum(getField(row, header, 'FF')),
  };
};

// ---------- Public API ----------

export const parseCSV = (csvContent: string): LeagueData => {
  const cleaned = (csvContent || '').replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).map((line) => parseCSVLine(line));
  const sections = findPositionSections(lines);
  const metricCols = findMetricColumns([...sections.values()].map((s) => lines[s.headerRow] || []));

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

  const parseSection = <T>(
    pos: Position,
    parser: (row: string[], header: HeaderIndex, metricCols: MetricColumns) => T | null,
    push: (p: T) => void,
  ) => {
    const section = sections.get(pos);
    if (!section) return;

    const headerRow = lines[section.headerRow] || [];
    const header = buildHeaderIndex(headerRow);

    for (let i = section.dataStart; i < section.dataEnd; i++) {
      const row = lines[i] || [];
      const first = (row[0] ?? '').trim();
      if (!first) continue;

      const player = parser(row, header, metricCols);
      if (player) push(player);
    }
  };

  parseSection('QB', parseQB, (p) => data.quarterbacks.push(p));
  parseSection('RB', parseRB, (p) => data.runningbacks.push(p));
  parseSection('WR', (r, h, m) => parseReceiver(r, h, m, 'WR') as WRPlayer, (p) => data.widereceivers.push(p));
  parseSection('TE', (r, h, m) => parseReceiver(r, h, m, 'TE') as TEPlayer, (p) => data.tightends.push(p));
  parseSection('OL', parseOL, (p) => data.offensiveline.push(p));
  parseSection('LB', (r, h, m) => parseDefensive(r, h, m, 'LB') as LBPlayer, (p) => data.linebackers.push(p));
  parseSection('DB', (r, h, m) => parseDefensive(r, h, m, 'DB') as DBPlayer, (p) => data.defensivebacks.push(p));
  parseSection('DL', (r, h, m) => parseDefensive(r, h, m, 'DL') as DLPlayer, (p) => data.defensiveline.push(p));

  return data;
};

export const calculateLeaders = (
  players: ReadonlyArray<{ name: string }>,
  statKeys: string[],
): Map<string, { name: string; value: number }> => {
  const leaders = new Map<string, { name: string; value: number }>();

  for (const key of statKeys) {
    let maxPlayer = { name: '', value: -Infinity };
    for (const player of players) {
      const val = (player as unknown as Record<string, unknown>)[key];
      if (typeof val === 'number' && val > maxPlayer.value) {
        maxPlayer = { name: player.name, value: val };
      }
    }
    if (maxPlayer.name) leaders.set(key, maxPlayer);
  }

  return leaders;
};
