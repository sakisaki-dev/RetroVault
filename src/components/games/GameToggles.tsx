import { useCallback, useState } from 'react';
import { CAREER_LABEL } from '@/config/ovr';
import type { ArcadeRating } from './gameUtils';
import './gameToggles.css';

/**
 * The two controls inside every game's title bar (owner: "all games need to have an active players toggle and a SZN vs
 * CAR toggle within their respective game screens"): Players All / Active and Rating SZN / OVR. SZN rates this season, so
 * only active players have one: picking it locks Players to Active, and going back to OVR restores the earlier choice.
 * Each game keeps its own choice on this device (`rv:game:<id>:pool` and `:rating`).
 */
export type PoolChoice = 'all' | 'active';
export interface GameSettings {
  /** What the player picked (restored when SZN is switched off) */
  pool: PoolChoice;
  rating: ArcadeRating;
}

const read = (id: string, k: 'pool' | 'rating'): string | null => {
  try {
    return localStorage.getItem(`rv:game:${id}:${k}`);
  } catch {
    return null;
  }
};
const write = (id: string, k: 'pool' | 'rating', v: string) => {
  try {
    localStorage.setItem(`rv:game:${id}:${k}`, v);
  } catch {
    /* storage unavailable: the choice lasts this visit */
  }
};

/** One game's settings; `fallbackRating` (the Arcade hall's switch) seeds a game that has none saved yet. */
export const useGameSettings = (id: string | null, fallbackRating: ArcadeRating) => {
  const load = useCallback(
    (g: string): GameSettings => {
      const r = read(g, 'rating');
      const p = read(g, 'pool');
      return { pool: p === 'active' ? 'active' : 'all', rating: r === 'szn' ? 'szn' : r === 'ovr' ? 'car' : fallbackRating };
    },
    [fallbackRating],
  );
  const [state, setState] = useState<{ id: string | null; s: GameSettings }>(() => ({ id, s: id ? load(id) : { pool: 'all', rating: fallbackRating } }));
  // a different game: read its own saved choice (set during render, so the first frame is already right)
  let cur = state;
  if (state.id !== id) {
    cur = { id, s: id ? load(id) : { pool: 'all', rating: fallbackRating } };
    setState(cur);
  }
  const set = (patch: Partial<GameSettings>) => {
    if (!id) return;
    const s = { ...cur.s, ...patch };
    if (patch.pool) write(id, 'pool', s.pool);
    if (patch.rating) write(id, 'rating', s.rating === 'szn' ? 'szn' : 'ovr');
    setState({ id, s });
  };
  return { settings: cur.s, set, activeOnly: cur.s.rating === 'szn' || cur.s.pool === 'active' };
};

interface Props {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  /** League Grid and other games with no rating on screen show Players only */
  showRating?: boolean;
  /** A note when the active pool was too small and the game widened it */
  note?: string | null;
}

const Chips = <T extends string>({ label, value, options, onPick, locked, hint }: { label: string; value: T; options: { id: T; text: string; title?: string }[]; onPick: (v: T) => void; locked?: boolean; hint?: string }) => (
  <div className={`gt-grp${locked ? ' is-locked' : ''}`} role="radiogroup" aria-label={label} title={hint}>
    <span className="gt-lab">{label}</span>
    <span className="gt-chips">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="gt-chip" title={o.title} disabled={locked && value !== o.id} onClick={() => onPick(o.id)}>
          {o.text}
        </button>
      ))}
    </span>
  </div>
);

const GameToggles = ({ settings, onChange, showRating = true, note }: Props) => {
  const szn = showRating && settings.rating === 'szn';
  return (
    <div className="gt" data-szn={szn ? '1' : undefined}>
      <Chips
        label="Players"
        value={szn ? 'active' : settings.pool}
        locked={szn}
        hint={szn ? 'SZN rates this season, so active players only' : undefined}
        options={[
          { id: 'all', text: 'All', title: 'Every player in this game, retired too' },
          { id: 'active', text: 'Active', title: 'Only players on a club now' },
        ]}
        onPick={(pool) => onChange({ pool })}
      />
      {showRating && (
        <Chips<ArcadeRating>
          label="Rating"
          value={settings.rating}
          options={[
            { id: 'szn', text: 'SZN', title: "This season's rating (active players only)" },
            { id: 'car', text: CAREER_LABEL, title: 'Career rating' },
          ]}
          onPick={(rating) => onChange({ rating })}
        />
      )}
      {szn && <span className="gt-hint">SZN rates this season, so active players only</span>}
      {note && <span className="gt-hint gt-note">{note}</span>}
    </div>
  );
};

export default GameToggles;
