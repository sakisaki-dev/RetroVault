import type {
  DBPlayer,
  DLPlayer,
  LeagueData,
  LBPlayer,
  OLPlayer,
  Player,
  QBPlayer,
  RBPlayer,
  TEPlayer,
  WRPlayer,
} from '@/types/player';
import { loadSeasonHistory } from './seasonHistory';

type AnyPlayer = Player;

const keyFor = (p: AnyPlayer) => `${p.position}::${p.name}`;

const diffNum = (nextVal: number, prevVal?: number) => {
  const d = nextVal - (prevVal ?? 0);
  return d < 0 ? 0 : d;
};

/**
 * Check if a player has any prior season history recorded.
 * Players without prior history are considered "new" and should be excluded
 * from season stats (their career totals would otherwise be counted as single-season stats).
 */
export const playerHasPriorHistory = (player: Player): boolean => {
  const history = loadSeasonHistory();
  const playerKey = `${player.position}:${player.name}`;
  const snapshots = history[playerKey] || [];
  return snapshots.length > 0;
};

/**
 * Check if a player existed in the previous season's data.
 */
export const playerExistedInPrev = (player: Player, prevMap: Map<string, AnyPlayer>): boolean => {
  return prevMap.has(keyFor(player));
};

export const diffLeagueData = (prev: LeagueData, next: LeagueData): LeagueData => {
  const prevMap = new Map<string, AnyPlayer>();
  const allPrev: AnyPlayer[] = [
    ...prev.quarterbacks,
    ...prev.runningbacks,
    ...prev.widereceivers,
    ...prev.tightends,
    ...prev.offensiveline,
    ...prev.linebackers,
    ...prev.defensivebacks,
    ...prev.defensiveline,
  ];
  allPrev.forEach((p) => prevMap.set(keyFor(p), p));

  const diffQB = (p: QBPlayer): QBPlayer | null => {
    const old = prevMap.get(keyFor(p)) as QBPlayer | undefined;
    // If player didn't exist in prev, exclude them from season diff
    if (!old) return null;
    return {
      ...p,
      games: diffNum(p.games, old?.games),
      rings: diffNum(p.rings, old?.rings),
      mvp: diffNum(p.mvp, old?.mvp),
      opoy: diffNum(p.opoy, old?.opoy),
      sbmvp: diffNum(p.sbmvp, old?.sbmvp),
      roty: diffNum(p.roty, old?.roty),
      attempts: diffNum(p.attempts, old?.attempts),
      completions: diffNum(p.completions, old?.completions),
      passYds: diffNum(p.passYds, old?.passYds),
      passTD: diffNum(p.passTD, old?.passTD),
      interceptions: diffNum(p.interceptions, old?.interceptions),
      sacks: diffNum(p.sacks, old?.sacks),
      rushAtt: diffNum(p.rushAtt, old?.rushAtt),
      rushYds: diffNum(p.rushYds, old?.rushYds),
      rushTD: diffNum(p.rushTD, old?.rushTD),
    };
  };

  const diffRB = (p: RBPlayer): RBPlayer | null => {
    const old = prevMap.get(keyFor(p)) as RBPlayer | undefined;
    if (!old) return null;
    return {
      ...p,
      games: diffNum(p.games, old?.games),
      rings: diffNum(p.rings, old?.rings),
      mvp: diffNum(p.mvp, old?.mvp),
      opoy: diffNum(p.opoy, old?.opoy),
      sbmvp: diffNum(p.sbmvp, old?.sbmvp),
      roty: diffNum(p.roty, old?.roty),
      rushAtt: diffNum(p.rushAtt, old?.rushAtt),
      rushYds: diffNum(p.rushYds, old?.rushYds),
      rushTD: diffNum(p.rushTD, old?.rushTD),
      fumbles: diffNum(p.fumbles, old?.fumbles),
      receptions: diffNum(p.receptions, old?.receptions),
      recYds: diffNum(p.recYds, old?.recYds),
      recTD: diffNum(p.recTD, old?.recTD),
    };
  };

  const diffWR = (p: WRPlayer): WRPlayer | null => {
    const old = prevMap.get(keyFor(p)) as WRPlayer | undefined;
    if (!old) return null;
    return {
      ...p,
      games: diffNum(p.games, old?.games),
      rings: diffNum(p.rings, old?.rings),
      mvp: diffNum(p.mvp, old?.mvp),
      opoy: diffNum(p.opoy, old?.opoy),
      sbmvp: diffNum(p.sbmvp, old?.sbmvp),
      roty: diffNum(p.roty, old?.roty),
      receptions: diffNum(p.receptions, old?.receptions),
      recYds: diffNum(p.recYds, old?.recYds),
      recTD: diffNum(p.recTD, old?.recTD),
      fumbles: diffNum(p.fumbles, old?.fumbles),
      // longest is career (not additive)
      longest: p.longest,
    };
  };

  const diffTE = (p: TEPlayer): TEPlayer | null => {
    const old = prevMap.get(keyFor(p)) as TEPlayer | undefined;
    if (!old) return null;
    return {
      ...p,
      games: diffNum(p.games, old?.games),
      rings: diffNum(p.rings, old?.rings),
      mvp: diffNum(p.mvp, old?.mvp),
      opoy: diffNum(p.opoy, old?.opoy),
      sbmvp: diffNum(p.sbmvp, old?.sbmvp),
      roty: diffNum(p.roty, old?.roty),
      receptions: diffNum(p.receptions, old?.receptions),
      recYds: diffNum(p.recYds, old?.recYds),
      recTD: diffNum(p.recTD, old?.recTD),
      fumbles: diffNum(p.fumbles, old?.fumbles),
      longest: p.longest,
    };
  };

  const diffOL = (p: OLPlayer): OLPlayer | null => {
    const old = prevMap.get(keyFor(p)) as OLPlayer | undefined;
    if (!old) return null;
    return {
      ...p,
      games: diffNum(p.games, old?.games),
      rings: diffNum(p.rings, old?.rings),
      mvp: diffNum(p.mvp, old?.mvp),
      opoy: diffNum(p.opoy, old?.opoy),
      sbmvp: diffNum(p.sbmvp, old?.sbmvp),
      roty: diffNum(p.roty, old?.roty),
      blocks: diffNum(p.blocks, old?.blocks),
    };
  };

  const diffDEF = <T extends LBPlayer | DBPlayer | DLPlayer>(p: T): T | null => {
    const old = prevMap.get(keyFor(p)) as T | undefined;
    if (!old) return null;
    return {
      ...p,
      games: diffNum(p.games, old?.games),
      rings: diffNum(p.rings, old?.rings),
      mvp: diffNum(p.mvp, old?.mvp),
      opoy: diffNum(p.opoy, old?.opoy),
      sbmvp: diffNum(p.sbmvp, old?.sbmvp),
      roty: diffNum(p.roty, old?.roty),
      tackles: diffNum(p.tackles, old?.tackles),
      interceptions: diffNum(p.interceptions, old?.interceptions),
      sacks: diffNum(p.sacks, old?.sacks),
      forcedFumbles: diffNum(p.forcedFumbles, old?.forcedFumbles),
    };
  };

  return {
    quarterbacks: next.quarterbacks.map(diffQB).filter((p): p is QBPlayer => p !== null),
    runningbacks: next.runningbacks.map(diffRB).filter((p): p is RBPlayer => p !== null),
    widereceivers: next.widereceivers.map(diffWR).filter((p): p is WRPlayer => p !== null),
    tightends: next.tightends.map(diffTE).filter((p): p is TEPlayer => p !== null),
    offensiveline: next.offensiveline.map(diffOL).filter((p): p is OLPlayer => p !== null),
    linebackers: next.linebackers.map((p) => diffDEF(p)).filter((p): p is LBPlayer => p !== null),
    defensivebacks: next.defensivebacks.map((p) => diffDEF(p)).filter((p): p is DBPlayer => p !== null),
    defensiveline: next.defensiveline.map((p) => diffDEF(p)).filter((p): p is DLPlayer => p !== null),
    metadata: next.metadata,
  };
};
