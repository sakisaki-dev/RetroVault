import { useCallback, useMemo } from 'react';
import type { Player } from '@/types/player';
import { playerKey } from '@/config/ovr';
import { isHallOfFamer } from '@/config/stats';
import { playerSkillGrades } from '@/config/skillGrades';
import { freezeSnapshot, type AutographSnapshot } from '@/config/autographs';
import { latestSeasonYear, normalizeName, useLeagueContent, type LeagueContent } from '@/utils/leagueContent';
import type { CardInfo } from '../useCardPool';

/** Games at or under which an S or A grade makes him Rising (config/autographs.ts prestigeOf). */
const RISING_GAMES = 60;

/**
 * Freezes a player's autograph snapshot from what the site knows right now: his card (banner team, jersey number), his
 * Career Legacy, rings, MVPs and nickname, Hall of Fame membership (isHallOfFamer) and class (content.json hofClasses),
 * his skill grade (only needed for Rising), and the season his career centres on (the midpoint of the era his
 * playerNotes entry names, else the latest season).
 */
export const freezeFor = (info: Pick<CardInfo, 'player' | 'number'>, content: LeagueContent | null, players: Player[]): AutographSnapshot => {
  const p = info.player;
  const key = playerKey(p);
  const hof = !p.isRealLegend && isHallOfFamer(p);
  const hofClass = hof ? content?.hofClasses?.find((c) => c.keys.includes(key))?.label : undefined;
  const target = normalizeName(p.name);
  const note = content?.playerNotes.find((n) => normalizeName(n.name) === target && (!n.position || n.position === p.position) && n.era);
  const era = note ? content?.eras.find((e) => e.name === note.era) : undefined;
  const eraYear = era ? (era.startYear + era.endYear) / 2 : latestSeasonYear(content) || 1;
  const grade = p.games <= RISING_GAMES ? (playerSkillGrades(players, p).overall?.grade.grade ?? null) : null;
  return freezeSnapshot({
    name: p.name,
    position: p.position,
    team: p.team,
    number: info.number,
    rings: p.rings,
    mvp: p.mvp,
    nickname: p.nickname,
    careerLegacy: p.careerLegacy,
    games: p.games,
    hof,
    hofClass,
    grade,
    eraYear,
  });
};

/** A freezer for openPack: describes any pulled card player from the card pool and the league content. */
export const useAutographFreezer = (byKey: Map<string, CardInfo>) => {
  const { content } = useLeagueContent();
  const players = useMemo(() => [...byKey.values()].map((c) => c.player), [byKey]);
  const freeze = useCallback(
    (player: Player): AutographSnapshot | null => {
      const info = byKey.get(playerKey(player));
      return info ? freezeFor(info, content, players) : null;
    },
    [byKey, content, players],
  );
  return { freeze, content };
};
