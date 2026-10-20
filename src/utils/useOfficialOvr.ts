import { useEffect, useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import type { Position } from '@/types/player';
import { normalizeLeague } from '@/config/stats';
import { buildGamePool, officialOvrMap, type GamePlayer, type LegendPhoto } from '@/config/ovr';

// ---------- Loaders (one request per page load; 404 / bad JSON resolve to empty) ----------

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
const BASE_NUMBERS = ['games', 'rings', 'mvp', 'opoy', 'sbmvp', 'roty', 'trueTalent', 'dominance', 'careerLegacy', 'tpg'] as const;

const normalizePhoto = (raw: unknown): LegendPhoto | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.url !== 'string' || !/^https:\/\//.test(r.url)) return undefined;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const page = str(r.page);
  return { url: r.url, page: page && /^https:\/\//.test(page) ? page : undefined, author: str(r.author), license: str(r.license) };
};

const normalizeLegend = (raw: unknown): GamePlayer | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim() || !POSITIONS.includes(r.position as Position)) return null;
  const out: Record<string, unknown> = {
    ...r,
    name: r.name.trim(),
    isRealLegend: true,
    status: r.status === 'Active' ? 'Active' : 'Retired',
    photo: normalizePhoto(r.photo),
  };
  BASE_NUMBERS.forEach((k) => {
    const v = Number(r[k]);
    out[k] = Number.isFinite(v) ? v : 0;
  });
  return out as unknown as GamePlayer;
};

let legendsRequest: Promise<GamePlayer[]> | null = null;
let exclusionsRequest: Promise<Set<string>> | null = null;

const fetchJson = (path: string): Promise<unknown> =>
  fetch(`${import.meta.env.BASE_URL}${path}`)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

/** Fetches /data/legends.json once per page load. Missing file, 404 or bad JSON all resolve to []. */
export const loadLegends = (): Promise<GamePlayer[]> => {
  legendsRequest ??= fetchJson('data/legends.json').then((data) =>
    Array.isArray(data) ? data.map(normalizeLegend).filter((p): p is GamePlayer => !!p) : [],
  );
  return legendsRequest;
};

/** Fetches /data/game-exclusions.json ({ excludeFromGames: ["RB:Name", ...] }); missing file resolves to an empty set. */
export const loadExclusions = (): Promise<Set<string>> => {
  exclusionsRequest ??= fetchJson('data/game-exclusions.json').then((data) => {
    const list = (data as { excludeFromGames?: unknown } | null)?.excludeFromGames;
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : []);
  });
  return exclusionsRequest;
};

// ---------- Hooks ----------

/**
 * The game pool from context + legends.json − game-exclusions.json, plus the official OVR map over it.
 * `loaded` turns true once both files have resolved (OVRs before that would shift, so the map is empty).
 */
export const useGamePool = () => {
  const { getAllPlayers, dataVersion } = useLeague();
  const [allLegends, setAllLegends] = useState<GamePlayer[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadLegends(), loadExclusions()]).then(([list, ex]) => {
      if (!alive) return;
      setAllLegends(list);
      setExcluded(ex);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const allLeague = useMemo<GamePlayer[]>(() => getAllPlayers(), [getAllPlayers]);
  // Legends arrive with raw True Talent only: put them on the league's position factors and derive Dominance,
  // Career Legacy and TPG the same way as league players (legends never influence the factors)
  const scaledLegends = useMemo(
    () => (allLegends.length ? (normalizeLeague([...allLeague, ...allLegends]).slice(allLeague.length) as GamePlayer[]) : allLegends),
    [allLeague, allLegends],
  );
  const { league, legends } = useMemo(() => buildGamePool(allLeague, scaledLegends, excluded), [allLeague, scaledLegends, excluded]);
  const ovrMap = useMemo(
    () => (loaded ? officialOvrMap(allLeague, scaledLegends, excluded) : new Map<string, number>()),
    [loaded, allLeague, scaledLegends, excluded],
  );

  return { league, legends, ovrMap, loaded, dataVersion };
};

/**
 * Official OVR for stats pages: Map keyed by "POS:Name" (see playerKey). Same numbers as the arcade.
 * Empty until legends.json / game-exclusions.json resolve (both tolerate 404s).
 */
export const useOfficialOvr = (): Map<string, number> => useGamePool().ovrMap;
