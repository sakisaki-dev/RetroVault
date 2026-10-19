import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import { cn } from '@/lib/utils';
import { awardPack } from '@/utils/collection';
import { useLeagueContent } from '@/utils/leagueContent';
import { usePlayerExtras } from '@/utils/playerExtras';
import { ArcadeButton, Confetti, Lamp, LampRow } from './ArcadeUI';
import GameBanner from './GameBanner';
import { loadGameStat, playerKey, saveGameStat, type GamePlayer } from './gameUtils';
import {
  buildSixDegreesGraph,
  edgeBetween,
  hintNeighbors,
  makePuzzle,
  parFor,
  scoreLabel,
  shortestPath,
  type LinkKind,
  type SixDegEdge,
  type SixDegPuzzle,
} from './sixDegreesGraph';

const BEST_KEY = 'sixdeg:best';
const RECENT_TARGETS = 6;
/** Links allowed beyond the shortest chain before the round is lost */
const SLACK = 6;

type Status = 'play' | 'won' | 'gaveup' | 'out';

const KIND_COLOR: Record<LinkKind, string> = {
  team: 'var(--sky)',
  era: 'var(--gold)',
  family: '#ff6fa8',
  lineage: 'var(--turf)',
};

const KIND_NAME: Record<LinkKind, string> = { team: 'Team', era: 'Era', family: 'Family', lineage: 'Lineage' };

// Scoped to .arcade; the arcade's global reduced-motion rule switches the animations off.
const CSS = `
.arcade .sd-ends { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 640px) { .arcade .sd-ends { grid-template-columns: 1fr 1fr; gap: 16px; } }
.arcade .sd-chain { list-style: none; margin: 18px auto 0; padding: 0; max-width: 560px; }
.arcade .sd-node { min-width: 0; }
.arcade .sd-node.tail .gb { box-shadow: 0 0 0 3px var(--gold), 0 0 26px #ffc83d55; border-radius: 12px; }
.arcade .sd-node.goal .gb { box-shadow: 0 0 0 3px var(--turf), 0 0 30px #27b36a88; border-radius: 12px; }
.arcade .sd-link { position: relative; display: flex; align-items: center; justify-content: center; min-height: 54px; padding: 8px 0; }
.arcade .sd-line { position: absolute; left: 50%; top: 0; bottom: 0; width: 4px; margin-left: -2px; border-radius: 2px;
  background: linear-gradient(var(--lc, var(--gold)), color-mix(in srgb, var(--lc, var(--gold)) 50%, #000));
  box-shadow: 0 0 10px color-mix(in srgb, var(--lc, var(--gold)) 60%, transparent);
  transform-origin: top; animation: sd-draw 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.arcade .sd-link.pending .sd-line { background: repeating-linear-gradient(var(--line) 0 6px, transparent 6px 12px); box-shadow: none; animation: none; }
.arcade .sd-chip { position: relative; z-index: 1; max-width: min(100%, 460px); display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px;
  padding: 5px 10px; border-radius: 999px; background: #05080f; box-shadow: 0 0 0 2px var(--lc, var(--gold)); color: var(--chalk);
  font-size: 13px; line-height: 1.25; text-align: center; animation: arc-pop 0.35s ease 0.2s both; }
.arcade .sd-chip b { font-family: var(--f-pixel); font-weight: 400; font-size: 10px; text-transform: uppercase; color: var(--lc, var(--gold)); }
.arcade .sd-picker { margin-top: 4px; padding: 14px; border-radius: 10px; background: var(--panel-2); box-shadow: 0 0 0 2px var(--line); display: grid; gap: 10px; }
.arcade .sd-picker .sd-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.arcade .sd-picker .sd-actions .btn { flex: 1 1 auto; }
.arcade .sd-msg { font-size: 14px; }
.arcade .sd-path { list-style: none; margin: 12px 0 16px; padding: 0; display: grid; gap: 6px; }
.arcade .sd-path li { display: grid; gap: 2px; }
.arcade .sd-goal-dim { opacity: 0.8; }
@keyframes sd-draw { from { transform: scaleY(0); } to { transform: scaleY(1); } }
`;

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

/** Link line with the reason chip(s) between two chain nodes. */
const LinkLine = ({ edge, pending, label }: { edge?: SixDegEdge | null; pending?: boolean; label?: string }) => {
  const kind = edge?.facts[0]?.kind;
  const color = kind ? KIND_COLOR[kind] : undefined;
  return (
    <div className={cn('sd-link', pending && 'pending')} style={color ? ({ '--lc': color } as CSSProperties) : undefined}>
      <span className="sd-line" aria-hidden="true" />
      {edge ? (
        <span className="sd-chip">
          <b>{[...new Set(edge.facts.map((f) => KIND_NAME[f.kind]))].join(' + ')}</b>
          <span>{edge.reason}</span>
        </span>
      ) : label ? (
        <span className="sd-chip px muted" style={{ fontSize: 10, boxShadow: '0 0 0 2px var(--line)', textTransform: 'uppercase' }}>
          {label}
        </span>
      ) : null}
    </div>
  );
};

const SixDegrees = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const compact = useCompact();

  const graph = useMemo(() => buildSixDegreesGraph({ players, content, extras }), [players, content, extras]);
  const pickable = useMemo(() => [...graph.nodes].sort((a, b) => a.name.localeCompare(b.name)), [graph]);

  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => loadGameStat(BEST_KEY));
  const [confetti, setConfetti] = useState<number | false>(false);
  const recent = useRef<string[]>([]);

  const deal = useCallback(
    (forStreak: number) => {
      const pz = makePuzzle(graph, { streak: forStreak, recent: recent.current });
      if (pz) recent.current = [pz.target, ...recent.current].slice(0, RECENT_TARGETS);
      return pz;
    },
    [graph],
  );

  const [puzzle, setPuzzle] = useState<SixDegPuzzle | null>(() => deal(0));
  const [chain, setChain] = useState<string[]>(() => (puzzle ? [puzzle.start] : []));
  const [strokes, setStrokes] = useState(0);
  const [hints, setHints] = useState(0);
  const [hint, setHint] = useState<{ key: string; edge: SixDegEdge } | null>(null);
  const [status, setStatus] = useState<Status>('play');
  const [selection, setSelection] = useState('');
  const [error, setError] = useState<{ msg: string; n: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  const [solution, setSolution] = useState<string[] | null>(null);

  const startPuzzle = useCallback((pz: SixDegPuzzle | null) => {
    setPuzzle(pz);
    setChain(pz ? [pz.start] : []);
    setStrokes(0);
    setHints(0);
    setHint(null);
    setStatus('play');
    setSelection('');
    setError(null);
    setSolution(null);
    setAnnounce('');
  }, []);

  // Content / extras / pool arrive after the first deal: re-deal while the round is untouched
  const untouched = status === 'play' && chain.length <= 1 && strokes === 0 && hints === 0;
  const firstGraph = useRef(graph);
  useEffect(() => {
    if (firstGraph.current === graph) return;
    firstGraph.current = graph;
    if (untouched || !puzzle || !graph.byKey.has(puzzle.start) || !graph.byKey.has(puzzle.target)) startPuzzle(deal(streak));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const name = (key: string) => graph.byKey.get(key)?.name ?? key.split(':').slice(1).join(':');

  const finish = useCallback(
    (outcome: Status, finalStrokes: number) => {
      if (!puzzle) return;
      setStatus(outcome);
      setSolution(shortestPath(graph, puzzle.start, puzzle.target, puzzle.distToTarget));
      const ok = outcome === 'won' && finalStrokes <= parFor(puzzle.shortest);
      if (ok && scoreLabel(finalStrokes, puzzle.shortest).label === 'Eagle') awardPack('premium', 'Six Degrees eagle', { once: puzzle });
      else if (ok) awardPack('standard', `Six Degrees ${scoreLabel(finalStrokes, puzzle.shortest).label.toLowerCase()}`, { once: puzzle });
      const next = ok ? streak + 1 : 0;
      setStreak(next);
      if (next > best) {
        setBest(next);
        saveGameStat(BEST_KEY, next);
      }
      if (outcome === 'won' && (scoreLabel(finalStrokes, puzzle.shortest).label === 'Eagle' || (ok && next % 5 === 0))) setConfetti(Date.now());
    },
    [graph, puzzle, streak, best],
  );

  const tail = chain[chain.length - 1];
  const maxLinks = puzzle ? puzzle.shortest + SLACK : 0;
  const hintOptions = puzzle && status === 'play' ? hintNeighbors(graph, tail, puzzle.distToTarget).filter((k) => !chain.includes(k)) : [];

  const tryLink = (key: string) => {
    if (!puzzle || status !== 'play' || !key) return;
    const fail = (msg: string) => {
      setError((e) => ({ msg, n: (e?.n ?? 0) + 1 }));
      setAnnounce(msg);
    };
    if (key === tail) return fail(`You're already on ${name(key)}. Pick the next player.`);
    if (chain.includes(key)) return fail(`${name(key)} is already in your chain.`);
    const edge = edgeBetween(graph, tail, key);
    if (!edge) return fail(`No link between ${name(tail)} and ${name(key)}.`);
    const nextChain = [...chain, key];
    const nextStrokes = strokes + 1;
    setChain(nextChain);
    setStrokes(nextStrokes);
    setSelection('');
    setError(null);
    setHint(null);
    setAnnounce(`Linked ${name(key)}: ${edge.reason}.`);
    if (key === puzzle.target) finish('won', nextStrokes + hints);
    else if (nextChain.length - 1 >= maxLinks) finish('out', nextStrokes + hints);
  };

  const undo = () => {
    if (status !== 'play' || chain.length <= 1) return;
    setChain((c) => c.slice(0, -1));
    setHint(null);
    setError(null);
    setAnnounce(`Removed ${name(tail)} from the chain.`);
  };

  const showHint = () => {
    if (!puzzle || status !== 'play') return;
    if (!hintOptions.length) return;
    const key = hintOptions[Math.floor(Math.random() * hintOptions.length)];
    const edge = edgeBetween(graph, tail, key)!;
    setHints((h) => h + 1);
    setHint({ key, edge });
    setSelection(key);
    setAnnounce(`Hint: ${name(key)}. ${edge.reason}.`);
  };

  const giveUp = () => {
    if (status !== 'play') return;
    finish('gaveup', strokes + hints);
  };

  const nextPuzzle = () => startPuzzle(deal(streak));

  if (!puzzle) return <p className="empty">Not enough linked league players to build a puzzle yet.</p>;

  const start = graph.byKey.get(puzzle.start)!;
  const target = graph.byKey.get(puzzle.target)!;
  const par = parFor(puzzle.shortest);
  const total = strokes + hints;
  const done = status !== 'play';
  const score = status === 'won' ? scoreLabel(total, puzzle.shortest) : null;
  const ovrOf = (p: GamePlayer) => ovrMap?.get(playerKey(p)) ?? null;
  const reachedTarget = chain[chain.length - 1] === puzzle.target;

  return (
    <div>
      <style>{CSS}</style>
      <Confetti fire={confetti} />
      <LampRow className="mb-4">
        <Lamp label="Streak" value={streak} live flicker={streak > 0 && !done} />
        <Lamp label="Best" value={best} />
        <Lamp label="Par" value={par} />
        <Lamp label="Strokes" value={total} live />
        <Lamp label="Hints" value={hints} />
      </LampRow>

      <h3 className="question">
        Link <b>{start.name}</b> to <b>{target.name}</b>
      </h3>
      <p className="hint" style={{ textAlign: 'center', margin: '-8px 0 16px' }}>
        Shortest chain: {puzzle.shortest} links. Every link is a stroke and every hint costs one. Par is {par}.
      </p>

      <div className="sd-ends" key={puzzle.id}>
        <GameBanner player={start} size={compact ? 'compact' : 'card'} ovr={ovrOf(start)} reveal eyebrow="Start" className="rise" />
        <GameBanner
          player={target}
          size={compact ? 'compact' : 'card'}
          ovr={ovrOf(target)}
          reveal
          eyebrow="Target"
          className="rise"
          style={{ animationDelay: '80ms' }}
        />
      </div>

      <ol className="sd-chain" aria-label="Your chain">
        {chain.map((key, i) => {
          const p = graph.byKey.get(key);
          if (!p) return null;
          const edge = i > 0 ? edgeBetween(graph, chain[i - 1], key) : null;
          const isTail = i === chain.length - 1;
          return (
            <li key={key} className={cn('sd-node rise', isTail && !done && 'tail', key === puzzle.target && 'goal')}>
              {edge && <LinkLine edge={edge} />}
              <span className="sr-only">
                Step {i}: {p.name}
                {edge ? `, linked by ${edge.reason}` : ', start'}
              </span>
              <GameBanner player={p} size="compact" ovr={ovrOf(p)} reveal eyebrow={i === 0 ? 'Start' : `Link ${i}`} />
            </li>
          );
        })}

        {!done && (
          <li className="sd-node">
            <LinkLine pending label={`Link ${chain.length} of ${maxLinks} max`} />
            <div key={error?.n ?? 0} className={cn('sd-picker', error && 'shake')}>
              <label className="px muted" style={{ fontSize: 11, textTransform: 'uppercase' }} id="sd-next-label">
                Who links to {name(tail)}?
              </label>
              <PlayerSearchSelect
                players={pickable}
                value={selection}
                onValueChange={setSelection}
                placeholder="Pick the next player..."
                ariaLabel={`Next player linked to ${name(tail)}`}
              />
              {error && (
                <p className="sd-msg flag" role="alert" style={{ margin: 0 }}>
                  ✗ {error.msg}
                </p>
              )}
              {hint && (
                <p className="sd-msg" style={{ margin: 0 }}>
                  <span className="px gold" style={{ fontSize: 10, textTransform: 'uppercase', marginRight: 6 }}>
                    Hint
                  </span>
                  <b>{name(hint.key)}</b>
                  <span className="muted"> · {hint.edge.reason}</span>
                </p>
              )}
              <div className="sd-actions">
                <ArcadeButton tone="go" disabled={!selection} onClick={() => tryLink(selection)}>
                  Link player
                </ArcadeButton>
                <ArcadeButton tone="sky" onClick={showHint} disabled={!hintOptions.length} title="Reveal a player one step closer (+1 stroke)">
                  Hint +1
                </ArcadeButton>
                <ArcadeButton tone="ghost" onClick={undo} disabled={chain.length <= 1}>
                  Undo
                </ArcadeButton>
                <ArcadeButton tone="red" onClick={giveUp}>
                  Give up
                </ArcadeButton>
              </div>
            </div>
          </li>
        )}

        {!reachedTarget && (
          <li className="sd-node sd-goal-dim">
            <LinkLine pending label={done ? 'Not reached' : 'Target'} />
            <GameBanner player={target} size="compact" ovr={ovrOf(target)} reveal eyebrow="Target" />
          </li>
        )}
      </ol>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {done && (
        <section className="result" role="status" aria-live="polite" style={{ display: 'block' }}>
          {status === 'won' && score ? (
            <>
              <div className={cn('disp pop', score.tone)} style={{ fontSize: 40 }}>
                {score.label}!
              </div>
              <div className="verdict" style={{ marginTop: 6 }}>
                {total} {total === 1 ? 'stroke' : 'strokes'} on a par {par}
                {hints ? ` (${hints} ${hints === 1 ? 'hint' : 'hints'})` : ''}
                {total <= par ? ` · streak ${streak}` : ' · streak reset'}
              </div>
            </>
          ) : (
            <>
              <div className="disp pop flag" style={{ fontSize: 34 }}>
                {status === 'out' ? `Out of links (${maxLinks} max)` : 'Gave up'}
              </div>
              <div className="verdict" style={{ marginTop: 6 }}>
                Streak reset
              </div>
            </>
          )}
          {solution && (
            <>
              <div className="px muted" style={{ fontSize: 11, marginTop: 14, textTransform: 'uppercase' }}>
                {status === 'won' && chain.length - 1 === puzzle.shortest ? 'You found a shortest chain. Another one:' : `A shortest chain · ${puzzle.shortest} links`}
              </div>
              <ol className="sd-path">
                {solution.map((key, i) => {
                  const edge = i > 0 ? edgeBetween(graph, solution[i - 1], key) : null;
                  return (
                    <li key={key}>
                      {edge && (
                        <span className="muted" style={{ fontSize: 13, paddingLeft: 22 }}>
                          ↓ {edge.reason}
                        </span>
                      )}
                      <span>
                        <span className="px gold" style={{ fontSize: 11, display: 'inline-block', width: 22 }} aria-hidden="true">
                          {i}
                        </span>
                        <b>{name(key)}</b>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <ArcadeButton tone="go" onClick={nextPuzzle} autoFocus>
            Next puzzle
          </ArcadeButton>
        </section>
      )}
    </div>
  );
};

export default SixDegrees;
