import { describeR, quadrantCounts, trendFit } from '../visual/landscape';
import type { GraphModel } from './graphConfig';

/** One-paragraph text summary of a plotted graph (also the chart's accessible description). */
export const graphSummary = (m: GraphModel) => {
  const league = m.points.filter((p) => !p.nfl).length;
  const nfl = m.points.length - league;
  const parts = [`${league} league players${nfl ? ` plus ${nfl} real NFL players (unranked, not in the medians)` : ''}`];
  if (!m.spec.noSplits) parts.push(quadrantCounts(m.points, m.spec).map((c) => `${c.name} ${c.n}`).join(', '));
  const fit = trendFit(m.points, m.spec);
  if (m.spec.trend && fit) parts.push(`r = ${fit.r.toFixed(2)}, a ${describeR(fit.r)}`);
  return `${parts.join('. ')}.`;
};
