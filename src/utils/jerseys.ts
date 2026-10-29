import { useCallback, useMemo } from 'react';
import type { Player, Position } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { isHallOfFamer } from '@/config/stats';
import { JERSEY_OVERRIDES, LEGEND_NUMBERS, RETIRED_OVERRIDES, type RetiredNumberEntry } from '@/config/jerseys';
import { findNFLTeam, getNFLTeamById } from './nflTeams';

/**
 * Jersey numbers.
 *
 * Every league player gets a number that is:
 *  - realistic for the position (QB 1–19, OL 50–79, ...),
 *  - deterministic: derived from a hash of "POS:Name", so it never changes between reloads,
 *  - unique within the franchise (players grouped by `team`; players with no team share one pool).
 *
 * Priority when two players want the same number: config overrides first, then Hall of Famers
 * (highest legacy first), then everyone else alphabetically. Hall of Famers' numbers are retired by
 * their franchise (tweak with RETIRED_OVERRIDES), and a retired number is never issued to anyone
 * else on that team.
 */

type JerseyPlayer = Pick<Player, 'name' | 'position'> & { team?: string; careerLegacy?: number; inducted?: boolean; isRealLegend?: boolean };

/** Real-life number for a real NFL legend (LEGEND_NUMBERS), else their generated pick. */
export const legendNumber = (p: Pick<Player, 'name' | 'position'>): number => {
  const n = LEGEND_NUMBERS[p.name];
  return isValidNumber(n) ? n : preferredNumbers(p)[0];
};

export interface RetiredNumber {
  number: number;
  name: string;
  position?: string;
  years?: string;
  /** Franchise key (NFL team id, "raw:<name>" for custom teams) */
  teamKey: string;
  /** Display name of the retiring franchise */
  teamLabel: string;
  /** "POS:Name" of the honored league player, when there is one */
  playerKey?: string;
  source: 'hof' | 'config';
}

export interface JerseyIndex {
  /** "POS:Name" -> number */
  numbers: Map<string, number>;
  /** Franchise key -> retired numbers, sorted ascending */
  retired: Map<string, RetiredNumber[]>;
  /** "POS:Name" -> the retirement honoring that player */
  retiredByPlayer: Map<string, RetiredNumber>;
}

export const UNASSIGNED_POOL = '__unassigned__';

/** Stable key used by every jersey map: "QB:Sherman Brandson". */
export const jerseyKey = (p: Pick<Player, 'name' | 'position'>) => `${p.position}:${p.name}`;

/** Franchise pool key for a raw team string: NFL team id, "raw:<name>", or the unassigned pool. */
export const franchiseKey = (team?: string | null): string => {
  const raw = team?.trim();
  if (!raw) return UNASSIGNED_POOL;
  return findNFLTeam(raw)?.id ?? `raw:${raw.toLowerCase()}`;
};

const franchiseLabel = (team?: string | null): string => {
  const raw = team?.trim() ?? '';
  const t = findNFLTeam(raw);
  return t ? t.name : raw;
};

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Realistic NFL ranges per position (current rules, which allow single digits for most skill spots). */
export const POSITION_NUMBER_RANGES: Record<Position, number[]> = {
  QB: range(1, 19),
  RB: [...range(20, 49), ...range(0, 9)],
  WR: [...range(0, 19), ...range(80, 89)],
  TE: [...range(80, 89), ...range(40, 49)],
  OL: range(50, 79),
  LB: [...range(40, 59), ...range(90, 99)],
  DB: [...range(20, 49), ...range(0, 9)],
  DL: [...range(50, 79), ...range(90, 99)],
};

const ALL_NUMBERS = range(0, 99);

const isValidNumber = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99;

/** FNV-1a, 32-bit. */
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const prefCache = new Map<string, number[]>();

/**
 * The player's personal order of preference: position-range numbers first (shuffled by a hash of the
 * name), then every other number. Independent of other players, so adding someone to the league only
 * matters when they collide.
 */
export const preferredNumbers = (p: Pick<Player, 'name' | 'position'>): number[] => {
  const key = jerseyKey(p);
  const cached = prefCache.get(key);
  if (cached) return cached;
  const byHash = (nums: number[]) =>
    nums
      .map((n) => [n, hash(`${key}#${n}`)] as const)
      .sort((a, b) => a[1] - b[1])
      .map(([n]) => n);
  const primary = POSITION_NUMBER_RANGES[p.position as Position] ?? ALL_NUMBERS;
  const primarySet = new Set(primary);
  const list = [...byHash(primary), ...byHash(ALL_NUMBERS.filter((n) => !primarySet.has(n)))];
  prefCache.set(key, list);
  return list;
};


const resolveConfigTeamKey = (k: string) => getNFLTeamById(k)?.id ?? franchiseKey(k);

/** RETIRED_OVERRIDES re-keyed by franchise key. */
const retiredConfigByTeam = () => {
  const map = new Map<string, { add: RetiredNumberEntry[]; remove: Set<number> }>();
  Object.entries(RETIRED_OVERRIDES).forEach(([k, v]) => {
    const key = resolveConfigTeamKey(k);
    const cur = map.get(key) ?? { add: [], remove: new Set<number>() };
    (v.add ?? []).filter((e) => isValidNumber(e.number)).forEach((e) => cur.add.push(e));
    (v.remove ?? []).forEach((n) => cur.remove.add(n));
    map.set(key, cur);
  });
  return map;
};

const matchesEntry = (p: JerseyPlayer, e: RetiredNumberEntry) =>
  !!e.name &&
  (e.name === jerseyKey(p) || (e.name.trim().toLowerCase() === p.name.trim().toLowerCase() && (!e.position || e.position === p.position)));

/** Full assignment + retirements for a set of league players. Pure. */
export const buildJerseyIndex = (players: JerseyPlayer[]): JerseyIndex => {
  const numbers = new Map<string, number>();
  const retired = new Map<string, RetiredNumber[]>();
  const retiredByPlayer = new Map<string, RetiredNumber>();
  const config = retiredConfigByTeam();

  const pools = new Map<string, JerseyPlayer[]>();
  players.forEach((p) => {
    // Real NFL legends wear their real number and stay out of franchise pools and retirements.
    if (p.isRealLegend) {
      numbers.set(jerseyKey(p), legendNumber(p));
      return;
    }
    const k = franchiseKey(p.team);
    pools.set(k, [...(pools.get(k) ?? []), p]);
  });
  // Teams that only appear in RETIRED_OVERRIDES still get their rafters.
  config.forEach((_, k) => {
    if (!pools.has(k)) pools.set(k, []);
  });

  pools.forEach((pool, teamKey) => {
    const isFranchise = teamKey !== UNASSIGNED_POOL;
    const label = franchiseLabel(pool[0]?.team) || getNFLTeamById(teamKey)?.name || teamKey.replace(/^raw:/, '');
    const cfg = isFranchise ? config.get(teamKey) : undefined;
    const taken = new Map<number, string>();
    const teamRetired: RetiredNumber[] = [];

    // 1. Configured retirements: honor the named player, or just reserve the number.
    const configFor = new Map<string, RetiredNumberEntry>();
    cfg?.add.forEach((e) => {
      if (taken.has(e.number)) {
        console.warn(`[jerseys] ${label}: #${e.number} is retired twice in RETIRED_OVERRIDES; keeping the first.`);
        return;
      }
      const holder = pool.find((p) => matchesEntry(p, e) && !configFor.has(jerseyKey(p)));
      const holderKey = holder ? jerseyKey(holder) : `retired:${e.number}`;
      taken.set(e.number, holderKey);
      if (holder) {
        configFor.set(holderKey, e);
        numbers.set(holderKey, e.number);
      }
      teamRetired.push({
        number: e.number,
        name: holder?.name ?? e.name ?? 'Retired',
        position: holder?.position ?? e.position,
        years: e.years,
        teamKey,
        teamLabel: label,
        playerKey: holder ? holderKey : undefined,
        source: 'config',
      });
    });

    // 2. Everyone else, by priority.
    const isHof = (p: JerseyPlayer) => isFranchise && isHallOfFamer({ careerLegacy: p.careerLegacy ?? 0, inducted: p.inducted });
    const rank = (p: JerseyPlayer) => (isValidNumber(JERSEY_OVERRIDES[jerseyKey(p)]) ? 0 : isHof(p) ? 1 : 2);
    const ordered = pool
      .filter((p) => !configFor.has(jerseyKey(p)))
      .sort((a, b) => {
        const r = rank(a) - rank(b);
        if (r) return r;
        if (rank(a) === 1) {
          const d = (b.careerLegacy ?? 0) - (a.careerLegacy ?? 0);
          if (d) return d;
        }
        return jerseyKey(a).localeCompare(jerseyKey(b));
      });

    ordered.forEach((p) => {
      const key = jerseyKey(p);
      if (numbers.has(key) && taken.get(numbers.get(key)!) === key) return; // duplicate row
      const override = JERSEY_OVERRIDES[key];
      let n: number | undefined;
      if (isValidNumber(override)) {
        if (!taken.has(override)) n = override;
        else console.warn(`[jerseys] ${label}: ${key} wants #${override}, already taken by ${taken.get(override)}.`);
      }
      if (n === undefined) {
        const prefs = preferredNumbers(p);
        n = prefs.find((x) => !taken.has(x)) ?? prefs[0];
      }
      taken.set(n, key);
      numbers.set(key, n);

      if (isHof(p) && !cfg?.remove.has(n)) {
        teamRetired.push({ number: n, name: p.name, position: p.position, teamKey, teamLabel: label, playerKey: key, source: 'hof' });
      }
    });

    if (isFranchise && teamRetired.length) {
      teamRetired.sort((a, b) => a.number - b.number);
      retired.set(teamKey, teamRetired);
      teamRetired.forEach((r) => r.playerKey && retiredByPlayer.set(r.playerKey, r));
    }
  });

  return { numbers, retired, retiredByPlayer };
};

/** "POS:Name" -> jersey number for every player passed in. */
export const assignJerseyNumbers = (players: JerseyPlayer[]): Map<string, number> => buildJerseyIndex(players).numbers;

/** Numbers retired by a franchise (team string, abbreviation or id), lowest first. */
export const getRetiredNumbers = (team: string | null | undefined, players: JerseyPlayer[], index?: JerseyIndex): RetiredNumber[] => {
  const key = getNFLTeamById(team)?.id ?? franchiseKey(team);
  return (index ?? buildJerseyIndex(players)).retired.get(key) ?? [];
};

// One shared index per league load, so every table cell can call the hook cheaply.
let cached: { source: unknown; version: number; index: JerseyIndex } | null = null;

/**
 * Jersey numbers for the current league. Recomputes when the league data changes.
 *
 *   const { numberFor, retiredFor, retiredInfo } = useJerseyNumbers();
 *   numberFor(player)        // always a number; isRealLegend players get LEGEND_NUMBERS, others outside the league their hash pick
 *   retiredFor('Bills')      // RetiredNumber[] for the rafters
 *   retiredInfo(player)      // the retirement honoring this player, if any
 */
export const useJerseyNumbers = () => {
  const { getAllPlayers, dataVersion } = useLeague();

  const index = useMemo(() => {
    if (cached && cached.source === getAllPlayers && cached.version === dataVersion) return cached.index;
    const built = buildJerseyIndex(getAllPlayers());
    cached = { source: getAllPlayers, version: dataVersion, index: built };
    return built;
  }, [getAllPlayers, dataVersion]);

  const numberFor = useCallback(
    (p: Pick<Player, 'name' | 'position'> & { isRealLegend?: boolean }): number =>
      p.isRealLegend ? legendNumber(p) : index.numbers.get(jerseyKey(p)) ?? preferredNumbers(p)[0],
    [index],
  );
  const retiredFor = useCallback(
    (team?: string | null): RetiredNumber[] => index.retired.get(getNFLTeamById(team)?.id ?? franchiseKey(team)) ?? [],
    [index],
  );
  const retiredInfo = useCallback(
    (p: Pick<Player, 'name' | 'position'>): RetiredNumber | undefined => index.retiredByPlayer.get(jerseyKey(p)),
    [index],
  );

  return { index, numbers: index.numbers, numberFor, retiredFor, retiredInfo };
};
