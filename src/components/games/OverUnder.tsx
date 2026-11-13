import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import InLeague from '@/components/InLeague';
import { awardPack } from '@/utils/collection';
import { Confetti, CountUp } from './ArcadeUI';
import { isLegend, legendLabel, loadGameStat, playerKey, saveGameStat, type GamePlayer } from './gameUtils';
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
import { ClubLogo, playerClub, splitName, useReducedMotion } from './stageKit';
import HowToStrip from './HowToStrip';
import './overUnder.css';

const BANK_KEY = 'ou:bank';
const BEST_KEY = 'ou:best';
const REVEAL_MS = 1300;
const UNIT_OPTIONS = [1, 2, 3] as const;

const cents = (x: number) => Math.round(x * 100) / 100;
const loadBank = () => {
  const v = loadGameStat(BANK_KEY, START_BANK);
  return v >= 0 ? cents(v) : START_BANK;
};
const freshPicks = (): OUPick[] => Array.from({ length: SLIP_SIZE }, () => ({ side: null, units: 1 }));
const bankText = (u: number) => `${u.toLocaleString('en-US', { maximumFractionDigits: 2 })}u`;
/** "Career passing yards" / "Overall rating": the market in words, never "Career Career Legacy". */
const marketName = (phrase: string) => phrase.charAt(0).toUpperCase() + phrase.slice(1);
/** Streak needed for the next, tighter set of lines (levelFor in overUnderLines). */
const NEXT_LEVEL_AT: Record<OULevel, number | null> = { 1: 5, 2: 10, 3: 20, 4: null };

type Phase = 'pick' | 'reveal' | 'done';

interface Bet {
  settlement: Settlement;
  bankBefore: number;
  bankAfter: number;
  streakBefore: number;
  streakAfter: number;
  parlay: boolean;
}

/**
 * Where the final landed against the line: a bar with the line at the centre and the final on a
 * scale of ±1.5× the line's distance to it (so near misses look near).
 */
const LineMeter = ({ prop, hit }: { prop: OUProp; hit: boolean }) => {
  const gap = prop.actual - prop.line;
  const span = Math.max(Math.abs(gap) * 1.6, prop.line * 0.02, 1);
  const pos = 50 + Math.max(-46, Math.min(46, (gap / span) * 50));
  return (
    <div className={cn('ou2-meter', hit ? 'hit' : 'miss')} aria-hidden="true">
      <span className="ou2-meter-track">
        <span className="ou2-meter-fill" style={{ left: `${Math.min(50, pos)}%`, width: `${Math.abs(pos - 50)}%` }} />
        <span className="ou2-meter-line" />
        <span className="ou2-meter-dot" style={{ left: `${pos}%` }} />
      </span>
      <span className="ou2-meter-k">
        <span>Under</span>
        <span>Line {formatLine(prop.line)}</span>
        <span>Over</span>
      </span>
    </div>
  );
};

const OverUnder = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const reduced = useReducedMotion();
  const uid = useId();

  const [streak, setStreak] = useState(0);
  const [bank, setBank] = useState(loadBank);
  const [best, setBest] = useState(() => loadGameStat(BEST_KEY, -1));
  const [parlay, setParlay] = useState(false);
  const [confetti, setConfetti] = useState<number | false>(false);
  const recent = useRef<Set<string>>(new Set());
  const ticketRefs = useRef<(HTMLLIElement | null)[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

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
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 450 : REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [phase, shown, bet]);

  // Follow the reveal down the board (a phone shows one or two tickets at a time).
  useEffect(() => {
    if (phase !== 'reveal' || shown === 0) return;
    const el = ticketRefs.current[shown - 1];
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }, [shown, phase, reduced]);

  useEffect(() => {
    if (phase !== 'done') return;
    resultRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    nextBtn.current?.focus({ preventScroll: true });
  }, [phase, reduced]);

  const stake = picks.reduce((s, p) => s + p.units, 0);
  const picked = picks.filter((p) => p.side).length;
  const ready = picked === SLIP_SIZE;
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
    setBet({ settlement, bankBefore: bank, bankAfter, streakBefore: streak, streakAfter: s, parlay });
    setShown(reduced ? SLIP_SIZE : 0);
    setPhase('reveal');
  };

  const reload = () => {
    setBank(START_BANK);
    saveGameStat(BANK_KEY, START_BANK);
    setStreak(0);
    newSlip(1);
  };

  if (!slip) return <p className="arc-empty">Not enough players to open the board yet.</p>;

  const liveStreak = phase === 'done' && bet ? bet.streakAfter : streak;
  const level = levelFor(liveStreak);
  const [jLo, jHi] = JITTER[level];
  const nextAt = NEXT_LEVEL_AT[level];
  const revealedNet = bet ? bet.settlement.legNet.slice(0, shown).reduce((s, x) => s + x, 0) : 0;
  const shownBank = phase === 'pick' || !bet ? bank : phase === 'done' ? bet.bankAfter : cents(bet.bankBefore + revealedNet);
  const maxWin = parlay ? stake * PARLAY_MULTIPLIER : cents(picks.reduce((s, p) => s + straightWin(p.units), 0));
  const lastShown = shown > 0 && bet ? slip[shown - 1] : null;
  const hitsSoFar = bet ? bet.settlement.hits.slice(0, shown).filter(Boolean).length : 0;
  const allHit = !!bet && bet.settlement.hits.every(Boolean);

  return (
    <div className="ou2">
      <Confetti fire={confetti} />
      <HowToStrip
        id="ou"
        accent="var(--turf)"
        steps={[
          <>
            Each line is a player's <strong>career number</strong>, shaded a few percent off. Tap <strong>Over</strong> or <strong>Under</strong>.
          </>,
          <>
            Stake <strong>1 to 3 units</strong> a line. At {ODDS}, 1u wins {straightWin(1)}u. Or go <strong>Parlay</strong>: all five must hit, pays {PARLAY_MULTIPLIER}×.
          </>,
          <>
            Lock the slip and watch it settle. Right picks build a streak and the book <strong>tightens its lines</strong>.
          </>,
        ]}
      />

      <header className="ou2-book" aria-label="Sportsbook">
        <div className="ou2-brand">
          <span className="ou2-brand-k">Retro Vault</span>
          <span className="ou2-brand-v">Sportsbook</span>
        </div>
        <div className="ou2-bank">
          <span className="k">Bankroll</span>
          <span className={cn('v num', phase === 'reveal' && 'live', phase === 'done' && bet && (bet.settlement.net >= 0 ? 'up' : 'down'))}>{bankText(shownBank)}</span>
        </div>
        <div className="ou2-book-stats">
          <span>
            <span className="k">Best</span>
            <span className="v num">{best >= 0 ? bankText(best) : '-'}</span>
          </span>
          <span>
            <span className="k">Streak</span>
            <span className="v num">{liveStreak}</span>
          </span>
          <span className="ou2-level" title={`Lines sit ${Math.round(jLo * 100)} to ${Math.round(jHi * 100)}% off the true number`}>
            <span className="k">Lines</span>
            <span className="v">
              {LEVEL_NAMES[level]} <small>±{Math.round(jLo * 100)}-{Math.round(jHi * 100)}%</small>
            </span>
            {nextAt != null && (
              <span className="ou2-level-bar" aria-label={`${nextAt - liveStreak} more right picks for ${LEVEL_NAMES[(level + 1) as OULevel]} lines`}>
                <i style={{ width: `${Math.min(100, (liveStreak / nextAt) * 100)}%` }} />
              </span>
            )}
          </span>
        </div>
      </header>

      {busted ? (
        <section className="ou2-busted" role="status">
          <span className="ou2-busted-k">Busted</span>
          <p>
            The bankroll is down to {bankText(bank)}, not enough for a five-line slip. The best of {best >= 0 ? bankText(best) : bankText(START_BANK)} stays on the board.
          </p>
          <button type="button" className="btn go" onClick={reload} autoFocus>
            Reload {START_BANK}u
          </button>
        </section>
      ) : (
        <div className={cn('ou2-layout', phase)}>
          <ol className="ou2-lines" key={slipNo} aria-label="Lines">
            {slip.map((prop, i) => {
              const pick = picks[i];
              const isShown = !!bet && i < shown;
              const settling = phase === 'reveal' && i === shown;
              const hit = isShown && bet.settlement.hits[i];
              const name = `${uid}-${slipNo}-${i}`;
              const winningSide: OUSide = prop.actual > prop.line ? 'over' : 'under';
              const legNet = bet?.settlement.legNet[i] ?? 0;
              const look = playerClub(prop.player);
              const { first, last } = splitName(prop.player.name);
              const ovr = isShown ? ovrMap?.get(playerKey(prop.player)) ?? null : null;
              return (
                <li
                  key={prop.id}
                  ref={(el) => (ticketRefs.current[i] = el)}
                  className={cn('ou2-ticket', pick.side && 'picked', isShown && (hit ? 'won' : 'lost'), settling && 'settling')}
                  style={{ ...look.vars, animationDelay: phase === 'pick' ? `${i * 60}ms` : undefined } as CSSProperties}
                >
                  <div className="ou2-who">
                    <span className="ou2-badge">
                      <ClubLogo look={look} />
                    </span>
                    <span className="ou2-name">
                      {first && (
                        <span className="first">
                          {first} <InLeague player={prop.player} label={false} />
                        </span>
                      )}
                      <span className="last" style={{ color: look.ink }}>
                        {last}
                      </span>
                    </span>
                    <span className="ou2-tags">
                      <span className="ou2-pos">{prop.player.position}</span>
                      {ovr != null && <span className="ou2-ovr">{ovr} OVR</span>}
                      {isShown && isLegend(prop.player) && <span className="ou2-legend">{legendLabel(prop.player)}</span>}
                    </span>
                    <span className="ou2-no" aria-hidden="true">
                      {i + 1}
                    </span>
                  </div>

                  <div className="ou2-market">
                    <span className="ou2-mk">{marketName(prop.stat.phrase)}</span>
                    <span className="ou2-line num">
                      <small>O/U</small>
                      {formatLine(prop.line)}
                    </span>
                  </div>

                  <fieldset className="ou2-fs ou2-sides" disabled={phase !== 'pick'}>
                    <legend className="sr-only">
                      {prop.player.name}, {prop.stat.phrase}: over or under {formatLine(prop.line)}
                    </legend>
                    {(['over', 'under'] as const).map((side) => (
                      <label
                        key={side}
                        className={cn('ou2-opt', side, isShown && side === winningSide && 'right', isShown && side !== winningSide && pick.side !== side && 'dim')}
                      >
                        <input
                          type="radio"
                          name={`${name}-side`}
                          value={side}
                          checked={pick.side === side}
                          onChange={() => setSide(i, side)}
                          aria-label={`${side === 'over' ? 'Over' : 'Under'} ${formatLine(prop.line)} ${prop.stat.phrase}, odds ${ODDS}`}
                        />
                        <span className="ou2-face" aria-hidden="true">
                          <span className="ou2-face-k">
                            {side === 'over' ? '▲' : '▼'} {side === 'over' ? 'Over' : 'Under'}
                          </span>
                          <span className="ou2-odds num">{ODDS}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>

                  {!bet ? (
                    <fieldset className="ou2-fs ou2-units" disabled={phase !== 'pick'}>
                      <legend>Stake</legend>
                      <span className="ou2-unit-row">
                        {UNIT_OPTIONS.map((u) => (
                          <label key={u} className="ou2-unit">
                            <input
                              type="radio"
                              name={`${name}-units`}
                              value={u}
                              checked={pick.units === u}
                              disabled={u !== pick.units && stake - pick.units + u > bank}
                              onChange={() => setUnits(i, u)}
                              aria-label={`${u} unit${u > 1 ? 's' : ''} on ${prop.player.name}`}
                            />
                            <span aria-hidden="true">{u}u</span>
                          </label>
                        ))}
                      </span>
                      {!parlay && <span className="ou2-towin num">wins +{straightWin(pick.units)}u</span>}
                    </fieldset>
                  ) : isShown ? (
                    <div className="ou2-final">
                      <div className="ou2-final-top">
                        <span>
                          <span className="ou2-k">Final</span>
                          <span className="ou2-actual num">
                            {reduced ? (
                              formatActual(prop.actual, prop.stat)
                            ) : (
                              <CountUp value={prop.actual} decimals={prop.actual % 1 ? 2 : 0} format={(n) => formatActual(n, prop.stat)} duration={REVEAL_MS - 400} />
                            )}
                          </span>
                        </span>
                        <span className={cn('ou2-stamp', hit ? 'good' : 'bad')}>
                          {hit ? 'Win' : 'Loss'}
                          {!bet.parlay && <small>{formatUnits(legNet)}</small>}
                        </span>
                      </div>
                      <LineMeter prop={prop} hit={!!hit} />
                    </div>
                  ) : (
                    <div className={cn('ou2-pending', settling && 'live')} aria-hidden="true">
                      {settling ? 'Settling' : 'Pending'}
                      <span className="ou2-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  )}
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

          <aside className={cn('ou2-slip', phase)} aria-label="Bet slip" ref={resultRef}>
            {phase === 'pick' && (
              <>
                <div className="ou2-slip-head">
                  <span className="ou2-slip-title">Bet slip</span>
                  <div className="ou2-mode" role="radiogroup" aria-label="Bet type">
                    {[false, true].map((p) => (
                      <button key={String(p)} type="button" role="radio" aria-checked={parlay === p} className={cn(parlay === p && 'on')} onClick={() => setParlay(p)}>
                        {p ? `Parlay ${PARLAY_MULTIPLIER}×` : 'Straight'}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="ou2-slip-legs" aria-label="Your picks">
                  {slip.map((prop, i) => (
                    <li key={prop.id} className={cn(picks[i].side ?? 'empty')}>
                      <span className="nm" style={{ color: playerClub(prop.player).ink }}>
                        {splitName(prop.player.name).last}
                      </span>
                      <span className="sd">{picks[i].side ? `${picks[i].side === 'over' ? 'O' : 'U'} ${formatLine(prop.line)}` : 'Pick a side'}</span>
                      <span className="u num">{picks[i].units}u</span>
                    </li>
                  ))}
                </ul>
                <div className="ou2-slip-pips" aria-hidden="true">
                  {picks.map((p, i) => (
                    <i key={i} className={p.side ?? ''} />
                  ))}
                </div>
                <div className="ou2-slip-sum">
                  <span>
                    <span className="ou2-k">Stake</span>
                    <span className="v num">{stake}u</span>
                  </span>
                  <span>
                    <span className="ou2-k">{parlay ? 'Parlay pays' : 'Max win'}</span>
                    <span className="v win num">+{bankText(maxWin)}</span>
                  </span>
                </div>
                <button type="button" className="btn go wide ou2-lock" onClick={placeBet} disabled={!ready || stake > bank}>
                  {ready ? `Lock slip · ${stake}u` : `Pick ${SLIP_SIZE - picked} more`}
                </button>
              </>
            )}
            {phase === 'reveal' && bet && (
              <div className="ou2-slip-live">
                <span>
                  <span className="ou2-k">
                    {bet.parlay ? 'Parlay' : 'Straight'} · {hitsSoFar}/{shown} hit
                  </span>
                  <span className={cn('v num', !bet.parlay && (revealedNet >= 0 ? 'up' : 'down'))}>{bet.parlay ? (hitsSoFar === shown ? 'Alive' : 'Busted') : formatUnits(cents(revealedNet))}</span>
                </span>
                <button type="button" className="btn ghost" onClick={() => setShown(SLIP_SIZE)}>
                  Skip
                </button>
              </div>
            )}
            {phase === 'done' && bet && (
              <div className={cn('ou2-result', bet.settlement.net >= 0 ? 'up' : 'down', allHit && 'sweep')} role="status">
                <span className="ou2-k">{allHit ? (bet.parlay ? 'Parlay cashed' : 'Clean sweep') : bet.settlement.net >= 0 ? 'Slip in profit' : 'The book wins this one'}</span>
                <span className="ou2-net num">
                  {bet.settlement.net >= 0 ? '+' : '−'}
                  {reduced ? (
                    Math.abs(bet.settlement.net).toLocaleString('en-US', { maximumFractionDigits: 2 })
                  ) : (
                    <CountUp value={Math.abs(bet.settlement.net)} decimals={bet.settlement.net % 1 ? 2 : 0} duration={800} />
                  )}
                  u
                </span>
                <div className="ou2-hits" aria-label={`${bet.settlement.hits.filter(Boolean).length} of ${SLIP_SIZE} hit`}>
                  {bet.settlement.hits.map((h, i) => (
                    <i key={i} className={h ? 'h' : 'm'} />
                  ))}
                </div>
                <dl className="ou2-result-rows">
                  <div>
                    <dt>Bankroll</dt>
                    <dd className="num">
                      {bankText(bet.bankBefore)} → <b>{bankText(bet.bankAfter)}</b>
                    </dd>
                  </div>
                  <div>
                    <dt>Streak</dt>
                    <dd className="num">
                      {bet.streakAfter}
                      {allHit ? ` (+${SLIP_SIZE})` : ' (a miss reset it)'}
                    </dd>
                  </div>
                  <div>
                    <dt>Next lines</dt>
                    <dd>
                      {LEVEL_NAMES[level]}
                      {levelFor(bet.streakBefore) !== level && <b className="ou2-lvlup"> {level > levelFor(bet.streakBefore) ? 'Tighter' : 'Looser'}</b>}
                    </dd>
                  </div>
                </dl>
                <p className="ou2-reward">
                  {bet.parlay && allHit ? 'Premium pack earned' : bet.settlement.net > 0 ? 'Standard pack earned' : 'Finish in profit to earn a pack'}
                </p>
                <button type="button" ref={nextBtn} className="btn go wide" onClick={() => newSlip(levelFor(bet.streakAfter))}>
                  Next slip
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default OverUnder;
