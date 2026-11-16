import { useCallback, useMemo } from 'react';
import type { Player } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { isHallOfFamer } from '@/config/stats';
import { findNFLTeam, getNFLTeamById, type NFLTeam } from './nflTeams';
import { franchiseKey, useJerseyNumbers, type RetiredNumber } from './jerseys';
import { normalizeName, usePlayerExtras, type IndexedExtras } from './playerExtras';
import { useHallOfFame, type RingOfHonorEntry } from './hallOfFame';

/**
 * The rafters: every club's retired numbers (utils/jerseys, the site's one retired-number rule: a Hall of Famer's
 * number goes up at the club he is best known for, or every club in his retired_by list) dressed for the banners,
 * with his years and rings at that club from the career stints, and the club's Ring of Honor (halloffame.json).
 */

export interface RafterBanner {
  r: RetiredNumber;
  /** Surname as the banner prints it */
  last: string;
  /** "Y61–69" at this club (career stints), else what the retirement carries */
  years?: string;
  /** Super Bowls he won at this club (career stints) */
  rings: number;
  hof: boolean;
  player?: Player;
}

const surname = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const suffix = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
  const last = parts.length > 1 && suffix.test(parts[parts.length - 1]) ? parts.slice(-2).join(' ') : parts[parts.length - 1];
  return last ?? name;
};

/** "Y61–69" (or "Y61") from his stints at one club; undefined when he has none there */
const yearsAt = (extras: IndexedExtras, name: string, clubId: string): { years?: string; rings: number } => {
  const c = extras.stints[normalizeName(name)];
  const here = (c?.stints ?? []).filter((s) => findNFLTeam(s.team)?.id === clubId);
  if (!here.length) return { rings: 0 };
  const rings = here.reduce((n, s) => n + s.rings.length, 0);
  if (c?.approx) return { rings };
  const from = Math.min(...here.map((s) => s.from));
  const to = Math.max(...here.map((s) => s.to));
  return { years: from === to ? `Y${from}` : `Y${from}–${to}`, rings };
};

export const useRafters = () => {
  const { index } = useJerseyNumbers();
  const extras = usePlayerExtras();
  const { data: hof } = useHallOfFame();
  const { getAllPlayers, dataVersion } = useLeague();
  const players = useMemo(() => {
    const m = new Map<string, Player>();
    getAllPlayers().forEach((p) => !p.isRealLegend && m.set(`${p.position}:${p.name}`, p));
    return m;
    // dataVersion: a new league load is a new player list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllPlayers, dataVersion]);

  /** Retired numbers dressed as banners (years and rings at the club that hangs each one) */
  const bannersOf = useCallback(
    (list: RetiredNumber[]): RafterBanner[] =>
      list.map((r) => {
        const player = r.playerKey ? players.get(r.playerKey) : undefined;
        const at = yearsAt(extras, r.name, r.teamKey);
        return {
          r,
          last: surname(r.name),
          years: at.years ?? r.years,
          rings: at.rings,
          hof: r.source === 'hof' || (!!player && isHallOfFamer(player)),
          player,
        };
      }),
    [players, extras],
  );

  /** A club's banners (team id, nickname or abbreviation), lowest number first */
  const bannersFor = useCallback(
    (club: string | null | undefined): RafterBanner[] => {
      const team = getNFLTeamById(club) ?? findNFLTeam(club);
      return bannersOf(index.retired.get(team?.id ?? franchiseKey(club)) ?? []);
    },
    [index, bannersOf],
  );

  /** A club's Ring of Honor, Hall of Famers first */
  const ringFor = useCallback((team: NFLTeam | null | undefined): RingOfHonorEntry[] => (team && hof?.ringOfHonor[team.name]) || [], [hof]);

  /** Every club that hangs a player's number, his numbering club first */
  const retiredForPlayer = useCallback(
    (p: Pick<Player, 'name' | 'position'>): RetiredNumber[] => {
      const key = `${p.position}:${p.name}`;
      const out: RetiredNumber[] = [];
      index.retired.forEach((list) => list.forEach((r) => r.playerKey === key && out.push(r)));
      return out.sort((a, b) => Number(!!a.alsoRetired) - Number(!!b.alsoRetired) || a.teamLabel.localeCompare(b.teamLabel));
    },
    [index],
  );

  /** The clubs with at least one retired number, by name */
  const clubsWithRafters = useMemo(
    () => [...index.retired.keys()].map((k) => getNFLTeamById(k)).filter((t): t is NFLTeam => !!t).sort((a, b) => a.name.localeCompare(b.name)),
    [index],
  );

  return { bannersFor, bannersOf, ringFor, retiredForPlayer, clubsWithRafters, players, loadingHof: hof === undefined };
};
