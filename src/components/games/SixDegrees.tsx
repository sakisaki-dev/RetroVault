import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import InLeague from '@/components/InLeague';
import { cn } from '@/lib/utils';
import { awardPack } from '@/utils/collection';
import { useLeagueContent } from '@/utils/leagueContent';
import { bannerTeamOf, usePlayerExtras } from '@/utils/playerExtras';
import { ArcadeButton, Confetti, CountUp, TeamLogo } from './ArcadeUI';
import HowToStrip from './HowToStrip';
import { getTeamTextColor } from '@/utils/teamColors';
import './sixDegrees.css';
import GameBanner from './GameBanner';
import { loadGameStat, playerKey, saveGameStat, teamStyle, teamVars, type GamePlayer } from './gameUtils';
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

type Trend = 'closer' | 'level' | 'further';

const TREND_TEXT: Record<Trend, string> = { closer: '▲ Closer', level: '◆ Sideways', further: '▼ Further' };

/** Link line with the reason chip(s) between two chain nodes, plus whether the link moved the chain toward the target. */
const LinkLine = ({ edge, pending, label, trend }: { edge?: SixDegEdge | null; pending?: boolean; label?: string; trend?: Trend | null }) => {
  const kind = edge?.facts[0]?.kind;
  const color = kind ? KIND_COLOR[kind] : undefined;
  return (
    <div className={cn('sd-link', pending && 'pending')} style={color ? ({ '--lc': color } as CSSProperties) : undefined}>
      <span className="sd-line" aria-hidden="true" />
      {edge ? (
        <span className="sd-chip">
          <b>{[...new Set(edge.facts.map((f) => KIND_NAME[f.kind]))].join(' + ')}</b>
          <span>{edge.reason}</span>
          {trend && <i className={cn('sd-trend', trend)}>{TREND_TEXT[trend]}</i>}
        </span>
      ) : label ? (
        <span className="sd-chip sd-chip-pending">{label}</span>
      ) : null}
    </div>
  );
};

const nameParts = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? { first: '', last: name } : { first: name.slice(0, i), last: name.slice(i + 1) };
};

/** A player as a route token in his club colours (best-known club): logo, name, position and OVR. */
const Token = ({ p, label, ovr, tone, className }: { p: GamePlayer; label: string; ovr: number | null; tone?: 'start' | 'goal'; className?: string }) => {
  const st = teamStyle(bannerTeamOf(p));
  const { first, last } = nameParts(p.name);
  return (
    <div className={cn('sd-tok', tone, className)} style={teamVars(st)}>
      <TeamLogo team={st.team} className="sd-tok-logo" />
      <span className="sd-tok-k">{label}</span>
      {first && <span className="sd-tok-first">{first}</span>}
      <b className="sd-tok-last">{last}</b>
      <span className="sd-tok-meta">
        <InLeague player={p} label={false} /> {p.position}
        {ovr != null && (
          <>
            {' '}
            · <b>{ovr}</b> OVR
          </>
        )}
      </span>
    </div>
  );
};

const SixDegrees = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();

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

  // Bring the scorecard into view when the round ends (it sits under the chain)
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (status === 'play') return;
    const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), reduce ? 0 : 450);
    return () => window.clearTimeout(id);
  }, [status]);

  if (!puzzle) return <p className="arc-empty">Not enough linked league players to build a puzzle yet.</p>;

  const start = graph.byKey.get(puzzle.start)!;
  const target = graph.byKey.get(puzzle.target)!;
  const par = parFor(puzzle.shortest);
  const total = strokes + hints;
  const done = status !== 'play';
  const score = status === 'won' ? scoreLabel(total, puzzle.shortest) : null;
  const ovrOf = (p: GamePlayer) => ovrMap?.get(playerKey(p)) ?? null;
  const reachedTarget = chain[chain.length - 1] === puzzle.target;

  const distOf = (key: string) => puzzle.distToTarget.get(key) ?? Infinity;
  const trendOf = (from: string, to: string): Trend => (distOf(to) < distOf(from) ? 'closer' : distOf(to) > distOf(from) ? 'further' : 'level');
  // Stroke card: one pip per stroke up to par (more when over par); links and hints are told apart
  const pips = Array.from({ length: Math.max(par, total) }, (_, i) => (i < strokes ? 'pip-link' : i < total ? 'pip-hint' : 'pip-open'));
  const linksLeft = maxLinks - (chain.length - 1);

  return (
    <div className="sd">
      <Confetti fire={confetti} />
      <HowToStrip
        id="sixdeg"
        accent="var(--sky)"
        steps={[
          <>Build a chain from the start player to the target, one linked player at a time.</>,
          <>Players link through a shared club, era, family or lineage. Each chip tells you why.</>,
          <>Every link and every hint is a stroke. Finish at or under par to keep the streak.</>,
        ]}
      />

      <section className="sd-route" aria-label={`Link ${start.name} to ${target.name}`} key={puzzle.id}>
        <div className="sd-route-ends">
          <Token p={start} label="Start" ovr={ovrOf(start)} tone="start" className="rise" />
          <span className="sd-route-arrow" aria-hidden="true">
            <i />
            <b>{puzzle.shortest}</b>
            <span>links</span>
          </span>
          <Token p={target} label="Target" ovr={ovrOf(target)} tone="goal" className="rise" />
        </div>
        <div className="sd-card">
          <div className="sd-card-k">
            <span>
              Par <b>{par}</b>
            </span>
            <span>
              Strokes <b className={cn(total > par && 'flag')}>{total}</b>
            </span>
            <span>
              Streak <b>{streak}</b>
            </span>
            <span>
              Best <b>{best}</b>
            </span>
          </div>
          <ol className="sd-pips" aria-label={`${total} of par ${par} strokes used${hints ? `, ${hints} on hints` : ''}`}>
            {pips.map((k, i) => (
              <li key={i} className={cn(k, i >= par && 'over')} aria-hidden="true">
                {k === 'pip-hint' ? 'H' : ''}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ol className="sd-chain" aria-label="Your chain">
        {chain.map((key, i) => {
          const p = graph.byKey.get(key);
          if (!p) return null;
          const edge = i > 0 ? edgeBetween(graph, chain[i - 1], key) : null;
          const isTail = i === chain.length - 1;
          return (
            <li key={key} className={cn('sd-node rise', isTail && !done && 'tail', key === puzzle.target && 'goal')}>
              {edge && <LinkLine edge={edge} trend={key === puzzle.target ? null : trendOf(chain[i - 1], key)} />}
              <span className="sr-only">
                Step {i}: {p.name}
                {edge ? `, linked by ${edge.reason}` : ', start'}
              </span>
              <GameBanner player={p} size="compact" ovr={ovrOf(p)} reveal eyebrow={i === 0 ? 'Start' : key === puzzle.target ? 'Target reached' : `Link ${i}`} />
            </li>
          );
        })}

        {!done && (
          <li className="sd-node">
            <LinkLine pending label={`Link ${chain.length} · ${linksLeft} left`} />
            <div key={error?.n ?? 0} className={cn('sd-picker', error && 'shake')}>
              <label className="sd-picker-k" id="sd-next-label">
                Who links to <b style={{ color: getTeamTextColor(bannerTeamOf(graph.byKey.get(tail)!)) ?? undefined }}>{name(tail)}</b>?
              </label>
              <div className="sd-picker-row">
                <div className="sd-picker-pick">
                  <PlayerSearchSelect
                    players={pickable}
                    value={selection}
                    onValueChange={setSelection}
                    placeholder="Pick the next player..."
                    ariaLabel={`Next player linked to ${name(tail)}`}
                  />
                </div>
                <ArcadeButton tone="go" disabled={!selection} onClick={() => tryLink(selection)}>
                  Link
                </ArcadeButton>
              </div>
              {error && (
                <p className="sd-msg flag" role="alert">
                  ✗ {error.msg}
                </p>
              )}
              {hint && (
                <p className="sd-msg sd-hint">
                  <span>Hint</span>
                  <b>{name(hint.key)}</b>
                  <span className="muted"> · {hint.edge.reason}</span>
                </p>
              )}
              <div className="sd-actions">
                <button type="button" className="sd-act act-hint" onClick={showHint} disabled={!hintOptions.length} title="Reveal a player one step closer (+1 stroke)">
                  Hint <small>+1</small>
                </button>
                <button type="button" className="sd-act" onClick={undo} disabled={chain.length <= 1}>
                  Undo
                </button>
                <button type="button" className="sd-act quit" onClick={giveUp}>
                  Give up
                </button>
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
        <section ref={resultRef} className={cn('sd-result', status === 'won' && score ? `t-${score.tone}` : 't-flag')} role="status" aria-live="polite">
          {status === 'won' && score ? (
            <>
              <div className="sd-result-k px">Hole out</div>
              <div className="sd-result-label">{score.label}!</div>
              <div className="sd-result-n num">
                <CountUp value={total} /> <span>{total === 1 ? 'stroke' : 'strokes'} · par {par}</span>
              </div>
              <div className="sd-result-sub">
                {hints ? `${hints} ${hints === 1 ? 'hint' : 'hints'} · ` : ''}
                {total <= par ? `Streak ${streak}` : 'Over par, streak reset'}
              </div>
            </>
          ) : (
            <>
              <div className="sd-result-k px">No finish</div>
              <div className="sd-result-label">{status === 'out' ? 'Out of links' : 'Gave up'}</div>
              <div className="sd-result-sub">{status === 'out' ? `${maxLinks} links is the limit · streak reset` : 'Streak reset'}</div>
            </>
          )}
          {solution && (
            <>
              <div className="sd-result-k px sd-sol-k">
                {status === 'won' && chain.length - 1 === puzzle.shortest ? 'You found a shortest chain. Another one:' : `A shortest chain · ${puzzle.shortest} links`}
              </div>
              <ol className="sd-sol">
                {solution.map((key, i) => {
                  const p = graph.byKey.get(key);
                  const edge = i > 0 ? edgeBetween(graph, solution[i - 1], key) : null;
                  return (
                    <li key={key}>
                      {edge && (
                        <span className="sd-sol-why" style={{ '--lc': KIND_COLOR[edge.facts[0].kind] } as CSSProperties}>
                          <em>{edge.reason}</em>
                        </span>
                      )}
                      {p && <Token p={p} label={i === 0 ? 'Start' : i === solution.length - 1 ? 'Target' : `Link ${i}`} ovr={ovrOf(p)} />}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <ArcadeButton tone="go" wide onClick={nextPuzzle} autoFocus>
            Next puzzle
          </ArcadeButton>
        </section>
      )}
    </div>
  );
};

export default SixDegrees;
