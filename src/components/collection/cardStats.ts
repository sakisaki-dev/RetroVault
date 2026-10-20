import type { Player, Position } from '@/types/player';
import { compFeatures, type CompFeature } from '@/config/advanced';
import { percentileOf, positionBaseline, skillPct } from '@/config/skillGrades';

/**
 * The six face stats on a collectible card (FUT layout: two columns of three). Each is a 0–99 number from the
 * player's per-position percentile, using the same skill traits and league baseline as Deep Dive
 * (config/skillGrades). Real NFL legends are rated on the league scale too (they never enter the baseline).
 * Positions with fewer than six traits fill in with career numbers (volume, games, True Talent, …), also as
 * percentiles among league players at the position.
 */

export interface FaceStat {
  /** Two or three letter code shown on the card, e.g. "ARM" */
  code: string;
  /** Full name for the legend / tooltip */
  name: string;
  /** 0–99, null when the stat has no denominator */
  value: number | null;
}

/** Percentile (0–100) → face number: 30 at the bottom, 99 at the top, about 70 for a median starter. */
export const faceRating = (pct: number) => Math.round(30 + 69 * (Math.min(100, Math.max(0, pct)) / 100) ** 0.8);

type Spec = { code: string; name: string } & ({ trait: string } | { career: (p: Player) => number });

const n = (p: Player, k: string) => {
  const v = (p as unknown as Record<string, unknown>)[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

const GAMES: Spec = { code: 'DUR', name: 'Durability (games played)', career: (p) => p.games };
const DEF: Spec[] = [
  { code: 'TKL', name: 'Tackling (tackles per game)', trait: 'tklG' },
  { code: 'RSH', name: 'Pass rush (sacks per game)', trait: 'sackG' },
  { code: 'COV', name: 'Coverage (interceptions per game)', trait: 'intG' },
  { code: 'FF', name: 'Strip (forced fumbles per game)', trait: 'ffG' },
  { code: 'IMP', name: 'Impact plays per game', trait: 'impactG' },
  GAMES,
];
const REC: Spec[] = [
  { code: 'PRD', name: 'Production (receiving yards per game)', trait: 'recYdsG' },
  { code: 'BIG', name: 'Big play (yards per catch)', trait: 'ypr' },
  { code: 'TD', name: 'Red zone (TD per catch)', trait: 'tdPerRec' },
  { code: 'HND', name: 'Hands (catches per game)', trait: 'recG' },
  { code: 'SEC', name: 'Ball security (fumbles per catch, inverted)', trait: 'fumRate' },
  { code: 'VOL', name: 'Volume (career receiving yards)', career: (p) => n(p, 'recYds') },
];

/** Six stats per position, left column first. */
export const FACE_SPECS: Record<Position, Spec[]> = {
  QB: [
    { code: 'ARM', name: 'Arm (yards per attempt)', trait: 'ya' },
    { code: 'ACC', name: 'Accuracy (completion %)', trait: 'cmp' },
    { code: 'TD', name: 'Gunslinger (TD %)', trait: 'tdPct' },
    { code: 'DEC', name: 'Decision making (INT %, inverted)', trait: 'intPct' },
    { code: 'CLT', name: 'Clutch (passer rating)', trait: 'rating' },
    { code: 'VOL', name: 'Volume (passing yards per game)', trait: 'passYdsG' },
  ],
  RB: [
    { code: 'VIS', name: 'Vision (yards per carry)', trait: 'ypc' },
    { code: 'WRK', name: 'Workhorse (rushing yards per game)', trait: 'rushYdsG' },
    { code: 'REC', name: 'Pass catching (receiving yards per game)', trait: 'recYdsG' },
    { code: 'TD', name: 'Nose for the end zone (TD per 16 games)', trait: 'td16' },
    { code: 'SEC', name: 'Ball security (fumbles per touch, inverted)', trait: 'fumRate' },
    { code: 'EXP', name: 'Explosiveness (yards per touch)', trait: 'ypt' },
  ],
  WR: REC,
  TE: REC,
  OL: [
    { code: 'BLK', name: 'Blocking (blocks per game)', trait: 'blocksG' },
    { code: 'VOL', name: 'Volume (career blocks)', career: (p) => n(p, 'blocks') },
    GAMES,
    { code: 'TAL', name: 'True Talent', career: (p) => p.trueTalent },
    { code: 'DOM', name: 'Dominance', career: (p) => p.dominance },
    { code: 'LGC', name: 'Career Legacy', career: (p) => p.careerLegacy },
  ],
  LB: DEF,
  DB: DEF,
  DL: DEF,
};

/** Every code with its name, for the legend. */
export const FACE_LEGEND: { code: string; name: string }[] = [
  ...new Map(Object.values(FACE_SPECS).flat().map((s) => [`${s.code}|${s.name}`, { code: s.code, name: s.name }])).values(),
];

interface PositionModel {
  features: Map<string, CompFeature>;
  baseline: Map<string, number[]>;
  career: Map<string, number[]>;
}

const MIN_GAMES = 8;

/**
 * Builds a face-stat function over a league (real legends excluded from the baseline). Baselines are built once
 * per position, so rating the whole binder is cheap.
 */
export const faceStatsFor = (players: Player[]) => {
  const league = players.filter((p) => !p.isRealLegend);
  const models = new Map<Position, PositionModel>();
  const model = (pos: Position): PositionModel => {
    let m = models.get(pos);
    if (!m) {
      const atPos = league.filter((p) => p.position === pos && p.games >= MIN_GAMES);
      const career = new Map<string, number[]>();
      FACE_SPECS[pos].forEach((s) => {
        if ('career' in s) career.set(s.code, atPos.map(s.career).filter(Number.isFinite).sort((a, b) => a - b));
      });
      m = { features: new Map(compFeatures(pos).map((f) => [f.id, f])), baseline: positionBaseline(league, pos), career };
      models.set(pos, m);
    }
    return m;
  };
  return (p: Player): FaceStat[] => {
    const m = model(p.position);
    return FACE_SPECS[p.position].map((s) => {
      let pct = NaN;
      if ('trait' in s) {
        const f = m.features.get(s.trait);
        if (f) pct = skillPct(f, m.baseline.get(f.id) ?? [], f.get(p));
      } else {
        pct = percentileOf(m.career.get(s.code) ?? [], s.career(p));
      }
      return { code: s.code, name: s.name, value: Number.isFinite(pct) ? faceRating(pct) : null };
    });
  };
};
