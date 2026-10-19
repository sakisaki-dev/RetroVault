import type { Player, Position } from '@/types/player';
import { playerKey } from '@/config/ovr';
import { gradeFor, percentileOf, playerSkillGrades, type GradeStep } from '@/config/skillGrades';
import { pairSimilarity } from '@/config/advanced';
import { findNFLTeam } from '@/utils/nflTeams';

/**
 * Team Lab engine: pure and React-free (unit-testable, bundled by a node sanity script).
 *
 * A lineup is Retro Bowl's roster shape: QB, RB, 2 WR, TE, OL and four defenders (any LB/DB/DL mix).
 * Every player becomes a profile: his skill-grade percentiles (config/skillGrades: per-position rate
 * percentiles against league players) shrunk toward average for short careers, plus per-game defensive
 * rates and the QB's sack rate. Unit raws combine those inputs; each unit score is the percentile of that raw
 * among ~500 random valid league lineups (deterministic seed), i.e. "better than X% of possible teams".
 * Unit scores roll up into Offense, Defense and Team, which are percentiled against the same benchmark.
 */

// ---------- Slots and lineups ----------

export type SlotId = 'qb' | 'rb' | 'wr1' | 'wr2' | 'te' | 'ol' | 'd1' | 'd2' | 'd3' | 'd4';
export type Side = 'offense' | 'defense';
export interface SlotDef {
  id: SlotId;
  label: string;
  positions: Position[];
  side: Side;
}

export const DEFENSE_POSITIONS: Position[] = ['LB', 'DB', 'DL'];
export const SLOTS: SlotDef[] = [
  { id: 'qb', label: 'QB', positions: ['QB'], side: 'offense' },
  { id: 'rb', label: 'RB', positions: ['RB'], side: 'offense' },
  { id: 'wr1', label: 'WR', positions: ['WR'], side: 'offense' },
  { id: 'wr2', label: 'WR', positions: ['WR'], side: 'offense' },
  { id: 'te', label: 'TE', positions: ['TE'], side: 'offense' },
  { id: 'ol', label: 'OL', positions: ['OL'], side: 'offense' },
  { id: 'd1', label: 'DEF', positions: DEFENSE_POSITIONS, side: 'defense' },
  { id: 'd2', label: 'DEF', positions: DEFENSE_POSITIONS, side: 'defense' },
  { id: 'd3', label: 'DEF', positions: DEFENSE_POSITIONS, side: 'defense' },
  { id: 'd4', label: 'DEF', positions: DEFENSE_POSITIONS, side: 'defense' },
];
export const SLOT_IDS = SLOTS.map((s) => s.id);
export const SLOT_BY_ID = new Map(SLOTS.map((s) => [s.id, s]));
const DEF_SLOTS: SlotId[] = ['d1', 'd2', 'd3', 'd4'];
const REC_SLOTS: { slot: SlotId; w: number }[] = [
  { slot: 'wr1', w: 1 },
  { slot: 'wr2', w: 1 },
  { slot: 'te', w: 0.7 },
];

/** Player keys ("POS:Name") per slot; '' = empty. */
export type Lineup = Record<SlotId, string>;
export const emptyLineup = (): Lineup => Object.fromEntries(SLOT_IDS.map((id) => [id, ''])) as Lineup;
export const filledCount = (l: Lineup) => SLOT_IDS.filter((id) => !!l[id]).length;
export const isComplete = (l: Lineup) => filledCount(l) === SLOT_IDS.length;
export const lineupKeys = (l: Lineup) => SLOT_IDS.map((id) => l[id]).filter(Boolean);

/** Compact hash form: offense names in slot order (position implied), defenders as "POS:Name", joined by "~". */
export const encodeLineup = (l: Lineup): string =>
  SLOT_IDS.map((id) => {
    const k = l[id];
    if (!k) return '';
    return SLOT_BY_ID.get(id)!.side === 'defense' ? k : k.slice(k.indexOf(':') + 1);
  })
    .join('~')
    .replace(/~+$/, '');

export const decodeLineup = (s: string, known?: (key: string) => boolean): Lineup => {
  const out = emptyLineup();
  const parts = (s || '').split('~');
  SLOT_IDS.forEach((id, i) => {
    const raw = (parts[i] ?? '').trim();
    if (!raw) return;
    const slot = SLOT_BY_ID.get(id)!;
    const key = slot.side === 'defense' ? raw : `${slot.positions[0]}:${raw}`;
    const pos = key.slice(0, key.indexOf(':')) as Position;
    if (!slot.positions.includes(pos)) return;
    if (known && !known(key)) return;
    if (lineupKeys(out).includes(key)) return;
    out[id] = key;
  });
  return out;
};

// ---------- Player profiles ----------

export interface StatLine {
  id: string;
  /** Football name ("Accuracy") */
  name: string;
  /** Stat label ("Cmp%") */
  label: string;
  value: number;
  display: string;
  /** Direction-aware percentile within the position (higher = better), shrunk toward 50 for short careers; NaN if missing */
  pct: number;
}

export interface PlayerProfile {
  key: string;
  player: Player;
  name: string;
  position: Position;
  team: string;
  ovr: number;
  /** Overall skill percentile (skillGrades overallFor), shrunk; drives the slot letter */
  overallPct: number;
  grade: GradeStep | null;
  stats: Record<string, StatLine>;
  /** Defenders: per-game rates shrunk toward the position mean (tklG, sackG, intG, ffG) */
  rates: Record<string, number>;
  /** QB: dropbacks per sack ((att + sacks) / sacks); NaN when unknown */
  dropbacksPerSack: number;
  legacyPct: number;
  isLegend: boolean;
}

/** Games of "average" added to every rate: a 17-game career keeps ~80% of its distance from average. */
export const SHRINK_GAMES = 4;
const num = (p: Player, key: string): number => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
};
const shrinkPct = (pct: number, games: number) =>
  Number.isFinite(pct) ? 50 + (pct - 50) * (games / (games + SHRINK_GAMES)) : NaN;
const sackRate = (p: Player) => {
  const att = num(p, 'attempts');
  const sk = num(p, 'sacks');
  return Number.isFinite(att) && Number.isFinite(sk) && att + sk > 0 ? sk / (att + sk) : NaN;
};
const DEF_RATES: { id: string; stat: string }[] = [
  { id: 'tklG', stat: 'tackles' },
  { id: 'sackG', stat: 'sacks' },
  { id: 'intG', stat: 'interceptions' },
  { id: 'ffG', stat: 'forcedFumbles' },
];

const buildProfiles = (league: Player[], pool: Player[], ovrMap: Map<string, number>) => {
  const legacySorted = league.map((p) => p.careerLegacy).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  const sackSorted = league
    .filter((p) => p.position === 'QB' && num(p, 'attempts') >= 100)
    .map(sackRate)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  // Position means of each defensive rate (players with ≥ 8 games), the shrink target
  const defMean = new Map<string, number>();
  DEFENSE_POSITIONS.forEach((pos) => {
    const list = league.filter((p) => p.position === pos && p.games >= 8);
    DEF_RATES.forEach(({ id, stat }) => {
      const tot = list.reduce((s, p) => s + (num(p, stat) || 0), 0);
      const g = list.reduce((s, p) => s + p.games, 0);
      defMean.set(`${pos}:${id}`, g > 0 ? tot / g : 0);
    });
  });

  const out = new Map<string, PlayerProfile>();
  pool.forEach((p) => {
    const key = playerKey(p);
    if (out.has(key)) return;
    const g = Math.max(0, p.games || 0);
    const { traits, overall } = playerSkillGrades(league, p);
    const stats: Record<string, StatLine> = {};
    traits.forEach((t) => {
      stats[t.trait.id] = {
        id: t.trait.id,
        name: t.trait.name,
        label: t.trait.label,
        value: t.value,
        display: t.display,
        pct: shrinkPct(t.percentile, g),
      };
    });
    let dropbacksPerSack = NaN;
    if (p.position === 'QB') {
      const r = sackRate(p);
      const pct = Number.isFinite(r) ? 100 - percentileOf(sackSorted, r) : NaN;
      dropbacksPerSack = r > 0 ? 1 / r : NaN;
      stats.sackAvoid = {
        id: 'sackAvoid',
        name: 'Sack avoidance',
        label: 'Sack%',
        value: r,
        display: Number.isFinite(r) ? `${(100 * r).toFixed(1)}%` : '—',
        pct: shrinkPct(pct, g),
      };
    }
    const rates: Record<string, number> = {};
    if (DEFENSE_POSITIONS.includes(p.position)) {
      DEF_RATES.forEach(({ id, stat }) => {
        const mean = defMean.get(`${p.position}:${id}`) ?? 0;
        const v = num(p, stat);
        rates[id] = ((Number.isFinite(v) ? v : mean * g) + mean * SHRINK_GAMES) / (g + SHRINK_GAMES);
      });
    }
    const overallPct = shrinkPct(overall?.pct ?? NaN, g);
    out.set(key, {
      key,
      player: p,
      name: p.name,
      position: p.position,
      team: p.team ?? '',
      ovr: ovrMap.get(key) ?? 62,
      overallPct,
      grade: gradeFor(overallPct),
      stats,
      rates,
      dropbacksPerSack,
      legacyPct: !p.isRealLegend && p.careerLegacy > 0 ? percentileOf(legacySorted, p.careerLegacy) : NaN,
      isLegend: !!p.isRealLegend,
    });
  });
  return out;
};

// ---------- Units ----------

export type UnitId =
  | 'passing'
  | 'run'
  | 'protection'
  | 'explosive'
  | 'redzone'
  | 'security'
  | 'passRush'
  | 'coverage'
  | 'runDef'
  | 'playmaking'
  | 'star';

export const OFFENSE_UNITS: UnitId[] = ['passing', 'run', 'protection', 'explosive', 'redzone', 'security'];
export const DEFENSE_UNITS: UnitId[] = ['passRush', 'coverage', 'runDef', 'playmaking'];
export const ALL_UNITS: UnitId[] = [...OFFENSE_UNITS, ...DEFENSE_UNITS, 'star'];

export const UNIT_LABELS: Record<UnitId, string> = {
  passing: 'Passing game',
  run: 'Run game',
  protection: 'Protection',
  explosive: 'Explosiveness',
  redzone: 'Red zone',
  security: 'Ball security',
  passRush: 'Pass rush',
  coverage: 'Coverage',
  runDef: 'Run defense',
  playmaking: 'Playmaking',
  star: 'Star power',
};

/** One input of an offensive unit: a stat percentile of a slot ('rec' = WR1, WR2, TE weighted 1 / 1 / 0.7). */
interface Term {
  slot: 'qb' | 'rb' | 'ol' | 'rec';
  stat: string;
  w: number;
}
const T = (slot: Term['slot'], stat: string, w: number): Term => ({ slot, stat, w });

export const OFFENSE_TERMS: Record<string, Term[]> = {
  passing: [
    T('qb', 'cmp', 0.18),
    T('qb', 'ya', 0.14),
    T('qb', 'intPct', 0.12),
    T('qb', 'rating', 0.08),
    T('qb', 'tdPct', 0.08),
    T('rec', 'recYdsG', 0.14),
    T('rec', 'ypr', 0.1),
    T('rec', 'recG', 0.08),
    T('rec', 'tdPerRec', 0.08),
  ],
  run: [T('rb', 'ypc', 0.3), T('rb', 'rushYdsG', 0.2), T('rb', 'td16', 0.12), T('rb', 'ypt', 0.08), T('ol', 'blocksG', 0.2), T('qb', 'rushYdsG', 0.1)],
  protection: [T('ol', 'blocksG', 0.55), T('qb', 'sackAvoid', 0.3), T('qb', 'rushYdsG', 0.15)],
  explosive: [T('qb', 'ya', 0.3), T('rec', 'ypr', 0.4), T('rb', 'ypc', 0.15), T('rb', 'ypt', 0.15)],
  redzone: [T('qb', 'tdPct', 0.35), T('rb', 'td16', 0.3), T('rec', 'tdPerRec', 0.35)],
  security: [T('qb', 'intPct', 0.45), T('rb', 'fumRate', 0.25), T('rec', 'fumRate', 0.3)],
};

/** Defensive units: sums of the four defenders' shrunk per-game rates. */
export const DEFENSE_TERMS: Record<string, { rate: string; w: number }[]> = {
  passRush: [
    { rate: 'sackG', w: 1 },
    { rate: 'ffG', w: 0.5 },
  ],
  coverage: [{ rate: 'intG', w: 1 }],
  runDef: [{ rate: 'tklG', w: 1 }],
  playmaking: [
    { rate: 'intG', w: 1 },
    { rate: 'ffG', w: 1 },
  ],
};

export const UNIT_WEIGHTS = {
  offense: { passing: 0.28, run: 0.14, protection: 0.14, explosive: 0.14, redzone: 0.15, security: 0.15 } as Record<string, number>,
  defense: { passRush: 0.3, coverage: 0.25, runDef: 0.2, playmaking: 0.25 } as Record<string, number>,
  team: { offense: 0.55, defense: 0.35, star: 0.1 },
};

const RATE_LABEL: Record<string, string> = { sackG: 'sacks/G', ffG: 'FF/G', intG: 'INT/G', tklG: 'tackles/G' };
const RATE_NAME: Record<string, string> = { sackG: 'Pass rush', ffG: 'Strip', intG: 'Ball hawk', tklG: 'Tackling' };

const STAT_NAMES: Record<string, string> = {
  cmp: 'Accuracy',
  ya: 'Arm',
  intPct: 'Decision making',
  rating: 'Clutch rating',
  tdPct: 'Gunslinger',
  rushYdsG: 'Legs',
  recYdsG: 'Production',
  ypr: 'Big play',
  recG: 'Hands',
  tdPerRec: 'Red zone',
  ypc: 'Vision',
  td16: 'Nose for the end zone',
  ypt: 'Explosiveness',
  blocksG: 'Blocks/G',
  sackAvoid: 'Sack avoidance',
  fumRate: 'Ball security',
};

/** "How this is calculated": the inputs of every unit, generated from the weight tables above. */
export const METHOD: { unit: UnitId; inputs: string }[] = [
  ...OFFENSE_UNITS.map((u) => ({
    unit: u,
    inputs: OFFENSE_TERMS[u]
      .map((t) => `${t.slot === 'rec' ? 'WR/WR/TE' : t.slot.toUpperCase()} ${STAT_NAMES[t.stat] ?? t.stat} ${Math.round(t.w * 100)}%`)
      .join(' · '),
  })),
  ...DEFENSE_UNITS.map((u) => ({
    unit: u,
    inputs: `Sum over the 4 defenders: ${DEFENSE_TERMS[u].map((t) => `${t.w !== 1 ? `${t.w}× ` : ''}${RATE_LABEL[t.rate]}`).join(' + ')}`,
  })),
  { unit: 'star' as UnitId, inputs: 'Mean over all 10 slots of 60% official OVR (62–99 rescaled) + 40% Career Legacy percentile' },
];

export interface Contributor {
  slot: SlotId;
  profile: PlayerProfile;
  /** Stat id: a trait id, 'sackAvoid', or a defensive rate id */
  stat: string;
  /** Direction-aware percentile within the position */
  pct: number;
  /** Ready-to-read evidence, e.g. "QB Ty Lock is 82nd percentile in Accuracy (Cmp% 64.1%)" */
  phrase: string;
}

export interface UnitResult {
  id: UnitId;
  label: string;
  raw: number;
  /** Benchmark percentile, 0–100 */
  score: number;
  grade: GradeStep;
  /** Defensive units: the combined per-game rate summary, e.g. "1.92 sacks/G + 0.31 FF/G" */
  summary?: string;
  contributors: Contributor[];
}

export const ordinal = (x: number) => {
  const n = Math.round(x);
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
};
const fx = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const short = (p: PlayerProfile) => `${p.position} ${p.name}`;

const statPhrase = (p: PlayerProfile, stat: string): string => {
  if (stat === 'sackAvoid') {
    const pct = p.stats.sackAvoid?.pct;
    return Number.isFinite(p.dropbacksPerSack)
      ? `${short(p)} takes a sack every ${Math.round(p.dropbacksPerSack)} dropbacks (${ordinal(pct)} percentile)`
      : `${short(p)} has no sack data`;
  }
  if (p.rates[stat] != null) {
    return `${short(p)} ${fx(p.rates[stat], stat === 'tklG' ? 1 : 2)} ${RATE_LABEL[stat]} (${ordinal(defPct(p, stat))} percentile among ${p.position}s)`;
  }
  const s = p.stats[stat];
  if (!s || !Number.isFinite(s.pct)) return `${short(p)} has no ${STAT_NAMES[stat] ?? stat} data`;
  const tail = s.name === s.label ? s.display : `${s.label} ${s.display}`;
  return `${short(p)} is ${ordinal(s.pct)} percentile in ${s.name} (${tail})`;
};
/** Percentile of a defensive rate within the position, from the matching skill trait. */
const defPct = (p: PlayerProfile, rate: string) => p.stats[rate]?.pct ?? NaN;

const wmean = (items: { v: number; w: number }[]) => {
  let s = 0;
  let w = 0;
  items.forEach((i) => {
    if (Number.isFinite(i.v) && i.w > 0) {
      s += i.v * i.w;
      w += i.w;
    }
  });
  return w > 0 ? s / w : 50;
};

type SlotProfiles = Record<SlotId, PlayerProfile>;

/** Unit raws (and, with detail, the cited contributors) for a full lineup. */
const unitRaws = (sp: SlotProfiles, detail: boolean) => {
  const raws = {} as Record<UnitId, number>;
  const contrib = {} as Record<UnitId, Contributor[]>;
  const pctOf = (slot: SlotId, stat: string) => sp[slot].stats[stat]?.pct ?? NaN;

  OFFENSE_UNITS.forEach((u) => {
    const items: { v: number; w: number }[] = [];
    const cs: Contributor[] = [];
    OFFENSE_TERMS[u].forEach((t) => {
      if (t.slot === 'rec') {
        const v = wmean(REC_SLOTS.map((r) => ({ v: pctOf(r.slot, t.stat), w: r.w })));
        items.push({ v, w: t.w });
        if (detail)
          REC_SLOTS.forEach((r) => {
            const pct = pctOf(r.slot, t.stat);
            if (Number.isFinite(pct)) cs.push({ slot: r.slot, profile: sp[r.slot], stat: t.stat, pct, phrase: statPhrase(sp[r.slot], t.stat) });
          });
      } else {
        const pct = pctOf(t.slot, t.stat);
        items.push({ v: pct, w: t.w });
        if (detail && Number.isFinite(pct)) cs.push({ slot: t.slot, profile: sp[t.slot], stat: t.stat, pct, phrase: statPhrase(sp[t.slot], t.stat) });
      }
    });
    raws[u] = wmean(items);
    contrib[u] = cs;
  });

  DEFENSE_UNITS.forEach((u) => {
    let raw = 0;
    const cs: Contributor[] = [];
    DEFENSE_TERMS[u].forEach((t) => {
      DEF_SLOTS.forEach((slot) => {
        const p = sp[slot];
        raw += t.w * (p.rates[t.rate] ?? 0);
        if (detail && t.w >= 1) cs.push({ slot, profile: p, stat: t.rate, pct: defPct(p, t.rate), phrase: statPhrase(p, t.rate) });
      });
    });
    raws[u] = raw;
    contrib[u] = cs;
  });

  raws.star = wmean(
    SLOT_IDS.map((id) => {
      const p = sp[id];
      const ovrN = ((p.ovr - 62) / 37) * 100;
      return { v: Number.isFinite(p.legacyPct) ? 0.6 * ovrN + 0.4 * p.legacyPct : ovrN, w: 1 };
    }),
  );
  if (detail)
    contrib.star = SLOT_IDS.map((id) => ({
      slot: id,
      profile: sp[id],
      stat: 'ovr',
      pct: ((sp[id].ovr - 62) / 37) * 100,
      phrase: `${short(sp[id])} is a ${sp[id].ovr} OVR${Number.isFinite(sp[id].legacyPct) ? ` (${ordinal(sp[id].legacyPct)} percentile Career Legacy)` : ''}`,
    }));
  return { raws, contrib };
};

// ---------- Benchmark ----------

export interface Benchmark {
  size: number;
  seed: number;
  units: Record<UnitId, number[]>;
  offense: number[];
  defense: number[];
  team: number[];
}

/** Deterministic PRNG (mulberry32). */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickDistinct = <X>(list: X[], n: number, r: () => number): X[] => {
  const copy = [...list];
  const out: X[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
};

const randomFrom = (byPos: Map<Position, PlayerProfile[]>, r: () => number): Lineup => {
  const one = (pos: Position) => pickDistinct(byPos.get(pos) ?? [], 1, r)[0]?.key ?? '';
  const wrs = pickDistinct(byPos.get('WR') ?? [], 2, r);
  const defs = pickDistinct(DEFENSE_POSITIONS.flatMap((p) => byPos.get(p) ?? []), 4, r);
  return {
    qb: one('QB'),
    rb: one('RB'),
    wr1: wrs[0]?.key ?? '',
    wr2: wrs[1]?.key ?? '',
    te: one('TE'),
    ol: one('OL'),
    d1: defs[0]?.key ?? '',
    d2: defs[1]?.key ?? '',
    d3: defs[2]?.key ?? '',
    d4: defs[3]?.key ?? '',
  };
};

const rollOffense = (scores: Record<UnitId, number>) => OFFENSE_UNITS.reduce((s, u) => s + UNIT_WEIGHTS.offense[u] * scores[u], 0);
const rollDefense = (scores: Record<UnitId, number>) => DEFENSE_UNITS.reduce((s, u) => s + UNIT_WEIGHTS.defense[u] * scores[u], 0);
const rollTeam = (off: number, def: number, star: number) =>
  UNIT_WEIGHTS.team.offense * off + UNIT_WEIGHTS.team.defense * def + UNIT_WEIGHTS.team.star * star;

export const BENCHMARK_SIZE = 500;
export const BENCHMARK_SEED = 80;

const buildBenchmark = (profiles: Map<string, PlayerProfile>, byLeaguePos: Map<Position, PlayerProfile[]>): Benchmark => {
  const r = rng(BENCHMARK_SEED);
  const all: Record<UnitId, number>[] = [];
  for (let i = 0; i < BENCHMARK_SIZE; i += 1) {
    const l = randomFrom(byLeaguePos, r);
    if (!isComplete(l)) continue;
    all.push(unitRaws(slotProfiles(profiles, l)!, false).raws);
  }
  const sorted = (xs: number[]) => xs.filter(Number.isFinite).sort((a, b) => a - b);
  const units = Object.fromEntries(ALL_UNITS.map((u) => [u, sorted(all.map((x) => x[u]))])) as Record<UnitId, number[]>;
  const scored = all.map((raws) => Object.fromEntries(ALL_UNITS.map((u) => [u, percentileOf(units[u], raws[u])])) as Record<UnitId, number>);
  const offRaw = scored.map(rollOffense);
  const defRaw = scored.map(rollDefense);
  const offense = sorted(offRaw);
  const defense = sorted(defRaw);
  const team = sorted(scored.map((s, i) => rollTeam(percentileOf(offense, offRaw[i]), percentileOf(defense, defRaw[i]), s.star)));
  return { size: all.length, seed: BENCHMARK_SEED, units, offense, defense, team };
};

// ---------- Context ----------

export interface LabContext {
  /** League players (benchmarks, percentiles) */
  league: Player[];
  /** Pickable players: league (+ legends when enabled) */
  pool: Player[];
  profiles: Map<string, PlayerProfile>;
  /** Pool profiles by position, best official OVR first */
  byPos: Map<Position, PlayerProfile[]>;
  bench: Benchmark;
}

const groupByPos = (list: PlayerProfile[]) => {
  const m = new Map<Position, PlayerProfile[]>();
  list.forEach((p) => m.set(p.position, [...(m.get(p.position) ?? []), p]));
  m.forEach((arr) => arr.sort((a, b) => b.ovr - a.ovr || b.overallPct - a.overallPct || a.name.localeCompare(b.name)));
  return m;
};

/**
 * Build once per data load (memoise it). `league` = league players (no legends), `legends` = real NFL players
 * to make pickable (pass [] to keep them out), `ovrMap` = official OVR keyed "POS:Name".
 */
export const createLabContext = (league: Player[], legends: Player[], ovrMap: Map<string, number>): LabContext => {
  const leagueOnly = league.filter((p) => !p.isRealLegend);
  const taken = new Set(leagueOnly.map(playerKey));
  const pool = [...leagueOnly, ...legends.filter((p) => !taken.has(playerKey(p)))];
  const profiles = buildProfiles(leagueOnly, pool, ovrMap);
  const all = [...profiles.values()];
  const byPos = groupByPos(all);
  const byLeaguePos = groupByPos(all.filter((p) => !p.isLegend && p.player.games > 0));
  return { league: leagueOnly, pool, profiles, byPos, bench: buildBenchmark(profiles, byLeaguePos) };
};

const slotProfiles = (profiles: Map<string, PlayerProfile>, l: Lineup): SlotProfiles | null => {
  const out = {} as SlotProfiles;
  for (const id of SLOT_IDS) {
    const p = profiles.get(l[id]);
    if (!p) return null;
    out[id] = p;
  }
  return out;
};

// ---------- Scoring ----------

export interface Rollup {
  /** Weighted mean of the unit scores (0–100) */
  raw: number;
  /** Benchmark percentile of raw: "better than X% of possible teams" */
  score: number;
  grade: GradeStep;
}

export interface LineupScore {
  units: Record<UnitId, UnitResult>;
  offense: Rollup;
  defense: Rollup;
  team: Rollup;
}

const gradeOf = (pct: number) => gradeFor(pct) ?? gradeFor(0)!;

const scoreSlots = (ctx: LabContext, sp: SlotProfiles, detail: boolean): LineupScore => {
  const { raws, contrib } = unitRaws(sp, detail);
  const units = {} as Record<UnitId, UnitResult>;
  ALL_UNITS.forEach((u) => {
    const score = percentileOf(ctx.bench.units[u], raws[u]);
    units[u] = { id: u, label: UNIT_LABELS[u], raw: raws[u], score, grade: gradeOf(score), contributors: contrib[u] ?? [] };
  });
  if (detail)
    DEFENSE_UNITS.forEach((u) => {
      units[u].summary = DEFENSE_TERMS[u]
        .map((t) => `${fx(DEF_SLOTS.reduce((s, id) => s + (sp[id].rates[t.rate] ?? 0), 0), t.rate === 'tklG' ? 1 : 2)} ${RATE_LABEL[t.rate]}`)
        .join(' + ');
    });
  const scores = Object.fromEntries(ALL_UNITS.map((u) => [u, units[u].score])) as Record<UnitId, number>;
  const offRaw = rollOffense(scores);
  const defRaw = rollDefense(scores);
  const offense = { raw: offRaw, score: percentileOf(ctx.bench.offense, offRaw), grade: gradeOf(0) };
  const defense = { raw: defRaw, score: percentileOf(ctx.bench.defense, defRaw), grade: gradeOf(0) };
  offense.grade = gradeOf(offense.score);
  defense.grade = gradeOf(defense.score);
  const teamRaw = rollTeam(offense.score, defense.score, scores.star);
  const teamScore = percentileOf(ctx.bench.team, teamRaw);
  return { units, offense, defense, team: { raw: teamRaw, score: teamScore, grade: gradeOf(teamScore) } };
};

/** Scores only (no evidence strings): cheap enough for upgrade searches and rankings. Null if incomplete. */
export const scoreLineup = (ctx: LabContext, l: Lineup): LineupScore | null => {
  const sp = slotProfiles(ctx.profiles, l);
  return sp ? scoreSlots(ctx, sp, false) : null;
};

// ---------- Analysis ----------

export type Impact = 'high' | 'med' | 'low';
export interface Insight {
  unit: UnitId;
  title: string;
  detail: string;
  score: number;
  grade: GradeStep;
}
/** Game situations the call sheet is organised by ('every' = applies on every snap). */
export type Situation =
  | 'every'
  | 'early'
  | 'third-short'
  | 'third-medium'
  | 'third-long'
  | 'redzone'
  | 'two-point'
  | 'fourth'
  | 'lead'
  | 'trailing'
  | 'takeaway'
  | 'half';
/** One short call (≤ 10 words) for a situation, optionally aimed at a lineup slot. */
export interface Call {
  situation: Situation;
  text: string;
  target?: SlotId;
}
export interface SheetCall extends Call {
  impact: Impact;
  why: string;
  recId: string;
  priority: number;
}
export interface CallGroup {
  situation: Situation;
  label: string;
  calls: SheetCall[];
}
export interface Recommendation {
  id: string;
  title: string;
  why: string;
  what: string;
  impact: Impact;
  priority: number;
  /** Wristband line (a few words) and its key number, e.g. "Lock: no forced throws late" · "4.4% INT" */
  short: string;
  stat: string;
  calls: Call[];
}
export type FourthCall = 'GO' | 'FG' | 'PUNT';
export interface FourthDownChart {
  policy: 'aggressive' | 'standard' | 'conservative';
  zones: string[];
  distances: string[];
  /** cells[zone][distance] */
  cells: FourthCall[][];
  note: string;
}
export interface TwoPointChart {
  tier: 'strong' | 'standard' | 'weak';
  cells: { margin: number; label: string; go: boolean }[];
  note: string;
}
export interface TargetRole {
  label: string;
  tone: 'good' | 'neutral' | 'warn';
}
export interface TargetCard {
  slot: SlotId;
  profile: PlayerProfile;
  roles: TargetRole[];
  numbers: string[];
}
export interface Identity {
  label: string;
  why: string;
}
export interface TeamAnalysis extends LineupScore {
  slots: SlotProfiles;
  identity: Identity;
  strengths: Insight[];
  weaknesses: Insight[];
  /** Top 10 recommendations by priority (the full rule output feeds the call sheet) */
  gamePlan: Recommendation[];
  /** Up to 3 high/medium-impact items for the banner lines */
  mustKnows: Recommendation[];
  callSheet: CallGroup[];
  fourthDown: FourthDownChart;
  twoPoint: TwoPointChart;
  targets: TargetCard[];
}

const r0 = (x: number) => Math.round(x);
const pctTxt = (x: number) => `${ordinal(x)} percentile`;
const unitTxt = (u: UnitResult) => `${u.label.toLowerCase()} ${u.grade.grade} (${pctTxt(u.score)})`;

const identityFor = (s: LineupScore): Identity => {
  const u = (id: UnitId) => s.units[id].score;
  const off = s.offense.score;
  const def = s.defense.score;
  const pass = u('passing');
  const run = u('run');
  const rules: { when: boolean; label: string; why: string }[] = [
    {
      when: off >= 80 && def >= 80,
      label: 'Dynasty juggernaut',
      why: `Offense (${pctTxt(off)}) and defense (${pctTxt(def)}) both beat at least 80% of possible teams: there is no soft spot to attack.`,
    },
    {
      when: off >= 65 && def < 40,
      label: 'Shootout team',
      why: `The offense beats ${r0(off)}% of possible teams but the defense only ${r0(def)}%: expect high-scoring games you win by having the ball last.`,
    },
    {
      when: u('playmaking') >= 75 && (u('coverage') >= 65 || u('passRush') >= 65),
      label: 'Turnover machine',
      why: `Defensive playmaking is ${pctTxt(u('playmaking'))} (${s.units.playmaking.summary ?? ''}): this defense takes the ball away.`,
    },
    {
      when: pass >= 70 && pass - run >= 15,
      label: 'Air Raid',
      why: `The passing game (${pctTxt(pass)}) is far ahead of the run game (${pctTxt(run)}): the ball should be in the air.`,
    },
    {
      when: run >= 70 && run - pass >= 15,
      label: 'Ground and Pound',
      why: `The run game (${pctTxt(run)}) outclasses the passing game (${pctTxt(pass)}): lean on the RB and the line.`,
    },
    {
      when: def >= 60 && u('runDef') >= 60 && u('passRush') < 50,
      label: "Bend-don't-break defense",
      why: `Run defense is ${pctTxt(u('runDef'))} but the pass rush only ${pctTxt(u('passRush'))}: drives get long, but tackles get made.`,
    },
    {
      when: def >= 70 && off < 50,
      label: 'Defense-first grinder',
      why: `The defense (${pctTxt(def)}) carries an offense at the ${pctTxt(off)}: win low-scoring games.`,
    },
    {
      when: u('explosive') >= 80,
      label: 'Big-play offense',
      why: `Explosiveness is ${pctTxt(u('explosive'))}: this team scores in a few snaps rather than long drives.`,
    },
    {
      when: off >= 45 && def >= 45,
      label: 'Balanced contender',
      why: `Offense (${pctTxt(off)}) and defense (${pctTxt(def)}) are both above average with no unit dominating.`,
    },
  ];
  const hit = rules.find((r) => r.when);
  if (hit) return { label: hit.label, why: hit.why };
  return off >= def
    ? { label: 'Rebuild project', why: `The offense (${pctTxt(off)}) is the best part, and the defense (${pctTxt(def)}) needs reinforcements.` }
    : { label: 'Rebuild project', why: `The defense (${pctTxt(def)}) is the best part, and the offense (${pctTxt(off)}) needs reinforcements.` };
};

const insightFor = (unit: UnitResult, strength: boolean): Insight => {
  const cs = [...unit.contributors].filter((c) => Number.isFinite(c.pct)).sort((a, b) => (strength ? b.pct - a.pct : a.pct - b.pct));
  // Cite two different players where possible
  const cited: Contributor[] = [];
  cs.forEach((c) => {
    if (cited.length < 2 && !cited.some((x) => x.profile.key === c.profile.key)) cited.push(c);
  });
  const lead = DEFENSE_UNITS.includes(unit.id) && unit.summary ? `Your 4 defenders combine for ${unit.summary}. ` : '';
  const detail = `${lead}${cited.map((c) => c.phrase).join(', and ')}.`;
  return {
    unit: unit.id,
    title: `${strength ? 'Strength' : 'Weakness'}: ${unit.label.toLowerCase()} (${unit.grade.grade}, better than ${r0(unit.score)}% of teams)`,
    detail: detail.charAt(0).toUpperCase() + detail.slice(1),
    score: unit.score,
    grade: unit.grade,
  };
};

const statOf = (p: PlayerProfile, id: string) => p.stats[id];
const sPct = (p: PlayerProfile, id: string) => p.stats[id]?.pct ?? NaN;
const stat = (p: PlayerProfile, id: string) => {
  const s = p.stats[id];
  return s ? (s.name === s.label ? s.display : `${s.display} ${s.label}`) : '—';
};
const bestBy = (list: PlayerProfile[], id: string) =>
  [...list].filter((p) => Number.isFinite(sPct(p, id))).sort((a, b) => sPct(b, id) - sPct(a, id))[0];
/** Highest raw value among players whose percentile clears `minPct` (e.g. the real deep threat by Y/R). */
const bestByValue = (list: PlayerProfile[], id: string, minPct: number) =>
  [...list].filter((p) => sPct(p, id) >= minPct && Number.isFinite(p.stats[id]?.value)).sort((a, b) => b.stats[id].value - a.stats[id].value)[0];
const worstBy = (list: PlayerProfile[], id: string) =>
  [...list].filter((p) => Number.isFinite(sPct(p, id))).sort((a, b) => sPct(a, id) - sPct(b, id))[0];
const defTotal = (sp: SlotProfiles, rate: string) => DEF_SLOTS.reduce((s, id) => s + (sp[id].rates[rate] ?? 0), 0);
const defLeader = (sp: SlotProfiles, rate: string) => DEF_SLOTS.map((id) => sp[id]).sort((a, b) => (b.rates[rate] ?? 0) - (a.rates[rate] ?? 0))[0];

const IMPACT_W: Record<Impact, number> = { high: 300, med: 200, low: 100 };
const last = (p: PlayerProfile) => splitLast(p.name);
/** Surname for short calls: keeps particles ("Van Oxley", "De la Cruz") and suffixes ("Surtain II"). */
const PARTICLES = new Set(['van', 'von', 'de', 'da', 'di', 'del', 'della', 'la', 'le', 'st', 'st.', 'mac', 'ter', 'du']);
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
const splitLast = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  let i = parts.length - 1;
  if (SUFFIX.test(parts[i]) && i > 1) i -= 1;
  while (i > 1 && PARTICLES.has(parts[i - 1].toLowerCase())) i -= 1;
  return parts.slice(i).join(' ');
};

/** The 4th-down policy the text rules use: aggressive with a weak defense, conservative with an elite one. */
export type FourthPolicy = 'aggressive' | 'standard' | 'conservative';
const fourthPolicy = (def: number): FourthPolicy => (def < 40 ? 'aggressive' : def >= 70 ? 'conservative' : 'standard');

/** Game plan: rules over unit scores and individual traits (never per player), most important first. */
const gamePlanFor = (s: LineupScore, sp: SlotProfiles): Recommendation[] => {
  const u = (id: UnitId) => s.units[id].score;
  const qb = sp.qb;
  const rb = sp.rb;
  const ol = sp.ol;
  const te = sp.te;
  const recs = [sp.wr1, sp.wr2, sp.te];
  const carriers = [sp.rb, sp.wr1, sp.wr2, sp.te];
  const slotOf = (p: PlayerProfile) => SLOT_IDS.find((id) => sp[id] === p);
  const deep = bestByValue(recs, 'ypr', 65);
  const off = s.offense.score;
  const def = s.defense.score;
  const out: Recommendation[] = [];
  type CallIn = [Situation, string, PlayerProfile?];
  const add = (
    id: string,
    impact: Impact,
    strength: number,
    title: string,
    why: string,
    what: string,
    short: string,
    keyStat: string,
    calls: CallIn[],
  ) =>
    out.push({
      id,
      impact,
      priority: IMPACT_W[impact] + Math.max(0, Math.min(99, strength)),
      title,
      why,
      what,
      short,
      stat: keyStat,
      calls: calls.map(([situation, text, p]) => ({ situation, text, target: p ? slotOf(p) : undefined })),
    });
  const sacks = defTotal(sp, 'sackG');
  const ints = defTotal(sp, 'intG');
  const ffs = defTotal(sp, 'ffG');
  const policy = fourthPolicy(def);

  // Deep shots vs protection
  if (deep && sPct(deep, 'ypr') >= 65 && sPct(qb, 'ya') >= 55) {
    const protection = s.units.protection;
    if (protection.score < 45)
      add(
        'deep-early',
        'high',
        sPct(deep, 'ypr') - protection.score,
        `Take deep shots to ${deep.name} on 1st and 2nd down`,
        `${deep.name} averages ${statOf(deep, 'ypr').display} yards a catch (${pctTxt(sPct(deep, 'ypr'))}) and ${qb.name} throws for ${statOf(qb, 'ya').display} Y/A, but protection grades ${protection.grade.grade} (${pctTxt(protection.score)}): ${ol.name} makes ${stat(ol, 'blocksG')}${Number.isFinite(qb.dropbacksPerSack) ? ` and ${qb.name} is sacked every ${r0(qb.dropbacksPerSack)} dropbacks` : ''}.`,
        `Lead ${deep.name} deep on early downs, before the rush arrives. On 3rd and long, take the first open short route and get rid of it fast.`,
        `Deep to ${last(deep)} early, before the rush`,
        `${statOf(deep, 'ypr').display} Y/R`,
        [
          ['early', `Deep shot → ${last(deep)}, before the rush`, deep],
          ['third-long', 'First open route; ball out fast'],
        ],
      );
    else
      add(
        'deep',
        'med',
        sPct(deep, 'ypr') - 50,
        `Let deep routes develop for ${deep.name}`,
        `${deep.name} averages ${statOf(deep, 'ypr').display} yards a catch (${pctTxt(sPct(deep, 'ypr'))}), ${qb.name} throws for ${statOf(qb, 'ya').display} Y/A, and protection holds (${pctTxt(protection.score)}).`,
        `Hold the ball a beat longer and lead ${deep.name} into open space downfield; you have time in the pocket.`,
        `${last(deep)} deep: the line holds`,
        `${statOf(deep, 'ypr').display} Y/R`,
        [
          ['early', `Let ${last(deep)} run deep; you have time`, deep],
          ['third-long', `Lead ${last(deep)} past the sticks`, deep],
        ],
      );
  }

  // QB decision making
  const tdP = sPct(qb, 'tdPct');
  const intP = sPct(qb, 'intPct');
  if (tdP >= 55 && intP <= 40)
    add(
      'gunslinger',
      'high',
      tdP - intP,
      'Gunslinger: stop forcing throws late in close games',
      `${qb.name} throws a TD on ${statOf(qb, 'tdPct').display} of attempts (${pctTxt(tdP)}) but an INT on ${statOf(qb, 'intPct').display} (${pctTxt(intP)} in decision making).`,
      `Let him hunt big plays early. In the 4th quarter of a one-score game, throw it away instead of into coverage, and protect leads with ${rb.name} and ${te.name}.`,
      `${last(qb)}: no forced throws late`,
      `${statOf(qb, 'intPct').display} INT`,
      [['lead', `No forced throws; feed ${last(rb)} and ${last(te)}`, rb]],
    );
  else if (intP <= 30)
    add(
      'careless',
      'high',
      50 - intP,
      'Only throw to clearly open receivers',
      `${qb.name} throws an INT on ${statOf(qb, 'intPct').display} of attempts (${pctTxt(intP)} in decision making).`,
      'Avoid floating passes over the middle and throws into tight windows; a punt beats a pick, especially in your own half.',
      `${last(qb)}: open receivers only`,
      `${statOf(qb, 'intPct').display} INT`,
      [['every', 'Open receivers only; a punt beats a pick']],
    );
  else if (intP >= 75 && sPct(qb, 'cmp') >= 65)
    add(
      'trusted',
      'med',
      intP - 50,
      'Trust your QB in tight windows on 3rd down',
      `${qb.name} completes ${statOf(qb, 'cmp').display} (${pctTxt(sPct(qb, 'cmp'))}) and throws an INT on only ${statOf(qb, 'intPct').display} (${pctTxt(intP)}).`,
      'Throw to the sticks on 3rd and medium even when the window is small; his turnover risk is low.',
      `Trust ${last(qb)} in tight windows`,
      `${statOf(qb, 'intPct').display} INT`,
      [['third-medium', `Throw to the sticks; trust ${last(qb)}`]],
    );

  // 4th-down policy from the defense (the chart in fourthDownChart uses the same policy)
  if (policy === 'aggressive')
    add(
      'fourth-aggressive',
      'high',
      40 - def + 30,
      'Play four-down football, go for 2 and onside late',
      `The defense beats only ${r0(def)}% of possible teams: the 4 defenders combine for ${fx(sacks)} sacks/G and ${fx(ints)} INT/G, so stops are rare.`,
      'Go for it on 4th and 3 or less past midfield, go for 2 more often, and try an onside kick when trailing in the last 3 minutes: you may not get the ball back otherwise.',
      'Four-down football past midfield',
      `D ${ordinal(def)} pct`,
      [
        ['fourth', 'Go on 4th & ≤5 past midfield'],
        ['trailing', 'Onside kick in the last 3 minutes'],
      ],
    );
  else if (policy === 'conservative')
    add(
      'fourth-conservative',
      'high',
      def - 70 + 30,
      'Punt and win the field-position game',
      `The defense beats ${r0(def)}% of possible teams (${fx(sacks)} sacks/G, ${fx(ints)} INT/G, ${fx(ffs)} FF/G combined).`,
      'Punt on 4th down in your own half, take the field goal over 4th-and-long, and kick off deep: your defense will get the ball back.',
      'Punt and trust the defense',
      `D ${ordinal(def)} pct`,
      [
        ['fourth', 'Punt in your half; FG over gambles'],
        ['trailing', 'Kick deep; your D gets it back'],
      ],
    );
  else
    add(
      'fourth-standard',
      'low',
      20,
      'Standard 4th-down rules',
      `The defense is middle of the pack (${pctTxt(def)}), so neither extreme pays.`,
      'Go for it on 4th and 1–2 past midfield; punt from your own half; kick field goals inside the 25 on longer 4th downs.',
      'Go on 4th & 1–2 past midfield',
      `D ${ordinal(def)} pct`,
      [['fourth', 'Go on 4th & 1–2 past midfield']],
    );

  // Red zone and 2-point conversions
  const rbTd = sPct(rb, 'td16');
  if (rbTd >= 65)
    add(
      'rz-run',
      'med',
      rbTd - 50,
      `Hand off to ${rb.name} inside the 10`,
      `${rb.name} scores ${statOf(rb, 'td16').display} TDs per 16 games (${pctTxt(rbTd)}).`,
      'Inside the 10, run on 1st and 2nd down and save the pass for 3rd down.',
      `Inside the 10: ${last(rb)}`,
      `${statOf(rb, 'td16').display} TD/16`,
      [['redzone', `Inside the 10 → ${last(rb)} on 1st & 2nd`, rb]],
    );
  const rz = bestBy(recs, 'tdPerRec');
  if (rz && sPct(rz, 'tdPerRec') >= 70)
    add(
      'rz-target',
      'med',
      sPct(rz, 'tdPerRec') - 50,
      `Target ${rz.name} in the end zone`,
      `${statOf(rz, 'tdPerRec').display} of ${rz.name}'s catches are touchdowns (${pctTxt(sPct(rz, 'tdPerRec'))}).`,
      `In the red zone look for him first and lead him to the back of the end zone, where only he can catch it.`,
      `End zone: ${last(rz)}`,
      `${statOf(rz, 'tdPerRec').display} TD/rec`,
      [['redzone', `End zone → ${last(rz)}, back line`, rz]],
    );
  const redzone = s.units.redzone;
  if (redzone.score >= 65)
    add(
      'two-point',
      'med',
      redzone.score - 50,
      'Go for 2 more often',
      `Red zone grades ${redzone.grade.grade} (${pctTxt(redzone.score)}): ${qb.name} throws a TD on ${statOf(qb, 'tdPct').display} of attempts.`,
      'After a touchdown late, go for 2 when down 9, 5, 2 or 1, or up 1 or 5. Your short-yardage offense converts more often than average.',
      'Go for 2 more often',
      `RZ ${ordinal(redzone.score)} pct`,
      [['two-point', 'Go for 2 more often: see chart']],
    );
  else if (redzone.score < 35)
    add(
      'take-points',
      'med',
      35 - redzone.score,
      'Take the points in the red zone',
      `Red zone grades ${redzone.grade.grade} (${pctTxt(redzone.score)}): TDs are hard to come by inside the 20.`,
      'On 4th down inside the 20, kick the field goal, and kick the extra point unless the score demands 2.',
      'Take the points in the red zone',
      `RZ ${ordinal(redzone.score)} pct`,
      [
        ['redzone', '4th down inside the 20 → kick'],
        ['two-point', 'Kick the PAT unless down 2'],
      ],
    );
  else
    add(
      'two-point-standard',
      'low',
      10,
      'Standard 2-point chart',
      `Red zone grades ${redzone.grade.grade} (${pctTxt(redzone.score)}): average short-yardage conversion.`,
      'Late in the game, go for 2 when down 5 or 2, or up 1 or 5; otherwise kick.',
      'Standard 2-point chart',
      `RZ ${ordinal(redzone.score)} pct`,
      [['two-point', 'Kick, except the chart spots']],
    );

  // Ball security of the carriers
  const fumbler = worstBy(carriers, 'fumRate');
  if (fumbler && sPct(fumbler, 'fumRate') <= 30 && statOf(fumbler, 'fumRate').value > 0)
    add(
      'fumbler',
      fumbler.position === 'RB' ? 'high' : 'med',
      40 - sPct(fumbler, 'fumRate'),
      `Keep the ball away from ${fumbler.name} when protecting a lead`,
      `${fumbler.name} fumbles ${statOf(fumbler, 'fumRate').display} times per 100 ${fumbler.position === 'RB' ? 'touches' : 'catches'} (${pctTxt(sPct(fumbler, 'fumRate'))} in ball security).`,
      `Use him early when you need yards; with a lead in the 4th, ${fumbler.position === 'RB' ? 'throw short to safer hands or run the QB' : 'target your other receivers'}.`,
      `${last(fumbler)}: not with a late lead`,
      `${statOf(fumbler, 'fumRate').display} fum/100`,
      [['lead', `Keep the ball away from ${last(fumbler)}`, fumbler]],
    );

  // Checkdowns
  const teHands = sPct(te, 'recG');
  const rbHands = sPct(rb, 'recYdsG');
  if (teHands >= 60 || rbHands >= 60) {
    const who = teHands >= rbHands ? te : rb;
    const id = who === te ? 'recG' : 'recYdsG';
    add(
      'checkdown',
      'med',
      Math.max(teHands, rbHands) - 50,
      `Check it down to ${who.name} on 3rd and medium`,
      `${who.name} is ${pctTxt(sPct(who, id))} in ${statOf(who, id).name.toLowerCase()} (${stat(who, id)}).`,
      `On 3rd and 4–7, hit ${who.name} underneath and let him run after the catch instead of forcing it downfield.`,
      `3rd & medium: ${last(who)} underneath`,
      stat(who, id),
      [['third-medium', `3rd & 4–7 → ${last(who)} underneath`, who]],
    );
  }

  // Run game and the clock
  const run = s.units.run;
  if (run.score >= 70)
    add(
      'milk-clock',
      'med',
      run.score - 50,
      'Milk the clock with the lead',
      `The run game grades ${run.grade.grade} (${pctTxt(run.score)}): ${rb.name} averages ${statOf(rb, 'ypc').display} yards a carry (${pctTxt(sPct(rb, 'ypc'))}).`,
      'Up two scores in the second half, run on 1st and 2nd down and let the clock tick between plays.',
      `Milk the clock with ${last(rb)}`,
      `${statOf(rb, 'ypc').display} Y/C`,
      [['lead', `Run ${last(rb)} 1st & 2nd; drain clock`, rb]],
    );
  else if (run.score < 35)
    add(
      'no-run-long',
      'med',
      35 - run.score + 10,
      "Don't waste downs running on 3rd and long",
      `The run game grades ${run.grade.grade} (${pctTxt(run.score)}): ${rb.name} averages ${statOf(rb, 'ypc').display} yards a carry.`,
      'Run on 1st and 10 and in short yardage only; on 3rd and 4+ throw.',
      'No runs on 3rd & long',
      `${statOf(rb, 'ypc').display} Y/C`,
      [['third-long', 'Never run; throw past the sticks']],
    );
  // 3rd & short: always a call, from the run game
  add(
    'third-short',
    'low',
    Math.abs(run.score - 50) / 2,
    run.score >= 50 ? `Hand off to ${rb.name} on 3rd and short` : `Quick throw on 3rd and short`,
    `The run game is ${pctTxt(run.score)}: ${rb.name} averages ${statOf(rb, 'ypc').display} yards a carry.`,
    run.score >= 50 ? 'On 3rd and 1–2, run it.' : `On 3rd and 1–2, throw a quick pass to your surest hands instead of running.`,
    run.score >= 50 ? `3rd & short: ${last(rb)}` : '3rd & short: quick throw',
    `${statOf(rb, 'ypc').display} Y/C`,
    [
      run.score >= 50
        ? ['third-short', `3rd & 1–2 → ${last(rb)} up the middle`, rb]
        : ['third-short', `3rd & 1–2 → quick throw to ${last(bestBy(recs, 'recG') ?? te)}`, bestBy(recs, 'recG') ?? te],
    ],
  );

  // Protection without deep-shot context
  const protection = s.units.protection;
  if (protection.score < 40 && !out.some((r) => r.id === 'deep-early')) {
    const legs = sPct(qb, 'rushYdsG');
    if (legs >= 60)
      add(
        'escape',
        'med',
        40 - protection.score + 10,
        `Roll out with ${qb.name} when the pocket collapses`,
        `Protection grades ${protection.grade.grade} (${pctTxt(protection.score)}), but ${qb.name} is ${pctTxt(legs)} in legs (${stat(qb, 'rushYdsG')}).`,
        'When the rush gets close, scramble outside and either run or throw on the move instead of taking the sack.',
        `${last(qb)}: roll out under pressure`,
        stat(qb, 'rushYdsG'),
        [['third-long', `Pressure → roll out with ${last(qb)}`, qb]],
      );
    else
      add(
        'quick-game',
        'high',
        40 - protection.score + 10,
        'Get the ball out fast',
        `Protection grades ${protection.grade.grade} (${pctTxt(protection.score)}): ${ol.name} makes ${stat(ol, 'blocksG')}${Number.isFinite(qb.dropbacksPerSack) ? ` and ${qb.name} is sacked every ${r0(qb.dropbacksPerSack)} dropbacks` : ''}.`,
        'Throw on the first read: short and intermediate routes, no long holds in the pocket.',
        'Ball out fast: first read',
        `Prot ${ordinal(protection.score)} pct`,
        [
          ['early', 'Quick throws; first read'],
          ['third-long', 'No long holds; take the sure yards'],
        ],
      );
  }

  // Overall ball security
  const security = s.units.security;
  if (security.score < 35)
    add(
      'security',
      'high',
      35 - security.score + 10,
      'Play for field position, not hero ball',
      `Ball security grades ${security.grade.grade} (${pctTxt(security.score)}): ${qb.name} throws an INT on ${statOf(qb, 'intPct').display} of attempts.`,
      'Throw it away under pressure, avoid long passes across the field, and punt rather than gamble deep in your own half.',
      'Throw it away; no hero ball',
      `Sec ${ordinal(security.score)} pct`,
      [['every', 'Under pressure → throw it away']],
    );

  // Defense-driven decisions
  const passRush = s.units.passRush;
  if (passRush.score >= 70) {
    const lead = defLeader(sp, 'sackG');
    add(
      'pin-deep',
      'low',
      passRush.score - 50,
      'Pin them deep: your pass rush feasts on long fields',
      `The defense combines for ${fx(sacks)} sacks/G (${pctTxt(passRush.score)}), led by ${lead.name} at ${fx(lead.rates.sackG)}.`,
      'Punting from midfield beats a 4th-and-5 gamble: backed-up offenses have to throw into your rush.',
      'Pin them deep for the pass rush',
      `${fx(sacks)} sacks/G`,
      [['fourth', 'Midfield 4th & 5+ → pin them deep']],
    );
  }
  const playmaking = s.units.playmaking;
  if (playmaking.score >= 70)
    add(
      'short-field',
      'med',
      playmaking.score - 50,
      'Strike right after a takeaway',
      `The defense forces ${fx(ints + ffs)} takeaways per game (${pctTxt(playmaking.score)}).`,
      'After a turnover, take one shot at the end zone on 1st down: the short field makes it a free play.',
      'After a takeaway: end-zone shot',
      `${fx(ints + ffs)} TO/G`,
      [['takeaway', `1st down → end-zone shot${deep ? ` to ${last(deep)}` : ''}`, deep]],
    );
  else
    add(
      'takeaway-standard',
      'low',
      5,
      'Cash in after a takeaway',
      `The defense forces ${fx(ints + ffs)} takeaways per game (${pctTxt(playmaking.score)}): they are not routine, so make each one count.`,
      'After a turnover, play your normal offense and make sure you come away with points.',
      'After a takeaway: get points',
      `${fx(ints + ffs)} TO/G`,
      [['takeaway', 'Normal offense; come away with points']],
    );

  // Explosiveness
  const explosive = s.units.explosive;
  if (explosive.score >= 75)
    add(
      'no-panic',
      'low',
      explosive.score - 50,
      "Don't panic when behind",
      `Explosiveness is ${pctTxt(explosive.score)}: this offense can score in two or three snaps.`,
      'Trailing by 7–10 in the 4th, keep running your normal offense instead of forcing deep throws on every down.',
      "Behind? Don't panic",
      `Expl ${ordinal(explosive.score)} pct`,
      [['trailing', 'Down 7–10: stay in your offense']],
    );

  // Clock policy (always applies)
  if (off - def >= 15)
    add(
      'clock-fast',
      'med',
      off - def,
      'Play fast: more possessions favour you',
      `The offense (${pctTxt(off)}) is much better than the defense (${pctTxt(def)}).`,
      'Hurry when tied or trailing, but at the end of each half drain the clock so you score with under 30 seconds left and the opponent gets no answer.',
      'Play fast; score last each half',
      `O ${ordinal(off)} / D ${ordinal(def)}`,
      [
        ['trailing', 'Hurry: more possessions favour you'],
        ['half', 'Score with under 30 s left'],
      ],
    );
  else if (def - off >= 15)
    add(
      'clock-slow',
      'med',
      def - off,
      'Shorten the game',
      `The defense (${pctTxt(def)}) is much better than the offense (${pctTxt(off)}).`,
      'Let the clock run between plays once you lead; fewer possessions make every stop count for more.',
      'Shorten the game',
      `O ${ordinal(off)} / D ${ordinal(def)}`,
      [
        ['lead', 'Let the clock run between plays'],
        ['half', 'Run the clock out; no risky throws'],
      ],
    );
  else
    add(
      'clock-halves',
      'low',
      10,
      'Win the end of each half',
      `Offense (${pctTxt(off)}) and defense (${pctTxt(def)}) are close, so possessions at the end of halves swing games.`,
      'With the ball and under 2 minutes left, manage the clock to score last; avoid leaving the opponent more than 30 seconds.',
      'Score last each half',
      `O ${ordinal(off)} / D ${ordinal(def)}`,
      [['half', 'Score last; leave them ≤ 30 s']],
    );

  return out.sort((a, b) => b.priority - a.priority);
};

// ---------- Call sheet, decision charts, target board ----------

export const SITUATIONS: { id: Situation; label: string }[] = [
  { id: 'every', label: 'Every snap' },
  { id: 'early', label: 'Early downs' },
  { id: 'third-short', label: '3rd & short' },
  { id: 'third-medium', label: '3rd & medium' },
  { id: 'third-long', label: '3rd & long' },
  { id: 'redzone', label: 'Red zone' },
  { id: 'two-point', label: 'After a TD' },
  { id: 'fourth', label: '4th down' },
  { id: 'lead', label: 'Protecting a lead' },
  { id: 'trailing', label: 'Trailing late' },
  { id: 'takeaway', label: 'After a takeaway' },
  { id: 'half', label: 'End of half' },
];

const callSheetFor = (plan: Recommendation[], sp: SlotProfiles, s: LineupScore): CallGroup[] => {
  const groups = new Map<Situation, SheetCall[]>(SITUATIONS.map((x) => [x.id, []]));
  plan.forEach((r) => r.calls.forEach((c) => groups.get(c.situation)!.push({ ...c, impact: r.impact, why: r.why, recId: r.id, priority: r.priority })));
  // Situations no rule spoke to get a neutral default, so the sheet is always complete
  if (!groups.get('early')!.length) {
    const hands = bestBy([sp.wr1, sp.wr2, sp.te], 'recG') ?? sp.te;
    groups.get('early')!.push({
      situation: 'early',
      text: s.units.run.score >= s.units.passing.score ? `Mix ${last(sp.rb)} runs with short throws` : `Throw early: ${last(hands)} moves the chains`,
      target: s.units.run.score >= s.units.passing.score ? 'rb' : SLOT_IDS.find((id) => sp[id] === hands),
      impact: 'low',
      why: `Run game ${pctTxt(s.units.run.score)}, passing game ${pctTxt(s.units.passing.score)}.`,
      recId: 'default-early',
      priority: 0,
    });
  }
  if (!groups.get('third-medium')!.length) {
    const hands = bestBy([sp.wr1, sp.wr2, sp.te], 'recG') ?? sp.te;
    groups.get('third-medium')!.push({
      situation: 'third-medium',
      text: `3rd & 4–7 → ${last(hands)} at the sticks`,
      target: SLOT_IDS.find((id) => sp[id] === hands),
      impact: 'low',
      why: `${hands.name} catches ${stat(hands, 'recG')} (${pctTxt(sPct(hands, 'recG'))}), the surest hands in the lineup.`,
      recId: 'default-third-medium',
      priority: 0,
    });
  }
  if (!groups.get('third-long')!.length)
    groups.get('third-long')!.push({
      situation: 'third-long',
      text: 'Throw past the sticks; no runs',
      impact: 'low',
      why: `Passing game ${pctTxt(s.units.passing.score)} vs run game ${pctTxt(s.units.run.score)}.`,
      recId: 'default-third-long',
      priority: 0,
    });
  if (!groups.get('redzone')!.length)
    groups.get('redzone')!.push({
      situation: 'redzone',
      text: 'Inside the 20: take the sure TD or FG',
      impact: 'low',
      why: `Red zone ${pctTxt(s.units.redzone.score)}.`,
      recId: 'default-redzone',
      priority: 0,
    });
  if (!groups.get('lead')!.length)
    groups.get('lead')!.push({
      situation: 'lead',
      text: `Short throws and ${last(sp.rb)} runs; no deep shots`,
      target: 'rb',
      impact: 'low',
      why: `Ball security ${pctTxt(s.units.security.score)}.`,
      recId: 'default-lead',
      priority: 0,
    });
  if (!groups.get('trailing')!.length)
    groups.get('trailing')!.push({
      situation: 'trailing',
      text: 'Hurry up; sideline throws stop the clock',
      impact: 'low',
      why: `Offense ${pctTxt(s.offense.score)}.`,
      recId: 'default-trailing',
      priority: 0,
    });
  return SITUATIONS.filter((x) => groups.get(x.id)!.length).map((x) => ({
    situation: x.id,
    label: x.label,
    calls: groups.get(x.id)!.sort((a, b) => b.priority - a.priority).slice(0, 2),
  }));
};

export const FIELD_ZONES = ['Own half', 'Midfield (50–41)', 'Opp 40–25', 'Red zone'] as const;
export const FOURTH_DISTANCES = ['1–2', '3–5', '6+'] as const;

/**
 * 4th-down chart: field zone × distance → GO / FG / PUNT. Same policy as the text rule (defense score), nudged by
 * offense (≥ 70 goes for 4th & 1–2 in your own half when aggressive) and red zone (≥ 65 goes on 3–5 inside the 25,
 * < 35 kicks even on 1–2).
 */
const fourthDownChart = (s: LineupScore): FourthDownChart => {
  const policy = fourthPolicy(s.defense.score);
  const off = s.offense.score;
  const rz = s.units.redzone.score;
  const table: Record<FourthPolicy, FourthCall[][]> = {
    aggressive: [
      [off >= 70 ? 'GO' : 'PUNT', 'PUNT', 'PUNT'],
      ['GO', 'GO', 'PUNT'],
      ['GO', 'GO', 'FG'],
      ['GO', 'GO', 'FG'],
    ],
    standard: [
      ['PUNT', 'PUNT', 'PUNT'],
      ['GO', 'PUNT', 'PUNT'],
      ['GO', 'FG', 'FG'],
      ['GO', 'FG', 'FG'],
    ],
    conservative: [
      ['PUNT', 'PUNT', 'PUNT'],
      ['PUNT', 'PUNT', 'PUNT'],
      ['GO', 'FG', 'FG'],
      ['GO', 'FG', 'FG'],
    ],
  };
  const rows = table[policy].map((r) => [...r]);
  if (policy === 'conservative' && off >= 70) rows[1][0] = 'GO';
  if (rz >= 65) rows[3][1] = 'GO';
  if (rz < 35) rows[3][0] = 'FG';
  const note = {
    aggressive: `Defense ${pctTxt(s.defense.score)}: stops are rare, so keep the ball.`,
    standard: `Defense ${pctTxt(s.defense.score)}: standard risk.`,
    conservative: `Defense ${pctTxt(s.defense.score)}: give the ball to your defense.`,
  }[policy];
  return { policy, zones: [...FIELD_ZONES], distances: [...FOURTH_DISTANCES], cells: rows, note };
};

/** 2-point chart: score margin after the TD (before the try) → go for 2 or kick, late in the game. */
const twoPointChart = (s: LineupScore): TwoPointChart => {
  const rz = s.units.redzone.score;
  const tier: TwoPointChart['tier'] = rz >= 65 ? 'strong' : rz < 35 ? 'weak' : 'standard';
  const go: Record<TwoPointChart['tier'], number[]> = { strong: [-9, -5, -2, -1, 1, 5], standard: [-5, -2, 1, 5], weak: [-2] };
  const margins = [-9, -5, -2, -1, 1, 5];
  return {
    tier,
    cells: margins.map((m) => ({ margin: m, label: m < 0 ? `Down ${-m}` : `Up ${m}`, go: go[tier].includes(m) })),
    note:
      tier === 'strong'
        ? `Red zone ${pctTxt(rz)}: your short-yardage offense converts, so go more often.`
        : tier === 'weak'
          ? `Red zone ${pctTxt(rz)}: kick unless you need the tie.`
          : `Red zone ${pctTxt(rz)}: the standard chart.`,
  };
};

/** Who gets the ball: RB, both WRs and the TE with role tags and their 1–2 key numbers. */
const targetBoardFor = (s: LineupScore, sp: SlotProfiles, plan: Recommendation[]): TargetCard[] => {
  const recs = [sp.wr1, sp.wr2, sp.te];
  const deep = bestByValue(recs, 'ypr', 60);
  const rz = bestBy(recs, 'tdPerRec');
  const hands = bestBy(recs, 'recG');
  const check = plan.find((r) => r.id === 'checkdown')?.calls[0]?.target;
  const fumbler = plan.find((r) => r.id === 'fumbler')?.calls[0]?.target;
  const slots: SlotId[] = ['rb', 'wr1', 'wr2', 'te'];
  return slots.map((slot) => {
    const p = sp[slot];
    const roles: TargetRole[] = [];
    const nums: string[] = [];
    if (slot === 'rb') {
      if (s.units.run.score >= 70) roles.push({ label: 'Closer: run the clock', tone: 'good' });
      if (sPct(p, 'td16') >= 65) roles.push({ label: 'Goal-line back', tone: 'good' });
      if (!roles.length) roles.push({ label: s.units.run.score >= 50 ? 'Early-down back' : 'Change of pace', tone: 'neutral' });
      nums.push(`${statOf(p, 'ypc').display} Y/C`, `${statOf(p, 'td16').display} TD/16`);
    } else {
      if (deep === p) roles.push({ label: 'Deep threat', tone: 'good' });
      if (rz === p && sPct(p, 'tdPerRec') >= 60) roles.push({ label: 'End-zone target', tone: 'good' });
      if (hands === p && !roles.length) roles.push({ label: 'Chain mover', tone: 'good' });
      if (!roles.length) roles.push({ label: slot === 'te' ? 'Safety valve' : 'Second option', tone: 'neutral' });
      const ypr = `${statOf(p, 'ypr').display} Y/R`;
      const td = `${statOf(p, 'tdPerRec').display} TD/rec`;
      const recG = `${statOf(p, 'recG').display} rec/G`;
      if (deep === p) nums.push(ypr, rz === p ? td : recG);
      else if (rz === p) nums.push(td, ypr);
      else nums.push(recG, ypr);
    }
    if (check === slot) roles.push({ label: 'Check-down', tone: 'good' });
    if (fumbler === slot) roles.push({ label: 'Fumble risk late', tone: 'warn' });
    return { slot, profile: p, roles, numbers: [...new Set(nums)].slice(0, 2) };
  });
};

/** Full analysis with cited evidence. Null until all 10 slots are filled. */
export const analyzeLineup = (ctx: LabContext, l: Lineup): TeamAnalysis | null => {
  const sp = slotProfiles(ctx.profiles, l);
  if (!sp) return null;
  const s = scoreSlots(ctx, sp, true);
  const ranked = [...OFFENSE_UNITS, ...DEFENSE_UNITS].map((u) => s.units[u]).sort((a, b) => b.score - a.score);
  const strengths = ranked.slice(0, 3).map((u) => insightFor(u, true));
  const weaknesses = ranked.slice(-3).reverse().map((u) => insightFor(u, false));
  const all = gamePlanFor(s, sp);
  const gamePlan = all.slice(0, 10);
  return {
    ...s,
    slots: sp,
    identity: identityFor(s),
    strengths,
    weaknesses,
    gamePlan,
    mustKnows: all.filter((r) => r.impact !== 'low').slice(0, 3),
    callSheet: callSheetFor(all, sp, s),
    fourthDown: fourthDownChart(s),
    twoPoint: twoPointChart(s),
    targets: targetBoardFor(s, sp, all),
  };
};

// ---------- Presets ----------

const sameTeam = (team: string | undefined, id: string) => (findNFLTeam(team)?.id ?? '') === id;

/** Best lineup from a list of profiles by official OVR: best QB/RB/TE/OL, top 2 WR, top 4 defenders. */
export const bestLineupFrom = (list: PlayerProfile[]): Lineup => {
  const by = groupByPos(list);
  const top = (pos: Position, n: number) => (by.get(pos) ?? []).slice(0, n).map((p) => p.key);
  const wrs = top('WR', 2);
  const defs = DEFENSE_POSITIONS.flatMap((p) => by.get(p) ?? [])
    .sort((a, b) => b.ovr - a.ovr || b.overallPct - a.overallPct)
    .slice(0, 4)
    .map((p) => p.key);
  return {
    qb: top('QB', 1)[0] ?? '',
    rb: top('RB', 1)[0] ?? '',
    wr1: wrs[0] ?? '',
    wr2: wrs[1] ?? '',
    te: top('TE', 1)[0] ?? '',
    ol: top('OL', 1)[0] ?? '',
    d1: defs[0] ?? '',
    d2: defs[1] ?? '',
    d3: defs[2] ?? '',
    d4: defs[3] ?? '',
  };
};

export const CURRENT_TEAM = 'Jets';

/** The current club's best lineup (league players whose current team is `team`). */
export const teamLineup = (ctx: LabContext, team = CURRENT_TEAM): Lineup => {
  const id = findNFLTeam(team)?.id ?? team.toLowerCase();
  // Current roster only: retired players whose final team was this club don't count (status is internal data)
  return bestLineupFrom([...ctx.profiles.values()].filter((p) => !p.isLegend && p.player.status !== 'Retired' && sameTeam(p.team, id)));
};

/** Median-OVR league player at a position not already used: fills franchise gaps. */
const replacementFor = (ctx: LabContext, slot: SlotDef, used: Set<string>) => {
  const list = slot.positions
    .flatMap((p) => ctx.byPos.get(p) ?? [])
    .filter((p) => !p.isLegend && !used.has(p.key) && p.player.games >= 8)
    .sort((a, b) => b.ovr - a.ovr);
  return list[Math.floor(list.length / 2)];
};

export interface Preset {
  id: string;
  name: string;
  team?: string;
  lineup: Lineup;
  /** Slots filled with a replacement-level (median) player because the franchise had nobody there */
  filled: SlotId[];
}

/**
 * Franchise dynasty presets: every league player who played for the franchise (current team, or a past team in
 * `history`), best by OVR at each slot. Gaps are filled with a median player at the position. Keeps franchises
 * with at least `minNative` real slots, sorted by team score. The current club is left out ("Load my Jets" covers it).
 */
export const dynastyPresets = (
  ctx: LabContext,
  history: (p: Player) => string[] = () => [],
  minNative = 5,
  exclude: string = CURRENT_TEAM,
): Preset[] => {
  const skip = findNFLTeam(exclude)?.id;
  const teams = new Map<string, PlayerProfile[]>();
  [...ctx.profiles.values()].forEach((p) => {
    if (p.isLegend) return;
    const ids = new Set([findNFLTeam(p.team)?.id, ...history(p.player).map((t) => findNFLTeam(t)?.id)].filter(Boolean) as string[]);
    ids.forEach((id) => teams.set(id, [...(teams.get(id) ?? []), p]));
  });
  const out: (Preset & { score: number })[] = [];
  teams.forEach((list, id) => {
    if (id === skip) return;
    const lineup = bestLineupFrom(list);
    const native = filledCount(lineup);
    if (native < minNative) return;
    const used = new Set(lineupKeys(lineup));
    const filled: SlotId[] = [];
    SLOTS.forEach((slot) => {
      if (lineup[slot.id]) return;
      const rep = replacementFor(ctx, slot, used);
      if (!rep) return;
      lineup[slot.id] = rep.key;
      used.add(rep.key);
      filled.push(slot.id);
    });
    const team = findNFLTeam(id);
    const score = scoreLineup(ctx, lineup)?.team.raw ?? -1;
    if (score < 0) return;
    out.push({ id: `dyn:${id}`, name: `${team?.name ?? id} dynasty`, team: team?.name, lineup, filled, score });
  });
  return out.sort((a, b) => b.score - a.score).map(({ score, ...p }) => p);
};

/** Random valid lineup from the pool (legends included only if they are in ctx.pool). */
export const randomLineup = (ctx: LabContext, seed: number): Lineup => randomFrom(ctx.byPos, rng(seed));

const candidatesFor = (ctx: LabContext, slot: SlotDef, l: Lineup, limit = Infinity) => {
  const used = new Set(lineupKeys(l));
  return slot.positions
    .flatMap((p) => ctx.byPos.get(p) ?? [])
    .filter((p) => !used.has(p.key))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, limit);
};

/**
 * Auto-draft: start from the best player by OVR at every slot, then swap players in (two passes over the
 * slots, top 25 by OVR per slot) whenever the swap raises the team rating.
 */
export const autoDraft = (ctx: LabContext): Lineup => {
  const l = bestLineupFrom([...ctx.profiles.values()]);
  let best = scoreLineup(ctx, l)?.team.raw ?? -1;
  if (best < 0) return l;
  for (let pass = 0; pass < 2; pass += 1) {
    let improved = false;
    SLOTS.forEach((slot) => {
      candidatesFor(ctx, slot, l, 25).forEach((c) => {
        const next = { ...l, [slot.id]: c.key };
        const v = scoreLineup(ctx, next)?.team.raw ?? -1;
        if (v > best + 1e-9) {
          best = v;
          l[slot.id] = c.key;
          improved = true;
        }
      });
    });
    if (!improved) break;
  }
  return l;
};

// ---------- Upgrades ----------

export interface Upgrade {
  slot: SlotId;
  out: PlayerProfile;
  in: PlayerProfile;
  /** Team rating change (weighted unit scores, 0–100 scale) */
  delta: number;
  newTeamScore: number;
  fromCurrentTeam: boolean;
  /** "Plays like" style similarity with the player he replaces (0–100), null across positions or without data */
  styleMatch: number | null;
}

export interface UpgradePlan {
  slot: SlotId;
  current: PlayerProfile;
  options: Upgrade[];
}

/**
 * For the weakest slot (lowest skill percentile), the 3 pool players who raise the team rating most. One is
 * from the current club's roster when any of its players helps; the rest are trade targets.
 */
export const suggestUpgrades = (ctx: LabContext, l: Lineup, team = CURRENT_TEAM): UpgradePlan | null => {
  const base = scoreLineup(ctx, l);
  if (!base) return null;
  const teamId = findNFLTeam(team)?.id ?? '';
  const weakest = SLOTS.map((s) => ({ s, p: ctx.profiles.get(l[s.id])! })).sort(
    (a, b) => (Number.isFinite(a.p.overallPct) ? a.p.overallPct : 50) - (Number.isFinite(b.p.overallPct) ? b.p.overallPct : 50) || a.p.ovr - b.p.ovr,
  )[0];
  const options = candidatesFor(ctx, weakest.s, l)
    .map((c) => {
      const next = scoreLineup(ctx, { ...l, [weakest.s.id]: c.key })!;
      return { c, delta: next.team.raw - base.team.raw, newTeamScore: next.team.score };
    })
    .filter((o) => o.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const own = options.find((o) => !o.c.isLegend && sameTeam(o.c.team, teamId));
  const picked = [...(own ? [own] : []), ...options.filter((o) => o !== own)].slice(0, 3).sort((a, b) => b.delta - a.delta);
  return {
    slot: weakest.s.id,
    current: weakest.p,
    options: picked.map((o) => ({
      slot: weakest.s.id,
      out: weakest.p,
      in: o.c,
      delta: o.delta,
      newTeamScore: o.newTeamScore,
      fromCurrentTeam: !o.c.isLegend && sameTeam(o.c.team, teamId),
      styleMatch: o.c.position === weakest.p.position ? pairSimilarity(ctx.league, weakest.p.player, o.c.player, 'style') : null,
    })),
  };
};

// ---------- Rankings and head-to-head ----------

export interface RankRow {
  id: string;
  name: string;
  teamRaw: number;
  teamScore: number;
  isCurrent: boolean;
}

/** The current build ranked among other lineups (saved teams, dynasty presets) by team rating. */
export const rankAmong = (ctx: LabContext, l: Lineup, others: { id: string; name: string; lineup: Lineup }[]): RankRow[] => {
  const rows: RankRow[] = [];
  const me = scoreLineup(ctx, l);
  if (me) rows.push({ id: 'current', name: 'This build', teamRaw: me.team.raw, teamScore: me.team.score, isCurrent: true });
  others.forEach((o) => {
    const s = scoreLineup(ctx, o.lineup);
    if (s) rows.push({ id: o.id, name: o.name, teamRaw: s.team.raw, teamScore: s.team.score, isCurrent: false });
  });
  return rows.sort((a, b) => b.teamRaw - a.teamRaw);
};

export interface Matchup {
  id: string;
  label: string;
  side: Side;
  ours: UnitId;
  theirs: UnitId;
  ourScore: number;
  theirScore: number;
  /** ourScore − theirScore */
  edge: number;
}

export const MATCHUPS: { id: string; label: string; side: Side; ours: UnitId; theirs: UnitId }[] = [
  { id: 'pass', label: 'Your passing vs their coverage', side: 'offense', ours: 'passing', theirs: 'coverage' },
  { id: 'run', label: 'Your run game vs their run defense', side: 'offense', ours: 'run', theirs: 'runDef' },
  { id: 'protect', label: 'Your protection vs their pass rush', side: 'offense', ours: 'protection', theirs: 'passRush' },
  { id: 'secure', label: 'Your ball security vs their playmaking', side: 'offense', ours: 'security', theirs: 'playmaking' },
  { id: 'cover', label: 'Your coverage vs their passing', side: 'defense', ours: 'coverage', theirs: 'passing' },
  { id: 'stop-run', label: 'Your run defense vs their run game', side: 'defense', ours: 'runDef', theirs: 'run' },
  { id: 'rush', label: 'Your pass rush vs their protection', side: 'defense', ours: 'passRush', theirs: 'protection' },
  { id: 'takeaway', label: 'Your playmaking vs their ball security', side: 'defense', ours: 'playmaking', theirs: 'security' },
];

export interface MatchupCall {
  /** Matchup id (MATCHUPS) or 'overall' */
  id: string;
  edge: number;
  call: string;
  why: string;
  /** Your player the call is aimed at */
  target?: SlotId;
}

export interface HeadToHead {
  a: TeamAnalysis;
  b: TeamAnalysis;
  matchups: Matchup[];
  /** Top 3 by |edge| */
  mismatches: Matchup[];
  /** Short calls (one per big mismatch, plus an overall call) with the stat reason */
  plan: MatchupCall[];
  /** Estimate: logistic of the team-rating gap (scale WIN_PROB_SCALE) */
  winProb: number;
}

export const WIN_PROB_SCALE = 10;

export const headToHead = (ctx: LabContext, ours: Lineup, theirs: Lineup): HeadToHead | null => {
  const a = analyzeLineup(ctx, ours);
  const b = analyzeLineup(ctx, theirs);
  if (!a || !b) return null;
  const matchups = MATCHUPS.map((m) => {
    const ourScore = a.units[m.ours].score;
    const theirScore = b.units[m.theirs].score;
    return { ...m, ourScore, theirScore, edge: ourScore - theirScore };
  });
  const mismatches = [...matchups].sort((x, y) => Math.abs(y.edge) - Math.abs(x.edge)).slice(0, 3);
  const winProb = 1 / (1 + Math.exp(-(a.team.raw - b.team.raw) / WIN_PROB_SCALE));

  const plan: MatchupCall[] = [];
  const A = a.slots;
  const B = b.slots;
  const deep = bestByValue([A.wr1, A.wr2, A.te], 'ypr', 0);
  const theirRec = bestBy([B.wr1, B.wr2, B.te], 'recYdsG');
  const theirInts = defTotal(B, 'intG');
  const theirSacks = defTotal(B, 'sackG');
  const theirTakeaways = theirInts + defTotal(B, 'ffG');
  const theirRusher = defLeader(B, 'sackG');
  const theirHawk = defLeader(B, 'intG');
  const underneath = sPct(A.te, 'recG') >= sPct(A.rb, 'recYdsG') ? A.te : A.rb;
  const slotOf = (p?: PlayerProfile) => (p ? SLOT_IDS.find((id) => A[id] === p) : undefined);
  const say = (id: string, edge: number, call: string, why: string, target?: PlayerProfile) => plan.push({ id, edge, call, why, target: slotOf(target) });
  matchups
    .filter((m) => Math.abs(m.edge) >= 15)
    .sort((x, y) => Math.abs(y.edge) - Math.abs(x.edge))
    .forEach((m) => {
      const up = m.edge > 0;
      const e = m.edge;
      switch (m.id) {
        case 'pass':
          if (up)
            say(m.id, e, `Attack deep → ${deep ? last(deep) : 'your best receiver'}`, `They can't cover (coverage ${pctTxt(m.theirScore)}, ${fx(theirInts)} INT/G combined)${deep ? `; ${deep.name} averages ${statOf(deep, 'ypr').display} Y/R` : ''}.`, deep);
          else
            say(m.id, e, `Underneath → ${last(underneath)}; no 50/50 balls`, `Their secondary takes the ball away: ${fx(theirInts)} INT/G, ${theirHawk.name} ${fx(theirHawk.rates.intG)}.`, underneath);
          break;
        case 'run':
          if (up) say(m.id, e, `Run at them → ${last(A.rb)}`, `${A.rb.name} averages ${statOf(A.rb, 'ypc').display} Y/C against a defense making ${fx(defTotal(B, 'tklG'), 1)} tackles/G.`, A.rb);
          else say(m.id, e, `${last(A.rb)} on 1st down only`, `Their defenders make ${fx(defTotal(B, 'tklG'), 1)} tackles/G: don't force the run.`, A.rb);
          break;
        case 'protect':
          if (up) say(m.id, e, 'Time to throw: let routes develop', `Their pass rush is only ${pctTxt(m.theirScore)} (${fx(theirSacks)} sacks/G).`);
          else say(m.id, e, `Quick throws; ${last(A.qb)} rolls out`, `Their pass rush (${pctTxt(m.theirScore)}, ${fx(theirSacks)} sacks/G, led by ${theirRusher.name}) beats your protection (${pctTxt(m.ourScore)}).`, A.qb);
          break;
        case 'secure':
          if (up) say(m.id, e, 'Be aggressive with throws', `They rarely take it away: ${fx(theirTakeaways)} takeaways/G.`);
          else say(m.id, e, 'Throw it away, not into traffic', `They force ${fx(theirTakeaways)} takeaways/G and your ball security is ${pctTxt(m.ourScore)}.`);
          break;
        case 'cover':
          if (up) say(m.id, e, 'Make them drive; punt, no 4th gambles', `Your coverage (${pctTxt(m.ourScore)}) beats their passing game (${pctTxt(m.theirScore)}).`);
          else say(m.id, e, `Their ${theirRec ? `${theirRec.position} ${last(theirRec)}` : 'WR1'} scores: answer with TDs`, `${theirRec?.name ?? 'Their top receiver'} (${theirRec ? stat(theirRec, 'recYdsG') : ''}) against your coverage (${pctTxt(m.ourScore)}).`);
          break;
        case 'stop-run':
          if (up) say(m.id, e, 'Expect early-down stops; play field position', `Your run defense (${pctTxt(m.ourScore)}) vs their run game (${pctTxt(m.theirScore)}).`);
          else say(m.id, e, 'Score every trip; go on 4th & short', `${B.rb.name} will move the chains: their run game ${pctTxt(m.theirScore)} vs your run defense ${pctTxt(m.ourScore)}.`);
          break;
        case 'rush':
          if (up) say(m.id, e, 'Punt them deep; your rush wins', `Your pass rush (${pctTxt(m.ourScore)}) vs their protection (${pctTxt(m.theirScore)}).`);
          else say(m.id, e, 'Expect long drives; keep scoring', `Their line gives ${B.qb.name} time: protection ${pctTxt(m.theirScore)} vs your rush ${pctTxt(m.ourScore)}.`);
          break;
        case 'takeaway':
          if (up) say(m.id, e, `After a takeaway → end-zone shot`, `They are careless with the ball: ball security ${pctTxt(m.theirScore)} vs your playmaking ${pctTxt(m.ourScore)}.`, deep);
          else say(m.id, e, "Don't count on turnovers", `They protect the ball well (${pctTxt(m.theirScore)}): win the possession battle on offense.`);
          break;
      }
    });
  const pct = r0(winProb * 100);
  if (winProb >= 0.65) say('overall', 0, 'Favourite: punt, take FGs, protect the ball', `Estimated ${pct}% win chance: avoid variance.`);
  else if (winProb <= 0.4) say('overall', 0, 'Underdog: go on 4th, go for 2, onside late', `Estimated ${pct}% win chance: add variance.`);
  else say('overall', 0, 'Coin flip: win turnovers and the last possession', `Estimated ${pct}% win chance.`);
  return { a, b, matchups, mismatches, plan: plan.slice(0, 5), winProb };
};
