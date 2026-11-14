import { useEffect, useState } from 'react';
import { findNFLTeam } from './nflTeams';
import { stadiumWeather } from './stadiumWeather';
import type { CoachGame, CoachGameBrief, ScheduleSeason, TableRow } from './schedule';

/**
 * The Season page's model of the live save state (public/data/league/save_state.json, scripts/save_state.py): typed views of the season lines, the coach's game log and the club records, plus the
 * rules over it the page shows: league leaders, standings and the game's season rating (docs/GAME_MECHANICS.md
 * "Season ratings and awards") projected from the season so far, slotted the game's way (one award per player).
 * Facts only: never morale, height or weight, never the game's own Hall of Fame fields (CLAUDE.md, Save import).
 */

/** The season so far, in Retro Vault career keys (players.json). Missing keys are 0. */
export type SeasonLine = Partial<
  Record<'g' | 'att' | 'cmp' | 'yds' | 'td' | 'int' | 'sck' | 'ratt' | 'ryds' | 'rtd' | 'fum' | 'rec' | 'recyds' | 'rectd' | 'blk' | 'tkl' | 'ff', number>
>;

export interface LivePlayer {
  team: string;
  age: number;
  injury_week: number;
  season: SeasonLine;
}

export interface LiveClub {
  abbr: string;
  w: number;
  l: number;
  t: number;
  off: number;
  def: number;
  /** Stadium weather from the save: rainfall and snowfall figures, roof 0 open air (1 and 2 covered) */
  rainfall?: number;
  snowfall?: number;
  roof?: number;
}

/** One of the coach's seasons (the save's history.list): regular season and playoff record, finish as the game shows it. */
export interface CoachSeason {
  year: number;
  team: string;
  abbr: string;
  w: number;
  l: number;
  t: number;
  /** Playoff wins / losses */
  pw: number;
  pl: number;
  finish: string;
}

export interface LiveGame {
  week: number;
  /** Opponent TLA */
  opp: string;
  home: boolean;
  for?: number;
  against?: number;
  result?: 'W' | 'L' | 'T';
}

export interface LiveSeason {
  id: string;
  /** The upload bundle that wrote it: "<YYYY-MM-DD>-save-y93w16" */
  upload: string;
  season: number;
  /** The next week to play (16 = weeks 1 to 15 played) */
  week: number;
  club: string;
  clubs: Record<string, LiveClub>;
  coachGames: LiveGame[];
  /** The coach's completed seasons, oldest first (older imports may not have it) */
  coachHistory?: CoachSeason[];
  /** Every league game of the season: club names, the score once played */
  leagueGames?: { week: number; home: string; away: string; hs?: number; as?: number }[];
  players: Record<string, LivePlayer>;
  newPlayers: Record<string, LivePlayer>;
}

let cache: LiveSeason | null | undefined;
let request: Promise<LiveSeason | null> | null = null;

/** Fetches save_state.json once per page load; null when no save has been imported (no file). */
export const loadLiveSeason = (): Promise<LiveSeason | null> => {
  request ??= fetch(`${import.meta.env.BASE_URL}data/league/save_state.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<LiveSeason>) : null))
    .catch(() => null)
    .then((s) => (cache = s && s.clubs && s.players && Array.isArray(s.coachGames) ? { ...s, newPlayers: s.newPlayers ?? {} } : null));
  return request;
};

/** undefined while loading, null when no save has been imported, else the live season. */
export const useLiveSeason = (): LiveSeason | null | undefined => {
  const [data, setData] = useState<LiveSeason | null | undefined>(cache);
  useEffect(() => {
    if (cache !== undefined) return;
    let alive = true;
    loadLiveSeason().then((s) => alive && setData(s));
    return () => {
      alive = false;
    };
  }, []);
  return data;
};

/** Regular-season weeks in the game (18 weeks, one bye). */
export const SEASON_WEEKS = 18;
/** Rookies enter the league at 21 (docs/GAME_MECHANICS.md, Retirement). */
export const ROOKIE_AGE = 21;

/** The save's date, from its upload bundle id ("2026-11-13-save-…"). */
export const saveDate = (s: LiveSeason): Date | null => {
  const m = s.upload.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** One row per player in the save: card players and the new ones (no card yet). */
export interface SeasonEntry extends LivePlayer {
  key: string;
  pos: string;
  name: string;
  /** Has a Retro Vault card (a key in players.json) */
  carded: boolean;
}

export const seasonEntries = (s: LiveSeason): SeasonEntry[] => {
  const out: SeasonEntry[] = [];
  const add = (rec: Record<string, LivePlayer>, carded: boolean) =>
    Object.entries(rec ?? {}).forEach(([key, p]) => {
      const i = key.indexOf(':');
      out.push({ ...p, season: p.season ?? {}, key, pos: key.slice(0, i), name: key.slice(i + 1), carded });
    });
  add(s.players, true);
  add(s.newPlayers, false);
  return out;
};

const v = (l: SeasonLine, k: keyof SeasonLine) => l[k] ?? 0;
export const clubGames = (c: LiveClub | undefined) => (c ? c.w + c.l + c.t : 0);

// ---------- League leaders ----------

export interface LeaderBoard {
  id: string;
  label: string;
  short: string;
  side: 'offense' | 'defense';
  rows: Array<{ entry: SeasonEntry; value: number }>;
}

const DEFENSE = new Set(['LB', 'DB', 'DL']);
const SKILL = new Set(['RB', 'WR', 'TE']);

/** Receiving for a back lives in recyds / rectd; for a WR or TE in yds / td (docs/GAME_MECHANICS.md, Save format). */
const recYds = (e: SeasonEntry) => (e.pos === 'RB' ? v(e.season, 'recyds') : e.pos === 'WR' || e.pos === 'TE' ? v(e.season, 'yds') : 0);
const recTd = (e: SeasonEntry) => (e.pos === 'RB' ? v(e.season, 'rectd') : e.pos === 'WR' || e.pos === 'TE' ? v(e.season, 'td') : 0);

const LEADER_DEFS: Array<{ id: string; label: string; short: string; side: 'offense' | 'defense'; of: (e: SeasonEntry) => number }> = [
  { id: 'pass-yds', label: 'Passing yards', short: 'YDS', side: 'offense', of: (e) => (e.pos === 'QB' ? v(e.season, 'yds') : 0) },
  { id: 'pass-td', label: 'Passing TDs', short: 'TD', side: 'offense', of: (e) => (e.pos === 'QB' ? v(e.season, 'td') : 0) },
  { id: 'rush-yds', label: 'Rushing yards', short: 'YDS', side: 'offense', of: (e) => v(e.season, 'ryds') },
  { id: 'rush-td', label: 'Rushing TDs', short: 'TD', side: 'offense', of: (e) => v(e.season, 'rtd') },
  { id: 'rec-yds', label: 'Receiving yards', short: 'YDS', side: 'offense', of: recYds },
  { id: 'rec-td', label: 'Receiving TDs', short: 'TD', side: 'offense', of: recTd },
  { id: 'tkl', label: 'Tackles', short: 'TKL', side: 'defense', of: (e) => (DEFENSE.has(e.pos) ? v(e.season, 'tkl') : 0) },
  { id: 'sck', label: 'Sacks', short: 'SCK', side: 'defense', of: (e) => (DEFENSE.has(e.pos) ? v(e.season, 'sck') : 0) },
  { id: 'int', label: 'Interceptions', short: 'INT', side: 'defense', of: (e) => (DEFENSE.has(e.pos) ? v(e.season, 'int') : 0) },
];

/** Top `n` per category (ties by name), players with a positive value only. Yards round half to even like the game. */
export const leaderBoards = (entries: SeasonEntry[], n = 5): LeaderBoard[] =>
  LEADER_DEFS.map((d) => ({
    id: d.id,
    label: d.label,
    short: d.short,
    side: d.side,
    rows: entries
      .map((entry) => ({ entry, value: Math.round(d.of(entry)) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value || a.entry.name.localeCompare(b.entry.name))
      .slice(0, n),
  }));

// ---------- The game's season rating ----------

export interface RatingPart {
  label: string;
  /** Signed points */
  value: number;
  /** The yardage part before the cap */
  raw?: number;
  detail: string;
}

export interface SeasonRating {
  entry: SeasonEntry;
  side: 'offense' | 'defense';
  total: number;
  parts: RatingPart[];
}

/** Yardage divisor per position: the yardage part reaches 100 at this many (receiving + 1.35 × rushing) yards. */
export const YARD_DIVISOR: Record<string, number> = { QB: 3300, RB: 1750, TE: 1350, WR: 2100 };
export const YARD_CAP = 150;

const r1 = (x: number) => Math.round(x * 10) / 10;
const n0 = (x: number) => Math.round(x).toLocaleString('en-US');

/** docs/GAME_MECHANICS.md "Season ratings and awards", from a season line. Linemen (and kickers): null. */
export const seasonRating = (e: SeasonEntry): SeasonRating | null => {
  const s = e.season;
  const done = (side: 'offense' | 'defense', parts: RatingPart[]): SeasonRating => ({
    entry: e,
    side,
    total: r1(parts.reduce((t, p) => t + p.value, 0)),
    parts: parts.map((p) => ({ ...p, value: r1(p.value), raw: p.raw === undefined ? undefined : r1(p.raw) })),
  });
  if (e.pos === 'QB' || SKILL.has(e.pos)) {
    const main = e.pos === 'QB' ? v(s, 'yds') : recYds(e);
    const rush = v(s, 'ryds');
    const raw = ((main + 1.35 * rush) / YARD_DIVISOR[e.pos]) * 100;
    const parts: RatingPart[] = [
      {
        label: 'Yardage',
        value: Math.min(YARD_CAP, raw),
        raw,
        detail: `(${n0(main)} ${e.pos === 'QB' ? 'passing' : 'receiving'} + 1.35 × ${n0(rush)} rushing) ÷ ${YARD_DIVISOR[e.pos].toLocaleString('en-US')} × 100${raw > YARD_CAP ? `, capped at ${YARD_CAP}` : ''}`,
      },
    ];
    if (e.pos === 'QB') {
      parts.push({ label: 'TD bonus', value: v(s, 'td'), detail: `${v(s, 'td')} passing TDs, +1 each` });
      parts.push({ label: 'INTs', value: -v(s, 'int'), detail: `${v(s, 'int')} thrown, −1 each` });
      parts.push({ label: 'Sacks', value: -0.5 * v(s, 'sck'), detail: `${v(s, 'sck')} taken, −0.5 each` });
    } else {
      const td = recTd(e);
      parts.push({ label: 'TD bonus', value: 1.25 * td, detail: `${td} receiving TDs, +1.25 each (rushing TDs add nothing)` });
      parts.push({ label: 'Fumbles', value: -5 * v(s, 'fum'), detail: `${v(s, 'fum')} fumbles, −5 each` });
    }
    return done('offense', parts);
  }
  if (DEFENSE.has(e.pos)) {
    return done('defense', [
      { label: 'Tackles', value: 0.5 * v(s, 'tkl'), detail: `${v(s, 'tkl')} tackles, +0.5 each` },
      { label: 'INTs', value: 3 * v(s, 'int'), detail: `${v(s, 'int')} interceptions, +3 each` },
      { label: 'Sacks', value: 3 * v(s, 'sck'), detail: `${v(s, 'sck')} sacks, +3 each` },
      { label: 'Forced fumbles', value: 3 * v(s, 'ff'), detail: `${v(s, 'ff')} fumbles, +3 each` },
    ]);
  }
  return null;
};

export type AwardId = 'mvp' | 'opoy' | 'dpoy' | 'oroy' | 'droy';

export interface AwardRace {
  id: AwardId;
  label: string;
  short: string;
  rule: string;
  rows: SeasonRating[];
}

/**
 * The award races, projected: every eligible player rated from his season so far, then slotted the game's way. MVP
 * the best offensive rating (QB, RB, WR, TE); OPOY the best skill player (never a QB) other than the MVP; DPOY the
 * best defender; rookies (age 21) only the rookie awards (the NFL edition has an offensive and a defensive one).
 * Eligible: at least half his club's games so far (the game has a minimum; its number isn't known).
 */
export const awardRaces = (s: LiveSeason, entries: SeasonEntry[], n = 5): AwardRace[] => {
  const minGames = (club: string) => Math.max(1, Math.ceil(clubGames(s.clubs[club]) / 2));
  const rated = entries
    .filter((e) => v(e.season, 'g') >= minGames(e.team))
    .map(seasonRating)
    .filter((r): r is SeasonRating => !!r)
    .sort((a, b) => b.total - a.total || a.entry.name.localeCompare(b.entry.name));
  const rookie = (r: SeasonRating) => r.entry.age <= ROOKIE_AGE;
  const vets = rated.filter((r) => !rookie(r));
  const mvp = vets.filter((r) => r.side === 'offense');
  const mvpKey = mvp[0]?.entry.key;
  return [
    { id: 'mvp', label: 'Most Valuable Player', short: 'MVP', rule: 'The best offensive rating, QB or skill player', rows: mvp.slice(0, n) },
    {
      id: 'opoy',
      label: 'Offensive Player of the Year',
      short: 'OPOY',
      rule: 'The best skill player other than the MVP; a QB can never win it',
      rows: vets.filter((r) => r.side === 'offense' && SKILL.has(r.entry.pos) && r.entry.key !== mvpKey).slice(0, n),
    },
    { id: 'dpoy', label: 'Defensive Player of the Year', short: 'DPOY', rule: 'The best defensive rating', rows: vets.filter((r) => r.side === 'defense').slice(0, n) },
    {
      id: 'oroy',
      label: 'Offensive Rookie of the Year',
      short: 'OROY',
      rule: 'The best offensive rating among 21-year-olds',
      rows: rated.filter((r) => rookie(r) && r.side === 'offense').slice(0, n),
    },
    {
      id: 'droy',
      label: 'Defensive Rookie of the Year',
      short: 'DROY',
      rule: 'The best defensive rating among 21-year-olds',
      rows: rated.filter((r) => rookie(r) && r.side === 'defense').slice(0, n),
    },
  ];
};

// ---------- Standings ----------

export interface StandingRow {
  club: string;
  c: LiveClub;
  pct: number;
  conference: string;
  division: string;
}

export const winPct = (c: LiveClub) => {
  const g = clubGames(c);
  return g ? (c.w + c.t / 2) / g : 0;
};

const byRecord = (a: StandingRow, b: StandingRow) => b.pct - a.pct || b.c.w - a.c.w || a.c.l - b.c.l || a.club.localeCompare(b.club);

/** Every club, best record first (ties by wins, then fewest losses, then name: the save has no tiebreakers). */
export const standingRows = (s: LiveSeason): StandingRow[] =>
  Object.entries(s.clubs)
    .map(([club, c]) => {
      const nfl = findNFLTeam(club);
      return { club, c, pct: winPct(c), conference: nfl?.conference ?? '', division: nfl?.division ?? '' };
    })
    .sort(byRecord);

export interface DivisionTable {
  conference: string;
  division: string;
  rows: StandingRow[];
}

/** Divisions in NFL order, each by record; null when a club has no known division (then a ranked table instead). */
export const divisions = (rows: StandingRow[]): DivisionTable[] | null => {
  if (!rows.length || rows.some((r) => !r.conference || !r.division)) return null;
  const out: DivisionTable[] = [];
  for (const conference of ['AFC', 'NFC'])
    for (const division of ['East', 'North', 'South', 'West']) {
      const rs = rows.filter((r) => r.conference === conference && r.division === division).sort(byRecord);
      if (rs.length) out.push({ conference, division, rows: rs });
    }
  return out;
};

/** "9-5" or "5-8-1" */
export const recordText = (c: Pick<LiveClub, 'w' | 'l' | 't'>) => `${c.w}-${c.l}${c.t ? `-${c.t}` : ''}`;
export const pctText = (p: number) => (p >= 1 ? '1.000' : p.toFixed(3).replace(/^0/, ''));

/** Club name for a TLA in the save (falls back to the NFL table). */
export const clubForAbbr = (s: LiveSeason, abbr: string): string =>
  Object.entries(s.clubs).find(([, c]) => c.abbr === abbr)?.[0] ?? findNFLTeam(abbr)?.name ?? abbr;

// ---------- The coach's game log ----------

export interface LogRow {
  week: number;
  game: LiveGame | null;
  /** The next game to play */
  next: boolean;
}

/** Every week 1 to 18: the game, or null for the bye. */
export const gameLog = (s: LiveSeason): LogRow[] => {
  const byWeek = new Map(s.coachGames.map((g) => [g.week, g]));
  const weeks = Math.max(SEASON_WEEKS, ...s.coachGames.map((g) => g.week));
  const nextWeek = s.coachGames.find((g) => !g.result)?.week;
  return Array.from({ length: weeks }, (_, i) => {
    const g = byWeek.get(i + 1) ?? null;
    return { week: i + 1, game: g, next: !!g && g.week === nextWeek };
  });
};

// ---------- Weather ----------

/** A game's weather odds (0..1) from the home stadium, by the game's rule for its week (src/utils/stadiumWeather.ts). */
export type Weather = { kind: 'roof' } | { kind: 'open'; rain: number; snow: number };

/** Odds for a game in `week` (weeks 1-11 rain only; 12-18 rain, else snow) at a stadium. */
export const weatherAt = (club: LiveClub | undefined, week: number): Weather | null => {
  const w = stadiumWeather(club);
  if (!w) return null;
  if (w.covered) return { kind: 'roof' };
  const phase = w.phases.find((p) => p.key === (week <= 11 ? 'early' : 'late'));
  return phase ? { kind: 'open', rain: phase.rain, snow: phase.snow } : null;
};

/** The weather a game is played in: the home club's stadium (roof, else its rainfall / snowfall figures). */
export const gameWeather = (s: LiveSeason, g: LiveGame): Weather | null =>
  weatherAt(g.home ? s.clubs[s.club] : s.clubs[clubForAbbr(s, g.opp)], g.week);

// ---------- Playoff history ----------

export type PlayoffStage = 'title' | 'super-bowl' | 'conference' | 'divisional' | 'first' | 'missed';

/** How far a season went, from its playoff record and the game's finish text. */
export const playoffStage = (h: CoachSeason): { stage: PlayoffStage; label: string } => {
  if (h.pw + h.pl === 0) return { stage: 'missed', label: 'Missed the playoffs' };
  if (h.pl === 0) return { stage: 'title', label: 'Won the Super Bowl' };
  if (/Champs$/.test(h.finish)) return { stage: 'super-bowl', label: 'Lost the Super Bowl' };
  if (h.finish === 'Champ Rnd') return { stage: 'conference', label: 'Lost the conference final' };
  if (h.finish === 'Divisional') return { stage: 'divisional', label: 'Lost in the divisional round' };
  return { stage: 'first', label: h.finish === 'Wild Card' ? 'Lost in the wild card round' : 'Lost the first playoff game' };
};

export interface PlayoffClubRow {
  team: string;
  seasons: number;
  appearances: number;
  pw: number;
  pl: number;
  titles: number;
  first: number;
  last: number;
}

/** Playoff record per club coached, in the order he coached them (a club coached twice is one row). */
export const playoffsByClub = (history: CoachSeason[]): PlayoffClubRow[] => {
  const m = new Map<string, PlayoffClubRow>();
  for (const h of history) {
    const r = m.get(h.team) ?? { team: h.team, seasons: 0, appearances: 0, pw: 0, pl: 0, titles: 0, first: h.year, last: h.year };
    r.seasons += 1;
    r.appearances += h.pw + h.pl > 0 ? 1 : 0;
    r.pw += h.pw;
    r.pl += h.pl;
    r.titles += playoffStage(h).stage === 'title' ? 1 : 0;
    r.last = h.year;
    m.set(h.team, r);
  }
  return [...m.values()].sort((a, b) => a.first - b.first);
};

// ---------- The live season in the weekly-scores shape (schedule.json), so the Season page draws it like the rest ----------

/** A coach game on the Season page: schedule.json's CoachGame plus the live season's upcoming weeks and their weather. */
export type LogGame = CoachGame & { upcoming?: boolean; next?: boolean; weather?: Weather | null };

/** A club's row: schedule.json's TableRow, or the live one (record and offense / defense ratings; no points yet). */
export type SeasonTableRow = TableRow & { off?: number; def?: number };

/** One game in "Around the league": clubs (names or abbreviations), the score once played, the weather before. */
export interface RoundGame {
  away: string;
  home: string;
  awayScore?: number;
  homeScore?: number;
  weather?: Weather | null;
}

export type SeasonView = Omit<ScheduleSeason, 'coachGames' | 'table'> & {
  coachGames: LogGame[];
  table: SeasonTableRow[];
  /** Every week's games for "Around the league" (the live season includes the weeks still to play) */
  weeks?: { week: number; games: RoundGame[] }[];
  /** The live season from the save (no points for other clubs, no power score yet) */
  live?: { week: number; weeks: number; updated: Date | null; left: number };
};

const brief = (g: LogGame): CoachGameBrief => ({ week: g.week, round: g.round, opp: g.opp ?? '', for: g.for ?? 0, against: g.against ?? 0, margin: g.margin ?? 0 });
const wlt = (gs: LogGame[]) => {
  const w = gs.filter((g) => g.result === 'W').length;
  const l = gs.filter((g) => g.result === 'L').length;
  const t = gs.filter((g) => g.result === 'T').length;
  return `${w}-${l}${t ? `-${t}` : ''}`;
};

/**
 * The live season as a SeasonView: the coach's game log (byes, upcoming weeks with the home stadium's weather), his
 * record, points and splits from the games played, and the 32 clubs' records and ratings as they stand in the save.
 * Where schedule.json already has the same season, its table (points, SOS, power) is used for the clubs.
 */
/** schedule.json's games grouped by week. */
export const scheduleWeeks = (season: Pick<ScheduleSeason, 'games'>): { week: number; games: RoundGame[] }[] => {
  const m = new Map<number, RoundGame[]>();
  for (const g of season.games ?? []) m.set(g.week, [...(m.get(g.week) ?? []), { away: g.away, home: g.home, awayScore: g.awayScore, homeScore: g.homeScore }]);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([week, games]) => ({ week, games }));
};

/** The live league's weeks, played and to play, each upcoming game with its home stadium's weather. */
const liveWeeks = (s: LiveSeason): { week: number; games: RoundGame[] }[] => {
  const m = new Map<number, RoundGame[]>();
  for (const g of s.leagueGames ?? []) {
    const played = g.hs !== undefined && g.as !== undefined;
    const home = s.clubs[g.home];
    const weather: Weather | null = played ? null : weatherAt(home, g.week);
    m.set(g.week, [...(m.get(g.week) ?? []), { away: g.away, home: g.home, awayScore: g.as, homeScore: g.hs, weather }]);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([week, games]) => ({ week, games }));
};

let liveSchedCache: Promise<ScheduleSeason | null> | null = null;
/** public/data/league/live_season.json: the season in progress built by scripts/save_state.py with schedule_content.py's rules. */
export const useLiveSchedule = (): ScheduleSeason | null | undefined => {
  const [v, setV] = useState<ScheduleSeason | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    liveSchedCache ??= fetch(`${import.meta.env.BASE_URL}data/league/live_season.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<ScheduleSeason>) : null))
      .catch(() => null);
    liveSchedCache.then((d) => alive && setV(d && Array.isArray(d.table) ? d : null));
    return () => {
      alive = false;
    };
  }, []);
  return v;
};

export const liveSeasonView = (s: LiveSeason, sched?: ScheduleSeason | null): SeasonView => {
  const id = `Y${s.season}`;
  const me = s.clubs[s.club];
  const log = gameLog(s);
  const games: LogGame[] = log.map((r) => {
    const g = r.game;
    if (!g) return { week: r.week, round: `Week ${r.week}` };
    const opp = clubForAbbr(s, g.opp);
    const oc = s.clubs[opp];
    const played = !!g.result && g.for !== undefined && g.against !== undefined;
    return {
      week: r.week,
      round: `Week ${r.week}`,
      site: g.home ? 'home' : 'away',
      opp,
      oppAbbr: g.opp,
      oppRecord: oc ? recordText(oc) : undefined,
      ...(played
        ? { for: g.for, against: g.against, result: g.result, margin: g.for! - g.against!, score: `${Math.max(g.for!, g.against!)}-${Math.min(g.for!, g.against!)}` }
        : { upcoming: true, next: r.next, weather: gameWeather(s, g) }),
    };
  });
  const played = games.filter((g) => g.result);
  const pf = played.reduce((t, g) => t + (g.for ?? 0), 0);
  const pa = played.reduce((t, g) => t + (g.against ?? 0), 0);
  const vsWin = played.filter((g) => {
    const oc = g.opp ? s.clubs[g.opp] : undefined;
    return oc ? winPct(oc) > 0.5 : false;
  });
  let streak = 0;
  let best = 0;
  played.forEach((g) => {
    streak = g.result === 'W' ? streak + 1 : 0;
    best = Math.max(best, streak);
  });
  const wins = played.filter((g) => g.result === 'W').sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
  const losses = played.filter((g) => g.result === 'L').sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0));
  const schedRows = new Map((sched?.table ?? []).map((r) => [r.team, r]));
  const rows = standingRows(s);
  const divs = divisions(rows) ?? [];
  const divRank = new Map(divs.flatMap((d) => d.rows.map((r, i) => [r.club, i + 1] as const)));
  const table: SeasonTableRow[] = rows.map((r) => {
    const x = schedRows.get(r.club);
    const nan = Number.NaN;
    return {
      team: r.club,
      abbr: r.c.abbr,
      conference: r.conference || null,
      division: r.conference && r.division ? `${r.conference} ${r.division}` : null,
      divisionRank: divRank.get(r.club) ?? null,
      w: r.c.w,
      l: r.c.l,
      t: r.c.t,
      record: recordText(r.c),
      pct: r.pct,
      pf: x?.pf ?? nan,
      pa: x?.pa ?? nan,
      diff: x?.diff ?? nan,
      ppg: x?.ppg ?? nan,
      papg: x?.papg ?? nan,
      sos: x?.sos ?? nan,
      powerScore: x?.powerScore ?? nan,
      power: x?.power ?? nan,
      last5: x?.last5,
      streak: x?.streak,
      off: r.c.off,
      def: r.c.def,
    };
  });
  const live = { week: Math.min(s.week, SEASON_WEEKS), weeks: SEASON_WEEKS, updated: saveDate(s), left: games.filter((g) => g.upcoming).length };
  if (sched) {
    // The league as schedule_content.py builds it from the save's games; the log keeps the weeks still to play
    const rec = new Map(sched.table.map((r) => [r.team, r.record]));
    return {
      ...sched,
      coachGames: games.map((g) => (g.opp && rec.has(g.opp) ? { ...g, oppRecord: rec.get(g.opp) } : g)),
      coachRecord: { ...sched.coachRecord, playoffs: '' },
      weeks: liveWeeks(s),
      live,
    };
  }
  return {
    weeks: liveWeeks(s),
    season: id,
    coachTeam: s.club,
    coachAbbr: me?.abbr ?? '',
    coachRecord: { w: me?.w ?? 0, l: me?.l ?? 0, t: me?.t ?? 0, pf, pa, diff: pf - pa, power: Number.NaN, record: me ? recordText(me) : '', playoffs: '' },
    coachGames: games,
    coachDetail: {
      home: wlt(played.filter((g) => g.site === 'home')),
      away: wlt(played.filter((g) => g.site === 'away')),
      oneScore: wlt(played.filter((g) => Math.abs(g.margin ?? 99) <= 8)),
      vsWinning: wlt(vsWin),
      vsWinningGames: vsWin.length,
      ppg: played.length ? Math.round((pf / played.length) * 10) / 10 : 0,
      papg: played.length ? Math.round((pa / played.length) * 10) / 10 : 0,
      longestWinStreak: best || null,
      bestWin: wins[0] ? brief(wins[0]) : undefined,
      worstLoss: losses[0] ? brief(losses[0]) : undefined,
      results: played.map((g) => g.result).join(''),
    },
    table,
    leaders: { bestOffense: '', bestDefense: '', worstDefense: '', bestDiff: '' },
    games: [],
    regularSeasonGames: games.filter((g) => g.opp).length,
    live,
  };
};
