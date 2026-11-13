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
import { DeckCard, Hud, HudStat, Land, Pips, Slab, launchFrom, usePointerDrag, useRevealClock } from './rosterKit';
import HowToStrip from './HowToStrip';
import './keepcut.css';

const SIZE = 6;
const KEEP = 3;
const SWIPE = 80;
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

/** Keep 3, Cut 3: blind, six players arrive one at a time and each call is final. */
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
  const [nope, setNope] = useState<Choice | null>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  const reveal = useRevealClock(!!round?.done, SIZE, 360, 250, round?.players);

  const keeps = round ? round.choice.filter((c) => c === 'keep').length : 0;
  const cuts = round ? round.choice.filter((c) => c === 'cut').length : 0;
  const full = (c: Choice) => (c === 'keep' ? keeps >= KEEP : cuts >= SIZE - KEEP);

  const decide = (c: Choice, from?: Element | null) => {
    if (!round || round.done) return;
    if (full(c)) {
      setNope(c);
      window.setTimeout(() => setNope(null), 450);
      return;
    }
    launchFrom(from ?? faceRef.current);
    played.current = true;
    const choice = [...round.choice, c];
    const idx = round.idx + 1;
    if (idx < SIZE) {
      setRound({ ...round, choice, idx });
      return;
    }
    const truth = [...round.players].sort((a, b) => key(b) - key(a));
    const score = round.players.filter((p, i) => choice[i] === 'keep' && truth.indexOf(p) < KEEP).length;
    setRound({ ...round, choice, idx: SIZE - 1, done: true });
    if (score === KEEP) awardPack('standard', 'Keep 3 / Cut 3, 3/3', { once: round });
    const next = { correct: totals.correct + score, rounds: totals.rounds + 1 };
    setTotals(next);
    saveGameStat(STAT_KEYS.kcCorrect, next.correct);
    saveGameStat(STAT_KEYS.kcRounds, next.rounds);
    if (score === KEEP) setConfetti(Date.now());
  };

  const { drag, handlers } = usePointerDrag((target, dx, _dy, el) => {
    if (target === 'kc-keep' || target === 'kc-cut') decide(target === 'kc-keep' ? 'keep' : 'cut', el);
    else if (dx > SWIPE) decide('keep', el);
    else if (dx < -SWIPE) decide('cut', el);
  }, !round?.done);

  // K / right arrow keeps, C / left arrow cuts
  useEffect(() => {
    if (!round || round.done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === 'k' || k === 'arrowright') {
        e.preventDefault();
        decide('keep');
      } else if (k === 'c' || k === 'arrowleft') {
        e.preventDefault();
        decide('cut');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!round) return;
    if (round.done) scoreRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    else if (round.idx === 0 && played.current) stageRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.done, round?.players]);

  if (!round) return <p className="arc-empty">Not enough players to deal six yet.</p>;

  const sorted = round.done ? [...round.players].sort((a, b) => key(b) - key(a)) : null;
  const rankOf = (p: GamePlayer) => (sorted ? sorted.indexOf(p) + 1 : 0);
  const got = sorted ? round.players.filter((p, i) => round.choice[i] === 'keep' && rankOf(p) <= KEEP).length : 0;
  const current = round.players[round.idx];
  const ovrOf = (p: GamePlayer) => ovrMap.get(playerKey(p)) ?? 62;
  const choiceOf = (p: GamePlayer) => round.choice[round.players.indexOf(p)];

  const restart = (p: PosFilter) => setRound(deal(canPlay(p) ? p : firstPlayable()));
  const posOptions = POS_OPTIONS.map((p) => ({ value: p, label: p === 'ANY' ? 'Any' : p, disabled: !canPlay(p) }));

  // Swipe feedback: how far the card leans toward keep (+) or cut (-)
  const lean = drag.active ? Math.max(-1, Math.min(1, drag.dx / (SWIPE * 1.4))) : 0;
  const hot: Choice | null = drag.over === 'kc-keep' || lean >= 0.57 ? 'keep' : drag.over === 'kc-cut' || lean <= -0.57 ? 'cut' : null;

  const upsets = sorted
    ? sorted.flatMap((p, i) => {
        const c = choiceOf(p);
        if (c === 'cut' && i === 0) return [`You cut the #1, ${p.name}`];
        if (c === 'cut' && i < KEEP) return [`You cut a top-3 career, ${p.name}`];
        if (c === 'keep' && i === SIZE - 1) return [`You kept the worst of six, ${p.name}`];
        return [];
      })
    : [];

  const pile = (type: Choice) => {
    const ids = round.choice.map((c, i) => (c === type ? i : -1)).filter((i) => i >= 0);
    const left = type === 'keep' ? KEEP - keeps : SIZE - KEEP - cuts;
    const isHot = hot === type;
    return (
      <section
        className={cn('kc-pile', type, isHot && 'hot', nope === type && 'nope', left === 0 && 'full')}
        data-drop={`kc-${type}`}
        aria-label={`${type === 'keep' ? 'Kept' : 'Cut'}: ${ids.length} of 3`}
      >
        <header>
          <h3>{type === 'keep' ? 'Keep' : 'Cut'}</h3>
          <span>{left === 0 ? 'Full' : `${left} left`}</span>
        </header>
        <ol>
          {[0, 1, 2].map((j) => {
            const i = ids[j];
            if (i == null)
              return (
                <li key={j} className="kc-empty" aria-hidden="true">
                  <span>{type === 'keep' ? '✓' : '✕'}</span>
                </li>
              );
            return (
              <li key={j}>
                <Land active={i === round.idx - 1 || (round.done && i === SIZE - 1)}>
                  <Slab player={round.players[i]} stats={1} />
                </Land>
              </li>
            );
          })}
        </ol>
      </section>
    );
  };

  return (
    <div className="kc">
      <Confetti fire={confetti} />
      <HowToStrip
        id="kc"
        steps={[
          <>Six players come out one at a time. Three make the roster.</>,
          <>
            Keep the three with the highest OVR. Swipe the card right or tap <b>Keep</b>, swipe left or tap <b>Cut</b>.
          </>,
          <>Every call is final and you never see who is next. Each pile holds three.</>,
        ]}
        keys="Keys: K or right arrow keeps, C or left arrow cuts"
      />
      <div className="rk-deal">
        <span>Deal</span>
        <ChipGroup label="Position" value={round.pos} options={posOptions} onChange={restart} />
      </div>

      <div className="kc-stage" ref={stageRef}>
        <Hud>
          <HudStat label={round.done ? 'Roster' : 'On the clock'} value={round.done ? `${got}/3 right` : `${round.idx + 1} of ${SIZE}`} live />
          <span className="rk-hud-stat accent grow">
            <i>Calls</i>
            <Pips
              total={SIZE}
              done={round.choice.length}
              tones={round.choice.map((c, i) =>
                sorted ? ((c === 'keep') === rankOf(round.players[i]) <= KEEP ? 'good' : 'bad') : c === 'keep' ? 'good' : 'bad',
              )}
              label={sorted ? `${round.choice.filter((c, i) => (c === 'keep') === rankOf(round.players[i]) <= KEEP).length} of ${SIZE} calls right` : `${round.choice.length} of ${SIZE} calls made`}
            />
          </span>
          <HudStat label="Lifetime" value={totals.rounds ? `${totals.correct}/${totals.rounds * KEEP}` : '-'} />
        </Hud>

        {!round.done ? (
          <div className="kc-table">
            {pile('cut')}
            <div className="kc-center">
              <div key={playerKey(current)} className="rk-enter kc-deckwrap">
                <DeckCard
                  player={current}
                  eyebrow={`Player ${round.idx + 1} of ${SIZE}`}
                  grip={<>◀ Swipe to cut · swipe to keep ▶</>}
                  className={cn(drag.active && 'is-dragging', hot && `lean-${hot}`)}
                  dragProps={{
                    ref: faceRef,
                    ...handlers,
                    style: drag.active ? { transform: `translate(${drag.dx}px, ${drag.dy * 0.25}px) rotate(${lean * 8}deg)` } : undefined,
                  }}
                  dragWhole
                  overlay={
                    <>
                      <span className="kc-stamp keep" style={{ opacity: Math.max(0, lean) }} aria-hidden="true">
                        Keep
                      </span>
                      <span className="kc-stamp cut" style={{ opacity: Math.max(0, -lean) }} aria-hidden="true">
                        Cut
                      </span>
                    </>
                  }
                />
              </div>
              <div className="kc-decide2">
                <button type="button" className="kc-btn cut" disabled={full('cut')} onClick={() => decide('cut')} aria-label={`Cut ${current.name}`} aria-keyshortcuts="C ArrowLeft">
                  <span aria-hidden="true">✕</span> Cut
                  <small>{full('cut') ? 'Full' : `${SIZE - KEEP - cuts} left`}</small>
                </button>
                <button type="button" className="kc-btn keep" disabled={full('keep')} onClick={() => decide('keep')} aria-label={`Keep ${current.name}`} aria-keyshortcuts="K ArrowRight">
                  Keep <span aria-hidden="true">✓</span>
                  <small>{full('keep') ? 'Full' : `${KEEP - keeps} left`}</small>
                </button>
              </div>
              {(full('keep') || full('cut')) && (
                <p className="kc-forced" role="status">
                  {full('keep') ? 'Keep pile is full. The rest get cut.' : 'Cut pile is full. The rest stay.'}
                </p>
              )}
            </div>
            {pile('keep')}
          </div>
        ) : (
          <div className="kc-result">
            <div ref={scoreRef} className="rk-score kc-score" role="status">
              <div className="rk-score-big">
                {reveal.done ? <CountUp value={got} duration={500} /> : sorted!.slice(0, Math.min(reveal.step, KEEP)).filter((p) => choiceOf(p) === 'keep').length}
                <small>/3</small>
              </div>
              <div className={cn('rk-score-verdict', got === 3 ? 'turf' : got === 0 ? 'flag' : '')}>{reveal.done ? verdictFor(got) : 'Checking the cut line'}</div>
              <div className="rk-score-detail">
                {upsets.length && reveal.done ? upsets.join(' · ') : `Lifetime ${totals.correct}/${totals.rounds * KEEP} correct keeps`}
              </div>
              <div className="rk-score-actions">
                <ArcadeButton tone="go" onClick={() => restart(round.pos)} autoFocus>
                  Deal a new six
                </ArcadeButton>
              </div>
            </div>
            <ol className="kc-ladder" aria-label="True order by OVR">
              {sorted!.map((p, i) => {
                const shown = i < reveal.step;
                const c = choiceOf(p);
                const right = c === 'keep' ? i < KEEP : i >= KEEP;
                return (
                  <li key={playerKey(p)} className={cn(i === KEEP && 'after-line', i === KEEP && reveal.step >= KEEP && 'line-on')}>
                    {i === KEEP && (
                      <span className="kc-line" aria-hidden="true">
                        <b>Cut line</b>
                      </span>
                    )}
                    <Slab player={p} rank={i + 1} reveal={shown} ovr={ovrOf(p)} tone={shown ? (right ? 'good' : 'bad') : null} className={cn(shown && 'kc-in')}>
                      {shown && (
                        <span className={cn('kc-call', right ? 'good' : 'bad')}>
                          <b>{c === 'keep' ? 'Kept' : 'Cut'}</b>
                          {right ? '✓ Right' : '✕ Wrong'}
                        </span>
                      )}
                    </Slab>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default KeepCut;
