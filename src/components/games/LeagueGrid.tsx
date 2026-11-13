import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { awardPack } from '@/utils/collection';
import InLeague from '@/components/InLeague';
import { matchPlayer } from '@/components/PlayerSearchSelect';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import { NFL_TEAMS, findNFLTeam } from '@/utils/nflTeams';
import { cn } from '@/lib/utils';
import { useJerseyNumbers } from '@/utils/jerseys';
import { ArcadeButton, Confetti, CountUp } from './ArcadeUI';
import { STAT_KEYS, isDefender, isLegend, loadGameStat, playerKey, type GamePlayer, saveGameStat, shuffle } from './gameUtils';
import { bannerTeamOf } from '@/utils/playerExtras';
import { ClubLogo, clubLook, playerClub, splitName, useReducedMotion } from './stageKit';
import HowToStrip from './HowToStrip';
import './leagueGrid.css';

const MAX_GUESSES = 9;

interface Criterion {
  id: string;
  label: string;
  test: (p: Player) => boolean;
  /** Hex/HSL accent for team rows */
  color?: string;
  logo?: string;
  /** Column badge glyph */
  icon?: CritIcon;
  /** Short row label (team abbreviation / position) for the phone layout */
  short?: string;
}

type CritIcon = 'ring' | 'noring' | 'trophy' | 'star' | 'rookie' | 'crown' | 'clock' | 'bolt';

const COLUMN_CRITERIA: Criterion[] = [
  { id: 'rings3', icon: 'ring', label: '3+ Rings', test: (p) => p.rings >= 3 },
  { id: 'ring1', icon: 'ring', label: 'Won a Ring', test: (p) => p.rings >= 1 },
  { id: 'ringless', icon: 'noring', label: 'Never Won a Ring', test: (p) => p.rings === 0 },
  { id: 'mvp', icon: 'trophy', label: 'MVP Winner', test: (p) => p.mvp >= 1 },
  { id: 'poy', icon: 'star', label: 'OPOY / DPOY Winner', test: (p) => p.opoy >= 1 },
  { id: 'sbmvp', icon: 'trophy', label: 'Super Bowl MVP', test: (p) => p.sbmvp >= 1 },
  { id: 'roty', icon: 'rookie', label: 'Rookie of the Year', test: (p) => p.roty >= 1 },
  // League-only metrics: real NFL legends never qualify for these.
  { id: 'hof', icon: 'crown', label: 'Hall of Famer', test: (p) => !isLegend(p) && isHallOfFamer(p) },
  { id: 'mvp2', icon: 'trophy', label: '2+ MVPs', test: (p) => p.mvp >= 2 },
  { id: 'ringmvp', icon: 'ring', label: 'Ring + MVP', test: (p) => p.rings >= 1 && p.mvp >= 1 },
  { id: 'games250', icon: 'clock', label: '250+ Games', test: (p) => p.games >= 250 },
  { id: 'games100less', icon: 'clock', label: 'Under 100 Games', test: (p) => p.games < 100 },
  { id: 'tt800', icon: 'bolt', label: '800+ True Talent', test: (p) => !isLegend(p) && p.trueTalent >= 800 },
  { id: 'tpg3', icon: 'bolt', label: '3.0+ TPG', test: (p) => !isLegend(p) && p.tpg >= 3 },
];

const POSITION_ROWS: Criterion[] = [
  { id: 'qb', short: 'QB', label: 'Quarterback', test: (p) => p.position === 'QB' },
  { id: 'rb', short: 'RB', label: 'Running Back', test: (p) => p.position === 'RB' },
  { id: 'wr', short: 'WR', label: 'Wide Receiver', test: (p) => p.position === 'WR' },
  { id: 'te', short: 'TE', label: 'Tight End', test: (p) => p.position === 'TE' },
  { id: 'ol', short: 'OL', label: 'Offensive Line', test: (p) => p.position === 'OL' },
  { id: 'def', short: 'DEF', label: 'Defense', test: isDefender },
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
      short: nfl?.abbreviation ?? team,
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


/** Column badge: a tiny pixel-ish glyph so each column reads at a glance. */
const CritGlyph = ({ icon }: { icon?: CritIcon }) => {
  if (!icon) return null;
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true, className: 'lg2-glyph' } as const;
  switch (icon) {
    case 'ring':
    case 'noring':
      return (
        <svg {...common}>
          <circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M8 3h8l2 3-6 4-6-4z" fill="currentColor" />
          {icon === 'noring' && <path d="M3 21 21 3" stroke="var(--flag)" strokeWidth="3" strokeLinecap="round" />}
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor" />
          <path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M11 13h2v4h3v3H8v-3h3z" fill="currentColor" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" fill="currentColor" />
        </svg>
      );
    case 'rookie':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" />
          <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#0b1020" fontFamily="Silkscreen, monospace">
            R1
          </text>
        </svg>
      );
    case 'crown':
      return (
        <svg {...common}>
          <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="currentColor" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M12 7v5l3 3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M14 2 4 14h7l-2 8 10-12h-7z" fill="currentColor" />
        </svg>
      );
  }
};

/** Row header: the club's logo and colours (or a position badge when the league falls back to positions). */
const RowHead = ({ row, lit }: { row: Criterion; lit: boolean }) => {
  const look = row.logo ? clubLook(row.label) : null;
  return (
    <div role="rowheader" className={cn('lg2-row', look ? 'team' : 'pos', lit && 'lit')} style={look?.vars}>
      {look ? <ClubLogo look={look} className="lg2-row-logo" /> : <span className="lg2-row-pos" aria-hidden="true">{row.short}</span>}
      <span className="lg2-row-name">
        <span className="full">{row.label}</span>
        <span className="short" aria-hidden="true">
          {row.short ?? row.label}
        </span>
      </span>
    </div>
  );
};

/** A filled square: the player's card in his club colours. */
const GridCard = ({ player, fits, missed = false, delay = 0 }: { player: GamePlayer; fits: number; missed?: boolean; delay?: number }) => {
  const look = playerClub(player);
  const { numberFor } = useJerseyNumbers();
  const { first, last } = splitName(player.name);
  return (
    <div className={cn('lg2-card', missed ? 'missed' : 'hit', fits <= 2 && !missed && 'rare')} style={{ ...look.vars, animationDelay: `${delay}ms` }}>
      <ClubLogo look={look} className="lg2-card-logo" />
      <span className="lg2-card-num" aria-hidden="true">
        {numberFor(player)}
      </span>
      <span className="lg2-card-pos">
        {player.position} <InLeague player={player} label={false} />
      </span>
      <span className="lg2-card-name">
        {first && <span className="first">{first}</span>}
        <span className="last">{last}</span>
      </span>
      <span className="lg2-card-fits">{missed ? `Answer · ${fits} fit${fits === 1 ? '' : 's'}` : fits <= 2 ? `Rare · ${fits} fit${fits === 1 ? '' : 's'}` : `${fits} fits`}</span>
    </div>
  );
};

/** Scout sheet: the search for the square being filled. Bottom sheet on a phone, a floating panel on desktop. */
const ScoutSheet = ({
  players,
  row,
  col,
  usedKeys,
  feedback,
  wrong,
  guessesLeft,
  onPick,
  onClose,
}: {
  players: GamePlayer[];
  row: Criterion;
  col: Criterion;
  usedKeys: Set<string>;
  feedback: string | null;
  wrong: number;
  guessesLeft: number;
  onPick: (key: string) => void;
  onClose: () => void;
}) => {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus({ preventScroll: true }), []);
  const results = useMemo(() => {
    if (!q.trim()) return [];
    return players
      .map((p) => ({ p, s: matchPlayer(`${p.name} ${p.nickname ?? ''} ${p.position} ${bannerTeamOf(p)} ${p.team ?? ''}`, q, [p.name]) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
      .slice(0, 7)
      .map((x) => x.p);
  }, [players, q]);
  useEffect(() => setHi(0), [q]);
  // Escape closes from anywhere in the sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const rowLook = row.logo ? clubLook(row.label) : null;
  const pick = (p: GamePlayer) => {
    onPick(playerKey(p));
    setQ('');
    inputRef.current?.focus({ preventScroll: true });
  };
  const listId = 'lg2-results';
  return (
    <>
      <div className="lg2-scrim" onClick={onClose} aria-hidden="true" />
      <div className="lg2-sheet" role="dialog" aria-modal="true" aria-label={`Pick a player who fits ${row.label} and ${col.label}`}>
        <div className="lg2-sheet-grab" aria-hidden="true" />
        <div className="lg2-sheet-head">
          <span className="lg2-crit team" style={rowLook?.vars}>
            {rowLook ? <ClubLogo look={rowLook} className="lg2-crit-logo" /> : <b>{row.short}</b>}
            {row.label}
          </span>
          <span className="lg2-x" aria-hidden="true">
            ×
          </span>
          <span className="lg2-crit col">
            <CritGlyph icon={col.icon} />
            {col.label}
          </span>
          <button type="button" className="lg2-close" onClick={onClose} aria-label="Close the search">
            ✕
          </button>
        </div>
        <div key={wrong} className={cn('lg2-search', feedback && wrong > 0 && 'shake')}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="m15 15 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            placeholder="Search any player…"
            aria-label={`Search for a player who fits ${row.label} and ${col.label}`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[hi] ? `${listId}-${hi}` : undefined}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHi((h) => Math.min(h + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHi((h) => Math.max(h - 1, 0));
              } else if (e.key === 'Enter' && results[hi]) {
                e.preventDefault();
                pick(results[hi]);
              }
            }}
          />
          <span className={cn('lg2-left', guessesLeft <= 2 && 'low')}>{guessesLeft} left</span>
        </div>
        <p className="lg2-feedback" role="alert">
          {feedback ?? ''}
        </p>
        {results.length > 0 ? (
          <ul id={listId} role="listbox" className="lg2-results" aria-label="Matching players">
            {results.map((p, i) => {
              const look = playerClub(p);
              const used = usedKeys.has(playerKey(p));
              return (
                <li
                  key={playerKey(p)}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === hi}
                  aria-disabled={used || undefined}
                  className={cn('lg2-opt', i === hi && 'hi', used && 'used')}
                  style={look.vars}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                >
                  <span className="lg2-opt-badge">
                    <ClubLogo look={look} />
                  </span>
                  <span className="lg2-opt-name">
                    {p.name}
                    {p.nickname && <i> "{p.nickname}"</i>}
                  </span>
                  <span className="lg2-opt-pos">{used ? 'On grid' : p.position}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="lg2-empty">{q.trim() ? 'No player by that name.' : 'Type a few letters. A wrong pick costs a guess; a repeat does not.'}</p>
        )}
      </div>
    </>
  );
};

const verdictFor = (s: number) =>
  s === 9 ? 'Perfect grid' : s >= 7 ? 'All-Pro grid' : s >= 5 ? 'Starter grid' : s >= 3 ? 'Practice squad' : 'Back to the film room';

const LeagueGrid = ({ players }: { players: Player[]; ovrMap: Map<string, number> }) => {
  const extras = usePlayerExtras();
  const reduced = useReducedMotion();
  const teamsOf = useMemo(() => franchiseLookup(extras.franchises), [extras.franchises]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(() => makePuzzle(players, teamsOf));
  const [deal, setDeal] = useState(0);
  const [filled, setFilled] = useState<Record<string, Player>>({});
  const [guessesLeft, setGuessesLeft] = useState(MAX_GUESSES);
  // Franchise history loads after the first grid is dealt; re-deal once it arrives if no guess was made yet,
  // so team rows count every franchise a player played for (e.g. Brandson as a Giant).
  useEffect(() => {
    if (guessesLeft === MAX_GUESSES) setPuzzle(makePuzzle(players, teamsOf));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the franchise history changes
  }, [teamsOf]);
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const [missFlash, setMissFlash] = useState(0);
  const [lastFilled, setLastFilled] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [best, setBest] = useState(() => loadGameStat(STAT_KEYS.gridBest));
  const [newBest, setNewBest] = useState(false);
  const [confetti, setConfetti] = useState<number | false>(false);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const resultRef = useRef<HTMLDivElement>(null);

  const usedKeys = useMemo(() => new Set(Object.values(filled).map(playerKey)), [filled]);
  const score = Object.keys(filled).length;
  const finished = revealed || guessesLeft === 0 || score === 9;

  // Answers for missed squares: a maximum matching, so as many squares as possible show a DIFFERENT player
  // (never one already on the board). Squares whose every valid player is used elsewhere stay empty and say so.
  const revealPicks = useMemo(() => {
    const picks: Record<string, GamePlayer> = {};
    if (!puzzle || !finished) return picks;
    const cells: { id: string; options: GamePlayer[] }[] = [];
    puzzle.answers.forEach((row, r) =>
      row.forEach((opts, c) => {
        const id = `${r}-${c}`;
        if (!filled[id]) cells.push({ id, options: (opts as GamePlayer[]).filter((p) => !usedKeys.has(playerKey(p))) });
      }),
    );
    const owner = new Map<string, number>();
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
  }, [puzzle, finished, filled, usedKeys]);

  // Bring the result panel into view when the grid ends.
  useEffect(() => {
    if (finished) resultRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }, [finished, reduced]);

  const recordBest = (s: number) => {
    if (s > best) {
      setBest(s);
      setNewBest(true);
      saveGameStat(STAT_KEYS.gridBest, s);
    }
    if (s === 9) setConfetti(Date.now());
    if (s === 9) awardPack('premium', 'League Grid 9/9', { once: puzzle ?? undefined });
    else if (s >= 6) awardPack('standard', `League Grid ${s}/9`, { once: puzzle ?? undefined });
  };

  const closeSheet = () => {
    const cell = activeCell;
    setActiveCell(null);
    setFeedback(null);
    if (cell) requestAnimationFrame(() => cellRefs.current[`${cell[0]}-${cell[1]}`]?.focus({ preventScroll: true }));
  };

  const reset = () => {
    setPuzzle(makePuzzle(players, teamsOf));
    setDeal((d) => d + 1);
    setFilled({});
    setGuessesLeft(MAX_GUESSES);
    setRevealed(false);
    setFeedback(null);
    setActiveCell(null);
    setLastFilled(null);
    setNewBest(false);
  };

  const submit = (pickedKey: string) => {
    if (!puzzle || !activeCell || !pickedKey) return;
    const [r, c] = activeCell;
    const guess = players.find((p) => playerKey(p) === pickedKey);
    if (!guess) return;
    if (usedKeys.has(pickedKey)) {
      setFeedback(`${guess.name} is already on your grid. No guess used.`);
      setWrong((w) => w + 1);
      return;
    }
    const remaining = guessesLeft - 1;
    setGuessesLeft(remaining);
    const correct = puzzle.answers[r][c].some((p) => playerKey(p) === pickedKey);
    if (correct) {
      const id = `${r}-${c}`;
      const next = { ...filled, [id]: guess };
      setFilled(next);
      setLastFilled(id);
      setActiveCell(null);
      setFeedback(null);
      if (remaining === 0 || Object.keys(next).length === 9) recordBest(Object.keys(next).length);
      else requestAnimationFrame(() => cellRefs.current[id]?.focus({ preventScroll: true }));
    } else {
      setFeedback(`${guess.name} doesn't fit both. ${remaining} guess${remaining === 1 ? '' : 'es'} left.`);
      setWrong((w) => w + 1);
      setMissFlash(Date.now());
      if (remaining === 0) {
        setActiveCell(null);
        recordBest(score);
      }
    }
  };

  if (!puzzle) {
    return <p className="arc-empty">Not enough variety in the league to build a grid yet. Add more players or teams.</p>;
  }

  const fits = (r: number, c: number) => puzzle.answers[r][c].length;
  const [ar, ac] = activeCell ?? [-1, -1];
  const rarest = Object.entries(filled)
    .map(([id, p]) => ({ p, n: fits(+id[0], +id[2]) }))
    .sort((a, b) => a.n - b.n)[0];

  return (
    <div className="lg2">
      <Confetti fire={confetti} />
      <HowToStrip
        id="grid"
        steps={[
          <>
            Each square sits where a <strong>club row</strong> meets an <strong>honour column</strong>. Tap one.
          </>,
          <>
            Name a player who fits <strong>both</strong>. Clubs count every franchise he played for.
          </>,
          <>
            <strong>9 guesses</strong>, no player twice. 6 squares earn a Standard pack, all 9 a Premium.
          </>,
        ]}
      />

      <div className="lg2-board" aria-label="Scoreboard">
        <div className="lg2-score">
          <span className="k">Score</span>
          <span className="v num" aria-live="polite">
            {score}
            <small>/9</small>
          </span>
        </div>
        <div className="lg2-guesses" aria-label={`${guessesLeft} of ${MAX_GUESSES} guesses left`} role="img">
          <span className="k">Guesses</span>
          <span key={missFlash} className={cn('lg2-pips', missFlash > 0 && 'flash')}>
            {Array.from({ length: MAX_GUESSES }, (_, i) => (
              <i key={i} className={cn(i < guessesLeft ? 'on' : 'off', i === guessesLeft && 'just')} />
            ))}
          </span>
        </div>
        <div className="lg2-score best">
          <span className="k">Best</span>
          <span className="v num">
            {best}
            <small>/9</small>
          </span>
        </div>
      </div>

      <div className={cn('lg2-grid', finished && 'done')} key={deal} role="grid" aria-label="League grid">
        <div className="lg2-corner" aria-hidden="true">
          <span>{finished ? 'Final' : `${9 - score} to go`}</span>
        </div>
        {puzzle.cols.map((col, c) => (
          <div key={col.id} className={cn('lg2-head', ac === c && 'lit')} role="columnheader" style={{ animationDelay: `${c * 60}ms` }}>
            <CritGlyph icon={col.icon} />
            <span>{col.label}</span>
          </div>
        ))}

        {puzzle.rows.map((row, r) => (
          <div key={row.id} className="contents" role="row">
            <RowHead row={row} lit={ar === r} />
            {puzzle.cols.map((col, c) => {
              const id = `${r}-${c}`;
              const player = filled[id] as GamePlayer | undefined;
              const sample = finished && !player ? revealPicks[id] ?? null : null;
              const active = ar === r && ac === c;
              const rowLook = row.logo ? clubLook(row.label) : null;
              if (player) {
                return (
                  <div key={col.id} role="gridcell" className={cn('lg2-cell filled', lastFilled === id && 'fresh')} aria-label={`${row.label} and ${col.label}: ${player.name}`}>
                    <GridCard player={player} fits={fits(r, c)} />
                  </div>
                );
              }
              if (finished) {
                return (
                  <div key={col.id} role="gridcell" className="lg2-cell over" aria-label={`${row.label} and ${col.label}: missed${sample ? `, ${sample.name} fits` : ''}`}>
                    {sample ? (
                      <GridCard player={sample} fits={fits(r, c)} missed delay={(r * 3 + c) * 70} />
                    ) : (
                      <span className="lg2-cell-note">All {fits(r, c)} used elsewhere</span>
                    )}
                  </div>
                );
              }
              return (
                <div key={col.id} role="gridcell" className="lg2-cell-wrap">
                  <button
                    ref={(el) => (cellRefs.current[id] = el)}
                    type="button"
                    className={cn('lg2-cell open', active && 'active')}
                    style={rowLook?.vars}
                    aria-haspopup="dialog"
                    aria-label={`${row.label} and ${col.label}. Empty square, choose a player.`}
                    onClick={() => {
                      setActiveCell([r, c]);
                      setFeedback(null);
                    }}
                  >
                    {rowLook && <ClubLogo look={rowLook} className="lg2-cell-ghost" />}
                    <span className="lg2-plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {activeCell && !finished && (
        <ScoutSheet
          players={players as GamePlayer[]}
          row={puzzle.rows[ar]}
          col={puzzle.cols[ac]}
          usedKeys={usedKeys}
          feedback={feedback}
          wrong={wrong}
          guessesLeft={guessesLeft}
          onPick={submit}
          onClose={closeSheet}
        />
      )}

      {finished ? (
        <div className={cn('lg2-result', score === 9 && 'perfect')} ref={resultRef} role="status">
          <div className="lg2-result-score">
            <span className="v num">
              <CountUp value={score} duration={700} />
              <small>/9</small>
            </span>
            <span className="lg2-verdict">{verdictFor(score)}</span>
            {newBest && <span className="lg2-newbest">New best</span>}
          </div>
          <div className="lg2-recap" aria-hidden="true">
            {puzzle.rows.map((_, r) =>
              puzzle.cols.map((__, c) => {
                const p = filled[`${r}-${c}`];
                const look = p ? playerClub(p) : null;
                return <i key={`${r}-${c}`} className={p ? 'hit' : 'miss'} style={look?.vars} />;
              }),
            )}
          </div>
          <div className="lg2-result-side">
            <p>
              {MAX_GUESSES - guessesLeft} guess{MAX_GUESSES - guessesLeft === 1 ? '' : 'es'} used
              {rarest && (
                <>
                  {' · '}rarest pick <b style={{ color: playerClub(rarest.p).ink }}>{rarest.p.name}</b> ({rarest.n} fit{rarest.n === 1 ? '' : 's'})
                </>
              )}
            </p>
            <p className="lg2-reward">{score === 9 ? 'Premium pack earned' : score >= 6 ? 'Standard pack earned' : `${6 - score} more square${6 - score === 1 ? '' : 's'} would have earned a pack`}</p>
            <ArcadeButton tone="go" onClick={reset} autoFocus>
              Deal a new grid
            </ArcadeButton>
          </div>
        </div>
      ) : (
        <div className="lg2-actions">
          <ArcadeButton
            tone="ghost"
            onClick={() => {
              setRevealed(true);
              setActiveCell(null);
              recordBest(score);
            }}
          >
            Give up and reveal
          </ArcadeButton>
          <ArcadeButton tone="ghost" onClick={reset}>
            New grid
          </ArcadeButton>
        </div>
      )}
    </div>
  );
};

export default LeagueGrid;
