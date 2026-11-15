import type { Position } from '@/types/player';
import type { CareerSeasonsFile } from '@/utils/careerSeasons';
import type { SaveState } from '@/components/clock/saveData';
import { percentileOf } from '@/config/skillGrades';
import { BOX, SAVE_ONLY, groupOf, seasonPlayer, seasonRates, type Group } from './statDefs';

/**
 * Seasons from season ends. A season's line is the change in a player's career totals between two consecutive
 * season-end snapshots (as scripts/league_records.py and hall_of_fame.py read them):
 *   first   his first recorded season: no snapshot before it, so no season line (only the totals then)
 *   played  8–21 games: a season, counted in the position's percentile pools
 *   short   1–7 games: shown, flagged a small sample, kept out of the pools
 *   idle    no games between the two snapshots (retired, or out for the season)
 *   multi   more than 21 games: an import correction spanning more than a season; no season line
 *   live    the season in progress, from the live save (card numbers carried from the last season end)
 * The latest completed season borrows the save's extra keys (QB attempts, RB carries, fumbles) when the save's games
 * for that season match, so its rates are complete; earlier seasons only have what the snapshots keep.
 */

export type SeasonStatus = 'first' | 'played' | 'short' | 'idle' | 'multi' | 'live';

export interface SeasonPoint {
  year: number;
  ovr: number;
  skill: number | null;
  legacy: number;
  value: number;
  grade: string;
  /** Career totals at the season's end (file fields: g, box stats, rings, mvp, sbmvp, opoy | dpoy) */
  totals: Record<string, number>;
  /** The season's own line (box stats, plus the save's extra keys on the latest season); null without one */
  box: Record<string, number> | null;
  /** Award changes this season (rings, mvp, sbmvp, opoy / dpoy); null without a snapshot before */
  awards: Record<string, number> | null;
  games: number;
  status: SeasonStatus;
  /** Rates by SeasonRate id (NaN where the inputs are missing) */
  rates: Record<string, number>;
  /** Percentile (0–100, higher = better) among the position's qualifying seasons that year, by box key or rate id */
  pct: Record<string, number>;
  /** Career year (1 = rookie season; earlier careers estimated at 17 games a season); null for an idle season */
  careerYear: number | null;
  /** Career Legacy rank among every recorded player that season end, and among his position */
  legacyRank: number;
  posRank: number;
  /** Hall of Fame Score as of the season end (scripts/hall_of_fame.py rule on that snapshot) */
  hof: { score: number; standing: number; honours: number; records: string[] };
}

export const POOL_MIN_GAMES = 8;
const LIVE_MIN_GAMES = 4;
const MAX_SEASON_GAMES = 21;

const STANDING: Record<number, number> = { 1: 60, 2: 54, 3: 49, 4: 45, 5: 42, 6: 39, 7: 36, 8: 33, 9: 30, 10: 27 };
export const standingPoints = (rank: number) => STANDING[rank] ?? Math.max(0, 27 - 2 * (rank - 10));
/** scripts/hall_of_fame.py RECORDS: league career records (label, positions, total field) */
const HOF_RECORDS: [string, Position[], string][] = [
  ['Passing yards', ['QB'], 'yds'],
  ['Passing TDs', ['QB'], 'td'],
  ['Rushing yards', ['RB', 'QB'], 'ryds'],
  ['Rushing TDs', ['RB', 'QB'], 'rtd'],
  ['Receiving yards', ['WR', 'TE'], 'yds'],
  ['Receiving TDs', ['WR', 'TE'], 'td'],
  ['Tackles', ['LB', 'DB', 'DL'], 'tkl'],
  ['Sacks', ['LB', 'DB', 'DL'], 'sck'],
  ['Interceptions', ['LB', 'DB', 'DL'], 'int'],
  ['Forced fumbles', ['LB', 'DB', 'DL'], 'ff'],
];
const AWARD_KEYS = ['rings', 'mvp', 'sbmvp', 'opoy', 'dpoy'];
/** Box stats where fewer is better */
export const LOWER_BETTER_BOX: Record<string, boolean> = { 'QB:int': true };

export interface LeagueSeasons {
  seasons: number[];
  /** The live season (from the save) when it is past the last season end */
  liveSeason: number | null;
  byKey: Map<string, SeasonPoint[]>;
  /** Position → year → metric → qualifying values, ascending */
  pools: Map<Position, Map<number, Map<string, number[]>>>;
}

const posOf = (key: string) => key.slice(0, key.indexOf(':')) as Position;
const POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL']);

const CACHE = new WeakMap<CareerSeasonsFile, Map<string, LeagueSeasons>>();

/** Every recorded player's seasons, ranks, Hall of Fame Score by season, and the percentile pools. Cached per file. */
export const buildLeague = (file: CareerSeasonsFile, save: SaveState | null): LeagueSeasons => {
  let bySave = CACHE.get(file);
  if (!bySave) CACHE.set(file, (bySave = new Map()));
  const ck = save?.id ?? '';
  const hit = bySave.get(ck);
  if (hit) return hit;

  const seasons = file.seasons;
  const last = seasons[seasons.length - 1];
  const liveSeason = save && save.season > last ? save.season : null;
  const byKey = new Map<string, SeasonPoint[]>();

  for (const [key, entry] of Object.entries(file.players)) {
    const pos = posOf(key);
    if (!POSITIONS.has(pos)) continue;
    const group: Group = groupOf(pos);
    const fields = file.fields[group] ?? [];
    const boxKeys = BOX[group].map((b) => b.key);
    const rates = seasonRates(pos);
    const start = seasons.indexOf(entry.from);
    const pts: SeasonPoint[] = [];
    let prev: SeasonPoint | null = null;
    let cy: number | null = null;
    entry.rows.forEach((row, i) => {
      const year = seasons[start + i];
      if (!row || year == null) {
        prev = null;
        return;
      }
      const totals: Record<string, number> = {};
      fields.forEach((f, j) => (totals[f] = Number(row[5 + j]) || 0));
      let status: SeasonStatus = 'first';
      let box: Record<string, number> | null = null;
      let awards: Record<string, number> | null = null;
      let games = 0;
      if (prev) {
        const p: SeasonPoint = prev;
        games = (totals.g ?? 0) - (p.totals.g ?? 0);
        awards = {};
        AWARD_KEYS.forEach((k) => k in totals && (awards![k] = Math.max(0, totals[k] - (p.totals[k] ?? 0))));
        status = games <= 0 ? 'idle' : games > MAX_SEASON_GAMES ? 'multi' : games < POOL_MIN_GAMES ? 'short' : 'played';
        if (status === 'played' || status === 'short') {
          box = {};
          boxKeys.forEach((k) => (box![k] = Math.max(0, (totals[k] ?? 0) - (p.totals[k] ?? 0))));
          const live = save && save.season === year ? save.players[key]?.season : undefined;
          if (live && live.g === games) SAVE_ONLY[group].forEach((k) => typeof live[k] === 'number' && (box![k] = live[k]));
        }
        if (status === 'idle') games = 0;
      }
      // career year: the first row's games before the records (17 a season), then one per season played
      if (status === 'first') cy = (totals.g ?? 0) > 0 ? Math.max(1, Math.round((totals.g ?? 0) / 17)) : null;
      else if (status === 'multi') cy = (cy ?? 0) + Math.max(1, Math.round(games / 17));
      else if (games > 0) cy = (cy ?? 0) + 1;
      const sp = box ? seasonPlayer(pos, box, games) : null;
      const rv: Record<string, number> = {};
      if (sp) rates.forEach((r) => (rv[r.id] = r.get(sp)));
      const pt: SeasonPoint = {
        year,
        ovr: Number(row[0]) || 0,
        skill: row[1] == null ? null : Number(row[1]),
        legacy: Number(row[2]) || 0,
        value: Number(row[3]) || 0,
        grade: String(row[4] ?? ''),
        totals,
        box,
        awards,
        games,
        status,
        rates: rv,
        pct: {},
        careerYear: games > 0 || status === 'first' ? cy : null,
        legacyRank: 0,
        posRank: 0,
        hof: { score: 0, standing: 0, honours: 0, records: [] },
      };
      pts.push(pt);
      prev = pt;
    });
    // the live season from the save (past the last season end)
    const sv = liveSeason && save ? save.players[key] : undefined;
    const lastPt = pts[pts.length - 1];
    if (sv && lastPt && (sv.season?.g ?? 0) > 0 && lastPt.year === last) {
      const box: Record<string, number> = {};
      [...boxKeys, ...SAVE_ONLY[group]].forEach((k) => typeof sv.season[k] === 'number' && (box[k] = sv.season[k]));
      boxKeys.forEach((k) => (box[k] ??= 0));
      const games = sv.season.g;
      const totals = { ...lastPt.totals, g: (lastPt.totals.g ?? 0) + games };
      boxKeys.forEach((k) => (totals[k] = (totals[k] ?? 0) + box[k]));
      const sp = seasonPlayer(pos, box, games);
      const rv: Record<string, number> = {};
      rates.forEach((r) => (rv[r.id] = r.get(sp)));
      pts.push({ ...lastPt, year: liveSeason!, totals, box, awards: null, games, status: 'live', rates: rv, pct: {}, careerYear: (lastPt.careerYear ?? 0) + 1 });
    }
    if (pts.length) byKey.set(key, pts);
  }

  // ranks and the Hall of Fame Score per season end
  for (const year of seasons) {
    const at: [string, SeasonPoint][] = [];
    byKey.forEach((pts, k) => {
      const p = pts.find((x) => x.year === year && x.status !== 'live');
      if (p) at.push([k, p]);
    });
    const all = at.map(([, p]) => p.legacy).sort((a, b) => b - a);
    const posLeg = new Map<Position, number[]>();
    at.forEach(([k, p]) => {
      const pos = posOf(k);
      posLeg.set(pos, [...(posLeg.get(pos) ?? []), p.legacy]);
    });
    const best = new Map<string, number>();
    HOF_RECORDS.forEach(([label, poss, f]) =>
      best.set(label, Math.max(0, ...at.filter(([k]) => poss.includes(posOf(k))).map(([, p]) => p.totals[f] ?? 0))),
    );
    at.forEach(([k, p]) => {
      const pos = posOf(k);
      p.legacyRank = 1 + all.filter((v) => v > p.legacy).length;
      p.posRank = 1 + (posLeg.get(pos) ?? []).filter((v) => v > p.legacy).length;
      const t = p.totals;
      const honours = Math.round(Math.min(30 * (t.mvp ?? 0) + 18 * ((t.opoy ?? 0) + (t.dpoy ?? 0)) + 12 * (t.sbmvp ?? 0) + 4 * (t.rings ?? 0), 40) * 0.6);
      const records = HOF_RECORDS.filter(([label, poss, f]) => poss.includes(pos) && (t[f] ?? 0) > 0 && (t[f] ?? 0) >= (best.get(label) ?? 0)).map(([l]) => l);
      const standing = standingPoints(p.posRank);
      p.hof = { score: Math.min(100, standing + honours + 15 * records.length), standing, honours, records };
    });
  }
  byKey.forEach((pts) => {
    const lp = pts[pts.length - 1];
    const prior = pts[pts.length - 2];
    if (lp?.status === 'live' && prior) {
      lp.legacyRank = prior.legacyRank;
      lp.posRank = prior.posRank;
      lp.hof = prior.hof;
    }
  });

  // percentile pools per position and season, then every point's percentiles
  const pools = new Map<Position, Map<number, Map<string, number[]>>>();
  byKey.forEach((pts, k) => {
    const pos = posOf(k);
    let byYear = pools.get(pos);
    if (!byYear) pools.set(pos, (byYear = new Map()));
    pts.forEach((p) => {
      const ok = p.box && (p.status === 'played' || (p.status === 'live' && p.games >= LIVE_MIN_GAMES));
      if (!ok || !p.box) return;
      let m = byYear!.get(p.year);
      if (!m) byYear!.set(p.year, (m = new Map()));
      const add = (id: string, v: number) => Number.isFinite(v) && m!.set(id, [...(m!.get(id) ?? []), v]);
      BOX[groupOf(pos)].forEach((b) => add(b.key, p.box![b.key] / Math.max(1, p.games)));
      Object.entries(p.rates).forEach(([id, v]) => add(id, v));
    });
  });
  pools.forEach((byYear) => byYear.forEach((m) => m.forEach((vals) => vals.sort((a, b) => a - b))));
  byKey.forEach((pts, k) => {
    const pos = posOf(k);
    const g = groupOf(pos);
    const rates = seasonRates(pos);
    pts.forEach((p) => {
      const m = pools.get(pos)?.get(p.year);
      if (!m || !p.box) return;
      BOX[g].forEach((b) => {
        const vals = m.get(b.key);
        if (!vals || vals.length < 3) return;
        const pc = percentileOf(vals, p.box![b.key] / Math.max(1, p.games));
        if (Number.isFinite(pc)) p.pct[b.key] = LOWER_BETTER_BOX[`${g}:${b.key}`] ? 100 - pc : pc;
      });
      rates.forEach((r) => {
        const vals = m.get(r.id);
        const v = p.rates[r.id];
        if (!vals || vals.length < 3 || !Number.isFinite(v)) return;
        const pc = percentileOf(vals, v);
        if (Number.isFinite(pc)) p.pct[r.id] = r.lowerIsBetter ? 100 - pc : pc;
      });
    });
  });

  const out: LeagueSeasons = { seasons, liveSeason, byKey, pools };
  bySave.set(ck, out);
  return out;
};

/** A season's score: the weighted mean percentile of his skill-grade traits that season (0–100), null without one. */
export const seasonScore = (pos: Position, p: SeasonPoint): number | null => {
  const traits = seasonRates(pos).filter((r) => r.trait && Number.isFinite(p.pct[r.id]));
  if (!traits.length) return null;
  return traits.reduce((s, r) => s + p.pct[r.id], 0) / traits.length;
};

/** The best three-season window by mean season score (his prime), or null with under three scored seasons. */
export const primeWindow = (pos: Position, pts: SeasonPoint[]): { from: number; to: number; mean: number } | null => {
  const scored = pts.map((p) => ({ year: p.year, s: seasonScore(pos, p) }));
  let best: { from: number; to: number; mean: number } | null = null;
  for (let i = 0; i + 2 < scored.length; i++) {
    const w = scored.slice(i, i + 3);
    if (w.some((x) => x.s == null) || w[2].year - w[0].year !== 2) continue;
    const mean = w.reduce((s, x) => s + (x.s as number), 0) / 3;
    if (!best || mean > best.mean) best = { from: w[0].year, to: w[2].year, mean };
  }
  return best;
};
