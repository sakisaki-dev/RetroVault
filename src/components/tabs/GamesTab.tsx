import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NFL_TEAMS } from '@/utils/nflTeams';
import '../games/arcade.css';
import GuessTheLegend from '../games/GuessTheLegend';
import HigherOrLower from '../games/HigherOrLower';
import LeagueGrid from '../games/LeagueGrid';
import BlindRank from '../games/BlindRank';
import PerfectSeason from '../games/PerfectSeason';
import KeepCut from '../games/KeepCut';
import Imposter from '../games/Imposter';
import SixDegrees from '../games/SixDegrees';
import OverUnder from '../games/OverUnder';
import BuildALegend from '../games/BuildALegend';
import ModeArt from '../games/ModeArt';
import { ArcadeButton, Lamp } from '../games/ArcadeUI';
import { STAT_KEYS, loadGameStat, saveGameStat, useGamePlayers, type GamePlayer } from '../games/gameUtils';

type GameId = 'rank' | 'perfect' | 'kc' | 'legend' | 'hol' | 'grid' | 'imposter' | 'sixdeg' | 'ou' | 'build';



interface GameDef {
  id: GameId;
  title: string;
  rule: string;
  color: string;
  record: () => string;
  /** `ovrMap` is the official OVR over the full game pool (same numbers as the stats pages) */
  render: (players: GamePlayer[], ovrMap: Map<string, number>) => ReactNode;
}

const rec = (key: string, fmt: (n: number) => string, empty: string) => () => {
  const v = loadGameStat(key, -1);
  return v >= 0 ? fmt(v) : empty;
};

const GAMES: GameDef[] = [
  {
    id: 'perfect',
    title: 'Can you go 18–0?',
    rule: "Draft nine sealed prospects from partial stat lines, pick a franchise and play 14 games plus four playoff rounds. You won't learn who they are until the season ends.",
    color: 'var(--turf)',
    record: () => {
      const w = loadGameStat(STAT_KEYS.perfectWins, -1);
      return w >= 0 ? `Best season ${w}–${loadGameStat(STAT_KEYS.perfectLosses, 0)}` : 'No seasons played';
    },
    render: (players, ovrMap) => <PerfectSeason players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'rank',
    title: 'Blind Rank',
    rule: 'Five players arrive one at a time. Slot each from 1 to 5 by OVR before you see who comes next. No moving them later.',
    color: 'var(--gold)',
    record: rec(STAT_KEYS.rankBest, (n) => `Best round ${n}/10`, 'No rounds played'),
    render: (players, ovrMap) => <BlindRank players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'kc',
    title: 'Keep 3, Cut 3',
    rule: 'Six players arrive one at a time. Keep the three highest OVRs and cut the rest. Every call is final.',
    color: 'var(--flag)',
    record: () => {
      const n = loadGameStat(STAT_KEYS.kcRounds, 0);
      return n ? `${loadGameStat(STAT_KEYS.kcCorrect, 0)}/${n * 3} correct keeps` : 'No rosters cut';
    },
    render: (players, ovrMap) => <KeepCut players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'legend',
    title: 'Guess the Legend',
    rule: 'A sealed card and six clues that unlock with every miss. Name him on clue 1 for 5 points; needing all six scores nothing.',
    color: 'var(--sky)',
    record: rec(STAT_KEYS.legendBest, (n) => `Best streak ${n}`, 'No streak yet'),
    render: (players, ovrMap) => <GuessTheLegend players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'hol',
    title: 'Higher or Lower',
    rule: 'Call more or fewer on career stats and awards. One wrong call ends the streak.',
    color: '#ff8a3d',
    record: rec(STAT_KEYS.holBest, (n) => `Best streak ${n}`, 'No streak yet'),
    render: (players, ovrMap) => <HigherOrLower players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'grid',
    title: 'League Grid',
    rule: 'Fill all nine cells with a player who fits both the row and the column. Nine guesses, no repeats.',
    color: '#b48cff',
    record: rec(STAT_KEYS.gridBest, (n) => `Best grid ${n}/9`, 'No grids played'),
    render: (players, ovrMap) => <LeagueGrid players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'imposter',
    title: "Who's the Imposter?",
    rule: "Five players share a hidden trait. One doesn't. Find the imposter.",
    color: '#ff6fa8',
    record: rec('imposter:best', (n) => `Best streak ${n}`, 'No streak yet'),
    render: (players, ovrMap) => <Imposter players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'sixdeg',
    title: 'Six Degrees of Ikarras',
    rule: 'Connect the start player to the target through teammates, eras, family and lineages. Every link is a stroke and hints cost one. Beat par to keep the streak.',
    color: '#5ce0c6',
    record: rec('sixdeg:best', (n) => `Best streak ${n}`, 'No streak yet'),
    render: (players, ovrMap) => <SixDegrees players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'ou',
    title: 'Over/Under',
    rule: 'Five career prop lines from the book. Take the over or the under, stake 1–3 units on each, or parlay all five for 5×. Lines tighten as your streak grows.',
    color: '#3ddc84',
    record: rec('ou:best', (n) => `Best bankroll ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}u`, 'No slips settled'),
    render: (players, ovrMap) => <OverUnder players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'build',
    title: 'Build-a-Legend',
    rule: 'Pull the lever to land on a league player, then steal one of his play-style traits for your creation. Fill every slot and find out who he plays like: hit 95% for a perfect clone.',
    color: '#e0a3ff',
    record: rec('build:best', (n) => `Best match ${Math.round(n)}%`, 'No legends built'),
    render: (players, ovrMap) => <BuildALegend players={players} ovrMap={ovrMap} />,
  },
];

/**
 * Landing grid: every card the same size and no empty cells. For each breakpoint's maximum column count,
 * use the widest count (max or one fewer) that divides the number of modes. If neither does, keep the max and
 * stretch the final row: the grid gets lcm(cols, leftover) tracks so the leftover cards share the row evenly.
 * arcade.css reads --tracks-{bp} on the list and --span-{bp} on each card.
 */
const GRID_MAX_COLS = { sm: 2, md: 3, lg: 4, xl: 5 } as const;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const gridLayout = (max: number, n: number) => {
  const cols = [max, max - 1].find((c) => c >= 1 && n % c === 0) ?? max;
  const rem = n % cols;
  const tracks = rem ? (cols * rem) / gcd(cols, rem) : cols;
  return { tracks, span: (i: number) => (rem && i >= n - rem ? tracks / rem : tracks / cols) };
};
const GRID = Object.entries(GRID_MAX_COLS).map(([bp, max]) => ({ bp, ...gridLayout(max, GAMES.length) }));
const GRID_VARS = Object.fromEntries(GRID.map((g) => [`--tracks-${g.bp}`, g.tracks])) as CSSProperties;
const spanVars = (i: number) => Object.fromEntries(GRID.map((g) => [`--span-${g.bp}`, g.span(i)])) as CSSProperties;
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

const GamesTab = () => {
  const [includeLegends, setIncludeLegends] = useState(() => loadGameStat(STAT_KEYS.includeLegends, 1) !== 0);
  const { players, league, legends, ovrMap, legendsLoaded, dataVersion } = useGamePlayers(includeLegends);
  const [game, setGame] = useState<GameId | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const active = GAMES.find((g) => g.id === game) ?? null;

  // Move focus to the game title (or back to the landing) when switching screens, for keyboard users.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus({ preventScroll: true });
    mounted.current = true;
  }, [game]);

  const toggleLegends = () => {
    const next = !includeLegends;
    setIncludeLegends(next);
    saveGameStat(STAT_KEYS.includeLegends, next ? 1 : 0);
  };

  const open = (id: GameId | null) => {
    setGame(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="arcade">
      <div className="wrap">
        <header className="board" aria-label="Arcade scoreboard">
          <div className="board-top">
            <h1 className="wordmark">
              Retro <span>Vault</span> Arcade
            </h1>
            <div className="board-meta">
              <Lamp label="Players" value={league.length} />
              <Lamp label="Legends" value={includeLegends ? legends.length : 'Off'} />
              <Lamp label="Games" value={GAMES.length} flicker />
            </div>
          </div>
          <div className="board-sub">
            <span>
              {league.length} league players · {NFL_TEAMS.length} teams · 8 divisions
            </span>
            <button type="button" role="switch" aria-checked={includeLegends} className="toggle" onClick={toggleLegends}>
              <span className="track" aria-hidden="true" />
              Include NFL legends
            </button>
            <span className="ok" aria-live="polite">
              {active ? `Now playing · ${active.title}` : 'Insert coin · pick a mode'}
            </span>
          </div>
        </header>

        {league.length < 5 ? (
          <div className="empty">
            <h2 className="disp" style={{ fontSize: 36, color: 'var(--chalk)' }}>
              Arcade closed
            </h2>
            <p>Upload your league data to unlock the games.</p>
          </div>
        ) : !active ? (
          <>
            <div className="home-intro">
              <h2 ref={headingRef} tabIndex={-1}>
                {NUMBER_WORDS[GAMES.length] ?? GAMES.length} ways to test your league IQ
              </h2>
              <p>
                Every game is built from your league's careers.
                {includeLegends && legends.length > 0 && ' Real NFL players sneak in too, at most one per deal, and you only find out who at the reveal.'}
              </p>
            </div>
            <ul className="modes" style={{ listStyle: 'none', margin: 0, padding: 0, ...GRID_VARS }}>
              {GAMES.map((g, i) => {
                return (
                  <li key={g.id} className="mode-li" style={spanVars(i)}>
                    <button
                      type="button"
                      className="mode"
                      style={{ '--mc': g.color, animationDelay: `${i * 70}ms`, width: '100%' } as CSSProperties}
                      onClick={() => open(g.id)}
                      aria-label={`Play ${g.title}. ${g.rule} ${g.record()}`}
                    >
                      <div className="mode-art" aria-hidden="true">
                        <span className="tag">Mode {i + 1}</span>
                        <ModeArt id={g.id} />
                      </div>
                      <div className="mode-body" aria-hidden="true">
                        <h3>{g.title}</h3>
                        <p>{g.rule}</p>
                        <div className="rec">{g.record()}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <section aria-labelledby="arcade-game-title">
            <div className="gamebar">
              <div className="left">
                <ArcadeButton tone="ghost" onClick={() => open(null)} aria-label="Back to all games">
                  ← Modes
                </ArcadeButton>
                <h2 id="arcade-game-title" ref={headingRef} tabIndex={-1}>
                  {active.title}
                </h2>
              </div>
            </div>
            <p className="rule">{active.rule}</p>
            {/* Wait for legends.json / exclusions so OVRs are final, and re-mount on data / legends changes */}
            {legendsLoaded ? (
              <div key={`${active.id}-${dataVersion}-${includeLegends ? legends.length : 0}`}>{active.render(players, ovrMap)}</div>
            ) : (
              <p className="hint" role="status">
                Loading the player pool…
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default GamesTab;
