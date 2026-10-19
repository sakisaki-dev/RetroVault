import type { Player, Position } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import {
  SIM_MIN_GAMES,
  compFeatures,
  similarityToVector,
  type Comp,
  type CompFeature,
} from '@/config/advanced';
import { isLegend } from './gameUtils';
import { overallFor, positionBaseline, type Overall } from '@/config/skillGrades';

// Grading lives in config/skillGrades.ts (shared with the Player Deep Dive); re-exported for the game.
export {
  GRADE_SCALE,
  fmtFeature,
  gradeFor,
  overallFor,
  ovrFromPercentile,
  percentileOf,
  positionBaseline,
  skillPct,
  skillTraits,
  tierFor,
  traitName,
  type GradeStep,
  type Overall,
} from '@/config/skillGrades';

/**
 * Build-a-Legend: pure logic. Each round spins up one league player at the chosen position; you lock one of
 * his play-style traits (the similarity features) into an open slot. Once every slot is filled the vector is
 * matched against the league with the same score as Player comps (config/advanced.ts similarityToVector).
 */

/** OL only has one style feature (blocks/G), too thin for a draft. */
export const BUILD_POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'LB', 'DB', 'DL'];

export const CLONE_THRESHOLD = 95;
/** A position needs at least this many spin-eligible players to be playable. */
export const MIN_SPIN_POOL = 5;


export interface Slot {
  player: Player;
  value: number;
}

/** League players a spin can land on: no real NFL players, enough games for stable rates. */
export const spinPool = (players: Player[], position: Position) =>
  players.filter((p) => p.position === position && !isLegend(p) && p.games >= SIM_MIN_GAMES);

/**
 * Next spin: a random pool player not landed on yet this game (the history resets once everyone has come up)
 * who has a usable value for at least one open slot.
 */
export const spin = (pool: Player[], position: Position, slots: (Slot | null)[], seen: Set<Player>, rand: () => number = Math.random): Player | null => {
  const feats = compFeatures(position);
  const useful = (p: Player) => feats.some((f, i) => !slots[i] && Number.isFinite(f.get(p)));
  let cand = pool.filter((p) => !seen.has(p) && useful(p));
  if (!cand.length) cand = pool.filter(useful);
  return cand.length ? cand[Math.floor(rand() * cand.length)] : null;
};


export interface BuildResult {
  position: Position;
  features: CompFeature[];
  vector: number[];
  /** Who each trait was taken from, in feature order (null: no player had data for that slot) */
  picks: (Player | null)[];
  matches: Comp[];
  /** The one overall for the build (same function as the live header) */
  overall: Overall | null;
  /** Hall of Famers among the 10 closest matches */
  hofComps: number;
  compsConsidered: number;
}

/** Matches a (possibly partial) build: unfilled slots are NaN and skipped by the similarity score. */
export const matchSlots = (players: Player[], position: Position, slots: (Slot | null)[], count?: number) =>
  similarityToVector(players, position, slots.map((s) => (s ? s.value : NaN)), count);

export const scoreBuild = (players: Player[], position: Position, slots: (Slot | null)[]): BuildResult => {
  const vector = slots.map((s) => (s ? s.value : NaN));
  const matches = similarityToVector(players, position, vector);
  const top10 = matches.slice(0, 10);
  return {
    position,
    features: compFeatures(position),
    vector,
    picks: slots.map((s) => s?.player ?? null),
    matches,
    overall: overallFor(compFeatures(position), positionBaseline(players, position), vector.map((x) => (Number.isFinite(x) ? x : null)), position),
    hofComps: top10.filter((c) => isHallOfFamer(c.player)).length,
    compsConsidered: top10.length,
  };
};

export const hofVerdict = (hof: number, of: number) => {
  if (!of) return { label: 'Too early to say', detail: '' };
  const share = hof / of;
  const detail = `${hof} of his ${of} closest style comps ${hof === 1 ? 'is a Hall of Famer' : 'are Hall of Famers'}.`;
  if (share >= 0.5) return { label: 'Hall of Fame bound', detail };
  if (share >= 0.2) return { label: 'Hall of Fame conversation', detail };
  if (share > 0) return { label: 'Hall of Fame long shot', detail };
  return { label: 'Not a Hall of Fame profile', detail: `None of his ${of} closest style comps made the Hall.` };
};

export const verdictFor = (raw: number, sim = Math.round(raw)) =>
  sim >= CLONE_THRESHOLD
    ? 'Perfect clone'
    : sim >= 85
      ? 'Spitting image'
      : sim >= 70
        ? 'Strong resemblance'
        : sim >= 50
          ? 'Family resemblance'
          : sim >= 30
            ? 'Loose resemblance'
            : 'Faint resemblance: a true original';

