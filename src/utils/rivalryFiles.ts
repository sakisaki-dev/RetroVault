import type { LeagueContent } from './leagueContent';

/**
 * Rivalry files (scripts/build_league_content.py build_rivalry_files → content.json `rivalryFiles`): one file per
 * lasting rivalry in the weekly scores, all rules. A lasting rivalry is a club the coach has met at least 6 times,
 * twice or more in at least 3 seasons, with a meeting in the latest completed season or the one before it (owner:
 * "often rivals don't stay for long but if they do we can keep the story"). A file whose rivalry has lapsed (no meeting
 * in the last two completed seasons) stays, with status "lapsed", under Past rivalries.
 *
 * openRivalryFile(id) opens one from anywhere (the Timeline row, the Front Office rivals, a story, a rewind card);
 * RivalryHost (mounted once in pages/Index.tsx) answers with the file as a phone sheet.
 */

export interface RivalryMeetingRow {
  season: string;
  week: number;
  round: string;
  site: 'home' | 'away' | string;
  /** The coach's club that day */
  coachTeam: string;
  /** The coach's club's score */
  for: number;
  against: number;
  result: 'W' | 'L' | 'T';
  playoff?: boolean;
  /** The series' biggest margin */
  biggest?: boolean;
}

export interface RivalryStar {
  key: string;
  name: string;
  pos: string;
  team: string;
  legacy: number;
}

/** One "story so far" line: bold leads (with a tone) and plain text */
export type RivalryPart = { b: string; tone?: 'coach' | 'rival' | 'gold' } | { t: string };

export interface RivalryPaper {
  type: 'story' | 'take';
  id: string;
  season: string;
  headline: string;
  kind?: string;
  heat?: number;
}

export interface RivalryFile {
  id: string;
  /** The rival club */
  team: string;
  /** The coach's club in the latest meeting */
  coachTeam: string;
  status: 'lasting' | 'lapsed';
  conference?: string;
  division?: string;
  first: string;
  last: string;
  seasons: number;
  games: number;
  record: { w: number; l: number; t: number; text: string };
  pointsFor: number;
  pointsAgainst: number;
  streak: { team: string; side: 'coach' | 'rival'; games: number; from: { season: string; week: number } | null; to: { season: string; week: number } | null };
  biggest: { season: string; week: number; for: number; against: number; winner: string };
  stars: { coach?: RivalryStar; rival?: RivalryStar };
  meetings: RivalryMeetingRow[];
  story: RivalryPart[][];
  papers: RivalryPaper[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const star = (v: unknown): RivalryStar | undefined =>
  isObj(v) && str(v.key) && str(v.name) ? { key: str(v.key), name: str(v.name), pos: str(v.pos), team: str(v.team), legacy: num(v.legacy) } : undefined;

/** content.json's rivalryFiles, checked field by field (a malformed file is dropped, never half-drawn) */
export const rivalryFilesOf = (content: LeagueContent | null | undefined): RivalryFile[] => {
  const raw = (content as unknown as { rivalryFiles?: unknown } | null)?.rivalryFiles;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): RivalryFile[] => {
    if (!isObj(r) || !str(r.id) || !str(r.team) || !str(r.coachTeam) || !Array.isArray(r.meetings) || !isObj(r.record)) return [];
    const meetings = r.meetings.filter(isObj).map(
      (m): RivalryMeetingRow => ({
        season: str(m.season),
        week: num(m.week),
        round: str(m.round),
        site: str(m.site),
        coachTeam: str(m.coachTeam),
        for: num(m.for),
        against: num(m.against),
        result: m.result === 'W' || m.result === 'L' ? m.result : 'T',
        playoff: m.playoff === true || undefined,
        biggest: m.biggest === true || undefined,
      }),
    );
    if (!meetings.length) return [];
    const rec = r.record;
    const stk = isObj(r.streak) ? r.streak : {};
    const at = (v: unknown) => (isObj(v) && str(v.season) ? { season: str(v.season), week: num(v.week) } : null);
    const big = isObj(r.biggest) ? r.biggest : {};
    const stars = isObj(r.stars) ? r.stars : {};
    return [
      {
        id: str(r.id),
        team: str(r.team),
        coachTeam: str(r.coachTeam),
        status: r.status === 'lapsed' ? 'lapsed' : 'lasting',
        conference: str(r.conference) || undefined,
        division: str(r.division) || undefined,
        first: str(r.first),
        last: str(r.last),
        seasons: num(r.seasons),
        games: num(r.games) || meetings.length,
        record: { w: num(rec.w), l: num(rec.l), t: num(rec.t), text: str(rec.text) },
        pointsFor: num(r.pointsFor),
        pointsAgainst: num(r.pointsAgainst),
        streak: { team: str(stk.team), side: stk.side === 'rival' ? 'rival' : 'coach', games: num(stk.games), from: at(stk.from), to: at(stk.to) },
        biggest: { season: str(big.season), week: num(big.week), for: num(big.for), against: num(big.against), winner: str(big.winner) },
        stars: { coach: star(stars.coach), rival: star(stars.rival) },
        meetings,
        story: (Array.isArray(r.story) ? r.story : []).filter(Array.isArray).map((line) =>
          (line as unknown[]).filter(isObj).flatMap((p): RivalryPart[] =>
            typeof p.b === 'string' ? [{ b: p.b, tone: p.tone === 'coach' || p.tone === 'rival' || p.tone === 'gold' ? p.tone : undefined }] : typeof p.t === 'string' ? [{ t: p.t }] : [],
          ),
        ),
        papers: (Array.isArray(r.papers) ? r.papers : []).filter(isObj).flatMap((p): RivalryPaper[] =>
          (p.type === 'story' || p.type === 'take') && str(p.id) && str(p.headline)
            ? [{ type: p.type, id: str(p.id), season: str(p.season), headline: str(p.headline), kind: str(p.kind) || undefined, heat: num(p.heat) || undefined }]
            : [],
        ),
      },
    ];
  });
};

/** The file of a rival club ("Cowboys"), if the rivalry has one */
export const rivalryFileFor = (files: RivalryFile[], team: string | null | undefined) => (team ? files.find((f) => f.team === team) : undefined);

export const OPEN_RIVALRY_EVENT = 'rv:open-rivalry';
let pending: string | null = null;

/** Open a rivalry file ("rivalry-cowboys") from anywhere; RivalryHost answers (a request made before it mounts waits) */
export const openRivalryFile = (id: string) => {
  pending = id;
  window.dispatchEvent(new CustomEvent(OPEN_RIVALRY_EVENT, { detail: id }));
};

/** The request made before the host mounted (read once) */
export const takePendingRivalry = (): string | null => {
  const id = pending;
  pending = null;
  return id;
};

/** Warm the sheet's code (hover or focus on a file) so the tap opens it at once */
export const prefetchRivalryFile = () => {
  void import('@/components/rivalry/RivalryFileSheet');
};

/** "Y90 week 17", "Y93 conference round" */
export const meetingLabel = (m: Pick<RivalryMeetingRow, 'season' | 'week' | 'round'>) =>
  /^Week/.test(m.round || 'Week') ? `${m.season} week ${m.week}` : `${m.season} ${m.round === 'Super Bowl' ? 'Super Bowl' : `${m.round.toLowerCase()} round`}`;
