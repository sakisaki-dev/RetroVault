import { useMemo, useState } from 'react';
import { unlockCard } from '@/utils/collection';
import { StatBlock } from './ArcadeParts';
import GameBanner, { BoardCard } from './GameBanner';
import { ArcadeButton, ChipGroup, Confetti, CountUp, Dots, Lamp, LampRow, ResultPanel } from './ArcadeUI';
import {
  STAT_KEYS,
  dealDistinct,
  loadGameStat,
  matchesPos,
  playerKey,
  rankKey,
  saveGameStat,
  type GamePlayer,
  type PosFilter,
} from './gameUtils';

const SIZE = 6;
const KEEP = 3;
const POS_OPTIONS: PosFilter[] = ['ANY', 'QB', 'RB', 'WR', 'TE', 'DB', 'DEF'];

type Choice = 'keep' | 'cut';

interface Round {
  pos: PosFilter;
  players: GamePlayer[];
  /** choice[i] for players[i], filled in order */
  choice: Choice[];
  idx: number;
  done: boolean;
}

const verdictFor = (got: number) =>
  got === 3 ? 'Front office material.' : got === 2 ? 'One bad call.' : got === 1 ? 'You cut a future Hall of Famer.' : 'Fired before training camp.';

/** Keep 3, Cut 3 — blind: six players arrive one at a time and each call is final. */
const KeepCut = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap: Map<string, number> }) => {
  const key = useMemo(() => rankKey(ovrMap), [ovrMap]);

  const poolFor = (pos: PosFilter) => players.filter(matchesPos(pos));
  const deal = (pos: PosFilter): Round | null => {
    const pick = dealDistinct(poolFor(pos), SIZE, key);
    return pick ? { pos, players: pick, choice: [], idx: 0, done: false } : null;
  };
  const canPlay = (pos: PosFilter) => dealDistinct(poolFor(pos), SIZE, () => 0) != null;
  const firstPlayable = () => POS_OPTIONS.find(canPlay) ?? 'ANY';

  const [round, setRound] = useState<Round | null>(() => deal(firstPlayable()));
  const [totals, setTotals] = useState(() => ({ correct: loadGameStat(STAT_KEYS.kcCorrect), rounds: loadGameStat(STAT_KEYS.kcRounds) }));
  const [confetti, setConfetti] = useState<number | false>(false);

  if (!round) return <p className="empty">Not enough players to deal six yet.</p>;

  const sorted = round.done ? [...round.players].sort((a, b) => key(b) - key(a)) : null;
  const rankOf = (p: GamePlayer) => (sorted ? sorted.indexOf(p) + 1 : 0);
  const got = sorted ? round.players.filter((p, i) => round.choice[i] === 'keep' && rankOf(p) <= KEEP).length : 0;
  const keeps = round.choice.filter((c) => c === 'keep').length;
  const cuts = round.choice.filter((c) => c === 'cut').length;
  const current = round.players[round.idx];
  const ovrOf = (p: GamePlayer) => ovrMap.get(playerKey(p)) ?? 62;

  const decide = (c: Choice) => {
    if (round.done) return;
    const choice = [...round.choice, c];
    const idx = round.idx + 1;
    if (idx < SIZE) {
      setRound({ ...round, choice, idx });
      return;
    }
    const truth = [...round.players].sort((a, b) => key(b) - key(a));
    const score = round.players.filter((p, i) => choice[i] === 'keep' && truth.indexOf(p) < KEEP).length;
    setRound({ ...round, choice, idx: SIZE - 1, done: true });
    unlockCard(round.players.filter((p, i) => choice[i] === 'keep' && truth.indexOf(p) < KEEP), 'Keep 3 / Cut 3');
    const next = { correct: totals.correct + score, rounds: totals.rounds + 1 };
    setTotals(next);
    saveGameStat(STAT_KEYS.kcCorrect, next.correct);
    saveGameStat(STAT_KEYS.kcRounds, next.rounds);
    if (score === KEEP) setConfetti(Date.now());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const restart = (p: PosFilter) => setRound(deal(canPlay(p) ? p : firstPlayable()));
  const posOptions = POS_OPTIONS.map((p) => ({ value: p, label: p === 'ANY' ? 'Any pos' : p, disabled: !canPlay(p) }));

  const bin = (type: Choice) => {
    const ids = round.choice.map((c, i) => (c === type ? i : -1)).filter((i) => i >= 0);
    return [0, 1, 2].map((j) => {
      const i = ids[j];
      if (i == null) {
        return (
          <div key={j} className="b5">
            <span className="no" aria-hidden="true">
              {type === 'keep' ? 'K' : 'C'}
            </span>
            <span className="cta">{type === 'keep' ? 'Open keep slot' : 'Open cut slot'}</span>
          </div>
        );
      }
      const p = round.players[i];
      if (!round.done) {
        return <BoardCard key={j} player={p} no={type === 'keep' ? 'K' : 'C'} className={i === round.idx - 1 ? 'anim-pop' : undefined} />;
      }
      const r = rankOf(p);
      const right = type === 'keep' ? r <= KEEP : r > KEEP;
      const upset =
        type === 'cut' && r === 1
          ? 'Upset · you cut the #1'
          : type === 'cut' && r <= KEEP
            ? 'Upset · cut a top-3 career'
            : type === 'keep' && r === SIZE
              ? 'Upset · kept the worst of six'
              : '';
      return (
        <BoardCard key={j} player={p} no={type === 'keep' ? 'K' : 'C'} ovr={ovrOf(p)} reveal className="anim-flip" delay={j * 0.25 + (type === 'cut' ? 0.75 : 0)}>
          <span className={`res ${right ? 'p2' : 'p0'}`}>
            True #{r} of {SIZE} · {right ? 'Right' : 'Wrong'}
          </span>
          {upset && <span className="res p1">{upset}</span>}
        </BoardCard>
      );
    });
  };

  return (
    <div>
      <Confetti fire={confetti} />
      <div className="controls">
        <ChipGroup label="Position" value={round.pos} options={posOptions} onChange={restart} />
        <LampRow>
          <Lamp label={round.done ? `${got}/3 correct` : `Player ${round.idx + 1} of ${SIZE}`} live flicker={!round.done} />
          <Lamp label="Lifetime" value={totals.rounds ? `${totals.correct}/${totals.rounds * KEEP}` : '—'} />
        </LampRow>
      </div>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Six players, one at a time. Keep the three highest OVRs.
      </p>

      {!round.done ? (
        <div key={playerKey(current)}>
          {/* Name and team are part of the puzzle; OVR, photo and the NFL Legend tag stay sealed until the reveal */}
          <GameBanner player={current} size="hero" nameAs="h3" eyebrow={`Player ${round.idx + 1} of ${SIZE} · ${current.position}`} className="anim-stage" />
          <StatBlock player={current} big countUp className="anim-rise" />
          <div className="kc-decide">
            <ArcadeButton tone="green" disabled={keeps >= KEEP} onClick={() => decide('keep')} aria-label={`Keep ${current.name}`}>
              {keeps >= KEEP ? 'Keep slots full' : `Keep · ${KEEP - keeps} left`}
            </ArcadeButton>
            <ArcadeButton tone="red" disabled={cuts >= SIZE - KEEP} onClick={() => decide('cut')} aria-label={`Cut ${current.name}`}>
              {cuts >= SIZE - KEEP ? 'Cut slots full' : `Cut · ${SIZE - KEEP - cuts} left`}
            </ArcadeButton>
          </div>
          <div className="progress5">
            <Dots total={SIZE} current={round.idx} />
            <span>{SIZE - 1 - round.idx} still to come · you can't see who's next</span>
          </div>
        </div>
      ) : (
        <>
          <ResultPanel
            score={
              <>
                <CountUp value={got} />
                /3
              </>
            }
            verdict={verdictFor(got)}
            detail={`Lifetime: ${totals.correct}/${totals.rounds * KEEP} correct keeps`}
            action={
              <ArcadeButton tone="go" onClick={() => restart(round.pos)} autoFocus>
                New six
              </ArcadeButton>
            }
          />
          <h3 className="round-title" style={{ marginTop: 22 }}>
            The <span>true</span> order
          </h3>
          <ol className="board6">
            {sorted!.map((p, i) => (
              <li key={playerKey(p)}>
                <BoardCard
                  player={p}
                  no={i + 1}
                  ovr={ovrOf(p)}
                  reveal
                  className="anim-deal"
                  delay={1.6 + i * 0.12}
                  meta={`OVR ${ovrOf(p)} · ${p.position} · ${
                    round.choice[round.players.indexOf(p)] === 'keep' ? 'You kept' : 'You cut'
                  }`}
                />
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="kc-bins">
        <div>
          <h3 className="bin-h keep">Kept</h3>
          <div className="bin3">{bin('keep')}</div>
        </div>
        <div>
          <h3 className="bin-h cut">Cut</h3>
          <div className="bin3">{bin('cut')}</div>
        </div>
      </div>
    </div>
  );
};

export default KeepCut;
