import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, Shuffle } from 'lucide-react';
import { reducedMotion } from '@/utils/motion';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import type { DidYouKnow } from '@/utils/leagueContent';
import { mainClubOf, teamVars } from './clubArt';
import { ClubChips } from './ClubChips';
import { SourcedFigure } from './SourcedFigure';
import ArticleArt from './ArticleArt';
import './takes.css';

/**
 * Did you know: the Season Story's short written facts (data/y80/stories.json didYouKnow, every figure checked by
 * scripts/story_check.py). A compact rail of short items: the first figure as a small number (source on hover or
 * tap), the fact, and player (or club) chips in club colours.
 *
 * Phone and tablet: a horizontal rail (swipe, or previous / next with a "Fact 2 of 7" counter); from 1024px it is the
 * front page's sidebar, a plain list of the first five with All facts for the rest. Shuffle reorders the deck (presentation only; nothing is stored).
 */

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
  // the deck order (indices into facts) and the item at the rail's left edge
  const [order, setOrder] = useState<number[] | null>(null);
  const [pos, setPos] = useState(0);
  const [all, setAll] = useState(false);
  const rail = useRef<HTMLUListElement>(null);
  const deck = useMemo(() => (order && order.length === facts.length ? order : facts.map((_, i) => i)), [order, facts]);
  if (!facts.length) return null;
  const at = Math.min(pos, facts.length - 1);
  const scrollToItem = (n: number, smooth: boolean) => {
    const r = rail.current;
    const el = r?.children[n] as HTMLElement | undefined;
    if (r && el) r.scrollTo({ left: el.offsetLeft - r.offsetLeft, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  };
  const go = (d: number) => {
    const n = (at + d + facts.length) % facts.length;
    setPos(n);
    scrollToItem(n, true);
  };
  const onScroll = () => {
    const r = rail.current;
    if (!r || r.scrollWidth <= r.clientWidth) return; // the sidebar list does not scroll sideways
    const items = [...r.children] as HTMLElement[];
    const x = r.scrollLeft;
    let best = 0;
    items.forEach((el, i) => {
      if (Math.abs(el.offsetLeft - r.offsetLeft - x) < Math.abs(items[best].offsetLeft - r.offsetLeft - x)) best = i;
    });
    // the last items can't reach the left edge: at the end, count the last one
    if (x + r.clientWidth >= r.scrollWidth - 2) best = items.length - 1;
    if (best !== at) setPos(best);
  };
  const shuffle = () => {
    setOrder(shuffled(facts.length, deck[at]));
    setPos(0);
    scrollToItem(0, false);
  };

  return (
    <section className={cn('dyk', all && 'dyk--all')} aria-labelledby="dyk-title">
      <header className="dyk-head">
        <h3 id="dyk-title" className="dyk-title">
          <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Did you know
          <span className="dyk-title__season">{season}</span>
        </h3>
        <div className="dyk-controls" role="group" aria-label="Facts">
          <span className="dyk-count">
            {at + 1}/{facts.length}
          </span>
          <button type="button" className="dyk-btn dyk-btn--step" onClick={() => go(-1)} aria-label="Previous fact" disabled={facts.length < 2}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="dyk-btn dyk-btn--step" onClick={() => go(1)} aria-label="Next fact" disabled={facts.length < 2}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="dyk-btn" onClick={shuffle} disabled={facts.length < 2} aria-label="Shuffle the facts" title="Shuffle">
            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>
      <ul className="dyk-rail" ref={rail} onScroll={onScroll} aria-label={`${season} facts`}>
        {deck.map((i, n) => {
          const f = facts[i];
          const lead = f.stats[0];
          return (
            <li key={f.id} className="dyk-item" data-current={n === at || undefined} style={teamVars(mainClubOf(f, players))}>
              {lead ? <SourcedFigure stat={lead} className="dyk-item__fig" /> : <Lightbulb className="dyk-item__icon h-4 w-4" aria-hidden="true" />}
              <ArticleArt variant="side" kind="fact" players={f.players} teams={f.teams} league={players} className="dyk-item__art" />
              <p className="dyk-item__text">{f.text}</p>
              <ClubChips names={f.players} teams={f.teams} players={players} onPlayer={onPlayer} max={2} label="In this fact" />
            </li>
          );
        })}
      </ul>
      {facts.length > 5 && (
        <button type="button" className="dyk-more" aria-expanded={all} onClick={() => setAll((a) => !a)}>
          {all ? 'Fewer facts' : `All facts (${facts.length})`}
        </button>
      )}
    </section>
  );
};
