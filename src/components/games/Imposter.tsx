import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { unlockCard } from '@/utils/collection';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import { isHallOfFamer } from '@/config/stats';
import { cn } from '@/lib/utils';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useLeagueContent } from '@/utils/leagueContent';
import { findNFLTeam } from '@/utils/nflTeams';
import { usePlayerExtras } from '@/utils/playerExtras';
import { ArcadeButton, Confetti, Lamp, LampRow } from './ArcadeUI';
import { POSITION_NAMES, isLegend, loadGameStat, playerKey, saveGameStat, type GamePlayer } from './gameUtils';
import { buildTraits, levelFor, makeImposterRound, type ImposterRound } from './imposterTraits';

const BEST_KEY = 'imposter:best';
const LEVEL_NAMES = { 1: 'Rookie', 2: 'Pro', 3: 'All-Pro' } as const;
const RECENT_FAMILIES = 3;

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

const Imposter = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const { numberFor } = useJerseyNumbers();
  const compact = useCompact();

  const traits = useMemo(() => buildTraits({ players, content, extras }), [players, content, extras]);

  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => loadGameStat(BEST_KEY));
  const [confetti, setConfetti] = useState<number | false>(false);
  const [pick, setPick] = useState<string | null>(null);
  // Scouting: open any card's full stats page before (or after) picking
  const [scouting, setScouting] = useState<GamePlayer | null>(null);
  const recent = useRef<string[]>([]);

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
    setRound(deal(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Content / extras arrive after the first deal; deal once they make a round possible
  useEffect(() => {
    if (!round) setRound(deal(levelFor(streak)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traits]);

  const correct = pick != null && round != null && pick === round.imposterKey;

  const choose = useCallback(
    (key: string) => {
      if (!round || pick) return;
      setPick(key);
      if (key === round.imposterKey) {
        unlockCard(round.cards.find((c) => playerKey(c) === key), 'Imposter');
        const next = streak + 1;
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

  const nextRound = () => {
    const nextStreak = correct ? streak : 0;
    if (!correct) setStreak(0);
    setPick(null);
    setRound(deal(levelFor(nextStreak)));
  };

  // Number keys 1–6 pick a card
  useEffect(() => {
    if (!round || pick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < round.cards.length) {
        e.preventDefault();
        choose(playerKey(round.cards[i]));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [round, pick, choose]);

  if (!round) return <p className="empty">Not enough players to play yet.</p>;

  const level = levelFor(streak);
  const { trait, cards, imposterKey } = round;

  const ringFor = (key: string): CSSProperties['boxShadow'] => {
    if (!pick) return '0 0 0 2px var(--line)';
    if (key === imposterKey && pick === key) return '0 0 0 3px var(--turf), 0 0 34px #27b36acc';
    if (key === imposterKey) return '0 0 0 3px var(--gold), 0 0 30px #ffc83d88';
    if (key === pick) return '0 0 0 3px var(--flag)';
    return '0 0 0 2px var(--line)';
  };

  return (
    <div>
      <Confetti fire={confetti} />
      <LampRow className="mb-4">
        <Lamp label="Streak" value={streak} live flicker={streak > 0 && !pick} />
        <Lamp label="Best" value={best} />
        <Lamp label="Difficulty" value={`${level} · ${LEVEL_NAMES[level]}`} />
      </LampRow>

      <h3 className="question">
        Find the <b>imposter</b>
      </h3>
      <p className="hint" style={{ textAlign: 'center', margin: '-8px 0 16px' }}>
        Five of these players share a hidden trait. One doesn't. <span className="hidden sm:inline">Press 1–6 or click a card.</span>
      </p>

      <ol
        key={round.id}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4"
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
        aria-label="Players"
      >
        {cards.map((p, i) => {
          const key = playerKey(p);
          const team = findNFLTeam(p.team);
          const isImposter = key === imposterKey;
          const picked = key === pick;
          const dim = !!pick && !isImposter && !picked;
          const legend = isLegend(p);
          const tag = pick && isImposter ? (picked ? 'Busted' : 'Imposter') : null;
          return (
            <li key={key} className={cn('rise', picked && !isImposter && 'shake')} style={{ animationDelay: `${i * 45}ms`, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => choose(key)}
                disabled={!!pick}
                aria-label={`${i + 1}: ${p.name}, ${POSITION_NAMES[p.position]}${team ? `, ${team.fullName}` : ''}. Pick as the imposter`}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  textAlign: 'left',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: ringFor(key),
                  opacity: dim ? 0.72 : 1,
                  cursor: pick ? 'default' : 'pointer',
                  transition: 'box-shadow 0.25s, opacity 0.25s',
                }}
              >
                <ProPlayerBanner
                  name={p.name}
                  position={p.position}
                  team={p.team}
                  number={numberFor(p)}
                  size={compact ? 'compact' : 'card'}
                  // Nothing that could hint at the trait (OVR, HOF edge, photo, legend tag) until the reveal
                  ovr={pick ? ovrMap?.get(key) ?? null : null}
                  hallOfFamer={!!pick && !legend && isHallOfFamer(p)}
                  photoUrl={pick && legend ? p.photo?.url ?? null : null}
                  interactive={!pick}
                  topRight={
                    tag ? (
                      <span className="lamp" style={{ color: picked ? 'var(--turf)' : 'var(--gold)' }}>
                        {tag}
                      </span>
                    ) : undefined
                  }
                />
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setScouting(p)}
                aria-label={`Scout ${p.name}: open full career stats`}
                style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
              >
                Scout stats
              </button>
              {pick && (
                <div
                  className={cn('verdict-pill', isImposter ? 'bad' : 'good')}
                  style={{ marginTop: 6, textAlign: 'left', textTransform: 'none', fontFamily: 'var(--f-body)', fontSize: 13 }}
                >
                  <b className="px" style={{ textTransform: 'uppercase', fontSize: 10, marginRight: 6 }}>
                    {isImposter ? '✗ Imposter' : '✓ Fits'}
                  </b>
                  {trait.explain(p)}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {pick && (
        <section className="result" role="status" aria-live="polite" style={{ display: 'block' }}>
          <div className={cn('disp pop', correct ? 'turf' : 'flag')} style={{ fontSize: 34 }}>
            {correct ? 'Busted! You found the imposter' : `Fooled! Streak ended at ${streak}`}
          </div>
          <div className="px muted" style={{ fontSize: 11, marginTop: 12, textTransform: 'uppercase' }}>
            The hidden trait · Level {trait.difficulty}
          </div>
          <div className="verdict" style={{ marginTop: 2 }}>
            {trait.label}
          </div>
          <ul style={{ listStyle: 'none', margin: '12px 0 16px', padding: 0, display: 'grid', gap: 4 }}>
            {cards.map((p) => {
              const key = playerKey(p);
              const isImposter = key === imposterKey;
              return (
                <li key={key} style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                  <span className={cn('px', isImposter ? 'flag' : 'turf')} style={{ fontSize: 11, flex: 'none', width: 16 }} aria-hidden="true">
                    {isImposter ? '✗' : '✓'}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b>{p.name}</b>
                    <span className="sr-only">{isImposter ? ' (imposter)' : ' (fits)'}</span>
                    <span className="muted">: {trait.explain(p)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <ArcadeButton tone="go" onClick={nextRound} autoFocus>
            Next round
          </ArcadeButton>
        </section>
      )}
      <PlayerDetailCard player={scouting} onClose={() => setScouting(null)} />
    </div>
  );
};

export default Imposter;
