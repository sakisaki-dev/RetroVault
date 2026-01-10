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

/**
 * Get the most recent season number from history for a player
 */
const getPlayerLatestSeasonNumber = (playerKey: string): number => {
  const history = loadSeasonHistory();
  const snapshots = history[playerKey] || [];
  if (snapshots.length === 0) return 0;
  
  // Extract season numbers and find the max
  const seasonNumbers = snapshots.map(s => {
    const match = s.season.match(/Y?(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  });
  return Math.max(...seasonNumbers);
};

/**
 * Check if there's a season gap (e.g., uploading Y6 when last tracked was Y4)
 */
export const hasSeasonGap = (currentSeasonName: string, playerKey: string): boolean => {
  const currentSeasonNum = parseInt((currentSeasonName || '').replace(/\D/g, ''), 10) || 0;
  const lastTrackedSeason = getPlayerLatestSeasonNumber(playerKey);
  
  // If no history, no gap
  if (lastTrackedSeason === 0) return false;
  
  // Gap exists if current season is more than 1 higher than last tracked
  return currentSeasonNum > lastTrackedSeason + 1;
};

export const diffLeagueData = (prev: LeagueData, next: LeagueData, currentSeasonName?: string): LeagueData => {
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

  // Helper: Check if we should skip this player due to season gap
  const shouldSkipDueToSeasonGap = (p: Player): boolean => {
    if (!currentSeasonName) return false;
    const playerKey = `${p.position}:${p.name}`;
    return hasSeasonGap(currentSeasonName, playerKey) && !isRookiePlayer(p);
  };

  // Helper: Zero out stats for players that should be skipped
  const createZeroedPlayer = <T extends Player>(p: T): T => {
    const base = {
      ...p,
      games: 0,
      rings: 0,
      mvp: 0,
      opoy: 0,
      sbmvp: 0,
      roty: 0,
    };

    if (p.position === 'QB') {
      return {
        ...base,
        attempts: 0,
        completions: 0,
        passYds: 0,
        passTD: 0,
        interceptions: 0,
        sacks: 0,
        rushAtt: 0,
        rushYds: 0,
        rushTD: 0,
      } as T;
    } else if (p.position === 'RB') {
      return {
        ...base,
        rushAtt: 0,
        rushYds: 0,
        rushTD: 0,
        fumbles: 0,
        receptions: 0,
        recYds: 0,
        recTD: 0,
      } as T;
    } else if (p.position === 'WR' || p.position === 'TE') {
      return {
        ...base,
        receptions: 0,
        recYds: 0,
        recTD: 0,
        fumbles: 0,
        longest: 0,
      } as T;
    } else if (p.position === 'OL') {
      return {
        ...base,
        blocks: 0,
      } as T;
    } else {
      return {
        ...base,
        tackles: 0,
        interceptions: 0,
        sacks: 0,
        forcedFumbles: 0,
      } as T;
    }
  };

  const diffQB = (p: QBPlayer): QBPlayer => {
    // Check for season gap - if so, zero out stats (except rookies)
    if (shouldSkipDueToSeasonGap(p)) {
      return createZeroedPlayer(p);
    }

    const old = prevMap.get(keyFor(p)) as QBPlayer | undefined;
    // If player didn't exist in prev and has <= threshold games, they're a rookie
    if (!old) {
      if (isRookiePlayer(p)) {
        return handleNewPlayer(p);
      }
      // Check if they have prior history - if yes, they exist but weren't in this prev snapshot
      // This could happen with season gaps - return zeroed stats
      if (playerHasPriorHistory(p)) {
        return createZeroedPlayer(p);
      }
      // Truly new veteran (first time appearing) - also zero out
      return createZeroedPlayer(p);
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
    if (shouldSkipDueToSeasonGap(p)) {
      return createZeroedPlayer(p);
    }

    const old = prevMap.get(keyFor(p)) as RBPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      if (playerHasPriorHistory(p)) return createZeroedPlayer(p);
      return createZeroedPlayer(p);
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
    if (shouldSkipDueToSeasonGap(p)) {
      return createZeroedPlayer(p);
    }

    const old = prevMap.get(keyFor(p)) as WRPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      if (playerHasPriorHistory(p)) return createZeroedPlayer(p);
      return createZeroedPlayer(p);
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
    if (shouldSkipDueToSeasonGap(p)) {
      return createZeroedPlayer(p);
    }

    const old = prevMap.get(keyFor(p)) as TEPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      if (playerHasPriorHistory(p)) return createZeroedPlayer(p);
      return createZeroedPlayer(p);
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
    if (shouldSkipDueToSeasonGap(p)) {
      return createZeroedPlayer(p);
    }

    const old = prevMap.get(keyFor(p)) as OLPlayer | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      if (playerHasPriorHistory(p)) return createZeroedPlayer(p);
      return createZeroedPlayer(p);
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
    if (shouldSkipDueToSeasonGap(p)) {
      return createZeroedPlayer(p);
    }

    const old = prevMap.get(keyFor(p)) as T | undefined;
    if (!old) {
      if (isRookiePlayer(p)) return handleNewPlayer(p);
      if (playerHasPriorHistory(p)) return createZeroedPlayer(p);
      return createZeroedPlayer(p);
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
