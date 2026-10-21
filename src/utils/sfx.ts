/**
 * Sound hooks for the pack opening (and anything else that wants them). A no-op until a mute toggle exists: call
 * sfx('tear') etc. at the moments a sound would play, and a future setting can wire real audio in one place.
 */
export type SfxName = 'tear' | 'tell' | 'deal' | 'flip' | 'flip-best' | 'shard' | 'walkout' | 'summary';

let player: ((name: SfxName) => void) | null = null;

/** Plays a sound effect if a player is installed (none is today). */
export const sfx = (name: SfxName) => {
  try {
    player?.(name);
  } catch {
    // Audio must never break the UI
  }
};

/** Installs (or with null removes) the sound player, e.g. from a future mute toggle. */
export const setSfxPlayer = (p: ((name: SfxName) => void) | null) => {
  player = p;
};
