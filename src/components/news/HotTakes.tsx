import { useId, useState, type CSSProperties } from 'react';
import { ChevronDown, Flame } from 'lucide-react';
import type { Player } from '@/types/player';
import { useHotTakes, type HotTake, type TakeHeat } from '@/utils/leagueContent';
import { getTeamColors } from '@/utils/teamColors';
import { ClubChips } from './ClubChips';
import { SourceList, SourcedFigure } from './SourcedFigure';
import './takes.css';

/**
 * Hot Takes: the fourth AI-authored lane (data/y80/hot_takes.json, written only by a takes.set upload;
 * scripts/story_check.py checks every figure like the Season Story's). Shown on the Timeline under the Season Story,
 * for the season its switcher shows; a season without takes falls back to the latest season that has them.
 * public/data/league/takes.json (every season, newest first) loads once, on demand (useHotTakes).
 *
 * Laid out as an opinion column: each take is a numbered entry with a small heat meter (1-3 pixel flames), the take as
 * its headline, the dek, the first figure as an inline number (its source on hover or tap), player chips in club
 * colours, and the argument (body and every figure with its source) behind a toggle.
 */

const HEAT_LABEL: Record<TakeHeat, string> = { 1: 'Warm', 2: 'Hot', 3: 'Scorching' };

/** A 7 x 9 pixel flame, one rect per lit pixel (rows top to bottom) */
const FLAME = ['...#...', '...##..', '..###..', '.####..', '.#####.', '###.###', '##...##', '##...##', '.#####.'];
const CORE = ['.......', '.......', '.......', '.......', '...#...', '...#...', '..###..', '..###..', '.......'];
const pixels = (rows: string[]) => rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? [x, y] : null)).filter((p): p is number[] => !!p));
const FLAME_PX = pixels(FLAME);
const CORE_PX = pixels(CORE);

const PixelFlame = ({ lit }: { lit: boolean }) => (
  <svg className="ht-flame" data-lit={lit || undefined} viewBox="0 0 7 9" width="9" height="12" shapeRendering="crispEdges" aria-hidden="true">
    {FLAME_PX.map(([x, y]) => (
      <rect key={`f${x}-${y}`} x={x} y={y} width="1" height="1" className="ht-flame__outer" />
    ))}
    {lit && CORE_PX.map(([x, y]) => <rect key={`c${x}-${y}`} x={x} y={y} width="1" height="1" className="ht-flame__core" />)}
  </svg>
);

export const HeatMeter = ({ heat }: { heat: TakeHeat }) => (
  <span className="ht-heat" data-heat={heat} role="img" aria-label={`Heat ${heat} of 3: ${HEAT_LABEL[heat]}`}>
    <span className="ht-heat__flames">
      {[1, 2, 3].map((n) => (
        <PixelFlame key={n} lit={n <= heat} />
      ))}
    </span>
    <span className="ht-heat__label">{HEAT_LABEL[heat]}</span>
  </span>
);

const teamVars = (team?: string): CSSProperties | undefined => {
  const c = getTeamColors(team);
  return c ? ({ '--tc': `hsl(${c.primary})`, '--tc2': `hsl(${c.secondary})` } as CSSProperties) : undefined;
};

const TakeCard = ({ take, players, onPlayer, index }: { take: HotTake; players: Player[]; onPlayer: (p: Player) => void; index: number }) => {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const lead = take.stats[0];
  return (
    <li className="ht-item stagger-in" data-heat={take.heat} style={{ ...teamVars(take.teams[0]), '--i': index } as CSSProperties}>
      <span className="ht-item__n" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="ht-item__main">
        <HeatMeter heat={take.heat} />
        <h4 className="ht-item__title">{take.headline}</h4>
        <p className="ht-item__dek">{take.dek}</p>
        <div className="ht-item__foot">
          {lead && <SourcedFigure stat={lead} className="ht-item__fig" />}
          <ClubChips names={take.players} teams={take.teams} players={players} onPlayer={onPlayer} max={3} label="Players in this take" />
        </div>
        <button type="button" className="ht-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide the argument' : 'Read the argument'}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {open && (
          <div id={bodyId} className="ht-item__body">
            {take.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {take.players.length > 3 && <ClubChips names={take.players.slice(3)} players={players} onPlayer={onPlayer} label="More players" />}
            <SourceList stats={take.stats} />
          </div>
        )}
      </div>
    </li>
  );
};

interface Props {
  /** The season the Season Story shows ("Y90") */
  season: string;
  players: Player[];
  onPlayer: (p: Player) => void;
}

export const HotTakesDesk = ({ season, players, onPlayer }: Props) => {
  const { seasons, loading, failed } = useHotTakes();
  const exact = seasons.find((s) => s.season === season);
  const shown = exact ?? seasons[0];
  if (!loading && !shown && !failed) return null; // no takes in any season yet: nothing to show
  return (
    <section className="ht" aria-labelledby="ht-title" aria-busy={loading || undefined}>
      <header className="ht-mast">
        <p className="ht-mast__kicker">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Opinion · Retro Vault Desk
        </p>
        <h3 id="ht-title" className="ht-mast__title">
          Hot Takes{shown ? <span className="ht-mast__season"> · {shown.season}</span> : null}
        </h3>
        {shown?.intro && <p className="ht-mast__intro">{shown.intro}</p>}
        {shown && !exact && (
          <p className="ht-mast__note">
            No hot takes for {season} yet. Showing {shown.season}.
          </p>
        )}
      </header>
      {loading ? (
        <p className="ht-empty" role="status">
          <span className="ss-loading__dot" aria-hidden="true" /> Heating up the takes…
        </p>
      ) : !shown ? (
        <p className="ht-empty" role="status">
          The hot takes could not be loaded. Try again in a moment.
        </p>
      ) : (
        <ol className="ht-list" aria-label={`${shown.season} hot takes`}>
          {shown.takes.map((t, i) => (
            <TakeCard key={t.id} take={t} players={players} onPlayer={onPlayer} index={i} />
          ))}
        </ol>
      )}
      <p className="ht-foot">Every figure is checked against the league data when the takes are published. Tap a number for its source.</p>
    </section>
  );
};
