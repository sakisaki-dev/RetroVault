import { useCallback, useEffect, useRef, useState } from 'react';
import { awardPack } from '@/utils/collection';
import InLeague from '@/components/InLeague';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { useJerseyNumbers } from '@/utils/jerseys';
import { Confetti, CountUp } from './ArcadeUI';
import {
  STAT_CATEGORIES,
  STAT_KEYS,
  fmt,
  isLegend,
  legendLabel,
  loadGameStat,
  playerKey,
  playersForCategory,
  randomItem,
  saveGameStat,
  type GamePlayer,
  type StatCategory,
} from './gameUtils';
import { ClubLogo, playerClub, splitName, useReducedMotion } from './stageKit';
import HowToStrip from './HowToStrip';
import GameSprite from '../GameSprite';
import './higherLower.css';

interface Round {
  category: StatCategory;
  a: Player;
  b: Player;
}

/** Picks a category and two players with different values for it. League-only metrics never include legends. */
const makeRound = (players: Player[], previous?: Round): Round | null => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const category = randomItem(STAT_CATEGORIES);
    const pool = playersForCategory(players, category);
    if (pool.length < 2) continue;
    // Carry the previous "challenger" forward as the new anchor when it fits, like the classic game.
    const a = previous && attempt < 10 && pool.some((p) => playerKey(p) === playerKey(previous.b)) ? previous.b : randomItem(pool);
    const others = pool.filter((p) => playerKey(p) !== playerKey(a) && category.get(p) !== category.get(a));
    if (others.length === 0) continue;
    return { category, a, b: randomItem(others) };
  }
  return null;
};

/** Streak length that earns a pack (every 5th, Premium on every 15th). */
const PACK_EVERY = 5;
/** How long the mystery number rolls before the verdict lands. */
const ROLL_MS = 1100;

interface Won {
  id: string;
  category: StatCategory;
  a: Player;
  b: Player;
}

/** One side of the head-to-head: the player's card in club colours with the stat plate under it. */
const Fighter = ({
  player,
  value,
  category,
  side,
  sealed,
  revealed,
  winner,
  ovr,
  rollMs,
}: {
  player: Player;
  value: number;
  category: StatCategory;
  side: 'known' | 'mystery';
  sealed: boolean;
  revealed: boolean;
  winner: boolean | null;
  ovr: number | null;
  rollMs: number;
}) => {
  const look = playerClub(player);
  const { numberFor } = useJerseyNumbers();
  const { first, last } = splitName(player.name);
  const legend = isLegend(player);
  // The games line would give the answer away when the category is games
  const showGames = !sealed || category.key !== 'games';
  return (
    <article
      className={cn('hl-fighter', side, revealed && (winner ? 'win' : 'lose'))}
      style={look.vars}
      aria-label={`${side === 'known' ? 'Known' : 'Challenger'}: ${player.name}, ${look.name}${sealed ? `, ${category.label} hidden` : `, ${fmt(value, category.decimals)} ${category.label}`}`}
    >
      <div className="hl-card">
        <ClubLogo look={look} className="hl-card-logo" />
        <span className="hl-card-num" aria-hidden="true">
          {numberFor(player as GamePlayer)}
        </span>
        <GameSprite player={player} legend={legend} kind="figure" size="l" action={revealed && winner ? 'celebrate' : 'idle'} className="hl-card-sprite" />
        <div className="hl-card-tags">
          <span className="hl-pos">{player.position}</span>
          <InLeague player={player} />
          {revealed && ovr != null && <span className="hl-ovr">{ovr} OVR</span>}
          {revealed && legend && <span className="hl-legend">{legendLabel(player)}</span>}
        </div>
        <div className="hl-card-name">
          {first && <span className="first">{first}</span>}
          <span className="last">{last}</span>
        </div>
        <span className="hl-card-club">{look.abbr}</span>
      </div>
      <div className="hl-plate">
        <span className="hl-plate-k">{category.label}</span>
        {sealed ? (
          <span className="hl-plate-v sealed" aria-hidden="true">
            <i>?</i>
            <i>?</i>
            <i>?</i>
          </span>
        ) : (
          <span className="hl-plate-v num">
            {side === 'mystery' ? <CountUp value={value} duration={rollMs} format={(n) => fmt(n, category.decimals)} /> : fmt(value, category.decimals)}
          </span>
        )}
        <span className="hl-plate-games">{showGames ? `${fmt(player.games)} games` : 'games hidden'}</span>
      </div>
    </article>
  );
};

const HigherOrLower = ({ players, ovrMap }: { players: Player[]; ovrMap: Map<string, number> }) => {
  const reduced = useReducedMotion();
  const rollMs = reduced ? 0 : ROLL_MS;
  const [round, setRound] = useState<Round | null>(() => makeRound(players));
  const [roundNo, setRoundNo] = useState(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [guess, setGuess] = useState<'more' | 'fewer' | null>(null);
  // The verdict lands after the mystery number has rolled up
  const [settled, setSettled] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => loadGameStat(STAT_KEYS.holBest));
  const [startBest, setStartBest] = useState(best);
  const [confetti, setConfetti] = useState<number | false>(false);
  const [run, setRun] = useState<Won[]>([]);
  const nextRef = useRef<HTMLButtonElement>(null);

  const answer = useCallback(
    (guessHigher: boolean) => {
      if (!round || result) return;
      const va = round.category.get(round.a);
      const vb = round.category.get(round.b);
      const correct = guessHigher ? vb > va : vb < va;
      setGuess(guessHigher ? 'more' : 'fewer');
      setResult(correct ? 'correct' : 'wrong');
      setSettled(false);
      if (correct) {
        const next = streak + 1;
        if (next % 15 === 0) awardPack('premium', `Higher or Lower, ${next} in a row`, { once: round });
        else if (next % PACK_EVERY === 0) awardPack('standard', `Higher or Lower, ${next} in a row`, { once: round });
        setStreak(next);
        setRun((r) => [...r, { id: `${roundNo}`, ...round }]);
        if (next > best) {
          setBest(next);
          saveGameStat(STAT_KEYS.holBest, next);
        }
        if (next % 10 === 0) setConfetti(Date.now());
      }
    },
    [round, result, streak, best, roundNo],
  );

  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(() => setSettled(true), rollMs + 80);
    return () => window.clearTimeout(t);
  }, [result, rollMs]);

  useEffect(() => {
    if (settled) nextRef.current?.focus({ preventScroll: true });
  }, [settled]);

  const next = useCallback(() => {
    if (result === 'wrong') {
      setStreak(0);
      setRun([]);
      setStartBest(best);
    }
    setRound(makeRound(players, result === 'correct' ? round ?? undefined : undefined));
    setRoundNo((n) => n + 1);
    setResult(null);
    setGuess(null);
    setSettled(false);
  }, [result, best, players, round]);

  // Keyboard: ↑ / ↓ to call it, Enter or Space moves on (ignored while typing anywhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!result && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        answer(e.key === 'ArrowUp');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, result]);

  if (!round) return <p className="arc-empty">Not enough players to play yet.</p>;

  const { category, a, b } = round;
  const va = category.get(a);
  const vb = category.get(b);
  const bLast = splitName(b.name).last;
  const aLast = splitName(a.name).last;
  const toPack = PACK_EVERY - (streak % PACK_EVERY);
  const gameOver = result === 'wrong' && settled;
  const diff = Math.abs(vb - va);

  return (
    <div className="hl">
      <Confetti fire={confetti} />
      <HowToStrip
        id="hol"
        accent="var(--sky, #5cc8ff)"
        steps={[
          <>
            The <strong>left</strong> card shows its number. The <strong>challenger</strong> on the right hides his.
          </>,
          <>
            Call it: does the challenger have <strong>more</strong> or <strong>fewer</strong>? Keys ↑ and ↓ work too.
          </>,
          <>
            Right calls build a <strong>streak</strong>. Every 5 in a row earns a pack. One miss ends the run.
          </>,
        ]}
      />

      <div className="hl-hud">
        <div className="hl-streak">
          <span className="k">Streak</span>
          <span key={streak} className={cn('v num', streak > 0 && 'bump')} aria-live="polite">
            {streak}
          </span>
        </div>
        <div className="hl-meter" role="img" aria-label={`${toPack} more for a pack`}>
          <span className="k">{toPack === PACK_EVERY && streak > 0 ? 'Pack earned' : `Pack in ${toPack}`}</span>
          <span className="hl-meter-bar">
            {Array.from({ length: PACK_EVERY }, (_, i) => (
              <i key={i} className={cn(i < streak % PACK_EVERY || (streak > 0 && streak % PACK_EVERY === 0) ? 'on' : '')} />
            ))}
          </span>
        </div>
        <div className="hl-streak best">
          <span className="k">Best</span>
          <span className="v num">{best}</span>
        </div>
      </div>

      <div className="hl-arena">
        <div className="hl-cat" key={`cat-${roundNo}`}>
          <span className="hl-cat-k">{/career/i.test(category.label) ? 'Stat' : 'Career'}</span>
          <span className="hl-cat-v">{category.label}</span>
        </div>
        <h3 className="hl-q">
          Does <b style={{ color: playerClub(b).ink }}>{bLast}</b> have more or fewer {category.phrase} than <b style={{ color: playerClub(a).ink }}>{aLast}</b>?
        </h3>

        <div className={cn('hl-stage', result === 'wrong' && settled && 'shake')} key={`stage-${roundNo}`}>
          <Fighter player={a} value={va} category={category} side="known" sealed={false} revealed={settled} winner={settled ? va > vb : null} ovr={ovrMap.get(playerKey(a)) ?? null} rollMs={rollMs} />
          <div className={cn('hl-vs', result && 'rolling', settled && 'done')} aria-hidden="true">
            <span>VS</span>
          </div>
          <Fighter player={b} value={vb} category={category} side="mystery" sealed={!result} revealed={settled} winner={settled ? vb > va : null} ovr={ovrMap.get(playerKey(b)) ?? null} rollMs={rollMs} />
          {settled && (
            <div className={cn('hl-stamp', result === 'correct' ? 'good' : 'bad')} role="status">
              <b>{result === 'correct' ? 'Correct' : 'Wrong'}</b>
              <span>
                {bLast} has {fmt(diff, category.decimals)} {vb > va ? 'more' : 'fewer'}
              </span>
            </div>
          )}
        </div>

        {!result ? (
          <div className="hl-calls" role="group" aria-label={`Does ${b.name} have more or fewer ${category.phrase} than ${a.name}?`}>
            <button type="button" className="hl-call more" onClick={() => answer(true)}>
              <span className="arrow" aria-hidden="true">
                ▲
              </span>
              More
            </button>
            <button type="button" className="hl-call fewer" onClick={() => answer(false)}>
              <span className="arrow" aria-hidden="true">
                ▼
              </span>
              Fewer
            </button>
          </div>
        ) : !settled ? (
          <div className="hl-calls locked" aria-hidden="true">
            <span className={cn('hl-call', guess === 'more' ? 'more' : 'fewer', 'picked')}>
              <span className="arrow">{guess === 'more' ? '▲' : '▼'}</span>
              {guess === 'more' ? 'More' : 'Fewer'} locked
            </span>
          </div>
        ) : result === 'correct' ? (
          <div className="hl-calls">
            <button type="button" className="btn go wide hl-next" ref={nextRef} onClick={next}>
              Next matchup →
            </button>
          </div>
        ) : null}
      </div>

      {gameOver && (
        <section className="hl-over" aria-label="Run over">
          <div className="hl-over-top">
            <div>
              <span className="hl-over-k">Run over</span>
              <span className="hl-over-v num">
                <CountUp value={streak} duration={600} />
              </span>
              <span className="hl-over-sub">{streak === 1 ? 'right call' : 'right calls in a row'}</span>
            </div>
            <div className="hl-over-best">
              {streak > startBest ? <span className="hl-newbest">New best</span> : <span>Best {best}</span>}
              <span className="hl-over-pack">{streak >= PACK_EVERY ? `${Math.floor(streak / PACK_EVERY)} pack${streak >= PACK_EVERY * 2 ? 's' : ''} earned` : `${PACK_EVERY - streak} short of a pack`}</span>
            </div>
          </div>
          {run.length > 0 && (
            <ol className="hl-run" aria-label="Your run">
              {run.slice(-8).map((w, i) => {
                const wa = w.category.get(w.a);
                const wb = w.category.get(w.b);
                return (
                  <li key={w.id} style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="hl-run-cat">{w.category.label}</span>
                    <span className="hl-run-names">
                      <b style={{ color: playerClub(w.b).ink }}>{splitName(w.b.name).last}</b> {fmt(wb, w.category.decimals)}
                      <i>{wb > wa ? '>' : '<'}</i>
                      <b style={{ color: playerClub(w.a).ink }}>{splitName(w.a.name).last}</b> {fmt(wa, w.category.decimals)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <button type="button" className="btn go wide" ref={nextRef} onClick={next}>
            Play again
          </button>
        </section>
      )}
    </div>
  );
};

export default HigherOrLower;
