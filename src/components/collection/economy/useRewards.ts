import { useMemo } from 'react';
import type { CollectionState } from '@/utils/collection';
import { collectionSets, type CollectionSet } from '@/utils/economy';
import { findNFLTeam } from '@/utils/nflTeams';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import { useMarketLatest } from '@/utils/useMarket';
import type { LeagueContent } from '@/utils/leagueContent';
import type { CardInfo } from '../useCardPool';
import { allCopies } from './copies';

/** The sets (club rosters, Super Bowls, Hall of Fame classes) from the league data. */
export const useSets = (cards: CardInfo[], content: LeagueContent | null): CollectionSet[] => {
  const extras = usePlayerExtras();
  return useMemo(
    () =>
      collectionSets({
        // Stints are keyed by normalized name (playerExtras.ts)
        cards: cards.map((c) => ({ key: c.key, name: normalizeName(c.player.name), currentTeam: c.currentTeam, active: c.player.status === 'Active' })),
        superBowls: content?.superBowls ?? [],
        stints: extras.stints,
        hofClasses: content?.hofClasses ?? [],
      }),
    [cards, content, extras.stints],
  );
};

export interface TopCard {
  info: CardInfo;
  /** His best copy's market price now */
  price: number;
}

/** The player's most valuable owned cards (his best copy each), richest first. */
export const useTopCards = (byKey: Map<string, CardInfo>, state: CollectionState, n = 3): TopCard[] => {
  const latest = useMarketLatest()?.at(-1);
  return useMemo(() => {
    const best = new Map<string, TopCard>();
    allCopies(byKey, state.cards, state.autos, latest).forEach((c) => {
      const have = best.get(c.info.key);
      if (!have || c.price > have.price) best.set(c.info.key, { info: c.info, price: c.price });
    });
    return [...best.values()].sort((a, b) => b.price - a.price).slice(0, n);
  }, [byKey, state.cards, state.autos, latest, n]);
};

/** Clubs whose set is complete (every active roster card owned), by club name. */
export const completedClubs = (sets: CollectionSet[], cards: CollectionState['cards']): string[] =>
  sets.filter((s) => s.kind === 'club' && s.members.length > 0 && s.members.every((k) => !!cards[k])).map((s) => s.team as string);

export interface JerseyLook {
  num: number;
  /** "h s% l%" */
  color: string;
  name: string;
}
/** A card's jersey: his club's colour and his number. */
export const jerseyOf = (t: TopCard): JerseyLook => {
  const team = findNFLTeam(t.info.player.team);
  return { num: t.info.number, color: team?.primaryColor ?? '226 40% 30%', name: t.info.player.name.split(' ').slice(-1)[0] };
};
