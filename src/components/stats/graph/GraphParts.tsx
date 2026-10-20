import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import LandscapeScatter from '../visual/LandscapeScatter';
import { Legend } from '../visual/chartParts';
import { GOLD } from '../visual/chartKit';
import { VIZ } from '../analytics/viz';
import { quadrantName, splitOf } from '../visual/landscape';
import { POSITION_COLORS, TIER_COLORS, type ColorBy, type GraphModel } from './graphConfig';

/** The plot for a graph model (shared by the Lab cards and the Graph Builder). */
export const GraphPlot = ({ model, logos, onSelect, highlightKey }: { model: GraphModel; logos: boolean; onSelect: (p: Player) => void; highlightKey?: string | null }) =>
  model.points.filter((p) => !p.nfl).length < 3 ? (
    <p className="py-10 text-center text-sm text-muted-foreground">Fewer than three league players match these stats and filters. Loosen a filter or pick other stats.</p>
  ) : (
    <LandscapeScatter
      points={model.points}
      spec={model.spec}
      logos={logos}
      onSelect={onSelect}
      highlightKey={highlightKey}
      ariaLabel={`${model.ys.label} against ${model.xs.label}. Each dot is a player; click, tap or press Enter on one to open his card.`}
    />
  );

const dot = (color: string) => <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />;

/** Legend for the current colour mode plus the Hall of Fame ring and the NFL marker. */
export const GraphLegend = ({ model, color }: { model: GraphModel; color: ColorBy }) => {
  const items =
    color === 'position'
      ? model.shown.map((p) => ({ key: p, label: p, swatch: dot(POSITION_COLORS[p]) }))
      : color === 'tier'
        ? [
            { key: 'leg', label: 'Legendary', swatch: dot(TIER_COLORS.legendary) },
            { key: 'eli', label: 'Elite', swatch: dot(TIER_COLORS.elite) },
            { key: 'gre', label: 'Great', swatch: dot(TIER_COLORS.great) },
            { key: 'ind', label: 'Inductee', swatch: dot(TIER_COLORS.inductee) },
            { key: 'none', label: 'Not in the Hall', swatch: dot(TIER_COLORS.none) },
          ]
        : [{ key: 'team', label: 'Team colour', swatch: dot('linear-gradient(135deg, #3987e5 50%, #d95926 50%)') }];
  const hasNfl = model.points.some((p) => p.nfl);
  return (
    <Legend
      items={[
        ...items,
        { key: 'hof', label: 'Hall of Famer', swatch: <span aria-hidden="true" className="h-3 w-3 rounded-full border-2" style={{ borderColor: GOLD, background: VIZ.surface }} /> },
        ...(hasNfl
          ? [{ key: 'nfl', label: 'Real NFL (unranked)', swatch: <span aria-hidden="true" className="h-3 w-3 rounded-[2px] border-2" style={{ borderColor: VIZ.muted, background: VIZ.surface }} /> }]
          : []),
        ...(model.ss ? [{ key: 'size', label: `Size = ${model.ss.short}`, swatch: <span aria-hidden="true" className="h-3 w-3 rounded-full border" style={{ borderColor: VIZ.muted }} /> }] : []),
      ]}
    />
  );
};

/** Table view of a graph model: every plotted player with both values (and size), quadrant and tags. */
export const GraphTable = ({ model, onSelect }: { model: GraphModel; onSelect: (p: Player) => void }) => {
  const { sx, sy } = splitOf(model.points, model.spec);
  const rows = [...model.points].sort((a, b) => (model.spec.yInvert ? a.y - b.y : b.y - a.y) || b.x - a.x);
  return (
    <div className="relative max-h-[440px] overflow-auto rounded-md border border-line/60">
      <table className="w-full text-sm">
        <caption className="sr-only">
          {model.ys.label} against {model.xs.label}: every plotted player
        </caption>
        <thead className="sticky top-0 bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-normal">Player</th>
            <th scope="col" className="px-2 py-1.5 font-normal">{model.xs.short}</th>
            <th scope="col" className="px-2 py-1.5 font-normal">{model.ys.short}</th>
            {model.ss && <th scope="col" className="px-2 py-1.5 font-normal">{model.ss.short}</th>}
            {!model.spec.noSplits && <th scope="col" className="hidden px-2 py-1.5 font-normal sm:table-cell">Quadrant</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.key} className="border-t border-line/40">
              <td className="px-2 py-1">
                <button type="button" onClick={() => onSelect(p.player)} className="text-left font-semibold hover:text-gold">
                  {p.player.name}
                </button>
                <span className="ml-1 text-xs text-muted-foreground">
                  {p.player.position}
                  {p.player.team ? ` · ${p.player.team}` : ''}
                  {p.nfl ? ' · NFL (unranked)' : isHallOfFamer(p.player) ? ' · HOF' : ''}
                </span>
              </td>
              <td className="px-2 py-1 font-mono text-xs tabular-nums">{p.xText.replace(` ${model.xs.short}`, '')}</td>
              <td className="px-2 py-1 font-mono text-xs tabular-nums">{p.yText.replace(` ${model.ys.short}`, '')}</td>
              {model.ss && <td className="px-2 py-1 font-mono text-xs tabular-nums">{p.sizeText?.replace(` ${model.ss.short}`, '')}</td>}
              {!model.spec.noSplits && <td className="hidden px-2 py-1 text-xs sm:table-cell">{quadrantName(p, sx, sy, model.spec)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
