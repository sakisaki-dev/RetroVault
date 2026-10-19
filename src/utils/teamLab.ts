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
export interface Recommendation {
  id: string;
  title: string;
  why: string;
  what: string;
  impact: Impact;
  priority: number;
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
  gamePlan: Recommendation[];
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

/** Game plan: rules over unit scores and individual traits (never per player), most important first. */
const gamePlanFor = (s: LineupScore, sp: SlotProfiles): Recommendation[] => {
  const u = (id: UnitId) => s.units[id].score;
  const qb = sp.qb;
  const rb = sp.rb;
  const ol = sp.ol;
  const te = sp.te;
  const recs = [sp.wr1, sp.wr2, sp.te];
  const carriers = [sp.rb, sp.wr1, sp.wr2, sp.te];
  const deep = bestByValue(recs, 'ypr', 65);
  const off = s.offense.score;
  const def = s.defense.score;
  const out: Recommendation[] = [];
  const add = (id: string, impact: Impact, strength: number, title: string, why: string, what: string) =>
    out.push({ id, impact, priority: IMPACT_W[impact] + Math.max(0, Math.min(99, strength)), title, why, what });
  const sacks = defTotal(sp, 'sackG');
  const ints = defTotal(sp, 'intG');
  const ffs = defTotal(sp, 'ffG');

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
      );
    else
      add(
        'deep',
        'med',
        sPct(deep, 'ypr') - 50,
        `Let deep routes develop for ${deep.name}`,
        `${deep.name} averages ${statOf(deep, 'ypr').display} yards a catch (${pctTxt(sPct(deep, 'ypr'))}), ${qb.name} throws for ${statOf(qb, 'ya').display} Y/A, and protection holds (${pctTxt(protection.score)}).`,
        `Hold the ball a beat longer and lead ${deep.name} into open space downfield; you have time in the pocket.`,
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
    );
  else if (intP <= 30)
    add(
      'careless',
      'high',
      50 - intP,
      'Only throw to clearly open receivers',
      `${qb.name} throws an INT on ${statOf(qb, 'intPct').display} of attempts (${pctTxt(intP)} in decision making).`,
      'Avoid floating passes over the middle and throws into tight windows; a punt beats a pick, especially in your own half.',
    );
  else if (intP >= 75 && sPct(qb, 'cmp') >= 65)
    add(
      'trusted',
      'med',
      intP - 50,
      'Trust your QB in tight windows on 3rd down',
      `${qb.name} completes ${statOf(qb, 'cmp').display} (${pctTxt(sPct(qb, 'cmp'))}) and throws an INT on only ${statOf(qb, 'intPct').display} (${pctTxt(intP)}).`,
      'Throw to the sticks on 3rd and medium even when the window is small; his turnover risk is low.',
    );

  // 4th-down policy from the defense
  if (def < 40)
    add(
      'fourth-aggressive',
      'high',
      40 - def + 30,
      'Play four-down football, go for 2 and onside late',
      `The defense beats only ${r0(def)}% of possible teams: the 4 defenders combine for ${fx(sacks)} sacks/G and ${fx(ints)} INT/G, so stops are rare.`,
      'Go for it on 4th and 3 or less past midfield, go for 2 more often, and try an onside kick when trailing in the last 3 minutes: you may not get the ball back otherwise.',
    );
  else if (def >= 70)
    add(
      'fourth-conservative',
      'high',
      def - 70 + 30,
      'Punt and win the field-position game',
      `The defense beats ${r0(def)}% of possible teams (${fx(sacks)} sacks/G, ${fx(ints)} INT/G, ${fx(ffs)} FF/G combined).`,
      'Punt on 4th down in your own half, take the field goal over 4th-and-long, and kick off deep: your defense will get the ball back.',
    );
  else
    add(
      'fourth-standard',
      'low',
      20,
      'Standard 4th-down rules',
      `The defense is middle of the pack (${pctTxt(def)}), so neither extreme pays.`,
      'Go for it on 4th and 1–2 past midfield; punt from your own half; kick field goals inside the 25 on longer 4th downs.',
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
    );
  const redzone = s.units.redzone;
  if (redzone.score >= 65)
    add(
      'two-point',
      'med',
      redzone.score - 50,
      'Go for 2 more often',
      `Red zone grades ${redzone.grade.grade} (${pctTxt(redzone.score)}): ${qb.name} throws a TD on ${statOf(qb, 'tdPct').display} of attempts.`,
      'After a touchdown, go for 2 whenever it leaves you up 1 or 5, or down 2 or 5. Your short-yardage offense converts more often than average.',
    );
  else if (redzone.score < 35)
    add(
      'take-points',
      'med',
      35 - redzone.score,
      'Take the points in the red zone',
      `Red zone grades ${redzone.grade.grade} (${pctTxt(redzone.score)}): TDs are hard to come by inside the 20.`,
      'On 4th down inside the 20, kick the field goal, and kick the extra point unless the score demands 2.',
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
    );
  else if (run.score < 35)
    add(
      'no-run-long',
      'med',
      35 - run.score + 10,
      "Don't waste downs running on 3rd and long",
      `The run game grades ${run.grade.grade} (${pctTxt(run.score)}): ${rb.name} averages ${statOf(rb, 'ypc').display} yards a carry.`,
      'Run on 1st and 10 and in short yardage only; on 3rd and 4+ throw.',
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
      );
    else
      add(
        'quick-game',
        'high',
        40 - protection.score + 10,
        'Get the ball out fast',
        `Protection grades ${protection.grade.grade} (${pctTxt(protection.score)}): ${ol.name} makes ${stat(ol, 'blocksG')}${Number.isFinite(qb.dropbacksPerSack) ? ` and ${qb.name} is sacked every ${r0(qb.dropbacksPerSack)} dropbacks` : ''}.`,
        'Throw on the first read: short and intermediate routes, no long holds in the pocket.',
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
    );
  else if (def - off >= 15)
    add(
      'clock-slow',
      'med',
      def - off,
      'Shorten the game',
      `The defense (${pctTxt(def)}) is much better than the offense (${pctTxt(off)}).`,
      'Let the clock run between plays once you lead; fewer possessions make every stop count for more.',
    );
  else
    add(
      'clock-halves',
      'low',
      10,
      'Win the end of each half',
      `Offense (${pctTxt(off)}) and defense (${pctTxt(def)}) are close, so possessions at the end of halves swing games.`,
      'With the ball and under 2 minutes left, manage the clock to score last; avoid leaving the opponent more than 30 seconds.',
    );

  return out.sort((a, b) => b.priority - a.priority).slice(0, 10);
};

/** Full analysis with cited evidence. Null until all 10 slots are filled. */
export const analyzeLineup = (ctx: LabContext, l: Lineup): TeamAnalysis | null => {
  const sp = slotProfiles(ctx.profiles, l);
  if (!sp) return null;
  const s = scoreSlots(ctx, sp, true);
  const ranked = [...OFFENSE_UNITS, ...DEFENSE_UNITS].map((u) => s.units[u]).sort((a, b) => b.score - a.score);
  const strengths = ranked.slice(0, 3).map((u) => insightFor(u, true));
  const weaknesses = ranked.slice(-3).reverse().map((u) => insightFor(u, false));
  return { ...s, slots: sp, identity: identityFor(s), strengths, weaknesses, gamePlan: gamePlanFor(s, sp) };
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

export interface HeadToHead {
  a: TeamAnalysis;
  b: TeamAnalysis;
  matchups: Matchup[];
  /** Top 3 by |edge| */
  mismatches: Matchup[];
  plan: string[];
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

  const plan: string[] = [];
  const A = a.slots;
  const B = b.slots;
  const deep = bestByValue([A.wr1, A.wr2, A.te], 'ypr', 0);
  const theirRec = bestBy([B.wr1, B.wr2, B.te], 'recYdsG');
  const theirInts = defTotal(B, 'intG');
  const theirSacks = defTotal(B, 'sackG');
  const theirRusher = defLeader(B, 'sackG');
  const theirHawk = defLeader(B, 'intG');
  const underneath = sPct(A.te, 'recG') >= sPct(A.rb, 'recYdsG') ? A.te : A.rb;
  matchups
    .filter((m) => Math.abs(m.edge) >= 15)
    .sort((x, y) => Math.abs(y.edge) - Math.abs(x.edge))
    .forEach((m) => {
      const up = m.edge > 0;
      switch (m.id) {
        case 'pass':
          plan.push(
            up
              ? `They can't cover (coverage ${pctTxt(m.theirScore)}, ${fx(theirInts)} INT/G combined): attack ${deep?.name ?? 'your best receiver'}${deep ? ` (${statOf(deep, 'ypr').display} Y/R)` : ''} downfield.`
              : `Their secondary takes the ball away (${fx(theirInts)} INT/G, ${theirHawk.name} ${fx(theirHawk.rates.intG)}): throw underneath to ${underneath.name} and avoid 50/50 balls.`,
          );
          break;
        case 'run':
          plan.push(
            up
              ? `Run at them: ${A.rb.name} (${statOf(A.rb, 'ypc').display} Y/C) against a defense making ${fx(defTotal(B, 'tklG'), 1)} tackles/G.`
              : `Don't force the run: their defenders make ${fx(defTotal(B, 'tklG'), 1)} tackles/G. Use ${A.rb.name} on 1st down and in short yardage only.`,
          );
          break;
        case 'protect':
          plan.push(
            up
              ? `You'll have time: their pass rush is only ${pctTxt(m.theirScore)} (${fx(theirSacks)} sacks/G), so let deep routes develop.`
              : `Their pass rush (${pctTxt(m.theirScore)}, ${fx(theirSacks)} sacks/G led by ${theirRusher.name}) beats your protection (${pctTxt(m.ourScore)}): quick throws, and roll out with ${A.qb.name} when the pocket collapses.`,
          );
          break;
        case 'secure':
          plan.push(
            up
              ? `They rarely take it away (${fx(theirInts + defTotal(B, 'ffG'))} takeaways/G): you can be aggressive with throws.`
              : `Ball security decides this one: they force ${fx(theirInts + defTotal(B, 'ffG'))} takeaways/G. Throw it away rather than into traffic.`,
          );
          break;
        case 'cover':
          plan.push(
            up
              ? `Your coverage should win: make them drive the length of the field, and punt rather than gamble on 4th.`
              : `${theirRec?.name ?? 'Their top receiver'} (${theirRec ? stat(theirRec, 'recYdsG') : ''}) will hurt your coverage: finish drives with TDs, not field goals.`,
          );
          break;
        case 'stop-run':
          plan.push(
            up
              ? `Your defenders swarm their run game: expect stops on early downs and play for field position.`
              : `${B.rb.name} will move the chains on your defense: score on every trip and take 4th-and-short chances.`,
          );
          break;
        case 'rush':
          plan.push(
            up
              ? `Your pass rush beats their line: punt them deep and let your rush force mistakes.`
              : `Their line gives ${B.qb.name} time: expect long drives against you and keep the scoreboard moving.`,
          );
          break;
        case 'takeaway':
          plan.push(
            up
              ? `They are careless with the ball: expect short fields, and take an end-zone shot after every takeaway.`
              : `They protect the ball well: don't count on turnovers, so win the possession battle on offense.`,
          );
          break;
      }
    });
  if (winProb >= 0.65) plan.push(`You are the favourite (${r0(winProb * 100)}%): avoid variance. Punt, take field goals and protect the ball.`);
  else if (winProb <= 0.4) plan.push(`You are the underdog (${r0(winProb * 100)}%): add variance. Go for it on 4th down, go for 2, and onside kick late if trailing.`);
  else plan.push(`It's close (${r0(winProb * 100)}%): win the turnover battle and the last possession of each half.`);
  return { a, b, matchups, mismatches, plan: plan.slice(0, 5), winProb };
};
