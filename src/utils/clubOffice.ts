import { useEffect, useState } from 'react';

/**
 * The Front Office dashboard's model of the club (public/data/league/save_state.json, written by a save.state upload
 * from scripts/save_read.py --state): the coach's roster with its contracts, the coordinators, the club's settings and
 * the game's lifetime counters, plus the game's own rules over them, read from its code (docs/SAVE_INVENTORY.md 7.1
 * stars, 7.2 salary, 7.3 trades, 7.7 facilities, 7.8 team strength). Every tag here is a deterministic rule; nothing is
 * written by hand. Facts only: no morale, bio is age only, never the game's own Hall of Fame (CLAUDE.md, Save import).
 */

export interface OfficePlayer {
  team: string;
  age: number;
  speed: number;
  strength: number;
  skill: number;
  stamina: number;
  max_speed: number;
  max_strength: number;
  max_skill: number;
  max_stamina: number;
  injury_week: number;
  /** Contract years left, 1 to 3 ("likely": not checked against a screen) */
  contract: number;
  salary: number;
  delay_retirement: number;
  xp_level: number;
  /** The game's own position (CB and S apart); older imports lack it */
  spos?: string;
  /** The season the coach last signed, re-signed or traded for him (absent: never) */
  signed_year?: number;
}

export interface OfficeStaff {
  role: 'OC' | 'DC';
  name: string;
  /** 1 to 10 half-stars (10 = 5 stars) */
  rating: number;
  age: number;
  contract: number;
  trait: number;
  xp_level: number;
  delay_retirement: number;
}

export interface OfficeSettings {
  facilities: Record<FacilityId, number>;
  salary_cap: number;
  salary_cap_base?: number;
  fans: number;
  coach_rating: number;
  credits?: number;
  draft_picks?: number[];
  games_coached?: number;
  difficulty?: number;
  training?: { offense: number; defense: number };
  roster_cap?: number;
  /** The week each facility was upgraded this season (0 = not yet) */
  facilities_upgraded?: Record<FacilityId, number>;
}

export interface OfficeState {
  id: string;
  upload: string;
  season: number;
  week: number;
  club: string;
  settings: OfficeSettings;
  staff?: OfficeStaff[];
  counters?: Record<string, number>;
  players: Record<string, OfficePlayer>;
}

let cache: OfficeState | null | undefined;
let request: Promise<OfficeState | null> | null = null;

export const loadOfficeState = (): Promise<OfficeState | null> => {
  request ??= fetch(`${import.meta.env.BASE_URL}data/league/save_state.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<OfficeState>) : null))
    .catch(() => null)
    .then((s) => (cache = s && s.settings && s.players ? s : null));
  return request;
};

/** undefined while loading, null when no save has been imported. */
export const useOfficeState = (): OfficeState | null | undefined => {
  const [data, setData] = useState<OfficeState | null | undefined>(cache);
  useEffect(() => {
    if (cache !== undefined) return;
    let alive = true;
    loadOfficeState().then((s) => alive && setData(s));
    return () => {
      alive = false;
    };
  }, []);
  return data;
};

// ---------------------------------------------------------------------------------------------------------------
// The game's rules (read from its code; docs/SAVE_INVENTORY.md section 7)
// ---------------------------------------------------------------------------------------------------------------

/** Rating total for 10 half-stars, by the game's position (7.1). */
export const POS_MAX: Record<string, number> = { QB: 37, RB: 34, TE: 33, WR: 34, OL: 35, DL: 35, LB: 33, CB: 33, S: 33, DB: 33, K: 37 };
/** Salary per star, by the game's position (7.2). */
export const POS_PAY: Record<string, number> = { QB: 1.66, RB: 1, TE: 0.9, WR: 1.1, OL: 0.8, DL: 1, LB: 0.9, CB: 0.8, S: 0.75, K: 0.55 };
/** Max age: QB and K 40, everyone else 35, staff 65, plus any retirement delays. */
export const maxAge = (spos: string, delay = 0) => (spos === 'QB' || spos === 'K' || spos === 'P' ? 40 : spos === 'OC' || spos === 'DC' ? 65 : 35) + delay;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ratingSum = (p: OfficePlayer, ceiling = false) =>
  ceiling ? p.max_speed + p.max_strength + p.max_skill + p.max_stamina : p.speed + p.strength + p.skill + p.stamina;

/** The game's star rating in half-stars (1 to 10): round(10 × ratings / POS_MAX), the card's stars (7.1). */
export const halfStars = (p: OfficePlayer, spos: string, ceiling = false) => clamp(Math.round((10 * ratingSum(p, ceiling)) / (POS_MAX[spos] ?? 35)), 1, 10);

/** The salary formula's age factor (7.2, checked in the game's code): rookie 0.6; years to max age under 2 0.55, 3 0.65, 4 0.75, 5 0.85. */
export const ageFactor = (age: number, max: number) => {
  if (age === 21) return 0.6;
  const left = max - age;
  return left < 2 ? 0.55 : left < 3 ? 0.65 : left < 4 ? 0.75 : left < 5 ? 0.85 : 1;
};

/** The game's salary price: round(stars × POS_PAY × 3 × age factor). Salary is fixed at signing; an expiring deal re-prices with this. */
export const salaryPrice = (stars: number, spos: string, age: number, max: number) => Math.round(stars * (POS_PAY[spos] ?? 1) * 3 * ageFactor(age, max));

export type PayTag = 'underpaid' | 'fair' | 'overpaid';
/** Paid against price: within max(1, 10% of the price) is fair. */
export const payTag = (paid: number, price: number): { tag: PayTag; gap: number; band: number } => {
  const band = Math.max(1, Math.round(price * 0.1));
  const gap = paid - price;
  return { tag: gap <= -band ? 'underpaid' : gap >= band ? 'overpaid' : 'fair', gap, band };
};

/** The pick the game offers when the coach trades him away (7.3, the game's own valuation): 1st at 8+ half-stars, 2nd at 4+, else 3rd. */
export const tradeRound = (stars: number) => (stars >= 8 ? 1 : stars >= 4 ? 2 : 3);
export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export interface CapRow {
  key: string;
  name: string;
  /** Retro Vault position (players.json) */
  pos: string;
  /** The game's position (CB / S apart) */
  spos: string;
  p: OfficePlayer;
  stars: number;
  ceiling: number;
  price: number;
  pay: ReturnType<typeof payTag>;
  trade: number;
  /** Signed this season: the game warns before trading him */
  signedNow: boolean;
  /** His final season (he turns max age at its end) */
  finalSeason: number;
  /** Expires at this season's end: his next deal at today's stars, a year older */
  nextPrice: number | null;
  nextYears: string | null;
}

const POS_TO_SAVE: Record<string, string> = { DB: 'CB' };

export const capRows = (s: OfficeState): CapRow[] =>
  Object.entries(s.players)
    .filter(([, p]) => p.team === s.club)
    .map(([key, p]) => {
      const i = key.indexOf(':');
      const pos = key.slice(0, i);
      const spos = p.spos ?? POS_TO_SAVE[pos] ?? pos;
      const max = maxAge(spos, p.delay_retirement);
      const stars = halfStars(p, spos);
      const price = salaryPrice(stars, spos, p.age, max);
      const expiring = p.contract <= 1;
      return {
        key,
        name: key.slice(i + 1),
        pos,
        spos,
        p,
        stars,
        ceiling: halfStars(p, spos, true),
        price,
        pay: payTag(p.salary, price),
        trade: tradeRound(stars),
        signedNow: p.signed_year === s.season,
        // NFL edition: nobody plays at max age, so the final season is played at max age - 1
        finalSeason: s.season + Math.max(0, max - 1 - p.age),
        nextPrice: expiring && p.age + 1 < max ? salaryPrice(stars, spos, p.age + 1, max) : null,
        nextYears: expiring && p.age + 1 < max ? (p.age + 1 > max - 3 ? '1 year' : '2 to 3 years') : null,
      };
    });

// ---- Team strength (7.8) ----
const OFFENSE = new Set(['QB', 'RB', 'WR', 'TE', 'OL']);
export interface Strength {
  side: 'offense' | 'defense';
  factor: number;
  stars: number;
  coord: number;
  raw: number;
  rating: number;
}
/** offense = clamp(round(0.225 × (offensive key players' stars + OC rating)), 1, 10); defense the same with 0.25 and the DC. */
export const teamStrength = (rows: CapRow[], staff: OfficeStaff[]): Strength[] =>
  (['offense', 'defense'] as const).map((side) => {
    const factor = side === 'offense' ? 0.225 : 0.25;
    const stars = rows.filter((r) => OFFENSE.has(r.pos) === (side === 'offense')).reduce((a, r) => a + r.stars, 0);
    const coord = staff.find((c) => c.role === (side === 'offense' ? 'OC' : 'DC'))?.rating ?? 0;
    const raw = factor * (stars + coord);
    return { side, factor, stars, coord, raw, rating: clamp(Math.round(raw), 1, 10) };
  });

/** A coordinator's final season: staff retire on reaching 65 (+ delays), like players at their max age. */
export const staffFinalSeason = (season: number, c: OfficeStaff) => season + Math.max(0, maxAge(c.role, c.delay_retirement) - 1 - c.age);

// ---- Facilities (7.7) ----
export type FacilityId = 'stadium' | 'training' | 'rehab';
export const FACILITY_MAX = 10;
/**
 * At each season's end the game rolls irandom(2): 0 stadium, 1 training, 2 rehab; a facility not upgraded that season
 * and above level 1 loses a level. Roll 1 falls through to the rehab check in the game's code (no break), so rehab is
 * at risk two times in three.
 */
export const DECLINE_CHANCE: Record<FacilityId, number> = { stadium: 1 / 3, training: 1 / 3, rehab: 2 / 3 };
export const FACILITY_ROLE: Record<FacilityId, string> = {
  stadium: 'Fans per game and the fan rating',
  training: 'XP every game: 2 per level',
  rehab: 'Injury caps, injury length and weekly recovery',
};
export interface FacilityRisk {
  id: FacilityId;
  level: number;
  upgradedWeek: number;
  /** Chance it loses a level at this season's end (0 when upgraded this season or at level 1) */
  risk: number;
  /** Credits to upgrade (or, at the max, to protect it this season): the next level, capped at 10 */
  cost: number;
}
export const facilityRisks = (st: OfficeSettings): FacilityRisk[] =>
  (['stadium', 'training', 'rehab'] as const).map((id) => {
    const level = st.facilities[id] ?? 0;
    const upgradedWeek = st.facilities_upgraded?.[id] ?? 0;
    return { id, level, upgradedWeek, risk: upgradedWeek > 0 || level <= 1 ? 0 : DECLINE_CHANCE[id], cost: Math.min(level + 1, FACILITY_MAX) };
  });

export const DIFFICULTY: Record<number, string> = { 1: 'Easy', 2: 'Normal', 3: 'Hard', 4: 'Extreme' };
export const TRAINING: Record<number, string> = { 1: 'Light', 2: 'Normal', 3: 'Hard' };

// ---- Lifetime counters (the save's achievements.list; scripts/save_read.py COUNTER_TAGS) ----
export interface CounterGroup {
  title: string;
  items: { tag: string; label: string; note?: string }[];
}
export const COUNTER_GROUPS: CounterGroup[] = [
  {
    title: 'Roster building',
    items: [
      { tag: 'ACH_TRADEIN', label: 'Trades in' },
      { tag: 'ACH_TRADEOUT', label: 'Trades out' },
      { tag: 'ACH_DRAFT', label: 'Draftees' },
      { tag: 'ACH_FREEAGENT', label: 'Free agents signed' },
      { tag: 'ACH_FREEAGENT5', label: '5-star free agents' },
      { tag: 'ACH_CUT', label: 'Players cut' },
      { tag: 'ACH_HIRE_OF', label: 'OCs hired' },
      { tag: 'ACH_HIRE_DF', label: 'DCs hired' },
    ],
  },
  {
    title: 'Results',
    items: [
      { tag: 'ACH_WIN1', label: 'Wins', note: 'Regular season and playoffs' },
      { tag: 'ACH_WINNING_SEASON', label: 'Winning seasons' },
      { tag: 'ACH_UNBEATEN_SEASON', label: 'Unbeaten seasons', note: 'Perfect regular seasons' },
      { tag: 'ACH_WIN_DIVISION', label: 'Division titles' },
      { tag: 'ACH_WIN_AFC', label: 'AFC titles' },
      { tag: 'ACH_WIN_NFC', label: 'NFC titles' },
      { tag: 'ACH_TEAMS2', label: 'Clubs taken over' },
      { tag: 'ACH_WIN_NOSTARQB', label: 'Wins without a star QB' },
    ],
  },
  {
    title: 'Game feats',
    items: [
      { tag: 'ACH_SHUTOUT', label: 'Shutouts' },
      { tag: 'ACH_SCORE50', label: '50-point games' },
      { tag: 'ACH_GAME_PASS_400', label: '400-yard passing games' },
      { tag: 'ACH_GAME_PASS_500', label: '500-yard passing games' },
      { tag: 'ACH_GAME_COMPLETE_100', label: 'Perfect passing games', note: '100% completions' },
      { tag: 'ACH_GAME_RUSH_150', label: '150-yard rushing games' },
      { tag: 'ACH_TD_QB', label: 'QB touchdowns', note: 'Scored by the QB himself' },
      { tag: 'ACH_FIELDGOAL50', label: '50-yard field goals' },
      { tag: 'ACH_DOINK', label: 'Doinks', note: 'Field goals off the post' },
    ],
  },
  {
    title: 'Facilities',
    items: [
      { tag: 'ACH_UPGRADE_STADIUM', label: 'Stadium upgrades' },
      { tag: 'ACH_UPGRADE_TRAINING', label: 'Training upgrades' },
      { tag: 'ACH_UPGRADE_REHAB', label: 'Rehab upgrades' },
      { tag: 'ACH_MAX_STADIUM', label: 'Stadium maxed' },
      { tag: 'ACH_MAX_TRAINING', label: 'Training maxed' },
      { tag: 'ACH_MAX_REHAB', label: 'Rehab maxed' },
    ],
  },
];
