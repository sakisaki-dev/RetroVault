import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { awardPack } from '@/utils/collection';
import InLeague from '@/components/InLeague';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import type { Player } from '@/types/player';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { cn } from '@/lib/utils';
import { playerSkillGrades } from '@/config/skillGrades';
import GameBanner from './GameBanner';
import { ArcadeButton, Confetti, CountUp, Lamp, TeamLogo } from './ArcadeUI';
import HowToStrip from './HowToStrip';
import { getTeamTextColor } from '@/utils/teamColors';
import './guessTheLegend.css';
import { bannerTeamOf } from '@/utils/playerExtras';
import {
  MYSTERY_STYLE,
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
  teamStyle,
  teamVars,
  type GamePlayer,
} from './gameUtils';

/** A player's club colour, lifted to read on the dark arcade. */
const teamInk = (p: Player) => getTeamTextColor(bannerTeamOf(p)) ?? 'var(--chalk)';

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
  const team = findNFLTeam(bannerTeamOf(p));
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
                <span className="truncate">{team?.name ?? (bannerTeamOf(p) || 'Unlisted')}</span>
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

  const points = solved ? pointsFor(guesses.length) : 0;
  const worth = pointsFor(guesses.length + 1);
  const lastGuess = guesses.length ? guesses[guesses.length - 1] : null;
  // Newest clue first, so the one a miss just unlocked sits right under the guess bar
  const openClues = clues.map((c, i) => ({ c, i })).filter(({ i }) => i < revealed).reverse();
  const lockedCount = clues.length - revealed;
  const answerInk = teamInk(answer);

  const guessRow = (g: Player, latest = false) => {
    const correct = playerKey(g) === playerKey(answer);
    const gTeam = findNFLTeam(bannerTeamOf(g));
    const aTeam = findNFLTeam(bannerTeamOf(answer));
    return (
      <li key={playerKey(g)} className={cn('gl-row', correct && 'solved', latest && 'latest')}>
        <div className="gl-row-name">
          <span aria-hidden="true" className={cn('gl-row-mark', correct ? 'turf' : 'flag')}>
            {correct ? '✓' : '✗'}
          </span>
          <TeamLogo team={gTeam} className="gl-row-logo" />
          <span className="gl-row-nm" style={{ color: teamInk(g) }}>
            {g.name}
          </span>
          <InLeague player={g} label={false} />
        </div>
        <div className="glog-tiles">
          {/* Position and team feedback stay hidden until their clues unlock, so one wrong guess can't give them away */}
          <Tile label="Pos" value={g.position} state={revealed >= POSITION_CLUE ? (g.position === answer.position ? 'match' : 'wrong') : 'hidden'} />
          <Tile label="Team" value={gTeam?.abbreviation ?? '-'} state={revealed >= TEAM_CLUE ? teamTile(gTeam, aTeam) : 'hidden'} />
          <Tile label="OVR" value={ovrOf(g)} state={numberTile(ovrOf(g), ovrOf(answer))} />
          <Tile label="Rings" value={g.rings} state={numberTile(g.rings, answer.rings)} />
        </div>
      </li>
    );
  };

  return (
    <div className="gl">
      <Confetti fire={confetti} />
      <HowToStrip
        id="legend"
        steps={[
          <>A mystery player hides behind the card. Clue 1 is open.</>,
          <>Search a name and press Guess. Every miss unlocks the next clue and the prize drops by a point.</>,
          <>Name him early: 5 points on clue 1, nothing if every clue was needed.</>,
        ]}
      />

      <div className="gl-grid">
        <section className="gl-stage" aria-label="Mystery player">
          <div className="gl-stats">
            <Lamp label="Score" value={score} />
            <Lamp label="Streak" value={streak} flicker={streak > 0 && !finished} />
            <Lamp label="Best" value={best} />
          </div>

          {finished ? (
            <div className="gl-revealed" key={`r-${playerKey(answer)}`}>
              <GameBanner player={answer as GamePlayer} ovr={ovrOf(answer)} reveal className="flip-y" />
            </div>
          ) : (
            <MysteryCard
              key={`m-${playerKey(answer)}`}
              answer={answer}
              revealed={revealed}
              ovr={ovrOf(answer)}
              shake={misses}
            />
          )}

          <ol className="gl-meter" aria-label={`Clue ${revealed} of ${clues.length} open`}>
            {clues.map((c, i) => (
              <li
                key={c.title}
                className={cn(i < revealed && 'on', i === revealed - 1 && !finished && 'now', solved && i === guesses.length - 1 && 'hit')}
                title={`Clue ${i + 1}: ${c.title}`}
              >
                <span className="gl-meter-pts" aria-hidden="true">
                  {pointsFor(i + 1)}
                </span>
              </li>
            ))}
          </ol>

          {!finished ? (
            <div className="gl-guess">
              <div className="gl-guess-k" id="gl-guess-label">
                <span>
                  Guess <b>{guesses.length + 1}</b> of {MAX_GUESSES}
                </span>
                <span className={cn('gl-worth', worth <= 1 && 'low')} aria-live="polite">
                  Worth <b>{worth}</b> {worth === 1 ? 'pt' : 'pts'}
                </span>
              </div>
              <div className="gl-guess-row">
                <div className="gl-guess-pick">
                  <PlayerSearchSelect players={players} value={selection} onValueChange={setSelection} placeholder="Who is it?" ariaLabel="Your guess" />
                </div>
                <ArcadeButton tone="go" disabled={!selection} onClick={() => submitGuess(selection)}>
                  Guess
                </ArcadeButton>
              </div>
              {lastGuess && (
                <div className="gl-last" key={`last-${guesses.length}`} role="status">
                  <p className="gl-last-k">
                    Not him. <b>Clue {revealed}</b> is open below.
                  </p>
                  <ol className="gl-rows">{guessRow(lastGuess, true)}</ol>
                </div>
              )}
              <button type="button" className="gl-skip" onClick={newPuzzle}>
                Skip this legend
              </button>
            </div>
          ) : (
            <div className={cn('gl-result', solved && points > 0 ? 'good' : 'bad')} role="status">
              <div className="gl-result-pts num">
                {points > 0 ? (
                  <>
                    +<CountUp value={points} />
                  </>
                ) : (
                  '0'
                )}
                <small>{points === 1 ? 'pt' : 'pts'}</small>
              </div>
              <div className="gl-result-line">
                {solved ? (points > 0 ? `Named on clue ${guesses.length} of ${MAX_GUESSES}` : 'Named, but every clue was needed') : 'Out of guesses'}
              </div>
              <div className="gl-result-name">
                {solved ? 'It is ' : 'It was '}
                <b style={{ color: answerInk }}>{answer.name}</b> <InLeague player={answer} />
              </div>
              <div className="gl-result-streak px">
                {points > 0 ? `Streak ${streak}${streak > 0 && streak === best ? ' · best ever' : ''}` : 'Streak reset'}
              </div>
              <ArcadeButton tone="go" wide onClick={newPuzzle} autoFocus>
                Next legend
              </ArcadeButton>
            </div>
          )}
        </section>

        <section className="gl-clues" aria-label="Clues">
          <h3 className="gl-h">
            Clues <span>{finished ? 'all open' : `${revealed} of ${clues.length} open`}</span>
          </h3>
          <ol className="gl-clue-list">
            {openClues.map(({ c, i }) => {
              const fresh = i === revealed - 1 && !finished;
              return (
                <li key={c.title} className={cn('gl-clue', fresh && 'fresh')}>
                  <h4>
                    <span className="gl-clue-no" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="gl-clue-t">
                      <span className="sr-only">Clue {i + 1}: </span>
                      {c.title}
                    </span>
                    {fresh && guesses.length > 0 && <span className="gl-new">New</span>}
                  </h4>
                  <dl className="stats">{c.content}</dl>
                </li>
              );
            })}
          </ol>
          {lockedCount > 0 && (
            <ol className="gl-locked" aria-label="Locked clues" start={revealed + 1}>
              {clues.slice(revealed).map((c, k) => (
                <li key={c.title}>
                  <span className="gl-lock" aria-hidden="true" />
                  <span>
                    Clue {revealed + k + 1} · {c.title}
                  </span>
                  <span className="gl-locked-k">after miss {revealed + k}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {guesses.length > 0 && (
          <section className="gl-log" aria-label="Your guesses">
            <h3 className="gl-h">
              Your guesses <span>{guesses.length}</span>
            </h3>
            <ol className="gl-rows">{guesses.map((g) => guessRow(g))}</ol>
            <details className="gl-key">
              <summary>How to read the tiles</summary>
              <p>
                Each tile compares your guess with the mystery player. <b className="turf">Green</b> is a match, <b className="sky">blue</b> the same
                division, <b className="gold">yellow</b> the same conference, <b className="flag">red</b> a different position, and{' '}
                <b className="orange">Higher ▲ / Lower ▼</b> says where his OVR or rings sit. Position and team tiles open with clues 5 and 6.
              </p>
            </details>
          </section>
        )}
      </div>
    </div>
  );
};

/** Football-player silhouette (helmet and shoulder pads) for the sealed card. */
const Silhouette = () => (
  <svg className="gl-sil" viewBox="0 0 160 150" aria-hidden="true">
    <path
      d="M80 10c-27 0-46 18-46 42 0 12 4 22 11 29l-3 9C20 95 8 106 4 124l-4 26h160l-4-26c-4-18-16-29-38-34l-3-9c7-7 11-17 11-29 0-24-19-42-46-42z"
      fill="currentColor"
    />
    <path d="M104 52h22M104 64h20M112 46v28" stroke="#0006" strokeWidth="5" strokeLinecap="round" fill="none" />
  </svg>
);

/** The sealed card: a silhouette that takes on what the clues reveal (OVR from clue 1, position at 5, club colours and initials at 6). */
const MysteryCard = ({ answer, revealed, ovr, shake }: { answer: Player; revealed: number; ovr: number; shake: number }) => {
  const teamKnown = revealed >= TEAM_CLUE;
  const posKnown = revealed >= POSITION_CLUE;
  const style = teamKnown ? teamStyle(bannerTeamOf(answer)) : MYSTERY_STYLE;
  const initials = answer.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]}.`)
    .join(' ');
  return (
    <div
      className={cn('gl-card', teamKnown && 'tinted', shake > 0 && 'shake')}
      key={`card-${shake}`}
      style={teamVars(style)}
      role="img"
      aria-label={`Mystery player card. OVR ${ovr}${posKnown ? `, ${answer.position}` : ''}${teamKnown ? `, ${style.team?.name ?? 'unknown club'}, initials ${initials}` : ''}.`}
    >
      <span className="gl-card-rays" aria-hidden="true" />
      {teamKnown && <TeamLogo team={style.team} className="gl-card-logo" />}
      <Silhouette />
      <span className="gl-card-q" aria-hidden="true">
        ?
      </span>
      <div className="gl-card-ovr" aria-hidden="true">
        <b className="num">{ovr}</b>
        <span>OVR</span>
      </div>
      <div className={cn('gl-card-pos', posKnown && 'on')} aria-hidden="true">
        {posKnown ? answer.position : '??'}
      </div>
      <div className="gl-card-plate" aria-hidden="true">
        <span>{teamKnown ? style.team?.name ?? 'Mystery player' : 'Mystery player'}</span>
        <b>{teamKnown ? initials : '? ? ?'}</b>
      </div>
    </div>
  );
};

export default GuessTheLegend;
