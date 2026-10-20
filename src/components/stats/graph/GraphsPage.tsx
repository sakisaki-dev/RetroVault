import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartScatter } from 'lucide-react';
import type { LeagueData, Player } from '@/types/player';
import { leaguePlayers } from '@/config/advanced';
import { useOverlayLegends } from '../visual/useIncludeLegends';
import { buildHash, useHubRoute } from '../hub/hashRoute';
import GraphBuilder from './GraphBuilder';
import { DEFAULT_CONFIG, configToParams, paramsToConfig, useSavedPresets, type GraphConfig } from './graphConfig';
import { clearHandoff, lastGraph, paramsKey, peekHandoff, useRecentGraphs } from './graphPrefs';
import { useGraphDeps } from './useGraphDeps';

/**
 * Stats → Graphs (#stats/graphs?gx=…&gy=…): the Graph Builder full page. The URL always mirrors the chart, so
 * the address bar is the share link; the Lab's "Graph Builder" button and "Open in Graph Builder" land here.
 */
const GraphsPage = ({ data, onSelect }: { data: LeagueData; onSelect: (p: Player) => void }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const legends = useOverlayLegends();
  const deps = useGraphDeps(players);
  const { presets, save, remove } = useSavedPresets();
  const { recent, remember } = useRecentGraphs();
  const { route, navigate } = useHubRoute();

  const [config, setConfig] = useState<GraphConfig>(() => peekHandoff(route.q) ?? paramsToConfig(route.q ?? {}) ?? lastGraph() ?? DEFAULT_CONFIG);
  useEffect(() => clearHandoff(), []);
  const configRef = useRef(config);
  configRef.current = config;

  // The URL and the chart follow each other: a link that changes under us (Back / Forward, a pasted link, the
  // Lab's button) loads that chart; a chart change replaces the URL (so Back leaves the tab, not every tweak).
  const key = paramsKey(config);
  const linked = paramsToConfig(route.q ?? {});
  const linkedKey = linked ? paramsKey(linked) : '';
  const synced = useRef('');
  useEffect(() => {
    if (linkedKey === key) {
      synced.current = key;
      // An old-style link (#stats/players?gx=…) settles on its canonical #stats/graphs form.
      navigate({ tab: 'career', sub: 'graphs', q: configToParams(config) }, { replace: true });
      return;
    }
    if (linked && synced.current === key) {
      // The link moved, not the chart.
      synced.current = linkedKey;
      setConfig(peekHandoff(route.q) ?? linked);
      clearHandoff();
      return;
    }
    synced.current = key;
    navigate({ tab: 'career', sub: 'graphs', q: configToParams(config) }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, linkedKey]);

  // Recent charts: remember one once it has settled for a moment.
  useEffect(() => {
    const id = window.setTimeout(() => remember(configRef.current), 1200);
    return () => window.clearTimeout(id);
  }, [key, remember]);

  const shareLink = `${window.location.origin}${window.location.pathname}${buildHash({ tab: 'career', sub: 'graphs', q: configToParams(config) })}`;

  return (
    <div className="container space-y-4 py-6 sm:py-8">
      <header>
        <p className="font-pixel text-[10px] uppercase text-gold">League Hub · Graphs</p>
        <h1 className="flex items-center gap-2 font-display text-4xl font-extrabold italic uppercase leading-none sm:text-5xl">
          <ChartScatter className="h-8 w-8 text-gold" aria-hidden="true" />
          Graph Builder
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Any stat against any stat. Tap a preset or pick two stats; medians, quadrants and the trend use league players only.
        </p>
      </header>
      <GraphBuilder
        config={config}
        onChange={setConfig}
        players={players}
        legends={legends}
        deps={deps}
        onSelect={onSelect}
        saved={presets}
        onSavePreset={save}
        onRemovePreset={remove}
        recent={recent}
        shareLink={shareLink}
      />
    </div>
  );
};

export default GraphsPage;
