import type { Player, Position } from '@/types/player';
import type { CompFeature } from '@/config/advanced';
import { skillTraits } from '@/config/skillGrades';

/**
 * What a season line holds per position group: the box stats the season-end snapshots keep (scripts/career_seasons.py
 * FIELDS, the milestone totals), the Player fields they map to (so the skill-grade traits in config/advanced.ts can be
 * computed on a season exactly as on a career), and extra season rates. Fields the snapshots don't keep (QB attempts,
 * RB carries, fumbles) come only from the live save's season line, so a trait that needs them is blank elsewhere.
 */

export type Group = 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DEF';
export const groupOf = (pos: Position): Group => (pos === 'LB' || pos === 'DB' || pos === 'DL' ? 'DEF' : pos);

export interface BoxStat {
  key: string;
  label: string;
  short: string;
}

export const BOX: Record<Group, BoxStat[]> = {
  QB: [
    { key: 'yds', label: 'Passing yards', short: 'Pass yds' },
    { key: 'td', label: 'Passing TDs', short: 'Pass TD' },
    { key: 'int', label: 'Interceptions', short: 'INT' },
    { key: 'ryds', label: 'Rushing yards', short: 'Rush yds' },
    { key: 'rtd', label: 'Rushing TDs', short: 'Rush TD' },
  ],
  RB: [
    { key: 'ryds', label: 'Rushing yards', short: 'Rush yds' },
    { key: 'rtd', label: 'Rushing TDs', short: 'Rush TD' },
    { key: 'rec', label: 'Catches', short: 'Rec' },
    { key: 'recyds', label: 'Receiving yards', short: 'Rec yds' },
    { key: 'rectd', label: 'Receiving TDs', short: 'Rec TD' },
  ],
  WR: [
    { key: 'rec', label: 'Catches', short: 'Rec' },
    { key: 'yds', label: 'Receiving yards', short: 'Rec yds' },
    { key: 'td', label: 'Receiving TDs', short: 'Rec TD' },
  ],
  TE: [
    { key: 'rec', label: 'Catches', short: 'Rec' },
    { key: 'yds', label: 'Receiving yards', short: 'Rec yds' },
    { key: 'td', label: 'Receiving TDs', short: 'Rec TD' },
  ],
  OL: [{ key: 'blk', label: 'Blocks', short: 'Blk' }],
  DEF: [
    { key: 'tkl', label: 'Tackles', short: 'Tkl' },
    { key: 'sck', label: 'Sacks', short: 'Sck' },
    { key: 'int', label: 'Interceptions', short: 'INT' },
    { key: 'ff', label: 'Forced fumbles', short: 'FF' },
  ],
};

/** The headline total per group (the race chart's default). */
export const HEADLINE: Record<Group, string> = { QB: 'yds', RB: 'ryds', WR: 'yds', TE: 'yds', OL: 'blk', DEF: 'tkl' };

/** Season keys → Player fields, including the live save's extra keys. */
const FIELD_MAP: Record<Group, Record<string, string>> = {
  QB: { yds: 'passYds', td: 'passTD', int: 'interceptions', ryds: 'rushYds', rtd: 'rushTD', att: 'attempts', cmp: 'completions', ratt: 'rushAtt', sck: 'sacks' },
  RB: { ryds: 'rushYds', rtd: 'rushTD', rec: 'receptions', recyds: 'recYds', rectd: 'recTD', ratt: 'rushAtt', fum: 'fumbles' },
  WR: { rec: 'receptions', yds: 'recYds', td: 'recTD', fum: 'fumbles' },
  TE: { rec: 'receptions', yds: 'recYds', td: 'recTD', fum: 'fumbles' },
  OL: { blk: 'blocks' },
  DEF: { tkl: 'tackles', int: 'interceptions', sck: 'sacks', ff: 'forcedFumbles' },
};

/** The extra keys only the live save keeps, per group (copied into the latest season when the games agree). */
export const SAVE_ONLY: Record<Group, string[]> = { QB: ['att', 'cmp', 'ratt', 'sck'], RB: ['ratt', 'fum'], WR: ['fum'], TE: ['fum'], OL: [], DEF: [] };

/** A season line as a Player (fields it doesn't have stay undefined, so strict rates come out NaN). */
export const seasonPlayer = (pos: Position, box: Record<string, number>, games: number): Player => {
  const p: Record<string, unknown> = { position: pos, name: '', games, status: 'Active', rings: 0, mvp: 0, opoy: 0, sbmvp: 0, roty: 0, trueTalent: 0, dominance: 0, careerLegacy: 0, tpg: 0 };
  Object.entries(FIELD_MAP[groupOf(pos)]).forEach(([k, f]) => {
    if (typeof box[k] === 'number') p[f] = box[k];
  });
  return p as unknown as Player;
};

export interface SeasonRate extends Pick<CompFeature, 'id' | 'label' | 'definition' | 'decimals' | 'scale' | 'suffix' | 'lowerIsBetter'> {
  /** The skill-grade trait name (Arm, Vision…) for a trait; the label for an extra rate */
  name: string;
  trait: boolean;
  get: (p: Player) => number;
}

const n = (p: Player, k: string) => {
  const v = (p as unknown as Record<string, unknown>)[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
};
const div = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : NaN);

const EXTRA: Record<Group, SeasonRate[]> = {
  QB: [
    { id: 'tdG', name: 'TD/G', label: 'TD/G', definition: 'Passing touchdowns per game.', get: (p) => div(n(p, 'passTD'), p.games), decimals: 2, trait: false },
    { id: 'intG', name: 'INT/G', label: 'INT/G', definition: 'Interceptions per game.', get: (p) => div(n(p, 'interceptions'), p.games), decimals: 2, lowerIsBetter: true, trait: false },
    { id: 'tdInt', name: 'TD:INT', label: 'TD:INT', definition: 'Passing touchdowns per interception.', get: (p) => div(n(p, 'passTD'), Math.max(1, n(p, 'interceptions'))), decimals: 1, trait: false },
  ],
  RB: [
    { id: 'scrimG', name: 'Scrimmage yds/G', label: 'Scrim yds/G', definition: 'Rushing + receiving yards per game.', get: (p) => div(n(p, 'rushYds') + n(p, 'recYds'), p.games), decimals: 1, trait: false },
    { id: 'ypr', name: 'Yds/catch', label: 'Y/R', definition: 'Receiving yards per catch.', get: (p) => div(n(p, 'recYds'), n(p, 'receptions')), decimals: 1, trait: false },
    { id: 'tdPer100', name: 'TD per 100 yds', label: 'TD/100 yds', definition: 'Touchdowns per 100 scrimmage yards.', get: (p) => div(100 * (n(p, 'rushTD') + n(p, 'recTD')), n(p, 'rushYds') + n(p, 'recYds')), decimals: 2, trait: false },
  ],
  WR: [{ id: 'tdG', name: 'TD/G', label: 'TD/G', definition: 'Receiving touchdowns per game.', get: (p) => div(n(p, 'recTD'), p.games), decimals: 2, trait: false }],
  TE: [{ id: 'tdG', name: 'TD/G', label: 'TD/G', definition: 'Receiving touchdowns per game.', get: (p) => div(n(p, 'recTD'), p.games), decimals: 2, trait: false }],
  OL: [],
  DEF: [],
};

const RATES = new Map<Position, SeasonRate[]>();
/** The skill-grade traits (config/skillGrades.ts) then the extra season rates, for a position. */
export const seasonRates = (pos: Position): SeasonRate[] => {
  let r = RATES.get(pos);
  if (!r) {
    r = [
      ...skillTraits(pos).map((t) => ({ id: t.id, name: t.name, label: t.label, definition: t.definition, decimals: t.decimals, scale: t.scale, suffix: t.suffix, lowerIsBetter: t.lowerIsBetter, get: t.get, trait: true })),
      ...EXTRA[groupOf(pos)],
    ];
    RATES.set(pos, r);
  }
  return r;
};

export const fmtRate = (r: Pick<SeasonRate, 'decimals' | 'scale' | 'suffix'>, v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : `${((r.scale ?? 1) * v).toFixed(r.decimals)}${r.suffix ?? ''}`;
