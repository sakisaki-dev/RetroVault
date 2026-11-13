/**
 * The Hall of Fame and the clubs' Rings of Honor, loaded from public/data/league/halloffame.json, which
 * scripts/hall_of_fame.py builds by rule (no AI, no hand-picked names):
 *
 * - Only retired players are eligible; a case is frozen the season he last played.
 * - Hall of Fame Score 0-100: standing (rank by Career Legacy at his position, up to 60) + honours (MVP, OPOY/DPOY,
 *   SB MVP, rings; up to 24) + records (+15 per league career record he held when he retired).
 * - Every season eligible retirees at or over the bar go in, highest score first, at most `cap` a class (the inaugural
 *   class uncapped); the rest wait on the ballot. Once in, always in.
 *
 * `isHallOfFamer()` (src/config/stats.ts) reads the league sheet's `inducted` column, which is written from this file,
 * so membership agrees everywhere; this file adds the score, classes, ballot, watch list and Rings of Honor.
 */
import { useEffect, useState } from 'react';

export const HALL_OF_FAME_URL = `${import.meta.env.BASE_URL}data/league/halloffame.json`;

export interface HofScoreParts {
  /** Rank by Career Legacy at his position when he retired: 1st 60, 2nd 54 ... */
  standing: number;
  /** Awards and rings, up to 24 */
  honours: number;
  /** +15 per league career record held */
  records: number;
}

/** One player's frozen (or, for the watch list, projected) Hall of Fame case. */
export interface HofCase {
  /** "POS:Name" */
  key: string;
  name: string;
  pos: string;
  /** Season his case froze (his last season; "Y92" for a projected case) */
  frozenSeason: string;
  careerLegacy: number;
  /** Rank by Career Legacy at his position at that point */
  rank: number;
  /** 0-100 */
  score: number;
  parts: HofScoreParts;
  /** League career records he held then ("Passing yards") */
  records: string[];
  rings: number;
  mvp: number;
  opoy: number;
  dpoy: number;
  sbmvp: number;
  games: number;
}

export interface HofMember extends HofCase {
  /** "Inaugural class" | "Y92" */
  class: string;
  classSeason: string;
  firstBallot: boolean;
  veteran: boolean;
  yearsOnBallot: number;
}

export interface HofBallotEntry extends HofCase {
  /** Season he became eligible ("Y90") */
  since?: string;
  yearsOnBallot?: number;
}

export interface HofWatchEntry extends HofCase {
  projected: true;
}

export interface HofClassEntry {
  season: string;
  label: string;
  /** Names, highest score first */
  members: string[];
}

export interface RingOfHonorEntry {
  name: string;
  pos: string;
  careerLegacy: number;
  score: number;
  hof: boolean;
  /** "Hall of Famer" | "Career Legacy" | "Rings" ... */
  why: string;
  frozenSeason: string;
}

export interface HallOfFameData {
  bar: number;
  cap: number;
  season?: string;
  members: HofMember[];
  classes: HofClassEntry[];
  ballot: HofBallotEntry[];
  near: HofBallotEntry[];
  watch: HofWatchEntry[];
  /** Club nickname -> its ring, Hall of Famers first */
  ringOfHonor: Record<string, RingOfHonorEntry[]>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const toCase = (r: Record<string, unknown>): HofCase | null => {
  const key = str(r.key);
  const name = str(r.name);
  if (!key || !name) return null;
  const parts = isObj(r.parts) ? r.parts : {};
  return {
    key,
    name,
    pos: str(r.pos) || key.split(':')[0],
    frozenSeason: str(r.frozenSeason),
    careerLegacy: num(r.careerLegacy),
    rank: num(r.rank),
    score: num(r.score),
    parts: { standing: num(parts.standing), honours: num(parts.honours), records: num(parts.records) },
    records: strs(r.records),
    rings: num(r.rings),
    mvp: num(r.mvp),
    opoy: num(r.opoy),
    dpoy: num(r.dpoy),
    sbmvp: num(r.sbmvp),
    games: num(r.games),
  };
};

const cases = <T,>(v: unknown, extra: (r: Record<string, unknown>, c: HofCase) => T): T[] =>
  arr(v).flatMap((r) => {
    const c = toCase(r);
    return c ? [extra(r, c)] : [];
  });

/** Never throws: anything malformed is dropped field by field. */
export const normalizeHallOfFame = (raw: unknown): HallOfFameData => {
  const r = isObj(raw) ? raw : {};
  const ring: Record<string, RingOfHonorEntry[]> = {};
  if (isObj(r.ringOfHonor)) {
    Object.entries(r.ringOfHonor).forEach(([club, list]) => {
      const rows = arr(list).flatMap((e): RingOfHonorEntry[] =>
        str(e.name)
          ? [{ name: str(e.name), pos: str(e.pos), careerLegacy: num(e.careerLegacy), score: num(e.score), hof: e.hof === true, why: str(e.why), frozenSeason: str(e.frozenSeason) }]
          : [],
      );
      if (rows.length) ring[club] = rows;
    });
  }
  return {
    bar: num(r.bar, 65),
    cap: num(r.cap, 3),
    season: str(r.season) || undefined,
    members: cases(r.members, (m, c) => ({
      ...c,
      class: str(m.class),
      classSeason: str(m.classSeason),
      firstBallot: m.firstBallot === true,
      veteran: m.veteran === true,
      yearsOnBallot: num(m.yearsOnBallot, 1),
    })),
    classes: arr(r.classes).flatMap((c) => (str(c.season) ? [{ season: str(c.season), label: str(c.label) || str(c.season), members: strs(c.members) }] : [])),
    ballot: cases(r.ballot, (b, c) => ({ ...c, since: str(b.since) || undefined, yearsOnBallot: typeof b.yearsOnBallot === 'number' ? b.yearsOnBallot : undefined })),
    near: cases(r.near, (b, c) => ({ ...c, since: str(b.since) || undefined, yearsOnBallot: typeof b.yearsOnBallot === 'number' ? b.yearsOnBallot : undefined })),
    watch: cases(r.watch, (_w, c) => ({ ...c, projected: true as const })),
    ringOfHonor: ring,
  };
};

let request: Promise<HallOfFameData | null> | null = null;
let loaded: HallOfFameData | null | undefined;

/** Fetches halloffame.json once per page load (no-cache revalidates a rebuilt file). Never throws; null on failure. */
export const loadHallOfFame = (): Promise<HallOfFameData | null> => {
  if (!request) {
    request = fetch(HALL_OF_FAME_URL, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => (json ? normalizeHallOfFame(json) : null))
      .catch(() => null)
      .then((d) => {
        loaded = d;
        // a failed load may be retried on the next request
        if (!d) request = null;
        return d;
      });
  }
  return request;
};

/** The Hall of Fame file: `loading` until it is in; `data` null when it failed. */
export const useHallOfFame = () => {
  const [data, setData] = useState<HallOfFameData | null | undefined>(loaded);
  useEffect(() => {
    if (loaded !== undefined) return;
    let alive = true;
    loadHallOfFame().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  const value = data ?? loaded;
  return { data: value ?? null, loading: value === undefined };
};

/** Where a player stands: member, waiting on the ballot, a near miss, or on the active watch list. */
export type HofStanding =
  | { kind: 'member'; entry: HofMember }
  | { kind: 'ballot'; entry: HofBallotEntry }
  | { kind: 'near'; entry: HofBallotEntry }
  | { kind: 'watch'; entry: HofWatchEntry };

export const hofStandingOf = (data: HallOfFameData | null, key: string): HofStanding | null => {
  if (!data) return null;
  const m = data.members.find((e) => e.key === key);
  if (m) return { kind: 'member', entry: m };
  const b = data.ballot.find((e) => e.key === key);
  if (b) return { kind: 'ballot', entry: b };
  const n = data.near.find((e) => e.key === key);
  if (n) return { kind: 'near', entry: n };
  const w = data.watch.find((e) => e.key === key);
  if (w) return { kind: 'watch', entry: w };
  return null;
};

/** "Class of Y88" / "Inaugural class" for a member's class field. */
export const hofClassLabel = (cls: string) => (/class/i.test(cls) ? cls : `Class of ${cls}`);
