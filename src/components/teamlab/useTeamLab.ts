import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { useGamePool } from '@/utils/useOfficialOvr';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import { useCurrentClub } from '@/utils/club';
import { createLabContext, dynastyPresets, type LabContext, type Lineup, type Preset } from '@/utils/teamLab';

// ---------- Per-viewer storage (localStorage; every access guarded) ----------

const SAVED_KEY = 'retroVault:teamLab:saved';
const LEGENDS_KEY = 'retroVault:teamLab:legends';

export interface SavedTeam {
  id: string;
  name: string;
  lineup: Lineup;
  savedAt: number;
}

const readSaved = (): SavedTeam[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter((t): t is SavedTeam => !!t && typeof t.id === 'string' && typeof t.name === 'string' && !!t.lineup && typeof t.lineup === 'object')
      : [];
  } catch {
    return [];
  }
};

const writeSaved = (teams: SavedTeam[]) => {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(teams));
  } catch {
    // Storage full or blocked: the list still works for this visit
  }
};

/** Saved lineups: list / save / rename / delete, persisted in this browser. */
export const useSavedTeams = () => {
  const [teams, setTeams] = useState<SavedTeam[]>(readSaved);
  const update = useCallback((fn: (prev: SavedTeam[]) => SavedTeam[]) => {
    setTeams((prev) => {
      const next = fn(prev);
      writeSaved(next);
      return next;
    });
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => (e.key === SAVED_KEY || !e.key) && setTeams(readSaved());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return {
    teams,
    save: (name: string, lineup: Lineup) =>
      update((prev) => [{ id: `t${Date.now().toString(36)}`, name: name.trim() || 'Untitled team', lineup: { ...lineup }, savedAt: Date.now() }, ...prev]),
    rename: (id: string, name: string) => update((prev) => prev.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t))),
    remove: (id: string) => update((prev) => prev.filter((t) => t.id !== id)),
  };
};

const readLegendsPref = () => {
  try {
    return localStorage.getItem(LEGENDS_KEY) === '1';
  } catch {
    return false;
  }
};

export const useLegendsToggle = () => {
  const [on, setOn] = useState(readLegendsPref);
  const set = useCallback((v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(LEGENDS_KEY, v ? '1' : '0');
    } catch {
      // ignore
    }
  }, []);
  return [on, set] as const;
};

// ---------- Engine context ----------

/**
 * The Team Lab engine context over the league (+ NFL legends when enabled), memoised per data load. `ready`
 * turns true once the league and the official OVRs (which wait for legends.json) have loaded.
 */
export const useTeamLabContext = (includeLegends: boolean) => {
  const { careerData, getAllPlayers } = useLeague();
  const { legends, ovrMap, loaded } = useGamePool();
  const extras = usePlayerExtras();
  // The owner's current club, from the data (coach.json); "Load my <club>" and the upgrade picks use it
  const club = useCurrentClub() ?? '';
  const league = useMemo(() => getAllPlayers(), [getAllPlayers]);
  const ready = !!careerData && loaded && league.length > 0;

  const ctx = useMemo<LabContext | null>(
    () => (ready ? createLabContext(league, includeLegends ? legends : [], ovrMap) : null),
    [ready, league, legends, includeLegends, ovrMap],
  );
  const legendKeys = useMemo(() => new Set(legends.map((p) => `${p.position}:${p.name}`)), [legends]);

  // Dynasty presets come from league players only, so they don't depend on the legends toggle
  const history = useCallback((p: Player) => extras.franchises[normalizeName(p.name)] ?? [], [extras]);
  const presets = useMemo<Preset[]>(() => (ctx ? dynastyPresets(ctx, history, 5, club) : []), [ctx, history, club]);

  return { ctx, ready, legendKeys, presets, club };
};
