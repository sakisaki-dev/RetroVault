import { useMemo, type CSSProperties } from 'react';
import type { Player, Position } from '@/types/player';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { leagueScore, playerKey, type GamePlayer } from '@/config/ovr';
import { useGamePool } from '@/utils/useOfficialOvr';

// The official OVR lives in src/config/ovr.ts (shared with the stats pages); re-exported for the games.
export { leagueScore, ovr, playerKey, pyRound, type GamePlayer, type LegendPhoto } from '@/config/ovr';
export { loadExclusions, loadLegends } from '@/utils/useOfficialOvr';

// ---------- Player helpers ----------

export const isLegend = (p: Player): boolean => (p as GamePlayer).isRealLegend === true;

export const DEFENSE_POSITIONS: Position[] = ['LB', 'DB', 'DL'];

export const isDefender = (p: Player) => DEFENSE_POSITIONS.includes(p.position);

export const POSITION_NAMES: Record<Position, string> = {
  QB: 'Quarterback',
  RB: 'Running back',
  WR: 'Wide receiver',
  TE: 'Tight end',
  OL: 'Offensive line',
  LB: 'Linebacker',
  DB: 'Defensive back',
  DL: 'Defensive line',
};

export const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const randomInt = (n: number) => Math.floor(Math.random() * n);

export const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const fmt = (n: number, decimals = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const num = (p: Player, key: string): number => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

/** Stable string hash (same as the original arcade) for generated jersey numbers / helmet stripes. */
export const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

const NUMBER_RANGES: Record<Position, [number, number][]> = {
  QB: [[1, 19]],
  RB: [[20, 49]],
  WR: [[10, 19], [80, 89]],
  TE: [[80, 89]],
  OL: [[60, 79]],
  LB: [[40, 59]],
  DB: [[20, 39]],
  DL: [[90, 99]],
};

/** A believable, stable jersey number generated from the player's name and position. */
export const jerseyNumber = (p: Player) => {
  const ranges = NUMBER_RANGES[p.position] ?? [[1, 99]];
  const h = hash(p.name);
  const [a, b] = ranges[h % ranges.length];
  return a + ((h >>> 3) % (b - a + 1));
};

// ---------- Team colors ----------

const parseHsl = (hsl: string): [number, number, number] | null => {
  const m = hsl.match(/(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  return m ? [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100] : null;
};

/** Relative luminance (0..1) of an "H S% L%" color, used to pick readable text on team colors. */
const hslLuminance = (hsl: string) => {
  const parsed = parseHsl(hsl);
  if (!parsed) return 0;
  const [h, s, l] = parsed;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
};

export interface TeamStyle {
  team: NFLTeam | null;
  /** CSS colors */
  c1: string;
  c2: string;
  text: string;
  abbr: string;
}

const NEUTRAL: TeamStyle = { team: null, c1: 'hsl(222 22% 20%)', c2: 'hsl(222 16% 42%)', text: '#f1f4ff', abbr: 'FA' };
export const MYSTERY_STYLE: TeamStyle = { team: null, c1: '#232c48', c2: '#3a466e', text: '#cfd7f5', abbr: '???' };

export const teamStyle = (teamName?: string): TeamStyle => {
  const team = findNFLTeam(teamName);
  if (!team) return NEUTRAL;
  return {
    team,
    c1: `hsl(${team.primaryColor})`,
    c2: `hsl(${team.secondaryColor})`,
    text: hslLuminance(team.primaryColor) > 0.42 ? '#0b1020' : '#ffffff',
    abbr: team.abbreviation,
  };
};

/** CSS custom properties consumed by .banner / .slot.filled / .tile in arcade.css */
export const teamVars = (s: TeamStyle) => ({ '--c1': s.c1, '--c2': s.c2, '--tx': s.text }) as CSSProperties;

export const teamStyleFor = (team: NFLTeam): TeamStyle => teamStyle(team.fullName);

// ---------- Stat lines ----------

export interface StatItem {
  label: string;
  value: string;
}

/** The headline career stat line for a player's position. */
export const getStatLine = (p: Player): StatItem[] => {
  switch (p.position) {
    case 'QB': {
      const cmpPct = num(p, 'attempts') > 0 ? (num(p, 'completions') / num(p, 'attempts')) * 100 : 0;
      return [
        { label: 'Pass Yds', value: fmt(num(p, 'passYds')) },
        { label: 'Pass TD', value: fmt(num(p, 'passTD')) },
        { label: 'INT', value: fmt(num(p, 'interceptions')) },
        { label: 'Comp %', value: `${fmt(cmpPct, 1)}%` },
        { label: 'Rush Yds', value: fmt(num(p, 'rushYds')) },
      ];
    }
    case 'RB': {
      const ypc = num(p, 'rushAtt') > 0 ? num(p, 'rushYds') / num(p, 'rushAtt') : 0;
      return [
        { label: 'Rush Yds', value: fmt(num(p, 'rushYds')) },
        { label: 'Rush TD', value: fmt(num(p, 'rushTD')) },
        { label: 'Yds/Carry', value: fmt(ypc, 1) },
        { label: 'Rec Yds', value: fmt(num(p, 'recYds')) },
        { label: 'Rec TD', value: fmt(num(p, 'recTD')) },
      ];
    }
    case 'WR':
    case 'TE':
      return [
        { label: 'Receptions', value: fmt(num(p, 'receptions')) },
        { label: 'Rec Yds', value: fmt(num(p, 'recYds')) },
        { label: 'Rec TD', value: fmt(num(p, 'recTD')) },
        { label: 'Longest', value: fmt(num(p, 'longest')) },
      ];
    case 'OL':
      return [{ label: 'Blocks', value: fmt(num(p, 'blocks')) }];
    default:
      return [
        { label: 'Tackles', value: fmt(num(p, 'tackles')) },
        { label: 'Sacks', value: fmt(num(p, 'sacks'), num(p, 'sacks') % 1 ? 1 : 0) },
        { label: 'INT', value: fmt(num(p, 'interceptions')) },
        { label: 'Forced Fum', value: fmt(num(p, 'forcedFumbles')) },
      ];
  }
};

export interface ScoutStat {
  label: string;
  /** null = not recorded for this player (never hidden in the draft, shown as a dash) */
  value: string | null;
}

const opt = (p: Player, key: string, decimals = 0): string | null => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? fmt(v, decimals) : null;
};

const ratio = (a: number, b: number, decimals: number): string | null => (b > 0 ? fmt(a / b, decimals) : null);

/** Full scouting stat line (games first), modelled on the original arcade's stat block. */
export const getScoutLine = (p: Player): ScoutStat[] => {
  const gp: ScoutStat = { label: 'GP', value: opt(p, 'games') };
  switch (p.position) {
    case 'QB':
      return [
        gp,
        { label: 'Pass Yds', value: opt(p, 'passYds') },
        { label: 'Pass TD', value: opt(p, 'passTD') },
        { label: 'INT', value: opt(p, 'interceptions') },
        { label: 'Cmp %', value: num(p, 'attempts') > 0 ? `${fmt((100 * num(p, 'completions')) / num(p, 'attempts'))}%` : null },
        { label: 'Rush Yds', value: opt(p, 'rushYds') },
        { label: 'Rush TD', value: opt(p, 'rushTD') },
      ];
    case 'RB':
      return [
        gp,
        { label: 'Rush Yds', value: opt(p, 'rushYds') },
        { label: 'Rush TD', value: opt(p, 'rushTD') },
        { label: 'YPC', value: ratio(num(p, 'rushYds'), num(p, 'rushAtt'), 1) },
        { label: 'Rec Yds', value: opt(p, 'recYds') },
        { label: 'Rec TD', value: opt(p, 'recTD') },
        { label: 'Fum', value: opt(p, 'fumbles') },
      ];
    case 'WR':
    case 'TE':
      return [
        gp,
        { label: 'Rec', value: opt(p, 'receptions') },
        { label: 'Yds', value: opt(p, 'recYds') },
        { label: 'TD', value: opt(p, 'recTD') },
        { label: 'Avg', value: ratio(num(p, 'recYds'), num(p, 'receptions'), 1) },
        { label: 'Fum', value: opt(p, 'fumbles') },
        { label: 'Long', value: opt(p, 'longest') },
      ];
    case 'OL':
      return [gp, { label: 'Blocks', value: opt(p, 'blocks') }, { label: 'Blk/Gm', value: ratio(num(p, 'blocks'), num(p, 'games'), 2) }];
    default:
      return [
        gp,
        { label: 'Tackles', value: opt(p, 'tackles') },
        { label: 'INT', value: opt(p, 'interceptions') },
        { label: 'Sacks', value: opt(p, 'sacks', num(p, 'sacks') % 1 ? 1 : 0) },
        { label: 'FF', value: opt(p, 'forcedFumbles') },
      ];
  }
};

/** Per-game scouting line: rates only, no games played and no career totals, so career length
 * (the main driver of League Score) stays hidden. Used by the harder 18–0 difficulties. */
export const getRateScoutLine = (p: Player): ScoutStat[] => {
  const g = num(p, 'games');
  const pg = (key: string, decimals = 1): string | null => (g > 0 && opt(p, key) != null ? fmt(num(p, key) / g, decimals) : null);
  switch (p.position) {
    case 'QB':
      return [
        { label: 'Pass Yds/G', value: pg('passYds', 0) },
        { label: 'Pass TD/G', value: pg('passTD', 2) },
        { label: 'INT/G', value: pg('interceptions', 2) },
        { label: 'Cmp %', value: num(p, 'attempts') > 0 ? `${fmt((100 * num(p, 'completions')) / num(p, 'attempts'))}%` : null },
        { label: 'Rush Yds/G', value: pg('rushYds', 1) },
      ];
    case 'RB':
      return [
        { label: 'Rush Yds/G', value: pg('rushYds', 1) },
        { label: 'Rush TD/G', value: pg('rushTD', 2) },
        { label: 'YPC', value: ratio(num(p, 'rushYds'), num(p, 'rushAtt'), 1) },
        { label: 'Rec Yds/G', value: pg('recYds', 1) },
        { label: 'Fum/G', value: pg('fumbles', 2) },
      ];
    case 'WR':
    case 'TE':
      return [
        { label: 'Rec/G', value: pg('receptions', 1) },
        { label: 'Yds/G', value: pg('recYds', 1) },
        { label: 'TD/G', value: pg('recTD', 2) },
        { label: 'Avg', value: ratio(num(p, 'recYds'), num(p, 'receptions'), 1) },
        { label: 'Long', value: opt(p, 'longest') },
      ];
    case 'OL':
      return [{ label: 'Blk/G', value: pg('blocks', 2) }];
    default:
      return [
        { label: 'Tkl/G', value: pg('tackles', 1) },
        { label: 'INT/G', value: pg('interceptions', 2) },
        { label: 'Sacks/G', value: pg('sacks', 2) },
        { label: 'FF/G', value: pg('forcedFumbles', 2) },
      ];
  }
};

export const getAwards = (p: Player): { label: string; value: number }[] => [
  { label: 'Rings', value: p.rings || 0 },
  { label: 'MVP', value: p.mvp || 0 },
  { label: isDefender(p) ? 'DPOY' : 'OPOY', value: p.opoy || 0 },
  { label: 'SB MVP', value: p.sbmvp || 0 },
  { label: 'ROTY', value: p.roty || 0 },
];

// ---------- League Score and OVR: see src/config/ovr.ts ----------

/** League-only metrics. Real NFL players have no in-universe value for these, so they are excluded wherever these are compared. */
export const LEAGUE_ONLY_STATS = new Set(['careerLegacy', 'trueTalent', 'dominance', 'tpg']);

// ---------- Dealing ----------

export type PosFilter = Position | 'DEF' | 'ANY';

export const matchesPos = (pos: PosFilter) => (p: Player) =>
  pos === 'ANY' ? true : pos === 'DEF' ? isDefender(p) : p.position === pos;

/** Ranking key for Blind Rank / Keep-Cut: OVR first, League Score breaks ties (fair across positions). */
export const rankKey = (ovrMap: Map<string, number>) => (p: Player) => (ovrMap.get(playerKey(p)) ?? 0) * 100000 + leagueScore(p);

/** Random `n` players with at most `maxLegends` real NFL players, so the save's own players stay the focus. */
export const sample = <T extends Player>(pool: T[], n: number, maxLegends: number): T[] => {
  const out: T[] = [];
  let legends = 0;
  for (const p of shuffle(pool)) {
    if (isLegend(p)) {
      if (legends >= maxLegends) continue;
      legends++;
    }
    out.push(p);
    if (out.length === n) break;
  }
  return out;
};

/** Deals `n` players (max one real NFL player) whose rank keys are all distinct, or null if the pool is too small. */
export const dealDistinct = <T extends Player>(pool: T[], n: number, key: (p: Player) => number): T[] | null => {
  if (pool.filter((p) => !isLegend(p)).length + Math.min(1, pool.filter(isLegend).length) < n) return null;
  let pick = sample(pool, n, 1);
  for (let t = 0; t < 50 && new Set(pick.map(key)).size !== n; t++) pick = sample(pool, n, 1);
  return pick.length === n ? pick : null;
};

/** Label used once a real NFL player's identity is revealed. */
export const legendLabel = (p: Player) => ((p as GamePlayer).isCurrentNFL ? 'NFL Star' : 'NFL Legend');

// ---------- Stat categories for comparison games ----------

export interface StatCategory {
  key: string;
  /** Phrase used in a question: "more career ___" */
  phrase: string;
  label: string;
  /** Positions that have this stat; undefined = everyone */
  positions?: Player['position'][];
  decimals?: number;
  /** League-only metric: real legends are excluded */
  leagueOnly?: boolean;
  get: (p: Player) => number;
}

const stat = (key: string) => (p: Player) => num(p, key);

export const STAT_CATEGORIES: StatCategory[] = [
  { key: 'careerLegacy', phrase: 'Career Legacy', label: 'Career Legacy', leagueOnly: true, get: stat('careerLegacy') },
  { key: 'trueTalent', phrase: 'True Talent', label: 'True Talent', leagueOnly: true, get: stat('trueTalent') },
  { key: 'dominance', phrase: 'Dominance', label: 'Dominance', leagueOnly: true, get: stat('dominance') },
  { key: 'tpg', phrase: 'Talent Per Game', label: 'TPG', decimals: 2, leagueOnly: true, get: stat('tpg') },
  { key: 'games', phrase: 'career games', label: 'Games', get: stat('games') },
  { key: 'rings', phrase: 'championship rings', label: 'Rings', get: stat('rings') },
  { key: 'passYds', phrase: 'career passing yards', label: 'Pass Yds', positions: ['QB'], get: stat('passYds') },
  { key: 'passTD', phrase: 'career passing TDs', label: 'Pass TD', positions: ['QB'], get: stat('passTD') },
  { key: 'qbInt', phrase: 'career interceptions thrown', label: 'INT', positions: ['QB'], get: stat('interceptions') },
  { key: 'rushYds', phrase: 'career rushing yards', label: 'Rush Yds', positions: ['QB', 'RB'], get: stat('rushYds') },
  { key: 'rushTD', phrase: 'career rushing TDs', label: 'Rush TD', positions: ['QB', 'RB'], get: stat('rushTD') },
  { key: 'recYds', phrase: 'career receiving yards', label: 'Rec Yds', positions: ['RB', 'WR', 'TE'], get: stat('recYds') },
  { key: 'receptions', phrase: 'career receptions', label: 'Receptions', positions: ['RB', 'WR', 'TE'], get: stat('receptions') },
  { key: 'recTD', phrase: 'career receiving TDs', label: 'Rec TD', positions: ['RB', 'WR', 'TE'], get: stat('recTD') },
  { key: 'tackles', phrase: 'career tackles', label: 'Tackles', positions: ['LB', 'DB', 'DL'], get: stat('tackles') },
  { key: 'sacks', phrase: 'career sacks', label: 'Sacks', positions: ['LB', 'DB', 'DL'], get: stat('sacks') },
  { key: 'defInt', phrase: 'career interceptions', label: 'INT', positions: ['LB', 'DB', 'DL'], get: stat('interceptions') },
];

export const playersForCategory = (players: Player[], cat: StatCategory) =>
  players.filter((p) => (!cat.positions || cat.positions.includes(p.position)) && !(cat.leagueOnly && isLegend(p)));

// ---------- Per-browser game records (best streaks etc.) ----------

/** localStorage keys (prefixed with retroVault:games:) shared by the games and the Arcade landing page. */
export const STAT_KEYS = {
  legendBest: 'legend:best',
  holBest: 'hol:best',
  gridBest: 'grid:best',
  rankBest: 'rank:best',
  perfectWins: 'perfect:bestW',
  perfectDifficulty: 'perfect:difficulty',
  perfectLosses: 'perfect:bestL',
  franchise: 'perfect:franchise',
  kcCorrect: 'kc:correct',
  kcRounds: 'kc:rounds',
  includeLegends: 'legends:on',
} as const;

export const loadGameStat = (key: string, fallback = 0): number => {
  try {
    const v = localStorage.getItem(`retroVault:games:${key}`);
    if (v == null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};

export const saveGameStat = (key: string, value: number) => {
  try {
    localStorage.setItem(`retroVault:games:${key}`, String(value));
  } catch {
    // Storage unavailable; keep in-memory only
  }
};

// ---------- Game pool ----------

/**
 * League players from context (minus game-exclusions.json), plus real NFL players when `includeLegends` is on.
 * Real players whose position:name collides with a league player are dropped so keys stay unique.
 * `ovrMap` is the official OVR over the full game pool (legends included even when they are switched
 * off), so every rating matches the stats pages.
 */
export const useGamePlayers = (includeLegends: boolean) => {
  const { league, legends, ovrMap, loaded, dataVersion } = useGamePool();
  const players = useMemo<GamePlayer[]>(() => (includeLegends ? [...league, ...legends] : league), [includeLegends, league, legends]);
  return { players, league, legends, ovrMap, legendsLoaded: loaded, dataVersion };
};
