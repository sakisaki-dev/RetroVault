import { memo } from 'react';
import type { Position } from '@/types/player';
import { fmtFixed } from '@/utils/numberFormat';
import { findNFLTeam } from '@/utils/nflTeams';
import { liftForDarkBg } from '@/utils/teamColors';
import { VIZ } from '../../analytics/viz';
import { BOX, groupOf, seasonRates } from './statDefs';
import type { SeasonPoint } from './careerModel';
import type { EventKind } from './careerStory';

/** One chartable metric over his seasons (the hero's chips, the comparison overlay). */
export interface GraphMetric {
  id: string;
  label: string;
  short: string;
  group: 'Card' | 'Season' | 'Rate';
  get: (p: SeasonPoint) => number | null;
  fmt: (v: number) => string;
  /** Smaller is better (legacy rank): the axis runs upside down */
  invert?: boolean;
  /** Key into SeasonPoint.pct */
  pctId?: string;
  definition: string;
}

const int = (v: number) => fmtFixed(Math.round(v), 0);
export const shortNum = (v: number) => {
  const a = Math.abs(v);
  if (a >= 10000) return `${fmtFixed(v / 1000, 0)}k`;
  if (a >= 1000) return `${fmtFixed(v / 1000, 1)}k`;
  return fmtFixed(v, Number.isInteger(v) ? 0 : 1);
};

const CACHE = new Map<Position, GraphMetric[]>();
export const graphMetrics = (pos: Position): GraphMetric[] => {
  const hit = CACHE.get(pos);
  if (hit) return hit;
  const card: GraphMetric[] = [
    { id: 'szn', label: 'SZN (season OVR)', short: 'SZN', group: 'Card', get: (p) => p.ovr, fmt: int, definition: 'His OVR for that season alone: the season\'s line ranked within his position among the players who played it (small samples shrunk toward the position mean).' },
    { id: 'car', label: 'OVR (career)', short: 'OVR', group: 'Card', get: (p) => p.car || null, fmt: int, definition: 'His career OVR as it stood at that season end: the whole career to that point ranked within his position (the stored market snapshot rating).' },
    { id: 'value', label: 'Card value', short: 'Value', group: 'Card', get: (p) => p.value, fmt: (v) => `${shortNum(v)} c`, definition: 'Base card value in coins at the season end.' },
    { id: 'legacy', label: 'Career Legacy', short: 'Legacy', group: 'Card', get: (p) => p.legacy, fmt: int, definition: 'Career Legacy at the season end (re-scaled with the league on every upload).' },
    { id: 'rank', label: 'Legacy rank', short: 'Rank', group: 'Card', get: (p) => p.legacyRank || null, fmt: (v) => `#${int(v)}`, invert: true, definition: 'His Career Legacy rank among every recorded player at the season end.' },
    { id: 'skill', label: 'Skill rating', short: 'Skill', group: 'Card', get: (p) => p.skill, fmt: int, definition: 'Overall skill rating (62–99) behind his letter grade at the season end.' },
    { id: 'hof', label: 'Hall of Fame Score', short: 'HOF', group: 'Card', get: (p) => p.hof.score, fmt: int, definition: 'The Hall of Fame Score rule applied to that season end: standing at his position + honours + league records held.' },
  ];
  const box: GraphMetric[] = BOX[groupOf(pos)].map((b) => ({
    id: `box:${b.key}`,
    label: b.label,
    short: b.short,
    group: 'Season',
    get: (p) => (p.box ? p.box[b.key] ?? null : null),
    fmt: int,
    pctId: b.key,
    definition: `${b.label} that season: the change in his career total between two season ends.`,
  }));
  const rates: GraphMetric[] = seasonRates(pos).map((r) => ({
    id: `rate:${r.id}`,
    label: r.trait ? `${r.name} · ${r.label}` : r.label,
    short: r.label,
    group: 'Rate',
    get: (p) => {
      const v = p.rates[r.id];
      return Number.isFinite(v) ? (r.scale ?? 1) * v : null;
    },
    fmt: (v) => `${fmtFixed(v, r.decimals)}${r.suffix ?? ''}`,
    pctId: r.id,
    definition: r.definition + (r.trait ? ` (the ${r.name} skill grade, on one season)` : ''),
  }));
  const out = [...card, ...box, ...rates];
  CACHE.set(pos, out);
  return out;
};

/** A club's band fill and its mark colour on the dark chart. */
export const clubInk = (club: string | null) => {
  const t = club ? findNFLTeam(club) : null;
  if (!t) return { band: 'transparent', mark: VIZ.muted, team: null };
  return { band: `hsl(${t.primaryColor} / 0.22)`, mark: liftForDarkBg(t.primaryColor, 58), team: t };
};

/** Sequential percentile fill (one hue, lightness rises with the percentile) and its readable ink. */
export const pctFill = (pct: number | null | undefined) => {
  if (pct == null || !Number.isFinite(pct)) return { bg: 'transparent', ink: VIZ.muted };
  const l = 16 + (pct / 100) * 52;
  return { bg: `hsl(213 ${55 + pct * 0.25}% ${l}%)`, ink: l > 50 ? 'hsl(228 47% 7%)' : 'hsl(228 100% 97%)' };
};

// ---------- Pixel glyphs (SVG rects from character grids; crisp, drawn inside charts) ----------

const GLYPHS: Record<EventKind, { rows: string[]; ink: Record<string, string> }> = {
  ring: { rows: ['..d..', '.ddd.', 'g.d.g', 'g...g', 'g...g', '.ggg.'], ink: { g: 'hsl(43 100% 62%)', d: 'hsl(190 90% 80%)' } },
  mvp: { rows: ['ggggg', 'gwggg', '.ggg.', '..g..', '.ggg.', 'bbbbb'], ink: { g: 'hsl(43 100% 62%)', w: '#fff6d8', b: 'hsl(30 60% 40%)' } },
  poy: { rows: ['..s..', '..s..', 'sssss', '.sss.', '.s.s.', 's...s'], ink: { s: 'hsl(200 90% 70%)' } },
  sbmvp: { rows: ['r...r', '.r.r.', '..g..', '.ggg.', 'ggwgg', '.ggg.'], ink: { r: 'hsl(354 85% 60%)', g: 'hsl(43 100% 62%)', w: '#fff6d8' } },
  record: { rows: ['wrrr.', 'wrrrr', 'wrrr.', 'w....', 'w....', 'w....'], ink: { w: '#e8ecf8', r: 'hsl(354 90% 62%)' } },
  club: { rows: ['..w..', '.w.w.', 'wwwww', '..w..', '..w..', '..w..'], ink: { w: 'hsl(225 30% 75%)' } },
  hof: { rows: ['.ggg.', 'ggggg', '.g.g.', '.g.g.', '.g.g.', 'ggggg'], ink: { g: 'hsl(43 100% 62%)' } },
  final: { rows: ['.www.', 'w.w.w', 'w.ww.', 'w...w', '.www.', '.....'], ink: { w: 'hsl(20 90% 66%)' } },
  ceiling: { rows: ['..g..', '.ggg.', 'g.g.g', '..g..', '..g..', '..g..'], ink: { g: 'hsl(149 64% 52%)' } },
};

/** A glyph as an SVG group at (x, y), `px` units per pixel. */
export const Glyph = memo(({ kind, x = 0, y = 0, px = 2 }: { kind: EventKind; x?: number; y?: number; px?: number }) => {
  const g = GLYPHS[kind];
  return (
    <g transform={`translate(${x} ${y}) scale(${px})`} shapeRendering="crispEdges" aria-hidden="true">
      {g.rows.flatMap((row, r) => [...row].flatMap((c, k) => (g.ink[c] ? [<rect key={`${k}-${r}`} x={k} y={r} width={1.02} height={1.02} fill={g.ink[c]} />] : [])))}
    </g>
  );
});
Glyph.displayName = 'Glyph';

/** A standalone glyph icon (5 × 6 pixels). */
export const GlyphIcon = ({ kind, px = 2, title }: { kind: EventKind; px?: number; title?: string }) => (
  <svg width={5 * px} height={6 * px} viewBox={`0 0 ${5 * px} ${6 * px}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className="shrink-0">
    <Glyph kind={kind} px={px} />
  </svg>
);

export const EVENT_LABEL: Record<EventKind, string> = {
  ring: 'Ring',
  mvp: 'MVP',
  poy: 'Player of the Year',
  sbmvp: 'Super Bowl MVP',
  record: 'Record',
  club: 'New club',
  hof: 'Hall of Fame',
  final: 'Final season',
  ceiling: 'Room to grow',
};

/** "Y87" */
export const yLabel = (y: number) => `Y${y}`;

/** Linear scale with nice padded bounds. */
export const linear = (d0: number, d1: number, r0: number, r1: number) => {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
};
