import { useEffect, useMemo, useRef, useState } from 'react';
import { awardPack } from '@/utils/collection';
import { cn } from '@/lib/utils';
import { ArcadeButton, ChipGroup, Confetti, CountUp } from './ArcadeUI';
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
import { DeckCard, Hud, HudStat, Land, Pips, Slab, launchFrom, teamLook, usePointerDrag, useRevealClock } from './rosterKit';
import HowToStrip from './HowToStrip';
import './blindrank.css';

const SIZE = 5;
const POS_OPTIONS: PosFilter[] = ['QB', 'RB', 'WR', 'TE', 'DEF', 'ANY'];

interface Round {
  pos: PosFilter;
  players: GamePlayer[];
  /** slot index -> index into players */
  slots: (number | null)[];
  idx: number;
  done: boolean;
  /** last slot filled (for the landing animation) */
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
  const stageRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  const reveal = useRevealClock(!!round?.done, SIZE, 420, 200, round?.players);

  const place = (slot: number, from?: Element | null) => {
    if (!round || round.done || round.slots[slot] != null) return;
    launchFrom(from ?? faceRef.current);
    const slots = [...round.slots];
    slots[slot] = round.idx;
    const idx = round.idx + 1;
    const done = idx >= SIZE;
    setRound({ ...round, slots, idx: done ? SIZE - 1 : idx, done, last: slot });
    played.current = true;
    if (done) {
      const sorted = [...round.players].sort((a, b) => key(b) - key(a));
      const pts = slots.reduce<number>((s, pi, i) => s + pointsFor(Math.abs(sorted.indexOf(round.players[pi!]) - i)), 0);
      if (pts === 10) awardPack('premium', 'Blind Rank perfect round', { once: round });
      if (pts > best) {
        setBest(pts);
        saveGameStat(STAT_KEYS.rankBest, pts);
      }
      if (pts === 10) setConfetti(Date.now());
    }
  };

  const { drag, handlers } = usePointerDrag((target, _dx, _dy, el) => {
    if (target?.startsWith('br-')) place(Number(target.slice(3)), el);
  }, !round?.done);

  // Number keys 1-5 drop the card in that slot
  useEffect(() => {
    if (!round || round.done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < SIZE && round.slots[i] == null) {
        e.preventDefault();
        place(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Keep the stage in view: on a fresh deal after a round, and when the result lands
  useEffect(() => {
    if (!round) return;
    if (round.done) scoreRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    else if ((round.idx === 0 && played.current) || round.idx === 1) {
      // Bring the whole ladder into view (after the first placement, or on a fresh deal) if any of it is off screen
      const r = stageRef.current?.getBoundingClientRect();
      if (r && (r.top < 60 || r.bottom > window.innerHeight)) stageRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.done, round?.players, round?.idx]);

  if (!round) return <p className="arc-empty">Not enough players to deal a round of five yet.</p>;

  const truth = round.done ? [...round.players].sort((a, b) => key(b) - key(a)) : null;
  const trueRank = (p: GamePlayer) => (truth ? truth.indexOf(p) + 1 : 0);
  const rowPts = round.slots.map((pi, i) => (truth && pi != null ? pointsFor(Math.abs(trueRank(round.players[pi]) - (i + 1))) : 0));
  const points = rowPts.reduce((a, b) => a + b, 0);
  const shownPts = rowPts.slice(0, reveal.step).reduce((a, b) => a + b, 0);

  const restart = (p: PosFilter) => setRound(deal(canPlay(p) ? p : firstPlayable()));
  const current = round.players[round.idx];
  const posOptions = POS_OPTIONS.map((p) => ({ value: p, label: p === 'ANY' ? 'Any' : p, disabled: !canPlay(p) }));
  const ovrOf = (p: GamePlayer) => ovrMap.get(playerKey(p)) ?? 62;
  const placed = round.slots.filter((s) => s != null).length;
  const pipTones = round.done ? rowPts.map((p, i) => (i < reveal.step ? (p === 2 ? 'good' : p === 1 ? 'near' : 'bad') : undefined)) : undefined;

  return (
    <div className="br">
      <Confetti fire={confetti} />
      <HowToStrip
        id="rank"
        steps={[
          <>Five players come out one at a time. Read the card on the clock.</>,
          <>
            Put him in a slot: <b>#1</b> is the highest OVR, <b>#5</b> the lowest. Tap a slot or drag the card onto it.
          </>,
          <>Slots are final. Exact slot scores 2, one off scores 1. Ten is perfect.</>,
        ]}
        keys="Keys 1 to 5 drop the card in that slot"
      />
      <div className="rk-deal">
        <span>Deal</span>
        <ChipGroup label="Position" value={round.pos} options={posOptions} onChange={restart} />
      </div>

      <div className="br-stage" ref={stageRef}>
        <Hud>
          <HudStat label={round.done ? 'Round' : 'On the clock'} value={round.done ? 'Final' : `${placed + 1} of ${SIZE}`} live />
          <span className="rk-hud-stat accent grow">
            <i>Board</i>
            <Pips total={SIZE} done={round.done ? reveal.step : placed} tones={pipTones} label={`${placed} of ${SIZE} placed`} />
          </span>
          <HudStat label="Best" value={best >= 0 ? `${best}/10` : '-'} />
        </Hud>

        <div className="br-table">
          <div className="br-left">
            {!round.done ? (
              <div key={playerKey(current)} className="rk-enter">
                <DeckCard
                  player={current}
                  eyebrow={`Player ${round.idx + 1} of ${SIZE}`}
                  grip={
                    <>
                      <GripIcon /> Drag onto a slot or tap one
                    </>
                  }
                  className={cn(drag.active && 'is-dragging')}
                  dragProps={{
                    ref: faceRef,
                    ...handlers,
                    style: drag.active ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${Math.max(-6, Math.min(6, drag.dx / 30))}deg)` } : undefined,
                  }}
                />
                <p className="br-next" aria-hidden="true">
                  {SIZE - 1 - round.idx > 0 ? `${SIZE - 1 - round.idx} more to come. You won't see them until he is placed.` : 'Last one. One slot left.'}
                </p>
              </div>
            ) : (
              <div ref={scoreRef} className="rk-score br-score" role="status">
                <div className="rk-score-big">
                  {reveal.done ? <CountUp value={points} duration={500} /> : shownPts}
                  <small>/10</small>
                </div>
                <div className="rk-score-verdict">{reveal.done ? verdictFor(points) : 'Revealing the board'}</div>
                <div className="rk-score-detail">
                  {rowPts.filter((p) => p === 2).length} exact · {rowPts.filter((p) => p === 1).length} one off · ranked by OVR
                </div>
                <div className="rk-score-actions">
                  <ArcadeButton tone="go" onClick={() => restart(round.pos)} autoFocus>
                    Deal next five
                  </ArcadeButton>
                </div>
                {truth && (
                  <div className="br-truth" aria-label="The true order">
                    <span className="br-truth-h">True order</span>
                    <ol>
                      {truth.map((p, i) => (
                        <li key={playerKey(p)} style={teamLook(p).vars} className={cn(i < reveal.step && 'on')}>
                          <b>{i + 1}</b>
                          <span>{p.name.split(' ').slice(-1)[0]}</span>
                          <em>{ovrOf(p)}</em>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          <ol className="br-ladder" aria-label="Your board, highest OVR at the top">
            <li className="br-end top" aria-hidden="true">
              Highest OVR
            </li>
            {round.slots.map((pi, i) => {
              if (pi == null) {
                const over = drag.over === `br-${i}`;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      data-drop={`br-${i}`}
                      className={cn('br-slot', over && 'over', drag.active && 'armed')}
                      onClick={(e) => place(i, faceRef.current ?? e.currentTarget)}
                      aria-label={`Place ${current.name} at number ${i + 1}`}
                    >
                      <span className="br-slot-no">{i + 1}</span>
                      <span className="br-slot-cta">{over ? 'Drop here' : `Slot #${i + 1}`}</span>
                      <span className="br-slot-arrow" aria-hidden="true">
                        ◀
                      </span>
                    </button>
                  </li>
                );
              }
              const p = round.players[pi];
              if (!round.done) {
                return (
                  <li key={i}>
                    <Land active={i === round.last}>
                      <Slab player={p} rank={i + 1} />
                    </Land>
                  </li>
                );
              }
              const shown = i < reveal.step;
              const tr = trueRank(p);
              const pts = rowPts[i];
              const tone = !shown ? null : pts === 2 ? 'good' : pts === 1 ? 'near' : 'bad';
              return (
                <li key={i}>
                  <Slab player={p} rank={i + 1} reveal={shown} ovr={ovrOf(p)} tone={tone} className={cn(shown && 'br-flip')}>
                    {shown && (
                      <span className={cn('br-pts', tone)} aria-label={`True number ${tr}, ${pts} points`}>
                        <b>+{pts}</b>
                        {pts === 2 ? 'Exact' : tr < i + 1 ? `▲ #${tr}` : `▼ #${tr}`}
                      </span>
                    )}
                  </Slab>
                </li>
              );
            })}
            <li className="br-end bottom" aria-hidden="true">
              Lowest OVR
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

const GripIcon = () => (
  <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
    {[0, 4, 8].map((y) => [1, 7].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="2.5" height="2.5" fill="currentColor" />))}
  </svg>
);

export default BlindRank;
