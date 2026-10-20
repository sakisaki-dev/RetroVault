import type { Player } from '@/types/player';
import { liftForDarkBg } from '@/utils/teamColors';
import type { PositionStrength } from './teamStats';

interface PositionRadarProps {
  teamName: string;
  primary: string;
  rows: PositionStrength[];
  onSelect: (p: Player) => void;
}

const SIZE = 220;
const C = SIZE / 2;
const R = 78;

const point = (i: number, n: number, r: number) => {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};

/**
 * All-time franchise strength by position: each spoke is the league percentile of the best player who ever
 * played that position here. The table beside it lists the same numbers (and opens each player).
 */
const PositionRadar = ({ teamName, primary, rows, onSelect }: PositionRadarProps) => {
  const n = rows.length;
  const stroke = liftForDarkBg(primary, 58);
  const poly = rows.map((r, i) => point(i, n, (R * Math.max(r.pct, 3)) / 100).join(',')).join(' ');

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto w-full max-w-[15rem]"
        role="img"
        aria-label={`${teamName} all-time strength by position, as league percentiles. The table lists each value.`}
      >
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={rows.map((_, i) => point(i, n, (R * ring) / 100).join(',')).join(' ')}
            fill="none"
            stroke="hsl(var(--border))"
            strokeDasharray={ring === 100 ? undefined : '2 3'}
          />
        ))}
        {rows.map((_, i) => {
          const [x, y] = point(i, n, R);
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="hsl(var(--border))" />;
        })}
        <polygon points={poly} fill={stroke} fillOpacity={0.28} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
        {rows.map((r, i) => {
          const [x, y] = point(i, n, (R * Math.max(r.pct, 3)) / 100);
          return <circle key={r.position} cx={x} cy={y} r={3} fill={r.best ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))'} />;
        })}
        {rows.map((r, i) => {
          const [x, y] = point(i, n, R + 18);
          return (
            <text
              key={r.position}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground font-display text-[11px] font-bold"
            >
              {r.position}
            </text>
          );
        })}
      </svg>

      <table className="w-full text-sm">
        <caption className="sr-only">{teamName}: best player ever at each position and his league percentile</caption>
        <thead>
          <tr className="font-pixel text-[8px] uppercase text-muted-foreground">
            <th scope="col" className="py-1 text-left font-normal">Pos</th>
            <th scope="col" className="py-1 text-left font-normal">Best ever here</th>
            <th scope="col" className="py-1 text-right font-normal">Pctl</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.position} className="border-t border-border/60">
              <td className="py-1 pr-2 font-display font-bold">{r.position}</td>
              <td className="max-w-0 py-1 pr-2">
                {r.best ? (
                  <button type="button" onClick={() => onSelect(r.best!)} className="block max-w-full truncate text-left font-medium hover:text-gold">
                    {r.best.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground">Nobody yet</span>
                )}
              </td>
              <td className="py-1 text-right font-mono tabular-nums">{r.best ? r.pct : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PositionRadar;
