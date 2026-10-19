import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { awardPack } from '@/utils/collection';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import type { Player } from '@/types/player';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { cn } from '@/lib/utils';
import { playerSkillGrades } from '@/config/skillGrades';
import GameBanner from './GameBanner';
import { ArcadeButton, Confetti, Lamp, LampRow, TeamLogo } from './ArcadeUI';
import {
  STAT_KEYS,
  fmt,
  getStatLine,
  isDefender,
  isLegend,
  leagueScore,
  loadGameStat,
  playerKey,
  randomItem,
  saveGameStat,
  type GamePlayer,
} from './gameUtils';

const MAX_GUESSES = 6;
/** Points for solving on guess n (1-based): 5, 4, 3, 2, 1, then 0 when every clue was needed. */
const pointsFor = (guessNumber: number) => Math.max(0, MAX_GUESSES - guessNumber);

interface Clue {
  title: string;
  content: ReactNode;
}

const ClueStat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="stat">
    <dt className="k">{label}</dt>
    <dd className="v">{value}</dd>
  </div>
);

/** 1-based clue numbers that unlock the position and team (also when their feedback tiles start showing). */
const POSITION_CLUE = 5;
const TEAM_CLUE = 6;

/**
 * Clues run from vague to specific. Position stays hidden until clue 5: the stat line (whose categories give the
 * position away) comes with it, and the skill fingerprint shows bare letter grades with no trait names.
 */
const buildClues = (p: Player, rating: number, league: Player[]): Clue[] => {
  const initials = p.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]}.`)
    .join(' ');
  const team = findNFLTeam(p.team);
  const grades = playerSkillGrades(league, p)
    .traits.filter((t) => t.grade && Number.isFinite(t.percentile))
    .sort((a, b) => b.percentile - a.percentile)
    .slice(0, 4);
  return [
    {
      title: 'Rating',
      content: (
        <>
          <ClueStat label="OVR" value={rating} />
          <ClueStat label="League Score" value={fmt(leagueScore(p))} />
        </>
      ),
    },
    {
      title: 'Longevity',
      content: (
        <>
          <ClueStat label="Games" value={fmt(p.games)} />
          <ClueStat label="Nickname" value={p.nickname ? `${p.nickname.replace(/[^A-Za-z]/g, '').length} letters` : 'None'} />
        </>
      ),
    },
    {
      title: 'Trophy case',
      content: (
        <>
          <ClueStat label="Rings" value={fmt(p.rings)} />
          <ClueStat label="MVP" value={fmt(p.mvp)} />
          {/* OPOY and DPOY merged so the award doesn't reveal offense or defense */}
          <ClueStat label="Player of the Year" value={fmt(p.opoy)} />
          <ClueStat label="SB MVP" value={fmt(p.sbmvp)} />
        </>
      ),
    },
    {
      title: 'Skill fingerprint',
      content: grades.length ? (
        grades.map((g, i) => <ClueStat key={i} label={i === 0 ? 'Best skill' : `Skill ${i + 1}`} value={g.grade!.grade} />)
      ) : (
        <ClueStat label="Skills" value="Not enough data" />
      ),
    },
    {
      title: 'Position & stat line',
      content: (
        <>
          <ClueStat label="Position" value={p.position} />
          {getStatLine(p).map((s) => (
            <ClueStat key={s.label} label={s.label} value={s.value} />
          ))}
        </>
      ),
    },
    {
      title: 'Team & initials',
      content: (
        <>
          <ClueStat
            label="Team"
            value={
              <span className="flex items-center gap-1.5">
                <TeamLogo team={team} className="w-6 h-6 object-contain" />
                <span className="truncate">{team?.name ?? (p.team || 'Unlisted')}</span>
              </span>
            }
          />
          <ClueStat label="Name" value={initials} />
        </>
      ),
    },
  ];
};

type TileState = 'match' | 'div' | 'conf' | 'wrong' | 'up' | 'down' | 'miss' | 'na' | 'hidden';

const TILE_NOTE: Record<TileState, string> = {
  hidden: 'Clue locked',
  match: 'Match',
  div: 'Same division',
  conf: 'Same conference',
  wrong: 'Different',
  up: 'Higher ▲',
  down: 'Lower ▼',
  miss: 'Different',
  na: 'Unknown',
};

const TILE_SPOKEN: Record<TileState, string> = {
  hidden: 'hidden until its clue unlocks',
  match: 'same as the mystery player',
  div: 'same division as the mystery player',
  conf: 'same conference as the mystery player',
  wrong: 'different from the mystery player',
  up: "the mystery player's is higher",
  down: "the mystery player's is lower",
  miss: 'different from the mystery player',
  na: 'not comparable',
};

/**
 * One Wordle-style feedback tile: the guessed player's value plus how the mystery player compares.
 * Colour is never the only signal: every tile carries a text note and a full aria-label.
 */
const Tile = ({ label, value, state }: { label: string; value: string | number; state: TileState }) => (
  <div className={cn('gtile', state)} role="group" aria-label={`${label} ${value}: ${TILE_SPOKEN[state]}`}>
    <span className="gtile-k" aria-hidden="true">
      {label}
    </span>
    <span className="gtile-v" aria-hidden="true">
      {value}
    </span>
    <span className="gtile-n" aria-hidden="true">
      {TILE_NOTE[state]}
    </span>
  </div>
);

const numberTile = (guess: number | null, answer: number): TileState =>
  guess == null ? 'na' : guess === answer ? 'match' : answer > guess ? 'up' : 'down';

/** Team: same team (green) > same division (blue) > same conference (yellow) > different (gray). */
const teamTile = (guess: NFLTeam | null | undefined, answer: NFLTeam | null | undefined): TileState => {
  if (!guess || !answer) return 'na';
  if (guess.id === answer.id) return 'match';
  if (guess.conference === answer.conference && guess.division === answer.division) return 'div';
  if (guess.conference === answer.conference) return 'conf';
  return 'miss';
};

/**
 * Balanced dealer: positions come from a shuffled bag (every position once per cycle, never the same
 * position twice in a row), and recently seen players are skipped. Pure randomness made long RB/QB runs.
 */
const makeDealer = (pool: Player[]) => {
  const positions = [...new Set(pool.map((p) => p.position))];
  let bag: string[] = [];
  let lastPos: string | null = null;
  const recent: string[] = [];
  return (): Player => {
    if (!bag.length) {
      bag = [...positions].sort(() => Math.random() - 0.5);
      if (bag.length > 1 && bag[0] === lastPos) bag.push(bag.shift()!);
    }
    const pos = bag.shift()!;
    lastPos = pos;
    const atPos = pool.filter((p) => p.position === pos);
    const fresh = atPos.filter((p) => !recent.includes(playerKey(p)));
    const pick = randomItem(fresh.length ? fresh : atPos.length ? atPos : pool);
    recent.push(playerKey(pick));
    if (recent.length > 24) recent.shift();
    return pick;
  };
};

const GuessTheLegend = ({ players, ovrMap }: { players: Player[]; ovrMap: Map<string, number> }) => {
  // Prefer established players so puzzles are fair; fall back to everyone in small leagues.
  const pool = useMemo(() => {
    const established = players.filter((p) => p.games >= 50 && (isLegend(p) || p.careerLegacy > 0));
    return established.length >= 5 ? established : players;
  }, [players]);

  const dealer = useRef<{ pool: Player[]; next: () => Player } | null>(null);
  const deal = () => {
    if (!dealer.current || dealer.current.pool !== pool) dealer.current = { pool, next: makeDealer(pool) };
    return dealer.current.next();
  };
  const [answer, setAnswer] = useState<Player>(() => deal());
  const [guesses, setGuesses] = useState<Player[]>([]);
  const [selection, setSelection] = useState('');
  const [streak, setStreak] = useState(() => loadGameStat('legend:streak'));
  const [best, setBest] = useState(() => loadGameStat(STAT_KEYS.legendBest));
  const [score, setScore] = useState(() => loadGameStat('legend:score'));
  const [misses, setMisses] = useState(0);
  const [confetti, setConfetti] = useState<number | false>(false);

  const ovrOf = useCallback((p: Player) => ovrMap.get(playerKey(p)) ?? 62, [ovrMap]);
  const clues = useMemo(() => buildClues(answer, ovrOf(answer), players), [answer, ovrOf, players]);
  const solved = guesses.some((g) => playerKey(g) === playerKey(answer));
  const failed = !solved && guesses.length >= MAX_GUESSES;
  const finished = solved || failed;
  const revealed = finished ? clues.length : Math.min(guesses.length + 1, clues.length);

  const submitGuess = useCallback(
    (key: string) => {
      const guess = players.find((p) => playerKey(p) === key);
      if (!guess || finished || guesses.some((g) => playerKey(g) === key)) return;
      const next = [...guesses, guess];
      setGuesses(next);
      setSelection('');

      const won = key === playerKey(answer);
      if (won) setConfetti(Date.now());
      if (won && pointsFor(next.length) >= 5) awardPack('premium', `Guess the Legend, ${pointsFor(next.length)} points`, { once: next });
      else if (won && pointsFor(next.length) >= 3) awardPack('standard', `Guess the Legend, ${pointsFor(next.length)} points`, { once: next });
      if (!won) setMisses((m) => m + 1);
      if (won || next.length >= MAX_GUESSES) {
        const points = won ? pointsFor(next.length) : 0;
        if (points > 0) {
          setScore((s) => {
            saveGameStat('legend:score', s + points);
            return s + points;
          });
        }
        // Needing every clue scores nothing and ends the streak, same as a miss.
        const newStreak = points > 0 ? streak + 1 : 0;
        setStreak(newStreak);
        saveGameStat('legend:streak', newStreak);
        if (newStreak > best) {
          setBest(newStreak);
          saveGameStat(STAT_KEYS.legendBest, newStreak);
        }
      }
    },
    [players, finished, guesses, answer, streak, best],
  );

  const newPuzzle = () => {
    setAnswer(deal());
    setGuesses([]);
    setSelection('');
  };

  return (
    <div className="two-col">
      <Confetti fire={confetti} />
      <div className="flex flex-col gap-3 min-w-0">
        {clues.map((clue, i) => {
          const open = i < revealed;
          return (
            <section key={clue.title} className={cn('clue', !open && 'locked', open && i === revealed - 1 && !finished && 'slide-in')}>
              <h4>
                <span aria-hidden="true">{open ? '◆' : '■'}</span>
                Clue {i + 1}: {clue.title}
                {!open && <span className="sr-only">(locked)</span>}
              </h4>
              <dl className={cn('stats', !open && 'blur')} aria-hidden={!open}>
                {/* Locked clues render a uniform placeholder: blurred real content leaked its shape (stat count = position) */}
                {open
                  ? clue.content
                  : [0, 1, 2, 3].map((k) => <ClueStat key={k} label="Locked" value="■■■" />)}
              </dl>
            </section>
          );
        })}
      </div>

      <aside className="side">
        <div className={cn('card', misses > 0 && !finished && 'shake')} key={`banner-${misses}-${finished}`}>
          <GameBanner
            player={answer as GamePlayer}
            sealed={!finished}
            ovr={finished ? ovrOf(answer) : null}
            reveal={finished}
           
            className={finished ? 'flip-y' : undefined}
          />
        </div>
        <div className="panel flex flex-col gap-3">
          <LampRow>
            <Lamp label={finished ? 'Final' : `Guess ${Math.min(guesses.length + 1, MAX_GUESSES)} of ${MAX_GUESSES}`} live flicker={!finished} />
            {!finished && <Lamp label="Worth" value={`${pointsFor(guesses.length + 1)} pts`} />}
            <Lamp label="Score" value={score} />
            <Lamp label="Streak" value={streak} />
            <Lamp label="Best" value={best} />
          </LampRow>

          {!finished ? (
            <>
              <PlayerSearchSelect players={players} value={selection} onValueChange={setSelection} placeholder="Who is it?" />
              <ArcadeButton tone="go" wide disabled={!selection} onClick={() => submitGuess(selection)}>
                Submit guess
              </ArcadeButton>
            </>
          ) : (
            <div className={cn('verdict-pill', solved ? 'good' : 'bad')} role="status">
              {solved
                ? pointsFor(guesses.length) > 0
                  ? `Got it in ${guesses.length}! +${pointsFor(guesses.length)} pts · It's ${answer.name}`
                  : `It's ${answer.name}, but every clue was needed: 0 pts`
                : `Out of guesses. It was ${answer.name}`}
            </div>
          )}

          <ArcadeButton tone={finished ? 'go' : 'ghost'} wide onClick={newPuzzle} autoFocus={finished}>
            {finished ? 'Next legend' : 'Skip'}
          </ArcadeButton>
        </div>

        {guesses.length > 0 && (
          <div className="panel">
            <h3>Your guesses</h3>
            <p className="hint gkey">
              Each row is one of your guesses, compared with the mystery player: <b className="turf">green</b> = match,{' '}
              <b className="sky">blue</b> = same division, <b className="gold">yellow</b> = same conference,{' '}
              <b className="flag">red</b> = wrong position (position and team feedback unlock with clues 5 and 6), <b className="orange">orange Higher ▲ / Lower ▼</b> = the mystery player's OVR or rings
              are higher or lower. Gray = no match.
            </p>
            <ol className="glog">
              {guesses.map((g) => {
                const correct = playerKey(g) === playerKey(answer);
                const gTeam = findNFLTeam(g.team);
                const aTeam = findNFLTeam(answer.team);
                return (
                  <li key={playerKey(g)} className={cn('glog-row slide-in', correct && 'solved')}>
                    <div className="glog-name">
                      <span aria-hidden="true" className={correct ? 'turf' : 'flag'}>
                        {correct ? '✓' : '✗'}
                      </span>{' '}
                      {g.name}
                    </div>
                    <div className="glog-tiles">
                      {/* Position and team feedback stay hidden until their clues unlock, so one wrong guess can't give them away */}
                      <Tile label="Pos" value={g.position} state={revealed >= POSITION_CLUE ? (g.position === answer.position ? 'match' : 'wrong') : 'hidden'} />
                      <Tile label="Team" value={gTeam?.abbreviation ?? '—'} state={revealed >= TEAM_CLUE ? teamTile(gTeam, aTeam) : 'hidden'} />
                      <Tile label="OVR" value={ovrOf(g)} state={numberTile(ovrOf(g), ovrOf(answer))} />
                      <Tile label="Rings" value={g.rings} state={numberTile(g.rings, answer.rings)} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
};

export default GuessTheLegend;
