import type { Player } from '@/types/player';
import { ovr, ovrAgainst, playerKey } from '@/config/ovr';

const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);

/** "Patrick Surtain II" -> { first: "Patrick", last: "Surtain II" }; one-word names are all "last". */
export const splitPlayerName = (name: string): { first: string; last: string } => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: '', last: parts[0] ?? '' };
  let cut = parts.length - 1;
  if (SUFFIXES.has(parts[cut].toLowerCase()) && cut > 1) cut -= 1;
  return { first: parts.slice(0, cut).join(' '), last: parts.slice(cut).join(' ') };
};

const poolCache = new WeakMap<Player[], Map<string, number>>();

/**
 * The official OVR (62–99, src/config/ovr.ts) for the banner badge, so a player's rating is identical on
 * stats pages and in the arcade. Pass the map from useOfficialOvr() (preferred: it is built over the game
 * pool, league minus exclusions plus legends.json), or a player pool to rank against. Null when unknown.
 */
export const overallRating = (player: Player, pool: Map<string, number> | Player[]): number | null => {
  const key = playerKey(player);
  if (pool instanceof Map) return pool.get(key) ?? null;
  let map = poolCache.get(pool);
  if (!map) {
    map = ovr(pool);
    poolCache.set(pool, map);
  }
  return map.get(key) ?? ovrAgainst(player, pool);
};
