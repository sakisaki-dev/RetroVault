import { describeR, quadrantCounts, trendFit } from '../visual/landscape';
import type { Position } from '@/types/player';
import { POSITIONS } from '@/config/advanced';
import { POSITION_NAMES } from '@/utils/playerMeta';
import type { GraphConfig, GraphModel } from './graphConfig';

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

const plural = (p: Position) => `${p}s`;

/** "QBs", "LBs, DBs & DLs", or "all players" when every position is in. */
export const positionsLabel = (shown: Position[]) => {
  if (!shown.length) return 'no players';
  if (shown.length === POSITIONS.length) return 'all players';
  const names = shown.map(plural);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

/** Auto title: "TD% vs INT% · QBs" (a fixed chart keeps its own title). */
export const autoTitle = (m: GraphModel, c: GraphConfig) => c.title ?? `${m.xs.short} vs ${m.ys.short} · ${positionsLabel(m.shown)}`;

/** One plain-English line on how to read the chart. */
export const explainer = (m: GraphModel, c: GraphConfig) => {
  const who = m.shown.length === 1 ? POSITION_NAMES[m.shown[0]].toLowerCase() : 'player';
  const sample = c.minGames > 0 ? ` with ${c.minGames}+ games` : '';
  const up = m.ys.lowerIsBetter ? `lower ${m.ys.label} (better)` : `more ${m.ys.label}`;
  const right = m.xs.lowerIsBetter ? `more ${m.xs.label} (lower is better)` : `more ${m.xs.label}`;
  const size = m.ss ? ` Bigger dots = more ${m.ss.label}.` : '';
  return `Each dot is one ${who}${sample}. Further right = ${right}; higher up = ${up}.${size}`;
};
