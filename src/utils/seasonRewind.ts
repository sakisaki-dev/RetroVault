import { useEffect, useState } from "react";
import type { SeasonRewindIndexEntry } from "./leagueContent";
import { dataFetch } from '@/utils/dataStore';

/**
 * Season Rewind (scripts/season_rewind.py): a tap-through recap of each completed season, every card a template
 * filled from the data. content.json carries the index (seasonRewindIndex); each season's cards are
 * public/data/league/rewind/<Y>.json, loaded on demand and memoized per file.
 */

export type RewindKind =
  | "cover"
  | "champion"
  | "awards"
  | "records"
  | "milestones"
  | "market"
  | "hof"
  | "farewells"
  | "power"
  | "rivalry"
  | "tribute"
  | "story"
  | "take"
  | "outro";

export interface RewindFigure {
  label: string;
  value: string;
  /** For a count-up: the number, with its prefix, suffix and decimals */
  num?: number;
  pre?: string;
  suf?: string;
  dec?: number;
}

export interface RewindPlayer {
  key: string;
  name: string;
  team?: string;
  star?: boolean;
  award?: string;
  awardName?: string;
  line?: string;
  figures?: RewindFigure[];
  label?: string;
  note?: string;
  num?: number;
  pct?: number;
  value?: number;
  was?: number;
  ovr?: number;
  grade?: string;
  firstBallot?: boolean;
  legacy?: number;
  rings?: number;
  games?: number;
  reason?: string;
  gap?: number;
  share?: number;
  holder?: string;
}

export interface RewindRow {
  label: string;
  mark: string;
  scope: "club" | "league";
  players: RewindPlayer[];
  team?: string;
  note?: string;
  num?: number;
  suf?: string;
}

export interface RewindLink {
  story?: string;
  take?: string;
  tribute?: string;
  season?: string;
  /** A rivalry file (content.json rivalryFiles id) */
  rivalry?: string;
}

export interface RewindCard {
  id: string;
  n: number;
  kind: RewindKind;
  club?: string;
  kicker: string;
  title: string;
  text?: string;
  figures?: RewindFigure[];
  players?: RewindPlayer[];
  rows?: RewindRow[];
  teams: string[];
  link?: RewindLink;
  quoted?: boolean;
  heat?: number;
  gauntlet?: boolean;
  count?: number;
  ringHolders?: number;
  score?: string;
  result?: string;
  next?: string;
  upset?: {
    winner: string;
    loser: string;
    score: string;
    week: number;
    winnerRecord: string;
    loserRecord: string;
  };
  live?: { club: string; week: number; record: string };
  /** rivalry: the season's meetings (the coach's score first) */
  meetings?: { week: number; round: string; for: number; against: number; result: "W" | "L" | "T" }[];
}

export interface SeasonRewind {
  season: string;
  club?: string;
  record?: string;
  finish?: string;
  champion?: string;
  next?: string;
  cards: RewindCard[];
}

const KINDS: RewindKind[] = [
  "cover",
  "champion",
  "awards",
  "records",
  "milestones",
  "market",
  "hof",
  "farewells",
  "power",
  "rivalry",
  "tribute",
  "story",
  "take",
  "outro",
];

const normalize = (r: unknown, season: string): SeasonRewind | null => {
  if (!r || typeof r !== "object") return null;
  const x = r as Partial<SeasonRewind>;
  if (x.season !== season || !Array.isArray(x.cards)) return null;
  const cards = x.cards.filter(
    (c): c is RewindCard =>
      !!c &&
      typeof c === "object" &&
      typeof c.id === "string" &&
      KINDS.includes(c.kind) &&
      typeof c.title === "string",
  );
  return cards.length
    ? {
        ...x,
        season,
        cards: cards.map((c) => ({
          ...c,
          teams: Array.isArray(c.teams) ? c.teams : [],
        })),
      }
    : null;
};

const requests = new Map<string, Promise<SeasonRewind | null>>();
const loaded = new Map<string, SeasonRewind | null>();

/** One season's rewind (memoized per file; a failed load may be retried). Never throws. */
export const loadSeasonRewind = (
  entry: Pick<SeasonRewindIndexEntry, "season" | "file">,
): Promise<SeasonRewind | null> => {
  let req = requests.get(entry.file);
  if (!req) {
    req = dataFetch(`${import.meta.env.BASE_URL}data/league/${entry.file}`, {
      cache: "no-cache",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => normalize(json, entry.season))
      .catch(() => null)
      .then((r) => {
        loaded.set(entry.file, r);
        if (!r) requests.delete(entry.file);
        return r;
      });
    requests.set(entry.file, req);
  }
  return req;
};

/** A season's rewind: `loading` until its file is in; `rewind` null when it failed. */
export const useSeasonRewind = (
  entry: SeasonRewindIndexEntry | null | undefined,
) => {
  const file = entry?.file;
  const [state, setState] = useState<{
    file?: string;
    rewind: SeasonRewind | null;
  }>(() => ({
    file: file && loaded.has(file) ? file : undefined,
    rewind: (file && loaded.get(file)) || null,
  }));
  useEffect(() => {
    if (!entry) return;
    let alive = true;
    loadSeasonRewind(entry).then(
      (rewind) => alive && setState({ file: entry.file, rewind }),
    );
    return () => {
      alive = false;
    };
  }, [entry]);
  const ready = !!file && (state.file === file || loaded.has(file));
  const rewind = ready
    ? state.file === file
      ? state.rewind
      : (loaded.get(file!) ?? null)
    : null;
  return { rewind, loading: !!entry && !ready };
};

// ---------------------------------------------------------------------------
// Seen state (per viewer, a convenience only): a season counts as seen at its current card count, so a rebuild that
// adds cards (a story written later) lights its ring again
// ---------------------------------------------------------------------------
const SEEN_KEY = "retroVault:rewindSeen";
const SEEN_EVENT = "rv:rewind-seen";

const readSeen = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
};

const seenId = (e: Pick<SeasonRewindIndexEntry, "season" | "count">) =>
  `${e.season}:${e.count}`;

export const markRewindSeen = (
  e: Pick<SeasonRewindIndexEntry, "season" | "count">,
) => {
  try {
    const cur = readSeen();
    const id = seenId(e);
    if (cur.includes(id)) return;
    const next = [
      id,
      ...cur.filter((x) => !x.startsWith(`${e.season}:`)),
    ].slice(0, 200);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: rings just stay gold */
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
};

/** The seen seasons ("Y94:12" ids), kept in step across components */
export const useRewindSeen = () => {
  const [seen, setSeen] = useState<string[]>(() => readSeen());
  useEffect(() => {
    const on = () => setSeen(readSeen());
    window.addEventListener(SEEN_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(SEEN_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return (e: Pick<SeasonRewindIndexEntry, "season" | "count">) =>
    seen.includes(seenId(e));
};

// ---------------------------------------------------------------------------
// Opening a season from elsewhere (the Arcade ticker): a request made before the Timeline mounts waits for it
// ---------------------------------------------------------------------------
export const OPEN_REWIND_EVENT = "rv:open-rewind";
let pending: string | null = null;
export const openSeasonRewind = (season: string) => {
  pending = season;
  window.dispatchEvent(new CustomEvent(OPEN_REWIND_EVENT, { detail: season }));
};
export const takePendingRewind = (): string | null => {
  const s = pending;
  pending = null;
  return s;
};
