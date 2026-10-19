/**
 * "The Front Office": the user's career as coach/GM of the league, derived from league content
 * (Super Bowl history, eras, rivalries) plus the player list and the Arcade's per-browser bests.
 * Everything here is computed; nothing about the record is hardcoded.
 */
import { HOF_THRESHOLD, isHallOfFamer } from '@/config/stats';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import {
  matchPlayerByName,
  type LeagueContent,
  type LeagueEra,
  type Rivalry,
  type SuperBowlEntry,
} from '@/utils/leagueContent';

/** Key players shown per stint in the ledger (the rest are listed by name). */
export const FEATURED_PER_STINT = 2;

export const COACH_NAME_KEY = 'retroVault:coachName';
export const DEFAULT_COACH_NAME = 'Head Coach';

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

/** A Super Bowl the user played in, with the score split from the user's side. */
export interface YourGame {
  sb: SuperBowlEntry;
  year: number;
  roman: string;
  team: string;
  opponent: string | null;
  won: boolean;
  /** Points for / against (null when the score is missing or unreadable) */
  pf: number | null;
  pa: number | null;
  margin: number | null;
}

const parseScore = (score: string | null): [number, number] | null => {
  const m = score?.match(/(\d+)\s*[-–—]\s*(\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
};

/** "54-6" style score from the user's side ("29–23"). */
export const yourScore = (g: YourGame) => (g.pf != null && g.pa != null ? `${g.pf}–${g.pa}` : g.sb.score ?? '—');

export const yourGames = (superBowls: SuperBowlEntry[]): YourGame[] =>
  superBowls
    .filter((sb) => sb.yourTeam && (sb.yourResult === 'won' || sb.yourResult === 'lost'))
    .sort((a, b) => a.year - b.year)
    .map((sb) => {
      const won = sb.yourResult === 'won';
      const s = parseScore(sb.score);
      // Scores are written winner-first.
      const pf = s ? (won ? Math.max(...s) : Math.min(...s)) : null;
      const pa = s ? (won ? Math.min(...s) : Math.max(...s)) : null;
      return {
        sb,
        year: sb.year,
        roman: sb.roman,
        team: sb.yourTeam!,
        opponent: (won ? sb.loser : sb.winner) ?? null,
        won,
        pf,
        pa,
        margin: pf != null && pa != null ? pf - pa : null,
      };
    });

export interface Streak {
  length: number;
  start: number | null;
  end: number | null;
}

/**
 * Longest run of consecutive seasons matching `test`. Seasons missing from the list (or "not captured")
 * break a streak, so streaks are never inflated by gaps in the data.
 */
export const longestStreak = (superBowls: SuperBowlEntry[], test: (sb: SuperBowlEntry) => boolean): Streak => {
  const sorted = [...superBowls].sort((a, b) => a.year - b.year);
  let best: Streak = { length: 0, start: null, end: null };
  let cur = 0;
  let start = 0;
  let prevYear: number | null = null;
  for (const sb of sorted) {
    const ok = test(sb);
    if (ok && cur > 0 && prevYear !== null && sb.year === prevYear + 1) cur++;
    else if (ok) {
      cur = 1;
      start = sb.year;
    } else cur = 0;
    prevYear = sb.year;
    if (cur > best.length) best = { length: cur, start, end: sb.year };
  }
  return best;
};

/** First season in which a running streak reached `n` (for "unlocked in" dates). */
const firstStreakReaching = (superBowls: SuperBowlEntry[], test: (sb: SuperBowlEntry) => boolean, n: number) => {
  const sorted = [...superBowls].sort((a, b) => a.year - b.year);
  let cur = 0;
  let prevYear: number | null = null;
  for (const sb of sorted) {
    if (test(sb)) cur = cur > 0 && prevYear !== null && sb.year === prevYear + 1 ? cur + 1 : 1;
    else cur = 0;
    prevYear = sb.year;
    if (cur >= n) return sb;
  }
  return null;
};

/** "Tampa Bay Buccaneers" and "Buccaneers" are the same franchise. */
export const sameTeam = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = findNFLTeam(a);
  return !!ta && ta.id === findNFLTeam(b)?.id;
};

export const parseSeason = (season?: string | null): number | null => {
  const m = season?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

export interface Resume {
  games: YourGame[];
  wins: number;
  losses: number;
  appearances: number;
  winPct: number;
  titleStreak: Streak;
  appearanceStreak: Streak;
  franchises: string[];
  titleFranchises: string[];
  currentClub: string | null;
  season: number | null;
  firstYear: number | null;
}

const isWin = (sb: SuperBowlEntry) => sb.yourResult === 'won';
const isAppearance = (sb: SuperBowlEntry) => sb.yourResult === 'won' || sb.yourResult === 'lost';

export const buildResume = (content: LeagueContent): Resume => {
  const games = yourGames(content.superBowls);
  const wins = games.filter((g) => g.won).length;
  const franchises: string[] = [];
  games.forEach((g) => !franchises.includes(g.team) && franchises.push(g.team));
  const titleFranchises: string[] = [];
  games.forEach((g) => g.won && !titleFranchises.includes(g.team) && titleFranchises.push(g.team));
  // Current club: the last team named in the latest era, else the last Super Bowl team.
  const lastEra = [...content.eras].sort((a, b) => a.endYear - b.endYear).at(-1);
  const currentClub = lastEra?.yourTeams.at(-1) ?? games.at(-1)?.team ?? null;
  const lastYear = content.superBowls.reduce((m, sb) => Math.max(m, sb.year), 0);
  return {
    games,
    wins,
    losses: games.length - wins,
    appearances: games.length,
    winPct: games.length ? wins / games.length : 0,
    titleStreak: longestStreak(content.superBowls, isWin),
    appearanceStreak: longestStreak(content.superBowls, isAppearance),
    franchises,
    titleFranchises,
    currentClub,
    season: parseSeason(content.season) ?? (lastYear || null),
    firstYear: content.superBowls.length ? Math.min(...content.superBowls.map((s) => s.year)) : null,
  };
};

// ---------------------------------------------------------------------------
// Franchise stints
// ---------------------------------------------------------------------------

export interface Stint {
  id: string;
  team: string;
  games: YourGame[];
  firstYear: number;
  lastYear: number;
  /** True for the latest stint at the current club (runs through the current season) */
  current: boolean;
  wins: number;
  losses: number;
  eras: LeagueEra[];
  keyPlayers: { raw: string; display: string; player?: Player }[];
}

/**
 * Consecutive Super Bowl appearances with the same team form one stint. Stint years are the span of
 * those appearances (the save doesn't record exact hire/fire dates); the current club's stint runs to
 * the current season. Eras attach when they list the team and overlap the stint.
 */
export const buildStints = (content: LeagueContent, resume: Resume, players: Player[]): Stint[] => {
  const stints: Stint[] = [];
  for (const g of resume.games) {
    const last = stints.at(-1);
    if (last && last.team === g.team) {
      last.games.push(g);
      last.lastYear = g.year;
    } else {
      stints.push({
        id: `${g.team}-${g.year}`.toLowerCase(),
        team: g.team,
        games: [g],
        firstYear: g.year,
        lastYear: g.year,
        current: false,
        wins: 0,
        losses: 0,
        eras: [],
        keyPlayers: [],
      });
    }
  }
  const tail = stints.at(-1);
  if (tail && resume.currentClub && tail.team === resume.currentClub) {
    tail.current = true;
    if (resume.season && resume.season > tail.lastYear) tail.lastYear = resume.season;
  }
  const featured = new Map<string, number>();
  for (const s of stints) {
    s.wins = s.games.filter((g) => g.won).length;
    s.losses = s.games.length - s.wins;
    s.eras = content.eras.filter(
      (e) => e.yourTeams.includes(s.team) && e.startYear <= s.lastYear && e.endYear >= s.firstYear,
    );
    if (!s.eras.length) s.eras = content.eras.filter((e) => e.startYear <= s.firstYear && e.endYear >= s.firstYear);
    const seen = new Set<string>();
    const kp = s.eras
      .flatMap((e) => e.keyPlayers)
      .map((raw) => ({ raw, display: raw.replace(/\s*\(.+?\)\s*/g, ' ').trim(), player: matchPlayerByName(raw, players) }))
      .filter((k) => {
        const key = k.player ? `${k.player.position}:${k.player.name}` : k.display;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const keyOf = (k: (typeof kp)[number]) => (k.player ? `${k.player.position}:${k.player.name}` : k.display);
    // Spread an era's names across its stints: players who finished with this franchise first, then
    // names not yet featured on an earlier stint, then the rest in the era's own order.
    const order = new Map(kp.map((k, i) => [k, i]));
    kp.sort(
      (a, b) =>
        Number(sameTeam(b.player?.team, s.team)) - Number(sameTeam(a.player?.team, s.team)) ||
        (featured.get(keyOf(a)) ?? 0) - (featured.get(keyOf(b)) ?? 0) ||
        order.get(a)! - order.get(b)!,
    );
    kp.slice(0, FEATURED_PER_STINT).forEach((k) => featured.set(keyOf(k), (featured.get(keyOf(k)) ?? 0) + 1));
    s.keyPlayers = kp;
  }
  return stints;
};

/** Unique franchises in order of first Super Bowl, with every game for the trophy cabinet. */
export const buildCabinet = (resume: Resume) =>
  resume.franchises.map((team) => {
    const games = resume.games.filter((g) => g.team === team);
    return { team, games, wins: games.filter((g) => g.won).length, losses: games.filter((g) => !g.won).length };
  });

// ---------------------------------------------------------------------------
// Rivals
// ---------------------------------------------------------------------------

export interface Nemesis {
  team: string;
  /** Your Super Bowl games against this team */
  games: YourGame[];
  wins: number;
  losses: number;
}

/** Every team that beat you in a Super Bowl, with your full head-to-head against them. */
export const buildNemeses = (resume: Resume): Nemesis[] => {
  const beaters = [...new Set(resume.games.filter((g) => !g.won && g.opponent).map((g) => g.opponent!))];
  return beaters
    .map((team) => {
      const games = resume.games.filter((g) => g.opponent === team);
      const wins = games.filter((g) => g.won).length;
      return { team, games, wins, losses: games.length - wins };
    })
    .sort((a, b) => b.losses - a.losses || a.games[0].year - b.games[0].year);
};

/** Head-to-head games for a featured rivalry: its listed meetings, else every game against its team. */
export const rivalryGames = (rivalry: Rivalry, resume: Resume): YourGame[] => {
  const byTeam = rivalry.team ? resume.games.filter((g) => g.opponent === rivalry.team) : [];
  if (byTeam.length) return byTeam;
  const years = new Set(rivalry.meetings.map((m) => m.year).filter((y): y is number => y != null));
  return resume.games.filter((g) => years.has(g.year));
};

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export type AchievementGroup = 'Dynasty' | 'Big game' | 'Roster' | 'Arcade';

export interface Achievement {
  id: string;
  group: AchievementGroup;
  icon: 'crown' | 'flame' | 'tv' | 'building' | 'trophy' | 'hammer' | 'timer' | 'swords' | 'rebound' | 'shield' | 'ring' | 'hall' | 'perfect' | 'grid' | 'arrows' | 'search';
  title: string;
  description: string;
  /** How the badge is computed */
  rule: string;
  unlocked: boolean;
  /** When it was unlocked, if known (e.g. "Y33 · Super Bowl XCII") */
  when?: string;
  /** Progress line for locked badges or extra detail for unlocked ones */
  detail?: string;
  /** 0..1 progress for locked badges */
  progress?: number;
}

const sbLabel = (g: { year: number; roman: string }) => `Y${g.year}${g.roman ? ` · Super Bowl ${g.roman}` : ''}`;

export interface ArcadeBests {
  perfectW: number;
  perfectL: number;
  gridBest: number;
  holBest: number;
  legendBest: number;
}

const readGameStat = (key: string, fallback: number) => {
  try {
    const v = localStorage.getItem(`retroVault:games:${key}`);
    if (v == null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};

/** Arcade bests from the same localStorage keys the games write (see games/gameUtils STAT_KEYS). */
export const readArcadeBests = (): ArcadeBests => ({
  perfectW: readGameStat('perfect:bestW', -1),
  perfectL: readGameStat('perfect:bestL', 0),
  gridBest: readGameStat('grid:best', 0),
  holBest: readGameStat('hol:best', 0),
  legendBest: readGameStat('legend:best', 0),
});

/**
 * Hall of Famers you coached: Hall of Fame legacy (careerLegacy ≥ HOF_THRESHOLD), at least one ring,
 * not a real-life legend, and either named as a key player in one of your eras or finishing their
 * career with a franchise you ran.
 */
export const coachedHallOfFamers = (content: LeagueContent, resume: Resume, players: Player[]): Player[] => {
  const named = new Set<Player>();
  content.eras.forEach((e) =>
    e.keyPlayers.forEach((raw) => {
      const p = matchPlayerByName(raw, players);
      if (p) named.add(p);
    }),
  );
  return players
    .filter(
      (p) =>
        !p.isRealLegend &&
        isHallOfFamer(p) &&
        p.rings > 0 &&
        (named.has(p) || resume.franchises.some((f) => sameTeam(p.team, f))),
    )
    .sort((a, b) => b.careerLegacy - a.careerLegacy);
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const buildAchievements = (
  content: LeagueContent,
  resume: Resume,
  players: Player[],
  arcade: ArcadeBests,
): Achievement[] => {
  const sbs = content.superBowls;
  const { games } = resume;
  const wins = games.filter((g) => g.won);

  const dynasty = firstStreakReaching(sbs, isWin, 3);
  const nine = firstStreakReaching(sbs, isWin, 9);
  const twenty = firstStreakReaching(sbs, isAppearance, 20);

  // 5th distinct title franchise
  const titleTeams: string[] = [];
  let fifthFranchise: YourGame | null = null;
  for (const g of wins) {
    if (!titleTeams.includes(g.team)) {
      titleTeams.push(g.team);
      if (titleTeams.length === 5) fifthFranchise = g;
    }
  }
  const fiftieth = wins[49] ?? null;
  const blowout = wins.find((g) => (g.margin ?? 0) >= 40) ?? null;
  const biggest = wins.reduce<YourGame | null>((m, g) => ((g.margin ?? -1) > (m?.margin ?? -1) ? g : m), null);
  const nail = wins.find((g) => g.margin === 1) ?? null;
  const closest = wins.reduce<YourGame | null>((m, g) => (g.margin != null && (m == null || g.margin < (m.margin ?? 99)) ? g : m), null);

  // Revenge: a win over a team that had beaten you in an earlier Super Bowl.
  let revenge: { game: YourGame; loss: YourGame } | null = null;
  for (const g of games) {
    if (!g.won || !g.opponent) continue;
    const loss = games.find((l) => !l.won && l.opponent === g.opponent && l.year < g.year);
    if (loss) {
      revenge = { game: g, loss };
      break;
    }
  }
  // Bounce back: title the season right after a Super Bowl loss.
  const bounce = games.find((g) => g.won && games.some((l) => !l.won && l.year === g.year - 1)) ?? null;

  // Spotless: unbeaten in 5+ Super Bowls with one franchise.
  const perTeam = buildCabinet(resume);
  const spotless = perTeam.filter((t) => t.losses === 0 && t.wins >= 5).sort((a, b) => b.wins - a.wins);
  const bestUnbeaten = perTeam.filter((t) => t.losses === 0).sort((a, b) => b.wins - a.wins)[0];

  const leaguePlayers = players.filter((p) => !p.isRealLegend);
  const ringLeaders = [...leaguePlayers].sort((a, b) => b.rings - a.rings);
  const tenRing = ringLeaders.filter((p) => p.rings >= 10);
  const hofs = coachedHallOfFamers(content, resume, players);

  const names = (ps: Player[], n = 3) =>
    ps.slice(0, n).map((p) => p.name).join(', ') + (ps.length > n ? ` +${ps.length - n} more` : '');

  const list: Achievement[] = [
    {
      id: 'dynasty',
      group: 'Dynasty',
      icon: 'crown',
      title: 'Dynasty',
      description: 'Win three straight Super Bowls.',
      rule: 'Three consecutive seasons with a Super Bowl win, with any franchises.',
      unlocked: !!dynasty,
      when: dynasty ? sbLabel(dynasty) : undefined,
      progress: clamp01(resume.titleStreak.length / 3),
      detail: dynasty ? undefined : `Best run: ${resume.titleStreak.length}`,
    },
    {
      id: 'nine',
      group: 'Dynasty',
      icon: 'flame',
      title: 'Nine in a row',
      description: 'Win nine straight Super Bowls.',
      rule: 'Nine consecutive seasons with a Super Bowl win; switching franchises mid-run still counts.',
      unlocked: !!nine,
      when: nine ? sbLabel(nine) : undefined,
      progress: clamp01(resume.titleStreak.length / 9),
      detail: `Longest run: ${resume.titleStreak.length}${resume.titleStreak.start != null ? ` (Y${resume.titleStreak.start}–${resume.titleStreak.end})` : ''}`,
    },
    {
      id: 'twenty',
      group: 'Dynasty',
      icon: 'tv',
      title: 'Twenty straight',
      description: 'Reach twenty straight Super Bowls.',
      rule: 'Twenty consecutive seasons playing in the Super Bowl, win or lose.',
      unlocked: !!twenty,
      when: twenty ? sbLabel(twenty) : undefined,
      progress: clamp01(resume.appearanceStreak.length / 20),
      detail: `Longest run: ${resume.appearanceStreak.length}${resume.appearanceStreak.start != null ? ` (Y${resume.appearanceStreak.start}–${resume.appearanceStreak.end})` : ''}`,
    },
    {
      id: 'five-franchises',
      group: 'Dynasty',
      icon: 'building',
      title: 'Franchise builder',
      description: 'Win a title with five or more franchises.',
      rule: 'Distinct franchises you won a Super Bowl with.',
      unlocked: !!fifthFranchise,
      when: fifthFranchise ? `${sbLabel(fifthFranchise)} (${fifthFranchise.team})` : undefined,
      progress: clamp01(resume.titleFranchises.length / 5),
      detail: `${resume.titleFranchises.length} title franchises`,
    },
    {
      id: 'fifty',
      group: 'Dynasty',
      icon: 'trophy',
      title: 'Half-century',
      description: 'Win fifty Super Bowls.',
      rule: 'Total Super Bowl wins across every franchise.',
      unlocked: !!fiftieth,
      when: fiftieth ? `${sbLabel(fiftieth)} (${fiftieth.team})` : undefined,
      progress: clamp01(wins.length / 50),
      detail: `${wins.length} titles`,
    },
    {
      id: 'blowout',
      group: 'Big game',
      icon: 'hammer',
      title: 'Blowout',
      description: 'Win a Super Bowl by 40 or more.',
      rule: 'Winning margin of 40+ points in a Super Bowl.',
      unlocked: !!blowout,
      when: blowout ? `${sbLabel(blowout)}, ${blowout.team} ${yourScore(blowout)} ${blowout.opponent ?? ''}`.trim() : undefined,
      progress: clamp01((biggest?.margin ?? 0) / 40),
      detail: biggest ? `Biggest: +${biggest.margin} (${yourScore(biggest)}, Y${biggest.year})` : undefined,
    },
    {
      id: 'nail',
      group: 'Big game',
      icon: 'timer',
      title: 'Nail-biter',
      description: 'Win a Super Bowl by a single point.',
      rule: 'Winning margin of exactly 1 point.',
      unlocked: !!nail,
      when: nail ? `${sbLabel(nail)}, ${nail.team} ${yourScore(nail)} ${nail.opponent ?? ''}`.trim() : undefined,
      progress: nail ? 1 : 0,
      detail: closest ? `Closest win: +${closest.margin} (Y${closest.year})` : undefined,
    },
    {
      id: 'revenge',
      group: 'Big game',
      icon: 'swords',
      title: 'Revenge',
      description: 'Beat a team that beat you in a Super Bowl.',
      rule: 'A Super Bowl win over a team that had beaten you in an earlier Super Bowl.',
      unlocked: !!revenge,
      when: revenge ? sbLabel(revenge.game) : undefined,
      detail: revenge
        ? `${revenge.game.opponent}: lost Y${revenge.loss.year}, won ${yourScore(revenge.game)} in Y${revenge.game.year}`
        : undefined,
      progress: revenge ? 1 : 0,
    },
    {
      id: 'bounce',
      group: 'Big game',
      icon: 'rebound',
      title: 'Bounce back',
      description: 'Win it all the season after losing a Super Bowl.',
      rule: 'A Super Bowl win in the season right after a Super Bowl loss.',
      unlocked: !!bounce,
      when: bounce ? `${sbLabel(bounce)} (${bounce.team})` : undefined,
      progress: bounce ? 1 : 0,
    },
    {
      id: 'spotless',
      group: 'Big game',
      icon: 'shield',
      title: 'Spotless',
      description: 'Go 5–0 or better in Super Bowls with one franchise.',
      rule: 'A franchise with five or more Super Bowl wins and no Super Bowl losses under you.',
      unlocked: spotless.length > 0,
      detail: spotless.length
        ? spotless.map((t) => `${t.team} ${t.wins}–0`).join(', ')
        : bestUnbeaten
          ? `Best: ${bestUnbeaten.team} ${bestUnbeaten.wins}–0`
          : undefined,
      progress: clamp01((bestUnbeaten?.wins ?? 0) / 5),
    },
    {
      id: 'ten-ring',
      group: 'Roster',
      icon: 'ring',
      title: 'Ring maker',
      description: 'Develop a player with ten Super Bowl rings.',
      rule: 'Any league player (real-life legends excluded) with 10+ career rings. Rings in this save come almost entirely from your titles.',
      unlocked: tenRing.length > 0,
      detail: tenRing.length ? names(tenRing) : ringLeaders[0] ? `Most: ${ringLeaders[0].name} (${ringLeaders[0].rings})` : undefined,
      progress: clamp01((ringLeaders[0]?.rings ?? 0) / 10),
    },
    {
      id: 'hof5',
      group: 'Roster',
      icon: 'hall',
      title: 'Hall of Fame factory',
      description: 'Coach five Hall of Famers.',
      rule: `Players with ${HOF_THRESHOLD.toLocaleString()}+ career legacy and at least one ring who are named key players in one of your eras or finished their career with a franchise you ran. Real-life legends excluded.`,
      unlocked: hofs.length >= 5,
      detail: hofs.length ? `${hofs.length} coached: ${names(hofs)}` : 'None yet',
      progress: clamp01(hofs.length / 5),
    },
    {
      id: 'perfect',
      group: 'Arcade',
      icon: 'perfect',
      title: 'Perfect season',
      description: 'Go 18–0 and win it all in Perfect Season.',
      rule: 'Your best Perfect Season run saved in this browser is 18 wins and 0 losses.',
      unlocked: arcade.perfectW >= 18 && arcade.perfectL === 0,
      detail: arcade.perfectW >= 0 ? `Best: ${arcade.perfectW}–${arcade.perfectL}` : 'Not played yet',
      progress: clamp01(Math.max(0, arcade.perfectW) / 18),
    },
    {
      id: 'grid',
      group: 'Arcade',
      icon: 'grid',
      title: 'Full grid',
      description: 'Fill all nine squares in League Grid.',
      rule: 'Best League Grid score saved in this browser is 9 of 9.',
      unlocked: arcade.gridBest >= 9,
      detail: `Best: ${arcade.gridBest}/9`,
      progress: clamp01(arcade.gridBest / 9),
    },
    {
      id: 'hol',
      group: 'Arcade',
      icon: 'arrows',
      title: 'Stat sharp',
      description: 'Hit a 15-answer streak in Higher or Lower.',
      rule: 'Best Higher or Lower streak saved in this browser is 15 or more.',
      unlocked: arcade.holBest >= 15,
      detail: `Best streak: ${arcade.holBest}`,
      progress: clamp01(arcade.holBest / 15),
    },
    {
      id: 'legend',
      group: 'Arcade',
      icon: 'search',
      title: 'Scout',
      description: 'Name ten legends in a row in Guess the Legend.',
      rule: 'Best Guess the Legend streak saved in this browser is 10 or more.',
      unlocked: arcade.legendBest >= 10,
      detail: `Best streak: ${arcade.legendBest}`,
      progress: clamp01(arcade.legendBest / 10),
    },
  ];
  return list;
};
