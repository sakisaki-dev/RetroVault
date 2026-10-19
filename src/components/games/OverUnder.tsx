import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { awardPack } from '@/utils/collection';
import GameBanner from './GameBanner';
import { ArcadeButton, Confetti, CountUp, Lamp, LampRow } from './ArcadeUI';
import { loadGameStat, playerKey, saveGameStat, type GamePlayer } from './gameUtils';
import {
  JITTER,
  LEVEL_NAMES,
  ODDS,
  PARLAY_MULTIPLIER,
  SLIP_SIZE,
  START_BANK,
  formatActual,
  formatLine,
  formatUnits,
  isWinner,
  levelFor,
  makeSlip,
  settleSlip,
  straightWin,
  type OULevel,
  type OUPick,
  type OUProp,
  type OUSide,
  type Settlement,
} from './overUnderLines';

const BANK_KEY = 'ou:bank';
const BEST_KEY = 'ou:best';
const REVEAL_MS = 1100;
const UNIT_OPTIONS = [1, 2, 3] as const;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const useCompact = () => {
  const query = '(max-width: 639px)';
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
};

const cents = (x: number) => Math.round(x * 100) / 100;
const loadBank = () => {
  const v = loadGameStat(BANK_KEY, START_BANK);
  return v >= 0 ? cents(v) : START_BANK;
};
const freshPicks = (): OUPick[] => Array.from({ length: SLIP_SIZE }, () => ({ side: null, units: 1 }));
const bankText = (u: number) => `${u.toLocaleString('en-US', { maximumFractionDigits: 2 })}u`;

type Phase = 'pick' | 'reveal' | 'done';

interface Bet {
  settlement: Settlement;
  bankBefore: number;
  bankAfter: number;
  streakAfter: number;
  parlay: boolean;
}

/** Scoped board styles (sportsbook look inside the arcade scoreboard theme). */
const CSS = `
.arcade .ou-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 264px), 1fr)); }
.arcade .ou-ticket { background: var(--panel-3); border-radius: 10px; overflow: hidden; box-shadow: 0 0 0 2px var(--line); display: flex; flex-direction: column; min-width: 0; transition: box-shadow 0.25s; }
.arcade .ou-ticket.won { box-shadow: 0 0 0 3px var(--turf), 0 0 26px #27b36a55; }
.arcade .ou-ticket.lost { box-shadow: 0 0 0 3px var(--flag); }
.arcade .ou-ticket .gb .ppb, .arcade .ou-ticket .gb .ppb__field { border-radius: 0; }
.arcade .ou-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 10px; flex: 1; background: repeating-linear-gradient(0deg, transparent 0 3px, #ffffff04 3px 4px), #06080f; }
.arcade .ou-market { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; border-bottom: 1px dashed #2b3760; padding-bottom: 8px; }
.arcade .ou-mk { font-family: var(--f-pixel); font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.arcade .ou-mk b { color: var(--chalk); font-weight: 400; }
.arcade .ou-line { font-family: var(--f-pixel); font-size: 22px; color: var(--gold); text-shadow: 0 0 10px #ffc83d55; white-space: nowrap; }
.arcade .ou-fs { border: 0; margin: 0; padding: 0; min-width: 0; }
.arcade .ou-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.arcade .ou-opt { position: relative; display: block; min-width: 0; }
.arcade .ou-opt input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.arcade .ou-opt input:disabled { cursor: default; }
.arcade .ou-face { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 6px; min-height: 64px; justify-content: center; border-radius: 6px; background: #0d1326; box-shadow: inset 0 0 0 2px var(--line); text-align: center; transition: background 0.12s, box-shadow 0.12s, color 0.12s; }
.arcade .ou-face-k { font-family: var(--f-display); font-weight: 800; font-size: 17px; text-transform: uppercase; line-height: 1; }
.arcade .ou-face-l { font-size: 13px; color: var(--muted); }
.arcade .ou-odds { font-family: var(--f-pixel); font-size: 12px; }
.arcade .ou-opt.over .ou-odds { color: var(--turf); }
.arcade .ou-opt.under .ou-odds { color: var(--flag); }
.arcade .ou-opt input:not(:disabled):hover + .ou-face { box-shadow: inset 0 0 0 2px var(--muted); }
.arcade .ou-opt input:focus-visible + .ou-face, .arcade .ou-unit input:focus-visible + span { outline: 3px solid var(--gold); outline-offset: 2px; }
.arcade .ou-opt.over input:checked + .ou-face { background: var(--turf); color: #03140a; box-shadow: 0 3px 0 #0c4a28; }
.arcade .ou-opt.under input:checked + .ou-face { background: var(--flag); color: #250006; box-shadow: 0 3px 0 #8a1020; }
.arcade .ou-opt input:checked + .ou-face .ou-face-l, .arcade .ou-opt input:checked + .ou-face .ou-odds { color: inherit; }
.arcade .ou-opt.hit .ou-face { box-shadow: inset 0 0 0 2px var(--gold), 0 0 16px #ffc83d66; }
.arcade .ou-opt.dim .ou-face { opacity: 0.45; }
.arcade .ou-units { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.arcade .ou-units legend { float: left; margin-right: 4px; font-family: var(--f-pixel); font-size: 10px; color: var(--muted); text-transform: uppercase; padding: 0; }
.arcade .ou-unit { position: relative; display: inline-block; }
.arcade .ou-unit input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.arcade .ou-unit input:disabled { cursor: not-allowed; }
.arcade .ou-unit span { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 32px; padding: 0 10px; border-radius: 999px; font-family: var(--f-pixel); font-size: 11px; background: #11182e; color: var(--muted); box-shadow: inset 0 0 0 2px var(--line); }
.arcade .ou-unit input:checked + span { background: var(--gold); color: #1a1300; box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffc83d55; }
.arcade .ou-unit input:disabled:not(:checked) + span { opacity: 0.35; }
.arcade .ou-final { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 8px 10px; border-radius: 6px; background: #000; box-shadow: inset 0 0 10px #ffc83d22; }
.arcade .ou-actual { font-family: var(--f-pixel); font-size: 22px; color: var(--chalk); display: inline-block; animation: ou-tick 0.5s cubic-bezier(.2,.9,.3,1.2) both; }
.arcade .ou-pending { font-family: var(--f-pixel); font-size: 12px; color: var(--muted); padding: 8px 10px; border-radius: 6px; background: #000; text-transform: uppercase; }
.arcade .ou-pending.live { color: var(--gold); animation: arc-flicker 1.2s infinite steps(1, end); }
.arcade .ou-slip { margin-top: 16px; padding: 14px 16px; border-radius: 10px; border: 3px solid #000; background: #06080f; box-shadow: 0 0 0 2px var(--line); display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: center; justify-content: space-between; position: sticky; bottom: 8px; z-index: 5; }
.arcade .ou-slip-k { font-family: var(--f-pixel); font-size: 10px; color: var(--muted); text-transform: uppercase; display: block; }
.arcade .ou-slip-v { font-family: var(--f-pixel); font-size: 18px; color: var(--chalk); }
.arcade .ou-slip-v.win { color: var(--turf); }
.arcade .ou-slip-stats { display: flex; gap: 18px; flex-wrap: wrap; }
.arcade .ou-slip-act { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.arcade .ou-net { font-family: var(--f-display); font-weight: 800; font-size: 40px; line-height: 1; }
@keyframes ou-tick { 0% { transform: perspective(500px) rotateX(-90deg); filter: brightness(2.2); } 100% { transform: none; filter: none; } }
@media (max-width: 639px) {
  .arcade .ou-slip { bottom: 0; border-radius: 10px 10px 0 0; margin-left: -4px; margin-right: -4px; }
  .arcade .ou-line { font-size: 19px; }
}
@media (prefers-reduced-motion: reduce) {
  .arcade .ou-actual, .arcade .ou-pending.live, .arcade .ou-ticket, .arcade .ou-face { animation: none !important; transition: none !important; }
}
`;

const OverUnder = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const compact = useCompact();
  const uid = useId();

  const [streak, setStreak] = useState(0);
  const [bank, setBank] = useState(loadBank);
  const [best, setBest] = useState(() => loadGameStat(BEST_KEY, -1));
  const [parlay, setParlay] = useState(false);
  const [confetti, setConfetti] = useState<number | false>(false);
  const recent = useRef<Set<string>>(new Set());

  const deal = useCallback(
    (level: OULevel) => {
      const s = makeSlip(players, level, { ovrMap, avoid: recent.current });
      if (s) recent.current = new Set(s.map((p) => playerKey(p.player)));
      return s;
    },
    [players, ovrMap],
  );

  const [slip, setSlip] = useState<OUProp[] | null>(() => deal(1));
  const [slipNo, setSlipNo] = useState(0);
  const [picks, setPicks] = useState<OUPick[]>(freshPicks);
  const [phase, setPhase] = useState<Phase>('pick');
  const [bet, setBet] = useState<Bet | null>(null);
  const [shown, setShown] = useState(0);

  const newSlip = useCallback(
    (level: OULevel) => {
      setSlip(deal(level));
      setSlipNo((n) => n + 1);
      setPicks(freshPicks());
      setPhase('pick');
      setBet(null);
      setShown(0);
    },
    [deal],
  );

  // New pool (legends toggled, data reloaded): deal a fresh slip. Money is already settled at submit.
  const firstPool = useRef(players);
  useEffect(() => {
    if (firstPool.current === players) return;
    firstPool.current = players;
    newSlip(levelFor(streak));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // OVR map arrives after the first deal on a cold load: re-deal an untouched slip so OVR props can appear.
  const firstOvr = useRef(ovrMap);
  useEffect(() => {
    if (firstOvr.current === ovrMap) return;
    firstOvr.current = ovrMap;
    if (phase === 'pick' && picks.every((p) => p.side == null)) newSlip(levelFor(streak));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ovrMap]);

  // Reveal the legs one at a time, then commit the streak.
  useEffect(() => {
    if (phase !== 'reveal' || !bet) return;
    if (shown >= SLIP_SIZE) {
      setPhase('done');
      setStreak(bet.streakAfter);
      const allHit = bet.settlement.hits.every(Boolean);
      if (allHit) setConfetti(Date.now());
      if (bet.parlay && allHit) awardPack('premium', 'Over / Under parlay hit', { once: bet });
      else if (bet.settlement.net > 0) awardPack('standard', 'Over / Under slip in profit', { once: bet });
      return;
    }
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 350 : REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [phase, shown, bet]);

  const stake = picks.reduce((s, p) => s + p.units, 0);
  const ready = picks.every((p) => p.side != null);
  const busted = phase === 'pick' && bank < SLIP_SIZE;

  const setSide = (i: number, side: OUSide) => {
    if (phase !== 'pick') return;
    setPicks((ps) => ps.map((p, k) => (k === i ? { ...p, side } : p)));
  };
  const setUnits = (i: number, units: 1 | 2 | 3) => {
    if (phase !== 'pick') return;
    setPicks((ps) => ps.map((p, k) => (k === i ? { ...p, units } : p)));
  };

  const placeBet = () => {
    if (!slip || !ready || phase !== 'pick' || stake > bank) return;
    const settlement = settleSlip(slip, picks, parlay);
    const bankAfter = cents(bank + settlement.net);
    let s = streak;
    settlement.hits.forEach((h) => (s = h ? s + 1 : 0));
    // Persist right away so a reload mid-reveal can't undo the bet
    saveGameStat(BANK_KEY, bankAfter);
    if (bankAfter > best) {
      saveGameStat(BEST_KEY, bankAfter);
      setBest(bankAfter);
    }
    setBank(bankAfter);
    setBet({ settlement, bankBefore: bank, bankAfter, streakAfter: s, parlay });
    if (reducedMotion()) {
      setShown(SLIP_SIZE);
      setPhase('reveal');
    } else {
      setShown(0);
      setPhase('reveal');
    }
  };

  const reload = () => {
    setBank(START_BANK);
    saveGameStat(BANK_KEY, START_BANK);
    setStreak(0);
    newSlip(1);
  };

  if (!slip) return <p className="empty">Not enough players to open the board yet.</p>;

  const level = levelFor(phase === 'done' && bet ? bet.streakAfter : streak);
  const [jLo, jHi] = JITTER[level];
  const revealedNet = bet ? bet.settlement.legNet.slice(0, shown).reduce((s, x) => s + x, 0) : 0;
  const shownBank = phase === 'pick' || !bet ? bank : phase === 'done' ? bet.bankAfter : cents(bet.bankBefore + revealedNet);
  const maxWin = parlay ? stake * PARLAY_MULTIPLIER : cents(picks.reduce((s, p) => s + straightWin(p.units), 0));
  const lastShown = shown > 0 && bet ? slip[shown - 1] : null;

  return (
    <div className="ou">
      <style>{CSS}</style>
      <Confetti fire={confetti} />
      <LampRow className="mb-4">
        <Lamp label="Bankroll" value={bankText(shownBank)} flicker={phase === 'reveal'} />
        <Lamp label="Best" value={best >= 0 ? bankText(best) : '—'} />
        <Lamp label="Streak" value={phase === 'done' && bet ? bet.streakAfter : streak} />
        <Lamp label="Lines" value={`${LEVEL_NAMES[level]} ±${Math.round(jLo * 100)}–${Math.round(jHi * 100)}%`} />
      </LampRow>

      <h3 className="question">
        Beat the <b>book</b>
      </h3>
      <p className="hint" style={{ textAlign: 'center', margin: '-8px 0 16px' }}>
        Five career props. Take the over or the under, stake 1–3 units on each, then lock the slip. Lines tighten as your streak grows.
      </p>

      {busted ? (
        <section className="result" role="status" style={{ display: 'block', textAlign: 'center' }}>
          <div className="disp flag" style={{ fontSize: 34 }}>
            Busted
          </div>
          <p className="hint" style={{ margin: '8px 0 14px' }}>
            Your bankroll is down to {bankText(bank)}, not enough for a five-leg slip. Your best of {best >= 0 ? bankText(best) : bankText(START_BANK)} stays on the
            board.
          </p>
          <ArcadeButton tone="go" onClick={reload} autoFocus>
            Reload {START_BANK}u
          </ArcadeButton>
        </section>
      ) : (
        <>
          <ol className="ou-grid" key={slipNo} aria-label="Props">
            {slip.map((prop, i) => {
              const pick = picks[i];
              const isShown = !!bet && i < shown;
              const hit = isShown && bet.settlement.hits[i];
              const name = `${uid}-${slipNo}-${i}`;
              const winningSide: OUSide = prop.actual > prop.line ? 'over' : 'under';
              const legNet = bet?.settlement.legNet[i] ?? 0;
              return (
                <li
                  key={prop.id}
                  className={cn('ou-ticket rise', isShown && (hit ? 'won' : 'lost'), isShown && !hit && 'shake')}
                  style={{ animationDelay: phase === 'pick' ? `${i * 50}ms` : undefined }}
                >
                  <GameBanner
                    player={prop.player}
                    size={compact ? 'compact' : 'card'}
                    reveal={isShown}
                    ovr={isShown ? ovrMap?.get(playerKey(prop.player)) ?? null : null}
                  />
                  <div className="ou-body">
                    <div className="ou-market">
                      <span className="ou-mk">
                        Career <b>{prop.stat.label}</b>
                      </span>
                      <span className="ou-line num" aria-label={`Line ${formatLine(prop.line)}`}>
                        {formatLine(prop.line)}
                      </span>
                    </div>

                    <fieldset className="ou-fs ou-sides" role="radiogroup" disabled={phase !== 'pick'}>
                      <legend className="sr-only">
                        {prop.player.name}, {prop.stat.phrase}: over or under {formatLine(prop.line)}
                      </legend>
                      {(['over', 'under'] as const).map((side) => (
                        <label
                          key={side}
                          className={cn('ou-opt', side, isShown && side === winningSide && 'hit', isShown && side !== winningSide && pick.side !== side && 'dim')}
                        >
                          <input
                            type="radio"
                            name={`${name}-side`}
                            value={side}
                            checked={pick.side === side}
                            onChange={() => setSide(i, side)}
                            aria-label={`${side === 'over' ? 'Over' : 'Under'} ${formatLine(prop.line)} ${prop.stat.phrase}, odds ${ODDS}`}
                          />
                          <span className="ou-face" aria-hidden="true">
                            <span className="ou-face-k">{side === 'over' ? 'Over' : 'Under'}</span>
                            <span className="ou-face-l num">
                              {side === 'over' ? 'O' : 'U'} {formatLine(prop.line)}
                            </span>
                            <span className="ou-odds num">{ODDS}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>

                    <fieldset className="ou-fs ou-units" role="radiogroup" disabled={phase !== 'pick'}>
                      <legend>Units</legend>
                      {UNIT_OPTIONS.map((u) => (
                        <label key={u} className="ou-unit">
                          <input
                            type="radio"
                            name={`${name}-units`}
                            value={u}
                            checked={pick.units === u}
                            disabled={phase !== 'pick' || (u !== pick.units && stake - pick.units + u > bank)}
                            onChange={() => setUnits(i, u)}
                            aria-label={`${u} unit${u > 1 ? 's' : ''} on ${prop.player.name}`}
                          />
                          <span aria-hidden="true">{u}u</span>
                        </label>
                      ))}
                    </fieldset>

                    {bet &&
                      (isShown ? (
                        <div className="ou-final">
                          <span>
                            <span className="ou-slip-k">Final</span>
                            <span className="ou-actual num">
                              <CountUp value={prop.actual} decimals={prop.actual % 1 ? 2 : 0} format={(n) => formatActual(n, prop.stat)} duration={REVEAL_MS - 250} />
                            </span>
                          </span>
                          <span className={cn('verdict-pill', hit ? 'good' : 'bad')}>
                            {winningSide === 'over' ? 'Over' : 'Under'} · {hit ? 'Win' : 'Loss'}
                            {!bet.parlay && ` ${formatUnits(legNet)}`}
                          </span>
                        </div>
                      ) : (
                        <div className={cn('ou-pending', i === shown && phase === 'reveal' && 'live')} aria-hidden="true">
                          {i === shown && phase === 'reveal' ? 'Settling…' : 'Pending'}
                        </div>
                      ))}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Screen-reader play-by-play of the reveal */}
          <p className="sr-only" aria-live="polite">
            {lastShown && bet && phase === 'reveal'
              ? `${lastShown.player.name}: ${formatActual(lastShown.actual, lastShown.stat)} ${lastShown.stat.phrase}. ${
                  isWinner(lastShown, picks[shown - 1].side as OUSide) ? 'Win' : 'Loss'
                }.`
              : ''}
          </p>

          <section className="ou-slip" aria-label="Bet slip">
            {phase === 'pick' ? (
              <>
                <div className="ou-slip-stats">
                  <span>
                    <span className="ou-slip-k">Picks</span>
                    <span className="ou-slip-v num">
                      {picks.filter((p) => p.side).length}/{SLIP_SIZE}
                    </span>
                  </span>
                  <span>
                    <span className="ou-slip-k">Stake</span>
                    <span className="ou-slip-v num">{stake}u</span>
                  </span>
                  <span>
                    <span className="ou-slip-k">{parlay ? `Parlay pays ${PARLAY_MULTIPLIER}×` : 'To win'}</span>
                    <span className="ou-slip-v win num">+{bankText(maxWin)}</span>
                  </span>
                </div>
                <div className="ou-slip-act">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={parlay}
                    className="toggle"
                    onClick={() => setParlay((v) => !v)}
                    title={`Parlay: all ${SLIP_SIZE} must hit; pays ${PARLAY_MULTIPLIER}× your total stake`}
                  >
                    <span className="track" aria-hidden="true" />
                    Parlay
                  </button>
                  <ArcadeButton tone="go" onClick={placeBet} disabled={!ready || stake > bank}>
                    {ready ? 'Lock slip' : `Pick ${SLIP_SIZE - picks.filter((p) => p.side).length} more`}
                  </ArcadeButton>
                </div>
              </>
            ) : bet ? (
              <>
                <div className="ou-slip-stats">
                  <span>
                    <span className="ou-slip-k">{bet.parlay ? 'Parlay' : 'Straight'} · {bet.settlement.hits.slice(0, shown).filter(Boolean).length}/{shown} hit</span>
                    {phase === 'done' ? (
                      <span className={cn('ou-net num pop', bet.settlement.net >= 0 ? 'turf' : 'flag')} role="status">
                        {formatUnits(bet.settlement.net)}
                      </span>
                    ) : (
                      <span className="ou-slip-v num">{bet.parlay ? 'Riding…' : formatUnits(cents(revealedNet))}</span>
                    )}
                  </span>
                  {phase === 'done' && (
                    <span>
                      <span className="ou-slip-k">Bankroll</span>
                      <span className="ou-slip-v num">{bankText(bet.bankAfter)}</span>
                    </span>
                  )}
                </div>
                <div className="ou-slip-act">
                  {phase === 'reveal' ? (
                    <ArcadeButton tone="ghost" onClick={() => setShown(SLIP_SIZE)}>
                      Skip
                    </ArcadeButton>
                  ) : (
                    <ArcadeButton tone="go" onClick={() => newSlip(levelFor(bet.streakAfter))} autoFocus>
                      Next slip
                    </ArcadeButton>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
};

export default OverUnder;
