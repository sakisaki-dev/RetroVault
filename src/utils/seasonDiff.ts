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

// Threshold for considering a player a "rookie" - their full career stats become their season stats
const ROOKIE_GAMES_THRESHOLD = 21;

/**
 * Check if a player is a rookie (new to the league with less than threshold games).
 * Rookies should have their full career stats counted as their first season.
 */
export const isRookiePlayer = (player: Player): boolean => {
  return player.games <= ROOKIE_GAMES_THRESHOLD;
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

  // Helper: if player is a rookie (not in prev AND has <= ROOKIE_GAMES_THRESHOLD games), 
  // their full career stats are their season stats
  const handleNewPlayer = <T extends Player>(p: T): T => {
    // This is a rookie - their career stats ARE their season stats
    return { ...p };
  };

  const diffQB = (p: QBPlayer): QBPlayer => {
    const old = prevMap.get(keyFor(p)) as QBPlayer | undefined;
    // If player didn't exist in prev and has <= threshold games, they're a rookie
    if (!old) {
      if (isRookiePlayer(p)) {
        return handleNewPlayer(p);
      }
      // Veteran new to tracking - exclude by returning zeroed stats
      return {
        ...p,
        games: 0,
        rings: 0,
        mvp: 0,
        opoy: 0,
        sbmvp: 0,
        roty: 0,
        attempts: 0,
        completions: 0,
        passYds: 0,
        passTD: 0,
        interceptions: 0,
        sacks: 0,
        rushAtt: 0,
        rushYds: 0,
        rushTD: 0,
      };
    }
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

  const diffRB = (p: RBPlayer): RBPlayer => {
    const old = prevMap.get(keyFor(p)) as RBPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      return {
        ...p,
        games: 0, rings: 0, mvp: 0, opoy: 0, sbmvp: 0, roty: 0,
        rushAtt: 0, rushYds: 0, rushTD: 0, fumbles: 0,
        receptions: 0, recYds: 0, recTD: 0,
      };
    }
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

  const diffWR = (p: WRPlayer): WRPlayer => {
    const old = prevMap.get(keyFor(p)) as WRPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      return {
        ...p,
        games: 0, rings: 0, mvp: 0, opoy: 0, sbmvp: 0, roty: 0,
        receptions: 0, recYds: 0, recTD: 0, fumbles: 0, longest: 0,
      };
    }
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

  const diffTE = (p: TEPlayer): TEPlayer => {
    const old = prevMap.get(keyFor(p)) as TEPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      return {
        ...p,
        games: 0, rings: 0, mvp: 0, opoy: 0, sbmvp: 0, roty: 0,
        receptions: 0, recYds: 0, recTD: 0, fumbles: 0, longest: 0,
      };
    }
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

  const diffOL = (p: OLPlayer): OLPlayer => {
    const old = prevMap.get(keyFor(p)) as OLPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      return {
        ...p,
        games: 0, rings: 0, mvp: 0, opoy: 0, sbmvp: 0, roty: 0, blocks: 0,
      };
    }
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

  const diffDEF = <T extends LBPlayer | DBPlayer | DLPlayer>(p: T): T => {
    const old = prevMap.get(keyFor(p)) as T | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      return {
        ...p,
        games: 0, rings: 0, mvp: 0, opoy: 0, sbmvp: 0, roty: 0,
        tackles: 0, interceptions: 0, sacks: 0, forcedFumbles: 0,
      } as T;
    }
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
    quarterbacks: next.quarterbacks.map(diffQB),
    runningbacks: next.runningbacks.map(diffRB),
    widereceivers: next.widereceivers.map(diffWR),
    tightends: next.tightends.map(diffTE),
    offensiveline: next.offensiveline.map(diffOL),
    linebackers: next.linebackers.map((p) => diffDEF(p)),
    defensivebacks: next.defensivebacks.map((p) => diffDEF(p)),
    defensiveline: next.defensiveline.map((p) => diffDEF(p)),
    metadata: next.metadata,
  };
};
