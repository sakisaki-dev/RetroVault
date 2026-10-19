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

const SIZE = 5;
const POS_OPTIONS: PosFilter[] = ['QB', 'RB', 'WR', 'TE', 'DEF', 'ANY'];

interface Round {
  pos: PosFilter;
  players: GamePlayer[];
  /** slot index -> index into players */
  slots: (number | null)[];
  idx: number;
  done: boolean;
  /** last slot filled (for the pop animation) */
  last: number;
}

const pointsFor = (diff: number) => (diff === 0 ? 2 : diff === 1 ? 1 : 0);

const verdictFor = (pts: number) =>
  pts === 10
    ? 'Perfect board. You know this league cold.'
    : pts >= 8
      ? 'Scout-level read.'
      : pts >= 5
        ? 'Solid, with a couple of reaches.'
        : 'The film room is open all night.';

const BlindRank = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap: Map<string, number> }) => {
  const key = useMemo(() => rankKey(ovrMap), [ovrMap]);

  const poolFor = (pos: PosFilter) => players.filter(matchesPos(pos));
  const deal = (pos: PosFilter): Round | null => {
    const pick = dealDistinct(poolFor(pos), SIZE, key);
    return pick ? { pos, players: pick, slots: Array(SIZE).fill(null), idx: 0, done: false, last: -1 } : null;
  };
  const canPlay = (pos: PosFilter) => dealDistinct(poolFor(pos), SIZE, () => 0) != null;
  const firstPlayable = () => POS_OPTIONS.find(canPlay) ?? 'ANY';

  const [round, setRound] = useState<Round | null>(() => deal(firstPlayable()));
  const [best, setBest] = useState(() => loadGameStat(STAT_KEYS.rankBest, -1));
  const [confetti, setConfetti] = useState<number | false>(false);

  if (!round) return <p className="empty">Not enough players to deal a round of five yet.</p>;

  const truth = round.done ? [...round.players].sort((a, b) => key(b) - key(a)) : null;
  const trueRank = (p: GamePlayer) => (truth ? truth.indexOf(p) + 1 : 0);
  const points = truth ? round.slots.reduce<number>((sum, pi, i) => sum + pointsFor(Math.abs(trueRank(round.players[pi!]) - (i + 1))), 0) : 0;

  const place = (slot: number) => {
    if (round.done || round.slots[slot] != null) return;
    const slots = [...round.slots];
    slots[slot] = round.idx;
    const idx = round.idx + 1;
    const done = idx >= SIZE;
    setRound({ ...round, slots, idx: done ? SIZE - 1 : idx, done, last: slot });
    if (done) {
      const sorted = [...round.players].sort((a, b) => key(b) - key(a));
      unlockCard(slots.flatMap((pi, i) => (sorted.indexOf(round.players[pi!]) === i ? [round.players[pi!]] : [])), 'Blind Rank');
      const pts = slots.reduce<number>((s, pi, i) => s + pointsFor(Math.abs(sorted.indexOf(round.players[pi!]) - i)), 0);
      if (pts > best) {
        setBest(pts);
        saveGameStat(STAT_KEYS.rankBest, pts);
      }
      if (pts === 10) setConfetti(Date.now());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const restart = (p: PosFilter) => setRound(deal(canPlay(p) ? p : firstPlayable()));
  const current = round.players[round.idx];
  const posOptions = POS_OPTIONS.map((p) => ({ value: p, label: p === 'ANY' ? 'Any pos' : p, disabled: !canPlay(p) }));
  const ovrOf = (p: GamePlayer) => ovrMap.get(playerKey(p)) ?? 62;

  return (
    <div>
      <Confetti fire={confetti} />
      <div className="controls">
        <ChipGroup label="Position" value={round.pos} options={posOptions} onChange={restart} />
        <LampRow>
          <Lamp label={round.done ? 'Round final' : `Player ${round.idx + 1} of ${SIZE}`} live flicker={!round.done} />
          <Lamp label="Best" value={best >= 0 ? `${best}/10` : '—'} />
        </LampRow>
      </div>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Ranked by OVR. Exact slot +2, one off +1.
      </p>

      {!round.done ? (
        <div key={playerKey(current)}>
          {/* Name and team are part of the puzzle; OVR, photo and the NFL Legend tag stay sealed until the reveal */}
          <GameBanner player={current} size="hero" nameAs="h3" eyebrow={`Player ${round.idx + 1} of ${SIZE} · ${current.position}`} className="anim-stage" />
          <StatBlock player={current} big countUp className="anim-rise" />
          <div className="progress5">
            <Dots total={SIZE} current={round.idx} />
            <span>{SIZE - 1 - round.idx} still to come · slots are final</span>
          </div>
        </div>
      ) : (
        <>
          <ResultPanel
            score={
              <>
                <CountUp value={points} />
                /10
              </>
            }
            verdict={verdictFor(points)}
            action={
              <ArcadeButton tone="go" onClick={() => restart(round.pos)} autoFocus>
                Next round
              </ArcadeButton>
            }
          />
          <h3 className="round-title" style={{ marginTop: 22 }}>
            The <span>true</span> order
          </h3>
          <ol className="board5">
            {truth!.map((p, i) => (
              <li key={playerKey(p)}>
                <BoardCard player={p} no={i + 1} ovr={ovrOf(p)} reveal className="anim-deal" delay={0.9 + i * 0.12}>
                  <span className="res gold">
                    OVR {ovrOf(p)} · {p.position}
                  </span>
                </BoardCard>
              </li>
            ))}
          </ol>
          <h3 className="round-title" style={{ marginTop: 22 }}>
            Your <span>board</span>
          </h3>
        </>
      )}

      <ol className="board5" aria-label="Your board">
        {round.slots.map((pi, i) => {
          if (pi == null) {
            return (
              <li key={i}>
                <button type="button" className="b5 open" onClick={() => place(i)} aria-label={`Place ${current.name} at number ${i + 1}`}>
                  <span className="no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="cta">Place at #{i + 1}</span>
                </button>
              </li>
            );
          }
          const p = round.players[pi];
          if (!round.done) {
            return (
              <li key={i}>
                <BoardCard player={p} no={i + 1} className={i === round.last ? 'anim-pop' : undefined} />
              </li>
            );
          }
          const tr = trueRank(p);
          const pts = pointsFor(Math.abs(tr - (i + 1)));
          return (
            <li key={i}>
              <BoardCard player={p} no={i + 1} ovr={ovrOf(p)} reveal className="anim-flip" delay={i * 0.18}>
                <span className={`res p${pts}`}>
                  True #{tr} · +{pts}
                </span>
              </BoardCard>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default BlindRank;
