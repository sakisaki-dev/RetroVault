import type { Player, Position } from '@/types/player';
import { AWARD_POINTS, HOF_THRESHOLD, getRawTrueTalent, isDefensivePosition } from '@/config/stats';
import { leagueScore } from '@/config/ovr';
import {
  ADV_METRICS,
  evaluateMetric,
  legacyMix,
  pairSimilarity,
  SIMILARITY_DEFINITIONS,
  SIMILARITY_LABELS,
  type AdvContext,
  type AdvMetric,
  type MetricBoard,
} from '@/config/advanced';
import { keyOf } from './records';

/**
 * Head-to-Head row model. Pure: builds every comparable row for two league players, decides the leader
 * per row and tallies the categories won. The UI (HeadToHead.tsx) only renders what this returns.
 */

export type Side = 1 | 2;

/** What MetricLabel needs to show a definition on hover/focus. */
export type MetricDef = Pick<AdvMetric, 'label' | 'short' | 'definition' | 'minLabel' | 'lowerIsBetter'>;

export interface Cell {
  /** Displayed value; null renders an em dash. */
  value: number | null;
  /** Value used to decide the leader (defaults to `value`). */
  cmp?: number | null;
  /** Small line under the value (+ index · percentile, share %, tier). */
  sub?: string;
  /** Screen-reader expansion of `sub`. */
  subLabel?: string;
  /** Tooltip text on the value (e.g. raw True Talent). */
  hover?: string;
  /** Misses the metric's minimum sample: shows "below min" instead of a number. */
  belowMin?: boolean;
  /** Metric-tier key for metricColors (TT, Dom, CL, TPG). */
  tierKey?: string;
}

export interface Row {
  id: string;
  label: string;
  def?: MetricDef;
  decimals: number;
  suffix?: string;
  /** Lower raw value is better (INT%, fumble rate, interceptions thrown). */
  lowerIsBetter?: boolean;
  /** Leader is decided on cmp where higher is always better (percentile), regardless of lowerIsBetter. */
  cmpHigherIsBetter?: boolean;
  /** Describes style, not quality: no leader. */
  noLeader?: boolean;
  /** Shown and highlighted but not counted on the scoreboard. */
  unscored?: boolean;
  /** Small note under the label (e.g. "style · no leader"). */
  note?: string;
  a: Cell;
  b: Cell;
  leader: Side | null;
}

export interface Section {
  id: string;
  title: string;
  /** Short scoreboard label. */
  short: string;
  note?: string;
  rows: Row[];
}

export interface Matchup {
  sections: Section[];
  score: Record<Side, number>;
  /** Per-section tallies, scoreboard order. */
  tallies: { id: string; short: string; a: number; b: number }[];
  samePosition: boolean;
  sameFamily: boolean;
  similarity: number | null;
  /** Style-shape similarity (level-independent), same position only. */
  styleSimilarity: number | null;
  legacy: [ReturnType<typeof legacyMix>, ReturnType<typeof legacyMix>];
}

// ---------- Helpers ----------

const num = (p: Player, k: string) => {
  const v = (p as unknown as Record<string, unknown>)[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};
const rate = (a: number, b: number, scale = 1) => (b > 0 ? (a / b) * scale : null);
const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

const decide = (row: Omit<Row, 'leader'>): Side | null => {
  if (row.noLeader || row.a.belowMin || row.b.belowMin) return null;
  const useCmp = !!row.cmpHigherIsBetter;
  const a = useCmp ? row.a.cmp ?? null : row.a.value;
  const b = useCmp ? row.b.cmp ?? null : row.b.value;
  if (!finite(a) || !finite(b)) return null;
  // Compare at display precision so "88.4 vs 88.4" is never called for one side
  const d = useCmp ? 1 : row.decimals;
  const ra = Number(a.toFixed(d));
  const rb = Number(b.toFixed(d));
  if (ra === rb) return null;
  const lower = row.lowerIsBetter && !row.cmpHigherIsBetter;
  return (lower ? ra < rb : ra > rb) ? 1 : 2;
};

const row = (r: Omit<Row, 'leader'>): Row => ({ ...r, leader: decide(r) });

const simple = (id: string, label: string, get: (p: Player) => number | null, decimals: number, p1: Player, p2: Player, extra: Partial<Row> = {}) =>
  row({ id, label, decimals, a: { value: get(p1) }, b: { value: get(p2) }, ...extra });

// ---------- Position families ----------

export type Family = 'QB' | 'RB' | 'REC' | 'OL' | 'DEF';
export const familyOf = (pos: Position): Family =>
  pos === 'QB' ? 'QB' : pos === 'RB' ? 'RB' : pos === 'WR' || pos === 'TE' ? 'REC' : pos === 'OL' ? 'OL' : 'DEF';

type StatRow = { id: string; label: string; get: (p: Player) => number | null; decimals: number; lowerIsBetter?: boolean };

const POSITION_ROWS: Record<Family, { title: string; rows: StatRow[] }> = {
  QB: {
    title: 'Passing',
    rows: [
      { id: 'passYds', label: 'Pass Yards', get: (p) => num(p, 'passYds'), decimals: 0 },
      { id: 'passTD', label: 'Pass TD', get: (p) => num(p, 'passTD'), decimals: 0 },
      { id: 'int', label: 'INT Thrown', get: (p) => num(p, 'interceptions'), decimals: 0, lowerIsBetter: true },
      { id: 'cmpPct', label: 'Cmp %', get: (p) => rate(num(p, 'completions'), num(p, 'attempts'), 100), decimals: 1 },
      { id: 'ypa', label: 'Yds / Att', get: (p) => rate(num(p, 'passYds'), num(p, 'attempts')), decimals: 2 },
      { id: 'tdInt', label: 'TD : INT', get: (p) => rate(num(p, 'passTD'), num(p, 'interceptions')), decimals: 2 },
      { id: 'rushYds', label: 'Rush Yards', get: (p) => num(p, 'rushYds'), decimals: 0 },
    ],
  },
  RB: {
    title: 'Rushing & Receiving',
    rows: [
      { id: 'rushYds', label: 'Rush Yards', get: (p) => num(p, 'rushYds'), decimals: 0 },
      { id: 'rushTD', label: 'Rush TD', get: (p) => num(p, 'rushTD'), decimals: 0 },
      { id: 'ypc', label: 'Yds / Carry', get: (p) => rate(num(p, 'rushYds'), num(p, 'rushAtt')), decimals: 2 },
      { id: 'recYds', label: 'Rec Yards', get: (p) => num(p, 'recYds'), decimals: 0 },
      { id: 'fumbles', label: 'Fumbles', get: (p) => num(p, 'fumbles'), decimals: 0, lowerIsBetter: true },
    ],
  },
  REC: {
    title: 'Receiving',
    rows: [
      { id: 'receptions', label: 'Receptions', get: (p) => num(p, 'receptions'), decimals: 0 },
      { id: 'recYds', label: 'Rec Yards', get: (p) => num(p, 'recYds'), decimals: 0 },
      { id: 'recTD', label: 'Rec TD', get: (p) => num(p, 'recTD'), decimals: 0 },
      { id: 'ypr', label: 'Yds / Catch', get: (p) => rate(num(p, 'recYds'), num(p, 'receptions')), decimals: 2 },
      { id: 'recYpg', label: 'Rec Yds / G', get: (p) => rate(num(p, 'recYds'), p.games), decimals: 1 },
    ],
  },
  OL: {
    title: 'Blocking',
    rows: [{ id: 'blocks', label: 'Blocks', get: (p) => num(p, 'blocks'), decimals: 0 }],
  },
  DEF: {
    title: 'Defense',
    rows: [
      { id: 'tackles', label: 'Tackles', get: (p) => num(p, 'tackles'), decimals: 0 },
      { id: 'sacks', label: 'Sacks', get: (p) => num(p, 'sacks'), decimals: 0 },
      { id: 'defInt', label: 'Interceptions', get: (p) => num(p, 'interceptions'), decimals: 0 },
      { id: 'ff', label: 'Forced Fumbles', get: (p) => num(p, 'forcedFumbles'), decimals: 0 },
    ],
  },
};

// ---------- League-metric definitions (shown through MetricLabel) ----------

const ALL = 'every career';
export const LEAGUE_DEFS: Record<string, MetricDef> = {
  trueTalent: {
    label: 'True Talent',
    short: 'TT',
    definition: 'Career production from the per-position sheet formula, rescaled per position so all positions share one scale. Hover the value for the raw sheet number.',
    minLabel: ALL,
  },
  dominance: {
    label: 'Dominance',
    short: 'Dom',
    definition: `0.7 × True Talent + award points (ring ${AWARD_POINTS.ring}, MVP ${AWARD_POINTS.mvp}, OPOY ${AWARD_POINTS.opoy} / DPOY ${AWARD_POINTS.dpoy}, SB MVP ${AWARD_POINTS.sbmvp}).`,
    minLabel: ALL,
  },
  careerLegacy: {
    label: 'Career Legacy',
    short: 'CL',
    definition: `4 × True Talent + 4 × Dominance + 2 × games. Hall of Fame induction at ${HOF_THRESHOLD.toLocaleString('en-US')}.`,
    minLabel: ALL,
  },
  tpg: {
    label: 'TPG',
    short: 'TPG',
    definition: 'Talent per game: True Talent ÷ (games + 50), so short careers are damped.',
    minLabel: ALL,
  },
  ovr: {
    label: 'Official OVR',
    short: 'OVR',
    definition: 'The 62–99 rating used everywhere in the app and arcade: League Score rank within the position.',
    minLabel: ALL,
  },
  leagueScore: {
    label: 'League Score',
    short: 'LS',
    definition: 'Position production formula plus award bonuses: the input to the official OVR. Scales differ by position.',
    minLabel: ALL,
  },
  similarity: {
    label: SIMILARITY_LABELS.level,
    short: 'Sim',
    definition: SIMILARITY_DEFINITIONS.level,
    minLabel: 'same position only',
  },
};

const LEGACY_DEFS: Record<'talent' | 'awards' | 'longevity', MetricDef> = {
  talent: { label: 'Talent', short: 'Talent', definition: '6.8 × True Talent: the 4·TT term plus 4 × the 0.7·TT inside Dominance.', minLabel: ALL },
  awards: { label: 'Awards', short: 'Awards', definition: '4 × award points (the award part of Dominance).', minLabel: ALL },
  longevity: { label: 'Longevity', short: 'Long.', definition: '2 × games played.', minLabel: ALL },
};

// ---------- Builder ----------

const pctText = (pct: number) => {
  const r = Math.round(pct);
  const s = r % 100 >= 11 && r % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][r % 10] ?? 'th';
  return `${r}${s}`;
};

const advCell = (metric: AdvMetric, board: MetricBoard | undefined, p: Player, ctx: AdvContext): Cell => {
  if (!metric.qualifies(p)) return { value: null, belowMin: true };
  const hit = board?.rows.find((r) => keyOf(r.player) === keyOf(p));
  if (!hit) {
    const v = metric.value(p, ctx);
    return { value: Number.isFinite(v) ? v : null };
  }
  const plus = hit.plus != null ? `${Math.round(hit.plus)}+` : null;
  return {
    value: hit.value,
    cmp: hit.pct,
    sub: [plus, `${pctText(hit.pct)} pct`].filter(Boolean).join(' · '),
    subLabel: `${hit.plus != null ? `index ${Math.round(hit.plus)} (100 is the position average), ` : ''}${pctText(hit.pct)} percentile at ${p.position}`,
  };
};

export const buildMatchup = (
  players: Player[],
  ctx: AdvContext,
  p1: Player,
  p2: Player,
  ovrMap: Map<string, number>,
): Matchup => {
  const samePosition = p1.position === p2.position;
  const sameFamily = familyOf(p1.position) === familyOf(p2.position);
  const d1 = isDefensivePosition(p1.position);
  const d2 = isDefensivePosition(p2.position);
  const poy = d1 && d2 ? 'DPOY' : !d1 && !d2 ? 'OPOY' : 'OPOY / DPOY';

  const sections: Section[] = [];

  sections.push({
    id: 'career',
    title: 'Career & Awards',
    short: 'Career',
    rows: [
      simple('games', 'Games', (p) => p.games, 0, p1, p2),
      simple('rings', 'Rings', (p) => p.rings, 0, p1, p2),
      simple('mvp', 'MVP', (p) => p.mvp, 0, p1, p2),
      simple('poy', poy, (p) => p.opoy, 0, p1, p2),
      simple('sbmvp', 'SB MVP', (p) => p.sbmvp, 0, p1, p2),
      simple('roty', 'ROTY', (p) => p.roty, 0, p1, p2),
    ],
  });

  const ttCell = (p: Player): Cell => ({
    value: p.trueTalent,
    tierKey: 'trueTalent',
    hover: `Raw sheet True Talent ${getRawTrueTalent(p).toLocaleString('en-US', { maximumFractionDigits: 1 })}`,
  });
  sections.push({
    id: 'league',
    title: 'League Metrics',
    short: 'League',
    rows: [
      row({ id: 'trueTalent', label: 'True Talent', def: LEAGUE_DEFS.trueTalent, decimals: 1, a: ttCell(p1), b: ttCell(p2) }),
      row({ id: 'dominance', label: 'Dominance', def: LEAGUE_DEFS.dominance, decimals: 1, a: { value: p1.dominance, tierKey: 'dominance' }, b: { value: p2.dominance, tierKey: 'dominance' } }),
      row({ id: 'careerLegacy', label: 'Career Legacy', def: LEAGUE_DEFS.careerLegacy, decimals: 0, a: { value: p1.careerLegacy, tierKey: 'careerLegacy' }, b: { value: p2.careerLegacy, tierKey: 'careerLegacy' } }),
      row({ id: 'tpg', label: 'TPG', def: LEAGUE_DEFS.tpg, decimals: 2, a: { value: p1.tpg, tierKey: 'tpg' }, b: { value: p2.tpg, tierKey: 'tpg' } }),
      row({ id: 'ovr', label: 'Official OVR', def: LEAGUE_DEFS.ovr, decimals: 0, a: { value: ovrMap.get(keyOf(p1)) ?? null }, b: { value: ovrMap.get(keyOf(p2)) ?? null } }),
      row({ id: 'leagueScore', label: 'League Score', def: LEAGUE_DEFS.leagueScore, decimals: 0, a: { value: leagueScore(p1) }, b: { value: leagueScore(p2) } }),
    ],
  });

  if (sameFamily) {
    const fam = POSITION_ROWS[familyOf(p1.position)];
    sections.push({
      id: 'position',
      title: fam.title,
      short: fam.title.split(' ')[0],
      rows: fam.rows.map((r) => simple(r.id, r.label, r.get, r.decimals, p1, p2, { lowerIsBetter: r.lowerIsBetter })),
    });
  }

  const shared = ADV_METRICS.filter((m) => m.positions.includes(p1.position) && m.positions.includes(p2.position));
  if (shared.length > 0) {
    sections.push({
      id: 'advanced',
      title: 'Advanced',
      short: 'Advanced',
      note: samePosition
        ? `Under each value: + index (100 = ${p1.position} average) · percentile among qualified ${p1.position}s.`
        : `Different positions: the leader is the higher percentile within each player's own position. Under each value: + index (100 = position average) · percentile.`,
      rows: shared.map((m) => {
        const b1 = evaluateMetric(players, m, p1.position, ctx);
        const b2 = samePosition ? b1 : evaluateMetric(players, m, p2.position, ctx);
        const a = advCell(m, b1, p1, ctx);
        const b = advCell(m, b2, p2, ctx);
        // Same pool: the raw value decides and the percentile is context. Across positions the percentile decides.
        return row({
          id: m.id,
          label: m.label,
          def: m,
          decimals: m.decimals,
          suffix: m.suffix,
          lowerIsBetter: m.lowerIsBetter,
          cmpHigherIsBetter: !samePosition,
          noLeader: m.styleOnly,
          note: m.styleOnly ? 'style · no leader' : undefined,
          a,
          b,
        });
      }),
    });
  }

  const mix1 = legacyMix(p1);
  const mix2 = legacyMix(p2);
  const share = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}% of legacy` : undefined);
  sections.push({
    id: 'legacy',
    title: 'Legacy Composition',
    short: 'Legacy',
    note: 'Career Legacy split into its three sources. Shown for context; not counted on the scoreboard.',
    rows: (['talent', 'awards', 'longevity'] as const).map((k) =>
      row({
        id: `legacy-${k}`,
        label: LEGACY_DEFS[k].label,
        def: LEGACY_DEFS[k],
        decimals: 0,
        unscored: true,
        a: { value: mix1[k], sub: share(mix1[k], mix1.total) },
        b: { value: mix2[k], sub: share(mix2[k], mix2.total) },
      }),
    ),
  });

  const score: Record<Side, number> = { 1: 0, 2: 0 };
  const tallies = sections
    .map((s) => {
      const t = { id: s.id, short: s.short, a: 0, b: 0 };
      s.rows.forEach((r) => {
        if (r.unscored || !r.leader) return;
        if (r.leader === 1) t.a += 1;
        else t.b += 1;
      });
      score[1] += t.a;
      score[2] += t.b;
      return t;
    })
    .filter((t) => sections.find((s) => s.id === t.id)?.rows.some((r) => !r.unscored));

  return {
    sections,
    score,
    tallies,
    samePosition,
    sameFamily,
    similarity: samePosition ? pairSimilarity(players, p1, p2) : null,
    styleSimilarity: samePosition ? pairSimilarity(players, p1, p2, 'style') : null,
    legacy: [mix1, mix2],
  };
};

/** Default matchup: the best Career Legacy in the league against the best other career at his position. */
export const defaultPair = (players: Player[]): [Player, Player] | null => {
  const sorted = [...players].sort((a, b) => b.careerLegacy - a.careerLegacy);
  const top = sorted[0];
  const rival = top && sorted.find((p) => p !== top && p.position === top.position);
  if (top && rival) return [top, rival];
  return sorted.length >= 2 ? [sorted[0], sorted[1]] : null;
};
