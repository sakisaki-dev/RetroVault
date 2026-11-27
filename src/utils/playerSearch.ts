import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { bannerTeamOf, normalizeName } from '@/utils/playerExtras';

/*
 * Player search index for the phone search sheet (and anything else that wants ranked, typo-tolerant matching).
 *
 * The index is built once per player pool (cached by array identity, so a keystroke never rebuilds it). Each player
 * keeps his folded name words (accents folded on top of the site's normalizeName, apostrophes dropped), his nickname
 * and former names, and his position and clubs. A query matches when every typed word matches one of those words:
 *
 *   name / nickname prefix   100   ("max" → Maxwell, "take" → "Takeoff")
 *   club or position         40    ("eagles", "qb", "phi")
 *   inside a name word       30    ("well" → Maxwell), 3+ letters
 *   one typo (two at 6+)     15    ("brandsn" → Brandson), 3+ letters, name words only
 *
 * plus 400 when the whole query starts his full name, 380 when it starts his last name ("max" or "maxwell"), 60 when
 * only its first word starts his last name. Ties go to the higher rank (OVR, then Career Legacy). Only the top `limit`
 * come back, so the sheet renders a short list.
 */

export const foldText = (s: string) =>
  normalizeName(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['".]/g, '');

const words = (s: string) => foldText(s).split(/[\s\-:()/,]+/).filter(Boolean);

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/**
 * Initials by rule: the first letter of each name word (split on spaces and hyphens, "Jaxon Smith-Njigba" → jsn,
 * "Amon-Ra St. Brown" → arsb), with the suffix's letter as another form ("Brian Thomas Jr." → bt and btj), and one
 * letter per capital for names like McCaffrey ("Christian McCaffrey" → cmc). Never hand-listed.
 */
export const initialsOf = (name: string): string[] => {
  const raw = name.replace(/\s+/g, ' ').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['".]/g, '');
  const parts = raw.split(/[\s\-]+/).filter(Boolean);
  const core = parts.filter((w, i) => !(i > 0 && SUFFIXES.has(w.toLowerCase())));
  const suffix = parts.slice(core.length);
  const out = new Set<string>();
  const base = core.map((w) => w[0]).join('').toLowerCase();
  if (base.length >= 2) out.add(base);
  if (suffix.length && base) out.add(base + suffix.map((w) => w[0]).join('').toLowerCase());
  const caps = core.map((w) => (w.match(/[A-Z]/g) ?? [w[0]]).join('')).join('').toLowerCase();
  if (caps.length >= 2) {
    out.add(caps);
    if (suffix.length) out.add(caps + suffix.map((w) => w[0]).join('').toLowerCase());
  }
  return [...out];
};

export interface SearchEntry {
  p: Player;
  key: string;
  full: string;
  last: string;
  /** name, nickname and former-name words */
  name: string[];
  /** position, club names and abbreviations */
  aux: string[];
  /** initials fans type ("jsn", "btj", "arsb", "cmc"), derived by rule from the name */
  ini: string[];
  rank: number;
}

export interface SearchIndex {
  entries: SearchEntry[];
  byKey: Map<string, SearchEntry>;
}

export const keyOfPlayer = (p: Pick<Player, 'position' | 'name'>) => `${p.position}:${p.name}`;

const cache = new WeakMap<readonly Player[], { ovr: unknown; index: SearchIndex }>();

export const buildSearchIndex = (
  players: readonly Player[],
  opts: { ovr?: Map<string, number>; formerNames?: Record<string, string> } = {},
): SearchIndex => {
  const hit = cache.get(players);
  if (hit && hit.ovr === opts.ovr) return hit.index;
  const entries = players.map((p): SearchEntry => {
    const key = keyOfPlayer(p);
    const nameWords = words(p.name);
    const former = opts.formerNames?.[normalizeName(p.name)];
    const name = [...nameWords, ...(p.nickname ? words(p.nickname) : []), ...(former ? words(former) : [])];
    const aux = new Set<string>([p.position.toLowerCase()]);
    for (const club of [bannerTeamOf(p), p.team]) {
      if (!club) continue;
      const t = findNFLTeam(club);
      words(club).forEach((w) => aux.add(w));
      if (t) {
        words(t.name).forEach((w) => aux.add(w));
        words(t.fullName).forEach((w) => aux.add(w));
        aux.add(t.abbreviation.toLowerCase());
      }
    }
    if (p.isRealLegend) aux.add('nfl');
    return {
      p,
      key,
      full: nameWords.join(' '),
      last: nameWords[nameWords.length - 1] ?? '',
      name,
      aux: [...aux],
      ini: initialsOf(p.name),
      rank: (opts.ovr?.get(key) ?? 0) * 100000 + (p.careerLegacy || 0),
    };
  });
  const index = { entries, byKey: new Map(entries.map((e) => [e.key, e])) };
  cache.set(players, { ovr: opts.ovr, index });
  return index;
};

/** Levenshtein distance with an early exit once every cell of a row is over `max`. */
const within = (a: string, b: string, max: number): boolean => {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
};

const wordScore = (w: string, e: SearchEntry): number => {
  let best = 0;
  for (const t of e.name) {
    if (t.startsWith(w)) return 100;
    if (w.length >= 3 && t.includes(w)) best = Math.max(best, 30);
  }
  if (w.length >= 2) for (const t of e.aux) if (t.startsWith(w)) best = Math.max(best, 40);
  if (best || w.length < 3) return best;
  const max = w.length >= 6 ? 2 : 1;
  for (const t of e.name) {
    // A typo inside what he has typed so far: compare with the word's start (one longer for a dropped letter)
    if (within(w, t.slice(0, w.length), max) || within(w, t.slice(0, w.length + 1), max)) return 15;
  }
  return 0;
};

/** Initials only for 2 to 4 letters typed as one word: a flood of two-letter hits is ranked by prominence */
const INITIALS_SCORE = 250;
const isInitialsQuery = (q: string) => /^[a-z]{2,4}$/.test(q);

/** Ranked hits with their scores (the header search orders its result groups by the best score of each). */
export const searchPlayersScored = (index: SearchIndex, query: string, limit = 20, keep?: (p: Player) => boolean): { e: SearchEntry; s: number }[] => {
  const q = foldText(query).trim();
  if (!q) return [];
  const qWords = q.split(/\s+/);
  const initials = qWords.length === 1 && isInitialsQuery(q);
  const scored: { e: SearchEntry; s: number }[] = [];
  for (const e of index.entries) {
    if (keep && !keep(e.p)) continue;
    let s = 0;
    let ok = true;
    for (const w of qWords) {
      const ws = wordScore(w, e);
      if (!ws) {
        ok = false;
        break;
      }
      s += ws;
    }
    if (ok) {
      if (e.full.startsWith(q)) s += 400;
      else if (e.last.startsWith(q)) s += 380;
      else if (e.last.startsWith(qWords[0])) s += 60;
    } else if (initials && e.ini.includes(q)) {
      ok = true;
      s = INITIALS_SCORE;
    }
    if (!ok) continue;
    if (initials && e.ini.includes(q)) s = Math.max(s, INITIALS_SCORE);
    scored.push({ e, s });
  }
  scored.sort((a, b) => b.s - a.s || b.e.rank - a.e.rank);
  return scored.slice(0, limit);
};

export const searchPlayers = (index: SearchIndex, query: string, limit = 20, keep?: (p: Player) => boolean): SearchEntry[] =>
  searchPlayersScored(index, query, limit, keep).map((x) => x.e);

// ---------- Recent players (shared by the header search and every picker) ----------

export const RECENT_KEY = 'retroVault:search:recent';
const RECENT_MAX = 8;

export const readRecent = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
};

export const pushRecent = (key: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, RECENT_MAX)));
  } catch {
    /* storage unavailable */
  }
};
