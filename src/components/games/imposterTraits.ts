import type { Player, Position } from '@/types/player';
import { HOF_THRESHOLD, isHallOfFamer } from '@/config/stats';
import { findNFLTeam, NFL_TEAMS } from '@/utils/nflTeams';
import { getAllChampions, matchPlayerByName, type LeagueContent } from '@/utils/leagueContent';
import { normalizeName as extrasKey, type IndexedExtras } from '@/utils/playerExtras';
import { fmt, isDefender, isLegend, legendLabel, playerKey, sample, shuffle, type GamePlayer } from './gameUtils';

/**
 * Trait library for "Who's the Imposter?". Each trait splits its eligible players into fits (test true)
 * and misses. A round shows five fits plus one miss. Thresholds for production traits are computed from
 * the live player pool (roughly the 40th–70th percentile), so they keep splitting the data as the league grows.
 * Player status (Active/Retired) is never used.
 */

export type Difficulty = 1 | 2 | 3;

export interface ImposterTrait {
  id: string;
  /** Variants of the same idea (each team, each era...) share a family so one family can't dominate. */
  family: string;
  /** Shown at the reveal, e.g. "All five won 3+ rings" */
  label: string;
  difficulty: Difficulty;
  test: (p: GamePlayer) => boolean;
  /** The stat or fact that makes this card fit or not */
  explain: (p: GamePlayer) => string;
  eligible?: (p: GamePlayer) => boolean;
  /** How far a non-fit is from fitting (lower = nearer miss). Used to pick hard imposters. */
  miss?: (p: GamePlayer) => number;
  /** Trait is about real NFL players: lifts the one-legend-per-round cap. */
  aboutLegends?: boolean;
}

export interface TraitContext {
  players: GamePlayer[];
  content: LeagueContent | null;
  extras: IndexedExtras;
}

// ---------- helpers ----------

const val = (p: Player, key: string): number | null => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const n = (p: Player, key: string) => val(p, key) ?? 0;
const has = (p: Player, ...keys: string[]) => keys.every((k) => val(p, k) != null);
const isPos = (...pos: Position[]) => (p: Player) => pos.includes(p.position);
const plural = (count: number, one: string, many = `${one}s`) => `${fmt(count)} ${count === 1 ? one : many}`;
const poyLabel = (p: Player) => (isDefender(p) ? 'DPOY' : 'OPOY');

/** "4 rings · 1 MVP · 2 OPOY" (non-zero awards only) */
const trophyLine = (p: Player) => {
  const parts = [
    p.rings ? plural(p.rings, 'ring') : '',
    p.mvp ? `${p.mvp} MVP` : '',
    p.opoy ? `${p.opoy} ${poyLabel(p)}` : '',
    p.sbmvp ? `${p.sbmvp} SB MVP` : '',
    p.roty ? 'ROTY' : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No major awards';
};

const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/**
 * A threshold near the 55th percentile, rounded to a friendly number, that leaves 30–65% of the pool
 * qualifying with at least 5 fits and 1 miss. Null when the data can't support it.
 */
const pickThreshold = (values: number[], decimals = 0): number | null => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length < 6) return null;
  const target = quantile(sorted, 0.55);
  if (target <= 0) return null;
  const mag = 10 ** Math.floor(Math.log10(target));
  const minStep = decimals ? 10 ** -decimals : 1;
  const steps = [mag / 2, mag / 4, mag / 10, minStep].map((s) => Math.max(minStep, s));
  for (const step of steps) {
    const t = Number(roundTo(target, step).toFixed(decimals));
    if (t <= 0) continue;
    const fits = sorted.filter((v) => v >= t).length;
    const share = fits / sorted.length;
    if (fits >= 5 && fits < sorted.length && share >= 0.3 && share <= 0.65) return t;
  }
  return null;
};

interface NumericSpec {
  id: string;
  family?: string;
  difficulty: Difficulty;
  eligible: (p: GamePlayer) => boolean;
  get: (p: GamePlayer) => number;
  label: (threshold: string) => string;
  /** "91,463 pass yds" */
  unit: (value: string) => string;
  decimals?: number;
  /** Fixed threshold instead of a percentile one */
  fixed?: number;
}

const numeric = (players: GamePlayer[], s: NumericSpec): ImposterTrait | null => {
  const pool = players.filter(s.eligible);
  const decimals = s.decimals ?? 0;
  const t = s.fixed ?? pickThreshold(pool.map(s.get), decimals);
  if (t == null) return null;
  const show = (v: number) => fmt(v, decimals);
  return {
    id: s.id,
    family: s.family ?? s.id,
    label: s.label(show(t)),
    difficulty: s.difficulty,
    eligible: s.eligible,
    test: (p) => s.get(p) >= t,
    explain: (p) => {
      const v = s.get(p);
      return v >= t ? s.unit(show(v)) : `${s.unit(show(v))} (needs ${show(t)})`;
    },
    miss: (p) => (t - s.get(p)) / t,
  };
};

const perGame = (p: Player, key: string) => (n(p, 'games') > 0 ? n(p, key) / n(p, 'games') : 0);

// ---------- library ----------

export const buildTraits = ({ players, content, extras }: TraitContext): ImposterTrait[] => {
  const league = players.filter((p) => !isLegend(p));
  const legendsIn = players.some(isLegend);
  const traits: (ImposterTrait | null)[] = [];
  const decorated = (p: Player) => p.rings + p.mvp + p.opoy + p.sbmvp > 0;
  const played = (p: Player) => n(p, 'games') > 0;

  // ----- Awards -----
  traits.push(
    numeric(players, {
      id: 'rings3',
      difficulty: 1,
      eligible: () => true,
      get: (p) => p.rings,
      fixed: 3,
      label: () => 'All five won 3+ rings',
      unit: (v) => `${v} ring${v === '1' ? '' : 's'}`,
    }),
    {
      id: 'mvp',
      family: 'mvp',
      label: 'All five won at least one MVP',
      difficulty: 1,
      test: (p) => p.mvp > 0,
      explain: (p) => (p.mvp > 0 ? `${p.mvp}× MVP` : `No MVP (${trophyLine(p)})`),
      // An OPOY/DPOY or SB MVP winner looks like an MVP
      miss: (p) => (p.opoy > 0 || p.sbmvp > 0 ? 0 : p.rings > 0 ? 1 : 2),
    },
    {
      id: 'noMvp',
      family: 'mvp',
      label: 'None of the five ever won MVP',
      difficulty: 2,
      eligible: decorated,
      test: (p) => p.mvp === 0,
      explain: (p) => (p.mvp === 0 ? `No MVP (${trophyLine(p)})` : `${p.mvp}× MVP`),
      miss: (p) => p.mvp,
    },
    {
      id: 'poy',
      label: 'All five won Offensive or Defensive Player of the Year',
      family: 'poy',
      difficulty: 2,
      test: (p) => p.opoy > 0,
      explain: (p) => (p.opoy > 0 ? `${p.opoy}× ${poyLabel(p)}` : `No ${poyLabel(p)} (${trophyLine(p)})`),
      miss: (p) => (p.mvp > 0 ? 0 : p.sbmvp > 0 ? 1 : 2),
    },
    {
      id: 'sbmvp',
      family: 'sbmvp',
      label: 'All five were Super Bowl MVP',
      difficulty: 2,
      // Only ring winners can be SB MVP, so every card has a ring
      eligible: (p) => p.rings > 0,
      test: (p) => p.sbmvp > 0,
      explain: (p) => (p.sbmvp > 0 ? `${p.sbmvp}× SB MVP` : `${plural(p.rings, 'ring')}, never SB MVP`),
      miss: (p) => -p.rings,
    },
    {
      id: 'roty',
      family: 'roty',
      label: 'All five were Rookie of the Year',
      difficulty: 3,
      eligible: played,
      test: (p) => p.roty > 0,
      explain: (p) => (p.roty > 0 ? 'Rookie of the Year' : `No ROTY (${trophyLine(p)})`),
      miss: (p) => (decorated(p) ? 0 : 1),
    },
    {
      id: 'ringMvp',
      family: 'mvp',
      label: 'All five won a ring and an MVP',
      difficulty: 2,
      test: (p) => p.rings > 0 && p.mvp > 0,
      explain: (p) =>
        p.rings > 0 && p.mvp > 0
          ? `${plural(p.rings, 'ring')} + ${p.mvp} MVP`
          : p.rings > 0
            ? `${plural(p.rings, 'ring')} but no MVP`
            : p.mvp > 0
              ? `${p.mvp} MVP but no ring`
              : trophyLine(p),
      miss: (p) => 2 - (p.rings > 0 ? 1 : 0) - (p.mvp > 0 ? 1 : 0),
    },
    {
      id: 'ringsOverMvps',
      family: 'ringsOverMvps',
      label: 'All five have more rings than MVPs',
      difficulty: 3,
      eligible: (p) => p.rings + p.mvp > 0,
      test: (p) => p.rings > p.mvp,
      explain: (p) => `${plural(p.rings, 'ring')} vs ${p.mvp} MVP${p.mvp === 1 ? '' : 's'}`,
      miss: (p) => p.mvp - p.rings,
    },
  );

  // Ringless with big legacy (league only: real players have no Career Legacy)
  {
    const elig = (p: GamePlayer) => !isLegend(p) && p.careerLegacy > 0;
    const ringless = league.filter((p) => elig(p) && p.rings === 0).map((p) => p.careerLegacy);
    const t = ringless.filter((v) => v >= 8000).length >= 5 ? 8000 : pickThreshold(ringless);
    if (t) {
      traits.push({
        id: 'ringlessLegacy',
        family: 'legacy',
        label: `All five are ringless with ${fmt(t)}+ Career Legacy`,
        difficulty: 2,
        eligible: (p) => elig(p) && (p.careerLegacy >= t * 0.7 || p.rings === 0),
        test: (p) => p.rings === 0 && p.careerLegacy >= t,
        explain: (p) =>
          p.rings > 0
            ? `${plural(p.rings, 'ring')} (Legacy ${fmt(p.careerLegacy)})`
            : p.careerLegacy >= t
              ? `Ringless, Legacy ${fmt(p.careerLegacy)}`
              : `Ringless, but Legacy ${fmt(p.careerLegacy)} (needs ${fmt(t)})`,
        // A ring winner with the legacy is the classic near miss
        miss: (p) => (p.careerLegacy >= t ? 0.05 * p.rings : (t - p.careerLegacy) / t),
      });
    }
  }

  // ----- Production (per position group) -----
  const qb = (p: GamePlayer) => p.position === 'QB';
  traits.push(
    numeric(players, {
      id: 'passYds',
      difficulty: 1,
      eligible: (p) => qb(p) && has(p, 'passYds'),
      get: (p) => n(p, 'passYds'),
      label: (t) => `All five threw for ${t}+ career yards`,
      unit: (v) => `${v} pass yds`,
    }),
    numeric(players, {
      id: 'passTD',
      difficulty: 1,
      eligible: (p) => qb(p) && has(p, 'passTD'),
      get: (p) => n(p, 'passTD'),
      label: (t) => `All five threw ${t}+ TD passes`,
      unit: (v) => `${v} pass TD`,
    }),
    numeric(players, {
      id: 'qbRush',
      difficulty: 2,
      eligible: (p) => qb(p) && has(p, 'rushYds'),
      get: (p) => n(p, 'rushYds'),
      label: (t) => `All five QBs ran for ${t}+ yards`,
      unit: (v) => `${v} rush yds`,
    }),
    numeric(players, {
      id: 'tdInt',
      difficulty: 3,
      decimals: 1,
      eligible: (p) => qb(p) && has(p, 'passTD') && n(p, 'interceptions') > 0,
      get: (p) => n(p, 'passTD') / n(p, 'interceptions'),
      label: (t) => `All five have a TD:INT ratio of ${t}+`,
      unit: (v) => `${v} TD per INT`,
    }),
    numeric(players, {
      id: 'rushYds',
      difficulty: 1,
      eligible: (p) => p.position === 'RB' && has(p, 'rushYds'),
      get: (p) => n(p, 'rushYds'),
      label: (t) => `All five ran for ${t}+ career yards`,
      unit: (v) => `${v} rush yds`,
    }),
    numeric(players, {
      id: 'rushTD',
      difficulty: 2,
      eligible: (p) => p.position === 'RB' && has(p, 'rushTD'),
      get: (p) => n(p, 'rushTD'),
      label: (t) => `All five scored ${t}+ rushing TDs`,
      unit: (v) => `${v} rush TD`,
    }),
    numeric(players, {
      id: 'ypc',
      difficulty: 3,
      decimals: 1,
      eligible: (p) => p.position === 'RB' && n(p, 'rushAtt') > 0 && has(p, 'rushYds'),
      get: (p) => n(p, 'rushYds') / n(p, 'rushAtt'),
      label: (t) => `All five average ${t}+ yards per carry`,
      unit: (v) => `${v} yds/carry`,
    }),
    numeric(players, {
      id: 'recYds',
      difficulty: 1,
      eligible: (p) => (p.position === 'WR' || p.position === 'TE') && has(p, 'recYds'),
      get: (p) => n(p, 'recYds'),
      label: (t) => `All five have ${t}+ receiving yards`,
      unit: (v) => `${v} rec yds`,
    }),
    numeric(players, {
      id: 'recTD',
      difficulty: 1,
      eligible: (p) => (p.position === 'WR' || p.position === 'TE') && has(p, 'recTD'),
      get: (p) => n(p, 'recTD'),
      label: (t) => `All five caught ${t}+ TDs`,
      unit: (v) => `${v} rec TD`,
    }),
    numeric(players, {
      id: 'recYpg',
      difficulty: 3,
      eligible: (p) => (p.position === 'WR' || p.position === 'TE') && played(p) && has(p, 'recYds'),
      get: (p) => perGame(p, 'recYds'),
      decimals: 1,
      label: (t) => `All five averaged ${t}+ receiving yards per game`,
      unit: (v) => `${v} rec yds/game`,
    }),
    numeric(players, {
      id: 'tackles',
      difficulty: 1,
      eligible: (p) => isDefender(p) && has(p, 'tackles'),
      get: (p) => n(p, 'tackles'),
      label: (t) => `All five made ${t}+ tackles`,
      unit: (v) => `${v} tackles`,
    }),
    numeric(players, {
      id: 'defInt',
      difficulty: 2,
      eligible: (p) => (p.position === 'DB' || p.position === 'LB') && has(p, 'interceptions'),
      get: (p) => n(p, 'interceptions'),
      label: (t) => `All five picked off ${t}+ passes`,
      unit: (v) => `${v} INT`,
    }),
    numeric(players, {
      id: 'sacks',
      difficulty: 2,
      eligible: (p) => (p.position === 'DL' || p.position === 'LB') && has(p, 'sacks'),
      get: (p) => n(p, 'sacks'),
      label: (t) => `All five have ${t}+ career sacks`,
      unit: (v) => `${v} sacks`,
    }),
    numeric(players, {
      id: 'games',
      difficulty: 2,
      eligible: played,
      get: (p) => n(p, 'games'),
      label: (t) => `All five played ${t}+ games`,
      unit: (v) => `${v} games`,
    }),
  );

  // ----- Franchise / conference / division -----
  const teamOf = (p: Player) => findNFLTeam(p.team);
  const withTeam = (p: Player) => !!teamOf(p);
  const teamCounts = new Map<string, number>();
  players.forEach((p) => {
    const t = teamOf(p);
    if (t) teamCounts.set(t.id, (teamCounts.get(t.id) ?? 0) + 1);
  });
  NFL_TEAMS.forEach((team) => {
    if ((teamCounts.get(team.id) ?? 0) < 5) return;
    traits.push({
      id: `team:${team.id}`,
      family: 'team',
      label: `All five are ${team.name} players`,
      difficulty: 1,
      eligible: withTeam,
      test: (p) => teamOf(p)?.id === team.id,
      explain: (p) => teamOf(p)!.fullName,
      miss: (p) => {
        const t = teamOf(p)!;
        return t.conference === team.conference ? (t.division === team.division ? 0 : 1) : 2;
      },
    });
  });
  (['AFC', 'NFC'] as const).forEach((conf) => {
    (['East', 'North', 'South', 'West'] as const).forEach((div) => {
      traits.push({
        id: `div:${conf}-${div}`,
        family: 'division',
        label: `All five play in the ${conf} ${div}`,
        difficulty: 2,
        eligible: withTeam,
        test: (p) => teamOf(p)!.conference === conf && teamOf(p)!.division === div,
        explain: (p) => `${teamOf(p)!.name}: ${teamOf(p)!.conference} ${teamOf(p)!.division}`,
        miss: (p) => (teamOf(p)!.conference === conf ? 0 : 1),
      });
    });
    traits.push({
      id: `conf:${conf}`,
      family: 'conference',
      label: `All five are ${conf} players`,
      difficulty: 2,
      eligible: withTeam,
      test: (p) => teamOf(p)!.conference === conf,
      explain: (p) => `${teamOf(p)!.name}: ${teamOf(p)!.conference} ${teamOf(p)!.division}`,
    });
  });

  // ----- League -----
  traits.push({
    id: 'hof',
    family: 'legacy',
    label: `All five are Hall of Famers (${fmt(HOF_THRESHOLD)}+ Career Legacy)`,
    difficulty: 2,
    eligible: (p) => !isLegend(p) && p.careerLegacy > 0,
    test: (p) => isHallOfFamer(p),
    explain: (p) =>
      isHallOfFamer(p) ? `Hall of Famer, Legacy ${fmt(p.careerLegacy)}` : `Legacy ${fmt(p.careerLegacy)} (needs ${fmt(HOF_THRESHOLD)})`,
    miss: (p) => (HOF_THRESHOLD - p.careerLegacy) / HOF_THRESHOLD,
  });

  const realCareer = (p: Player) => extras.realNflCareer[extrasKey(p.name)];
  if (legendsIn) {
    traits.push(
      {
        id: 'legends',
        family: 'legends',
        label: 'All five are real NFL players, not league players',
        difficulty: 2,
        aboutLegends: true,
        test: isLegend,
        explain: (p) =>
          isLegend(p)
            ? `${legendLabel(p)} (real NFL stats)`
            : realCareer(p)
              ? `League player with a real NFL past${realCareer(p)?.years ? ` (${realCareer(p)?.years})` : ''}`
              : 'League player',
        // A league player who came from a real NFL career is the sneakiest imposter
        miss: (p) => (realCareer(p) ? 0 : 1),
      },
      {
        id: 'originals',
        family: 'legends',
        label: 'All five are league players: the imposter is a real NFL player',
        difficulty: 2,
        test: (p) => !isLegend(p),
        explain: (p) => (isLegend(p) ? `${legendLabel(p)} (real NFL stats)` : 'League player'),
      },
    );
  }

  if (Object.keys(extras.realNflCareer).length) {
    traits.push({
      id: 'realCareer',
      family: 'realCareer',
      label: 'All five had a real NFL career before joining the league',
      difficulty: 3,
      eligible: (p) => !isLegend(p),
      test: (p) => !!realCareer(p),
      explain: (p) => (realCareer(p) ? `Real NFL career${realCareer(p)?.years ? `: ${realCareer(p)?.years}` : ''}` : 'League original'),
    });
  }

  // Eras from content.json: key players of each era, and "a key player of any era"
  if (content?.eras.length) {
    const eraOf = new Map<string, string[]>();
    content.eras.forEach((era) => {
      const members = new Set<string>();
      era.keyPlayers.forEach((name) => {
        const p = matchPlayerByName(name, league);
        if (p) members.add(playerKey(p));
      });
      members.forEach((k) => eraOf.set(k, [...(eraOf.get(k) ?? []), era.name]));
      if (members.size >= 5) {
        traits.push({
          id: `era:${era.id}`,
          family: 'era',
          label: `All five were key players of the ${era.name} (Y${era.startYear}–${era.endYear})`,
          difficulty: 3,
          eligible: (p) => !isLegend(p),
          test: (p) => members.has(playerKey(p)),
          explain: (p) => {
            const eras = eraOf.get(playerKey(p));
            return eras?.length ? `Key player: ${eras.join(', ')}` : 'Not named a key player of any era';
          },
          // Key players of other eras are the near misses
          miss: (p) => (eraOf.has(playerKey(p)) ? 0 : 1),
        });
      }
    });
    if (eraOf.size >= 5) {
      traits.push({
        id: 'eraKey',
        family: 'era',
        label: 'All five were named key players of a league era',
        difficulty: 2,
        eligible: (p) => !isLegend(p),
        test: (p) => eraOf.has(playerKey(p)),
        explain: (p) => {
          const eras = eraOf.get(playerKey(p));
          return eras?.length ? `Key player: ${eras.join(', ')}` : 'Not named a key player of any era';
        },
        miss: (p) => (decorated(p) ? 0 : 1) - p.rings / 100,
      });
    }
  }

  // Franchise titles in league history (Super Bowl winners from content.json)
  if (content?.superBowls.length) {
    const titles = new Map<string, number>();
    getAllChampions(content.superBowls).forEach((c) => {
      const t = findNFLTeam(c.team);
      if (t) titles.set(t.id, (titles.get(t.id) ?? 0) + c.titles);
    });
    const titlesOf = (p: Player) => titles.get(teamOf(p)?.id ?? '') ?? 0;
    traits.push(
      numeric(players, {
        id: 'franchiseTitles',
        difficulty: 2,
        eligible: (p) => !isLegend(p) && withTeam(p),
        get: titlesOf,
        label: (t) => `All five are listed with a franchise that has ${t}+ league Super Bowl titles`,
        unit: (v) => `${v} league title${v === '1' ? '' : 's'}`,
      }),
    );
  }

  // Nicknames: player data plus content.json player notes
  const notes = new Map<string, string>();
  content?.playerNotes.forEach((note) => {
    if (!note.nickname) return;
    const p = matchPlayerByName(note.name, league);
    if (p) notes.set(playerKey(p), note.nickname);
  });
  const nickname = (p: GamePlayer) => (p.nickname?.trim() || notes.get(playerKey(p)) || '').trim();
  traits.push({
    id: 'nickname',
    family: 'nickname',
    label: 'All five have a nickname on record',
    difficulty: 3,
    eligible: played,
    test: (p) => !!nickname(p),
    explain: (p) => (nickname(p) ? `"${nickname(p)}"` : 'No nickname on record'),
    miss: (p) => (decorated(p) ? 0 : 1),
  });

  return traits.filter((t): t is ImposterTrait => !!t);
};

// ---------- Round generation ----------

export interface ImposterRound {
  id: number;
  trait: ImposterTrait;
  cards: GamePlayer[];
  imposterKey: string;
}

/** Difficulty level for the current streak: 1 for the first 3, 2 up to 7, then 3. */
// Gentle ramp: Rookie for the first 5 correct, Pro until 12, then All-Pro.
export const levelFor = (streak: number): Difficulty => (streak < 5 ? 1 : streak < 12 ? 2 : 3);

const randomOf = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

let roundSeq = 0;

/**
 * Picks a trait (preferring the current difficulty, avoiding recently used families), then a near-miss imposter
 * and five fits. Returns null if nothing in the pool supports a round.
 */
export const makeImposterRound = (
  traits: ImposterTrait[],
  players: GamePlayer[],
  level: Difficulty,
  recentFamilies: string[] = [],
): ImposterRound | null => {
  for (let attempt = 0; attempt < 80; attempt++) {
    const relaxed = attempt >= 40;
    const allowed = traits.filter((t) => t.difficulty <= level && (relaxed || !recentFamilies.includes(t.family)));
    if (!allowed.length) return null;
    const atLevel = allowed.filter((t) => t.difficulty === level);
    const bucket = atLevel.length && Math.random() < 0.65 ? atLevel : allowed;
    // Family first, then variant, so 32 team traits don't drown out everything else
    const family = randomOf([...new Set(bucket.map((t) => t.family))]);
    const trait = randomOf(bucket.filter((t) => t.family === family));

    const pool = trait.eligible ? players.filter(trait.eligible) : players;
    const fits = pool.filter(trait.test);
    const misses = pool.filter((p) => !trait.test(p));
    if (fits.length < 5 || misses.length < 1) continue;

    // Near miss: rank misses by distance (shuffled first so ties break randomly)
    const ranked = shuffle(misses).sort((a, b) => (trait.miss?.(a) ?? 0) - (trait.miss?.(b) ?? 0));
    const window = level === 1 ? ranked.length : level === 2 ? Math.max(3, Math.ceil(ranked.length / 3)) : Math.min(ranked.length, 2);
    const nearPool = ranked.slice(0, window);
    // Real players are the imposter only when the trait is about them
    const imposterPool = trait.aboutLegends ? nearPool : nearPool.filter((p) => !isLegend(p) || trait.id === 'originals');
    if (!imposterPool.length) continue;
    const imposter = randomOf(imposterPool);

    // Fits: lean toward the imposter's position so position alone doesn't give it away
    const maxLegends = trait.aboutLegends ? 6 : isLegend(imposter) ? 0 : 1;
    const samePos = fits.filter((p) => p.position === imposter.position);
    const lead = trait.difficulty >= 2 && !relaxed ? sample(samePos, Math.min(2, samePos.length), maxLegends) : [];
    const leadKeys = new Set(lead.map(playerKey));
    const legendsUsed = lead.filter(isLegend).length;
    const rest = sample(
      fits.filter((p) => !leadKeys.has(playerKey(p))),
      5 - lead.length,
      maxLegends - legendsUsed,
    );
    const five = [...lead, ...rest];
    if (five.length < 5) continue;
    if (trait.difficulty >= 2 && !relaxed && !five.some((p) => p.position === imposter.position)) continue;

    return { id: ++roundSeq, trait, cards: shuffle([...five, imposter]), imposterKey: playerKey(imposter) };
  }
  return null;
};
