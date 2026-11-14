import { useEffect, useState } from 'react';

/**
 * The live state read from the owner's game save (public/data/league/save_state.json, exported by
 * scripts/save_state.py from data/y80/save_state.json; written only by a save.state upload mutation).
 * Owner decisions: no morale, bio is age only, never the game's own Hall of Fame fields (none are in the file).
 */

export type Rating = 'speed' | 'strength' | 'skill' | 'stamina';
export const RATINGS: Rating[] = ['speed', 'strength', 'skill', 'stamina'];

export interface SavePlayer {
  team: string;
  age: number;
  speed: number;
  strength: number;
  skill: number;
  stamina: number;
  max_speed: number;
  max_strength: number;
  max_skill: number;
  max_stamina: number;
  injury_week: number;
  contract: number;
  salary: number;
  delay_retirement: number;
  xp_level: number;
  season: Record<string, number>;
}

export interface SaveClub {
  abbr: string;
  w: number;
  l: number;
  t: number;
  off: number;
  def: number;
}

export interface SaveState {
  id: string;
  upload: string;
  season: number;
  week: number;
  club: string;
  settings: Record<string, unknown>;
  clubs: Record<string, SaveClub>;
  coachGames: unknown[];
  /** Retro Vault key (POS:Name) → live fields, playing players only */
  players: Record<string, SavePlayer>;
  /** Playing in the save, not yet in Retro Vault (no card) */
  newPlayers: Record<string, SavePlayer>;
}

let cache: Promise<SaveState | null> | null = null;

/** Loads the save state once per page load (null when the file is missing: no save imported yet). */
export const loadSaveState = (): Promise<SaveState | null> => {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/league/save_state.json`)
    .then((r) => (r.ok ? (r.json() as Promise<SaveState>) : null))
    .then((d) => (d && typeof d === 'object' && d.players ? d : null))
    .catch(() => null);
  return cache;
};

/** undefined while loading, null when there is no save state, else the state. */
export const useSaveState = (): SaveState | null | undefined => {
  const [state, setState] = useState<SaveState | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadSaveState().then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
};
