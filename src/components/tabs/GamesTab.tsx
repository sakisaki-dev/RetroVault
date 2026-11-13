import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import '../games/arcade.css';
import '../games/arcadeHall.css';
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
import { HomeNews } from '../news/WhatChanged';
import { STAT_KEYS, loadGameStat, saveGameStat, useGamePlayers, type GamePlayer } from '../games/gameUtils';
import { fnv1a } from '@/utils/edition';

type GameId = 'rank' | 'perfect' | 'kc' | 'legend' | 'hol' | 'grid' | 'imposter' | 'sixdeg' | 'ou' | 'build';

/** A personal best for the cabinet's score plate: a short label and the value. */
interface Best {
  k: string;
  v: string;
}

interface GameDef {
  id: GameId;
  title: string;
  /** One line for the cabinet */
  pitch: string;
  /** The full rule: the featured cabinet and the screen reader description (each game has its own how-to strip) */
  rule: string;
  color: string;
  /** This browser's best, or null before the first finished game */
  record: () => Best | null;
  /** `ovrMap` is the official OVR over the full game pool (same numbers as the stats pages) */
  render: (players: GamePlayer[], ovrMap: Map<string, number>) => ReactNode;
}

const best = (key: string, k: string, fmt: (n: number) => string) => (): Best | null => {
  const v = loadGameStat(key, -1);
  return v >= 0 ? { k, v: fmt(v) } : null;
};

const GAMES: GameDef[] = [
  {
    id: 'perfect',
    title: 'Can you go 18–0?',
    pitch: 'Draft sealed prospects, then play the season. Go unbeaten.',
    rule: "Draft nine sealed prospects from partial stat lines, pick a franchise and play 14 games plus four playoff rounds. You won't learn who they are until the season ends.",
    color: 'var(--turf)',
    record: () => {
      const w = loadGameStat(STAT_KEYS.perfectWins, -1);
      return w >= 0 ? { k: 'Best season', v: `${w}-${loadGameStat(STAT_KEYS.perfectLosses, 0)}` } : null;
    },
    render: (players, ovrMap) => <PerfectSeason players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'rank',
    title: 'Blind Rank',
    pitch: 'Slot five players by OVR before you see who comes next.',
    rule: 'Five players arrive one at a time. Slot each from 1 to 5 by OVR before you see who comes next. No moving them later.',
    color: 'var(--gold)',
    record: best(STAT_KEYS.rankBest, 'Best round', (n) => `${n}/10`),
    render: (players, ovrMap) => <BlindRank players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'kc',
    title: 'Keep 3, Cut 3',
    pitch: 'Six players, three roster spots. Every call is final.',
    rule: 'Six players arrive one at a time. Keep the three highest OVRs and cut the rest. Every call is final.',
    color: 'var(--flag)',
    record: () => {
      const n = loadGameStat(STAT_KEYS.kcRounds, 0);
      return n ? { k: 'Right keeps', v: `${loadGameStat(STAT_KEYS.kcCorrect, 0)}/${n * 3}` } : null;
    },
    render: (players, ovrMap) => <KeepCut players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'legend',
    title: 'Guess the Legend',
    pitch: 'Name the mystery player. Every miss opens a clue.',
    rule: 'A sealed card and six clues that unlock with every miss. Name him on clue 1 for 5 points; needing all six scores nothing.',
    color: 'var(--sky)',
    record: best(STAT_KEYS.legendBest, 'Best streak', String),
    render: (players, ovrMap) => <GuessTheLegend players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'hol',
    title: 'Higher or Lower',
    pitch: 'More or fewer? One wrong call ends the run.',
    rule: 'Call more or fewer on career stats and awards. One wrong call ends the streak.',
    color: '#ff8a3d',
    record: best(STAT_KEYS.holBest, 'Best streak', String),
    render: (players, ovrMap) => <HigherOrLower players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'grid',
    title: 'League Grid',
    pitch: 'Nine squares where clubs meet honours. Fill them all.',
    rule: 'Fill all nine cells with a player who fits both the row and the column. Nine guesses, no repeats.',
    color: '#b48cff',
    record: best(STAT_KEYS.gridBest, 'Best grid', (n) => `${n}/9`),
    render: (players, ovrMap) => <LeagueGrid players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'imposter',
    title: "Who's the Imposter?",
    pitch: "Five share a hidden trait. Find the one who doesn't.",
    rule: "Five players share a hidden trait. One doesn't. Find the imposter.",
    color: '#ff6fa8',
    record: best('imposter:best', 'Best streak', String),
    render: (players, ovrMap) => <Imposter players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'sixdeg',
    title: 'Six Degrees of Ikarras',
    pitch: 'Link two players through clubs, eras and lineages.',
    rule: 'Connect the start player to the target through teammates, eras, family and lineages. Every link is a stroke and hints cost one. Beat par to keep the streak.',
    color: '#5ce0c6',
    record: best('sixdeg:best', 'Best streak', String),
    render: (players, ovrMap) => <SixDegrees players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'ou',
    title: 'Over/Under',
    pitch: 'Five career prop lines. Take the over or the under.',
    rule: 'Five career prop lines from the book. Take the over or the under, stake 1–3 units on each, or parlay all five for 5×. Lines tighten as your streak grows.',
    color: '#3ddc84',
    record: best('ou:best', 'Bankroll', (n) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}u`),
    render: (players, ovrMap) => <OverUnder players={players} ovrMap={ovrMap} />,
  },
  {
    id: 'build',
    title: 'Build-a-Legend',
    pitch: 'Steal traits off real players. Build a perfect clone.',
    rule: 'Spin the reel to land on a league player, then steal one of his play-style traits for your creation. Fill every slot and find out who he plays like: hit 95% for a perfect clone.',
    color: '#e0a3ff',
    record: best('build:best', 'Best match', (n) => `${Math.round(n)}%`),
    render: (players, ovrMap) => <BuildALegend players={players} ovrMap={ovrMap} />,
  },
];

const LAST_KEY = 'retroVault:games:arcade:last';
const readLast = (): GameId | null => {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return GAMES.some((g) => g.id === v) ? (v as GameId) : null;
  } catch {
    return null;
  }
};
const writeLast = (id: GameId) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    // storage unavailable: no Continue button next time
  }
};

/** Game of the day: the local date hashed, so everyone gets the same cabinet all day and a new one at midnight. */
const gameOfTheDay = (now: Date): GameDef => {
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return GAMES[fnv1a(`arcade-gotd:${day}`) % GAMES.length];
};

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pad2 = (n: number) => String(n).padStart(2, '0');
const mcVars = (g: GameDef) => ({ '--mc': g.color }) as CSSProperties;

/** The score plate: a personal best, or "New" before the first game. */
const ScorePlate = ({ rec, className }: { rec: Best | null; className: string }) => (
  <span className={className}>
    {rec ? (
      <>
        <i>{rec.k}</i>
        <b className="num">{rec.v}</b>
      </>
    ) : (
      <>
        <i>Insert coin</i>
        <b className="new">New</b>
      </>
    )}
  </span>
);

const GamesTab = () => {
  const [includeLegends, setIncludeLegends] = useState(() => loadGameStat(STAT_KEYS.includeLegends, 1) !== 0);
  const { players, league, legends, ovrMap, legendsLoaded, dataVersion } = useGamePlayers(includeLegends);
  const [game, setGame] = useState<GameId | null>(null);
  const [last, setLast] = useState<GameId | null>(readLast);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cameFrom = useRef<GameId | null>(null);
  const active = GAMES.find((g) => g.id === game) ?? null;
  const featured = useMemo(() => gameOfTheDay(new Date()), []);

  // Screen switches: into a game, bring its title bar into view (under the sticky site header) and focus it; back on the landing, return to the cabinet that was opened and focus it.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const behavior: ScrollBehavior = reducedMotion() ? 'auto' : 'smooth';
    if (game) {
      const bar = headingRef.current?.closest('.gamebar');
      if (bar) {
        // land the title bar just under the sticky site header (Header.tsx publishes its height)
        const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-header-h')) || 0;
        // offsetTop ignores the section's entrance transform, which getBoundingClientRect would include
        let top = 0;
        for (let el = bar as HTMLElement | null; el; el = el.offsetParent as HTMLElement | null) top += el.offsetTop;
        window.scrollTo({ top: Math.max(0, top - headerH - 8), behavior });
      }
      headingRef.current?.focus({ preventScroll: true });
      return;
    }
    const cab = cameFrom.current ? document.querySelector<HTMLElement>(`.arcade .cab[data-game="${cameFrom.current}"]`) : null;
    if (cab) {
      cab.scrollIntoView({ block: 'center', behavior: 'auto' });
      cab.focus({ preventScroll: true });
    } else headingRef.current?.focus({ preventScroll: true });
  }, [game]);

  const toggleLegends = () => {
    const next = !includeLegends;
    setIncludeLegends(next);
    saveGameStat(STAT_KEYS.includeLegends, next ? 1 : 0);
  };

  const open = (id: GameId | null) => {
    if (id) {
      writeLast(id);
      setLast(id);
    } else cameFrom.current = game;
    setGame(id);
  };

  // Records are read on each render of the landing, so a new best shows as soon as you come back.
  const records = GAMES.map((g) => g.record());
  const played = records.filter(Boolean).length;
  const featuredRec = records[GAMES.indexOf(featured)];
  const resume = last && last !== featured.id ? GAMES.find((g) => g.id === last) ?? null : null;

  const marquee = (
    <header className="hall-marquee" aria-label="Arcade">
      <span className="hall-rays" aria-hidden="true" />
      <div className="hall-marquee-in">
        <h1 className="hall-title">
          <span className="hall-kicker">Retro Vault</span>
          <span className="hall-word">Arcade</span>
        </h1>
        <div className="hall-meta">
          <div className="hall-progress" role="img" aria-label={`Records set in ${played} of ${GAMES.length} games`}>
            <span className="hall-progress-k" aria-hidden="true">
              Records <b className="num">{played}</b>/{GAMES.length}
            </span>
            <span className="hall-pips" aria-hidden="true">
              {GAMES.map((g, i) => (
                <i key={g.id} className={records[i] ? 'on' : undefined} style={mcVars(g)} />
              ))}
            </span>
          </div>
          <div className="hall-switches">
            <Lamp label="Players" value={league.length} />
            <button type="button" role="switch" aria-checked={includeLegends} className="toggle" onClick={toggleLegends}>
              <span className="track" aria-hidden="true" />
              NFL legends
              {includeLegends && legends.length > 0 && <b className="num hall-toggle-n">{legends.length}</b>}
            </button>
          </div>
        </div>
      </div>
    </header>
  );

  if (league.length < 5) {
    return (
      <div className="arcade">
        <div className="wrap">
          {marquee}
          <div className="arc-empty">
            <h2 className="disp" style={{ fontSize: 36, color: 'var(--chalk)' }}>
              Arcade closed
            </h2>
            <p>Upload your league data to unlock the games.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="arcade">
      <div className="wrap">
        {!active ? (
          <div className="hall">
            {marquee}

            <div className="hall-top">
              <article className="hall-feature" style={mcVars(featured)} aria-labelledby="hall-feature-title">
                <div className="hall-feature-screen" aria-hidden="true">
                  <div className="hall-feature-art">
                    <ModeArt id={featured.id} />
                  </div>
                </div>
                <div className="hall-feature-body">
                  <p className="hall-tag">
                    <span className="hall-tag-dot" aria-hidden="true" />
                    Game of the day
                  </p>
                  <h2 id="hall-feature-title">{featured.title}</h2>
                  <p className="hall-feature-rule">{featured.rule}</p>
                  <div className="hall-feature-foot">
                    <ArcadeButton tone="go" className="hall-play" onClick={() => open(featured.id)} aria-label={`Play ${featured.title}`}>
                      Play now
                      <span aria-hidden="true">▸</span>
                    </ArcadeButton>
                    <ScorePlate rec={featuredRec} className="hall-score" />
                  </div>
                  {resume && (
                    <button type="button" className="hall-resume" style={mcVars(resume)} onClick={() => open(resume.id)}>
                      <span className="hall-resume-k">Continue</span>
                      <span className="hall-resume-t">{resume.title}</span>
                      <span aria-hidden="true">▸</span>
                    </button>
                  )}
                </div>
              </article>

              {/* What changed in the latest update, and this edition's Spotlight, as the hall's press box */}
              <section className="hall-news" aria-label="League news">
                <HomeNews />
              </section>
            </div>

            <section className="hall-cabs-sec" aria-labelledby="hall-cabs-title">
              <div className="hall-cabs-head">
                <h2 id="hall-cabs-title" ref={headingRef} tabIndex={-1}>
                  Pick a cabinet
                </h2>
                <p>
                  Every game is built from the league's careers.
                  {includeLegends && legends.length > 0 && ' Real NFL players sneak in too, at most one per deal.'}
                </p>
              </div>
              <ul className="hall-cabs">
                {GAMES.map((g, i) => {
                  const rec = records[i];
                  const today = g.id === featured.id;
                  return (
                    <li key={g.id} style={{ '--i': i } as CSSProperties}>
                      <button
                        type="button"
                        className="cab"
                        data-game={g.id}
                        style={mcVars(g)}
                        onClick={() => open(g.id)}
                        aria-label={`Play ${g.title}${today ? ', game of the day' : ''}. ${g.rule} ${rec ? `${rec.k} ${rec.v}.` : 'Not played yet.'}`}
                      >
                        <span className="cab-marquee" aria-hidden="true">
                          <span className="cab-no">{pad2(i + 1)}</span>
                          <span className="cab-title">{g.title}</span>
                        </span>
                        <span className="cab-screen" aria-hidden="true">
                          <span className="cab-art">
                            <ModeArt id={g.id} />
                          </span>
                        </span>
                        <span className="cab-deck" aria-hidden="true">
                          <span className="cab-pitch">{g.pitch}</span>
                          <ScorePlate rec={rec} className="cab-score" />
                        </span>
                        {today && (
                          <span className="cab-today" aria-hidden="true">
                            Today
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        ) : (
          <section className="hall-game" style={mcVars(active)} aria-labelledby="arcade-game-title" aria-describedby="arcade-game-rule">
            <div className="gamebar">
              <ArcadeButton tone="ghost" className="gamebar-back" onClick={() => open(null)} aria-label="Back to all games">
                <span aria-hidden="true">←</span> <span className="gamebar-back-t">Arcade</span>
              </ArcadeButton>
              <h2 id="arcade-game-title" ref={headingRef} tabIndex={-1}>
                <span className="gamebar-no">
                  Cabinet {pad2(GAMES.indexOf(active) + 1)}
                  {active.id === featured.id && ' · Game of the day'}
                </span>
                <span className="gamebar-t">{active.title}</span>
              </h2>
            </div>
            <p id="arcade-game-rule" className="sr-only">
              {active.rule}
            </p>
            {/* Wait for legends.json / exclusions so OVRs are final, and re-mount on data / legends changes */}
            {legendsLoaded ? (
              <div key={`${active.id}-${dataVersion}-${includeLegends ? legends.length : 0}`}>{active.render(players, ovrMap)}</div>
            ) : (
              <p className="arc-hint" role="status">
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
