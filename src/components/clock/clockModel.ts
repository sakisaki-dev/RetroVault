import type { Player, Position } from '@/types/player';
import { RATINGS, type Rating, type SavePlayer, type SaveState } from './saveData';

/**
 * The Clock: rules over the live save (saveData.ts) and the league's career data. Everything here is computed; the
 * game's rules come from docs/GAME_MECHANICS.md ("Development and aging", "Retirement").
 *
 * Retirement. Max age is 40 for QBs and kickers, 35 for everyone else, plus one year per delay_retirement, and a
 * player gets a year older at each season's end. The save fixes where the line falls: of the players on a club,
 * every age up to 34 is well populated (12 to 29 non-QBs a year, 29 at 34) and nobody plays at 35, while QBs and
 * kickers run to 39 and none plays at 40. So a player whose age has reached max age − 1 is in his last season
 * (he turns max age at this season's end and goes); LAST_SEASON_OFFSET holds that one-year step.
 *
 * Development. A rating goes up when (age − 21) is below a random number from 0 to 10, so the chance per season is
 * (31 − age) / 10: 90% at 22, 80% at 23, 0 from 31 (the owner's reading: "improves 80% of seasons at 23").
 * Decline from 31: stamina −1 every season, plus speed or strength −1 (a coin flip; QBs and kickers under 35 always
 * lose speed).
 */

export const LAST_SEASON_OFFSET = 1;
export const DECLINE_AGE = 31;
export const ROOKIE_AGE = 21;
export const PROSPECT_MAX_AGE = 24;

export const longClock = (pos: string) => pos === 'QB' || pos === 'K';
export const baseMaxAge = (pos: string) => (longClock(pos) ? 40 : 35);
/** The age at which he plays his final season */
export const finalAge = (pos: string, delay: number) => baseMaxAge(pos) + delay - LAST_SEASON_OFFSET;
/** Seasons left after this one (0 = this is his final season) */
export const seasonsLeft = (pos: string, age: number, delay: number) => Math.max(0, finalAge(pos, delay) - age);

/** Chance a rating goes up at this season's end, at this age */
export const improveChance = (age: number) => Math.max(0, Math.min(1, (31 - age) / 10));
/** Expected seasons with a rating step from this age until growth stops */
export const growthSeasons = (age: number) => {
  let s = 0;
  for (let a = age; a < 31; a++) s += improveChance(a);
  return s;
};

export interface ClockPlayer {
  key: string;
  name: string;
  pos: Position;
  team: string;
  age: number;
  delay: number;
  left: number;
  finalAge: number;
  now: Record<Rating, number>;
  max: Record<Rating, number>;
  /** Σ (ceiling − rating) over the four ratings */
  room: number;
  /** The league player (career line, Career Legacy); missing for players new in the save */
  player?: Player;
  legacy: number;
  games: number;
  season: Record<string, number>;
}

const POSITIONS = new Set<Position>(['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL']);

const toClock = (key: string, s: SavePlayer, byKey: Map<string, Player>): ClockPlayer | null => {
  const cut = key.indexOf(':');
  const pos = key.slice(0, cut) as Position;
  if (!POSITIONS.has(pos)) return null;
  const name = key.slice(cut + 1);
  const delay = s.delay_retirement || 0;
  const now = Object.fromEntries(RATINGS.map((r) => [r, s[r]])) as Record<Rating, number>;
  const max = Object.fromEntries(RATINGS.map((r) => [r, Math.max(s[r], s[`max_${r}` as const])])) as Record<Rating, number>;
  const player = byKey.get(key);
  return {
    key,
    name,
    pos,
    team: s.team,
    age: s.age,
    delay,
    left: seasonsLeft(pos, s.age, delay),
    finalAge: finalAge(pos, delay),
    now,
    max,
    room: RATINGS.reduce((n, r) => n + max[r] - now[r], 0),
    player,
    legacy: player?.careerLegacy ?? 0,
    games: player?.games ?? 0,
    season: s.season ?? {},
  };
};

export const buildClock = (state: SaveState, players: Player[]): ClockPlayer[] => {
  const byKey = new Map(players.filter((p) => !p.isRealLegend).map((p) => [`${p.position}:${p.name}`, p]));
  const out: ClockPlayer[] = [];
  for (const [k, s] of Object.entries(state.players)) {
    const c = toClock(k, s, byKey);
    if (c) out.push(c);
  }
  for (const [k, s] of Object.entries(state.newPlayers ?? {})) {
    if (byKey.has(k) || state.players[k]) continue;
    const c = toClock(k, s, new Map());
    if (c) out.push(c);
  }
  return out;
};

/** Players in their final season or with one left, best careers first */
export const farewellTour = (all: ClockPlayer[]) =>
  all
    .filter((c) => c.left <= 1 && c.player)
    .sort((a, b) => a.left - b.left || b.legacy - a.legacy || b.games - a.games || a.name.localeCompare(b.name));

/** Under-25s by room to grow (ties: younger first, then the bigger ceiling) */
export const prospectBoard = (all: ClockPlayer[]) =>
  all
    .filter((c) => c.age <= PROSPECT_MAX_AGE)
    .sort(
      (a, b) =>
        b.room - a.room ||
        a.age - b.age ||
        RATINGS.reduce((n, r) => n + b.max[r], 0) - RATINGS.reduce((n, r) => n + a.max[r], 0) ||
        a.name.localeCompare(b.name),
    );

export const OFFENSE: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL'];
export const DEFENSE: Position[] = ['DL', 'LB', 'DB'];

export interface PyramidRow {
  age: number;
  off: Partial<Record<Position, number>>;
  def: Partial<Record<Position, number>>;
  offN: number;
  defN: number;
}

export const agePyramid = (all: ClockPlayer[]): PyramidRow[] => {
  if (!all.length) return [];
  const lo = Math.min(...all.map((c) => c.age));
  const hi = Math.max(...all.map((c) => c.age));
  const rows: PyramidRow[] = [];
  for (let age = hi; age >= lo; age--) {
    const row: PyramidRow = { age, off: {}, def: {}, offN: 0, defN: 0 };
    for (const c of all) {
      if (c.age !== age) continue;
      const side = OFFENSE.includes(c.pos) ? 'off' : 'def';
      row[side][c.pos] = (row[side][c.pos] ?? 0) + 1;
      if (side === 'off') row.offN++;
      else row.defN++;
    }
    rows.push(row);
  }
  return rows;
};

export interface RatingByAge {
  age: number;
  n: number;
  now: Record<Rating, number>;
  max: Record<Rating, number>;
}

/** League average of each rating (and its ceiling) by age; ages with fewer than `min` players are left out */
export const ratingsByAge = (all: ClockPlayer[], min = 3): RatingByAge[] => {
  const groups = new Map<number, ClockPlayer[]>();
  for (const c of all) groups.set(c.age, [...(groups.get(c.age) ?? []), c]);
  return [...groups.entries()]
    .filter(([, g]) => g.length >= min)
    .sort((a, b) => a[0] - b[0])
    .map(([age, g]) => {
      const avg = (f: (c: ClockPlayer) => number) => g.reduce((n, c) => n + f(c), 0) / g.length;
      return {
        age,
        n: g.length,
        now: Object.fromEntries(RATINGS.map((r) => [r, avg((c) => c.now[r])])) as Record<Rating, number>,
        max: Object.fromEntries(RATINGS.map((r) => [r, avg((c) => c.max[r])])) as Record<Rating, number>,
      };
    });
};

/** Expected change in rating points over one season end, at this age (growth chance up, the decline rule down) */
export const expectedChange = (age: number) => ({ up: improveChance(age), down: age >= DECLINE_AGE ? 2 : 0 });

/**
 * Career totals at a glance, live: his league career (players.json, through the last completed season) plus this
 * season so far from the save (the save's season line, in Retro Vault keys). Two or three lines per position.
 */
export const careerLine = (p: Player, season: Record<string, number> = {}): { label: string; value: number }[] => {
  const s = (k: string) => season[k] ?? 0;
  switch (p.position) {
    case 'QB':
      return [
        { label: 'Pass yds', value: p.passYds + s('yds') },
        { label: 'Pass TD', value: p.passTD + s('td') },
      ];
    case 'RB':
      return [
        { label: 'Rush yds', value: p.rushYds + s('ryds') },
        { label: 'Rush TD', value: p.rushTD + s('rtd') },
      ];
    case 'WR':
    case 'TE':
      return [
        { label: 'Rec yds', value: p.recYds + s('yds') },
        { label: 'Rec TD', value: p.recTD + s('td') },
      ];
    case 'OL':
      return [{ label: 'Blocks', value: p.blocks + s('blk') }];
    default:
      return [
        { label: 'Tackles', value: p.tackles + s('tkl') },
        p.position === 'DB' ? { label: 'INT', value: p.interceptions + s('int') } : { label: 'Sacks', value: p.sacks + s('sck') },
      ];
  }
};

/** Career games, live (league career + this season's games so far) */
export const liveGames = (c: ClockPlayer) => c.games + (c.season.g ?? 0);

export const isDefense = (pos: Position) => DEFENSE.includes(pos);

// ---------- The game's stars (docs/SAVE_INVENTORY.md 7.1) and the draft ceiling (7.4) ----------

/** Sum of the four ratings at which a position reaches 10 half-stars (DB covers CB and S, both 33) */
export const POS_MAX: Record<string, number> = { QB: 37, RB: 34, TE: 33, WR: 34, OL: 35, DL: 35, LB: 33, DB: 33, CB: 33, S: 33, K: 37 };

/** Half-stars 1-10 (10 = five stars): round(10 × sum of the four ratings ÷ position max) */
export const halfStars = (pos: string, r: Record<Rating, number>) =>
  Math.max(1, Math.min(10, Math.round((10 * RATINGS.reduce((n, k) => n + r[k], 0)) / (POS_MAX[pos] ?? 35))));

/** The game's stars now and its potential (the same over the ceilings), in half-stars */
export const starsOf = (c: Pick<ClockPlayer, 'pos' | 'now' | 'max'>) => ({ now: halfStars(c.pos, c.now), potential: halfStars(c.pos, c.max) });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Best possible half-stars for draft prospects 5-50 after a season with this win % (prospects 1-4: 8) */
export const draftCeiling = (winPct: number) => Math.round(lerp(8.5, 5.5, Math.max(0, Math.min(1, winPct))));
export const TOP_PICKS_CEILING = 8;

/** The win % where the ceiling steps down a half-star (lerp crosses x.5), for the meter's bands */
export const draftBands = () => {
  const bands: { from: number; to: number; stars: number }[] = [];
  let from = 0;
  let cur = draftCeiling(0.0001);
  for (let i = 1; i <= 1000; i++) {
    const w = i / 1000;
    const s = draftCeiling(w);
    if (s !== cur) {
      bands.push({ from, to: w, stars: cur });
      from = w;
      cur = s;
    }
  }
  bands.push({ from, to: 1, stars: cur });
  return bands;
};

export interface RatingBin {
  label: string;
  mid: number;
  n: number;
  now: Record<Rating, number>;
  max: Record<Rating, number>;
}

/** League average ratings and ceilings in age groups of `size` years from 21 (groups under 3 players dropped) */
export const ratingsByBin = (all: ClockPlayer[], size = 2, min = 3): RatingBin[] => {
  const groups = new Map<number, ClockPlayer[]>();
  for (const c of all) {
    const b = ROOKIE_AGE + Math.floor((c.age - ROOKIE_AGE) / size) * size;
    groups.set(b, [...(groups.get(b) ?? []), c]);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.length >= min)
    .sort((a, b) => a[0] - b[0])
    .map(([b, g]) => {
      const avg = (f: (c: ClockPlayer) => number) => g.reduce((n, c) => n + f(c), 0) / g.length;
      return {
        label: size === 1 ? String(b) : `${b}-${b + size - 1}`,
        mid: b + (size - 1) / 2,
        n: g.length,
        now: Object.fromEntries(RATINGS.map((r) => [r, avg((c) => c.now[r])])) as Record<Rating, number>,
        max: Object.fromEntries(RATINGS.map((r) => [r, avg((c) => c.max[r])])) as Record<Rating, number>,
      };
    });
};
