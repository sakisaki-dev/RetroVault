export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'LB' | 'DB' | 'DL';
export type Status = 'Active' | 'Retired';

export interface BasePlayer {
  name: string;
  /** Raw value from sheet (can be number-like or "R"), stored for display only */
  age?: string;
  /** Team name as provided in the sheet */
  team?: string;
  status: Status;
  games: number;
  rings: number;
  mvp: number;
  opoy: number; // OPOY for offense, DPOY for defense
  sbmvp: number;
  roty: number;
  trueTalent: number;
  dominance: number;
  careerLegacy: number;
  tpg: number;
  nickname?: string;
  /** Real-life legend (e.g. Tom Brady). Excluded from league benchmarks and league stats; exposed via `legends`. */
  isRealLegend?: boolean;
  /** True Talent before position normalization (set by `normalizeLeague`). `trueTalent` holds the adjusted value. */
  rawTrueTalent?: number;
  /** Multiplier applied to raw True Talent by `normalizeLeague` (1 when normalization is off). */
  positionFactor?: number;
  /** Skin tone for his generated Retro Bowl sprite (player editor; ignored when sprites.json locks his look) */
  spriteSkin?: string;
}

export interface QBPlayer extends BasePlayer {
  position: 'QB';
  attempts: number;
  completions: number;
  passYds: number;
  passTD: number;
  interceptions: number;
  sacks: number;
  rushAtt: number;
  rushYds: number;
  rushTD: number;
}

export interface RBPlayer extends BasePlayer {
  position: 'RB';
  rushAtt: number;
  rushYds: number;
  rushTD: number;
  fumbles: number;
  receptions: number;
  recYds: number;
  recTD: number;
}

export interface WRPlayer extends BasePlayer {
  position: 'WR';
  receptions: number;
  recYds: number;
  recTD: number;
  fumbles: number;
  longest: number;
}

export interface TEPlayer extends BasePlayer {
  position: 'TE';
  receptions: number;
  recYds: number;
  recTD: number;
  fumbles: number;
  longest: number;
}

export interface OLPlayer extends BasePlayer {
  position: 'OL';
  blocks: number;
}

export interface DefensivePlayer extends BasePlayer {
  tackles: number;
  interceptions: number;
  sacks: number;
  forcedFumbles: number;
}

export interface LBPlayer extends DefensivePlayer {
  position: 'LB';
}

export interface DBPlayer extends DefensivePlayer {
  position: 'DB';
}

export interface DLPlayer extends DefensivePlayer {
  position: 'DL';
}

export type Player = QBPlayer | RBPlayer | WRPlayer | TEPlayer | OLPlayer | LBPlayer | DBPlayer | DLPlayer;

export interface LeagueData {
  quarterbacks: QBPlayer[];
  runningbacks: RBPlayer[];
  widereceivers: WRPlayer[];
  tightends: TEPlayer[];
  offensiveline: OLPlayer[];
  linebackers: LBPlayer[];
  defensivebacks: DBPlayer[];
  defensiveline: DLPlayer[];
  metadata?: {
    season?: string;
    uploadDate?: Date;
  };
}

export interface StatLeader {
  playerName: string;
  value: number;
  position: Position;
}

export interface PositionLeaders {
  [statName: string]: StatLeader;
}
