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

type AnyPlayer = Player;

const keyFor = (p: AnyPlayer) => `${p.position}::${p.name}`;

const diffNum = (nextVal: number, prevVal?: number) => {
  const d = nextVal - (prevVal ?? 0);
  return d < 0 ? 0 : d;
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

  const diffQB = (p: QBPlayer): QBPlayer => {
    const old = prevMap.get(keyFor(p)) as QBPlayer | undefined;
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
    linebackers: next.linebackers.map((p) => diffDEF(p) as LBPlayer),
    defensivebacks: next.defensivebacks.map((p) => diffDEF(p) as DBPlayer),
    defensiveline: next.defensiveline.map((p) => diffDEF(p) as DLPlayer),
    metadata: next.metadata,
  };
};
