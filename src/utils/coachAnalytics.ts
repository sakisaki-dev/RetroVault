/**
 * Coaching Analytics for the Front Office, computed from coach.seasons (the staff screen history) plus the
 * staff screen's regular/playoff record. Pure and React-free.
 */
import { gradeFor, percentileOf, type GradeStep } from '@/config/skillGrades';
import type { CoachInfo } from '@/utils/leagueContent';
import { findNFLTeam } from '@/utils/nflTeams';
import { FINISH_ORDER, seasonStreak, winPct, type FinishKind, type SeasonRow, type Stint, type Streak } from '@/utils/frontOffice';

export const ROLLING_WINDOW = 5;

export interface RollingPoint {
  year: number;
  /** Trailing ROLLING_WINDOW-season regular-season win % (null until the window is full) */
  pct: number | null;
  row: SeasonRow;
}

export interface StintReport {
  stint: Stint;
  seasons: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  titles: number;
  titlesPerSeason: number;
  playoffTrips: number;
  /** Season number at this stop of the first title (1 = won it all in year 1), null if none */
  firstTitleIn: number | null;
  percentile: number;
  grade: GradeStep;
  rank: number;
}

export interface ConferenceSplit {
  conf: 'AFC' | 'NFC';
  seasons: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  titles: number;
  teams: string[];
}

export interface CoachAnalytics {
  rolling: RollingPoint[];
  stints: StintReport[];
  finishes: { kind: FinishKind; count: number }[];
  playoffTrips: number;
  titles: number;
  seasons: number;
  rebuild: { bucket: string; count: number }[];
  yearOneTitles: number;
  avgToFirstTitle: number | null;
  stintsWithTitle: number;
  conferences: ConferenceSplit[];
  titleStreak: Streak;
  drought: Streak;
  perfect: number;
  bestDecade: { start: number; end: number; titles: number; w: number; l: number; t: number; pct: number } | null;
  regular: { w: number; l: number; t: number; pct: number };
  playoff: { w: number; l: number; pct: number } | null;
  /** Playoff win % minus regular-season win % */
  clutch: number | null;
}

const parseRecord = (r?: string) => {
  const m = r?.match(/^(\d+)-(\d+)(?:-(\d+))?$/);
  return m ? { w: Number(m[1]), l: Number(m[2]), t: Number(m[3] ?? 0) } : null;
};

const sum = (rows: SeasonRow[]) => {
  const w = rows.reduce((n, r) => n + r.w, 0);
  const l = rows.reduce((n, r) => n + r.l, 0);
  const t = rows.reduce((n, r) => n + r.t, 0);
  return { w, l, t, pct: winPct(w, l, t) };
};

export const buildCoachAnalytics = (rows: SeasonRow[], stints: Stint[], coach?: CoachInfo): CoachAnalytics | null => {
  if (!rows.length) return null;

  const rolling: RollingPoint[] = rows.map((row, i) => {
    const win = rows.slice(Math.max(0, i - ROLLING_WINDOW + 1), i + 1);
    const full = win.length === ROLLING_WINDOW && win[0].year === row.year - ROLLING_WINDOW + 1;
    return { year: row.year, pct: full ? sum(win).pct : null, row };
  });

  const real = stints.filter((s) => s.seasons?.length && s.record);
  const pcts = real.map((s) => s.record!.pct).sort((a, b) => a - b);
  const reports: StintReport[] = real.map((s) => {
    const rs = s.seasons!;
    const first = rs.findIndex((r) => r.kind === 'champions');
    const percentile = percentileOf(pcts, s.record!.pct);
    return {
      stint: s,
      seasons: rs.length,
      w: s.record!.w,
      l: s.record!.l,
      t: s.record!.t,
      pct: s.record!.pct,
      titles: s.record!.titles,
      titlesPerSeason: s.record!.titles / rs.length,
      playoffTrips: rs.filter((r) => r.kind !== 'missed').length,
      firstTitleIn: first >= 0 ? first + 1 : null,
      percentile,
      grade: gradeFor(percentile)!,
      rank: 0,
    };
  });
  [...reports]
    .sort((a, b) => b.pct - a.pct || b.titles - a.titles || a.stint.firstYear - b.stint.firstYear)
    .forEach((r, i) => (r.rank = i + 1));

  const finishes = FINISH_ORDER.map((kind) => ({ kind, count: rows.filter((r) => r.kind === kind).length }));
  const titles = finishes[0].count;

  const firsts = reports.map((r) => r.firstTitleIn);
  const won = firsts.filter((n): n is number => n != null);
  const maxBucket = Math.max(3, ...won);
  const rebuild = [
    ...Array.from({ length: Math.min(maxBucket, 4) }, (_, i) => ({
      bucket: i === 3 && maxBucket > 4 ? 'Year 4+' : `Year ${i + 1}`,
      count: won.filter((n) => (i === 3 && maxBucket > 4 ? n >= 4 : n === i + 1)).length,
    })),
    { bucket: 'Never', count: firsts.length - won.length },
  ];

  const conferences = (['AFC', 'NFC'] as const).map((conf) => {
    const rs = rows.filter((r) => (findNFLTeam(r.team) ?? findNFLTeam(r.abbr))?.conference === conf);
    const teams = [...new Set(rs.map((r) => r.abbr ?? r.team))];
    return { conf, seasons: rs.length, ...sum(rs), titles: rs.filter((r) => r.kind === 'champions').length, teams };
  });

  let bestDecade: CoachAnalytics['bestDecade'] = null;
  for (let i = 0; i + 10 <= rows.length; i++) {
    const win = rows.slice(i, i + 10);
    if (win[9].year - win[0].year !== 9) continue;
    const s = sum(win);
    const t = win.filter((r) => r.kind === 'champions').length;
    if (!bestDecade || t > bestDecade.titles || (t === bestDecade.titles && s.pct > bestDecade.pct)) {
      bestDecade = { start: win[0].year, end: win[9].year, titles: t, w: s.w, l: s.l, t: s.t, pct: s.pct };
    }
  }

  const regRaw = parseRecord(coach?.record?.regular);
  const regular = regRaw ? { ...regRaw, pct: coach?.record?.regularWinPct ?? winPct(regRaw.w, regRaw.l, regRaw.t) } : sum(rows);
  const poRaw = parseRecord(coach?.record?.playoff);
  const playoff = poRaw ? { w: poRaw.w, l: poRaw.l, pct: coach?.record?.playoffWinPct ?? winPct(poRaw.w, poRaw.l) } : null;

  return {
    rolling,
    stints: reports,
    finishes,
    playoffTrips: rows.filter((r) => r.kind !== 'missed').length,
    titles,
    seasons: rows.length,
    rebuild,
    yearOneTitles: won.filter((n) => n === 1).length,
    avgToFirstTitle: won.length ? won.reduce((a, b) => a + b, 0) / won.length : null,
    stintsWithTitle: won.length,
    conferences,
    titleStreak: seasonStreak(rows, (r) => r.kind === 'champions'),
    drought: seasonStreak(rows, (r) => r.kind !== 'champions'),
    perfect: rows.filter((r) => r.l === 0 && r.t === 0 && r.w >= 17).length,
    bestDecade,
    regular,
    playoff,
    clutch: playoff ? playoff.pct - regular.pct : null,
  };
};
