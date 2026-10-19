import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { awardPack } from '@/utils/collection';
import { cn } from '@/lib/utils';
import type { Position } from '@/types/player';
import { NFL_TEAMS } from '@/utils/nflTeams';
import { StatBlock } from './ArcadeParts';
import GameBanner from './GameBanner';
import { ArcadeButton, ChipGroup, Confetti, CountUp, Lamp, TeamLogo } from './ArcadeUI';
import {
  POSITION_NAMES,
  STAT_KEYS,
  leagueScore,
  sample,
  getAwards,
  getScoutLine,
  getRateScoutLine,
  type ScoutStat,
  loadGameStat,
  playerKey,
  randomInt,
  saveGameStat,
  isLegend,
  shuffle,
  type GamePlayer,
} from './gameUtils';

// ---------- Rules (ported from the original arcade) ----------

/** Draft order with each slot's weight in Team OVR. QB counts three times as much as most spots. */
const PLAN: [Position, number][] = [
  ['QB', 3],
  ['RB', 1.3],
  ['WR', 1.3],
  ['WR', 1.1],
  ['TE', 0.9],
  ['OL', 0.9],
  ['LB', 0.9],
  ['DB', 1],
  ['DL', 0.9],
];
const REG_SEASON = 14;
const TOTAL_GAMES = 18;
const DIVISIONS = ['East', 'North', 'South', 'West'] as const;
const CONFERENCES = ['AFC', 'NFC'] as const;
const PROSPECT_LABELS = ['A', 'B', 'C'];

const winP = (ovrA: number, opp: number) => 1 / (1 + Math.exp(-(ovrA - opp) / 4.5));

const estPerfect = (teamOvr: number) => {
  let p = 1;
  for (let i = 0; i < REG_SEASON; i++) p *= winP(teamOvr, 81);
  for (let i = 0; i < 4; i++) p *= winP(teamOvr, 88.5);
  return p;
};

const scoreline = (win: boolean): [number, number] => {
  const hi = [17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 35, 38, 41, 45][randomInt(14)];
  let lo = Math.max(0, hi - 1 - randomInt(Math.min(hi - 1, 24)));
  if ([1, 4, 5, 8, 11, 12, 15, 18].includes(lo)) lo = Math.max(0, lo - 1);
  return win ? [hi, lo] : [lo, hi];
};

const teamById = (id: string) => NFL_TEAMS.find((t) => t.id === id)!;

// ---------- State ----------

interface DraftOption {
  p: GamePlayer;
  /** Stat line shown on the card (career totals on Rookie, per-game rates above it) */
  line: ScoutStat[];
  hiddenStats: number[];
  hiddenAwards: number[];
}

export type Difficulty = 'rookie' | 'pro' | 'allpro';

/** How each difficulty deals and scouts prospects. */
const DIFFICULTY: Record<Difficulty, { label: string; blurb: string; band: number | null; rates: boolean; hideStats: number; hideAwards: 'two' | 'all' }> = {
  rookie: { label: 'Rookie', blurb: 'Career totals. One prospect is usually a star.', band: null, rates: false, hideStats: 0.4, hideAwards: 'two' },
  pro: { label: 'Pro', blurb: 'Per-game scouting, no games played. Prospects within ~6 OVR of each other.', band: 6, rates: true, hideStats: 0.3, hideAwards: 'two' },
  allpro: { label: 'All-Pro', blurb: 'Per-game scouting, half the line sealed, no awards. Prospects within ~3 OVR.', band: 3, rates: true, hideStats: 0.5, hideAwards: 'all' },
};
const DIFFICULTIES: Difficulty[] = ['rookie', 'pro', 'allpro'];

/** Seconds on the shot clock per draft round (the same on every difficulty). */
const SHOT_CLOCK_SECS = 10;
/** Grace before the clock starts, while the cases are dealt and pop open. */
const CLOCK_GRACE_MS = 900;

interface DraftPick {
  p: GamePlayer;
  w: number;
  slot: Position;
  ovr: number;
  /** "Round 1 · Prospect B" */
  label: string;
  /** "R1 · B" (revealed card tag) */
  short: string;
}

interface Draft {
  plan: [Position, number][];
  round: number;
  picks: DraftPick[];
  options: DraftOption[];
  chosen: number | null;
  /** The pick was made by the expired shot clock */
  auto?: boolean;
}

interface Game {
  t: string;
  label: string;
  home: boolean;
  r: number;
  div?: boolean;
  po?: boolean;
  seed?: number;
  res: 'W' | 'L' | null;
  sc?: [number, number];
}

type Over = false | 'missed' | 'elim' | 'champ';

interface Season {
  ovr: number;
  me: string;
  rating: Record<string, number>;
  rec: Record<string, { w: number; l: number }>;
  games: Game[];
  i: number;
  w: number;
  l: number;
  over: Over;
  seeds: string[] | null;
  seed: number | null;
}

// ---------- Pure helpers ----------

/** Deals three prospects. Rookie keeps the original arcade rule (one near-top player plus two
 * random); harder levels deal from a narrow OVR band so no card is an obvious pick. */
const makeOptions = (pool: GamePlayer[], ovrMap: Map<string, number>, level: Difficulty): DraftOption[] => {
  const cfg = DIFFICULTY[level];
  // Per-game scouting needs games played; players without a games count would show an empty case.
  const scoutable = cfg.rates ? pool.filter((p) => (p.games ?? 0) > 0) : pool;
  const pl = shuffle(scoutable.length >= 3 ? scoutable : pool);
  const rating = (p: GamePlayer) => ovrMap.get(playerKey(p)) ?? 62;
  let opts: GamePlayer[];
  if (cfg.band == null) {
    const byStrength = [...pl].sort((a, b) => leagueScore(b) - leagueScore(a));
    const strong = byStrength[randomInt(Math.min(3, byStrength.length))];
    // At most one real NFL player per draft round
    opts = [strong, ...sample(pl.filter((p) => p !== strong), 2, isLegend(strong) ? 0 : 1)];
  } else {
    const anchor = pl[0];
    // Widen the band until three prospects fit (small positions may not have close neighbours).
    let band = cfg.band;
    let near = pl.filter((p) => p !== anchor && Math.abs(rating(p) - rating(anchor)) <= band);
    while (near.length < 2 && band < 40) {
      band += 3;
      near = pl.filter((p) => p !== anchor && Math.abs(rating(p) - rating(anchor)) <= band);
    }
    const cap = isLegend(anchor) ? 0 : 1;
    const picks = sample(near, 2, cap);
    // The legend cap can leave the band short; top up from the closest remaining prospects.
    if (picks.length < 2) {
      const usedLegend = picks.some(isLegend) ? 1 : 0;
      const rest = pl
        .filter((p) => p !== anchor && !picks.includes(p))
        .sort((a, b) => Math.abs(rating(a) - rating(anchor)) - Math.abs(rating(b) - rating(anchor)));
      let legendsLeft = cap - usedLegend;
      for (const p of rest) {
        if (picks.length >= 2) break;
        if (isLegend(p)) {
          if (legendsLeft <= 0) continue;
          legendsLeft--;
        }
        picks.push(p);
      }
    }
    opts = [anchor, ...picks];
  }
  return shuffle(opts).map((p) => {
    const line = cfg.rates ? getRateScoutLine(p) : getScoutLine(p);
    const hideN = Math.max(1, Math.round(line.length * cfg.hideStats));
    const avail = line.map((d, i) => (d.value != null ? i : -1)).filter((i) => i >= 0);
    const awardIdx = getAwards(p).map((_, i) => i);
    return {
      p,
      line,
      hiddenStats: shuffle(avail).slice(0, Math.min(hideN, Math.max(0, avail.length - (cfg.rates ? 1 : 2)))),
      hiddenAwards: cfg.hideAwards === 'all' ? awardIdx : shuffle(awardIdx).slice(0, 2),
    };
  });
};

/** Stamps prospect `i` as the round's pick (by the player, or by the expired shot clock). */
const choose = (d: Draft, i: number, ovrMap: Map<string, number>, auto = false): Draft => {
  const o = d.options[i];
  const [slot, w] = d.plan[d.round];
  const pick: DraftPick = {
    p: o.p,
    w,
    slot,
    ovr: ovrMap.get(playerKey(o.p)) ?? 62,
    label: `Round ${d.round + 1} · Prospect ${PROSPECT_LABELS[i]}`,
    short: `R${d.round + 1} · ${PROSPECT_LABELS[i]}`,
  };
  return { ...d, chosen: i, auto, picks: [...d.picks, pick] };
};

const seedConference = (s: Pick<Season, 'me' | 'w' | 'l' | 'rec' | 'rating'>, conf: string) => {
  const all = NFL_TEAMS.filter((t) => t.conference === conf).map((t) => t.id);
  const recOf = (t: string) => (t === s.me ? { w: s.w, l: s.l } : s.rec[t]);
  const tb: Record<string, number> = {};
  all.forEach((t) => (tb[t] = recOf(t).w * 1000 + s.rating[t] + Math.random()));
  const winners = DIVISIONS.map((d) => all.filter((t) => teamById(t).division === d).sort((a, b) => tb[b] - tb[a])[0]).sort(
    (a, b) => tb[b] - tb[a],
  );
  const wild = all
    .filter((t) => !winners.includes(t))
    .sort((a, b) => tb[b] - tb[a])
    .slice(0, 3);
  return [...winners, ...wild];
};

/** Seeds the conference and appends the four playoff games, or marks the season as missed. */
const withPlayoffs = (s: Season): Season => {
  const M = teamById(s.me);
  const seeds = seedConference(s, M.conference);
  const seed = seeds.indexOf(s.me) + 1;
  if (!seed) return { ...s, seeds, seed: null, over: 'missed' };
  const others = seeds.filter((t) => t !== s.me);
  const wcCandidate = seeds[8 - seed - 1];
  const wcOpp = wcCandidate && wcCandidate !== s.me ? wcCandidate : others[others.length - 1];
  const rest = others.filter((t) => t !== wcOpp);
  const divOpp = rest[randomInt(Math.min(3, rest.length))];
  const confOpp = rest.filter((t) => t !== divOpp)[0];
  const otherConf = M.conference === 'AFC' ? 'NFC' : 'AFC';
  const sbOpp = seedConference(s, otherConf)[randomInt(2)];
  const playoff: Game[] = (
    [
      [wcOpp, 'Wild Card'],
      [divOpp, 'Divisional'],
      [confOpp, `${M.conference} Champ`],
      [sbOpp, 'Super Bowl'],
    ] as [string, string][]
  ).map(([t, label], i) => ({
    t,
    label,
    po: true,
    home: i < 3 ? seed < seeds.indexOf(t) + 1 : false,
    r: Math.max(s.rating[t], 84) + [1, 2, 3, 4][i],
    seed: i < 3 ? seeds.indexOf(t) + 1 : 1,
    res: null,
  }));
  return { ...s, seeds, seed, games: [...s.games, ...playoff] };
};

const newSeason = (teamOvr: number, me: string): Season => {
  const M = teamById(me);
  const ids = NFL_TEAMS.map((t) => t.id);
  const rating: Record<string, number> = {};
  ids.forEach((t) => (rating[t] = t === me ? teamOvr : 72 + randomInt(20)));
  const div = ids.filter((t) => t !== me && teamById(t).conference === M.conference && teamById(t).division === M.division);
  const conf = shuffle(ids.filter((t) => teamById(t).conference === M.conference && teamById(t).division !== M.division)).slice(0, 4);
  const other = shuffle(ids.filter((t) => teamById(t).conference !== M.conference)).slice(0, 4);
  const homeFirst = shuffle([true, true, true, false, false, false]);
  const slate = shuffle<Omit<Game, 'label' | 'r' | 'res'>>([
    ...div.map((t, i) => ({ t, div: true, home: homeFirst[i] })),
    ...div.map((t, i) => ({ t, div: true, home: !homeFirst[i] })),
    ...conf.map((t) => ({ t, home: Math.random() < 0.5 })),
    ...other.map((t) => ({ t, home: Math.random() < 0.5 })),
  ]);
  // AI teams' records come from their rating
  const rec: Record<string, { w: number; l: number }> = {};
  ids.forEach((t) => {
    if (t === me) return;
    let w = 0;
    for (let i = 0; i < REG_SEASON; i++) if (Math.random() < winP(rating[t], 80)) w++;
    rec[t] = { w, l: REG_SEASON - w };
  });
  return {
    ovr: teamOvr,
    me,
    rating,
    rec,
    games: slate.map((g, i) => ({ ...g, label: `Wk ${i + 1}`, r: rating[g.t], res: null })),
    i: 0,
    w: 0,
    l: 0,
    over: false,
    seeds: null,
    seed: null,
  };
};

/** Plays the next game. */
const advance = (s: Season): Season => {
  if (s.over) return s;
  const g = s.games[s.i];
  const win = Math.random() < winP(s.ovr, g.r + (g.home ? 0 : 1));
  const games = s.games.map((x, j) => (j === s.i ? { ...x, res: win ? ('W' as const) : ('L' as const), sc: scoreline(win) } : x));
  let next: Season = { ...s, games, i: s.i + 1, w: s.w + (win ? 1 : 0), l: s.l + (win ? 0 : 1) };
  if (next.i === REG_SEASON) next = withPlayoffs(next);
  else if (g.po && !win) next.over = 'elim';
  else if (next.i === TOTAL_GAMES) next.over = 'champ';
  return next;
};


// ---------- Component ----------

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const toTop = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });

type Phase = 'draft' | 'roster' | 'season' | 'reveal';

const outcomeText = (s: Season) => {
  const M = teamById(s.me);
  const last = s.games[s.i - 1]?.label ?? '';
  if (s.over === 'champ') return s.l === 0 ? '18–0. Perfect season. Super Bowl champions.' : `Super Bowl champions at ${s.w}–${s.l}`;
  if (s.over === 'elim')
    return `Eliminated in the ${last === 'Super Bowl' ? 'Super Bowl' : last.includes('Champ') ? `${M.conference} Championship` : `${last.toLowerCase()} round`}`;
  if (s.over === 'missed') return `Missed the playoffs at ${s.w}–${s.l}`;
  return '';
};

const outcomeClass = (s: Season) => (s.over === 'champ' ? (s.l === 0 ? 'perfect' : 'champ') : 'out');

const PerfectSeason = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap: Map<string, number> }) => {
  // Skip any draft slot the pool can't fill (e.g. a second WR round in a league with one WR).
  const plan = useMemo(() => {
    const seen: Partial<Record<Position, number>> = {};
    return PLAN.filter(([pos]) => {
      seen[pos] = (seen[pos] ?? 0) + 1;
      return players.filter((p) => p.position === pos).length >= seen[pos]!;
    });
  }, [players]);

  const [level, setLevel] = useState<Difficulty>(() => DIFFICULTIES[loadGameStat(STAT_KEYS.perfectDifficulty, 0)] ?? 'rookie');

  const startDraft = (lvl: Difficulty = level): Draft => ({
    plan,
    round: 0,
    picks: [],
    options: makeOptions(players.filter((p) => p.position === plan[0]?.[0]), ovrMap, lvl),
    chosen: null,
  });

  const [phase, setPhase] = useState<Phase>('draft');
  const [draft, setDraft] = useState<Draft>(() => startDraft());
  const [season, setSeason] = useState<Season | null>(null);
  const [fast, setFast] = useState(false);
  const [franchise, setFranchise] = useState(() => NFL_TEAMS[loadGameStat(STAT_KEYS.franchise, 0)]?.id ?? NFL_TEAMS[0].id);
  const [best, setBest] = useState(() => ({ w: loadGameStat(STAT_KEYS.perfectWins, -1), l: loadGameStat(STAT_KEYS.perfectLosses, 0) }));
  const [newBest, setNewBest] = useState(false);
  const [confetti, setConfetti] = useState<number | false>(false);
  const [flipped, setFlipped] = useState(0);

  const teamOvr = useMemo(() => {
    const w = draft.picks.reduce((s, x) => s + x.w, 0);
    return w ? Math.round(draft.picks.reduce((s, x) => s + x.ovr * x.w, 0) / w) : 0;
  }, [draft.picks]);

  const finishSeason = (s: Season) => {
    const isBest = best.w < 0 || s.w > best.w || (s.w === best.w && s.l < best.l);
    setNewBest(isBest);
    if (isBest) {
      setBest({ w: s.w, l: s.l });
      saveGameStat(STAT_KEYS.perfectWins, s.w);
      saveGameStat(STAT_KEYS.perfectLosses, s.l);
    }
  };

  // Draft: after a pick, stamp it and move on automatically (v2 flow).
  useEffect(() => {
    if (phase !== 'draft' || draft.chosen == null) return;
    const id = window.setTimeout(() => {
      const round = draft.round + 1;
      if (round >= draft.plan.length) {
        setPhase('roster');
      } else {
        const used = new Set(draft.picks.map((x) => playerKey(x.p)));
        const pool = players.filter((p) => p.position === draft.plan[round][0] && !used.has(playerKey(p)));
        setDraft({ ...draft, round, chosen: null, auto: false, options: makeOptions(pool, ovrMap, level) });
      }
      toTop();
    }, reducedMotion() ? 500 : 1300);
    return () => window.clearTimeout(id);
  }, [phase, draft, players, ovrMap, level]);

  // Shot clock: runs while a draft round is open, pauses for the pick animation, auto-drafts on expiry.
  const [clockLeft, setClockLeft] = useState(SHOT_CLOCK_SECS * 1000);
  useEffect(() => {
    const total = SHOT_CLOCK_SECS * 1000;
    setClockLeft(total);
    if (phase !== 'draft' || draft.chosen != null || draft.options.length === 0) return;
    const start = performance.now() + CLOCK_GRACE_MS;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.min(total, total - (performance.now() - start)));
      setClockLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        setDraft((d) => (d.chosen != null || d.options.length === 0 ? d : choose(d, randomInt(d.options.length), ovrMap, true)));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, draft.round, draft.options, draft.chosen, level, ovrMap]);

  // Season clock: 520ms a week, 900ms in the playoffs, 60ms when simming to the end, 700ms before kickoff.
  useEffect(() => {
    if (phase !== 'season' || !season || season.over) return;
    const delay = season.i === 0 ? (reducedMotion() ? 200 : 700) : fast ? 60 : season.i >= REG_SEASON ? 900 : 520;
    const id = window.setTimeout(() => {
      const next = advance(season);
      setSeason(next);
      if (next.over) finishSeason(next);
    }, delay);
    return () => window.clearTimeout(id);
    // finishSeason only reads `best`, which cannot change while a season is running
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, season, fast]);

  // When the season ends, roll into the roster reveal after a beat.
  useEffect(() => {
    if (phase !== 'season' || !season?.over) return;
    const id = window.setTimeout(() => startReveal(), reducedMotion() ? 0 : 2000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, season?.over]);

  // Reveal: flip one card at a time.
  useEffect(() => {
    if (phase !== 'reveal' || flipped >= draft.picks.length) return;
    const id = window.setTimeout(() => setFlipped((n) => n + 1), flipped === 0 ? 400 : 300);
    return () => window.clearTimeout(id);
  }, [phase, flipped, draft.picks.length]);

  // Confetti once every card is face up after a perfect season.
  useEffect(() => {
    if (phase === 'reveal' && season?.over === 'champ' && season.l === 0 && flipped === draft.picks.length) setConfetti(Date.now());
  }, [phase, flipped, season, draft.picks.length]);

  const startReveal = () => {
    if (season?.over === 'champ' && season.l === 0) awardPack('perfect', '18–0 perfect season', { once: season, label: `18–0 · ${teamById(season.me).name} · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` });
    else if (season?.over && season.games.some((g) => g.po && g.res === 'W')) awardPack('premium', `18–0 game, playoff win at ${season.w}–${season.l}`, { once: season });
    else if (season?.over && season.w > season.l) awardPack('standard', `18–0 game, winning season ${season.w}–${season.l}`, { once: season });
    setFlipped(reducedMotion() ? draft.picks.length : 0);
    setPhase('reveal');
    toTop();
  };

  if (plan.length < 3) return <p className="empty">Not enough positions filled to draft a team yet.</p>;

  const pickProspect = (i: number) => {
    if (draft.chosen != null) return;
    setDraft(choose(draft, i, ovrMap));
  };

  const kickOff = () => {
    saveGameStat(STAT_KEYS.franchise, Math.max(0, NFL_TEAMS.findIndex((t) => t.id === franchise)));
    setFast(false);
    setConfetti(false);
    setNewBest(false);
    setSeason(newSeason(teamOvr, franchise));
    setPhase('season');
    toTop();
  };

  const redraft = () => {
    setSeason(null);
    setConfetti(false);
    setDraft(startDraft());
    setPhase('draft');
    toTop();
  };

  const bestLabel = best.w >= 0 ? `${best.w}–${best.l}` : '—';

  /** Nine roster cards: sealed ProPlayerBanners that flip to the real player (with photo for legends) once opened. */
  const roster = (openCount: number) => (
    <ul className="sealed ps-roster" aria-label={openCount ? 'Your roster' : 'Your sealed roster'}>
      {draft.picks.map((x, i) => {
        const open = i < openCount;
        const tag = (
          <span className="ps-tag" aria-hidden="true">
            {x.label}
          </span>
        );
        return (
          <li
            key={playerKey(x.p)}
            className={open ? 'anim-flip' : 'anim-deal'}
            style={open ? undefined : { animationDelay: `${openCount ? 0 : i * 0.06}s` }}
            aria-label={open ? undefined : `${x.slot}, ${x.label}, sealed`}
          >
            {open ? (
              // Tag goes in the eyebrow: a revealed legend's photo window takes the top-right corner
              <GameBanner player={x.p} ovr={x.ovr} reveal eyebrow={x.short} />
            ) : (
              <GameBanner player={x.p} sealed sealedHint={x.slot} topRight={tag} />
            )}
          </li>
        );
      })}
    </ul>
  );

  // ---------- Draft (identities sealed) ----------
  if (phase === 'draft') {
    const [pos] = draft.plan[draft.round];
    const picked = draft.chosen != null;
    const clockTotal = SHOT_CLOCK_SECS * 1000;
    const secs = Math.ceil(clockLeft / 1000);
    const urgent = !picked && secs <= 5;
    return (
      <div>
        <div className="draft-head">
          <Lamp label={picked ? `Round ${draft.round + 1} · pick is in` : `Round ${draft.round + 1}/${draft.plan.length} · on the clock`} live flicker={!picked} />
          <div
            className={cn('shotclock', urgent && 'urgent', picked && 'paused')}
            role="timer"
            aria-label={picked ? 'Shot clock stopped' : `Shot clock: ${secs} seconds left`}
          >
            <span className="sc-k" aria-hidden="true">
              Shot clock
            </span>
            <b className="sc-v num" aria-hidden="true">
              {picked ? '--' : `0:${String(secs).padStart(2, '0')}`}
            </b>
            <span className="sc-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${picked ? 0 : clockLeft / clockTotal})` }} />
            </span>
          </div>
          <span className="sr-only" aria-live="assertive">
            {urgent && secs === 5 ? 'Five seconds left on the shot clock' : ''}
          </span>
          <ol className="ladder" aria-label="Draft progress">
            {draft.plan.map(([p], i) => (
              <li key={i} className={cn(i < draft.round || (i === draft.round && picked) ? 'done' : i === draft.round && 'now')} aria-current={i === draft.round ? 'step' : undefined}>
                {p}
              </li>
            ))}
          </ol>
        </div>
        {draft.round === 0 && !picked && (
          <div style={{ margin: '4px 0 10px' }}>
            <ChipGroup
              label="Difficulty"
              value={level}
              options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY[d].label, title: DIFFICULTY[d].blurb }))}
              onChange={(d) => {
                setLevel(d);
                saveGameStat(STAT_KEYS.perfectDifficulty, DIFFICULTIES.indexOf(d));
                setDraft(startDraft(d));
              }}
            />
          </div>
        )}
        <h3 className="round-title anim-stage" key={`t-${draft.round}`}>
          Round {draft.round + 1}: <span>{POSITION_NAMES[pos]}</span>
          {level !== 'rookie' && <span className="hint" style={{ marginLeft: 10, fontSize: 14 }}>· {DIFFICULTY[level].label}</span>}
        </h3>
        <p className="hint" style={{ margin: '0 0 14px' }}>
          {DIFFICULTY[level].blurb} {SHOT_CLOCK_SECS} seconds a pick, or the clock picks for you. You won't learn who you picked until the season
          is over.
        </p>

        <div className="draft-grid cases" key={`r-${draft.round}`}>
          {draft.options.map((o, i) => {
            const L = PROSPECT_LABELS[i];
            const chosen = draft.chosen === i;
            const shut = picked && !chosen;
            return (
              <article
                key={playerKey(o.p)}
                className={cn('case anim-deal', chosen && 'chosen', shut && 'shut')}
                style={{ animationDelay: `${i * 0.12}s`, '--open-delay': `${0.35 + i * 0.15}s` } as CSSProperties}
                aria-label={`Prospect ${L}, sealed case${chosen ? (draft.auto ? ', auto-drafted' : ', drafted') : ''}`}
              >
                <span className="case-handle" aria-hidden="true" />
                <div className="case-top" aria-hidden="true">
                  <span className="case-tag">Prospect {L}</span>
                  <span className="case-pos">{o.p.position}</span>
                  <span className="case-dial">
                    <i />
                  </span>
                </div>
                <div className="case-body">
                  <div className="case-sheet">
                    <div className="sheet-head">
                      <span>Scouting report</span>
                      <span>
                        {POSITION_NAMES[o.p.position]} · Prospect {L}
                      </span>
                    </div>
                    <StatBlock player={o.p} line={o.line} hiddenStats={o.hiddenStats} hiddenAwards={o.hiddenAwards} countUp />
                    <p className="sheet-foot">Name and team sealed until the season ends.</p>
                  </div>
                  <div className="case-cover" aria-hidden="true">
                    <span className="case-latch" />
                    <span className="case-latch" />
                    <span className="case-emblem">{L}</span>
                  </div>
                </div>
                {chosen && (
                  <div className={cn('stamp anim-stamp', draft.auto ? 'flag auto' : 'gold')}>
                    {draft.auto ? (
                      <>
                        Clock expired<small>Auto-pick</small>
                      </>
                    ) : (
                      'Drafted'
                    )}
                  </div>
                )}
                {!picked && (
                  <button type="button" className="case-draft" onClick={() => pickProspect(i)}>
                    Draft prospect {L}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Roster (sealed) ----------
  if (phase === 'roster' || !season) {
    const fTeam = teamById(franchise);
    return (
      <div>
        <Lamp label="Roster sealed" flicker />
        <p className="odds anim-rise" style={{ margin: '12px 0 14px' }}>
          Nine picks are in. Their names, teams and ratings stay hidden until your season ends.
        </p>
        {roster(0)}
        <div className="result anim-rise">
          <div className="picker">
            <TeamLogo team={fTeam} className="logo" />
            <label htmlFor="franchise">Franchise</label>
            <select id="franchise" value={franchise} onChange={(e) => setFranchise(e.target.value)}>
              {CONFERENCES.map((c) =>
                DIVISIONS.map((d) => (
                  <optgroup key={`${c}-${d}`} label={`${c} ${d}`}>
                    {NFL_TEAMS.filter((t) => t.conference === c && t.division === d).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </optgroup>
                )),
              )}
            </select>
            <span className="hint">
              {fTeam.conference} {fTeam.division}
            </span>
          </div>
          <ArcadeButton tone="green" onClick={kickOff}>
            Kick off the season
          </ArcadeButton>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Fourteen games: six against your division, four against the rest of your conference, four against the other conference. Seven teams
          per conference make the playoffs, and every seed plays the Wild Card round.
        </p>
      </div>
    );
  }

  const M = teamById(season.me);
  const msg = season.over ? outcomeText(season) : '';

  // ---------- Reveal ----------
  if (phase === 'reveal') {
    const allUp = flipped >= draft.picks.length;
    const byOvr = [...draft.picks].sort((a, b) => b.ovr - a.ovr);
    const odds = estPerfect(season.ovr);
    return (
      <div>
        <Confetti fire={confetti} />
        <div className="reveal-head">
          <TeamLogo team={M} className="mx-auto w-20 h-20 object-contain" />
          <div className="px muted" style={{ fontSize: 11, marginTop: 6 }}>
            {M.fullName} · final record{newBest && ' · new best'}
          </div>
          <div className="final num">
            {season.w}–{season.l}
          </div>
          <div className={cn('banner-msg mx-auto mt-3', outcomeClass(season))} style={{ maxWidth: 720 }} role="status">
            {msg}
          </div>
        </div>
        <section className="unmask">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="anim-rise">
              Your roster, <span className="gold">unmasked</span>
            </h3>
            {!allUp && (
              <ArcadeButton tone="ghost" onClick={() => setFlipped(draft.picks.length)}>
                Reveal all
              </ArcadeButton>
            )}
          </div>
          {roster(flipped)}
          {allUp && (
            <div className="team-ovr anim-rise">
              <div className="ovr-dial" style={{ '--p': Math.max(0, ((season.ovr - 60) / 39) * 100) } as CSSProperties} role="img" aria-label={`Team OVR ${season.ovr}`}>
                <div>
                  <b className="num">
                    <CountUp value={season.ovr} />
                  </b>
                  <span>TEAM OVR</span>
                </div>
              </div>
              <p className="odds">
                Best pick: <b>{byOvr[0].p.name}</b> ({byOvr[0].ovr}). Weakest: <b>{byOvr[byOvr.length - 1].p.name}</b> ({byOvr[byOvr.length - 1].ovr}). A
                team rated {season.ovr} goes 18–0 about <b>{odds < 0.01 ? '<1' : Math.round(odds * 100)}%</b> of the time.
              </p>
            </div>
          )}
        </section>
        <div className="result">
          <div className="hint">Best season: {bestLabel}. Back to the draft room?</div>
          <ArcadeButton tone="go" onClick={redraft} autoFocus={allUp}>
            Draft a new team
          </ArcadeButton>
        </div>
      </div>
    );
  }

  // ---------- Season ----------
  const playoffW = season.games.slice(REG_SEASON).filter((g) => g.res === 'W').length;
  const playoffL = season.games.slice(REG_SEASON).filter((g) => g.res === 'L').length;
  const standings =
    season.i >= REG_SEASON
      ? NFL_TEAMS.filter((t) => t.conference === M.conference && t.division === M.division)
          .map((t) => ({ t, ...(t.id === season.me ? { w: season.w - playoffW, l: season.l - playoffL } : season.rec[t.id]) }))
          .sort((a, b) => b.w - a.w)
      : null;

  return (
    <div className="two-col">
      <ol className="sched" aria-label="Schedule">
        {season.games.map((g, i) => {
          const T = teamById(g.t);
          const sb = g.label === 'Super Bowl';
          return (
            <li key={`${g.label}-${g.t}`}>
              {i === REG_SEASON && (
                <div className="sep">
                  — Playoffs · {M.conference} seed {season.seed} —
                </div>
              )}
              <div className={cn('game', g.res ? (g.res === 'W' ? 'w' : 'l') : 'pend', i === season.i - 1 && 'just', g.po && 'po', sb && 'sb')}>
                <span className="wk">{g.label}</span>
                <span className="opp">
                  <TeamLogo team={T} />
                  <span className="nm">
                    {sb || g.home ? 'vs ' : '@ '}
                    {g.po && !sb && g.seed ? <span className="seed">({g.seed}) </span> : null}
                    {T.name}
                  </span>
                  {g.div && <span className="divtag">DIV</span>}
                  <span className="rtg">{Math.round(g.r)}</span>
                </span>
                <span className="sc">{g.res && g.sc ? `${g.res} ${g.sc[0]}–${g.sc[1]}` : '—'}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <aside className="side">
        <div className="recbox">
          <TeamLogo team={M} />
          <div className="s">{M.fullName}</div>
          <div className={cn('r num', season.i > 0 && 'bump')} key={season.i} aria-live="polite">
            {season.w}–{season.l}
          </div>
          <div className="s">
            Team OVR {season.over ? season.ovr : '??'}
            {!season.over && best.w >= 0 && ` · Best ${bestLabel}`}
            {season.over && newBest && ' · New best'}
          </div>
        </div>
        {msg && (
          <div className={cn('banner-msg', outcomeClass(season))} role="status">
            {msg}
          </div>
        )}
        {standings && (
          <div className="standings">
            <h3>
              {M.conference} {M.division} · Final
            </h3>
            <table>
              <tbody>
                {standings.map((r) => {
                  const sd = season.seeds ? season.seeds.indexOf(r.t.id) + 1 : 0;
                  return (
                    <tr key={r.t.id} className={r.t.id === season.me ? 'me' : undefined}>
                      <td>
                        {r.t.name}
                        {sd > 0 && <span className="seed"> ({sd})</span>}
                      </td>
                      <td>
                        {r.w}–{r.l}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {season.over ? (
          <ArcadeButton tone="go" onClick={startReveal} autoFocus>
            Unmask your roster
          </ArcadeButton>
        ) : (
          <ArcadeButton onClick={() => setFast(true)} disabled={fast}>
            Sim to the end
          </ArcadeButton>
        )}
        <p className="hint" style={{ margin: 0 }}>
          The number after each opponent is its team rating. Playoff opponents rate at least 85. Your roster stays sealed until the final whistle.
        </p>
      </aside>
    </div>
  );
};

export default PerfectSeason;
