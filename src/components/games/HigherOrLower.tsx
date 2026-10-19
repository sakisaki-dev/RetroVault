import { useCallback, useState } from 'react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import GameBanner from './GameBanner';
import { ArcadeButton, Confetti, CountUp, Lamp, LampRow } from './ArcadeUI';
import {
  STAT_CATEGORIES,
  STAT_KEYS,
  fmt,
  loadGameStat,
  playerKey,
  playersForCategory,
  randomItem,
  saveGameStat,
  type GamePlayer,
  type StatCategory,
} from './gameUtils';

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

const PlayerPanel = ({
  player,
  value,
  hidden,
  category,
  side,
  revealed,
  ovr,
}: {
  player: Player;
  value: number;
  hidden: boolean;
  category: StatCategory;
  side: string;
  revealed: boolean;
  ovr: number | null;
}) => (
  <article className="card rise" aria-label={`${side}: ${player.name}`}>
    {/* OVR, photo and the NFL Legend tag only after the call, so they can't tip the answer */}
    <GameBanner player={player as GamePlayer} ovr={revealed ? ovr : null} reveal={revealed} className="reveal-anim" />
    <div className="card-body" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="era">{category.label}</div>
      {hidden ? (
        <div className="bigval sealed-val" aria-label="hidden">
          ????
        </div>
      ) : (
        <div className="bigval pop">
          <CountUp value={value} format={(n) => fmt(n, category.decimals)} />
        </div>
      )}
      <div className="hint">
        {fmt(player.games)} games
      </div>
    </div>
  </article>
);

const HigherOrLower = ({ players, ovrMap }: { players: Player[]; ovrMap: Map<string, number> }) => {
  const [round, setRound] = useState<Round | null>(() => makeRound(players));
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => loadGameStat(STAT_KEYS.holBest));
  const [confetti, setConfetti] = useState<number | false>(false);

  const answer = useCallback(
    (guessHigher: boolean) => {
      if (!round || result) return;
      const va = round.category.get(round.a);
      const vb = round.category.get(round.b);
      const correct = guessHigher ? vb > va : vb < va;
      setResult(correct ? 'correct' : 'wrong');
      if (correct) {
        const next = streak + 1;
        setStreak(next);
        if (next > best) {
          setBest(next);
          saveGameStat(STAT_KEYS.holBest, next);
        }
        if (next % 10 === 0) setConfetti(Date.now());
      }
    },
    [round, result, streak, best],
  );

  const next = () => {
    if (result === 'wrong') setStreak(0);
    setRound(makeRound(players, result === 'correct' ? round ?? undefined : undefined));
    setResult(null);
  };

  if (!round) return <p className="empty">Not enough players to play yet.</p>;

  const { category, a, b } = round;

  return (
    <div>
      <Confetti fire={confetti} />
      <LampRow className="mb-4">
        <Lamp label="Streak" value={streak} live flicker={streak > 0 && !result} />
        <Lamp label="Best" value={best} />
        <Lamp label="Category" value={category.label} />
      </LampRow>

      <h3 className="question">
        Does {b.name} have more or fewer <b>{category.phrase}</b> than {a.name}?
      </h3>

      <div className={cn('hol-grid', result === 'wrong' && 'shake')} key={`${playerKey(a)}-${playerKey(b)}-${category.key}`}>
        <PlayerPanel player={a} value={category.get(a)} hidden={false} category={category} side="Known" revealed={!!result} ovr={ovrMap.get(playerKey(a)) ?? null} />
        <span className="vs" aria-hidden="true">
          VS
        </span>
        <PlayerPanel player={b} value={category.get(b)} hidden={!result} category={category} side="Mystery value" revealed={!!result} ovr={ovrMap.get(playerKey(b)) ?? null} />
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mt-5">
        {!result ? (
          <>
            <ArcadeButton tone="green" onClick={() => answer(true)} style={{ minWidth: 180 }}>
              ▲ More
            </ArcadeButton>
            <ArcadeButton tone="red" onClick={() => answer(false)} style={{ minWidth: 180 }}>
              ▼ Fewer
            </ArcadeButton>
          </>
        ) : (
          <div className="result" style={{ marginTop: 0, width: '100%' }} role="status">
            <div className={cn('disp pop', result === 'correct' ? 'turf' : 'flag')} style={{ fontSize: 36 }}>
              {result === 'correct' ? 'Correct!' : `Wrong — streak ended at ${streak}`}
            </div>
            <ArcadeButton tone="go" onClick={next} autoFocus>
              {result === 'correct' ? 'Next matchup' : 'Play again'}
            </ArcadeButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default HigherOrLower;
