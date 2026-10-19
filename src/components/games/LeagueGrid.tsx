import { useMemo, useState } from 'react';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
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

/** Teams with enough players become rows (legends' "New England Patriots" and league "Patriots" merge); else position groups. */
const buildRowCriteria = (players: Player[]): Criterion[] => {
  const byTeam = new Map<string, number>();
  players.forEach((p) => {
    const t = teamId(p);
    if (t) byTeam.set(t, (byTeam.get(t) || 0) + 1);
  });
  const teams = [...byTeam.entries()].filter(([, n]) => n >= 3).map(([team]) => team);
  if (teams.length < 3) return POSITION_ROWS;
  return teams.map((team) => {
    const nfl = NFL_TEAMS.find((t) => t.id === team);
    return {
      id: `team:${team}`,
      label: nfl?.fullName ?? team,
      color: nfl?.primaryColor,
      logo: nfl?.logoUrl,
      test: (p: Player) => teamId(p) === team,
    };
  });
};

interface Puzzle {
  rows: Criterion[];
  cols: Criterion[];
  answers: Player[][][]; // [row][col] -> valid players
}

const makePuzzle = (players: Player[]): Puzzle | null => {
  const rowPool = buildRowCriteria(players);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rows = shuffle(rowPool).slice(0, 3);
    const cols = shuffle(COLUMN_CRITERIA).slice(0, 3);
    if (rows.length < 3) return null;
    const answers = rows.map((r) => cols.map((c) => players.filter((p) => r.test(p) && c.test(p))));
    // Every cell needs at least one answer, and the board needs 9 distinct players to be completable.
    if (answers.some((row) => row.some((cell) => cell.length === 0))) continue;
    const distinct = new Set(answers.flat(2).map(playerKey));
    if (distinct.size < 9) continue;
    return { rows, cols, answers };
  }
  return null;
};

const LeagueGrid = ({ players, ovrMap }: { players: Player[]; ovrMap: Map<string, number> }) => {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(() => makePuzzle(players));
  const [filled, setFilled] = useState<Record<string, Player>>({});
  const [guessesLeft, setGuessesLeft] = useState(MAX_GUESSES);
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);
  const [selection, setSelection] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [best, setBest] = useState(() => loadGameStat(STAT_KEYS.gridBest));
  const [confetti, setConfetti] = useState<number | false>(false);

  const usedKeys = useMemo(() => new Set(Object.values(filled).map(playerKey)), [filled]);
  const score = Object.keys(filled).length;
  const finished = revealed || guessesLeft === 0 || score === 9;

  const recordBest = (s: number) => {
    if (s > best) {
      setBest(s);
      saveGameStat(STAT_KEYS.gridBest, s);
    }
    if (s === 9) setConfetti(Date.now());
  };

  const reset = () => {
    setPuzzle(makePuzzle(players));
    setFilled({});
    setGuessesLeft(MAX_GUESSES);
    setRevealed(false);
    setFeedback(null);
    setActiveCell(null);
  };

  const submit = () => {
    if (!puzzle || !activeCell || !selection) return;
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
                const sample = revealed && !player ? puzzle.answers[r][c][0] : null;
                const active = activeCell?.[0] === r && activeCell?.[1] === c;
                if (player) {
                  return (
                    <div key={col.id} className="lg-cell filled pop">
                      <GameBanner player={player as GamePlayer} ovr={ovrMap.get(playerKey(player))} reveal className="lg-banner" />
                    </div>
                  );
                }
                return (
                  <button
                    key={col.id}
                    type="button"
                    className="lg-cell"
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

      {activeCell && !finished && (
        <div className={cn('panel mt-4 mx-auto flex flex-col gap-3', wrong > 0 && feedback && 'shake')} style={{ maxWidth: 520 }} key={`pick-${wrong}`}>
          <h3>
            Pick a player · {puzzle.rows[activeCell[0]].label} × {puzzle.cols[activeCell[1]].label}
          </h3>
          <PlayerSearchSelect players={players} value={selection} onValueChange={setSelection} placeholder="Search players..." />
          {feedback && (
            <p className="flag" role="alert" style={{ margin: 0 }}>
              {feedback}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ArcadeButton tone="go" disabled={!selection} onClick={submit}>
              Lock it in ({guessesLeft} left)
            </ArcadeButton>
            <ArcadeButton tone="ghost" onClick={() => setActiveCell(null)}>
              Cancel
            </ArcadeButton>
          </div>
        </div>
      )}

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
