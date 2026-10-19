import type { Player, Position } from '@/types/player';

/**
 * The official OVR (data/y80/formula/OVR.md, ovr.py). One rating everywhere: stats pages and the arcade
 * both rank a player inside the same pool, the "game pool" (league players minus game-exclusions.json,
 * plus the real NFL players from legends.json). Pure functions only; loading lives in utils/useOfficialOvr.
 */

/** Freely licensed photo for a real NFL player (Wikimedia Commons). */
export interface LegendPhoto {
  url: string;
  page?: string;
  author?: string;
  license?: string;
}

/**
 * Players as the arcade sees them. Real-life NFL legends (from /data/legends.json) carry
 * `isRealLegend: true`; they only ever appear inside the games, never elsewhere on the site.
 */
export type GamePlayer = Player & { isRealLegend?: boolean; isCurrentNFL?: boolean; era?: string; photo?: LegendPhoto };

/** Stable "POS:Name" key shared by OVR maps, jersey numbers and game exclusions. */
export const playerKey = (p: Pick<Player, 'name' | 'position'>) => `${p.position}:${p.name}`;

const DEFENSE: Position[] = ['LB', 'DB', 'DL'];

const num = (p: Player, key: string): number => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

const raw = (p: Player, key: string): number | null => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

/** Python's round(): half to even, so scores and OVRs match ovr.py exactly. */
export const pyRound = (x: number) => {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff === 0.5) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
};

/**
 * League Score = production + awards (formula/OVR.md).
 * Awards: ring 40, MVP 90, OPOY 45, DPOY 90, SB MVP 40, ROTY 10 (defenders store DPOY in `opoy`).
 * Missing stats count as 0, except a missing WR/TE TD total, which is estimated as yds / 95.
 */
export const leagueScore = (p: Player): number => {
  const def = DEFENSE.includes(p.position);
  const awards = 40 * num(p, 'rings') + 90 * num(p, 'mvp') + (def ? 90 : 45) * num(p, 'opoy') + 40 * num(p, 'sbmvp') + 10 * num(p, 'roty');
  let production: number;
  switch (p.position) {
    case 'QB':
      production = num(p, 'passYds') / 80 + 0.9 * num(p, 'passTD') + 0.9 * num(p, 'rushTD') - 0.6 * num(p, 'interceptions');
      break;
    case 'RB':
      production =
        num(p, 'rushYds') / 18 + 2.2 * num(p, 'rushTD') + num(p, 'recYds') / 30 + 2.2 * num(p, 'recTD') - 0.8 * num(p, 'fumbles');
      break;
    case 'WR':
    case 'TE': {
      const yds = num(p, 'recYds');
      const td = raw(p, 'recTD') ?? yds / 95;
      production = p.position === 'WR' ? yds / 14 + 2.5 * td - num(p, 'fumbles') : yds / 8 + 3 * td - num(p, 'fumbles');
      break;
    }
    case 'OL':
      production = 5 * num(p, 'blocks') + 2 * num(p, 'games');
      break;
    default:
      production = 0.7 * num(p, 'tackles') + 12 * num(p, 'interceptions') + 14 * num(p, 'sacks') + 14 * num(p, 'forcedFumbles');
  }
  return pyRound(production + awards);
};

/**
 * OVR (62–99) keyed by playerKey: League Score rank within the position across the pool.
 * pct = i / (n − 1), OVR = round(62 + 37 · pct^0.85).
 */
export const ovr = (players: Player[]): Map<string, number> => {
  const out = new Map<string, number>();
  const groups = new Map<Position, Player[]>();
  players.forEach((p) => groups.set(p.position, [...(groups.get(p.position) ?? []), p]));
  groups.forEach((list) => {
    // Stable sort, lowest first (ties keep pool order, as Python's sorted does)
    const sorted = list.map((p) => ({ p, s: leagueScore(p) })).sort((a, b) => a.s - b.s);
    sorted.forEach(({ p }, i) => {
      const pct = sorted.length > 1 ? i / (sorted.length - 1) : 1;
      out.set(playerKey(p), pyRound(62 + 37 * pct ** 0.85));
    });
  });
  return out;
};

/**
 * The game pool: league players minus exclusions, plus real NFL players whose key doesn't collide
 * with a league player (and isn't excluded).
 */
export const buildGamePool = <L extends Player, R extends Player>(league: L[], legends: R[], excluded: Set<string>) => {
  const inLeague = league.filter((p) => !excluded.has(playerKey(p)));
  const taken = new Set(inLeague.map(playerKey));
  const realPlayers = legends.filter((p) => !taken.has(playerKey(p)) && !excluded.has(playerKey(p)));
  return { league: inLeague, legends: realPlayers, pool: [...inLeague, ...realPlayers] as (L | R)[] };
};

/** OVR of a player who is not in `pool` (e.g. a game-excluded league player), ranked as if added to it. */
export const ovrAgainst = (player: Player, pool: Player[]): number | null =>
  ovr([...pool.filter((p) => playerKey(p) !== playerKey(player)), player]).get(playerKey(player)) ?? null;

/**
 * Official OVR map for the whole site: every game-pool player, plus the excluded league players
 * ranked against the pool so their stats page still shows a rating.
 */
export const officialOvrMap = (league: Player[], legends: Player[], excluded: Set<string>): Map<string, number> => {
  const { pool } = buildGamePool(league, legends, excluded);
  const map = ovr(pool);
  league.forEach((p) => {
    if (!map.has(playerKey(p))) {
      const v = ovrAgainst(p, pool);
      if (v != null) map.set(playerKey(p), v);
    }
  });
  return map;
};
