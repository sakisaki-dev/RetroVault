import { capRows, teamStrength, type CapRow, type OfficeState, type Strength } from '@/utils/clubOffice';
import { SLOTS, type Lineup, type SlotId } from '@/utils/teamLab';

/**
 * The lineup through the game's own rules (src/utils/clubOffice.ts, docs/SAVE_INVENTORY.md 7.1-7.3, 7.8), for the
 * players the live save has (playing now, any club). A retired player or an NFL legend has no ratings in the save,
 * so he is listed as unrated and left out of every sum, never guessed.
 */
export interface LabLedger {
  season: number;
  /** Rated players by slot (the save's ratings, contract, salary; the same rules as the Front Office cap sheet) */
  rows: Partial<Record<SlotId, CapRow>>;
  rated: number;
  filled: number;
  offenseRated: number;
  defenseRated: number;
  /** Team strength with the coach's coordinators (7.8): only the rated players' stars count */
  strength: Strength[];
  coordinators: { oc: string; dc: string };
  payroll: number;
  cap: number;
  /** The last season every rated player is still playing (the lineup's window), and who closes it */
  window: { season: number; name: string } | null;
}

export const labLedger = (s: OfficeState, lineup: Lineup): LabLedger => {
  const LAB = '__lab__';
  const keys = SLOTS.map((sl) => lineup[sl.id]).filter((k) => k && s.players[k]);
  // the cap sheet's rules over just these players: give them one club for capRows
  const players = Object.fromEntries(keys.map((k) => [k, { ...s.players[k], team: LAB }]));
  const byKey = new Map(capRows({ ...s, club: LAB, players }).map((r) => [r.key, r]));
  const rows: Partial<Record<SlotId, CapRow>> = {};
  SLOTS.forEach((sl) => {
    const r = byKey.get(lineup[sl.id]);
    if (r) rows[sl.id] = r;
  });
  const list = Object.values(rows) as CapRow[];
  const staff = s.staff ?? [];
  const closer = list.length ? list.reduce((a, b) => (b.finalSeason < a.finalSeason ? b : a)) : null;
  return {
    season: s.season,
    rows,
    rated: list.length,
    filled: SLOTS.filter((sl) => lineup[sl.id]).length,
    offenseRated: SLOTS.filter((sl) => sl.side === 'offense' && rows[sl.id]).length,
    defenseRated: SLOTS.filter((sl) => sl.side === 'defense' && rows[sl.id]).length,
    strength: teamStrength(list, staff),
    coordinators: { oc: staff.find((c) => c.role === 'OC')?.name ?? '', dc: staff.find((c) => c.role === 'DC')?.name ?? '' },
    payroll: list.reduce((a, r) => a + r.p.salary, 0),
    cap: s.settings.salary_cap,
    window: closer ? { season: closer.finalSeason, name: closer.name } : null,
  };
};
