import type { PositionFamilies } from '@/config/families';
import type { SimilarityMap } from '../comps/compModel';
import { classicalMds } from '../comps/embed';

/**
 * The shape map: classical MDS of the family shape vectors (level removed, unit length), so the picture is the
 * same space the families are clustered in and the zones line up with what you see. Grey links join each player
 * to his closest shape (cosine). Orientation is fixed: the largest family's centre sits left, the second's up.
 */
export const buildShapeMap = (fams: PositionFamilies): SimilarityMap | null => {
  const v = fams.vectors;
  const n = v.length;
  if (n < 3 || !fams.shaped) return null;
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
  const d2 = v.map((a) => v.map((b) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0)));
  const { coords, explained } = classicalMds(d2, 2);
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const famCentre = (id: number, arr: number[]) => {
    const idx = fams.pool.map((p, i) => (fams.of.get(`${p.position}:${p.name}`) === id ? i : -1)).filter((i) => i >= 0);
    return idx.reduce((s, i) => s + arr[i], 0) / (idx.length || 1);
  };
  if (famCentre(0, xs) > 0) xs.forEach((x, i) => (xs[i] = -x));
  if (fams.families.length > 1 && famCentre(1, ys) > 0) ys.forEach((y, i) => (ys[i] = -y));
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const points = fams.pool.map((player, i) => {
    let nn = -1;
    let best = -Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i || fams.pool[j].name === player.name) continue;
      const s = dot(v[i], v[j]);
      if (s > best + 1e-12) {
        best = s;
        nn = j;
      }
    }
    return { player, x: 0.5 + (xs[i] - cx) / span, y: 0.5 + (ys[i] - cy) / span, nn, nnScore: nn >= 0 ? 100 * Math.max(0, best) : NaN };
  });
  return { position: fams.position, mode: 'style', points, explained };
};
