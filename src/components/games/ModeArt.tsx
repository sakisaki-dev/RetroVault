import { NFL_TEAMS } from '@/utils/nflTeams';
import ProPlayerBanner from '../brand/ProPlayerBanner';
import TeamLogo from '../brand/TeamLogo';

/**
 * Landing-card art for each arcade mode: pure CSS/SVG plus the site's own components, tinted with the
 * mode colour (--mc). Hover motion lives in arcade.css (.mode:hover .ma-*) and is off with reduced motion.
 */
export type ModeArtId = 'rank' | 'perfect' | 'kc' | 'legend' | 'hol' | 'grid' | 'imposter';

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
  <div className="ma-perfect">
    <div className="ma-score">
      <span className="ma-score-k">Final</span>
      <span className="ma-score-v">18–0</span>
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

const ART: Record<ModeArtId, () => JSX.Element> = {
  rank: RankArt,
  perfect: PerfectArt,
  kc: KeepCutArt,
  legend: LegendArt,
  hol: HolArt,
  grid: GridArt,
  imposter: ImposterArt,
};

const ModeArt = ({ id }: { id: ModeArtId }) => {
  const Art = ART[id];
  return <Art />;
};

export default ModeArt;
