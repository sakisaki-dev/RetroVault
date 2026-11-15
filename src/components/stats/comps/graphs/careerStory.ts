import type { Player } from '@/types/player';
import type { PlayerStints } from '@/utils/playerExtras';
import type { SuperBowlEntry } from '@/utils/leagueContent';
import type { HallOfFameData } from '@/utils/hallOfFame';
import type { SaveState, Rating } from '@/components/clock/saveData';
import { RATINGS } from '@/components/clock/saveData';
import { halfStars, seasonsLeft } from '@/components/clock/clockModel';
import type { ClubRecordRow } from '../../clubRecords';
import { entryName } from '../../clubRecords';
import { primeWindow, type LeagueSeasons, type SeasonPoint } from './careerModel';

/**
 * One player's career for the graphs: his season points, the club each season (career stints), and the events on his
 * timeline: rings and awards (the change in his award totals between two season ends), records set (the record
 * board's year for the club's records, the league's season marks), club changes, his Hall of Fame class, and for an
 * active player the live save's final season and stars now → ceiling.
 */

export type EventKind = 'ring' | 'mvp' | 'poy' | 'sbmvp' | 'record' | 'club' | 'hof' | 'final' | 'ceiling';

export interface CareerEvent {
  year: number;
  kind: EventKind;
  label: string;
  detail?: string;
}

export interface LiveOutlook {
  season: number;
  age: number;
  finalSeason: number;
  starsNow: number;
  starsMax: number;
}

export interface Career {
  key: string;
  points: SeasonPoint[];
  /** Club per point (null after he stopped playing) */
  clubs: (string | null)[];
  events: CareerEvent[];
  prime: { from: number; to: number; mean: number } | null;
  live: LiveOutlook | null;
  /** True when a season line exists for at least one season */
  hasSeasons: boolean;
}

const clubAt = (stints: PlayerStints | undefined, year: number, fallback: string | null): string | null => {
  const st = stints?.stints ?? [];
  if (!st.length || stints?.approx) return fallback;
  const inside = st.find((s) => year >= s.from && year <= s.to);
  if (inside) return inside.team;
  if (year < st[0].from) return st[0].team;
  const before = [...st].reverse().find((s) => s.to < year);
  return before ? (before === st[st.length - 1] ? fallback ?? before.team : before.team) : fallback;
};

const yearOf = (s?: string) => {
  const m = /Y(\d+)/.exec(s ?? '');
  return m ? Number(m[1]) : null;
};

const POY = (p: Player) => (p.position === 'LB' || p.position === 'DB' || p.position === 'DL' ? 'dpoy' : 'opoy');

export const buildCareer = ({
  player,
  league,
  stints,
  superBowls,
  records,
  hof,
  save,
}: {
  player: Player;
  league: LeagueSeasons;
  stints?: PlayerStints;
  superBowls: SuperBowlEntry[];
  records: ClubRecordRow[];
  hof: HallOfFameData | null;
  save: SaveState | null;
}): Career | null => {
  const key = `${player.position}:${player.name}`;
  const points = league.byKey.get(key);
  if (!points?.length) return null;
  const retired = player.status === 'Retired';
  const lastPlayed = Math.max(...points.filter((p) => p.games > 0 || p.status === 'first').map((p) => p.year), points[0].year);
  const clubs = points.map((p) => {
    if (p.year > lastPlayed && retired) return null;
    if (p.status === 'idle' && retired) return null;
    return clubAt(stints, p.year, player.team && player.team !== 'FA' ? player.team : null);
  });
  const events: CareerEvent[] = [];
  const poy = POY(player);
  points.forEach((p, i) => {
    const a = p.awards;
    if (a) {
      const sb = superBowls.find((s) => s.year === p.year);
      for (let r = 0; r < (a.rings ?? 0); r++)
        events.push({ year: p.year, kind: 'ring', label: sb ? `Super Bowl ${sb.roman}` : 'Super Bowl ring', detail: sb ? `${sb.winner} ${sb.score} over the ${sb.loser}` : undefined });
      if (a.mvp) events.push({ year: p.year, kind: 'mvp', label: a.mvp > 1 ? `${a.mvp}× MVP` : 'MVP' });
      if (a[poy]) events.push({ year: p.year, kind: 'poy', label: poy === 'dpoy' ? 'Defensive Player of the Year' : 'Offensive Player of the Year' });
      if (a.sbmvp) events.push({ year: p.year, kind: 'sbmvp', label: 'Super Bowl MVP' });
    }
    const c = clubs[i];
    const pc = i > 0 ? clubs[i - 1] : null;
    if (c && pc && c !== pc) events.push({ year: p.year, kind: 'club', label: `Joins the ${c}`, detail: `From the ${pc}` });
  });
  const first = points[0].year;
  const seen = new Set<string>();
  records.forEach((r) => {
    if (r.scope === 'other') return;
    const y = yearOf(r.club.year);
    if (r.club.name === player.name && y != null && y >= first) {
      const id = `${r.short}:${y}`;
      if (!seen.has(id)) {
        seen.add(id);
        events.push({ year: y, kind: 'record', label: r.short, detail: `Club record ${r.club.mark}` });
      }
    }
    const top = r.league?.top?.[0];
    const ly = yearOf(top?.season);
    if (top && ly != null && ly >= first && (top.name === player.name || entryName(top) === player.name)) {
      const id = `${r.short}:${ly}`;
      if (!seen.has(id)) {
        seen.add(id);
        events.push({ year: ly, kind: 'record', label: r.short, detail: `League record ${top.mark}` });
      }
    }
  });
  const member = hof?.members.find((m) => m.key === key);
  const cls = yearOf(member?.classSeason);
  if (member) events.push({ year: cls ?? points[points.length - 1].year, kind: 'hof', label: 'Hall of Fame', detail: /class/i.test(member.class) ? member.class : `Class of ${member.class}` });

  let live: LiveOutlook | null = null;
  const sv = save?.players[key];
  if (sv && save && !retired) {
    const now = Object.fromEntries(RATINGS.map((r) => [r, sv[r]])) as Record<Rating, number>;
    const max = Object.fromEntries(RATINGS.map((r) => [r, Math.max(sv[r], sv[`max_${r}` as const])])) as Record<Rating, number>;
    const left = seasonsLeft(player.position, sv.age, sv.delay_retirement || 0);
    live = { season: save.season, age: sv.age, finalSeason: save.season + left, starsNow: halfStars(player.position, now), starsMax: halfStars(player.position, max) };
    const at = points[points.length - 1].year;
    if (live.starsMax > live.starsNow) events.push({ year: at, kind: 'ceiling', label: `Stars ${live.starsNow / 2} → ${live.starsMax / 2}`, detail: 'Ratings now → ceiling (live save)' });
    if (live.finalSeason <= at) events.push({ year: at, kind: 'final', label: 'Final season', detail: `Age ${sv.age}: the game retires him after this season` });
  }
  events.sort((a, b) => a.year - b.year);
  return {
    key,
    points,
    clubs,
    events,
    prime: primeWindow(player.position, points),
    live,
    hasSeasons: points.some((p) => p.box),
  };
};
