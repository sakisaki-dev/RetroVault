import type { Player, Position } from '@/types/player';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { HOF_THRESHOLD } from '@/config/stats';
import { normalizeName, type PlayerStints, type StintConfidence } from '@/utils/playerExtras';
import type { SuperBowlEntry } from '@/utils/leagueContent';

/** A player's time with one franchise, from the reconstructed career stints. */
export interface FranchiseStop {
  player: Player;
  from: number;
  to: number;
  /** Super Bowl years he won here */
  rings: number[];
  confidence: StintConfidence;
  /** Years are a placeholder (only the team is known) */
  approx: boolean;
}

export interface TeamSummary {
  /** Stable key: NFL team id, or "raw:<name>" for team strings that don't match an NFL franchise */
  key: string;
  team: NFLTeam | null;
  /** Display name: full NFL name, or the raw sheet value */
  label: string;
  /** Players whose current team is this franchise */
  players: Player[];
  totalLegacy: number;
  avgLegacy: number;
  rings: number;
  mvps: number;
  hallOfFamers: number;
  /** Best player on this roster or in its history (franchise legends count, e.g. Ikarras for the Seahawks) */
  topPlayer: Player | null;
  /** Everyone whose career stints include this franchise, best Career Legacy first */
  legends: FranchiseStop[];
  /** Everyone who ever played here: current roster plus every stint, best Career Legacy first */
  franchisePlayers: Player[];
}

export const POSITION_ORDER: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];

export const POSITION_LABELS: Record<Position, string> = {
  QB: 'Quarterbacks',
  RB: 'Running Backs',
  WR: 'Wide Receivers',
  TE: 'Tight Ends',
  OL: 'Offensive Line',
  DL: 'Defensive Line',
  LB: 'Linebackers',
  DB: 'Defensive Backs',
};

export const DIVISIONS = ['East', 'North', 'South', 'West'] as const;

export const teamKeyFor = (rawTeam?: string | null): string | null => {
  const raw = rawTeam?.trim();
  if (!raw) return null;
  const team = findNFLTeam(raw);
  return team ? team.id : `raw:${raw.toLowerCase()}`;
};

const byLegacy = (a: Player, b: Player) => (b.careerLegacy || 0) - (a.careerLegacy || 0);

/**
 * Groups players by franchise. Players without a team are returned separately. A franchise also gets a page when
 * only its history ties it to the league: a career stint there, or a Super Bowl appearance (`superBowls`).
 */
export const buildTeamSummaries = (
  players: Player[],
  careers: Record<string, PlayerStints> = {},
  superBowls: SuperBowlEntry[] = [],
): { teams: TeamSummary[]; unassigned: Player[] } => {
  const groups = new Map<string, { team: NFLTeam | null; label: string; players: Player[] }>();
  const unassigned: Player[] = [];
  const ensure = (raw: string) => {
    const key = teamKeyFor(raw);
    if (!key) return null;
    if (!groups.has(key)) {
      const team = findNFLTeam(raw);
      groups.set(key, { team, label: team?.fullName ?? raw.trim(), players: [] });
    }
    return key;
  };

  players.forEach((p) => {
    const key = p.team ? ensure(p.team) : null;
    if (!key) unassigned.push(p);
    else groups.get(key)!.players.push(p);
  });

  // Franchise stops from the reconstructed stints (one per player per franchise; repeat stints merge)
  const stops = new Map<string, FranchiseStop[]>();
  players.forEach((p) => {
    const c = p.isRealLegend ? undefined : careers[normalizeName(p.name)];
    c?.stints.forEach((st) => {
      const key = ensure(st.team);
      if (!key) return;
      const list = stops.get(key) ?? [];
      const mine = list.find((x) => x.player === p);
      if (mine) {
        mine.from = Math.min(mine.from, st.from);
        mine.to = Math.max(mine.to, st.to);
        mine.rings = [...mine.rings, ...st.rings].sort((a, b) => a - b);
      } else {
        list.push({ player: p, from: st.from, to: st.to, rings: [...st.rings], confidence: c.confidence, approx: !!c.approx });
      }
      stops.set(key, list);
    });
  });

  // NFL franchises that only appear in the Super Bowl list
  superBowls.forEach((sb) => {
    [sb.winner, sb.loser].forEach((t) => {
      if (t && findNFLTeam(t)) ensure(t);
    });
  });

  const teams: TeamSummary[] = [...groups.entries()].map(([key, g]) => {
    const totalLegacy = g.players.reduce((s, p) => s + (p.careerLegacy || 0), 0);
    const legends = (stops.get(key) ?? []).sort((a, b) => byLegacy(a.player, b.player));
    const franchisePlayers = [...new Set([...g.players, ...legends.map((l) => l.player)])].sort(byLegacy);
    return {
      key,
      team: g.team,
      label: g.label,
      players: g.players,
      totalLegacy: Math.round(totalLegacy),
      avgLegacy: g.players.length ? Math.round(totalLegacy / g.players.length) : 0,
      rings: g.players.reduce((s, p) => s + (p.rings || 0), 0),
      mvps: g.players.reduce((s, p) => s + (p.mvp || 0), 0),
      hallOfFamers: g.players.filter((p) => (p.careerLegacy || 0) >= HOF_THRESHOLD).length,
      topPlayer: franchisePlayers[0] ?? null,
      legends,
      franchisePlayers,
    };
  });

  return { teams, unassigned };
};

// ---------------------------------------------------------------------------
// Franchise records: titles, Hall of Famers, combined legacy, best OVR, power
// ---------------------------------------------------------------------------

export interface FranchiseRecord {
  key: string;
  /** League Super Bowl titles (from the Super Bowl list), any coach */
  titles: number;
  titleYears: number[];
  /** Super Bowl losses */
  lossYears: number[];
  appearances: number;
  /** Titles the owner won while coaching here */
  yourTitleYears: number[];
  /** All-time Hall of Famers who played here (Career Legacy ≥ threshold) */
  hof: Player[];
  /** Combined Career Legacy of everyone who played here */
  legacy: number;
  bestOvr: number | null;
  bestOvrPlayer: Player | null;
  /** 0–100 blend of titles, Hall of Famers, legacy and best OVR (see POWER_WEIGHTS) */
  power: number;
  powerRank: number;
}

/** How the franchise power score is blended (each part is scaled to the league's best franchise). */
export const POWER_WEIGHTS = { titles: 0.35, hof: 0.25, legacy: 0.25, ovr: 0.15 } as const;

export const buildFranchiseRecords = (
  teams: TeamSummary[],
  superBowls: SuperBowlEntry[],
  ovrFor: (p: Player) => number | null,
): Map<string, FranchiseRecord> => {
  const sbFor = new Map<string, { won: number[]; lost: number[]; yours: number[] }>();
  const slot = (key: string) => {
    if (!sbFor.has(key)) sbFor.set(key, { won: [], lost: [], yours: [] });
    return sbFor.get(key)!;
  };
  superBowls.forEach((sb) => {
    const w = teamKeyFor(sb.winner);
    const l = teamKeyFor(sb.loser);
    if (w) {
      slot(w).won.push(sb.year);
      if (sb.yourResult === 'won') slot(w).yours.push(sb.year);
    }
    if (l) slot(l).lost.push(sb.year);
  });

  const rows = teams.map((t) => {
    const sb = sbFor.get(t.key) ?? { won: [], lost: [], yours: [] };
    let bestOvr: number | null = null;
    let bestOvrPlayer: Player | null = null;
    t.franchisePlayers.forEach((p) => {
      const o = ovrFor(p);
      if (o != null && (bestOvr == null || o > bestOvr)) {
        bestOvr = o;
        bestOvrPlayer = p;
      }
    });
    return {
      key: t.key,
      titles: sb.won.length,
      titleYears: [...sb.won].sort((a, b) => a - b),
      lossYears: [...sb.lost].sort((a, b) => a - b),
      appearances: sb.won.length + sb.lost.length,
      yourTitleYears: sb.yours,
      hof: t.franchisePlayers.filter((p) => (p.careerLegacy || 0) >= HOF_THRESHOLD),
      legacy: Math.round(t.franchisePlayers.reduce((s, p) => s + (p.careerLegacy || 0), 0)),
      bestOvr: bestOvr as number | null,
      bestOvrPlayer: bestOvrPlayer as Player | null,
      power: 0,
      powerRank: 0,
    };
  });

  const max = (f: (r: FranchiseRecord) => number) => Math.max(1, ...rows.map(f));
  const maxT = max((r) => r.titles);
  const maxH = max((r) => r.hof.length);
  const maxL = max((r) => r.legacy);
  const ovrs = rows.map((r) => r.bestOvr).filter((o): o is number => o != null);
  const minO = ovrs.length ? Math.min(...ovrs) : 0;
  const spanO = ovrs.length ? Math.max(1, Math.max(...ovrs) - minO) : 1;
  rows.forEach((r) => {
    const ovrPart = r.bestOvr == null ? 0 : (r.bestOvr - minO) / spanO;
    r.power = Math.round(
      100 *
        (POWER_WEIGHTS.titles * (r.titles / maxT) +
          POWER_WEIGHTS.hof * (r.hof.length / maxH) +
          POWER_WEIGHTS.legacy * (r.legacy / maxL) +
          POWER_WEIGHTS.ovr * ovrPart),
    );
  });
  [...rows]
    .sort((a, b) => b.power - a.power || b.titles - a.titles || b.legacy - a.legacy)
    .forEach((r, i) => (r.powerRank = i + 1));
  return new Map(rows.map((r) => [r.key, r]));
};

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type TeamSortKey = 'power' | 'titles' | 'hof' | 'legacy' | 'division' | 'name';

export const TEAM_SORTS: { key: TeamSortKey; label: string }[] = [
  { key: 'power', label: 'Power' },
  { key: 'titles', label: 'Titles' },
  { key: 'hof', label: 'Hall of Famers' },
  { key: 'legacy', label: 'Legacy' },
  { key: 'division', label: 'Division' },
  { key: 'name', label: 'A–Z' },
];

export const divisionKey = (t: TeamSummary) =>
  t.team ? `${t.team.conference}-${DIVISIONS.indexOf(t.team.division)}` : 'ZZZ';

const nameOf = (t: TeamSummary) => t.team?.name ?? t.label;

export const sortTeams = (teams: TeamSummary[], key: TeamSortKey, records: Map<string, FranchiseRecord>): TeamSummary[] => {
  const rec = (t: TeamSummary) => records.get(t.key);
  const byPower = (a: TeamSummary, b: TeamSummary) => (rec(a)?.powerRank ?? 999) - (rec(b)?.powerRank ?? 999);
  const sorted = [...teams];
  switch (key) {
    case 'titles':
      return sorted.sort((a, b) => (rec(b)?.titles ?? 0) - (rec(a)?.titles ?? 0) || (rec(b)?.appearances ?? 0) - (rec(a)?.appearances ?? 0) || byPower(a, b));
    case 'hof':
      return sorted.sort((a, b) => (rec(b)?.hof.length ?? 0) - (rec(a)?.hof.length ?? 0) || byPower(a, b));
    case 'legacy':
      return sorted.sort((a, b) => (rec(b)?.legacy ?? 0) - (rec(a)?.legacy ?? 0));
    case 'name':
      return sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    case 'division':
      return sorted.sort((a, b) => divisionKey(a).localeCompare(divisionKey(b)) || byPower(a, b));
    default:
      return sorted.sort(byPower);
  }
};

export const groupByPosition = (players: Player[]): { position: Position; players: Player[] }[] =>
  POSITION_ORDER.map((position) => ({
    position,
    players: players.filter((p) => p.position === position).sort(byLegacy),
  })).filter((g) => g.players.length > 0);

// ---------------------------------------------------------------------------
// Franchise page helpers
// ---------------------------------------------------------------------------

export interface LeaderStat {
  key: string;
  label: string;
  get: (p: Player) => number | null;
}

const isDefender = (p: Player) => p.position === 'LB' || p.position === 'DB' || p.position === 'DL';

/** Career stats shown as franchise leaders. QB sacks/INTs are taken/thrown, so those count defenders only. */
export const LEADER_STATS: LeaderStat[] = [
  { key: 'passYds', label: 'Passing yards', get: (p) => (p.position === 'QB' ? p.passYds : null) },
  { key: 'passTD', label: 'Passing TD', get: (p) => (p.position === 'QB' ? p.passTD : null) },
  { key: 'rushYds', label: 'Rushing yards', get: (p) => ('rushYds' in p ? p.rushYds : null) },
  { key: 'recYds', label: 'Receiving yards', get: (p) => ('recYds' in p ? p.recYds : null) },
  { key: 'tackles', label: 'Tackles', get: (p) => (isDefender(p) && 'tackles' in p ? p.tackles : null) },
  { key: 'sacks', label: 'Sacks', get: (p) => (isDefender(p) && 'sacks' in p ? p.sacks : null) },
  { key: 'int', label: 'Interceptions', get: (p) => (isDefender(p) && 'interceptions' in p ? p.interceptions : null) },
  { key: 'blocks', label: 'Blocks', get: (p) => (p.position === 'OL' ? p.blocks : null) },
  { key: 'rings', label: 'Rings', get: (p) => p.rings || 0 },
  { key: 'mvp', label: 'MVPs', get: (p) => p.mvp || 0 },
];

export interface LeaderRow {
  stat: LeaderStat;
  top: { player: Player; value: number }[];
}

/** Top three per stat among the given players (zeros are left out). */
export const franchiseLeaders = (players: Player[]): LeaderRow[] =>
  LEADER_STATS.map((stat) => ({
    stat,
    top: players
      .map((player) => ({ player, value: stat.get(player) ?? 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value || byLegacy(a.player, b.player))
      .slice(0, 3),
  })).filter((r) => r.top.length > 0);

export interface PositionStrength {
  position: Position;
  best: Player | null;
  /** League percentile (0–100) of the best player's Career Legacy at his position */
  pct: number;
}

/** For each position, the franchise's best-ever player and where he ranks in the league at that position. */
export const positionStrength = (franchise: Player[], league: Player[]): PositionStrength[] =>
  POSITION_ORDER.map((position) => {
    const best = franchise.filter((p) => p.position === position).sort(byLegacy)[0] ?? null;
    if (!best) return { position, best, pct: 0 };
    const peers = league.filter((p) => p.position === position && !p.isRealLegend);
    const below = peers.filter((p) => (p.careerLegacy || 0) <= (best.careerLegacy || 0)).length;
    return { position, best, pct: peers.length ? Math.round((100 * below) / peers.length) : 0 };
  });

/** "Y20–26, Y51–53" from coaching stints */
export const tenureText = (stints: { firstYear: number; lastYear: number }[]) =>
  stints.map((s) => (s.firstYear === s.lastYear ? `Y${s.firstYear}` : `Y${s.firstYear}–${s.lastYear}`)).join(', ');
