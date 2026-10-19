import { findNFLTeam } from '@/utils/nflTeams';
import type { LeagueContent, LeagueEra, SuperBowlEntry } from '@/utils/leagueContent';

export const NEUTRAL_HSL = '220 10% 40%';

export const teamHsl = (team?: string | null) => findNFLTeam(team ?? undefined)?.primaryColor ?? null;

export interface YearSlot {
  year: number;
  sb: SuperBowlEntry | null;
  /** Your team that year when you reached the Super Bowl. */
  team: string | null;
  color: string | null;
}

export interface PlacedEra {
  era: LeagueEra;
  lane: number;
  /** Chronological index, used for keyboard nav. */
  index: number;
  /** CSS background for the band: hard-stop gradient of your teams across its years. */
  background: string;
  dominantTeam: string | null;
  record: { won: number; lost: number };
}

export interface Gap {
  startYear: number;
  endYear: number;
}

export interface TimelineModel {
  firstYear: number;
  lastYear: number;
  years: YearSlot[];
  eras: PlacedEra[];
  laneCount: number;
  gaps: Gap[];
  stats: {
    titles: number;
    appearances: number;
    losses: number;
    missed: number;
    longestTitleStreak: { length: number; start: number; end: number };
    longestAppearanceStreak: { length: number; start: number; end: number; won: number; lost: number };
  };
}

const longestRun = (slots: YearSlot[], pred: (s: YearSlot) => boolean) => {
  let best = { length: 0, start: 0, end: 0 };
  let start = -1;
  slots.forEach((s, i) => {
    if (pred(s)) {
      if (start < 0) start = i;
      const len = i - start + 1;
      if (len > best.length) best = { length: len, start: slots[start].year, end: s.year };
    } else start = -1;
  });
  return best;
};

export const buildTimelineModel = (content: LeagueContent): TimelineModel => {
  const sbByYear = new Map(content.superBowls.map((sb) => [sb.year, sb]));
  const maxEraYear = Math.max(0, ...content.eras.map((e) => e.endYear));
  const maxSbYear = Math.max(0, ...content.superBowls.map((s) => s.year));
  const seasonYear = parseInt((content.season ?? '').replace(/\D/g, ''), 10) || 0;
  const firstYear = Math.min(1, ...content.eras.map((e) => e.startYear), ...content.superBowls.map((s) => s.year));
  const lastYear = Math.max(maxEraYear, maxSbYear, seasonYear, firstYear);

  const years: YearSlot[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const sb = sbByYear.get(y) ?? null;
    const team = sb && (sb.yourResult === 'won' || sb.yourResult === 'lost') ? sb.yourTeam : null;
    years.push({ year: y, sb, team, color: teamHsl(team) });
  }
  const slot = (y: number) => years[y - firstYear];

  // Greedy lane packing: an era goes in the first lane whose last era ended before it starts.
  const sorted = [...content.eras].sort((a, b) => a.startYear - b.startYear || b.endYear - a.endYear);
  const laneEnds: number[] = [];
  const eras: PlacedEra[] = sorted.map((era, index) => {
    let lane = laneEnds.findIndex((end) => end < era.startYear);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(era.endYear);
    } else laneEnds[lane] = era.endYear;

    // Per-year colors inside the era, gaps filled from nearest known neighbour.
    const fallbackTeam = era.yourTeams[0] ?? null;
    const raw = [];
    for (let y = era.startYear; y <= era.endYear; y++) raw.push(slot(y)?.color ?? null);
    const filled = raw.map((c, i) => {
      if (c) return c;
      for (let d = 1; d < raw.length; d++) {
        if (raw[i - d]) return raw[i - d];
        if (raw[i + d]) return raw[i + d];
      }
      return teamHsl(fallbackTeam) ?? NEUTRAL_HSL;
    });
    const n = filled.length;
    const stops: string[] = [];
    filled.forEach((c, i) => {
      const a = ((i / n) * 100).toFixed(2);
      const b = (((i + 1) / n) * 100).toFixed(2);
      stops.push(`hsl(${c} / 0.9) ${a}%`, `hsl(${c} / 0.9) ${b}%`);
    });
    const background = n > 1 ? `linear-gradient(90deg, ${stops.join(', ')})` : `hsl(${filled[0]} / 0.9)`;

    const counts = new Map<string, number>();
    let won = 0;
    let lost = 0;
    for (let y = era.startYear; y <= era.endYear; y++) {
      const s = slot(y)?.sb;
      if (!s) continue;
      if (s.yourResult === 'won') {
        won++;
        if (s.yourTeam) counts.set(s.yourTeam, (counts.get(s.yourTeam) ?? 0) + 1);
      } else if (s.yourResult === 'lost') lost++;
    }
    const dominantTeam = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallbackTeam;

    return { era, lane, index, background, dominantTeam, record: { won, lost } };
  });

  const gaps: Gap[] = [];
  let gapStart: number | null = null;
  for (let y = firstYear; y <= lastYear; y++) {
    const covered = content.eras.some((e) => y >= e.startYear && y <= e.endYear);
    if (!covered && gapStart === null) gapStart = y;
    if ((covered || y === lastYear) && gapStart !== null) {
      gaps.push({ startYear: gapStart, endYear: covered ? y - 1 : y });
      gapStart = null;
    }
  }

  const isApp = (s: YearSlot) => s.sb?.yourResult === 'won' || s.sb?.yourResult === 'lost';
  const app = longestRun(years, isApp);
  const appSlots = years.filter((s) => s.year >= app.start && s.year <= app.end);

  return {
    firstYear,
    lastYear,
    years,
    eras,
    laneCount: Math.max(1, laneEnds.length),
    gaps: content.eras.length ? gaps : [],
    stats: {
      titles: years.filter((s) => s.sb?.yourResult === 'won').length,
      losses: years.filter((s) => s.sb?.yourResult === 'lost').length,
      appearances: years.filter(isApp).length,
      missed: years.filter((s) => s.sb?.yourResult === 'not in it').length,
      longestTitleStreak: longestRun(years, (s) => s.sb?.yourResult === 'won'),
      longestAppearanceStreak: {
        ...app,
        won: appSlots.filter((s) => s.sb?.yourResult === 'won').length,
        lost: appSlots.filter((s) => s.sb?.yourResult === 'lost').length,
      },
    },
  };
};

export const describeSuperBowl = (slot: YearSlot, season?: string): string => {
  const { sb, year } = slot;
  if (!sb) {
    const current = season && parseInt(season.replace(/\D/g, ''), 10) === year;
    return `Y${year}: ${current ? 'season in progress, Super Bowl not yet played' : 'no Super Bowl on record'}`;
  }
  const head = `Y${year}, Super Bowl ${sb.roman || sb.number}`;
  const score = sb.score?.replace('-', '–');
  switch (sb.yourResult) {
    case 'won':
      return `${head}: won ${score ?? ''} as the ${sb.yourTeam ?? 'your team'} over the ${sb.loser ?? 'opponent'}`.replace('  ', ' ');
    case 'lost':
      return `${head}: lost ${score ?? ''} as the ${sb.yourTeam ?? 'your team'} to the ${sb.winner ?? 'opponent'}`.replace('  ', ' ');
    case 'not captured':
      return `${head}: result not captured`;
    default:
      return `${head}: not in it. ${sb.winner ?? 'Unknown'} beat ${sb.loser ?? 'unknown'}${score ? ` ${score}` : ''}`;
  }
};

/** Era containing the year; the most specific (latest-starting) one when eras overlap. */
export const eraForYear = (model: TimelineModel, year: number) =>
  [...model.eras]
    .filter((p) => year >= p.era.startYear && year <= p.era.endYear)
    .sort((a, b) => b.era.startYear - a.era.startYear)[0] ?? null;
