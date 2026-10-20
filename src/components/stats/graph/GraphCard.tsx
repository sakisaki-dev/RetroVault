import { useMemo, useState } from 'react';
import { Orbit, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import ChartFrame from '../analytics/ChartFrame';
import Chips from '../analytics/Chips';
import { buildGraph, type GraphConfig, type GraphPreset } from './graphConfig';
import { graphSummary } from './graphText';
import type { GraphDeps } from './graphStats';
import { GraphLegend, GraphPlot, GraphTable } from './GraphParts';

type Mark = 'dots' | 'logos';
const ALL = 'ALL';

/**
 * A Lab chart from a config (fixed chart or saved preset): position chips remove the other players and rescale,
 * dots or logos, legend, table view, and a button to open it in the Graph Builder.
 */
const GraphCard = ({
  preset,
  players,
  legends,
  deps,
  onSelect,
  onOpenBuilder,
  onRemove,
}: {
  preset: GraphPreset;
  players: Player[];
  legends: Player[];
  deps: GraphDeps;
  onSelect: (p: Player) => void;
  onOpenBuilder: (c: GraphConfig) => void;
  onRemove?: () => void;
}) => {
  const [pos, setPos] = useState<Position | typeof ALL>(ALL);
  const [mark, setMark] = useState<Mark>('dots');
  const base = preset.config;
  const config = useMemo<GraphConfig>(() => (pos === ALL ? base : { ...base, pos: [pos] }), [base, pos]);
  const model = useMemo(() => buildGraph(config, players, legends, deps), [config, players, legends, deps]);
  if (!model) return null;
  // Position chips only when the chart isn't already pinned to one position.
  const choices = base.pos.length === 1 ? [] : (base.pos.length ? base.pos : model.positions);

  return (
    <ChartFrame
      title={base.title ?? preset.name}
      icon={<Orbit className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`${base.subtitle ? `${base.subtitle} ` : ''}${graphSummary(model)}`}
      controls={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {choices.length > 1 ? (
            <Chips
              label={`${preset.name}: players shown`}
              value={pos}
              onChange={setPos}
              options={[{ value: ALL as Position | typeof ALL, label: 'All' }, ...choices.map((p) => ({ value: p as Position | typeof ALL, label: p }))]}
            />
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Chips
              label="Point style"
              value={mark}
              onChange={setMark}
              options={[
                { value: 'dots' as Mark, label: 'Dots' },
                { value: 'logos' as Mark, label: 'Logos' },
              ]}
            />
            <GraphLegend model={model} color={config.color} />
          </div>
        </div>
      }
      chart={<GraphPlot model={model} logos={mark === 'logos'} onSelect={onSelect} />}
      table={<GraphTable model={model} onSelect={onSelect} />}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenBuilder(config)}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-night/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Open in Graph Builder
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-night/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-flag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Unpin preset
            </button>
          )}
        </div>
      }
    />
  );
};

export default GraphCard;
