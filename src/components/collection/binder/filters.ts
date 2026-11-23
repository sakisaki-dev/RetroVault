import type { Position } from '@/types/player';
import type { Finish, Tier } from '@/utils/collection';
import type { CardInfo } from '../useCardPool';

/** The binder's view, search, filters and sort (Binder.tsx) */
export type BinderSort = 'set' | 'ovr' | 'tier' | 'finish' | 'recent' | 'name' | 'pos' | 'club';
export interface BinderFilterState {
  q: string;
  mine: boolean;
  tier: Tier | 'all';
  finish: Finish | 'all';
  pos: Position | 'all';
  team: string;
  sort: BinderSort;
  /** Reverse the sort's natural order */
  rev: boolean;
}
export const BINDER_DEFAULTS: BinderFilterState = { q: '', mine: true, tier: 'all', finish: 'all', pos: 'all', team: 'all', sort: 'set', rev: false };

export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
export const SORTS: { key: BinderSort; label: string }[] = [
  { key: 'set', label: 'Set #' },
  { key: 'recent', label: 'Newest' },
  { key: 'tier', label: 'Rarity' },
  { key: 'finish', label: 'Finish' },
  { key: 'ovr', label: 'CAR' },
  { key: 'name', label: 'Name' },
  { key: 'pos', label: 'Position' },
  { key: 'club', label: 'Club' },
];
/** What each sort puts first, for the reverse button's label */
export const SORT_FIRST: Record<BinderSort, [string, string]> = {
  set: ['No. 1 first', 'Last number first'],
  recent: ['Newest first', 'Oldest first'],
  tier: ['Rarest first', 'Commonest first'],
  finish: ['Best finish first', 'Base first'],
  ovr: ['Highest first', 'Lowest first'],
  name: ['A to Z', 'Z to A'],
  pos: ['QB first', 'DL first'],
  club: ['A to Z', 'Z to A'],
};
const MINE_KEY = 'rv:binder:mine';

export const readMinePref = (): boolean => {
  try {
    return localStorage.getItem(MINE_KEY) !== '0';
  } catch {
    return true;
  }
};
export const writeMinePref = (mine: boolean) => {
  try {
    localStorage.setItem(MINE_KEY, mine ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts this visit */
  }
};

/** Accent- and case-blind name match for the search box */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’.]/g, '').toLowerCase();
export const matchesQuery = (c: CardInfo, q: string) => {
  const t = fold(q.trim());
  if (!t) return true;
  return fold(c.player.name).includes(t) || fold(c.player.nickname ?? '').includes(t);
};

