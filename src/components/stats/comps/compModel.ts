import type { Player, Position } from '@/types/player';
import { compFeatures, hasSimilarityData, similarityBaseline, type CompFeature, type SimilarityMode } from '@/config/advanced';
import { percentileOf } from '@/config/skillGrades';
import { classicalMds } from './embed';

/**
 * Comp Finder model for one position. Mirrors the similarity code in config/advanced.ts (which keeps its scorer
 * private): the same features, the same baseline (≥ SIM_MIN_GAMES games) for means and SDs, the same pool and
 * the same level / style formulas, so map distances agree with the published similarity scores.
 */

/** An axis needs at least this many baseline values (and some spread) to be drawn; otherwise it is greyed "n/a". */
export const MIN_AXIS_VALUES = 5;
/** A radar needs at least this many axes; below that (OL: blocks/G only) the finder shows a message instead. */
export const MIN_RADAR_AXES = 3;

interface FeatureStat {
  mean: number;
  sd: number;
  weight: number;
  /** +1 higher is better, −1 lower is better. */
  sign: number;
  /** Sorted baseline values (for percentiles). */
  sorted: number[];
  /** Enough baseline values with spread to draw this axis. */
  ok: boolean;
}

export interface PositionModel {
  position: Position;
  features: CompFeature[];
  stats: FeatureStat[];
  /** Every comparable league player at the position (games > 0, enough usable features), as the similarity pool. */
  pool: Player[];
  /** Raw z-scores (unoriented, NaN where missing), in `features` order. */
  z: (p: Player) => number[];
  /** 0–100 percentile per feature against the baseline, oriented so higher = better; null when missing or the axis is n/a. */
  pct: (p: Player) => (number | null)[];
  /** Percentile (oriented) of the baseline mean on each axis: the "position average" overlay. */
  avgPct: () => (number | null)[];
  /** Number of drawable axes. */
  axes: number;
}

export const buildPositionModel = (players: Player[], position: Position): PositionModel => {
  const features = compFeatures(position);
  const baseline = similarityBaseline(players, position);
  const pool = players.filter((p) => p.position === position && !p.isRealLegend && p.games > 0 && hasSimilarityData(p));
  const stats: FeatureStat[] = features.map((f) => {
    const vals = baseline.map(f.get).filter(Number.isFinite);
    const mean = vals.reduce((s, x) => s + x, 0) / (vals.length || 1);
    const sd = Math.sqrt(vals.reduce((s, x) => s + (x - mean) ** 2, 0) / (vals.length || 1));
    return { mean, sd, weight: f.weight, sign: f.lowerIsBetter ? -1 : 1, sorted: [...vals].sort((a, b) => a - b), ok: vals.length >= MIN_AXIS_VALUES && sd > 0 };
  });
  const zCache = new Map<Player, number[]>();
  const z = (p: Player) => {
    let out = zCache.get(p);
    if (!out) {
      out = features.map((f, i) => {
        const x = f.get(p);
        return stats[i].sd > 0 && Number.isFinite(x) ? (x - stats[i].mean) / stats[i].sd : NaN;
      });
      zCache.set(p, out);
    }
    return out;
  };
  const pct = (p: Player) =>
    features.map((f, i) => {
      const x = f.get(p);
      if (!stats[i].ok || !Number.isFinite(x)) return null;
      const raw = percentileOf(stats[i].sorted, x);
      return stats[i].sign < 0 ? 100 - raw : raw;
    });
  const avgPct = () => stats.map((s) => (s.ok ? (s.sign < 0 ? 100 - percentileOf(s.sorted, s.mean) : percentileOf(s.sorted, s.mean)) : null));
  return { position, features, stats, pool, z, pct, avgPct, axes: stats.filter((s) => s.ok).length };
};

const minFeatures = (m: PositionModel) => Math.min(3, m.features.length);

/** Level score (100·exp(−D/2W)) and raw weighted Pearson r of the oriented z-vectors (NaN when not computable). */
export const pairScores = (m: PositionModel, za: number[], zb: number[]) => {
  const idx = za.map((_, i) => i).filter((i) => Number.isFinite(za[i]) && Number.isFinite(zb[i]));
  let level = NaN;
  if (idx.length >= minFeatures(m)) {
    let d2 = 0;
    let w = 0;
    idx.forEach((i) => {
      d2 += m.stats[i].weight * (za[i] - zb[i]) ** 2;
      w += m.stats[i].weight;
    });
    level = 100 * Math.exp(-d2 / (2 * w));
  }
  let r = NaN;
  if (idx.length >= 4) {
    const a = idx.map((i) => m.stats[i].sign * za[i]);
    const b = idx.map((i) => m.stats[i].sign * zb[i]);
    const w = idx.map((i) => m.stats[i].weight);
    const W = w.reduce((s, x) => s + x, 0);
    const ma = a.reduce((s, x, k) => s + w[k] * x, 0) / W;
    const mb = b.reduce((s, x, k) => s + w[k] * x, 0) / W;
    let cov = 0;
    let va = 0;
    let vb = 0;
    a.forEach((x, k) => {
      cov += w[k] * (x - ma) * (b[k] - mb);
      va += w[k] * (x - ma) ** 2;
      vb += w[k] * (b[k] - mb) ** 2;
    });
    if (va > 1e-12 && vb > 1e-12) r = cov / Math.sqrt(va * vb);
  }
  return { level, style: Number.isFinite(r) ? 100 * Math.max(0, r) : NaN, r };
};

export interface MapPoint {
  player: Player;
  /** 0–1 layout coordinates (x grows with overall level, y is the second axis). */
  x: number;
  y: number;
  /** Index (into points) of the most similar other player in this mode, or −1. */
  nn: number;
  nnScore: number;
}

export interface SimilarityMap {
  position: Position;
  mode: SimilarityMode;
  points: MapPoint[];
  explained: number;
}

/**
 * Lays out every pool player at a position in 2-D with classical MDS so similar players sit close together.
 * Distances come from the same scores the comps use: level → d² = −2·ln(level/100) (the weighted mean squared
 * z-gap); style → d² = 2·(1 − r), the correlation distance. Pairs that can't be scored get the largest distance.
 */
export const buildSimilarityMap = (m: PositionModel, mode: SimilarityMode): SimilarityMap => {
  const pool = m.pool;
  const n = pool.length;
  const zs = pool.map(m.z);
  const sim: number[][] = Array.from({ length: n }, () => Array(n).fill(NaN));
  const d2: number[][] = Array.from({ length: n }, () => Array(n).fill(NaN));
  let maxD2 = 0;
  for (let i = 0; i < n; i++) {
    sim[i][i] = 100;
    d2[i][i] = 0;
    for (let j = i + 1; j < n; j++) {
      const s = pairScores(m, zs[i], zs[j]);
      const score = mode === 'style' ? s.style : s.level;
      const dist = mode === 'style' ? (Number.isFinite(s.r) ? 2 * (1 - s.r) : NaN) : Number.isFinite(s.level) ? -2 * Math.log(Math.max(s.level, 1e-9) / 100) : NaN;
      sim[i][j] = sim[j][i] = score;
      d2[i][j] = d2[j][i] = dist;
      if (Number.isFinite(dist)) maxD2 = Math.max(maxD2, dist);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!Number.isFinite(d2[i][j])) d2[i][j] = maxD2 || 1;

  const { coords, explained } = classicalMds(d2, 2);
  // Orient the first axis so better players (higher mean oriented z) sit to the right.
  const level = zs.map((z) => {
    const ok = z.map((x, i) => m.stats[i].sign * x).filter(Number.isFinite);
    return ok.reduce((s, x) => s + x, 0) / (ok.length || 1);
  });
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const corr = (a: number[], b: number[]) => {
    const ma = a.reduce((s, x) => s + x, 0) / (a.length || 1);
    const mb = b.reduce((s, x) => s + x, 0) / (b.length || 1);
    return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  };
  if (corr(xs, level) < 0) xs.forEach((x, i) => (xs[i] = -x));
  // Normalise both axes with one scale so distances stay comparable in each direction.
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;

  const points: MapPoint[] = pool.map((player, i) => {
    let nn = -1;
    let best = -Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i || pool[j].name === player.name) continue;
      const s = sim[i][j];
      if (Number.isFinite(s) && (s > best || (s === best && nn >= 0 && pool[j].name < pool[nn].name))) {
        best = s;
        nn = j;
      }
    }
    return { player, x: 0.5 + (xs[i] - cx) / span, y: 0.5 + (ys[i] - cy) / span, nn, nnScore: nn >= 0 ? best : NaN };
  });
  return { position: m.position, mode, points, explained };
};

// ---------- Helpers shared with other views (e.g. the Map page) ----------

/** A player's z-scores oriented so higher = better (NaN where missing), in `m.features` order. */
export const orientedZ = (m: PositionModel, p: Player) => m.z(p).map((x, i) => m.stats[i].sign * x);

/** Similarity (0–100) of two players at the model's position in a mode; NaN when not computable. */
export const similarityIn = (m: PositionModel, a: Player, b: Player, mode: SimilarityMode) => {
  const s = pairScores(m, m.z(a), m.z(b));
  return mode === 'style' ? s.style : s.level;
};

/** Top-k comps of `target` inside the model's pool (same ordering rules as similarPlayers), best first. */
export const topCompsIn = (m: PositionModel, target: Player, k: number, mode: SimilarityMode) => {
  const zt = m.z(target);
  return m.pool
    .filter((p) => p !== target && p.name !== target.name)
    .map((player) => {
      const s = pairScores(m, zt, m.z(player));
      return { player, similarity: mode === 'style' ? s.style : s.level, level: s.level, style: s.style };
    })
    .filter((c) => Number.isFinite(c.similarity))
    .sort((a, b) => b.similarity - a.similarity || (mode === 'style' ? b.level - a.level : 0) || a.player.name.localeCompare(b.player.name))
    .slice(0, k);
};

export interface Extreme {
  player: Player;
  /** His nearest comp and their score. */
  comp: Player;
  score: number;
}

/**
 * Per-position nearest-neighbour scores, flattened across positions: `unique` (lowest best-comp score first)
 * and `twins` (highest first, one entry per pair). Only players with ≥ `minGames` games count.
 */
export const extremes = (maps: SimilarityMap[], minGames = 8) => {
  const all: Extreme[] = maps.flatMap((sm) =>
    sm.points.filter((p) => p.nn >= 0 && p.player.games >= minGames && sm.points[p.nn].player.games >= minGames).map((p) => ({ player: p.player, comp: sm.points[p.nn].player, score: p.nnScore })),
  );
  const unique = [...all].sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const twins = [...all]
    .sort((a, b) => b.score - a.score)
    .filter((e) => {
      const id = [e.player.name, e.comp.name].sort().join('|');
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  return { unique, twins };
};
