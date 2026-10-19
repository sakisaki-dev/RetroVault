/**
 * Editorial league content (eras, Super Bowl history, storylines, rivalries…).
 *
 * Everything subjective lives in data, not code: the bundled default is
 * /data/league/content.json (built by scripts/build_league_content.py), and
 * the user can upload a replacement content.json (e.g. freshly AI-written)
 * which is kept in localStorage and overrides the bundled file until reset.
 *
 * Format (all top-level arrays optional; unknown fields are ignored):
 * {
 *   "version": 1, "season": "Y80", "title": "...",
 *   "eras":       [{ id, name, startYear, endYear, superBowlRange?, yourTeams[], keyPlayers[], rival?, notes?, history? (markdown) }],
 *   "superBowls": [{ number, roman, year (number or "Y12"), winner, loser, score, yourResult: "won"|"lost"|"not in it"|"not captured", yourTeam }],
 *   "storylines": [{ id, headline, subheadline?, summary?, body (markdown), players[] (names), tier, category, era? }],
 *   "rivalries":  [{ id, rival, team?, era?, summary, meetings?[{ roman, year, score, result, yourTeam, opponent }] }],
 *   "lineages":   [{ id, label, chain[], note? }],
 *   "snubs":      [{ id, title?, summary (markdown), players[] }],
 *   "outsiders":  [{ player, position?, team?, summary }],
 *   "openQuestions": [string],
 *   "playerNotes":   [{ name, team?, position?, nickname?, era?, tag? }],
 *   "speeches":      { "<player name>": "Hall of Fame induction speech (plain text; blank line = new paragraph)" },
 *   "coach":         { name, age, stars, morale, gamesPlayed, simGames, record{}, bests{}, superBowlRecord[], seasons[{ year, team, abbr, w, l, t, finish }] }
 * }
 * `coach` is optional (from data/y80/coach.json, the staff screen); bad fields are dropped one by one.
 * `speeches` is optional; when a player has one, the induction ceremony uses it instead of the
 * speech generated from their career data (see src/components/ceremony/speech.ts).
 * Eras/superBowls also accept the raw snake_case shape from data/y80
 * (years: "Y1–15", your_teams, key_players, your_result, your_team).
 */
import { useCallback, useEffect, useState } from 'react';

export const CONTENT_URL = `${import.meta.env.BASE_URL}data/league/content.json`;
export const CONTENT_STORAGE_KEY = 'retroVault:content';
const CHANGE_EVENT = 'retroVault:content-changed';

export const STORY_TIERS = ['breaking', 'hot-take', 'analysis', 'controversy', 'milestone', 'power-ranking'] as const;
export type StoryTier = (typeof STORY_TIERS)[number];

export type SuperBowlResult = 'won' | 'lost' | 'not in it' | 'not captured';

export interface LeagueEra {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  superBowlRange?: string;
  yourTeams: string[];
  keyPlayers: string[];
  rival?: string;
  notes?: string;
  history?: string;
}

export interface SuperBowlEntry {
  number: number;
  roman: string;
  year: number;
  winner: string | null;
  loser: string | null;
  score: string | null;
  yourResult: SuperBowlResult;
  yourTeam: string | null;
}

export interface Storyline {
  id: string;
  headline: string;
  subheadline?: string;
  summary?: string;
  body: string;
  players: string[];
  tier: StoryTier;
  category: string;
  era?: string;
}

export interface RivalryMeeting {
  roman?: string;
  year?: number;
  score?: string;
  result?: string;
  yourTeam?: string;
  opponent?: string;
}

export interface Rivalry {
  id: string;
  rival: string;
  team?: string;
  era?: string;
  summary: string;
  meetings: RivalryMeeting[];
}

export interface Lineage {
  id: string;
  label: string;
  chain: string[];
  note?: string;
}

export interface Snub {
  id: string;
  title?: string;
  summary: string;
  players: string[];
}

export interface Outsider {
  player: string;
  position?: string;
  team?: string;
  summary: string;
}

export interface PlayerNote {
  name: string;
  team?: string;
  position?: string;
  nickname?: string;
  era?: string;
  tag?: string;
}

export interface CoachSeason {
  year: number;
  /** Nickname as the save shows it ("Vikings") */
  team: string;
  abbr?: string;
  w: number;
  l: number;
  t: number;
  /** Raw finish: "Champions", "NFC Champs", "Champ Rnd", "Divisional", "Wild Card", "AFC WES 3rd"… */
  finish: string;
}

export interface CoachRecord {
  fullSeasons?: number;
  /** "W-L-T" */
  regular?: string;
  regularWinPct?: number;
  /** "W-L" */
  playoff?: string;
  playoffWinPct?: number;
  /** "78/80" */
  playoffsReached?: string;
  seasonsNoSimGames?: number;
  simGameRecord?: string;
}

export interface CoachBests {
  mostPoints?: string;
  biggestWin?: string;
  biggestLoss?: string;
  mostTDs?: string;
}

export interface CoachInfo {
  name?: string;
  age?: number;
  stars?: number;
  morale?: string;
  gamesPlayed?: number;
  simGames?: number;
  record?: CoachRecord;
  bests?: CoachBests;
  /** The coach vs real-life coaches by Super Bowl titles ({ coach: "NE (2000-2023)", titles: 6 }) */
  superBowlRecord: { coach: string; titles: number }[];
  /** One row per season, sorted by year, one per year */
  seasons: CoachSeason[];
}

export interface LeagueContent {
  version: number;
  season?: string;
  title?: string;
  eras: LeagueEra[];
  superBowls: SuperBowlEntry[];
  storylines: Storyline[];
  rivalries: Rivalry[];
  lineages: Lineage[];
  snubs: Snub[];
  outsiders: Outsider[];
  openQuestions: string[];
  playerNotes: PlayerNote[];
  /** Optional induction speeches keyed by player name (AI-written offline, uploaded with content.json) */
  speeches?: Record<string, string>;
  /** Head coach card and season-by-season history (optional) */
  coach?: CoachInfo;
}

export type ContentSource = 'uploaded' | 'bundled' | 'none';

// ---------------------------------------------------------------------------
// Loose validation / normalization (fail soft: drop bad items, keep the rest)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : []);
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter(isObj) : []);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const parseYearRange = (years?: string): [number, number] | null => {
  const m = years?.match(/Y?(\d+)\s*[–—-]\s*Y?(\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
};

const normEra = (r: Raw): LeagueEra | null => {
  const name = str(r.name);
  if (!name) return null;
  let start = num(r.startYear);
  let end = num(r.endYear);
  if (start === undefined || end === undefined) {
    const range = parseYearRange(str(r.years));
    if (range) [start, end] = range;
  }
  if (start === undefined || end === undefined) return null;
  if (end < start) [start, end] = [end, start];
  return {
    id: str(r.id) ?? slug(name),
    name,
    startYear: start,
    endYear: end,
    superBowlRange: str(r.superBowlRange) ?? str(r.super_bowls),
    yourTeams: strArr(r.yourTeams ?? r.your_teams),
    keyPlayers: strArr(r.keyPlayers ?? r.key_players),
    rival: str(r.rival),
    notes: str(r.notes),
    history: str(r.history),
  };
};

const RESULTS: SuperBowlResult[] = ['won', 'lost', 'not in it', 'not captured'];
const normSuperBowl = (r: Raw): SuperBowlEntry | null => {
  const year = num(r.year);
  if (year === undefined) return null;
  const rawResult = (str(r.yourResult) ?? str(r.your_result) ?? '').toLowerCase();
  const yourResult: SuperBowlResult =
    (RESULTS as string[]).includes(rawResult) ? (rawResult as SuperBowlResult)
      : rawResult === 'win' ? 'won' : rawResult === 'loss' ? 'lost' : rawResult ? 'not in it' : 'not captured';
  return {
    number: num(r.number) ?? year + 59,
    roman: str(r.roman) ?? '',
    year,
    winner: str(r.winner) ?? null,
    loser: str(r.loser) ?? null,
    score: str(r.score) ?? null,
    yourResult,
    yourTeam: str(r.yourTeam) ?? str(r.your_team) ?? null,
  };
};

const normStory = (r: Raw, i: number): Storyline | null => {
  const headline = str(r.headline) ?? str(r.title);
  const body = str(r.body) ?? str(r.content) ?? str(r.summary);
  if (!headline || !body) return null;
  const tier = str(r.tier) as StoryTier | undefined;
  return {
    id: str(r.id) ?? `story-${i}-${slug(headline)}`,
    headline,
    subheadline: str(r.subheadline),
    summary: str(r.summary),
    body,
    players: strArr(r.players),
    tier: tier && (STORY_TIERS as readonly string[]).includes(tier) ? tier : 'analysis',
    category: str(r.category) ?? 'League History',
    era: str(r.era),
  };
};

const normRivalry = (r: Raw, i: number): Rivalry | null => {
  const rival = str(r.rival) ?? str(r.name);
  const summary = str(r.summary) ?? str(r.body);
  if (!rival || !summary) return null;
  return {
    id: str(r.id) ?? `rivalry-${i}`,
    rival,
    team: str(r.team),
    era: str(r.era),
    summary,
    meetings: arr(r.meetings).map((m) => ({
      roman: str(m.roman),
      year: num(m.year),
      score: str(m.score),
      result: str(m.result),
      yourTeam: str(m.yourTeam),
      opponent: str(m.opponent),
    })),
  };
};

const normLineage = (r: Raw, i: number): Lineage | null => {
  const chain = strArr(r.chain);
  if (!chain.length) return null;
  return { id: str(r.id) ?? `lineage-${i}`, label: str(r.label) ?? 'Lineage', chain, note: str(r.note) };
};

const normSnub = (r: Raw, i: number): Snub | null => {
  const summary = str(r.summary) ?? str(r.body);
  if (!summary) return null;
  return { id: str(r.id) ?? `snub-${i}`, title: str(r.title), summary, players: strArr(r.players) };
};

const speechMap = (v: unknown): Record<string, string> | undefined => {
  if (!isObj(v)) return undefined;
  const out: Record<string, string> = {};
  Object.entries(v).forEach(([name, text]) => {
    const t = str(text);
    if (name.trim() && t) out[name.trim()] = t;
  });
  return Object.keys(out).length ? out : undefined;
};

/** Strict number: only real finite numbers or plain numeric strings (no "Y12" coercion). */
const strictNum = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return undefined;
};
const RECORD_RE = /^\d+\s*-\s*\d+(\s*-\s*\d+)?$/;
const recordStr = (v: unknown) => {
  const s = str(v);
  return s && RECORD_RE.test(s) ? s.replace(/\s+/g, '') : undefined;
};
const pct = (v: unknown) => {
  const n = strictNum(v);
  return n !== undefined && n >= 0 && n <= 1 ? n : undefined;
};
const count = (v: unknown) => {
  const n = strictNum(v);
  return n !== undefined && n >= 0 && Number.isInteger(n) ? n : undefined;
};
/** Drop undefined keys so optional objects stay clean. */
const prune = <T extends object>(o: T): T | undefined => {
  const entries = Object.entries(o).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
};

const normCoachSeason = (r: Raw): CoachSeason | null => {
  const year = num(r.year);
  const team = str(r.team) ?? str(r.abbr);
  const w = count(r.w);
  const l = count(r.l);
  const finish = str(r.finish);
  if (year === undefined || year < 1 || !team || w === undefined || l === undefined || !finish) return null;
  return { year, team, abbr: str(r.abbr), w, l, t: count(r.t) ?? 0, finish };
};

const normCoach = (v: unknown): CoachInfo | undefined => {
  if (!isObj(v)) return undefined;
  const rec = isObj(v.record) ? v.record : {};
  const bests = isObj(v.bests) ? v.bests : {};
  const reached = str(rec.playoffsReached);
  const stars = strictNum(v.stars);
  const byYear = new Map<number, CoachSeason>();
  compact(arr(v.seasons).map(normCoachSeason)).forEach((s) => !byYear.has(s.year) && byYear.set(s.year, s));
  const coach: CoachInfo = {
    name: str(v.name),
    age: count(v.age),
    stars: stars !== undefined && stars >= 0 && stars <= 5 ? stars : undefined,
    morale: str(v.morale),
    gamesPlayed: count(v.gamesPlayed),
    simGames: count(v.simGames),
    record: prune<CoachRecord>({
      fullSeasons: count(rec.fullSeasons),
      regular: recordStr(rec.regular),
      regularWinPct: pct(rec.regularWinPct),
      playoff: recordStr(rec.playoff),
      playoffWinPct: pct(rec.playoffWinPct),
      playoffsReached: reached && /^\d+\s*\/\s*\d+$/.test(reached) ? reached.replace(/\s+/g, '') : undefined,
      seasonsNoSimGames: count(rec.seasonsNoSimGames),
      simGameRecord: recordStr(rec.simGameRecord),
    }),
    bests: prune<CoachBests>({
      mostPoints: str(bests.mostPoints),
      biggestWin: str(bests.biggestWin),
      biggestLoss: str(bests.biggestLoss),
      mostTDs: str(bests.mostTDs),
    }),
    superBowlRecord: compact(
      arr(v.superBowlRecord).map((r) => {
        const c = str(r.coach);
        const titles = count(r.titles);
        return c && titles !== undefined ? { coach: c, titles } : null;
      }),
    ),
    seasons: [...byYear.values()].sort((a, b) => a.year - b.year),
  };
  const cleaned = prune(coach);
  if (!cleaned || (!coach.name && !coach.seasons.length && !coach.record && !coach.superBowlRecord.length)) return undefined;
  return { ...cleaned, superBowlRecord: coach.superBowlRecord, seasons: coach.seasons };
};

const compact = <T,>(items: (T | null)[]): T[] => items.filter((x): x is T => x !== null);

/** Normalize anything JSON-ish into LeagueContent. Throws only if it's unusable. */
export const normalizeLeagueContent = (input: unknown): LeagueContent => {
  if (!isObj(input)) throw new Error('Content must be a JSON object.');
  const content: LeagueContent = {
    version: num(input.version) ?? 1,
    season: str(input.season),
    title: str(input.title),
    eras: compact(arr(input.eras).map(normEra)).sort((a, b) => a.startYear - b.startYear),
    superBowls: compact(arr(input.superBowls ?? input.super_bowls).map(normSuperBowl)).sort((a, b) => a.year - b.year),
    storylines: compact(arr(input.storylines ?? input.stories).map(normStory)),
    rivalries: compact(arr(input.rivalries).map(normRivalry)),
    lineages: compact(arr(input.lineages).map(normLineage)),
    snubs: compact(arr(input.snubs).map(normSnub)),
    outsiders: compact(
      arr(input.outsiders).map((r) => {
        const player = str(r.player) ?? str(r.name);
        const summary = str(r.summary) ?? '';
        return player ? { player, position: str(r.position), team: str(r.team), summary } : null;
      }),
    ),
    openQuestions: strArr(input.openQuestions),
    playerNotes: compact(
      arr(input.playerNotes).map((r) => {
        const name = str(r.name);
        return name
          ? { name, team: str(r.team), position: str(r.position), nickname: str(r.nickname), era: str(r.era), tag: str(r.tag) }
          : null;
      }),
    ),
  };
  const speeches = speechMap(input.speeches);
  if (speeches) content.speeches = speeches;
  const coach = normCoach(input.coach);
  if (coach) content.coach = coach;
  const hasAnything =
    content.eras.length || content.superBowls.length || content.storylines.length || content.rivalries.length ||
    content.lineages.length || content.snubs.length;
  if (!hasAnything) {
    throw new Error('No eras, superBowls, storylines, rivalries, lineages or snubs found.');
  }
  return content;
};

/** Parse uploaded text; throws a user-readable Error. */
export const parseLeagueContent = (text: string): LeagueContent => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  return normalizeLeagueContent(json);
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const readUploaded = (): LeagueContent | null => {
  try {
    const raw = localStorage.getItem(CONTENT_STORAGE_KEY);
    return raw ? parseLeagueContent(raw) : null;
  } catch {
    return null;
  }
};

const notify = () => {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* non-browser */
  }
};

/** Validate and store an uploaded content.json. Returns the parsed content. */
export const saveUploadedContent = (text: string): LeagueContent => {
  const content = parseLeagueContent(text);
  try {
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(content));
  } catch {
    throw new Error('Could not save to browser storage (it may be full or disabled).');
  }
  notify();
  return content;
};

export const clearUploadedContent = () => {
  try {
    localStorage.removeItem(CONTENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notify();
};

let bundledPromise: Promise<LeagueContent | null> | null = null;
const fetchBundled = (): Promise<LeagueContent | null> => {
  if (!bundledPromise) {
    // no-cache: always revalidate so a rebuilt content.json (e.g. new speeches) shows on the next load
    bundledPromise = fetch(CONTENT_URL, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => (json ? normalizeLeagueContent(json) : null))
      .catch(() => null);
  }
  return bundledPromise;
};

/** Uploaded content wins over the bundled file. Never throws. */
export const loadLeagueContent = async (): Promise<{ content: LeagueContent | null; source: ContentSource }> => {
  const uploaded = readUploaded();
  if (uploaded) return { content: uploaded, source: 'uploaded' };
  const bundled = await fetchBundled();
  return bundled ? { content: bundled, source: 'bundled' } : { content: null, source: 'none' };
};

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export const useLeagueContent = () => {
  const [state, setState] = useState<{ content: LeagueContent | null; source: ContentSource; loading: boolean }>(
    { content: null, source: 'none', loading: true },
  );

  const reload = useCallback(() => {
    let cancelled = false;
    loadLeagueContent().then((res) => {
      if (!cancelled) setState({ ...res, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = reload();
    const onChange = () => reload();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONTENT_STORAGE_KEY) reload();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      cancel();
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [reload]);

  /** Reads a File, validates, stores. Rejects with a readable Error. */
  const upload = useCallback(async (file: File) => {
    const text = await file.text();
    return saveUploadedContent(text);
  }, []);

  const reset = useCallback(() => clearUploadedContent(), []);

  return { ...state, upload, reset };
};

// ---------------------------------------------------------------------------
// Helpers shared by Timeline / Commentary
// ---------------------------------------------------------------------------

/** Normalize a display name for lookup: drop parentheticals, quotes, punctuation. */
export const normalizeName = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .replace(/[’‘`']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Find a player by an editorial name. Exact (normalized) match first, then
 * first+last name match ("Jackson W. Kline" -> "Jackson Wardell Kline"), then
 * the name inside parentheses ("God Johnson (Mason Earl III)").
 */
export const matchPlayerByName = <T extends { name: string }>(name: string, players: T[]): T | undefined => {
  const target = normalizeName(name);
  if (!target) return undefined;
  const exact = players.find((p) => normalizeName(p.name) === target);
  if (exact) return exact;
  const tParts = target.split(' ');
  if (tParts.length >= 2) {
    const loose = players.filter((p) => {
      const parts = normalizeName(p.name).split(' ');
      return parts.length >= 2 && parts[0] === tParts[0] && parts[parts.length - 1] === tParts[tParts.length - 1];
    });
    if (loose.length === 1) return loose[0];
  }
  const paren = name.match(/\((.+?)\)/)?.[1];
  if (paren && /^[A-Z]/.test(paren) && !/likely|final|formerly/i.test(paren)) {
    return matchPlayerByName(paren, players);
  }
  return undefined;
};

/** "Y61–64, Y66" style compression of a sorted year list. */
export const formatYearRuns = (years: number[]) => {
  const sorted = [...years].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(j > i ? `Y${sorted[i]}–${sorted[j]}` : `Y${sorted[i]}`);
    i = j;
  }
  return runs.join(', ');
};

export interface FranchiseTitles {
  team: string;
  titles: number;
  losses: number;
  appearances: number;
  titleYears: number[];
}

/** Your franchise record in Super Bowls (titles desc). */
export const getFranchiseTitles = (superBowls: SuperBowlEntry[], range?: [number, number]): FranchiseTitles[] => {
  const map = new Map<string, FranchiseTitles>();
  for (const sb of superBowls) {
    if (!sb.yourTeam || (sb.yourResult !== 'won' && sb.yourResult !== 'lost')) continue;
    if (range && (sb.year < range[0] || sb.year > range[1])) continue;
    const row = map.get(sb.yourTeam) ?? { team: sb.yourTeam, titles: 0, losses: 0, appearances: 0, titleYears: [] };
    row.appearances++;
    if (sb.yourResult === 'won') {
      row.titles++;
      row.titleYears.push(sb.year);
    } else row.losses++;
    map.set(sb.yourTeam, row);
  }
  return [...map.values()].sort((a, b) => b.titles - a.titles || b.appearances - a.appearances || a.team.localeCompare(b.team));
};

/** League-wide champions (every winner), titles desc. */
export const getAllChampions = (superBowls: SuperBowlEntry[]) => {
  const map = new Map<string, { team: string; titles: number; titleYears: number[]; yours: number }>();
  for (const sb of superBowls) {
    if (!sb.winner) continue;
    const row = map.get(sb.winner) ?? { team: sb.winner, titles: 0, titleYears: [], yours: 0 };
    row.titles++;
    row.titleYears.push(sb.year);
    if (sb.yourResult === 'won') row.yours++;
    map.set(sb.winner, row);
  }
  return [...map.values()].sort((a, b) => b.titles - a.titles || a.team.localeCompare(b.team));
};
