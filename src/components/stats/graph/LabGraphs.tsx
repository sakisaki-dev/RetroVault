import { useMemo, useState } from 'react';
import type { Player, Position } from '@/types/player';
import Chips from '../analytics/Chips';
import GraphCard from './GraphCard';
import { fixedCharts, type GraphConfig, type GraphPreset } from './graphConfig';
import type { GraphDeps } from './graphStats';

/**
 * The Lab's charts: four fixed ones (Peak vs longevity first, VOR, efficiency for the Lab's position, Skill vs OVR)
 * plus the viewer's saved Graph Builder presets, one at a time from a chip row so the Lab stays compact.
 */
const LabGraphs = ({
  players,
  legends,
  deps,
  position,
  presets,
  onRemovePreset,
  onSelect,
  onOpenBuilder,
}: {
  players: Player[];
  legends: Player[];
  deps: GraphDeps;
  position: Position;
  presets: GraphPreset[];
  onRemovePreset: (id: string) => void;
  onSelect: (p: Player) => void;
  onOpenBuilder: (c: GraphConfig) => void;
}) => {
  const fixed = useMemo(() => fixedCharts(position), [position]);
  const all = [...fixed, ...presets];
  const [view, setView] = useState('peak');
  const current = all.find((p) => p.id === view) ?? all[0];
  const saved = presets.some((p) => p.id === current.id);

  return (
    <div className="space-y-2">
      <div className="glass-card flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <span className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">Charts</span>
        <Chips
          label="Lab chart"
          value={current.id}
          onChange={setView}
          options={all.map((p) => ({ value: p.id, label: presets.includes(p) ? `★ ${p.name}` : p.name, title: p.config.subtitle ?? 'Saved Graph Builder preset' }))}
        />
      </div>
      <GraphCard
        // Remount per chart (and per Lab position for the efficiency chart) so filters reset.
        key={`${current.id}:${current.id === 'efficiency' ? position : ''}`}
        preset={current}
        players={players}
        legends={legends}
        deps={deps}
        onSelect={onSelect}
        onOpenBuilder={onOpenBuilder}
        onRemove={
          saved
            ? () => {
                onRemovePreset(current.id);
                setView('peak');
              }
            : undefined
        }
      />
    </div>
  );
};

export default LabGraphs;
