import { useCallback, useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { playerKey } from '@/config/ovr';
import { autographValue, hash, rollAutograph } from '@/config/autographs';
import { FINISH_MULTIPLIER } from '@/utils/cardMarket';
import { useLeagueContent } from '@/utils/leagueContent';
import { useCollection, type Finish, type OwnedAuto, type PackCard } from '@/utils/collection';
import type { CardInfo } from '../useCardPool';
import { freezeFor } from './freeze';

/** Roll seed of a player's sample autograph at one finish: the same sample everywhere, every visit. */
export const sampleSeed = (key: string, finish: Finish) => hash(`sample:${key}:${finish}`);

/** Is this autograph a stand-in roll (galleries, the Art lab, previews) rather than an owned pull? */
export const isSampleAuto = (a: Pick<OwnedAuto, 'id'>) => a.id.startsWith('sample-');

/** Best of a player's owned autographs: the highest value (the finish it was pulled at × its multiplier). */
export const bestAuto = (autos: OwnedAuto[]) =>
  autos.reduce<OwnedAuto | null>((best, a) => {
    const v = FINISH_MULTIPLIER[a.finish] * autographValue(a.roll).total;
    return !best || v > FINISH_MULTIPLIER[best.finish] * autographValue(best.roll).total ? a : best;
  }, null);

/**
 * Stand-in autographs where no owned roll exists (Card designs, the Art lab, sample packs, market previews): a
 * deterministic roll seeded by player and finish, frozen from what the site knows now. Never touches the collection.
 */
export const useSampleAutos = () => {
  const { content } = useLeagueContent();
  const { getAllPlayers } = useLeague();
  const players = useMemo(() => getAllPlayers(), [getAllPlayers]);
  // The id names the content state too, so the canvas cache never keeps a render frozen before content loaded
  const tag = content ? 'c' : 'n';
  const sample = useCallback(
    (info: Pick<CardInfo, 'player' | 'number'>, finish: Finish): OwnedAuto => {
      const key = playerKey(info.player);
      const snap = freezeFor(info, content, players);
      return { id: `sample-${tag}-${key}-${finish}`, key, pulledAt: 0, pack: 'standard', finish, roll: rollAutograph(snap, sampleSeed(key, finish)), snap };
    },
    [content, players, tag],
  );
  /** Gives every Autograph-variant card without an autograph (a preview pack) its sample roll. */
  const attach = useCallback(
    <C extends PackCard>(cards: C[], describe: (c: C) => Pick<CardInfo, 'player' | 'number'>): C[] =>
      cards.map((c) => (c.variant === 'auto' && !c.auto ? { ...c, auto: sample(describe(c), c.finish) } : c)),
    [sample],
  );
  return { sample, attach };
};

/** Which autograph an Autograph-variant card shows: a given one (a pull), 'sample' (galleries, previews), or unset (his own). */
export type AutographChoice = OwnedAuto | 'sample' | null | undefined;

/**
 * The autograph an Autograph-variant card shows: the one given (a pull), else (unless a sample is asked for) the
 * player's best owned autograph (at this finish when he has one, else any), else his sample roll.
 */
export const useAutographFor = (info: Pick<CardInfo, 'player' | 'number'>, finish: Finish, given?: AutographChoice): OwnedAuto => {
  const { state } = useCollection();
  const { sample } = useSampleAutos();
  const { player, number } = info;
  return useMemo(() => {
    if (given === 'sample') return sample({ player, number }, finish);
    if (given) return given;
    const key = playerKey(player);
    const mine = state.autos.filter((a) => a.key === key);
    return bestAuto(mine.filter((a) => a.finish === finish)) ?? bestAuto(mine) ?? sample({ player, number }, finish);
  }, [given, state.autos, player, number, finish, sample]);
};
