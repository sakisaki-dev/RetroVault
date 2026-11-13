import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, Lightbulb, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import type { DidYouKnow } from '@/utils/leagueContent';
import { getTeamColors } from '@/utils/teamColors';
import { ClubChips } from './ClubChips';
import { SourcedFigure } from './SourcedFigure';
import './takes.css';

/**
 * Did you know: the Season Story's short written facts (data/y80/stories.json didYouKnow, every figure checked by
 * scripts/story_check.py). Fact cards with the first figure as a big number (source on hover or tap), the fact, and
 * player (or club) chips in club colours.
 *
 * Phone first: one card at a time with previous / next and a "fact 2 of 7" counter, plus "All facts" to list them;
 * from 768px every card shows in a grid and the current one is highlighted. Shuffle reorders the deck (presentation
 * only; nothing is stored).
 */

const teamVars = (team?: string): CSSProperties | undefined => {
  const c = getTeamColors(team);
  return c ? ({ '--tc': `hsl(${c.primary})`, '--tc2': `hsl(${c.secondary})` } as CSSProperties) : undefined;
};

const shuffled = (n: number, keepFirst: number): number[] => {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // a shuffle always changes the card in front
  if (n > 1 && order[0] === keepFirst) [order[0], order[1]] = [order[1], order[0]];
  return order;
};

interface Props {
  facts: DidYouKnow[];
  season: string;
  players: Player[];
  onPlayer: (p: Player) => void;
}

export const DidYouKnowDeck = ({ facts, season, players, onPlayer }: Props) => {
  // the deck order (indices into facts) and the position of the card in front
  const [order, setOrder] = useState<number[] | null>(null);
  const [pos, setPos] = useState(0);
  const [all, setAll] = useState(false);
  const deck = useMemo(() => (order && order.length === facts.length ? order : facts.map((_, i) => i)), [order, facts]);
  if (!facts.length) return null;
  const at = Math.min(pos, facts.length - 1);
  const go = (d: number) => setPos((p) => (Math.min(p, facts.length - 1) + d + facts.length) % facts.length);
  const shuffle = () => {
    setOrder(shuffled(facts.length, deck[at]));
    setPos(0);
  };

  return (
    <section className={cn('dyk', all && 'dyk--all')} aria-labelledby="dyk-title">
      <header className="dyk-head">
        <h3 id="dyk-title" className="dyk-title">
          <Lightbulb className="h-4 w-4" aria-hidden="true" /> Did you know
          <span className="dyk-title__season">{season}</span>
        </h3>
        <div className="dyk-controls" role="group" aria-label="Facts">
          <span className="dyk-count" aria-live="polite">
            Fact {at + 1} of {facts.length}
          </span>
          <button type="button" className="dyk-btn dyk-btn--step" onClick={() => go(-1)} aria-label="Previous fact" disabled={facts.length < 2}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="dyk-btn dyk-btn--step" onClick={() => go(1)} aria-label="Next fact" disabled={facts.length < 2}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="dyk-btn" onClick={shuffle} disabled={facts.length < 2}>
            <Shuffle className="h-4 w-4" aria-hidden="true" /> Shuffle
          </button>
          <button type="button" className="dyk-btn dyk-btn--all" aria-pressed={all} onClick={() => setAll((a) => !a)}>
            <LayoutGrid className="h-4 w-4" aria-hidden="true" /> {all ? 'One at a time' : 'All facts'}
          </button>
        </div>
      </header>
      <ul className="dyk-grid">
        {deck.map((i, n) => {
          const f = facts[i];
          const lead = f.stats[0];
          const current = n === at;
          return (
            <li
              key={f.id}
              className="dyk-card"
              data-current={current || undefined}
              style={teamVars(f.teams[0])}
              aria-current={current || undefined}
            >
              {lead ? (
                <SourcedFigure stat={lead} className="dyk-card__fig" />
              ) : (
                <Lightbulb className="dyk-card__icon h-7 w-7" aria-hidden="true" />
              )}
              <p className="dyk-card__text">{f.text}</p>
              <ClubChips names={f.players} teams={f.teams} players={players} onPlayer={onPlayer} max={3} label="In this fact" />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
