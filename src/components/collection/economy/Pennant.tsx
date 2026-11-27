import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { PixelRows } from './pixel';
import './rewards.css';

const W = 26;
const H = 13;
/** A pennant on a whole-pixel grid: outline, club-colour body and a secondary stripe along the pole, pointing right. */
const rows = (): string[] =>
  Array.from({ length: H }, (_, y) => {
    const half = (H - 1) / 2;
    const len = Math.max(1, Math.round(W * (1 - Math.abs(y - half) / (half + 1.5))));
    return Array.from({ length: W }, (_, x) => {
      if (x >= len) return '.';
      if (x === len - 1 || y === 0 || y === H - 1) return 'K';
      if (x < 2) return 'S';
      return 'P';
    }).join('');
  });
const RIGHT = rows();
/** Pointing down (hanging from a cord): the grid transposed */
const DOWN = Array.from({ length: W }, (_, y) => RIGHT.map((r) => r[y]).join(''));

/** A club's pennant in pixel art: club colours, its abbreviation in pixel type. `locked` greys it out. */
const Pennant = ({ club, dir = 'right', locked = false }: { club: string; dir?: 'right' | 'down'; locked?: boolean }) => {
  const team = findNFLTeam(club);
  const ink = { K: '#0b0f1a', P: `hsl(${team?.primaryColor ?? '215 12% 36%'})`, S: `hsl(${team?.secondaryColor ?? '0 0% 80%'})` };
  const grid = dir === 'right' ? RIGHT : DOWN;
  return (
    <span className={cn('rw-pen', locked && 'is-locked')} title={team?.fullName ?? club} style={dir === 'down' ? { aspectRatio: `${H} / ${W}` } : undefined}>
      <svg viewBox={`0 0 ${grid[0].length} ${grid.length}`} shapeRendering="crispEdges" aria-hidden="true">
        <PixelRows rows={grid} ink={ink} />
      </svg>
      <span className="rw-pen__t">{team?.abbreviation ?? club.slice(0, 3)}</span>
    </span>
  );
};

export default Pennant;
