/**
 * Hall of Fame / Ring of Honor watch.
 *
 * Remembers which players were already Hall of Famers (localStorage 'retroVault:hofSeen') and which
 * retired numbers were already hanging in the rafters ('retroVault:ringSeen'). When league data
 * changes and someone new crosses HOF_THRESHOLD (or a franchise newly retires a number), a ceremony
 * is queued and the class is recorded ('retroVault:hofClasses') for the Hall of Fame tab.
 *
 * First run (nothing stored yet): the current state is stored silently, so an existing league does
 * not trigger a flood of ceremonies. The HOF tab offers "Watch the inaugural class" instead.
 *
 * Ceremonies are played by <CeremonyHost/> (mounted once in pages/Index.tsx); anything can ask it to
 * play via `playCeremony()`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import type { JerseyIndex, RetiredNumber } from './jerseys';
import { useLeagueContent } from './leagueContent';

export const HOF_SEEN_KEY = 'retroVault:hofSeen';
export const RING_SEEN_KEY = 'retroVault:ringSeen';
export const HOF_CLASSES_KEY = 'retroVault:hofClasses';

const PLAY_EVENT = 'retroVault:ceremony-play';
const CLASSES_EVENT = 'retroVault:hof-classes-changed';

/** Most ceremonies played automatically after one data change (the strongest legacies first). */
export const MAX_AUTO_CEREMONIES = 8;
/** Size of the "inaugural class" when nothing has been recorded yet. */
export const INAUGURAL_CLASS_SIZE = 5;

export type CeremonyVariant = 'hof' | 'ring';

export interface CeremonyEntry {
  /** `${position}:${name}` */
  key: string;
  /** 'hof' = Hall of Fame induction (with the retired-number banner when there is one); 'ring' = Ring of Honor only */
  variant: CeremonyVariant;
}

export interface CeremonyRequest {
  entries: CeremonyEntry[];
  /** Big title line, e.g. "Class of Y80" or "Inaugural class" */
  classLabel?: string;
}

export interface HofClass {
  /** Season label ("Y80") or a date-based fallback */
  label: string;
  /** Player keys, strongest legacy first */
  keys: string[];
  /** ms timestamp of the last update */
  at: number;
}

export const hofKey = (p: Pick<Player, 'name' | 'position'>) => `${p.position}:${p.name}`;
const ringKey = (r: RetiredNumber) => `${r.playerKey}@${r.teamKey}#${r.number}`;

// ---------------------------------------------------------------------------
// Storage (every access is guarded: private mode / disabled storage must never break the app)
// ---------------------------------------------------------------------------

const readSet = (key: string): Set<string> | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === 'string')) : null;
  } catch {
    return null;
  }
};

const writeSet = (key: string, set: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify([...set].sort()));
  } catch {
    /* storage unavailable */
  }
};

export const readHofClasses = (): HofClass[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HOF_CLASSES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is HofClass => !!c && typeof c.label === 'string' && Array.isArray(c.keys) && typeof c.at === 'number',
    );
  } catch {
    return [];
  }
};

const writeHofClasses = (classes: HofClass[]) => {
  try {
    localStorage.setItem(HOF_CLASSES_KEY, JSON.stringify(classes.slice(-20)));
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new Event(CLASSES_EVENT));
  } catch {
    /* non-browser */
  }
};

/** Adds keys to the class with this label (or starts a new one). */
const recordClass = (label: string, keys: string[]) => {
  if (!keys.length) return;
  const classes = readHofClasses();
  const last = classes[classes.length - 1];
  if (last && last.label === label) {
    last.keys = [...last.keys, ...keys.filter((k) => !last.keys.includes(k))];
    last.at = Date.now();
  } else {
    classes.push({ label, keys, at: Date.now() });
  }
  writeHofClasses(classes);
};

// ---------------------------------------------------------------------------
// Detection (pure)
// ---------------------------------------------------------------------------

export interface WatchResult {
  /** True when nothing was stored before: state was saved silently */
  firstRun: boolean;
  /** Ceremonies to play, strongest legacy first (Ring of Honor-only entries last) */
  entries: CeremonyEntry[];
  /** Every new Hall of Famer key (may exceed the auto-played entries) */
  newHof: string[];
  nextHofSeen: Set<string>;
  nextRingSeen: Set<string>;
}

export const detectNewHonors = (
  players: Player[],
  jerseys: Pick<JerseyIndex, 'retiredByPlayer'>,
  prevHof: Set<string> | null,
  prevRing: Set<string> | null,
): WatchResult => {
  const hofPlayers = players.filter(isHallOfFamer).sort((a, b) => b.careerLegacy - a.careerLegacy);
  const legacyOf = new Map(players.map((p) => [hofKey(p), p.careerLegacy]));
  const hofKeys = hofPlayers.map(hofKey);

  const retired = [...jerseys.retiredByPlayer.values()].filter((r) => !!r.playerKey && legacyOf.has(r.playerKey));
  const ringKeys = retired.map(ringKey);

  const nextHofSeen = new Set([...(prevHof ?? []), ...hofKeys]);
  const nextRingSeen = new Set([...(prevRing ?? []), ...ringKeys]);

  if (!prevHof) {
    return { firstRun: true, entries: [], newHof: [], nextHofSeen, nextRingSeen };
  }

  const newHof = hofKeys.filter((k) => !prevHof.has(k));
  // A missing ring set (added after hofSeen existed) is treated as a silent baseline too
  const newRingPlayers = prevRing
    ? retired.filter((r) => !prevRing.has(ringKey(r))).map((r) => r.playerKey as string)
    : [];

  const entries: CeremonyEntry[] = newHof.map((key) => ({ key, variant: 'hof' }));
  newRingPlayers
    .filter((key) => !newHof.includes(key))
    .sort((a, b) => (legacyOf.get(b) ?? 0) - (legacyOf.get(a) ?? 0))
    .forEach((key) => entries.push({ key, variant: 'ring' }));

  return { firstRun: false, entries: entries.slice(0, MAX_AUTO_CEREMONIES), newHof, nextHofSeen, nextRingSeen };
};

// ---------------------------------------------------------------------------
// Ceremony bus
// ---------------------------------------------------------------------------

/** Ask the mounted <CeremonyHost/> to play these ceremonies (in order). */
export const playCeremony = (request: CeremonyRequest) => {
  if (!request.entries.length) return;
  try {
    window.dispatchEvent(new CustomEvent<CeremonyRequest>(PLAY_EVENT, { detail: request }));
  } catch {
    /* non-browser */
  }
};

/** Subscribe to ceremony requests (used by CeremonyHost). */
export const useCeremonyRequests = (onRequest: (r: CeremonyRequest) => void) => {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CeremonyRequest>).detail;
      if (detail?.entries?.length) onRequest(detail);
    };
    window.addEventListener(PLAY_EVENT, handler);
    return () => window.removeEventListener(PLAY_EVENT, handler);
  }, [onRequest]);
};

/** Recorded classes, newest last; updates when a new class is recorded. */
/**
 * Hall of Fame classes: the shared ones from content.json (same on every device) first, then any class this
 * browser recorded later for players the shared data doesn't place yet.
 */
export const useHofClasses = (): HofClass[] => {
  const { content } = useLeagueContent();
  const [local, setClasses] = useState<HofClass[]>(() => readHofClasses());
  useEffect(() => {
    const refresh = () => setClasses(readHofClasses());
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOF_CLASSES_KEY) refresh();
    };
    window.addEventListener(CLASSES_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CLASSES_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return useMemo(() => {
    const shared: HofClass[] = (content?.hofClasses ?? []).map((c) => ({ label: c.label, keys: c.keys, at: 0 }));
    const placed = new Set(shared.flatMap((c) => c.keys));
    const extra = local.map((c) => ({ ...c, keys: c.keys.filter((k) => !placed.has(k)) })).filter((c) => c.keys.length);
    return [...shared, ...extra];
  }, [content, local]);
};

/** "Class of Y80" style label for a season string, with a sensible fallback. */
export const classLabelFor = (season?: string | null) =>
  season ? `Class of ${season}` : `Class of ${new Date().getFullYear()}`;

/**
 * Watches league data and queues ceremonies for new honorees. Debounced so the burst of loads on
 * startup (stored sheet, then the refreshed bundled league) settles before comparing.
 */
export const useHallOfFameWatch = ({
  players,
  jerseys,
  ready,
  version,
  season,
  onCeremony,
}: {
  players: Player[];
  jerseys: Pick<JerseyIndex, 'retiredByPlayer'>;
  /** False while there is no league data */
  ready: boolean;
  /** Changes whenever league data changes (dataVersion, careerData identity…) */
  version: unknown;
  season?: string | null;
  onCeremony: (r: CeremonyRequest) => void;
}) => {
  const run = useCallback(() => {
    if (!ready || !players.length) return;
    const result = detectNewHonors(players, jerseys, readSet(HOF_SEEN_KEY), readSet(RING_SEEN_KEY));
    writeSet(HOF_SEEN_KEY, result.nextHofSeen);
    writeSet(RING_SEEN_KEY, result.nextRingSeen);
    if (result.firstRun) return;
    const label = season ?? null;
    if (result.newHof.length) recordClass(label ?? `${new Date().getFullYear()}`, result.newHof);
    if (result.entries.length) onCeremony({ entries: result.entries, classLabel: classLabelFor(label) });
  }, [ready, players, jerseys, season, onCeremony]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(run, 1200);
    return () => window.clearTimeout(t);
    // `version` is the trigger; `run` already captures the latest data
  }, [ready, version, run]);
};
