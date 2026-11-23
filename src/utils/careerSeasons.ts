import { useEffect, useState } from 'react';

/**
 * Season-end career lines (public/data/league/career_seasons.json, built by scripts/career_seasons.py from the market
 * history): for every player, his card numbers and career totals at the end of each recorded season. Single seasons
 * are never stored; the Deep Dive's career graphs derive a season as the change between two consecutive rows
 * (components/stats/comps/graphs/careerModel.ts).
 */

/**
 * [ovr, skill, legacy, value, grade, ...totals in `fields[group]` order, sovr]; null = not in that season's snapshot.
 * `ovr` is the career card rating; `sovr` (the last element) is his SEASON OVR that season (scripts/season_ovr.py),
 * null when he has no line (first recorded season, or his games did not rise).
 */
export type CareerRow = [number, number | null, number, number, string, ...(number | null)[]];

export interface CareerSeasonsFile {
  /** Season numbers with a season-end snapshot, oldest first (79 = Y79) */
  seasons: number[];
  /** The market snapshot id each season's end comes from */
  snapshots: string[];
  /** Total fields per position group (QB, RB, WR, TE, OL, DEF) */
  fields: Record<string, string[]>;
  /** The season in progress's season OVR per player (live save), null when no season is in progress */
  live?: { season: number; ovr: Record<string, number> } | null;
  /** "POS:Name" → his first recorded season and one row per season from it */
  players: Record<string, { from: number; rows: (CareerRow | null)[] }>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const valid = (raw: unknown): CareerSeasonsFile | null =>
  isObj(raw) && Array.isArray(raw.seasons) && isObj(raw.fields) && isObj(raw.players) ? (raw as unknown as CareerSeasonsFile) : null;

let request: Promise<CareerSeasonsFile | null> | null = null;
let loaded: CareerSeasonsFile | null | undefined;

/** Fetches the file once per page load; null when it is missing (not built yet) or unreadable. */
export const loadCareerSeasons = (): Promise<CareerSeasonsFile | null> => {
  request ??= fetch(`${import.meta.env.BASE_URL}data/league/career_seasons.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then(valid)
    .catch(() => null)
    .then((d) => (loaded = d));
  return request;
};

/** The file once in (undefined while loading, null when missing). */
export const useCareerSeasons = (): CareerSeasonsFile | null | undefined => {
  const [data, setData] = useState<CareerSeasonsFile | null | undefined>(loaded);
  useEffect(() => {
    if (loaded !== undefined) return void setData(loaded);
    let alive = true;
    loadCareerSeasons().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
};
