import { useCallback, useMemo } from 'react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import type { NFLTeam } from '@/utils/nflTeams';
import { useLeagueContent } from '@/utils/leagueContent';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { bannerTeamOf, legacyTeamOf, normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import { useHallOfFame } from '@/utils/hallOfFame';
import { useRafters } from '@/utils/rafters';
import { isHallOfFamer } from '@/config/stats';
import { overallRating } from '@/components/brand/ProPlayerBanner.utils';
import { buildFranchiseRecords, buildTeamSummaries, type FranchiseRecord, type TeamSummary } from '../teamStats';

/** One franchise as the banners draw it: club, record, rank by all-time power and its greatest players. */
export interface BannerClub {
  s: TeamSummary;
  rec: FranchiseRecord;
  team: NFLTeam;
  /** 1-based all-time power rank */
  rank: number;
  titles: number;
  /** Greatest players by Career Legacy among everyone with a stint here */
  top: Player[];
  star: Player | null;
  /** Players on the club's Ring of Honor (halloffame.json), the Hall of Famers first */
  honoured: number;
  /** The star's number the club retired, when it has one */
  retired?: number | string;
}

export interface BannerData {
  /** All 32 franchises, all-time power No. 1 first */
  clubs: BannerClub[];
  /** The clubs with a Super Bowl title, most titles first */
  champions: BannerClub[];
  totals: { franchises: number; superBowls: number; champions: number; hof: number; honoured: number; since: number };
}

/**
 * The all-time franchise numbers the Teams hero draws (the same ones the franchise wall uses: teamStats.ts
 * buildTeamSummaries / buildFranchiseRecords, greatest player = first of franchisePlayers).
 */
export const useBannerData = (): BannerData | null => {
  const { careerData, getAllPlayers, dataVersion } = useLeague();
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const { data: hof } = useHallOfFame();
  const { bannersFor } = useRafters();
  const officialOvr = useOfficialOvr();
  const superBowls = useMemo(() => content?.superBowls ?? [], [content]);
  const league = useMemo(
    () => getAllPlayers().filter((p) => !p.isRealLegend),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [careerData, getAllPlayers, dataVersion],
  );
  const { teams } = useMemo(() => buildTeamSummaries(league, extras.stints, superBowls), [league, extras.stints, superBowls]);
  const ovrFor = useCallback((p: Player) => overallRating(p, officialOvr), [officialOvr]);
  const records = useMemo(() => buildFranchiseRecords(teams, superBowls, ovrFor), [teams, superBowls, ovrFor]);
  return useMemo(() => {
    if (!teams.length || !superBowls.length) return null;
    const clubs = teams
      .filter((s) => s.team)
      .map<BannerClub>((s) => {
        const rec = records.get(s.key)!;
        return { s, rec, team: s.team!, rank: rec.powerRank, titles: rec.titles, top: s.franchisePlayers.slice(0, 5), star: s.franchisePlayers[0] ?? null, honoured: hof?.ringOfHonor[s.team!.name]?.length ?? 0 };
      })
      .sort((a, b) => a.rank - b.rank);
    // One face per player: a club's greatest is skipped when he is better known for another club that has him on its roster
    const used = new Set<string>();
    const keyOf = (p: Player) => `${p.position}:${p.name}`;
    /** The club he is best known for: where his card and number belong (retired: his legacy club; active: his club now) */
    const homeOf = (p: Player): string => (p.status === 'Retired' ? legacyTeamOf(extras, p) : bannerTeamOf(p));
    clubs.forEach((c) => {
      const ok = (p: Player) => {
        if (used.has(keyOf(p))) return false;
        const home = homeOf(p);
        const isClub = (x: BannerClub) => home === x.team.name || home.endsWith(` ${x.team.name}`);
        if (!home || isClub(c)) return true;
        const homeClub = clubs.find(isClub);
        return !homeClub || !homeClub.s.franchisePlayers.includes(p);
      };
      // the club's Ring of Honor leads (the greatest of them by live Career Legacy); a club with nobody honoured falls back to everyone who played here
      const ring = new Set((hof?.ringOfHonor[c.team.name] ?? []).map((e) => normalizeName(e.name)));
      const pool = c.s.franchisePlayers.filter(ok);
      const honoured = pool.filter((p) => ring.has(normalizeName(p.name)));
      const pick = (honoured.length ? [...honoured, ...pool.filter((p) => !honoured.includes(p))] : pool).slice(0, 5);
      c.top = pick;
      c.star = pick[0] ?? null;
      if (c.star) {
        used.add(keyOf(c.star));
        c.retired = bannersFor(c.team.name).find((b) => b.r.playerKey === keyOf(c.star!))?.r.number;
      }
    });
    const champions = clubs.filter((c) => c.titles > 0).sort((a, b) => b.titles - a.titles || a.rank - b.rank);
    const since = superBowls.length ? Math.min(...superBowls.map((sb) => sb.year)) : 1999;
    return {
      clubs,
      champions,
      totals: { franchises: clubs.length, superBowls: superBowls.length, champions: new Set(superBowls.map((sb) => sb.winner).filter(Boolean)).size, hof: league.filter(isHallOfFamer).length, honoured: clubs.reduce((n, c) => n + c.honoured, 0), since },
    };
  }, [teams, records, superBowls, league, extras, hof, bannersFor]);
};
