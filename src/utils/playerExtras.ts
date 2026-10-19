import { useEffect, useState } from 'react';

// Optional per-player extras from public/data/player-extras.json (built by scripts/build_league_data.py).
// Everything here is secondary display info and must never be merged into league career totals.

/** Pre-league real NFL career line. Keys vary by position; `years` is e.g. "2018-2025". */
export type RealNflCareer = { years?: string } & Record<string, number | string | undefined>;

/** In-game player card extras; any subset of keys may be present. */
export type PlayerCardExtras = Record<string, number | string | boolean | undefined>;

export interface PlayerExtras {
  realNflCareer: Record<string, RealNflCareer>;
  cards: Record<string, PlayerCardExtras>;
  /** current name -> former name */
  formerNames: Record<string, string>;
  /** player name -> relation text, e.g. "son of Tyrion Kline" */
  family: Record<string, string>;
}

const EMPTY: PlayerExtras = { realNflCareer: {}, cards: {}, formerNames: {}, family: {} };

/** Name key that ignores case, extra spaces and curly vs straight apostrophes/quotes. */
export const normalizeName = (name: string) =>
  name
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const reindex = <T,>(rec: unknown): Record<string, T> => {
  const out: Record<string, T> = {};
  if (rec && typeof rec === 'object') {
    Object.entries(rec as Record<string, T>).forEach(([k, v]) => {
      out[normalizeName(k)] = v;
    });
  }
  return out;
};

/** Original-cased map, keyed by normalized name (used where the display name matters). */
const reindexWithName = (rec: unknown): Record<string, { name: string; value: string }> => {
  const out: Record<string, { name: string; value: string }> = {};
  if (rec && typeof rec === 'object') {
    Object.entries(rec as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v === 'string') out[normalizeName(k)] = { name: k, value: v };
    });
  }
  return out;
};

export interface IndexedExtras {
  realNflCareer: Record<string, RealNflCareer>;
  cards: Record<string, PlayerCardExtras>;
  formerNames: Record<string, string>;
  family: Record<string, { name: string; value: string }>;
}

const toIndexed = (raw: Partial<PlayerExtras>): IndexedExtras => ({
  realNflCareer: reindex<RealNflCareer>(raw.realNflCareer),
  cards: reindex<PlayerCardExtras>(raw.cards),
  formerNames: reindex<string>(raw.formerNames),
  family: reindexWithName(raw.family),
});

const EMPTY_INDEXED = toIndexed(EMPTY);

let cache: IndexedExtras | null = null;
let inflight: Promise<IndexedExtras> | null = null;

/** Fetches the extras file once per session. Missing file (404) or bad JSON resolves to empty extras. */
export const loadPlayerExtras = (): Promise<IndexedExtras> => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    const url = `${import.meta.env.BASE_URL}data/player-extras.json`;
    inflight = fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<Partial<PlayerExtras>>) : EMPTY))
      .catch(() => EMPTY)
      .then((raw) => {
        cache = toIndexed(raw ?? EMPTY);
        return cache;
      });
  }
  return inflight;
};

/** React hook: empty extras until loaded, then the indexed file contents. */
export const usePlayerExtras = (): IndexedExtras => {
  const [extras, setExtras] = useState<IndexedExtras>(cache ?? EMPTY_INDEXED);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadPlayerExtras().then((e) => alive && setExtras(e));
    return () => {
      alive = false;
    };
  }, []);
  return extras;
};

export interface FamilyTie {
  /** Relation text as shown, e.g. "Son of" or "Family" */
  label: string;
  /** The other player's name */
  name: string;
}

/**
 * Family ties for a player: their own entry ("son of X" -> Son of X) plus reverse links from players
 * who list them ("Y: son of <player>" -> Y, son).
 */
export const getFamilyTies = (extras: IndexedExtras, playerName: string): FamilyTie[] => {
  const me = normalizeName(playerName);
  const ties: FamilyTie[] = [];
  const parse = (text: string) => {
    const m = text.match(/^\s*(.+?)\s+of\s+(.+?)\s*$/i);
    return m ? { relation: m[1], other: m[2] } : null;
  };
  const own = extras.family[me];
  if (own) {
    const p = parse(own.value);
    if (p) ties.push({ label: `${p.relation[0].toUpperCase()}${p.relation.slice(1)} of`, name: p.other });
  }
  Object.entries(extras.family).forEach(([key, { name, value }]) => {
    if (key === me) return;
    const p = parse(value);
    if (p && normalizeName(p.other) === me) ties.push({ label: `Family (${p.relation.toLowerCase()})`, name });
  });
  return ties;
};
