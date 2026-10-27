import type { Player, Position } from '@/types/player';
import { SIM_MIN_GAMES, compFeatures, hasSimilarityData, similarityBaseline, type CompFeature } from './advanced';
import { percentileOf } from './skillGrades';

/**
 * Player families: rule-based PLAY-STYLE clusters, always computed within one position (a WR family only ever
 * holds WRs). They describe how a player plays, not how good he is. Pure and deterministic: the same players give
 * the same families, names and colours on every load.
 *
 * 1. Shape vector. Each comparable player (the similarity pool: games > 0, enough usable style rates) gets his
 *    style features (config/advanced compFeatures) as oriented percentiles against the ≥ SIM_MIN_GAMES baseline,
 *    minus 50 (a missing rate counts as 50). His level, the weight-averaged value, is subtracted from every rate,
 *    so what is left says where he is strong or weak relative to himself; × √weight, then scaled to unit length.
 *    An elite and an average deep threat therefore land together.
 * 2. Clusters. k-means over the baseline players, k-means++ seeding from fixed seeds (1…RESTARTS, lowest inertia
 *    wins, ties to the lower seed), players sorted by key first. With ≥ BIG_POSITION baseline players k runs 3…5
 *    (k = 2 only when its silhouette beats the best of 3…5 by more than K2_MARGIN); smaller positions try 2…5.
 *    A k whose smallest cluster is too small is skipped. Among the candidates the best mean silhouette wins, and
 *    the smallest k within SILHOUETTE_TIE of it is preferred. Small-sample pool players join the nearest centroid.
 *    OL has one style rate (blocks/G), so it has no shape: a single family.
 * 3. Names. A family's profile is its members' mean shape (level-removed centred percentile) on each rate, in
 *    percentile points. Each label in the position's table is a signed weighting of rates; its score is
 *    Σ sign·profile / Σ|sign|. Labels go to families greedily (best score first, each label used once) when the
 *    score ≥ NAME_MIN; a family left without one is "Balanced <POS>".
 * 4. Definition. The label's lead rate, then the rates furthest from the family's own level (≥ DEF_MIN points):
 *    two fixed phrases. Level is reported separately (mean percentile, average Career Legacy), never in the name.
 */

export const FAMILY_K_MIN = 2;
export const FAMILY_K_MAX = 5;
const RESTARTS = 12;
const SILHOUETTE_TIE = 0.02;
const K2_MARGIN = 0.05;
const BIG_POSITION = 14;
const NAME_MIN = 10;
const DEF_MIN = 6;
const MIN_PLAYERS = 8;

/** Muted, distinct zone colours (no gold: gold marks Hall of Famers and the selection). */
export const FAMILY_COLORS = ['#5b8def', '#e0785a', '#3fb3a0', '#a37ad6', '#9bb54a'] as const;

export interface Family {
  /** Index in `families` (largest family first). */
  id: number;
  name: string;
  /** Templated one-liner from the profile, e.g. "More yards per catch, fewer catches per game". */
  definition: string;
  color: string;
  /** Every member, Career Legacy high to low (ties by name). */
  members: Player[];
  /** Members' mean shape per feature id (percentile points relative to their own level). */
  profile: Record<string, number>;
  /** Members' mean overall percentile (0–100, 50 = position middle): level, kept out of the name. */
  levelPct: number;
  /** Members' average Career Legacy. */
  avgLegacy: number;
}

export interface PositionFamilies {
  position: Position;
  k: number;
  silhouette: number;
  features: CompFeature[];
  families: Family[];
  /** "POS:Name" → family id. */
  of: Map<string, number>;
  /** Every pool player (sorted by key) and his unit shape vector, for a shape map. */
  pool: Player[];
  vectors: number[][];
  /** False when the position has a single rate (OL): no shape, so no zones. */
  shaped: boolean;
}

// ---------- Label tables (per position; signs act on oriented shape values, + = stronger than his level) ----------

interface Label {
  name: string;
  sig: Record<string, number>;
}

const LABELS: Record<Position, Label[]> = {
  QB: [
    { name: 'Gunslinger', sig: { passYdsG: 1, tdPct: 1, ya: 0.5, intPct: -1 } },
    { name: 'Game manager', sig: { cmp: 1, intPct: 1, passYdsG: -0.5, ya: -0.5 } },
    { name: 'Dual threat', sig: { rushYdsG: 1, rushShare: 1 } },
    { name: 'Pocket passer', sig: { rushYdsG: -1, rushShare: -1, passYdsG: 0.5 } },
  ],
  RB: [
    { name: 'Workhorse', sig: { rushYdsG: 1, td16: 0.5, recShare: -0.5 } },
    { name: 'Home-run hitter', sig: { ypc: 1, ypt: 1 } },
    { name: 'Receiving back', sig: { recYdsG: 1, recShare: 1 } },
    { name: 'Goal-line back', sig: { td16: 1, ypc: -0.5 } },
  ],
  WR: [
    { name: 'Deep threat', sig: { ypr: 1, recG: -0.5 } },
    { name: 'Possession', sig: { recG: 1, ypr: -0.5 } },
    { name: 'Red-zone', sig: { tdPerRec: 1 } },
    { name: 'Sure hands', sig: { fumRate: 1 } },
    { name: 'Volume receiver', sig: { recYdsG: 1, recG: 0.5 } },
    { name: 'Yardage gainer', sig: { tdPerRec: -1, recYdsG: 0.5 } },
  ],
  TE: [
    { name: 'Receiving TE', sig: { recG: 1, recYdsG: 1 } },
    { name: 'Seam stretcher', sig: { ypr: 1, recG: -0.5 } },
    { name: 'Safety valve', sig: { recG: 1, ypr: -1 } },
    { name: 'Red-zone target', sig: { tdPerRec: 1 } },
    { name: 'Sure hands', sig: { fumRate: 1 } },
  ],
  OL: [],
  LB: [
    { name: 'Pass rusher', sig: { sackG: 1 } },
    { name: 'Run stopper', sig: { tklG: 1, sackG: -0.5 } },
    { name: 'Coverage LB', sig: { intG: 1 } },
    { name: 'Playmaker', sig: { ffG: 1 } },
  ],
  DB: [
    { name: 'Ballhawk', sig: { intG: 1 } },
    { name: 'Enforcer', sig: { tklG: 1, intG: -0.5 } },
    { name: 'Playmaker', sig: { ffG: 1 } },
    { name: 'Blitzer', sig: { sackG: 1 } },
  ],
  DL: [
    { name: 'Pass rusher', sig: { sackG: 1 } },
    { name: 'Run stopper', sig: { tklG: 1, sackG: -0.5 } },
    { name: 'Disruptor', sig: { ffG: 1 } },
  ],
};

/** The single OL family (one style rate, so no shape). */
const OL_FAMILY = 'Offensive line';

/** Fixed phrases per rate: [above average, below average] (oriented, so "above" on INT% means fewer picks). */
const PHRASES: Record<string, [string, string]> = {
  ya: ['more yards per attempt', 'fewer yards per attempt'],
  cmp: ['higher completion rate', 'lower completion rate'],
  tdPct: ['more touchdowns per throw', 'fewer touchdowns per throw'],
  intPct: ['fewer interceptions', 'more interceptions'],
  rating: ['higher passer rating', 'lower passer rating'],
  passYdsG: ['more passing yards per game', 'fewer passing yards per game'],
  rushYdsG: ['more rushing yards per game', 'fewer rushing yards per game'],
  rushShare: ['runs more often', 'runs less often'],
  ypc: ['more yards per carry', 'fewer yards per carry'],
  recYdsG: ['more receiving yards per game', 'fewer receiving yards per game'],
  recShare: ['more of his yards as a receiver', 'fewer of his yards as a receiver'],
  td16: ['more touchdowns per game', 'fewer touchdowns per game'],
  fumRate: ['fewer fumbles', 'more fumbles'],
  ypt: ['more yards per touch', 'fewer yards per touch'],
  recG: ['more catches per game', 'fewer catches per game'],
  ypr: ['more yards per catch', 'fewer yards per catch'],
  tdPerRec: ['more touchdowns per catch', 'fewer touchdowns per catch'],
  tklG: ['more tackles per game', 'fewer tackles per game'],
  sackG: ['more sacks per game', 'fewer sacks per game'],
  intG: ['more interceptions per game', 'fewer interceptions per game'],
  ffG: ['more forced fumbles per game', 'fewer forced fumbles per game'],
  impactG: ['more splash plays per game', 'fewer splash plays per game'],
  blocksG: ['more blocks per game', 'fewer blocks per game'],
};

// ---------- Maths ----------

const keyOf = (p: Pick<Player, 'position' | 'name'>) => `${p.position}:${p.name}`;

/** mulberry32: a tiny seeded PRNG, so seeding is reproducible. */
const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const d2 = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
};

const nearest = (v: number[], cs: number[][]) => {
  let best = 0;
  let bd = Infinity;
  cs.forEach((c, j) => {
    const d = d2(v, c);
    if (d < bd - 1e-12) {
      bd = d;
      best = j;
    }
  });
  return best;
};

const kmeans = (xs: number[][], k: number, seed: number) => {
  const n = xs.length;
  const r = rng(seed);
  // k-means++ seeding
  const cs: number[][] = [xs[Math.floor(r() * n)].slice()];
  while (cs.length < k) {
    const ds = xs.map((x) => Math.min(...cs.map((c) => d2(x, c))));
    const tot = ds.reduce((s, d) => s + d, 0);
    let pick = 0;
    if (tot > 0) {
      let t = r() * tot;
      for (pick = 0; pick < n - 1; pick++) {
        t -= ds[pick];
        if (t <= 0) break;
      }
    }
    cs.push(xs[pick].slice());
  }
  let assign = xs.map((x) => nearest(x, cs));
  for (let it = 0; it < 100; it++) {
    // Update; an empty cluster takes the point furthest from its own centroid.
    for (let j = 0; j < k; j++) {
      const mem = xs.filter((_, i) => assign[i] === j);
      if (mem.length) cs[j] = mem[0].map((_, f) => mem.reduce((s, m) => s + m[f], 0) / mem.length);
      else {
        let far = 0;
        let fd = -1;
        xs.forEach((x, i) => {
          const d = d2(x, cs[assign[i]]);
          if (d > fd) {
            fd = d;
            far = i;
          }
        });
        cs[j] = xs[far].slice();
        assign[far] = j;
      }
    }
    const next = xs.map((x) => nearest(x, cs));
    if (next.every((a, i) => a === assign[i])) break;
    assign = next;
  }
  const inertia = xs.reduce((s, x, i) => s + d2(x, cs[assign[i]]), 0);
  return { assign, centroids: cs, inertia };
};

const bestKmeans = (xs: number[][], k: number) => {
  let best = kmeans(xs, k, 1);
  for (let s = 2; s <= RESTARTS; s++) {
    const r = kmeans(xs, k, s);
    if (r.inertia < best.inertia - 1e-9) best = r;
  }
  return best;
};

const silhouette = (xs: number[][], assign: number[], k: number) => {
  const n = xs.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const sums = Array(k).fill(0);
    const cnt = Array(k).fill(0);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      sums[assign[j]] += Math.sqrt(d2(xs[i], xs[j]));
      cnt[assign[j]] += 1;
    }
    const own = assign[i];
    if (cnt[own] === 0) continue; // singleton: s = 0
    const a = sums[own] / cnt[own];
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && cnt[c]) b = Math.min(b, sums[c] / cnt[c]);
    const m = Math.max(a, b);
    total += m > 0 && Number.isFinite(b) ? (b - a) / m : 0;
  }
  return total / n;
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


/**
 * Templated definition from a profile: the label's lead rate first (when it has one), then the rates furthest
 * from the family's own level (≥ DEF_MIN points), two phrases in all.
 */
export const defineProfile = (profile: Record<string, number>, features: CompFeature[], lead?: string) => {
  const ranked = features
    .map((f, i) => ({ id: f.id, d: profile[f.id] ?? 0, i }))
    .filter((x) => Math.abs(x.d) >= DEF_MIN && PHRASES[x.id] && x.id !== lead)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || a.i - b.i);
  const head = lead && PHRASES[lead] && Math.abs(profile[lead] ?? 0) >= 1 ? [{ id: lead, d: profile[lead] }] : [];
  const top = [...head, ...ranked].slice(0, 2);
  if (!top.length) return 'No rate stands out from the rest of his game';
  return capital(top.map((x) => PHRASES[x.id][x.d > 0 ? 0 : 1]).join(', '));
};

/** Names families from their shape profiles with the position's label table (see the header). */
export const nameProfiles = (position: Position, profiles: Record<string, number>[], features: CompFeature[]) => {
  const labels = LABELS[position];
  const has = (id: string) => features.some((f) => f.id === id);
  const pairs: { c: number; l: number; s: number }[] = [];
  profiles.forEach((pr, c) =>
    labels.forEach((lab, l) => {
      const ids = Object.keys(lab.sig).filter(has);
      const w = ids.reduce((s, id) => s + Math.abs(lab.sig[id]), 0);
      if (w) pairs.push({ c, l, s: ids.reduce((s, id) => s + lab.sig[id] * (pr[id] ?? 0), 0) / w });
    }),
  );
  pairs.sort((a, b) => b.s - a.s || a.c - b.c || a.l - b.l);
  const out: { name: string; lead?: string; score: number }[] = profiles.map(() => ({ name: '', score: 0 }));
  const usedL = new Set<number>();
  pairs.forEach(({ c, l, s }) => {
    if (s < NAME_MIN || out[c].name || usedL.has(l)) return;
    const sig = labels[l].sig;
    // The lead rate: the label's positively weighted rate this family shows most (first listed on ties).
    const pr = profiles[c];
    const lead = Object.keys(sig)
      .filter((id) => sig[id] > 0 && has(id))
      .sort((a, b) => sig[b] * (pr[b] ?? 0) - sig[a] * (pr[a] ?? 0))[0];
    out[c] = { name: labels[l].name, lead, score: s };
    usedL.add(l);
  });
  let n = 0;
  return out.map((o) => (o.name ? o : { name: `Balanced ${position}${n++ ? ` ${n}` : ''}`, lead: undefined, score: 0 }));
};

// ---------- Build ----------

/** Families at one position (null when the position has too few comparable players). */
export const buildFamilies = (players: Player[], position: Position, opts: { k?: number } = {}): PositionFamilies | null => {
  const features = compFeatures(position);
  if (!features.length) return null;
  const baseline = similarityBaseline(players, position);
  const stats = features.map((f) => {
    const sorted = baseline.map(f.get).filter(Number.isFinite).sort((a, b) => a - b);
    const mean = sorted.reduce((s, x) => s + x, 0) / (sorted.length || 1);
    const sd = Math.sqrt(sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / (sorted.length || 1));
    return { sorted, ok: sorted.length >= 5 && sd > 0, sign: f.lowerIsBetter ? -1 : 1, weight: f.weight };
  });
  const used = features.filter((_, i) => stats[i].ok);
  const usedIdx = features.map((_, i) => i).filter((i) => stats[i].ok);
  if (!used.length) return null;
  const wSum = usedIdx.reduce((s, i) => s + stats[i].weight, 0);

  const pool = players
    .filter((p) => p.position === position && !p.isRealLegend && p.games > 0 && hasSimilarityData(p))
    .sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0));
  const byLegacy = (a: Player, b: Player) => b.careerLegacy - a.careerLegacy || a.name.localeCompare(b.name);
  const centred = (p: Player) =>
    usedIdx.map((i) => {
      const x = features[i].get(p);
      if (!Number.isFinite(x)) return 0;
      const raw = percentileOf(stats[i].sorted, x);
      return (stats[i].sign < 0 ? 100 - raw : raw) - 50;
    });
  const cent = pool.map(centred);
  const level = cent.map((c) => c.reduce((s, x, j) => s + stats[usedIdx[j]].weight * x, 0) / wSum);
  const shape = cent.map((c, i) => c.map((x) => x - level[i]));
  const isBase = pool.map((p) => p.games >= SIM_MIN_GAMES);
  const bIdx = pool.map((_, i) => i).filter((i) => isBase[i]);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

  // One rate: no shape to cluster, so a single family.
  if (used.length < 2) {
    if (!pool.length) return null;
    const members = [...pool].sort(byLegacy);
    const fam: Family = {
      id: 0,
      name: OL_FAMILY,
      definition: `Blocks per game is the only style rate tracked for ${position}s`,
      color: FAMILY_COLORS[0],
      members,
      profile: {},
      levelPct: 50 + mean(bIdx.map((i) => level[i])),
      avgLegacy: mean(members.map((p) => p.careerLegacy)),
    };
    return { position, k: 1, silhouette: 0, features: used, families: [fam], of: new Map(pool.map((p) => [keyOf(p), 0])), pool, vectors: pool.map(() => [0]), shaped: false };
  }

  const vecs = shape.map((c) => {
    const v = c.map((x, j) => (x / 50) * Math.sqrt(stats[usedIdx[j]].weight));
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return norm > 1e-9 ? v.map((x) => x / norm) : v;
  });
  if (bIdx.length < MIN_PLAYERS) return null;
  const xs = bIdx.map((i) => vecs[i]);
  const big = xs.length >= BIG_POSITION;
  const minSize = big ? Math.max(3, Math.ceil(0.06 * xs.length)) : 2;

  const tried: { k: number; sil: number; res: ReturnType<typeof bestKmeans> }[] = [];
  for (let k = FAMILY_K_MIN; k <= FAMILY_K_MAX; k++) {
    if (k * minSize > xs.length) break;
    const res = bestKmeans(xs, k);
    const sizes = Array(k).fill(0);
    res.assign.forEach((a) => sizes[a]++);
    if (Math.min(...sizes) < minSize) continue;
    tried.push({ k, sil: silhouette(xs, res.assign, k), res });
  }
  if (!tried.length) return null;
  const pickFrom = (cands: typeof tried) => {
    const best = Math.max(...cands.map((t) => t.sil));
    return cands.find((t) => t.sil >= best - SILHOUETTE_TIE)!;
  };
  let chosen = opts.k ? tried.find((t) => t.k === opts.k) : undefined;
  if (!chosen) {
    const three = tried.filter((t) => t.k >= 3);
    const two = tried.find((t) => t.k === 2);
    if (big && three.length) {
      const b3 = pickFrom(three);
      chosen = two && two.sil > b3.sil + K2_MARGIN ? two : b3;
    } else chosen = pickFrom(tried);
  }
  const { k, res } = chosen;

  // Everyone in the pool (small samples too) joins the nearest centroid.
  const assign = vecs.map((v, i) => (isBase[i] ? res.assign[bIdx.indexOf(i)] : nearest(v, res.centroids)));
  const raw = Array.from({ length: k }, (_, c) => {
    const mem = bIdx.filter((i) => assign[i] === c);
    const prof: Record<string, number> = {};
    used.forEach((f, j) => {
      prof[f.id] = mean(mem.map((i) => shape[i][j]));
    });
    const members = pool.filter((_, i) => assign[i] === c).sort(byLegacy);
    return { prof, members, levelPct: 50 + mean(mem.map((i) => level[i])), avgLegacy: mean(members.map((p) => p.careerLegacy)) };
  });
  // Largest family first (ties: the family whose best member sorts first), so colours are stable.
  raw.sort((a, b) => b.members.length - a.members.length || keyOf(a.members[0]).localeCompare(keyOf(b.members[0])));
  const names = nameProfiles(position, raw.map((r) => r.prof), used);
  const families: Family[] = raw.map((r, id) => ({
    id,
    name: names[id].name,
    definition: defineProfile(r.prof, used, names[id].lead),
    color: FAMILY_COLORS[id % FAMILY_COLORS.length],
    members: r.members,
    profile: r.prof,
    levelPct: r.levelPct,
    avgLegacy: r.avgLegacy,
  }));
  const of = new Map<string, number>();
  families.forEach((f) => f.members.forEach((p) => of.set(keyOf(p), f.id)));
  return { position, k, silhouette: chosen.sil, features: used, families, of, pool, vectors: vecs, shaped: true };
};

const CACHE = new WeakMap<Player[], Map<Position, PositionFamilies | null>>();
/** Memoised buildFamilies per player array (weakly keyed, so a new league drops it). */
export const familiesFor = (players: Player[], position: Position) => {
  let byPos = CACHE.get(players);
  if (!byPos) CACHE.set(players, (byPos = new Map()));
  if (!byPos.has(position)) byPos.set(position, buildFamilies(players, position));
  return byPos.get(position) ?? null;
};

/** A player's family at his own position, or null. */
export const familyOfPlayer = (fams: PositionFamilies | null, p: Pick<Player, 'position' | 'name'>) => {
  const id = fams?.of.get(keyOf(p));
  return id == null ? null : fams!.families[id];
};
