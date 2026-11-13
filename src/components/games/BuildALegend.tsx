import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Player, Position } from '@/types/player';
import InLeague from '@/components/InLeague';
import HowToStrip from './HowToStrip';
import { awardPack } from '@/utils/collection';
import { compFeatures, type CompFeature } from '@/config/advanced';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import GameBanner from './GameBanner';
import { ArcadeButton, Confetti, CountUp, Lamp } from './ArcadeUI';
import { MYSTERY_STYLE, POSITION_NAMES, loadGameStat, playerKey, saveGameStat, shuffle, teamStyle, teamVars, type GamePlayer, type TeamStyle } from './gameUtils';
import { bannerTeamOf } from '@/utils/playerExtras';
import { getTeamTextColor } from '@/utils/teamColors';
import { useJerseyNumbers } from '@/utils/jerseys';
import './buildALegend.css';
import {
  BUILD_POSITIONS,
  CLONE_THRESHOLD,
  MIN_SPIN_POOL,
  fmtFeature,
  gradeFor,
  hofVerdict,
  overallFor,
  positionBaseline,
  matchSlots,
  skillPct,
  scoreBuild,
  clubAlternatives,
  clubOf,
  spinClub,
  spinInClub,
  spinPool,
  traitName,
  verdictFor,
  type BuildResult,
  type Overall,
  type Slot,
} from './buildLegendLogic';

const BEST_KEY = 'build:best';
const CLONES_KEY = 'build:clones';
const POS_KEY = 'build:pos';
const LIVE_AFTER = 3;

/** Validated two-series pair on the arcade panel (dataviz validate_palette.js, dark, #141b30): build vs match. */
const C_BUILD = '#bf8516';
const C_MATCH = '#2f86d6';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ordinal = (n: number) => {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n);
  const s = r % 100 >= 11 && r % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][r % 10] ?? 'th');
  return `${r}${s}`;
};

const PLURAL: Record<Position, string> = {
  QB: 'quarterbacks',
  RB: 'running backs',
  WR: 'wide receivers',
  TE: 'tight ends',
  OL: 'offensive linemen',
  LB: 'linebackers',
  DB: 'defensive backs',
  DL: 'defensive linemen',
};
const plural = (pos: Position) => PLURAL[pos];

// ---------- Reveal chart: paired dots on a percentile scale ----------

const StyleChart = ({ result, baseline }: { result: BuildResult; baseline: Map<string, number[]> }) => {
  const [active, setActive] = useState<number | null>(null);
  const top = result.matches[0];
  const pos = result.position;
  const rows = result.features.map((f, i) => {
    const sorted = baseline.get(f.id) ?? [];
    const mine = result.vector[i];
    const his = f.get(top.player);
    return { f, name: traitName(pos, f), mine, his, pMine: skillPct(f, sorted, mine), pHis: skillPct(f, sorted, his), from: result.picks[i] };
  });
  const tipFor = (r: (typeof rows)[number]) =>
    `${r.name} (${r.f.label}): your build ${fmtFeature(r.f, r.mine)} (${ordinal(r.pMine)} pct) · ${top.player.name} ${fmtFeature(r.f, r.his)} (${ordinal(r.pHis)} pct)`;

  return (
    <div className="bal-panel">
      <h4>Your build vs {top.player.name}</h4>
      <p className="arc-hint" style={{ margin: 0 }}>
        Percentile among league {plural(pos)} with 8+ games (flipped for INT% and fumbles, so right is always better). Hover or focus a row for values.
      </p>
      <div className="bal-legend" aria-hidden="true">
        <span>
          <i style={{ background: C_BUILD }} />
          Your build
        </span>
        <span>
          <i style={{ background: C_MATCH }} />
          {top.player.name}
        </span>
      </div>
      <ul className="bal-chart" aria-label={`Percentile comparison of your build and ${top.player.name}`} onMouseLeave={() => setActive(null)}>
        {rows.map((r, i) => {
          const a = Number.isFinite(r.pMine) ? r.pMine : 50;
          const b = Number.isFinite(r.pHis) ? r.pHis : null;
          return (
            <li
              key={r.f.id}
              className={cn('bal-row', active === i && 'on')}
              tabIndex={0}
              aria-label={tipFor(r)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className="bal-row-k" aria-hidden="true">
                {r.name}
              </span>
              <div className="bal-track" aria-hidden="true">
                <span className="mid" />
                {b != null && <span className="lnk" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />}
                {b != null && <span className="bal-dot" style={{ left: `${b}%`, background: C_MATCH }} />}
                <span className="bal-dot" style={{ left: `${a}%`, background: C_BUILD }} />
              </div>
              <div className="bal-row-v" aria-hidden="true">
                <span>
                  You <b>{fmtFeature(r.f, r.mine)}</b>
                </span>
                <span>
                  Him <b>{fmtFeature(r.f, r.his)}</b>
                </span>
              </div>
              {active === i && (
                <span className="bal-tip" aria-hidden="true">
                  {tipFor(r)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="bal-axis" aria-hidden="true">
        <span />
        <div>
          <span>0</span>
          <span>50th</span>
          <span>100th pct</span>
        </div>
      </div>
      <details className="bal-details">
        <summary>Show as table</summary>
        <table className="bal-table">
          <caption className="sr-only">Your build compared with {top.player.name}</caption>
          <thead>
            <tr>
              <th scope="col">Trait</th>
              <th scope="col">You</th>
              <th scope="col">{top.player.name.split(' ').slice(-1)[0]}</th>
              <th scope="col">Taken from</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f.id}>
                <th scope="row" style={{ fontWeight: 600 }}>
                  {r.name} <span className="muted">({r.f.label})</span>
                </th>
                <td>{fmtFeature(r.f, r.mine)}</td>
                <td>{fmtFeature(r.f, r.his)}</td>
                <td>{r.from?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};

// ---------- Grades ----------

const GradeChip = ({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' | 'lg' }) => {
  const g = gradeFor(pct);
  return (
    <span className={cn('bal-grade', `bal-grade--${size}`, g?.grade === 'S' && 'bal-grade--s')} style={{ background: g?.color ?? '#3a466e' }}>
      {g?.grade ?? '—'}
    </span>
  );
};

/** Number that ticks from its previous value to the new one (instant with reduced motion). */
const TickNumber = ({ value }: { value: number }) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reducedMotion() || start === value) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 600);
      setShown(Math.round(start + (value - start) * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
};


const surname = (p: Player) => p.name.split(' ').slice(-1)[0];
/** A player's club colours (his best-known club), or the sealed purple in Mystery mode. */
const SEALED_STYLE: TeamStyle = { ...MYSTERY_STYLE, c1: '#5b3d8f', c2: '#e0a3ff', text: '#ffffff' };
const styleOf = (p: Player | null | undefined, sealed = false): TeamStyle => (p && !sealed ? teamStyle(bannerTeamOf(p)) : SEALED_STYLE);
/** His club colour lifted until it reads as text on the dark arcade panels. */
const inkOf = (p: Player | null | undefined, sealed = false) => (p && !sealed ? getTeamTextColor(bannerTeamOf(p)) ?? 'var(--chalk)' : '#e0a3ff');

/** A grey, locked grade chip for Mystery mode. */
const SealedChip = ({ size = 'md' }: { size?: 'md' | 'lg' }) => (
  <span className={cn('bal-grade', `bal-grade--${size}`, 'bal-grade--sealed')} aria-hidden="true">
    ?
  </span>
);

// ---------- Overall medallion ----------

const OvrMedallion = ({ overall, sealed = false }: { overall: Overall | null; sealed?: boolean }) => {
  if (sealed)
    return (
      <div className="bal-ovr sealed" role="img" aria-label="Build overall sealed until the reveal">
        <span className="n">
          ??
          <small>OVR</small>
        </span>
        <SealedChip />
      </div>
    );
  const g = overall?.grade;
  return (
    <div
      className="bal-ovr bump"
      key={overall?.rating ?? 'none'}
      style={{ '--g': g?.color ?? '#3a466e' } as CSSProperties}
      role="img"
      aria-label={overall ? `Build overall ${overall.rating}, grade ${g?.grade}` : 'Build overall not rated yet'}
    >
      <span className="n" style={{ color: g?.color ?? 'var(--muted)' }}>
        {overall ? <TickNumber value={overall.rating} /> : '--'}
        <small>OVR</small>
      </span>
      {overall ? <GradeChip pct={overall.pct} size="md" /> : <span className="bal-grade bal-grade--md" style={{ background: '#3a466e' }}>?</span>}
    </div>
  );
};

// ---------- Board: the creation, slot by slot ----------

type BoardMode = 'preview' | 'draft' | 'final';

interface TileProps {
  i: number;
  f: CompFeature;
  pos: Position;
  slot: Slot | null;
  baseline: Map<string, number[]>;
  /** Player on the payline (draft only) */
  landed: Player | null;
  mystery: boolean;
  /** Mystery: values, grades and percentiles stay sealed during the draft and unseal on the result */
  sealValues: boolean;
  fresh: boolean;
  mode: BoardMode;
  onSteal: (i: number) => void;
}

const SlotTile = ({ i, f, pos, slot, baseline, landed, mystery, sealValues, fresh, mode, onSteal }: TileProps) => {
  const sorted = baseline.get(f.id) ?? [];
  const name = traitName(pos, f);
  const vars = { '--i': i } as CSSProperties;

  if (slot && sealValues) {
    const st = styleOf(slot.player);
    return (
      <button
        type="button"
        className={cn('bal-tile filled sealed', fresh && 'slam', landed && 'dim')}
        style={{ ...vars, ...teamVars(st) }}
        disabled
        aria-label={`${name}: locked from ${slot.player.name}. Value sealed until the reveal.`}
      >
        <span className="bal-tile-top">
          <span className="key">{i + 1}</span>
          <span className="nm">{name}</span>
        </span>
        <span className="bal-tile-mid">
          <SealedChip />
          <span className="val">
            <b>Sealed</b>
            <span>{f.label}</span>
          </span>
        </span>
        <span className="bal-tile-foot">
          <span className="from" style={{ color: inkOf(slot.player) }}>
            {surname(slot.player)}
          </span>
        </span>
      </button>
    );
  }

  if (slot) {
    const pct = skillPct(f, sorted, slot.value);
    const g = gradeFor(pct);
    const st = styleOf(slot.player);
    const his = landed ? f.get(landed) : NaN;
    const hisPct = skillPct(f, sorted, his);
    const donor = slot.player.name;
    const label = `${name}: locked ${fmtFeature(f, slot.value)}, grade ${g?.grade ?? 'none'}, ${ordinal(pct)} percentile, from ${donor}.${
      landed && Number.isFinite(his) ? ` He has ${fmtFeature(f, his)}, grade ${gradeFor(hisPct)?.grade}.` : ''
    }`;
    const body = (
      <>
        <span className="bal-tile-top">
          <span className="key">{i + 1}</span>
          <span className="nm">{name}</span>
        </span>
        <span className="bal-tile-mid">
          <GradeChip pct={pct} size="md" />
          <span className="val">
            <b>{fmtFeature(f, slot.value)}</b>
            <span>
              {f.label} · {ordinal(pct)}
            </span>
          </span>
        </span>
        <span className="bal-tile-foot">
          <span className="from" style={{ color: inkOf(slot.player) }}>
            {surname(slot.player)}
          </span>
          {landed && Number.isFinite(his) && (
            <span className="his">
              His <GradeChip pct={hisPct} size="sm" />
            </span>
          )}
        </span>
        <span className="bal-meter" aria-hidden="true">
          <b style={{ width: `${Math.max(3, pct)}%`, background: g?.color }} />
        </span>
      </>
    );
    const cls = cn('bal-tile filled', fresh && 'slam', mode === 'final' && 'final', landed && 'dim');
    return mode === 'draft' ? (
      <button type="button" className={cls} style={{ ...vars, ...teamVars(st) }} disabled aria-label={label}>
        {body}
      </button>
    ) : (
      <div className={cls} style={{ ...vars, ...teamVars(st) }} role="group" aria-label={label}>
        {body}
      </div>
    );
  }

  if (mode === 'draft' && landed) {
    const v = f.get(landed);
    const ok = Number.isFinite(v);
    const pct = skillPct(f, sorted, v);
    const g = gradeFor(pct);
    const st = styleOf(landed);
    if (mystery) {
      return (
        <button
          type="button"
          className={cn('bal-tile', ok ? 'steal blind' : 'nodata')}
          style={{ ...vars, ...teamVars(st) }}
          disabled={!ok}
          onClick={() => onSteal(i)}
          title={`${f.label}: ${f.definition}`}
          aria-label={ok ? `${i + 1}: steal ${name} (${f.label}), value sealed until the reveal. ${f.definition}` : `${i + 1}: ${name}, no data for this player`}
        >
          <span className="bal-tile-top">
            <span className="key">{i + 1}</span>
            <span className="nm">{name}</span>
          </span>
          <span className="bal-tile-mid">
            {ok ? <SealedChip size="lg" /> : <span className="q">--</span>}
            <span className="val">
              <b>{ok ? 'Sealed' : 'No data'}</b>
              <span>{f.label}</span>
            </span>
          </span>
          <span className="bal-meter sealed" aria-hidden="true" />
        </button>
      );
    }
    return (
      <button
        type="button"
        className={cn('bal-tile', ok ? 'steal' : 'nodata')}
        style={{ ...vars, ...teamVars(st) }}
        disabled={!ok}
        onClick={() => onSteal(i)}
        title={`${f.label}: ${f.definition}${f.lowerIsBetter ? ' (lower is better)' : ''}`}
        aria-label={
          ok
            ? `${i + 1}: steal ${name}, grade ${g?.grade}: ${f.label} ${fmtFeature(f, v)}, ${ordinal(pct)} percentile. ${f.definition}`
            : `${i + 1}: ${name}, no data for this player`
        }
      >
        <span className="bal-tile-top">
          <span className="key">{i + 1}</span>
          <span className="nm">{name}</span>
        </span>
        <span className="bal-tile-mid">
          {ok ? <GradeChip pct={pct} size="lg" /> : <span className="q">--</span>}
          <span className="val">
            <b>{ok ? fmtFeature(f, v) : 'No data'}</b>
            <span>
              {f.label}
              {ok ? ` · ${ordinal(pct)}` : ''}
            </span>
          </span>
        </span>
        <span className="bal-meter" aria-hidden="true">
          {ok && <b style={{ width: `${Math.max(3, pct)}%`, background: g?.color }} />}
        </span>
      </button>
    );
  }

  return (
    <div className="bal-tile empty" style={vars} title={`${f.label}: ${f.definition}`} role="group" aria-label={`${name} (${f.label}): open slot. ${f.definition}`}>
      <span className="bal-tile-top">
        <span className="key">{i + 1}</span>
        <span className="nm">{name}</span>
      </span>
      <span className="bal-tile-mid">
        <span className="q">?</span>
        <span className="val">
          <span>{f.label}</span>
        </span>
      </span>
    </div>
  );
};

// ---------- Slot cabinet: a club reel, a player reel and a lever ----------

const STRIP_LEN = 26;
const CLUB_LEN = 18;
const CLUB_MS = 1500;
const PLAYER_MS = 2500;
const TEAM_MS = 1700;
const FADE_MS = 220;

const fillFrom = <T,>(src: T[], n: number): T[] => {
  const out: T[] = [];
  while (out.length < n && src.length) out.push(...shuffle(src));
  return out.slice(0, n);
};

interface SpinState {
  /** Increments every spin, so a re-armed timer never lands an old spin twice */
  id: number;
  target: Player;
  club: string;
  /** Clubs that roll past the payline; the last one is the club landed on */
  clubStrip: string[];
  /** Players that roll past the payline; the last one is the target */
  strip: Player[];
  /** Team respin: the club reel holds, only the player reel rolls */
  teamOnly: boolean;
  clubMs: number;
  playerMs: number;
  endAt: number;
  landed: boolean;
  /** A trait was locked from this player: the reels rest, waiting for the next spin */
  done: boolean;
}

const ClubCell = ({ club }: { club: string }) => {
  const t = findNFLTeam(club);
  const st = teamStyle(club);
  return (
    <div className="bal-clubcell" style={teamVars(st)}>
      {t ? <img src={t.logoUrl} alt="" loading="lazy" /> : <b>FA</b>}
      <span>{st.abbr}</span>
    </div>
  );
};

const NameCell = ({ p }: { p: Player }) => (
  <div className="bal-namecell" style={teamVars(styleOf(p))}>
    <span>{p.name}</span>
  </div>
);

/** The side lever: click it, press Enter, or drag the knob down past halfway. */
const Lever = ({ disabled, onPull, pullKey }: { disabled: boolean; onPull: () => void; pullKey: number }) => {
  const [drag, setDrag] = useState<number | null>(null);
  const startY = useRef(0);
  const moved = useRef(false);
  const TRAVEL = 110;
  return (
    <button
      type="button"
      className={cn('bal-lever', drag != null && 'dragging')}
      disabled={disabled}
      style={{ '--pull': drag ?? 0 } as CSSProperties}
      aria-label="Pull the lever to spin"
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        startY.current = e.clientY;
        moved.current = false;
        setDrag(0);
      }}
      onPointerMove={(e) => {
        if (drag == null) return;
        const d = Math.max(0, Math.min(1, (e.clientY - startY.current) / TRAVEL));
        if (d > 0.06) moved.current = true;
        setDrag(d);
      }}
      onPointerUp={() => {
        if (drag == null) return;
        const d = drag;
        setDrag(null);
        if (!moved.current || d > 0.5) onPull();
      }}
      onPointerCancel={() => setDrag(null)}
      onClick={(e) => {
        // Keyboard activation (pointer pulls are handled above)
        if (e.detail === 0) onPull();
      }}
    >
      <span className="bal-lever-slot" aria-hidden="true" />
      <span className={cn('bal-lever-arm', pullKey > 0 && drag == null && 'yank')} key={pullKey} aria-hidden="true">
        <i className="rod" />
        <i className="knob" />
      </span>
    </button>
  );
};

const Cabinet = ({
  spinState,
  spinning,
  pos,
  canPull,
  onPull,
  deck,
}: {
  spinState: SpinState | null;
  spinning: boolean;
  pos: Position;
  canPull: boolean;
  onPull: () => void;
  deck: React.ReactNode;
}) => {
  const { numberFor } = useJerseyNumbers();
  const landed = !!spinState?.landed && !spinState.done;
  const target = spinState?.target ?? null;
  const st = styleOf(target);
  const logo = target ? findNFLTeam(bannerTeamOf(target))?.logoUrl : null;
  const clubStrip = spinState?.clubStrip ?? [];
  const strip = spinState?.strip ?? [];
  const sign = spinning ? (spinState?.teamOnly ? 'Same club, new player' : 'Spinning') : landed ? 'Steal a trait' : 'Pull to play';
  const end = (n: number) => `calc(var(--row) * -${Math.max(0, n - 1)})`;
  return (
    <div className={cn('bal-cab', spinning && 'spinning', landed && 'landed')}>
      <span className="bal-bulbs" aria-hidden="true" />
      <div className="bal-sign" aria-hidden="true">
        <span>Build-a-Legend</span>
        <b key={sign}>{sign}</b>
      </div>
      <div className="bal-reels" aria-hidden="true">
        <div
          key={`c${spinState?.id ?? 0}`}
          className={cn('bal-reel club', spinState && !spinState.teamOnly && 'spun')}
          style={{ '--dur': `${spinState?.clubMs ?? 0}ms` } as CSSProperties}
        >
          <div className={cn('bal-strip', spinState && !spinState.teamOnly && 'go')} style={{ '--end': end(clubStrip.length) } as CSSProperties}>
            {clubStrip.length ? clubStrip.map((c, i) => <ClubCell key={i} club={c} />) : <div className="bal-clubcell idle">?</div>}
          </div>
          <span className="bal-reel-tag">Club</span>
        </div>
        <div key={`p${spinState?.id ?? 0}`} className={cn('bal-reel player', spinState && 'spun')} style={{ '--dur': `${spinState?.playerMs ?? 0}ms` } as CSSProperties}>
          <div className={cn('bal-strip', spinState && 'go')} style={{ '--end': end(strip.length) } as CSSProperties}>
            {strip.length ? strip.map((p, i) => <NameCell key={i} p={p} />) : <div className="bal-namecell idle">Insert coin</div>}
          </div>
          {landed && target && (
            <div className="bal-plate" style={teamVars(st)}>
              {logo && <img src={logo} alt="" />}
              <span className="nm">
                <span>
                  {pos} · {st.abbr} <InLeague player={target} />
                </span>
                <b>{target.name}</b>
              </span>
              <span className="num">#{numberFor(target)}</span>
            </div>
          )}
          <span className="bal-reel-tag">Player</span>
        </div>
        <span className="bal-payline" />
      </div>
      <Lever disabled={!canPull} onPull={onPull} pullKey={spinState?.id ?? 0} />
      <div className="bal-deck">{deck}</div>
    </div>
  );
};

// ---------- Similarity gauge ----------

const GAUGE_R = 56;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

const Gauge = ({ value }: { value: number }) => {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    const t = window.setTimeout(() => setShown(value), 60);
    return () => window.clearTimeout(t);
  }, [value]);
  return (
    <div className="bal-gauge" aria-hidden="true">
      <svg viewBox="0 0 132 132">
        <circle className="track" cx="66" cy="66" r={GAUGE_R} />
        <circle className="bar" cx="66" cy="66" r={GAUGE_R} strokeDasharray={GAUGE_C} strokeDashoffset={GAUGE_C * (1 - Math.max(0, Math.min(100, shown)) / 100)} />
      </svg>
      <div className="in">
        <b>
          <CountUp value={Math.round(value)} duration={1000} />%
        </b>
        <span>similar</span>
      </div>
    </div>
  );
};

// ---------- Game ----------

const BuildALegend = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const available = useMemo(() => BUILD_POSITIONS.filter((p) => spinPool(players, p).length >= MIN_SPIN_POOL), [players]);
  const [position, setPosition] = useState<Position>(() => BUILD_POSITIONS[loadGameStat(POS_KEY, 0)] ?? 'QB');
  const pos = available.includes(position) ? position : available[0];
  const features = useMemo(() => (pos ? compFeatures(pos) : []), [pos]);
  const pool = useMemo(() => (pos ? spinPool(players, pos) : []), [players, pos]);

  const [mystery, setMystery] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'draft' | 'reveal'>('setup');
  const [game, setGame] = useState(0);
  const [slots, setSlots] = useState<(Slot | null)[]>([]);
  const [spinState, setSpinState] = useState<SpinState | null>(null);
  const [teamLeft, setTeamLeft] = useState(true);
  const [anyLeft, setAnyLeft] = useState(true);
  const [lastLocked, setLastLocked] = useState<number | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState<BuildResult | null>(null);
  const [stage, setStage] = useState(3);
  const [scanName, setScanName] = useState('');
  const [best, setBest] = useState(() => loadGameStat(BEST_KEY, -1));
  const [clones, setClones] = useState(() => loadGameStat(CLONES_KEY, 0));
  const [confetti, setConfetti] = useState<number | false>(false);
  const [newBest, setNewBest] = useState(false);
  const seen = useRef(new Set<Player>());
  const spinSeq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const hubRef = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLOListElement>(null);

  const current = spinState?.landed && !spinState.done ? spinState.target : null;
  const spinning = !!spinState && !spinState.landed;

  const baseline = useMemo(() => (pos ? positionBaseline(players, pos) : new Map<string, number[]>()), [players, pos]);

  const filled = slots.filter(Boolean).length;
  const overall = useMemo(() => (pos ? overallFor(features, baseline, slots.map((s) => (s ? s.value : null)), pos) : null), [features, baseline, slots, pos]);
  const live = useMemo(
    () => (pos && showLive && filled >= LIVE_AFTER ? (matchSlots(players, pos, slots, 1)[0] ?? null) : null),
    [players, pos, slots, showLive, filled],
  );

  const toTop = () =>
    window.setTimeout(() => rootRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }), 30);

  const finish = useCallback(
    (all: (Slot | null)[]) => {
      if (!pos) return;
      const r = scoreBuild(players, pos, all);
      const sim = r.matches[0]?.similarity ?? 0;
      const rounded = Math.round(sim * 10) / 10;
      setNewBest(rounded > best);
      if (rounded > best) {
        setBest(rounded);
        saveGameStat(BEST_KEY, rounded);
      }
      if (Math.round(sim) >= CLONE_THRESHOLD) {
        const c = clones + 1;
        setClones(c);
        saveGameStat(CLONES_KEY, c);
        awardPack('premium', `Build-a-Legend perfect clone, ${Math.round(sim)}%`, { once: r });
      } else if (Math.round(sim) >= 85) {
        awardPack('standard', `Build-a-Legend, ${Math.round(sim)}% match`, { once: r });
      }
      setSpinState(null);
      setResult(r);
      setStage(reducedMotion() ? 3 : 0);
      setPhase('reveal');
      toTop();
    },
    [players, pos, best, clones],
  );

  /**
   * Starts a spin. The landing is driven by state (spinState.endAt) and an effect-owned timer, never by
   * transitionend or a fire-and-forget timeout, so a re-render, an effect re-run or a skipped animation
   * can't strand the game between "spinning" and "landed".
   */
  const doSpin = useCallback(
    (open: (Slot | null)[], teamOnly = false) => {
      if (!pos || spinning) return;
      let club: string;
      let target: Player | null;
      if (teamOnly) {
        if (!spinState) return;
        club = spinState.club;
        target = spinInClub(pool, pos, open, seen.current, club, spinState.target);
        if (!target) return;
      } else {
        let r = spinClub(pool, pos, open, seen.current);
        if (!r) {
          // Everyone has come up: start the rotation over before giving up
          seen.current = new Set();
          r = spinClub(pool, pos, open, seen.current);
        }
        if (!r) {
          // No league player has data for any open slot: reveal with what we have rather than stall
          setAnnounce('No player left has data for your open slots. Revealing your build.');
          finish(open);
          return;
        }
        club = r.club;
        target = r.player;
      }
      seen.current.add(target);
      const landOn = target;
      const rm = reducedMotion();
      const clubMs = teamOnly || rm ? 0 : CLUB_MS;
      const playerMs = rm ? 0 : teamOnly ? TEAM_MS : PLAYER_MS;
      setSpinState((prev) => {
        // Clubs and names roll past the payline (starting from the last landing) and stop on the target
        const clubs = [...new Set(pool.map(clubOf))];
        const clubStrip = teamOnly ? [club] : [prev?.club ?? clubs[0], ...fillFrom(clubs, CLUB_LEN - 2), club];
        const filler = fillFrom(teamOnly ? pool.filter((p) => clubOf(p) === club) : pool, STRIP_LEN - 2);
        const strip = [prev?.target ?? filler[0] ?? landOn, ...filler, landOn];
        return {
          id: ++spinSeq.current,
          target: landOn,
          club,
          clubStrip,
          strip,
          teamOnly,
          clubMs,
          playerMs,
          endAt: Date.now() + (rm ? FADE_MS : playerMs),
          landed: false,
          done: false,
        };
      });
      setLastLocked(null);
      setAnnounce(teamOnly ? 'Team respin: same club, new player' : 'Spinning');
    },
    [pos, pool, spinning, spinState, finish],
  );

  // Land the spin when its time is up (re-armed on every render pass, so it can't be lost)
  useEffect(() => {
    if (!spinState || spinState.landed) return;
    const id = spinState.id;
    const t = window.setTimeout(
      () => {
        setSpinState((s) => (s && s.id === id ? { ...s, landed: true } : s));
      },
      Math.max(0, spinState.endAt - Date.now()),
    );
    return () => window.clearTimeout(t);
  }, [spinState]);

  // On landing: announce, and move focus to the first slot he can fill
  const landedId = spinState?.landed && !spinState.done ? spinState.id : null;
  useEffect(() => {
    if (landedId == null || !current) return;
    setAnnounce(
      `The reels landed on the ${teamStyle(clubOf(current)).abbr}: ${current.name}. Pick a lit slot to steal his trait${mystery ? '; his numbers stay sealed until the reveal' : ''}.`,
    );
    const t = window.setTimeout(() => {
      boardRef.current?.querySelector<HTMLButtonElement>('button.steal')?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landedId]);

  const start = useCallback(() => {
    if (!pos) return;
    saveGameStat(POS_KEY, BUILD_POSITIONS.indexOf(pos));
    seen.current = new Set();
    setSlots(features.map(() => null));
    setSpinState(null);
    setTeamLeft(true);
    setAnyLeft(true);
    setLastLocked(null);
    setResult(null);
    setShowLive(false);
    setGame((g) => g + 1);
    setPhase('draft');
    setAnnounce('');
    toTop();
  }, [pos, features]);

  const lock = useCallback(
    (i: number) => {
      if (!current || slots[i] || !Number.isFinite(features[i].get(current))) return;
      const next = slots.map((s, j) => (j === i ? { player: current, value: features[i].get(current) } : s));
      setAnnounce(
        mystery
          ? `Locked ${traitName(current.position, features[i])} from ${current.name}. Value sealed.`
          : `Locked ${traitName(current.position, features[i])}: ${fmtFeature(features[i], features[i].get(current))}.`,
      );
      setSlots(next);
      setLastLocked(i);
      setSpinState((s) => (s ? { ...s, done: true } : s));
      if (next.every(Boolean)) window.setTimeout(() => finish(next), reducedMotion() ? 0 : 650);
      else window.setTimeout(() => hubRef.current?.focus({ preventScroll: true }), 0);
    },
    [current, slots, features, finish, mystery],
  );

  const alts = useMemo(
    () => (pos && current && spinState ? clubAlternatives(pool, pos, slots, spinState.club, current) : []),
    [pool, pos, slots, current, spinState],
  );
  const teamRespin = () => {
    if (!current || !teamLeft || !alts.length) return;
    setTeamLeft(false);
    doSpin(slots, true);
  };
  const respin = () => {
    if (!current || !anyLeft) return;
    setAnyLeft(false);
    doSpin(slots);
  };

  // Space spins (when nothing is landed and focus isn't on a control that handles Space itself)
  const canSpinNow = phase === 'draft' && !current && !spinning;
  useEffect(() => {
    if (!canSpinNow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(el.tagName))) return;
      e.preventDefault();
      doSpin(slots);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSpinNow, doSpin, slots]);

  // Focus the hub / reveal heading on screen changes (keyboard + screen reader users)
  useEffect(() => {
    if (phase === 'draft') hubRef.current?.focus({ preventScroll: true });
  }, [phase, game]);
  const revealStep = phase === 'reveal' ? (stage >= 2 ? 2 : 0) : -1;
  useEffect(() => {
    if (revealStep >= 0) headRef.current?.focus({ preventScroll: true });
    if (revealStep === 2) toTop();
  }, [revealStep]);

  // 1–N lock a trait of the landed player
  useEffect(() => {
    if (phase !== 'draft' || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < features.length) {
        e.preventDefault();
        lock(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, current, features, lock]);

  // Reveal sequence: scan the league → "plays like…" → the match → the breakdown
  useEffect(() => {
    if (phase !== 'reveal' || !result || stage >= 3) return;
    const t = window.setTimeout(() => setStage((s) => s + 1), stage === 0 ? 1500 : stage === 1 ? 700 : 1500);
    let iv = 0;
    if (stage === 0) {
      const ms = result.matches;
      iv = window.setInterval(() => setScanName(ms[Math.floor(Math.random() * ms.length)]?.player.name ?? ''), 70);
    }
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, [phase, result, stage]);

  useEffect(() => {
    if (phase === 'reveal' && stage >= 2 && result && Math.round(result.matches[0]?.similarity ?? 0) >= CLONE_THRESHOLD) setConfetti(Date.now());
  }, [phase, stage, result]);

  if (!pos) return <p className="arc-empty">Not enough league players at any position to build a legend yet.</p>;

  const posName = POSITION_NAMES[pos].toLowerCase();

  const hud = (
    <div className={cn('bal-hud', phase === 'draft' && 'bal-hud--draft')} role="group" aria-label="Scoreboard">
      <Lamp label={pos} />
      <Lamp label="Best" value={best >= 0 ? `${Math.round(best)}%` : '--'} />
      <span className="lamp opt">
        Clones <b className="num">{clones}</b>
      </span>
      {mystery && <Lamp label="Mystery" />}
    </div>
  );

  const howTo = (
    <HowToStrip
      id="build"
      accent="var(--gold)"
      closeLabel="Got it"
      keys="Space or the lever spins · 1 to 8 steals a trait"
      steps={[
        <>
          <b>Spin.</b> Reel one lands a club, reel two one of its {plural(pos)}. You get one team respin (same club) and one full respin a game.
        </>,
        <>
          <b>Steal.</b> Tap a lit slot to lock that trait of his. Locked slots stay locked.{mystery ? ' In Mystery his numbers stay sealed until the end.' : ''}
        </>,
        <>
          <b>Match.</b> Fill all {features.length} and see who he plays like. Hit {CLONE_THRESHOLD}% for a perfect clone.
        </>,
      ]}
    />
  );

  const board = (mode: BoardMode, rows: (Slot | null)[], ov: Overall | null, title: string, kicker: string, foot?: React.ReactNode) => (
    <section className="bal-board" aria-label={title}>
      <div className="bal-board-head">
        <div className="bal-board-title">
          <div className="k">{kicker}</div>
          <h3>{title}</h3>
          <div className="bal-pips" aria-hidden="true">
            {features.map((f, i) => (
              <i key={f.id} className={cn(rows[i] && 'on')} />
            ))}
          </div>
        </div>
        <OvrMedallion overall={ov} sealed={mode === 'draft' && mystery} />
      </div>
      <ol className="bal-slots" ref={mode === 'draft' ? boardRef : undefined}>
        {features.map((f, i) => (
          <li key={f.id}>
            <SlotTile
              i={i}
              f={f}
              pos={pos}
              slot={rows[i] ?? null}
              baseline={baseline}
              landed={mode === 'draft' ? current : null}
              mystery={mystery}
              sealValues={mode === 'draft' && mystery}
              fresh={mode === 'draft' && lastLocked === i}
              mode={mode}
              onSteal={lock}
            />
          </li>
        ))}
      </ol>
      {foot}
    </section>
  );

  // ---------- Setup ----------
  if (phase === 'setup') {
    return (
      <div className="bal" ref={rootRef}>
        {hud}
        {howTo}
        <div className="bal-setup">
          <div className="bal-hero">
            <div className="k">Build-a-Legend</div>
            <h3>
              Spin. Steal. <span>Match.</span>
            </h3>
            <p>Build a {posName} from traits stolen off real league players, then find out who he plays like.</p>
          </div>

          <div className="bal-pick">
            <div className="k">Position</div>
            <div className="bal-positions" role="group" aria-label="Position">
              {BUILD_POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="bal-pos"
                  aria-pressed={p === pos}
                  disabled={!available.includes(p)}
                  onClick={() => setPosition(p)}
                  aria-label={`${POSITION_NAMES[p]}${available.includes(p) ? '' : ', not enough players'}`}
                >
                  <b>{p}</b>
                  <span>{spinPool(players, p).length} players</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bal-pick">
            <div className="k">Difficulty</div>
            <div className="bal-modes" role="group" aria-label="Difficulty">
              <button type="button" className="bal-mode" aria-pressed={!mystery} onClick={() => setMystery(false)}>
                <b>Scout</b>
                <span>Every number shown</span>
              </button>
              <button type="button" className="bal-mode" aria-pressed={mystery} onClick={() => setMystery(true)}>
                <b>Mystery</b>
                <span>Names shown, numbers sealed until the end</span>
              </button>
            </div>
          </div>

          {board('preview', features.map(() => null), null, `Your ${posName}`, `${features.length} slots to fill`)}

          <div className="bal-start">
            <ArcadeButton tone="go" onClick={start} data-bal="start">
              Start building
            </ArcadeButton>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spin & steal ----------
  if (phase === 'draft') {
    const canSpin = !current && !spinning;
    const lastSlot = lastLocked != null ? slots[lastLocked] : null;
    const clubAbbr = spinState ? teamStyle(spinState.club).abbr : '';
    const respinHint = current
      ? [teamLeft && alts.length > 0 && 'Team respin keeps the club', anyLeft && 'Respin rerolls both reels'].filter(Boolean).join('. ')
      : '';
    const coach = spinning ? (
      <>
        <span className="step">Spin</span>
        <span>{spinState?.teamOnly ? `Same club, new ${posName}...` : `Club reel first, then the ${posName}...`}</span>
      </>
    ) : current ? (
      <>
        <span className="step">Steal</span>
        <span>
          Tap a lit slot to take one trait from <b style={{ color: inkOf(current) }}>{current.name}</b>.
          {mystery ? ' His numbers stay sealed until the end.' : ''}
          {respinHint ? <span className="wide"> {respinHint}.</span> : null}
        </span>
      </>
    ) : lastSlot && lastLocked != null ? (
      <>
        <span className="step">Spin</span>
        <span>
          {traitName(pos, features[lastLocked])} locked from <b style={{ color: inkOf(lastSlot.player) }}>{surname(lastSlot.player)}</b>. Spin for trait {filled + 1} of{' '}
          {features.length}.
        </span>
      </>
    ) : (
      <>
        <span className="step">Spin</span>
        <span>
          Hit <b>Spin</b> or pull the lever. Reel one lands a club, reel two one of its {plural(pos)}.
        </span>
      </>
    );

    const teamWhy = !teamLeft ? 'Used' : !current ? 'Same club' : alts.length ? 'Same club' : `No other ${pos}`;
    const deck = (
      <>
        <button
          ref={hubRef}
          type="button"
          className={cn('bal-btn spin', canSpin && 'ready')}
          data-bal="spin"
          onClick={() => doSpin(slots)}
          disabled={!canSpin}
          aria-label={spinning ? 'Spinning' : current ? 'Pick a trait first' : `Spin the reels for a ${posName} (trait ${filled + 1} of ${features.length})`}
        >
          <span>{spinning ? 'Rolling' : 'Spin'}</span>
          <small>{current ? 'Pick a trait' : `Trait ${Math.min(filled + 1, features.length)}/${features.length}`}</small>
        </button>
        <button
          type="button"
          className="bal-btn respin team"
          data-bal="team-respin"
          onClick={teamRespin}
          disabled={!current || !teamLeft || !alts.length}
          aria-label={
            !teamLeft
              ? 'Team respin used'
              : current && !alts.length
                ? `Team respin unavailable: no other ${posName} on the ${clubAbbr} has data for your open slots`
                : `Team respin: keep the ${clubAbbr || 'club'}, reroll the player (1 left)`
          }
          title={current && teamLeft && !alts.length ? `No other ${posName} on the ${clubAbbr} has data for your open slots` : undefined}
        >
          <span>Team respin</span>
          <small>{teamWhy}</small>
        </button>
        <button
          type="button"
          className="bal-btn respin"
          data-bal="respin"
          onClick={respin}
          disabled={!current || !anyLeft}
          aria-label={anyLeft ? 'Respin: reroll both reels (1 left)' : 'Respin used'}
        >
          <span>Respin</span>
          <small>{anyLeft ? 'New club' : 'Used'}</small>
        </button>
      </>
    );

    const foot = (
      <div className="bal-board-foot">
        <span className="bal-peek" aria-live="polite">
          {live ? (
            <>
              Plays like <b style={{ color: inkOf(live.player) }}>{live.player.name}</b> · {Math.round(live.similarity)}%
            </>
          ) : mystery ? (
            'Live match sealed in Mystery'
          ) : filled < LIVE_AFTER ? (
            `Live match unlocks at ${LIVE_AFTER} traits`
          ) : (
            'Live match hidden'
          )}
        </span>
        <button
          type="button"
          className="bal-link"
          aria-pressed={showLive}
          disabled={mystery || filled < LIVE_AFTER}
          onClick={() => setShowLive((v) => !v)}
        >
          {showLive ? 'Hide match' : 'Peek match'}
        </button>
        <button type="button" className="bal-link" onClick={() => setPhase('setup')}>
          Scrap build
        </button>
      </div>
    );

    return (
      <div className="bal" ref={rootRef}>
        {hud}
        {howTo}
        <p className="bal-sr" role="status" aria-live="polite">
          {announce}
        </p>
        <div className="bal-play">
          <div className="bal-stagecol">
            <p className="bal-coach go" key={`${spinState?.id ?? 0}-${current ? 'l' : spinning ? 's' : 'i'}-${filled}`} aria-hidden="true">
              {coach}
            </p>
            <Cabinet spinState={spinState} spinning={spinning} pos={pos} canPull={canSpin} onPull={() => doSpin(slots)} deck={deck} />
            {current && spinState && (
              <div className="bal-landcard" key={spinState.id}>
                <GameBanner player={current as GamePlayer} size="card" />
              </div>
            )}
          </div>
          {board('draft', slots, overall, overall && !mystery ? overall.tier : `Your ${posName}`, `Your creation · ${filled}/${features.length}`, foot)}
        </div>
      </div>
    );
  }

  // ---------- Reveal ----------
  if (!result) return null;
  const top = result.matches[0];
  const runners = result.matches.slice(1, 3);
  const sim = top?.similarity ?? 0;
  const clone = Math.round(sim) >= CLONE_THRESHOLD;
  const hof = hofVerdict(result.hofComps, result.compsConsidered);
  const finalOverall = result.overall;
  const finalSlots = result.picks.map((p, i) => (p ? { player: p, value: result.vector[i] } : null));
  const topStyle = styleOf(top?.player);
  return (
    <div className="bal" ref={rootRef}>
      <Confetti fire={confetti} />
      {hud}
      <div className="bal-reveal">
        {stage < 2 && (
          <div className="bal-scanbox">
            <h3 ref={headRef} tabIndex={-1} className="bal-kicker">
              {stage === 0 ? `Scanning ${result.matches.length} league ${plural(result.position)}` : 'Your creation plays like...'}
            </h3>
            <p className="bal-scan" aria-hidden="true">
              {stage === 0 ? scanName : ''}
            </p>
            <ArcadeButton tone="ghost" className="bal-skip" onClick={() => setStage(3)}>
              Skip to the result
            </ArcadeButton>
          </div>
        )}

        {stage >= 2 && top && (
          <section className={cn('bal-payoff', clone && 'clone')} style={teamVars(topStyle)} aria-labelledby="bal-match-h">
            <h3 id="bal-match-h" ref={headRef} tabIndex={-1} className="bal-kicker">
              Your creation plays like
            </h3>
            <div className="bal-payoff-card flip-y">
              <GameBanner player={top.player as GamePlayer} size="card" reveal ovr={ovrMap?.get(playerKey(top.player)) ?? null} nameAs="h4" />
            </div>
            <div className="bal-payoff-row">
              <Gauge value={sim} />
              <div className="bal-verdicts">
                <span className="bal-pill v">{verdictFor(sim)}</span>
                {finalOverall && (
                  <span className="bal-pill">
                    Build <GradeChip pct={finalOverall.pct} size="sm" /> {finalOverall.rating} OVR
                  </span>
                )}
                {clone ? (
                  <span className="bal-pill gold">★ Premium pack earned</span>
                ) : Math.round(sim) >= 85 ? (
                  <span className="bal-pill gold">Standard pack earned</span>
                ) : null}
                {newBest && <span className="bal-pill gold">New best {Math.round(sim)}%</span>}
              </div>
            </div>
            {top.smallSample && <span className="arc-hint">Small sample: he has played {top.player.games} games.</span>}
            <p className="bal-sr" role="status">
              Your creation plays like {top.player.name}, {Math.round(sim)}% similar. {verdictFor(sim)}.
            </p>
            {stage >= 3 && (
              <div className="bal-actions rise">
                <ArcadeButton tone="go" onClick={start} autoFocus>
                  Build another {result.position}
                </ArcadeButton>
                <ArcadeButton tone="ghost" onClick={() => setPhase('setup')}>
                  Change position
                </ArcadeButton>
              </div>
            )}
          </section>
        )}

        {stage >= 3 && top && (
          <div className="bal-grid2 rise">
            <div className="bal-col">
              {board(
                'final',
                finalSlots,
                finalOverall,
                finalOverall ? finalOverall.tier : 'Your creation',
                mystery ? 'Your build, unsealed' : 'Your build',
              )}
              <StyleChart result={result} baseline={baseline} />
            </div>
            <div className="bal-col">
              {finalOverall && (
                <div className="bal-fact">
                  <div className="k">Build overall</div>
                  <div className="v gold">
                    <GradeChip pct={finalOverall.pct} size="md" />
                    <span>
                      {finalOverall.rating} · {finalOverall.tier}
                    </span>
                  </div>
                  <p>
                    Your traits average the {ordinal(finalOverall.pct)} percentile among league {plural(result.position)}, on the official 62 to 99 OVR curve.
                  </p>
                </div>
              )}
              <div className="bal-fact">
                <div className="k">Hall of Fame bound?</div>
                <div className="v" style={{ color: result.hofComps / Math.max(1, result.compsConsidered) >= 0.5 ? 'var(--turf)' : 'var(--chalk)' }}>
                  {hof.label}
                </div>
                <p>{hof.detail}</p>
              </div>
              {runners.length > 0 && (
                <div>
                  <p className="bal-sub">Next closest</p>
                  <ol className="bal-runners">
                    {runners.map((c, i) => (
                      <li key={playerKey(c.player)} style={{ minWidth: 0 }}>
                        <GameBanner
                          player={c.player as GamePlayer}
                          size="compact"
                          reveal
                          ovr={ovrMap?.get(playerKey(c.player)) ?? null}
                          topRight={<span className="lamp">{Math.round(c.similarity)}%</span>}
                          eyebrow={`#${i + 2} match${c.smallSample ? ' · small sample' : ''}`}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildALegend;
