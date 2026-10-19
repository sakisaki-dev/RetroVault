/**
 * Classical (Torgerson) multidimensional scaling, dependency-free and deterministic.
 *
 * Given an n×n matrix of squared distances, double-centres it into a Gram matrix
 * B = −½·J·D²·J and takes its top eigenvectors by power iteration with deflation.
 * Coordinates are eigenvector · √eigenvalue, so Euclidean distances in the output
 * approximate the input distances as well as any 2-D layout can (for Euclidean input
 * this is exactly PCA of the underlying vectors).
 */

export interface Embedding {
  /** One [x, y, …] row per input item, in input order. */
  coords: number[][];
  /** Eigenvalues of the kept axes (largest first); their share of the positive total is the variance explained. */
  eigenvalues: number[];
  /** Share (0–1) of the positive spectrum the kept axes explain. */
  explained: number;
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a));

/** Deterministic start vector (a fixed LCG), so the same league always draws the same map. */
const seedVector = (n: number, seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return Array.from({ length: n }, () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  });
};

/** Double-centred Gram matrix from squared distances. */
export const gramFromSquaredDistances = (d2: number[][]): number[][] => {
  const n = d2.length;
  const row = d2.map((r) => r.reduce((s, x) => s + x, 0) / n);
  const grand = row.reduce((s, x) => s + x, 0) / n;
  return d2.map((r, i) => r.map((x, j) => -0.5 * (x - row[i] - row[j] + grand)));
};

/**
 * Top `k` eigenpairs of a symmetric matrix by shifted power iteration with deflation.
 * The Gershgorin shift makes the matrix positive semi-definite, so iteration converges to the
 * largest (not largest-magnitude) eigenvalues even when distances are not perfectly Euclidean.
 */
export const topEigen = (m: number[][], k: number, maxIter = 500, tol = 1e-10) => {
  const n = m.length;
  const shift = Math.max(0, ...m.map((r, i) => r.reduce((s, x, j) => s + (i === j ? 0 : Math.abs(x)), 0) - r[i]));
  const vectors: number[][] = [];
  const values: number[] = [];
  const mul = (v: number[]) => m.map((r, i) => dot(r, v) + shift * v[i]);
  for (let e = 0; e < Math.min(k, n); e++) {
    let v = seedVector(n, e + 1);
    const deflate = (x: number[]) => {
      vectors.forEach((u) => {
        const c = dot(u, x);
        for (let i = 0; i < n; i++) x[i] -= c * u[i];
      });
      return x;
    };
    v = deflate(v);
    let len = norm(v);
    if (len < 1e-12) break;
    v = v.map((x) => x / len);
    for (let it = 0; it < maxIter; it++) {
      const w = deflate(mul(v));
      len = norm(w);
      if (len < 1e-12) break;
      const next = w.map((x) => x / len);
      const delta = next.reduce((s, x, i) => s + (x - v[i]) ** 2, 0);
      v = next;
      if (delta < tol) break;
    }
    // Deterministic sign: the largest-magnitude component is positive.
    const big = v.reduce((bi, x, i) => (Math.abs(x) > Math.abs(v[bi]) ? i : bi), 0);
    if (v[big] < 0) v = v.map((x) => -x);
    vectors.push(v);
    values.push(dot(v, m.map((r) => dot(r, v))));
  }
  return { vectors, values };
};

/** Classical MDS of a squared-distance matrix into `dims` dimensions (default 2). */
export const classicalMds = (d2: number[][], dims = 2): Embedding => {
  const n = d2.length;
  if (n === 0) return { coords: [], eigenvalues: [], explained: 0 };
  if (n === 1) return { coords: [Array(dims).fill(0)], eigenvalues: [], explained: 0 };
  const b = gramFromSquaredDistances(d2);
  const { vectors, values } = topEigen(b, dims);
  const coords = Array.from({ length: n }, (_, i) =>
    Array.from({ length: dims }, (_, d) => (vectors[d] && values[d] > 0 ? vectors[d][i] * Math.sqrt(values[d]) : 0)),
  );
  const trace = b.reduce((s, r, i) => s + Math.max(0, r[i]), 0);
  const kept = values.reduce((s, x) => s + Math.max(0, x), 0);
  return { coords, eigenvalues: values, explained: trace > 0 ? Math.min(1, kept / trace) : 0 };
};
