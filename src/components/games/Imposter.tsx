import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { awardPack } from '@/utils/collection';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import { isHallOfFamer } from '@/config/stats';
import { cn } from '@/lib/utils';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useLeagueContent } from '@/utils/leagueContent';
import { usePlayerExtras } from '@/utils/playerExtras';
import { ArcadeButton, Confetti, CountUp } from './ArcadeUI';
import GameSprite from '../GameSprite';
import { POSITION_NAMES, isLegend, legendLabel, loadGameStat, playerKey, saveGameStat, type GamePlayer } from './gameUtils';
import { buildTraits, levelFor, makeImposterRound, type ImposterRound } from './imposterTraits';
import { Hud, HudStat, Pips, prefersReducedMotion, teamLook, useRevealClock } from './rosterKit';
import HowToStrip from './HowToStrip';
import './imposter.css';

const BEST_KEY = 'imposter:best';
const LEVEL_NAMES = { 1: 'Rookie', 2: 'Pro', 3: 'All-Pro' } as const;
const RECENT_FAMILIES = 3;
/** Streak where the next level starts (see levelFor) */
const NEXT_LEVEL_AT = { 1: 5, 2: 12 } as const;

const splitName = (name: string) => {
  const i = name.lastIndexOf(' ');
  return i > 0 ? [name.slice(0, i), name.slice(i + 1)] : ['', name];
};

const Imposter = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const { numberFor } = useJerseyNumbers();

  const traits = useMemo(() => buildTraits({ players, content, extras }), [players, content, extras]);

  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => loadGameStat(BEST_KEY));
  const [confetti, setConfetti] = useState<number | false>(false);
  const [pick, setPick] = useState<string | null>(null);
  // Suspect under the spotlight before the accusation is made
  const [suspect, setSuspect] = useState<string | null>(null);
  // Scouting: open any card's full stats page before (or after) picking
  const [scouting, setScouting] = useState<GamePlayer | null>(null);
  const [caseNo, setCaseNo] = useState(1);
  const recent = useRef<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);

  const deal = useCallback(
    (level: 1 | 2 | 3) => {
      const r = makeImposterRound(traits, players, level, recent.current);
      if (r) recent.current = [r.trait.family, ...recent.current].slice(0, RECENT_FAMILIES);
      return r;
    },
    [traits, players],
  );

  const [round, setRound] = useState<ImposterRound | null>(() => deal(1));

  // New pool (legends toggled, data reloaded): restart the run
  const firstPool = useRef(players);
  useEffect(() => {
    if (firstPool.current === players) return;
    firstPool.current = players;
    setStreak(0);
    setPick(null);
    setSuspect(null);
    setRound(deal(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Content / extras arrive after the first deal; deal once they make a round possible
  useEffect(() => {
    if (!round) setRound(deal(levelFor(streak)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traits]);

  const correct = pick != null && round != null && pick === round.imposterKey;

  // Reveal order: the five who fit light up one by one, the imposter is unmasked last
  const order = useMemo(() => {
    if (!round) return [] as string[];
    const keys = round.cards.map(playerKey);
    return [...keys.filter((k) => k !== round.imposterKey), round.imposterKey];
  }, [round]);
  const reveal = useRevealClock(!!pick, order.length, 260, 350, round?.id);
  const shownAt = (key: string) => !!pick && order.indexOf(key) < reveal.step;

  const accuse = useCallback(
    (key: string) => {
      if (!round || pick) return;
      setPick(key);
      setSuspect(key);
      if (key === round.imposterKey) {
        const next = streak + 1;
        if (next % 3 === 0) awardPack('standard', `Imposter, ${next} in a row`, { once: round });
        setStreak(next);
        if (next > best) {
          setBest(next);
          saveGameStat(BEST_KEY, next);
        }
        if (next % 5 === 0) setConfetti(Date.now());
      }
    },
    [round, pick, streak, best],
  );

  /** First tap puts a suspect under the spotlight, a second tap on the same card accuses him. */
  const tap = (key: string) => {
    if (pick) return;
    if (suspect === key) accuse(key);
    else setSuspect(key);
  };

  const nextRound = () => {
    const nextStreak = correct ? streak : 0;
    if (!correct) setStreak(0);
    setPick(null);
    setSuspect(null);
    setCaseNo((n) => n + 1);
    setRound(deal(levelFor(nextStreak)));
    stageRef.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  // Number keys 1-6 put a card under the spotlight, Enter accuses
  useEffect(() => {
    if (!round || pick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < round.cards.length) {
        e.preventDefault();
        setSuspect(playerKey(round.cards[i]));
      } else if (e.key === 'Enter' && suspect && el?.tagName !== 'BUTTON') {
        e.preventDefault();
        accuse(suspect);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [round, pick, suspect, accuse]);

  useEffect(() => {
    if (reveal.done && pick) verdictRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [reveal.done, pick]);

  if (!round) return <p className="arc-empty">Not enough players to play yet.</p>;

  const level = levelFor(streak);
  const { trait, cards, imposterKey } = round;
  const imposter = cards.find((p) => playerKey(p) === imposterKey)!;
  const accused = pick ? cards.find((p) => playerKey(p) === pick) : null;
  const suspectPlayer = suspect ? cards.find((p) => playerKey(p) === suspect) : null;
  const toLevel = level < 3 ? NEXT_LEVEL_AT[level as 1 | 2] - streak : 0;
  const toPack = 3 - (streak % 3);

  return (
    <div className="imp">
      <Confetti fire={confetti} />
      <HowToStrip
        id="imposter"
        steps={[
          <>Six suspects. Five of them share a hidden trait: a stat, an award, a club, an era.</>,
          <>
            Tap a card to put him under the light, then tap again (or press <b>Accuse</b>) to name the imposter.
          </>,
          <>Scout any card for his full career first. Every 3 in a row earns a pack, and the cases get harder.</>,
        ]}
        keys="Keys 1 to 6 pick a suspect, Enter accuses"
      />

      <div className="imp-stage" ref={stageRef}>
        <Hud>
          <HudStat label="Streak" value={streak} live />
          <HudStat label="Best" value={best} />
          <HudStat label={toLevel > 0 ? `Level · next in ${toLevel}` : 'Level · top'} value={LEVEL_NAMES[level]} />
          <span className="rk-hud-stat accent grow">
            <i>Pack in {toPack}</i>
            <Pips total={3} done={streak % 3} label={`${toPack} more in a row for a pack`} />
          </span>
        </Hud>

        <header className={cn('imp-case', pick && (correct ? 'won' : 'lost'))}>
          <span className="imp-case-no">
            Case #{caseNo} · Level {trait.difficulty}
          </span>
          {!pick ? (
            <h3 className="imp-case-q">
              Five share a hidden trait. <b>One is the imposter.</b>
            </h3>
          ) : (
            <h3 className="imp-case-q revealed" aria-live="polite">
              <span>The hidden trait</span>
              {trait.label}
            </h3>
          )}
        </header>

        <ol className={cn('imp-lineup', pick && 'is-revealed', suspect && !pick && 'has-suspect')} aria-label="Suspects">
          {cards.map((p, i) => {
            const key = playerKey(p);
            const look = teamLook(p);
            const [first, last] = splitName(p.name);
            const isImp = key === imposterKey;
            const shown = shownAt(key);
            const legend = isLegend(p);
            const ovr = ovrMap?.get(key);
            return (
              <li
                key={`${round.id}-${key}`}
                className={cn('imp-suspect', suspect === key && 'lit', shown && (isImp ? 'is-imp' : 'is-fit'), pick === key && 'accused')}
                style={{ ...look.vars, animationDelay: `${i * 70}ms` }}
              >
                <button
                  type="button"
                  className="imp-card"
                  onClick={() => tap(key)}
                  disabled={!!pick}
                  aria-pressed={!pick ? suspect === key : undefined}
                  aria-label={`${i + 1}: ${p.name}, ${POSITION_NAMES[p.position]}, ${look.name}. ${suspect === key ? 'Tap again to accuse' : 'Put under the light'}`}
                >
                  <span className="imp-placard" aria-hidden="true">
                    {i + 1}
                  </span>
                  {look.team && <img className="imp-logo" src={look.team.logoUrl} alt="" aria-hidden="true" loading="lazy" />}
                  <span className="imp-num" aria-hidden="true">
                    {numberFor(p)}
                  </span>
                  {!legend && (
                    <GameSprite player={p} team={look.team?.name} kind="figure" animate={!!shown && isImp} scale={2} nflScale={2} className="imp-sprite" />
                  )}
                  <span className="imp-name">
                    <small>{first}</small>
                    <span>{last}</span>
                  </span>
                  <span className="imp-meta">
                    <b>{p.position}</b> {look.abbr}
                    {pick && ovr != null && <em className="imp-ovr">{ovr}</em>}
                    {pick && legend && <em className="imp-tag">{legendLabel(p)}</em>}
                    {pick && !legend && isHallOfFamer(p) && <em className="imp-tag hof">HOF</em>}
                  </span>
                  {shown && (
                    <span className={cn('imp-stamp', isImp ? 'bad' : 'good')} aria-hidden="true">
                      {isImp ? 'Imposter' : 'Fits'}
                    </span>
                  )}
                  {suspect === key && !pick && (
                    <span className="imp-accuse-hint" aria-hidden="true">
                      Tap again to accuse
                    </span>
                  )}
                </button>
                <button type="button" className="imp-scout" onClick={() => setScouting(p)} aria-label={`Scout ${p.name}: open full career stats`}>
                  <ScoutIcon />
                </button>
                {pick && (
                  <p className={cn('imp-evidence', shown && 'on', isImp ? 'bad' : 'good')}>
                    <span className="sr-only">{isImp ? 'Imposter: ' : 'Fits: '}</span>
                    {shown ? trait.explain(p) : '...'}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {!pick ? (
          <div className="imp-action">
            <button
              type="button"
              className={cn('imp-accuse', suspectPlayer && 'ready')}
              disabled={!suspectPlayer}
              onClick={() => suspect && accuse(suspect)}
              style={suspectPlayer ? teamLook(suspectPlayer).vars : undefined}
            >
              {suspectPlayer ? (
                <>
                  Accuse <span className="imp-accuse-name">{suspectPlayer.name}</span>
                </>
              ) : (
                'Pick a suspect'
              )}
            </button>
          </div>
        ) : (
          <div ref={verdictRef} className={cn('imp-verdict', correct ? 'won' : 'lost', reveal.done && 'on')} role="status" aria-live="polite">
            <div className="imp-verdict-head">
              <span className="imp-verdict-big">{correct ? 'Busted!' : 'Fooled!'}</span>
              <span className="imp-verdict-streak">
                {correct ? (
                  <>
                    Streak <CountUp value={streak} duration={450} />
                    {streak % 3 === 0 ? ' · pack earned' : ` · ${toPack} to a pack`}
                  </>
                ) : (
                  `Streak ended at ${streak}`
                )}
              </span>
            </div>
            <p className="imp-verdict-line">
              <b style={teamLook(imposter).vars}>{imposter.name}</b> was the imposter: {trait.explain(imposter)}.
            </p>
            {!correct && accused && (
              <p className="imp-verdict-line muted">
                You accused <b style={teamLook(accused).vars}>{accused.name}</b>, but he fits: {trait.explain(accused)}.
              </p>
            )}
            <ArcadeButton tone="go" wide onClick={nextRound} autoFocus>
              {correct ? 'Next case' : 'New case'}
            </ArcadeButton>
          </div>
        )}
      </div>
      <PlayerDetailCard player={scouting} onClose={() => setScouting(null)} />
    </div>
  );
};

const ScoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="currentColor" d="M5 1h5v1h1v1h1v5h-1v1h-1v1H5V9H4V8H3V3h1V2h1zm0 2v4h1v1h3V7h1V3H9V2H6v1zM11 10h1v1h1v1h1v1h1v2h-2v-1h-1v-1h-1v-1h-1v-1h1z" />
  </svg>
);

export default Imposter;
