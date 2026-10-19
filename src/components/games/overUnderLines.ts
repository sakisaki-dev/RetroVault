import type { Player, Position } from '@/types/player';
import { playerKey, type GamePlayer } from '@/config/ovr';

/**
 * Over/Under Lines: pure prop + line generation and bet settlement (no React, no storage).
 *
 * Every line sits a few percent off the true career value (the "jitter"), always on a .5 hook so a
 * prop can never push. Unknown stats never become props: legends.json simply omits what it doesn't
 * know, and the league sheet turns blank cells into 0, so production stats need a positive value.
 */

export type OUSide = 'over' | 'under';
export type OULevel = 1 | 2 | 3 | 4;
type Kind = 'yards' | 'count' | 'award' | 'metric' | 'ovr';

export interface PropStat {
  key: string;
  /** Market label on the board ("Pass Yds") */
  label: string;
  /** Phrase for screen readers / the slip ("career passing yards") */
  phrase: string;
  kind: Kind;
  positions?: Position[];
  /** League-only metric: never offered for real NFL players */
  leagueOnly?: boolean;
  /** Relative chance of being picked for a player who has it */
  weight: number;
  decimals?: number;
}

export interface OUProp {
  id: string;
  player: GamePlayer;
  stat: PropStat;
  line: number;
  actual: number;
}

export interface OUPick {
  side: OUSide | null;
  units: 1 | 2 | 3;
}

/** Sportsbook juice shown on every side; a winning straight pick pays units × 100/110. */
export const ODDS = -110;
export const PARLAY_MULTIPLIER = 5;
export const SLIP_SIZE = 5;
export const START_BANK = 100;
const MAX_LEGENDS_PER_SLIP = 2;

const OFFENSE_SKILL: Position[] = ['QB', 'RB', 'WR', 'TE'];
const DEFENSE: Position[] = ['LB', 'DB', 'DL'];

export const PROP_STATS: PropStat[] = [
  { key: 'passYds', label: 'Pass Yds', phrase: 'career passing yards', kind: 'yards', positions: ['QB'], weight: 3 },
  { key: 'passTD', label: 'Pass TD', phrase: 'career passing TDs', kind: 'count', positions: ['QB'], weight: 3 },
  { key: 'interceptions', label: 'INT Thrown', phrase: 'career interceptions thrown', kind: 'count', positions: ['QB'], weight: 2 },
  { key: 'rushYds', label: 'Rush Yds', phrase: 'career rushing yards', kind: 'yards', positions: ['QB', 'RB'], weight: 2 },
  { key: 'rushTD', label: 'Rush TD', phrase: 'career rushing TDs', kind: 'count', positions: ['QB', 'RB'], weight: 2 },
  { key: 'receptions', label: 'Receptions', phrase: 'career receptions', kind: 'count', positions: ['RB', 'WR', 'TE'], weight: 2 },
  { key: 'recYds', label: 'Rec Yds', phrase: 'career receiving yards', kind: 'yards', positions: ['RB', 'WR', 'TE'], weight: 3 },
  { key: 'recTD', label: 'Rec TD', phrase: 'career receiving TDs', kind: 'count', positions: ['RB', 'WR', 'TE'], weight: 3 },
  { key: 'blocks', label: 'Blocks', phrase: 'career blocks', kind: 'count', positions: ['OL'], weight: 3 },
  { key: 'tackles', label: 'Tackles', phrase: 'career tackles', kind: 'count', positions: DEFENSE, weight: 3 },
  { key: 'sacks', label: 'Sacks', phrase: 'career sacks', kind: 'count', positions: DEFENSE, weight: 3 },
  { key: 'defInt', label: 'Interceptions', phrase: 'career interceptions', kind: 'count', positions: DEFENSE, weight: 2 },
  { key: 'games', label: 'Games', phrase: 'career games played', kind: 'count', weight: 1 },
  { key: 'rings', label: 'Rings', phrase: 'championship rings', kind: 'award', weight: 1 },
  { key: 'mvp', label: 'MVPs', phrase: 'MVP awards', kind: 'award', positions: [...OFFENSE_SKILL, ...DEFENSE], weight: 1 },
  { key: 'careerLegacy', label: 'Career Legacy', phrase: 'Career Legacy score', kind: 'metric', leagueOnly: true, weight: 1, decimals: 2 },
  { key: 'trueTalent', label: 'True Talent', phrase: 'True Talent score', kind: 'metric', leagueOnly: true, weight: 1, decimals: 2 },
  { key: 'ovr', label: 'OVR', phrase: 'overall rating', kind: 'ovr', leagueOnly: true, weight: 1 },
];

const isRealLegend = (p: Player) => (p as GamePlayer).isRealLegend === true;

/** The stored number, or null when the field is absent / not a finite number. */
const raw = (p: Player, key: string): number | null => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

/**
 * True value of a stat for a player, or null when unknown. Production stats and league metrics must be
 * positive (a blank sheet cell parses to 0, so 0 there means "unknown"); awards may be 0.
 */
export const statValue = (p: Player, stat: PropStat, ovrMap?: Map<string, number>): number | null => {
  if (stat.positions && !stat.positions.includes(p.position)) return null;
  if (stat.leagueOnly && isRealLegend(p)) return null;
  if (stat.kind === 'ovr') return ovrMap?.get(playerKey(p)) ?? null;
  const v = raw(p, stat.key === 'defInt' ? 'interceptions' : stat.key);
  if (v == null || v < 0) return null;
  if (stat.kind === 'award') return (raw(p, 'games') ?? 0) > 0 ? v : null; // an empty row says nothing about awards
  return v > 0 ? v : null;
};

/** Props a player can be offered, with their true values. */
export const availableProps = (p: Player, ovrMap?: Map<string, number>) =>
  PROP_STATS.flatMap((stat) => {
    const actual = statValue(p, stat, ovrMap);
    return actual == null ? [] : [{ stat, actual }];
  });

// ---------- Difficulty ----------

/** Line jitter (fraction of the true value) per level: [min, max]. Higher level = tighter lines. */
export const JITTER: Record<OULevel, [number, number]> = {
  1: [0.07, 0.1],
  2: [0.05, 0.08],
  3: [0.04, 0.06],
  4: [0.03, 0.045],
};

export const LEVEL_NAMES: Record<OULevel, string> = { 1: 'Rookie', 2: 'Pro', 3: 'Sharp', 4: 'Wiseguy' };

/** Level from the run of consecutive correct picks. */
export const levelFor = (streak: number): OULevel => (streak >= 20 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1);

// ---------- Lines ----------

/** Rounding steps by kind; the largest step ≤ 1% of the value is used, so rounding never flips the side. */
const STEPS: Record<Kind, number[]> = {
  yards: [1, 10, 50, 100],
  count: [1, 5, 10],
  metric: [1, 5, 10],
  award: [1],
  ovr: [1],
};

const stepFor = (v: number, kind: Kind) => {
  const cap = Math.max(1, v * 0.01);
  return STEPS[kind].filter((s) => s <= cap).pop() ?? 1;
};

/**
 * A line near `actual`: shifted by a level-dependent jitter to a random side, rounded to a sensible
 * step and hooked (k·step + 0.5). The line is guaranteed to be strictly on the chosen side, so the
 * answer is never a push.
 */
export const makeLine = (actual: number, kind: Kind, level: OULevel, rng: () => number = Math.random): number => {
  let side = rng() < 0.5 ? 1 : -1;
  const step = stepFor(actual, kind);
  const [lo, hiRaw] = JITTER[level];
  // Lines snap outward to the next hook, so leave room for one step under the cap
  const hi = Math.max(lo, hiRaw - (actual > 0 ? step / actual : 0));
  const j = lo + (hi - lo) * rng();
  const target = actual * (1 + side * j);
  // Over: smallest hook ≥ target. Under: largest hook ≤ target.
  let line = side > 0 ? Math.ceil((target - 0.5) / step) * step + 0.5 : Math.floor((target - 0.5) / step) * step + 0.5;
  // Small counts (rings, MVPs, a few TDs): jitter can be under the hook; never go below 0.5.
  if (side < 0 && actual < 1) side = 1;
  if (side > 0 && line <= actual) line = Math.floor((actual - 0.5) / step + 1) * step + 0.5;
  if (side < 0 && line >= actual) line = Math.ceil((actual - 0.5) / step - 1) * step + 0.5;
  if (line < 0.5) line = actual > 0.5 ? 0.5 : Math.floor(actual) + 0.5;
  if (line === actual) line += step; // only possible for fractional values already on a hook
  return line;
};

export const isWinner = (prop: Pick<OUProp, 'line' | 'actual'>, side: OUSide) =>
  side === 'over' ? prop.actual > prop.line : prop.actual < prop.line;

// ---------- Dealing ----------

const pickWeighted = <T extends { weight: number }>(items: T[], rng: () => number): T => {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i;
  }
  return items[items.length - 1];
};

const shuffleWith = <T,>(items: T[], rng: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [out[i], out[k]] = [out[k], out[i]];
  }
  return out;
};

/**
 * A bet slip of `n` props from `n` different players (at most two real NFL players), trying not to
 * repeat a market. Zero-value awards are down-weighted so "Under 0.5 MVPs" doesn't flood the board.
 * Returns null when the pool can't fill a slip.
 */
export const makeSlip = (
  players: GamePlayer[],
  level: OULevel,
  opts: { ovrMap?: Map<string, number>; n?: number; rng?: () => number; avoid?: Set<string> } = {},
): OUProp[] | null => {
  const { ovrMap, n = SLIP_SIZE, rng = Math.random, avoid } = opts;
  const out: OUProp[] = [];
  const usedStats = new Set<string>();
  let legends = 0;
  for (const p of shuffleWith(players, rng)) {
    if (out.length === n) break;
    const key = playerKey(p);
    if (avoid?.has(key) && players.length > n * 4) continue;
    if (isRealLegend(p) && legends >= MAX_LEGENDS_PER_SLIP) continue;
    const options = availableProps(p, ovrMap).map((o) => ({
      ...o,
      weight: o.stat.weight * (o.stat.kind === 'award' && o.actual === 0 ? 0.3 : 1) * (usedStats.has(o.stat.key) ? 0.15 : 1),
    }));
    if (!options.length) continue;
    const { stat, actual } = pickWeighted(options, rng);
    usedStats.add(stat.key);
    if (isRealLegend(p)) legends++;
    out.push({ id: `${key}|${stat.key}`, player: p, stat, actual, line: makeLine(actual, stat.kind, level, rng) });
  }
  return out.length === n ? out : null;
};

// ---------- Settlement ----------

const cents = (x: number) => Math.round(x * 100) / 100;

/** Profit on a winning straight pick at -110. */
export const straightWin = (units: number) => cents((units * 100) / Math.abs(ODDS));

export interface Settlement {
  hits: boolean[];
  /** Per-leg net (straight bets); in a parlay every leg is 0 and the whole result lands on the last leg */
  legNet: number[];
  stake: number;
  net: number;
}

export const settleSlip = (props: OUProp[], picks: OUPick[], parlay: boolean): Settlement => {
  const hits = props.map((p, i) => picks[i]?.side != null && isWinner(p, picks[i].side as OUSide));
  const stake = picks.reduce((s, p) => s + p.units, 0);
  if (parlay) {
    const net = hits.every(Boolean) ? stake * PARLAY_MULTIPLIER : -stake;
    return { hits, legNet: hits.map((_, i) => (i === hits.length - 1 ? net : 0)), stake, net };
  }
  const legNet = hits.map((h, i) => (h ? straightWin(picks[i].units) : -picks[i].units));
  return { hits, legNet, stake, net: cents(legNet.reduce((s, x) => s + x, 0)) };
};

/** "9,950.5" / "62.5": lines always show their hook. */
export const formatLine = (line: number) => line.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatActual = (v: number, stat: PropStat) =>
  v.toLocaleString('en-US', { maximumFractionDigits: v % 1 ? (stat.decimals ?? 1) : 0 });

export const formatUnits = (u: number) => `${u > 0 ? '+' : u < 0 ? '−' : ''}${Math.abs(u).toLocaleString('en-US', { maximumFractionDigits: 2 })}u`;
