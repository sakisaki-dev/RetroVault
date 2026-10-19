import { useEffect, useMemo, useRef, useState } from 'react';
import { awardPack } from '@/utils/collection';
import { matchPlayer } from '@/components/PlayerSearchSelect';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import type { Player } from '@/types/player';
import { HOF_THRESHOLD, isHallOfFamer } from '@/config/stats';
import { NFL_TEAMS, findNFLTeam } from '@/utils/nflTeams';
import { cn } from '@/lib/utils';
import GameBanner from './GameBanner';
import { ArcadeButton, Confetti, Lamp, LampRow } from './ArcadeUI';
import { STAT_KEYS, isDefender, isLegend, loadGameStat, playerKey, type GamePlayer, randomItem, saveGameStat, shuffle, teamStyle, teamVars } from './gameUtils';

const MAX_GUESSES = 9;

interface Criterion {
  id: string;
  label: string;
  test: (p: Player) => boolean;
  /** Hex/HSL accent for team rows */
  color?: string;
  logo?: string;
}

const COLUMN_CRITERIA: Criterion[] = [
  { id: 'rings3', label: '3+ Rings', test: (p) => p.rings >= 3 },
  { id: 'ring1', label: 'Won a Ring', test: (p) => p.rings >= 1 },
  { id: 'ringless', label: 'Never Won a Ring', test: (p) => p.rings === 0 },
  { id: 'mvp', label: 'MVP Winner', test: (p) => p.mvp >= 1 },
  { id: 'poy', label: 'OPOY / DPOY Winner', test: (p) => p.opoy >= 1 },
  { id: 'sbmvp', label: 'Super Bowl MVP', test: (p) => p.sbmvp >= 1 },
  { id: 'roty', label: 'Rookie of the Year', test: (p) => p.roty >= 1 },
  // League-only metrics: real NFL legends never qualify for these.
  { id: 'hof', label: `Hall of Famer (${HOF_THRESHOLD / 1000}k+)`, test: (p) => !isLegend(p) && isHallOfFamer(p) },
  { id: 'mvp2', label: '2+ MVPs', test: (p) => p.mvp >= 2 },
  { id: 'ringmvp', label: 'Ring + MVP', test: (p) => p.rings >= 1 && p.mvp >= 1 },
  { id: 'games250', label: '250+ Games', test: (p) => p.games >= 250 },
  { id: 'games100less', label: 'Under 100 Games', test: (p) => p.games < 100 },
  { id: 'tt800', label: '800+ True Talent', test: (p) => !isLegend(p) && p.trueTalent >= 800 },
  { id: 'tpg3', label: '3.0+ TPG', test: (p) => !isLegend(p) && p.tpg >= 3 },
];

const POSITION_ROWS: Criterion[] = [
  { id: 'qb', label: 'Quarterback', test: (p) => p.position === 'QB' },
  { id: 'rb', label: 'Running Back', test: (p) => p.position === 'RB' },
  { id: 'wr', label: 'Wide Receiver', test: (p) => p.position === 'WR' },
  { id: 'te', label: 'Tight End', test: (p) => p.position === 'TE' },
  { id: 'ol', label: 'Offensive Line', test: (p) => p.position === 'OL' },
  { id: 'def', label: 'Defense', test: isDefender },
];

/** Teams with enough players become rows; otherwise we fall back to position groups. */
const teamId = (p: Player) => {
  const t = p.team?.trim();
  return t ? findNFLTeam(t)?.id ?? t : null;
};

/** Every franchise id a player counts for: his final team plus any confirmed earlier franchises. */
type FranchiseLookup = (p: Player) => string[];
const finalTeamOnly: FranchiseLookup = (p) => {
  const t = teamId(p);
  return t ? [t] : [];
};
const franchiseLookup = (history: Record<string, string[]>): FranchiseLookup => (p) => {
  const ids = new Set(finalTeamOnly(p));
  (history[normalizeName(p.name)] ?? []).forEach((name) => {
    const id = findNFLTeam(name)?.id;
    if (id) ids.add(id);
  });
  return [...ids];
};

/** Teams with enough players become rows (legends' "New England Patriots" and league "Patriots" merge); else position groups. */
const buildRowCriteria = (players: Player[], teamsOf: FranchiseLookup): Criterion[] => {
  const byTeam = new Map<string, number>();
  players.forEach((p) => teamsOf(p).forEach((t) => byTeam.set(t, (byTeam.get(t) || 0) + 1)));
  const teams = [...byTeam.entries()].filter(([, n]) => n >= 3).map(([team]) => team);
  if (teams.length < 3) return POSITION_ROWS;
  return teams.map((team) => {
    const nfl = NFL_TEAMS.find((t) => t.id === team);
    return {
      id: `team:${team}`,
      label: nfl?.fullName ?? team,
      color: nfl?.primaryColor,
      logo: nfl?.logoUrl,
      test: (p: Player) => teamsOf(p).includes(team),
    };
  });
};

interface Puzzle {
  rows: Criterion[];
  cols: Criterion[];
  answers: Player[][][]; // [row][col] -> valid players
}

/** True when all nine squares can be filled with nine DIFFERENT players (bipartite matching). */
const hasFullSolution = (answers: Player[][][]) => {
  const cells = answers.flat().map((opts) => opts.map(playerKey));
  const owner = new Map<string, number>(); // player key -> cell index
  const tryCell = (cell: number, seen: Set<string>): boolean => {
    for (const k of cells[cell]) {
      if (seen.has(k)) continue;
      seen.add(k);
      const other = owner.get(k);
      if (other === undefined || tryCell(other, seen)) {
        owner.set(k, cell);
        return true;
      }
    }
    return false;
  };
  return cells.every((_, i) => tryCell(i, new Set()));
};

const makePuzzle = (players: Player[], teamsOf: FranchiseLookup = finalTeamOnly): Puzzle | null => {
  const rowPool = buildRowCriteria(players, teamsOf);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rows = shuffle(rowPool).slice(0, 3);
    const cols = shuffle(COLUMN_CRITERIA).slice(0, 3);
    if (rows.length < 3) return null;
    const answers = rows.map((r) => cols.map((c) => players.filter((p) => r.test(p) && c.test(p))));
    // Every cell needs at least one answer.
    if (answers.some((row) => row.some((cell) => cell.length === 0))) continue;
    // The grid must be completable with no repeats (a perfect matching), not just have 9 names overall.
    if (!hasFullSolution(answers)) continue;
    return { rows, cols, answers };
  }
  return null;
};

/** Search field that lives inside the grid square being filled. Enter / click locks the pick in. */
const CellPicker = ({
  players,
  label,
  feedback,
  onPick,
  onCancel,
}: {
  players: GamePlayer[];
  label: string;
  feedback: string | null;
  onPick: (key: string) => void;
  onCancel: () => void;
}) => {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus({ preventScroll: true }), []);
  const results = useMemo(() => {
    if (!q.trim()) return [];
    return players
      .map((p) => ({ p, s: matchPlayer(`${p.name} ${p.nickname ?? ''} ${p.position} ${p.team ?? ''}`, q, [p.name]) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
      .slice(0, 6)
      .map((x) => x.p);
  }, [players, q]);
  useEffect(() => setHi(0), [q]);
  const listId = `lg-list-${label.replace(/\W+/g, '-')}`;
  return (
    <div className="lg-picker" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="lg-picker-input"
        value={q}
        placeholder="Type a name…"
        aria-label={`Pick a player for ${label}`}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-activedescendant={results[hi] ? `${listId}-${hi}` : undefined}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); onPick(playerKey(results[hi])); setQ(''); }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
      />
      {feedback && <p className="lg-picker-msg" role="alert">{feedback}</p>}
      {results.length > 0 && (
        <ul id={listId} role="listbox" className="lg-picker-list">
          {results.map((p, i) => (
            <li
              key={playerKey(p)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === hi}
              className={cn('lg-picker-opt', i === hi && 'hi')}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); onPick(playerKey(p)); setQ(''); }}
            >
              <b>{p.position}</b> {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LeagueGrid = ({ players, ovrMap }: { players: Player[]; ovrMap: Map<string, number> }) => {
  const extras = usePlayerExtras();
  const teamsOf = useMemo(() => franchiseLookup(extras.franchises), [extras.franchises]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(() => makePuzzle(players, teamsOf));
  const [filled, setFilled] = useState<Record<string, Player>>({});
  const [guessesLeft, setGuessesLeft] = useState(MAX_GUESSES);
  // Franchise history loads after the first grid is dealt; re-deal once it arrives if no guess was made yet,
  // so team rows count every franchise a player played for (e.g. Brandson as a Giant).
  useEffect(() => {
    if (guessesLeft === MAX_GUESSES) setPuzzle(makePuzzle(players, teamsOf));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the franchise history changes
  }, [teamsOf]);
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);
  const [selection, setSelection] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [best, setBest] = useState(() => loadGameStat(STAT_KEYS.gridBest));
  const [confetti, setConfetti] = useState<number | false>(false);

  const usedKeys = useMemo(() => new Set(Object.values(filled).map(playerKey)), [filled]);
  const isOver = revealed || guessesLeft === 0 || Object.keys(filled).length === 9;

  // Answers for missed squares: one DIFFERENT player per square (no repeats, none already on the board),
  // found by backtracking from the most constrained square. Falls back to repeats only if impossible.
  // Answers for missed squares: a maximum matching, so as many squares as possible show a DIFFERENT player
  // (never one already on the board). Squares whose every valid player is used elsewhere stay empty and say so.
  const revealPicks = useMemo(() => {
    const picks: Record<string, GamePlayer> = {};
    if (!puzzle || !isOver) return picks;
    const cells: { id: string; options: GamePlayer[] }[] = [];
    puzzle.answers.forEach((row, r) =>
      row.forEach((opts, c) => {
        const id = `${r}-${c}`;
        if (!filled[id]) cells.push({ id, options: (opts as GamePlayer[]).filter((p) => !usedKeys.has(playerKey(p))) });
      }),
    );
    const owner = new Map<string, number>(); // player key -> cell index
    const tryCell = (ci: number, seen: Set<string>): boolean => {
      for (const p of cells[ci].options) {
        const k = playerKey(p);
        if (seen.has(k)) continue;
        seen.add(k);
        const other = owner.get(k);
        if (other === undefined || tryCell(other, seen)) {
          owner.set(k, ci);
          return true;
        }
      }
      return false;
    };
    cells.forEach((_, ci) => tryCell(ci, new Set()));
    owner.forEach((ci, k) => {
      const p = cells[ci].options.find((o) => playerKey(o) === k);
      if (p) picks[cells[ci].id] = p;
    });
    return picks;
  }, [puzzle, isOver, filled, usedKeys]);
  const score = Object.keys(filled).length;
  const finished = revealed || guessesLeft === 0 || score === 9;

  const recordBest = (s: number) => {
    if (s > best) {
      setBest(s);
      saveGameStat(STAT_KEYS.gridBest, s);
    }
    if (s === 9) setConfetti(Date.now());
    if (s === 9) awardPack('premium', 'League Grid 9/9', { once: puzzle ?? undefined });
    else if (s >= 6) awardPack('standard', `League Grid ${s}/9`, { once: puzzle ?? undefined });
  };

  const reset = () => {
    setPuzzle(makePuzzle(players, teamsOf));
    setFilled({});
    setGuessesLeft(MAX_GUESSES);
    setRevealed(false);
    setFeedback(null);
    setActiveCell(null);
  };

  const submit = (pickedKey: string = selection) => {
    if (!puzzle || !activeCell || !pickedKey) return;
    const selection = pickedKey;
    const [r, c] = activeCell;
    const guess = players.find((p) => playerKey(p) === selection);
    if (!guess) return;
    if (usedKeys.has(selection)) {
      setFeedback(`${guess.name} is already on your grid.`);
      setWrong((w) => w + 1);
      return;
    }
    const remaining = guessesLeft - 1;
    setGuessesLeft(remaining);
    const correct = puzzle.answers[r][c].some((p) => playerKey(p) === selection);
    if (correct) {
      const next = { ...filled, [`${r}-${c}`]: guess };
      setFilled(next);
      setActiveCell(null);
      setSelection('');
      setFeedback(null);
      if (remaining === 0 || Object.keys(next).length === 9) recordBest(Object.keys(next).length);
    } else {
      setFeedback(`${guess.name} doesn't fit. ${remaining} guess${remaining === 1 ? '' : 'es'} left.`);
      setWrong((w) => w + 1);
      setSelection('');
      if (remaining === 0) {
        setActiveCell(null);
        recordBest(score);
      }
    }
  };

  if (!puzzle) {
    return <p className="empty">Not enough variety in the league to build a grid yet. Add more players or teams.</p>;
  }

  const rarity = (r: number, c: number) => puzzle.answers[r][c].length;

  return (
    <div>
      <Confetti fire={confetti} />
      <LampRow className="mb-4 justify-center">
        <Lamp label="Score" value={`${score}/9`} live />
        <Lamp label="Guesses left" value={guessesLeft} flicker={guessesLeft <= 2 && !finished} />
        <Lamp label="Best" value={`${best}/9`} />
      </LampRow>

      <div className="lg-grid">
        <div aria-hidden="true" />
        {puzzle.cols.map((c) => (
          <div key={c.id} className="lg-head">
            {c.label}
          </div>
        ))}

        {puzzle.rows.map((row, r) => {
          const ts = row.color ? teamStyle(row.label) : null;
          return (
            <div key={row.id} className="contents">
              <div className="lg-row" style={ts ? teamVars(ts) : undefined}>
                {row.logo && <img src={row.logo} alt="" aria-hidden="true" loading="lazy" />}
                <span>{row.label}</span>
              </div>
              {puzzle.cols.map((col, c) => {
                const cellKey = `${r}-${c}`;
                const player = filled[cellKey];
                // When the grid ends unfinished, every missed square shows an answer with a red outline.
                const missed = finished && !player;
                const sample = missed ? revealPicks[cellKey] ?? null : null;
                const exhausted = missed && !sample;
                const active = activeCell?.[0] === r && activeCell?.[1] === c;
                if (player) {
                  return (
                    <div key={col.id} className="lg-cell filled pop">
                      <GameBanner player={player as GamePlayer} ovr={ovrMap.get(playerKey(player))} reveal className="lg-banner" />
                    </div>
                  );
                }
                if (active && !finished) {
                  return (
                    // Keyed on wrong-guess count so the shake replays on every miss
                    <div key={`${col.id}-${wrong}`} className={cn('lg-cell lg-cell-active', feedback && wrong > 0 && 'shake')}>
                      <CellPicker
                        players={players}
                        label={`${row.label} and ${col.label}`}
                        feedback={feedback}
                        onPick={(k) => submit(k)}
                        onCancel={() => setActiveCell(null)}
                      />
                    </div>
                  );
                }
                return (
                  <button
                    key={col.id}
                    type="button"
                    className={cn('lg-cell', missed && 'missed')}
                    disabled={finished}
                    style={active ? { borderColor: 'var(--gold)', borderStyle: 'solid', background: '#1a2240' } : undefined}
                    aria-pressed={active}
                    onClick={() => {
                      setActiveCell([r, c]);
                      setSelection('');
                      setFeedback(null);
                    }}
                    aria-label={`${row.label} and ${col.label}`}
                  >
                    {sample ? (
                      <>
                        <span className="disp" style={{ fontSize: 14, color: 'var(--muted)' }}>
                          {sample.name}
                        </span>
                        <span className="count">{rarity(r, c)} possible</span>
                      </>
                    ) : exhausted ? (
                      <span className="count">All {rarity(r, c)} used elsewhere</span>
                    ) : (
                      <span className="count">{active ? 'Picking…' : '+'}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {finished && (
        <div className="result">
          <div>
            <div className="big">{score}/9</div>
            <div className="verdict">{score === 9 ? 'Perfect grid!' : 'Final score'}</div>
          </div>
          <ArcadeButton tone="go" onClick={reset} autoFocus>
            New grid
          </ArcadeButton>
        </div>
      )}

      {!finished && (
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          <ArcadeButton
            tone="ghost"
            onClick={() => {
              setRevealed(true);
              setActiveCell(null);
              recordBest(score);
            }}
          >
            Give up &amp; reveal
          </ArcadeButton>
          <ArcadeButton onClick={reset}>New grid</ArcadeButton>
        </div>
      )}
    </div>
  );
};

export default LeagueGrid;
