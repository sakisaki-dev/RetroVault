import type { DBPlayer, DLPlayer, LBPlayer, LeagueData, Player } from '@/types/player';

// Pure record-book logic for the Stats hub (no React). Career records only; there are no single-season boards.

// ---------- Minimum samples ----------
// Rate records only count players with a real sample. Thresholds are inclusive (>=) and are printed on
// every rate board as "min ...".
export const MIN = {
  qbAttempts: 200,
  rbCarries: 100,
  receptions: 50,
  games: 16,
  defGames: 32,
} as const;

/** Pace tracker: only flag players who could pass the record within this many 16-game seasons. */
export const PACE_MAX_SEASONS = 5;

export type GroupKey = 'qb' | 'rb' | 'wr' | 'te' | 'ol' | 'def' | 'awards';

export const GROUP_ORDER: GroupKey[] = ['qb', 'rb', 'wr', 'te', 'ol', 'def', 'awards'];

export const GROUP_META: Record<GroupKey, { label: string; hsl: string }> = {
  qb: { label: 'Quarterbacks', hsl: 'var(--chart-1)' },
  rb: { label: 'Running Backs', hsl: 'var(--chart-2)' },
  wr: { label: 'Wide Receivers', hsl: 'var(--chart-4)' },
  te: { label: 'Tight Ends', hsl: 'var(--chart-3)' },
  ol: { label: 'Offensive Line', hsl: 'var(--chalk)' },
  def: { label: 'Defense', hsl: 'var(--flag)' },
  awards: { label: 'Accolades & Metrics', hsl: 'var(--gold)' },
};

export interface RecordEntry {
  player: Player;
  value: number;
}

export interface RecordBoardData {
  id: string;
  group: GroupKey;
  title: string;
  /** Short switcher label, e.g. "Y/A" */
  short: string;
  /** e.g. "min 200 att"; present on every rate record */
  minLabel?: string;
  decimals: number;
  /** Board mixes positions, so show the position badge on each row */
  mixed?: boolean;
  entries: RecordEntry[];
}

export interface PaceEntry {
  player: Player;
  recordName: string;
  currentValue: number;
  recordValue: number;
  recordHolder: Player;
  seasonsToBreak: number;
  pacePerSeason: number;
  percentToRecord: number;
}

export interface RecordBook {
  boards: Map<string, RecordBoardData>;
  pace: PaceEntry[];
  playerCount: number;
}

export const keyOf = (p: Pick<Player, 'position' | 'name'>) => `${p.position}:${p.name}`;

/** Builds a top-N board from eligible players with a positive, finite value (ties broken by name). */
export function board<T extends Player>(
  players: T[],
  spec: {
    id: string;
    group: GroupKey;
    title: string;
    short?: string;
    get: (p: NoInfer<T>) => number;
    decimals?: number;
    min?: { label: string; ok: (p: NoInfer<T>) => boolean };
    mixed?: boolean;
  },
  n = 5,
): RecordBoardData | null {
  const entries = players
    .filter((p) => !spec.min || spec.min.ok(p))
    .map((p) => ({ player: p as Player, value: spec.get(p) }))
    .filter((e) => Number.isFinite(e.value) && e.value > 0)
    .sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name))
    .slice(0, n);
  if (entries.length === 0) return null;
  return {
    id: spec.id,
    group: spec.group,
    title: spec.title,
    short: spec.short ?? spec.title,
    minLabel: spec.min?.label,
    decimals: spec.decimals ?? 0,
    mixed: spec.mixed,
    entries,
  };
}

/** Headline career records shown as the hero cards. */
export const HEADLINE_IDS = ['qbPassYds', 'qbPassTD', 'rbRushYds', 'wrRecYds', 'wrRecTD', 'defSacks', 'defINT', 'rings', 'legacy'];
/** Rate-stat leaders (each carries its minimum-sample label). */
export const LEADER_IDS = ['qbYPA', 'qbTDINT', 'qbCmpPct', 'rbYPC', 'rbScrimYPG', 'wrYPR', 'wrRecYPG', 'defSPG', 'defTOPG'];

const EMPTY: RecordBook = { boards: new Map(), pace: [], playerCount: 0 };

/** `depth` = entries kept per board (the Stats page's bar races show 10; Deep Dive ranks only use the top 5). */
export function buildRecordBook(data: LeagueData | null | undefined, depth = 5): RecordBook {
  if (!data) return EMPTY;

  const qbs = data.quarterbacks;
  const rbs = data.runningbacks;
  const wrs = data.widereceivers;
  const tes = data.tightends;
  const ols = data.offensiveline;
  const defs: (LBPlayer | DBPlayer | DLPlayer)[] = [...data.linebackers, ...data.defensivebacks, ...data.defensiveline];
  const offense: Player[] = [...qbs, ...rbs, ...wrs, ...tes, ...ols];
  const all: Player[] = [...offense, ...defs];

  const minAtt = { label: `min ${MIN.qbAttempts} att`, ok: (p: { attempts: number }) => p.attempts >= MIN.qbAttempts };
  const minCar = { label: `min ${MIN.rbCarries} car`, ok: (p: { rushAtt: number }) => p.rushAtt >= MIN.rbCarries };
  const minRec = { label: `min ${MIN.receptions} rec`, ok: (p: { receptions: number }) => p.receptions >= MIN.receptions };
  const minGames = { label: `min ${MIN.games} games`, ok: (p: Player) => p.games >= MIN.games };
  const minDefGames = { label: `min ${MIN.defGames} games`, ok: (p: Player) => p.games >= MIN.defGames };

  const list = [
    // Quarterbacks
    board(qbs, { id: 'qbPassYds', group: 'qb', title: 'Passing Yards', short: 'Pass Yds', get: (p) => p.passYds }, depth),
    board(qbs, { id: 'qbPassTD', group: 'qb', title: 'Passing TDs', short: 'Pass TD', get: (p) => p.passTD }, depth),
    board(qbs, { id: 'qbTotalYds', group: 'qb', title: 'Total Yards', short: 'Total Yds', get: (p) => p.passYds + p.rushYds }, depth),
    board(qbs, { id: 'qbTotalTD', group: 'qb', title: 'Total TDs', short: 'Total TD', get: (p) => p.passTD + p.rushTD }, depth),
    board(qbs, { id: 'qbCmpPct', group: 'qb', title: 'Completion %', short: 'Cmp %', get: (p) => (p.completions / p.attempts) * 100, decimals: 1, min: minAtt }, depth),
    board(qbs, { id: 'qbYPA', group: 'qb', title: 'Yards / Attempt', short: 'Y/A', get: (p) => p.passYds / p.attempts, decimals: 2, min: minAtt }, depth),
    board(qbs, {
      id: 'qbTDINT',
      group: 'qb',
      title: 'TD : INT Ratio',
      short: 'TD:INT',
      get: (p) => p.passTD / p.interceptions,
      decimals: 2,
      // A QB with zero INTs has no ratio; require at least one plus the attempts minimum.
      min: { label: `min ${MIN.qbAttempts} att, 1+ INT`, ok: (p) => p.attempts >= MIN.qbAttempts && p.interceptions >= 1 },
    }, depth),
    // Running backs
    board(rbs, { id: 'rbRushYds', group: 'rb', title: 'Rushing Yards', short: 'Rush Yds', get: (p) => p.rushYds }, depth),
    board(rbs, { id: 'rbRushTD', group: 'rb', title: 'Rushing TDs', short: 'Rush TD', get: (p) => p.rushTD }, depth),
    board(rbs, { id: 'rbScrimmage', group: 'rb', title: 'Scrimmage Yards', short: 'Scrim Yds', get: (p) => p.rushYds + p.recYds }, depth),
    board(rbs, { id: 'rbYPC', group: 'rb', title: 'Yards / Carry', short: 'Y/C', get: (p) => p.rushYds / p.rushAtt, decimals: 2, min: minCar }, depth),
    board(rbs, { id: 'rbScrimYPG', group: 'rb', title: 'Scrimmage Yds / Game', short: 'Scrim/G', get: (p) => (p.rushYds + p.recYds) / p.games, decimals: 1, min: minGames }, depth),
    // Wide receivers
    board(wrs, { id: 'wrRecYds', group: 'wr', title: 'Receiving Yards', short: 'Rec Yds', get: (p) => p.recYds }, depth),
    board(wrs, { id: 'wrRecTD', group: 'wr', title: 'Receiving TDs', short: 'Rec TD', get: (p) => p.recTD }, depth),
    board(wrs, { id: 'wrReceptions', group: 'wr', title: 'Receptions', short: 'Rec', get: (p) => p.receptions }, depth),
    board(wrs, { id: 'wrYPR', group: 'wr', title: 'Yards / Catch', short: 'Y/R', get: (p) => p.recYds / p.receptions, decimals: 2, min: minRec }, depth),
    board(wrs, { id: 'wrRecYPG', group: 'wr', title: 'Rec Yds / Game', short: 'Yds/G', get: (p) => p.recYds / p.games, decimals: 1, min: minGames }, depth),
    board(wrs, { id: 'wrTD16', group: 'wr', title: 'TDs / 16 Games', short: 'TD/16', get: (p) => (p.recTD / p.games) * 16, decimals: 1, min: minGames }, depth),
    // Tight ends
    board(tes, { id: 'teRecYds', group: 'te', title: 'Receiving Yards', short: 'Rec Yds', get: (p) => p.recYds }, depth),
    board(tes, { id: 'teRecTD', group: 'te', title: 'Receiving TDs', short: 'Rec TD', get: (p) => p.recTD }, depth),
    board(tes, { id: 'teReceptions', group: 'te', title: 'Receptions', short: 'Rec', get: (p) => p.receptions }, depth),
    board(tes, { id: 'teYPR', group: 'te', title: 'Yards / Catch', short: 'Y/R', get: (p) => p.recYds / p.receptions, decimals: 2, min: minRec }, depth),
    // Offensive line
    board(ols, { id: 'olBlocks', group: 'ol', title: 'Blocks', short: 'Blocks', get: (p) => p.blocks }, depth),
    board(ols, { id: 'olBPG', group: 'ol', title: 'Blocks / Game', short: 'Blk/G', get: (p) => p.blocks / p.games, decimals: 2, min: minGames }, depth),
    board(ols, { id: 'olGames', group: 'ol', title: 'Games Played', short: 'Games', get: (p) => p.games }, depth),
    // Defense
    board(defs, { id: 'defTackles', group: 'def', title: 'Tackles', short: 'Tackles', get: (p) => p.tackles, mixed: true }, depth),
    board(defs, { id: 'defSacks', group: 'def', title: 'Sacks', short: 'Sacks', get: (p) => p.sacks, mixed: true }, depth),
    board(defs, { id: 'defINT', group: 'def', title: 'Interceptions', short: 'INT', get: (p) => p.interceptions, mixed: true }, depth),
    board(defs, { id: 'defFF', group: 'def', title: 'Forced Fumbles', short: 'FF', get: (p) => p.forcedFumbles, mixed: true }, depth),
    board(defs, { id: 'defTurnovers', group: 'def', title: 'Takeaways (INT + FF)', short: 'Takeaways', get: (p) => p.interceptions + p.forcedFumbles, mixed: true }, depth),
    board(defs, { id: 'defTPG', group: 'def', title: 'Tackles / Game', short: 'Tkl/G', get: (p) => p.tackles / p.games, decimals: 2, min: minDefGames, mixed: true }, depth),
    board(defs, { id: 'defSPG', group: 'def', title: 'Sacks / Game', short: 'Sck/G', get: (p) => p.sacks / p.games, decimals: 2, min: minDefGames, mixed: true }, depth),
    board(defs, { id: 'defTOPG', group: 'def', title: 'Takeaways / Game', short: 'TkA/G', get: (p) => (p.interceptions + p.forcedFumbles) / p.games, decimals: 2, min: minDefGames, mixed: true }, depth),
    // Accolades + metrics
    board(all, { id: 'rings', group: 'awards', title: 'Championships', short: 'Rings', get: (p) => p.rings, mixed: true }, depth),
    board(all, { id: 'mvp', group: 'awards', title: 'MVP Awards', short: 'MVP', get: (p) => p.mvp, mixed: true }, depth),
    board(offense, { id: 'opoy', group: 'awards', title: 'OPOY Awards', short: 'OPOY', get: (p) => p.opoy, mixed: true }, depth),
    // Defensive players store DPOY in the opoy column.
    board(defs, { id: 'dpoy', group: 'awards', title: 'DPOY Awards', short: 'DPOY', get: (p) => p.opoy, mixed: true }, depth),
    board(all, { id: 'sbmvp', group: 'awards', title: 'Super Bowl MVPs', short: 'SB MVP', get: (p) => p.sbmvp, mixed: true }, depth),
    board(all, { id: 'roty', group: 'awards', title: 'Rookie of the Year', short: 'ROTY', get: (p) => p.roty, mixed: true }, depth),
    board(all, { id: 'legacy', group: 'awards', title: 'Career Legacy', short: 'Legacy', get: (p) => p.careerLegacy, mixed: true }, depth),
    board(all, { id: 'dominance', group: 'awards', title: 'Dominance', short: 'Dom', get: (p) => p.dominance, decimals: 1, mixed: true }, depth),
    board(all, { id: 'trueTalent', group: 'awards', title: 'True Talent', short: 'Talent', get: (p) => p.trueTalent, decimals: 1, mixed: true }, depth),
  ];
  const boards = new Map(list.filter((b): b is RecordBoardData => !!b).map((b) => [b.id, b]));

  return { boards, pace: buildPace({ qbs, rbs, wrs, defs }), playerCount: all.length };
}

/**
 * Pace: players (min games) on track to pass a career record within PACE_MAX_SEASONS 16-game seasons.
 * Internal only: the (unreliable, never displayed) status flag is the sole signal of who can still add stats.
 */
function buildPace({ qbs, rbs, wrs, defs }: { qbs: Player[]; rbs: Player[]; wrs: Player[]; defs: Player[] }): PaceEntry[] {
  const specs: { name: string; players: Player[]; get: (p: Player) => number }[] = [
    { name: 'Career Passing Yards', players: qbs, get: (p) => (p.position === 'QB' ? p.passYds : 0) },
    { name: 'Career Passing TDs', players: qbs, get: (p) => (p.position === 'QB' ? p.passTD : 0) },
    { name: 'Career Rushing Yards', players: rbs, get: (p) => (p.position === 'RB' ? p.rushYds : 0) },
    { name: 'Career Receiving Yards', players: wrs, get: (p) => (p.position === 'WR' ? p.recYds : 0) },
    { name: 'Career Sacks', players: defs, get: (p) => ('sacks' in p && p.position !== 'QB' ? p.sacks : 0) },
  ];
  const pace: PaceEntry[] = [];
  specs.forEach(({ name, players, get }) => {
    if (players.length === 0) return;
    const holder = players.reduce((best, p) => (get(p) > get(best) ? p : best), players[0]);
    const recordValue = get(holder);
    if (recordValue <= 0) return;
    players
      .filter((p) => p.status === 'Active' && p.games >= MIN.games && p !== holder)
      .forEach((p) => {
        const current = get(p);
        const perSeason = (current / p.games) * 16;
        if (perSeason <= 0 || current >= recordValue) return;
        const seasonsToBreak = Math.ceil((recordValue - current) / perSeason);
        if (seasonsToBreak > PACE_MAX_SEASONS) return;
        pace.push({
          player: p,
          recordName: name,
          currentValue: current,
          recordValue,
          recordHolder: holder,
          seasonsToBreak,
          pacePerSeason: perSeason,
          percentToRecord: (current / recordValue) * 100,
        });
      });
  });
  return pace.sort((a, b) => a.seasonsToBreak - b.seasonsToBreak || b.percentToRecord - a.percentToRecord);
}

/** Boards for one position group, in definition order. */
export const boardsForGroup = (boards: Map<string, RecordBoardData>, group: GroupKey) =>
  [...boards.values()].filter((b) => b.group === group);

/** Picks boards by id, skipping any that have no qualifying players. */
export const pickBoards = (boards: Map<string, RecordBoardData>, ids: string[]) =>
  ids.map((id) => boards.get(id)).filter((b): b is RecordBoardData => !!b);

// ---------- Balanced grids ----------

/** Columns that split n items into rows as evenly as possible, never more than max. */
export const balancedCols = (n: number, max: number) => (n <= max ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / max)));
