import type { Player, Position } from '@/types/player';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { HOF_THRESHOLD } from '@/config/stats';
import { normalizeName, type PlayerStints, type StintConfidence } from '@/utils/playerExtras';

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

export const teamKeyFor = (rawTeam?: string | null): string | null => {
  const raw = rawTeam?.trim();
  if (!raw) return null;
  const team = findNFLTeam(raw);
  return team ? team.id : `raw:${raw.toLowerCase()}`;
};

/** Groups players by franchise. Players without a team are returned separately. */
export const buildTeamSummaries = (
  players: Player[],
  careers: Record<string, PlayerStints> = {},
): { teams: TeamSummary[]; unassigned: Player[] } => {
  const groups = new Map<string, { team: NFLTeam | null; label: string; players: Player[] }>();
  const unassigned: Player[] = [];

  players.forEach((p) => {
    const key = teamKeyFor(p.team);
    if (!key) {
      unassigned.push(p);
      return;
    }
    if (!groups.has(key)) {
      const team = findNFLTeam(p.team);
      groups.set(key, { team, label: team?.fullName ?? p.team!.trim(), players: [] });
    }
    groups.get(key)!.players.push(p);
  });

  // Franchise stops from the reconstructed stints (one per player per franchise; repeat stints merge)
  const stops = new Map<string, FranchiseStop[]>();
  players.forEach((p) => {
    const c = p.isRealLegend ? undefined : careers[normalizeName(p.name)];
    c?.stints.forEach((st) => {
      const key = teamKeyFor(st.team);
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

  const teams: TeamSummary[] = [...groups.entries()].map(([key, g]) => {
    const totalLegacy = g.players.reduce((s, p) => s + (p.careerLegacy || 0), 0);
    const legends = (stops.get(key) ?? []).sort((a, b) => (b.player.careerLegacy || 0) - (a.player.careerLegacy || 0));
    const topPlayer = [...g.players, ...legends.map((l) => l.player)].reduce<Player | null>(
      (best, p) => (!best || (p.careerLegacy || 0) > (best.careerLegacy || 0) ? p : best),
      null,
    );
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
      topPlayer,
      legends,
    };
  });

  return { teams, unassigned };
};

export type TeamSortKey = 'legacy' | 'rings' | 'mvps' | 'players' | 'name' | 'division';

export const TEAM_SORTS: { key: TeamSortKey; label: string }[] = [
  { key: 'legacy', label: 'Σ Legacy' },
  { key: 'rings', label: 'Rings' },
  { key: 'mvps', label: 'MVPs' },
  { key: 'players', label: 'Players' },
  { key: 'division', label: 'Division' },
  { key: 'name', label: 'A–Z' },
];

const divisionKey = (t: TeamSummary) =>
  t.team ? `${t.team.conference}-${['East', 'North', 'South', 'West'].indexOf(t.team.division)}` : 'ZZZ';

export const sortTeams = (teams: TeamSummary[], key: TeamSortKey): TeamSummary[] => {
  const byLegacy = (a: TeamSummary, b: TeamSummary) => b.totalLegacy - a.totalLegacy;
  const sorted = [...teams];
  switch (key) {
    case 'rings':
      return sorted.sort((a, b) => b.rings - a.rings || byLegacy(a, b));
    case 'mvps':
      return sorted.sort((a, b) => b.mvps - a.mvps || byLegacy(a, b));
    case 'players':
      return sorted.sort((a, b) => b.players.length - a.players.length || byLegacy(a, b));
    case 'name':
      return sorted.sort((a, b) => (a.team?.name ?? a.label).localeCompare(b.team?.name ?? b.label));
    case 'division':
      return sorted.sort(
        (a, b) => divisionKey(a).localeCompare(divisionKey(b)) || (a.team?.name ?? a.label).localeCompare(b.team?.name ?? b.label),
      );
    default:
      return sorted.sort(byLegacy);
  }
};

export const groupByPosition = (players: Player[]): { position: Position; players: Player[] }[] =>
  POSITION_ORDER.map((position) => ({
    position,
    players: players
      .filter((p) => p.position === position)
      .sort((a, b) => (b.careerLegacy || 0) - (a.careerLegacy || 0)),
  })).filter((g) => g.players.length > 0);
