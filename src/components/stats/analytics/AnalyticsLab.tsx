import { useMemo, useState } from 'react';
import { FlaskConical, SlidersHorizontal } from 'lucide-react';
import type { LeagueData, Player, Position } from '@/types/player';
import { METRIC_BY_ID, POSITIONS, buildContext, evaluateMetric, leaguePlayers, type AdvContext, type AdvMetric } from '@/config/advanced';
import { POSITION_NAMES } from '@/utils/playerMeta';
import TeamLogo from '../../brand/TeamLogo';
import Chips from './Chips';
import MetricLabel from './MetricLabel';
import MetricLeaderboard from './MetricLeaderboard';
import PlusHeatTable from './PlusHeatTable';
import ValueAcrossBoard from './ValueAcrossBoard';
import LabGraphs from '../graph/LabGraphs';
import LegendsToggle from '../visual/LegendsToggle';
import { useOverlayLegends } from '../visual/useIncludeLegends';
import { useGraphDeps } from '../graph/useGraphDeps';
import { DEFAULT_CONFIG, useSavedPresets, type GraphConfig } from '../graph/graphConfig';
import { lastGraph, openInGraphs } from '../graph/graphPrefs';
import { useHubRoute } from '../hub/hashRoute';
import LegacyMix from './LegacyMix';
import { fmtNum } from './viz';
import { GRID_ITEM, gridVars } from '../grid';

type Select = (p: Player) => void;

interface Insight {
  metric: AdvMetric;
  caption: string;
  player: Player;
  value: number;
}

/** League-wide best for a metric across every position it applies to. */
const bestAcross = (players: Player[], ctx: AdvContext, id: string, caption: string): Insight | null => {
  const metric = METRIC_BY_ID.get(id);
  if (!metric) return null;
  const best = metric.positions
    .flatMap((pos) => evaluateMetric(players, metric, pos, ctx).rows)
    .sort((a, b) => (metric.lowerIsBetter ? a.value - b.value : b.value - a.value))[0];
  return best ? { metric, caption, player: best.player, value: best.value } : null;
};

const InsightTile = ({ insight, onSelect }: { insight: Insight; onSelect: Select }) => (
  <li className={`${GRID_ITEM} glass-card flex flex-col gap-1 p-3`}>
    <MetricLabel metric={insight.metric} className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground" />
    <span className="font-display text-2xl font-extrabold leading-none text-chalk sm:text-3xl">
      {fmtNum(insight.value, insight.metric.decimals)}
      {insight.metric.suffix ?? ''}
    </span>
    <button
      type="button"
      onClick={() => onSelect(insight.player)}
      className="flex min-w-0 items-center gap-1.5 rounded text-left text-sm font-semibold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      {insight.player.team && <TeamLogo team={insight.player.team} size={18} decorative />}
      <span className="truncate">{insight.player.name}</span>
      <span className="shrink-0 font-pixel text-[9px] text-muted-foreground">{insight.player.position}</span>
    </button>
    <span className="mt-auto pt-1 text-[11px] text-muted-foreground">{insight.caption}</span>
  </li>
);

/** The Stats hub centerpiece: advanced, position-aware career analytics. */
const AnalyticsLab = ({ data, onSelect }: { data: LeagueData; onSelect: Select }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const ctx = useMemo(() => buildContext(players), [players]);
  const positions = POSITIONS.filter((pos) => players.some((p) => p.position === pos));
  const [position, setPosition] = useState<Position>(positions[0] ?? 'QB');
  const legends = useOverlayLegends();
  const deps = useGraphDeps(players);
  const { presets, remove } = useSavedPresets();

  // Graph Builder: full page on Stats → Graphs (the same builder; it remembers the last chart).
  const { navigate } = useHubRoute();
  const openBuilder = (c: GraphConfig) => openInGraphs(navigate, c);

  const insights = useMemo(
    () =>
      [
        bestAcross(players, ctx, 'vorPer16', 'Most value over replacement per season, any position'),
        bestAcross(players, ctx, 'passerRating', 'Best career passer rating'),
        bestAcross(players, ctx, 'impactPerGame', 'Most sacks + INT + FF per game'),
        bestAcross(players, ctx, 'awardRate', 'Most hardware per 100 games'),
      ].filter((x): x is Insight => !!x),
    [players, ctx],
  );

  if (players.length === 0) return null;

  return (
    <section id="analytics" aria-labelledby="analytics-title" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 id="analytics-title" className="section-title text-2xl">
          <FlaskConical className="h-5 w-5 text-gold" aria-hidden="true" />
          Analytics Lab
        </h2>
        <p className="text-sm text-muted-foreground">
          Rate stats, value over replacement and position-relative indexes, all from career totals. Hover or focus any underlined metric for
          its formula and minimum sample.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => openBuilder(lastGraph() ?? DEFAULT_CONFIG)}
            className="inline-flex min-h-[36px] items-center gap-2 rounded-md bg-gold px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wide text-night shadow-[0_0_0_1px_hsl(var(--gold))] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-night"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Graph Builder
          </button>
          <LegendsToggle />
        </div>
      </div>

      {insights.length > 0 && (
        <ul className="flex flex-wrap gap-3" style={gridVars(insights.length, { base: 2, sm: 2, lg: 4 })} aria-label="League bests">
          {insights.map((i) => (
            <InsightTile key={i.metric.id} insight={i} onSelect={onSelect} />
          ))}
        </ul>
      )}

      <ValueAcrossBoard players={players} onSelect={onSelect} />

      <div className="glass-card flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <span id="lab-pos-label" className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Position
        </span>
        <Chips
          label="Position for the leaderboard, + index grid and efficiency chart"
          value={position}
          onChange={setPosition}
          options={positions.map((p) => ({ value: p, label: p, title: POSITION_NAMES[p] }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MetricLeaderboard players={players} ctx={ctx} position={position} extras={legends} onSelect={onSelect} />
        <PlusHeatTable players={players} ctx={ctx} position={position} extras={legends} onSelect={onSelect} />
      </div>

      <LabGraphs
        players={players}
        legends={legends}
        deps={deps}
        position={position}
        presets={presets}
        onRemovePreset={remove}
        onSelect={onSelect}
        onOpenBuilder={openBuilder}
      />

      <LegacyMix players={players} onSelect={onSelect} />
    </section>
  );
};

export default AnalyticsLab;
