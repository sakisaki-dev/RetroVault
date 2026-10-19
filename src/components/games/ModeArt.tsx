import { NFL_TEAMS } from '@/utils/nflTeams';
import ProPlayerBanner from '../brand/ProPlayerBanner';
import TeamLogo from '../brand/TeamLogo';

/**
 * Landing-card art for each arcade mode: pure CSS/SVG plus the site's own components, tinted with the
 * mode colour (--mc). Hover motion lives in arcade.css (.mode:hover .ma-*) and is off with reduced motion.
 */
export type ModeArtId = 'rank' | 'perfect' | 'kc' | 'legend' | 'hol' | 'grid' | 'imposter' | 'sixdeg' | 'ou' | 'build';

const team = (id: string) => NFL_TEAMS.find((t) => t.id === id) ?? null;

const RankArt = () => (
  <div className="ma-rank">
    {[1, 2, 3, 4, 5].map((n) => (
      <div key={n} className="ma-rank-row" style={{ ['--i' as string]: n }}>
        <b>{n}</b>
        <span />
      </div>
    ))}
  </div>
);

const PerfectArt = () => (
  <div className="ma-perfect" style={{ gap: 12 }}>
    <div className="ma-score" style={{ padding: '10px 12px' }}>
      <span className="ma-score-k">Final</span>
      <span className="ma-score-v" style={{ fontSize: 36, whiteSpace: 'nowrap' }}>
        18–0
      </span>
      <span className="ma-score-k">Perfect season</span>
    </div>
    <div className="ma-sealed-card">
      <span>?</span>
    </div>
  </div>
);

const KeepCutArt = () => (
  <div className="ma-kc">
    {(['keep', 'cut'] as const).map((kind) => (
      <div key={kind} className={`ma-bin ${kind}`}>
        <i />
        <i />
        <i />
        <span className="ma-stamp">{kind === 'keep' ? 'Keep' : 'Cut'}</span>
      </div>
    ))}
  </div>
);

const LegendArt = () => (
  <div className="ma-legend">
    <ProPlayerBanner name="Mystery player" position="" size="card" sealed sealedHint="?" />
  </div>
);

const HolArt = () => (
  <div className="ma-hol">
    <div className="ma-mini">
      <b>1,204</b>
    </div>
    <div className="ma-arrows">
      <span className="up">▲</span>
      <span className="down">▼</span>
    </div>
    <div className="ma-mini sealed">
      <b>????</b>
    </div>
  </div>
);

const GRID_ROWS = ['cowboys', 'chargers', 'dolphins'];
const GRID_COLS = ['ravens', 'packers', 'chiefs'];

const GridArt = () => (
  <div className="ma-grid">
    <span />
    {GRID_COLS.map((id) => (
      <span key={id} className="ma-axis">
        <TeamLogo team={team(id)} size={22} decorative />
      </span>
    ))}
    {GRID_ROWS.map((id, r) => (
      <div key={id} className="contents">
        <span className="ma-axis">
          <TeamLogo team={team(id)} size={22} decorative />
        </span>
        {[0, 1, 2].map((c) => (
          <span key={c} className={(r + c) % 3 === 0 ? 'ma-cell on' : 'ma-cell'} />
        ))}
      </div>
    ))}
  </div>
);

const ImposterArt = () => (
  <div className="ma-imp">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={i === 4 ? 'ma-imp-card odd' : 'ma-imp-card'}>
        {i === 4 ? '!' : ''}
      </span>
    ))}
  </div>
);

/** Chain of cards from Start to Target joined by glowing links. */
const SixDegArt = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    {['S', '', '', 'T'].map((t, i) => (
      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {i > 0 && <i style={{ width: 12, height: 4, borderRadius: 2, background: 'var(--mc)', boxShadow: '0 0 8px var(--mc)' }} />}
        <span className="ma-imp-card" style={{ width: 34 }}>
          {t}
        </span>
      </span>
    ))}
  </div>
);

/** Mini sportsbook board: one over and one under line with a live lamp. */
const OverUnderArt = () => (
  <div style={{ background: '#05070d', border: '1px solid #ffffff22', borderRadius: 6, padding: '6px 10px', fontFamily: 'var(--f-pixel)', fontSize: 11, lineHeight: 1.7, minWidth: 150 }}>
    <div style={{ color: 'var(--gold)', fontSize: 9 }}>● LIVE</div>
    <div style={{ color: '#3ddc84' }}>O 9,950.5 −110</div>
    <div style={{ color: 'var(--flag)' }}>U 9,950.5 −110</div>
  </div>
);

/** Build-a-Legend: three drafted skill chips feeding one glowing player silhouette. */
const BUILD_CHIPS = ['Y/A 8.4', 'TD% 6.1', 'Rush 31'];
const BuildArt = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {BUILD_CHIPS.map((c, i) => (
        <span
          key={c}
          style={{
            fontFamily: 'var(--f-pixel)',
            fontSize: 10,
            padding: '4px 7px',
            borderRadius: 4,
            background: '#05070d',
            color: 'var(--mc)',
            boxShadow: '0 0 0 1px color-mix(in srgb, var(--mc) 60%, transparent)',
            transform: `translateX(${i === 1 ? 8 : 0}px)`,
            whiteSpace: 'nowrap',
          }}
        >
          {c}
        </span>
      ))}
    </div>
    <svg width="46" height="84" viewBox="0 0 46 84" aria-hidden="true" style={{ flex: 'none' }}>
      {[14, 42, 70].map((y) => (
        <path key={y} d={`M2 ${y} C 24 ${y}, 24 42, 44 42`} fill="none" stroke="var(--mc)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      ))}
    </svg>
    <div
      style={{
        width: 70,
        height: 92,
        borderRadius: 8,
        display: 'grid',
        placeItems: 'end center',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, color-mix(in srgb, var(--mc) 35%, #0b1020), #0b1020)',
        boxShadow: '0 0 0 2px var(--mc), 0 0 22px color-mix(in srgb, var(--mc) 55%, transparent), 4px 6px 0 #0008',
      }}
    >
      <svg width="60" height="74" viewBox="0 0 60 74" aria-hidden="true">
        <circle cx="30" cy="24" r="13" fill="var(--mc)" opacity="0.9" />
        <path d="M4 74 C 4 50, 16 42, 30 42 C 44 42, 56 50, 56 74 Z" fill="var(--mc)" opacity="0.9" />
        <text x="30" y="30" textAnchor="middle" fontFamily="var(--f-display)" fontWeight="800" fontSize="17" fill="#0b1020">?</text>
      </svg>
    </div>
  </div>
);

const ART: Record<ModeArtId, () => JSX.Element> = {
  rank: RankArt,
  perfect: PerfectArt,
  kc: KeepCutArt,
  legend: LegendArt,
  hol: HolArt,
  grid: GridArt,
  imposter: ImposterArt,
  sixdeg: SixDegArt,
  ou: OverUnderArt,
  build: BuildArt,
};

const ModeArt = ({ id }: { id: ModeArtId }) => {
  const Art = ART[id];
  return <Art />;
};

export default ModeArt;
