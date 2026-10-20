import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, BarChart3, Check, ChevronDown, Clock, Link2, Pin, Sparkles, Star, Table2, X } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { POSITIONS } from '@/config/advanced';
import { cn } from '@/lib/utils';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { NFL_TEAMS, findNFLTeam } from '@/utils/nflTeams';
import Chips from '../analytics/Chips';
import LegendsToggle from '../visual/LegendsToggle';
import {
  DEFAULT_CONFIG,
  TRY_THESE,
  applicablePositions,
  buildGraph,
  suggestMinGames,
  type ColorBy,
  type GraphConfig,
  type GraphModel,
  type GraphPreset,
} from './graphConfig';
import { GRAPH_STATS, STAT_BY_ID, type GraphDeps, type GraphStat } from './graphStats';
import { autoTitle, explainer, graphSummary, positionsLabel } from './graphText';
import { paramsKey } from './graphPrefs';
import { GraphLegend, GraphPlot, GraphTable, NflMissingNote } from './GraphParts';
import StatPicker from './StatPicker';

type Mark = 'dots' | 'logos';
const MIN_GAMES = [0, 8, 16, 32, 64, 100];

const inputCls =
  'h-9 w-full min-w-0 rounded-md border border-line bg-night px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';
const ghostBtn =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-line bg-night/60 px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';
const chipCls =
  'inline-flex min-h-[32px] items-center gap-1 rounded-full border border-line bg-night/60 px-3 py-1 text-xs font-semibold text-secondary-foreground hover:border-gold/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

/** Fixed-chart extras that stop applying once the axes change. */
const CLEAR_EXTRAS: Partial<GraphConfig> = { title: undefined, subtitle: undefined, quadrants: undefined, diagonal: undefined, xSplit: undefined, ySplit: undefined, qualifyBy: undefined };

const quickTitle = (c: GraphConfig) => {
  const x = STAT_BY_ID.get(c.x)?.short ?? c.x;
  const y = STAT_BY_ID.get(c.y)?.short ?? c.y;
  return `${x} vs ${y}${c.pos.length ? ` · ${positionsLabel(c.pos)}` : ''}`;
};

const RowLabel = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <span className="inline-flex shrink-0 items-center gap-1 font-pixel text-[8px] uppercase text-muted-foreground">
    {icon}
    {children}
  </span>
);

const CheckField = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) => (
  <label className="inline-flex min-h-[32px] cursor-pointer items-center gap-2 text-sm">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(43_100%_62%)]" />
    {children}
  </label>
);

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) => (
  <div className="min-w-0 space-y-1">
    <label htmlFor={htmlFor} className="block font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

/** Quick-start rows: one-tap presets, the viewer's saved charts (with ×) and recent charts. */
const QuickRows = ({
  current,
  onPick,
  saved,
  onRemoveSaved,
  recent,
}: {
  current: string;
  onPick: (c: GraphConfig) => void;
  saved: GraphPreset[];
  onRemoveSaved: (id: string) => void;
  recent: GraphConfig[];
}) => {
  const recentShown = recent.filter((c) => paramsKey(c) !== current).slice(0, 5);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <RowLabel icon={<Sparkles className="h-3 w-3 text-gold" aria-hidden="true" />}>Presets</RowLabel>
        {TRY_THESE.map((t) => (
          <button key={t.id} type="button" onClick={() => onPick(t.config)} aria-pressed={paramsKey(t.config) === current} className={cn(chipCls, paramsKey(t.config) === current && 'border-gold text-foreground')}>
            {t.name}
          </button>
        ))}
      </div>
      {saved.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Your saved charts">
          <li>
            <RowLabel icon={<Star className="h-3 w-3 text-gold" aria-hidden="true" />}>Saved</RowLabel>
          </li>
          {saved.map((p) => (
            <li key={p.id} className="inline-flex items-stretch overflow-hidden rounded-full border border-gold/40 bg-gold/5">
              <button type="button" onClick={() => onPick(p.config)} className="min-h-[32px] px-3 text-xs font-semibold text-foreground hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">
                ★ {p.name}
              </button>
              <button
                type="button"
                onClick={() => onRemoveSaved(p.id)}
                aria-label={`Delete saved chart ${p.name}`}
                title="Delete (also unpins it from the Lab)"
                className="inline-flex min-h-[32px] w-8 items-center justify-center border-l border-gold/30 text-muted-foreground hover:bg-flag/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {recentShown.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <RowLabel icon={<Clock className="h-3 w-3" aria-hidden="true" />}>Recent</RowLabel>
          {recentShown.map((c) => (
            <button key={paramsKey(c)} type="button" onClick={() => onPick(c)} className={chipCls}>
              {quickTitle(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Save the chart as a preset (pinned to the Lab) with an inline name field: no browser prompt to get blocked. */
const SavePreset = ({ defaultName, onSave }: { defaultName: string; onSave: (name: string) => void }) => {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(defaultName);
  const [saved, setSaved] = useState(false);
  const uid = useId();
  useEffect(() => {
    setSaved(false);
    setName(defaultName);
  }, [defaultName]);
  if (!naming)
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-gold px-2.5 py-1.5 text-xs font-bold text-night hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
      >
        {saved ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
        {saved ? 'Saved · pinned to the Lab' : 'Save preset'}
      </button>
    );
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onSave(n);
    setSaved(true);
    setNaming(false);
  };
  return (
    <form
      className="flex min-w-0 items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={`${uid}-n`} className="sr-only">
        Preset name
      </label>
      <input
        id={`${uid}-n`}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
        className={cn(inputCls, 'h-9 w-44')}
      />
      <button type="submit" className="inline-flex h-9 items-center rounded-md bg-gold px-2.5 text-xs font-bold text-night hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
        Save
      </button>
      <button type="button" onClick={() => setNaming(false)} aria-label="Cancel saving" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
};

/** Why the chart is empty, and a one-tap fix. */
const EmptyState = ({ config, model, applicable, onFix }: { config: GraphConfig; model: GraphModel; applicable: Position[]; onFix: (patch: Partial<GraphConfig>) => void }) => {
  const filtered = !!(config.team || config.hof || config.minGames > 0 || config.pos.length);
  let body: ReactNode;
  if (!applicable.length) {
    const alt = GRAPH_STATS.find((s: GraphStat) => s.group === model.ys.group && s.id !== model.xs.id && s.positions.some((p) => model.xs.positions.includes(p)));
    body = (
      <>
        <p>
          <b className="text-foreground">{model.xs.label}</b> is tracked for {model.xs.positions.join(', ')}; <b className="text-foreground">{model.ys.label}</b> for{' '}
          {model.ys.positions.join(', ')}. No position has both.
        </p>
        {alt && (
          <button type="button" className={ghostBtn} onClick={() => onFix({ ...CLEAR_EXTRAS, y: alt.id, pos: [], minGames: suggestMinGames([config.x, alt.id]) })}>
            Try {alt.label} on Y
          </button>
        )}
      </>
    );
  } else if (filtered) {
    const n = model.points.filter((p) => !p.nfl).length;
    body = (
      <>
        <p>
          Only {n} league player{n === 1 ? '' : 's'} match{n === 1 ? 'es' : ''} these filters. A chart needs at least three.
        </p>
        <button type="button" className={ghostBtn} onClick={() => onFix({ team: undefined, hof: false, minGames: 0, pos: [] })}>
          Clear filters
        </button>
      </>
    );
  } else {
    body = <p>Fewer than three league players have both of these stats. Pick another pair, or try a preset above.</p>;
  }
  return <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line px-4 py-10 text-center text-sm text-muted-foreground">{body}</div>;
};

/**
 * Graph Builder, full page on Stats → Graphs: chart large on the left, a compact control sidebar on the right
 * (stacked on phones). Main controls are just X, Y, positions and the NFL toggle; the rest sits under More options.
 * Any stat against any stat with presets, saved and recent charts, a table view, a shareable link and saved presets.
 */
const GraphBuilder = ({
  config,
  onChange,
  players,
  legends,
  deps,
  onSelect,
  saved,
  onSavePreset,
  onRemovePreset,
  recent,
  shareLink,
}: {
  config: GraphConfig;
  onChange: (c: GraphConfig) => void;
  players: Player[];
  legends: Player[];
  deps: GraphDeps;
  onSelect: (p: Player) => void;
  saved: GraphPreset[];
  onSavePreset: (name: string, c: GraphConfig) => void;
  onRemovePreset: (id: string) => void;
  recent: GraphConfig[];
  shareLink: string;
}) => {
  const uid = useId();
  const [mark, setMark] = useState<Mark>('dots');
  const [asTable, setAsTable] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false);
  const model = useMemo(() => buildGraph(config, players, legends, deps), [config, players, legends, deps]);
  const applicable = applicablePositions(config);
  const current = paramsKey(config);

  const set = (patch: Partial<GraphConfig>) => onChange({ ...config, ...patch });
  // Picking a stat: drop fixed-chart extras, keep only positions both stats apply to, and pick a sensible sample floor.
  const setAxis = (patch: Partial<Pick<GraphConfig, 'x' | 'y' | 'size'>>) => {
    const next = { ...config, ...CLEAR_EXTRAS, ...patch };
    const ok = applicablePositions(next);
    onChange({ ...next, pos: next.pos.filter((p) => ok.includes(p)), minGames: suggestMinGames([next.x, next.y, next.size]) });
  };
  const swap = () => set({ x: config.y, y: config.x, logX: config.logY, logY: config.logX, ...CLEAR_EXTRAS });
  const togglePos = (p: Position) => {
    const next = config.pos.includes(p) ? config.pos.filter((x) => x !== p) : [...config.pos, p];
    set({ pos: next.length === applicable.length ? [] : next });
  };
  const teams = useMemo(
    () => NFL_TEAMS.filter((t) => players.some((p) => findNFLTeam(p.team)?.id === t.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  const highlight = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2 || !model) return null;
    return model.points.find((p) => p.player.name.toLowerCase().includes(q))?.key ?? null;
  }, [search, model]);
  const title = model ? autoTitle(model, config) : 'Graph Builder';
  const xPositions = STAT_BY_ID.get(config.x)?.positions;
  const yPositions = STAT_BY_ID.get(config.y)?.positions;
  const advancedOn = [config.size, config.logX, config.logY, config.trend, config.team, config.hof, config.color !== 'team', !config.splits, mark === 'logos'].filter(Boolean).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', shareLink);
    }
  };

  return (
    <div className="space-y-4">
      <QuickRows current={current} onPick={onChange} saved={saved} onRemoveSaved={onRemovePreset} recent={recent} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Chart */}
        <section aria-labelledby={`${uid}-title`} className="glass-card min-w-0 space-y-3 p-3 sm:p-4">
          <div className="space-y-1">
            <h2 id={`${uid}-title`} className="font-display text-2xl font-extrabold italic uppercase leading-tight sm:text-3xl">
              {title}
            </h2>
            {model && (
              <p className="text-sm text-secondary-foreground">
                {config.subtitle ? `${config.subtitle} ` : ''}
                {explainer(model, config)}
              </p>
            )}
            {model && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {graphSummary(model)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SavePreset defaultName={title} onSave={(name) => onSavePreset(name, config)} />
            <button type="button" onClick={copy} className={ghostBtn}>
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <button type="button" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)} className={ghostBtn}>
              {asTable ? <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Table2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {asTable ? 'Chart view' : 'Table view'}
            </button>
            <div className="min-w-[9rem] flex-1 sm:max-w-[14rem]">
              <label htmlFor={`${uid}-q`} className="sr-only">
                Find a player on the chart
              </label>
              <input
                id={`${uid}-q`}
                type="search"
                value={search}
                list={`${uid}-names`}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a player…"
                className={inputCls}
              />
              <datalist id={`${uid}-names`}>
                {model?.points.map((p) => <option key={p.key} value={p.player.name} />)}
              </datalist>
            </div>
          </div>
          {search.trim().length >= 2 && (
            <p className="text-[11px] text-muted-foreground" aria-live="polite">
              {highlight ? 'Ringed and labelled in gold.' : 'Not on this chart.'}
            </p>
          )}

          {model && <GraphLegend model={model} color={config.color} />}
          {model ? (
            asTable ? (
              <GraphTable model={model} onSelect={onSelect} />
            ) : (
              <GraphPlot
                model={model}
                logos={mark === 'logos'}
                onSelect={onSelect}
                highlightKey={highlight}
                empty={<EmptyState config={config} model={model} applicable={applicable} onFix={set} />}
              />
            )
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Pick two stats.</p>
          )}
          {model && legends.length > 0 && <NflMissingNote model={model} />}
          <p className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Hover or tap near a dot; overlapping dots open a chooser.</span>
            <span className="flex items-center gap-1.5 font-pixel text-[8px] uppercase tracking-wider text-muted-foreground/80" aria-hidden="true">
              <span className="inline-block h-1.5 w-1.5 rotate-45 bg-gold" />
              Retro Vault
            </span>
          </p>
        </section>

        {/* Controls */}
        <aside aria-label="Chart controls" className="glass-card space-y-3 p-3 sm:p-4 lg:sticky lg:top-[calc(var(--site-header-h,0px)+1rem)] lg:max-h-[calc(100vh-var(--site-header-h,0px)-2rem)] lg:overflow-y-auto">
          <StatPicker id={`${uid}-x`} label="X axis (across)" value={config.x} onChange={(x) => setAxis({ x })} pairWith={yPositions} />
          <button
            type="button"
            onClick={swap}
            className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md border border-gold/50 bg-gold/10 px-3 font-display text-sm font-bold uppercase tracking-wide text-foreground hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <ArrowUpDown className="h-4 w-4 text-gold" aria-hidden="true" />
            Swap axes
          </button>
          <StatPicker id={`${uid}-y`} label="Y axis (up)" value={config.y} onChange={(y) => setAxis({ y })} pairWith={xPositions} />

          <div className="space-y-1">
            <p className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground" id={`${uid}-pos`}>
              Positions
            </p>
            <div role="group" aria-labelledby={`${uid}-pos`} className="flex flex-wrap gap-1">
              <button
                type="button"
                aria-pressed={config.pos.length === 0}
                onClick={() => set({ pos: [] })}
                className={cn(
                  'min-h-[32px] rounded px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                  config.pos.length === 0 ? 'bg-gold text-night' : 'bg-night/60 text-muted-foreground hover:text-foreground',
                )}
              >
                All
              </button>
              {POSITIONS.map((p) => {
                const ok = applicable.includes(p);
                const on = config.pos.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    disabled={!ok}
                    title={ok ? POSITION_NAMES[p] : `${POSITION_NAMES[p]}: not tracked for these stats`}
                    onClick={() => togglePos(p)}
                    className={cn(
                      'min-h-[32px] rounded px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                      on ? 'bg-gold text-night' : 'bg-night/60 text-muted-foreground hover:text-foreground',
                      !ok && 'cursor-not-allowed opacity-30 line-through',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {applicable.length ? `Showing ${positionsLabel(model?.shown ?? applicable)}. Crossed-out positions don't have both stats.` : 'These stats share no position.'}
            </p>
          </div>

          <LegendsToggle className="w-full justify-start" />

          <div className="rounded-md border border-line/70">
            <button
              type="button"
              aria-expanded={more}
              aria-controls={`${uid}-more`}
              onClick={() => setMore((v) => !v)}
              className="flex min-h-[40px] w-full items-center justify-between gap-2 px-3 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span>
                More options
                {advancedOn > 0 && <span className="ml-1.5 rounded-full bg-gold/20 px-1.5 font-sans text-[10px] normal-case text-gold">{advancedOn} on</span>}
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} aria-hidden="true" />
            </button>
            {more && (
              <div id={`${uid}-more`} className="space-y-3 border-t border-line/70 p-3">
                <StatPicker id={`${uid}-s`} label="Size by" value={config.size ?? ''} onChange={(s) => setAxis({ size: s || undefined })} allowNone />
                <div className="space-y-1">
                  <p className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Colour by</p>
                  <Chips
                    label="Colour by"
                    value={config.color}
                    onChange={(color) => set({ color })}
                    options={[
                      { value: 'team' as ColorBy, label: 'Team' },
                      { value: 'position' as ColorBy, label: 'Position' },
                      { value: 'tier' as ColorBy, label: 'Legacy tier' },
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Team" htmlFor={`${uid}-team`}>
                    <select id={`${uid}-team`} value={config.team ?? ''} onChange={(e) => set({ team: e.target.value || undefined })} className={inputCls}>
                      <option value="">All teams</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Min games" htmlFor={`${uid}-min`}>
                    <select id={`${uid}-min`} value={config.minGames} onChange={(e) => set({ minGames: Number(e.target.value) })} className={inputCls}>
                      {[...new Set([...MIN_GAMES, config.minGames])].sort((a, b) => a - b).map((g) => (
                        <option key={g} value={g}>
                          {g === 0 ? 'Any' : `${g}+`}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-x-2">
                  <CheckField checked={config.splits} onChange={(splits) => set({ splits })}>
                    Quadrants
                  </CheckField>
                  <CheckField checked={!!config.trend} onChange={(trend) => set({ trend })}>
                    Trend line (r)
                  </CheckField>
                  <CheckField checked={mark === 'logos'} onChange={(v) => setMark(v ? 'logos' : 'dots')}>
                    Team logos
                  </CheckField>
                  <CheckField checked={!!config.hof} onChange={(hof) => set({ hof })}>
                    Hall of Famers
                  </CheckField>
                  <CheckField checked={!!config.logX} onChange={(logX) => set({ logX })}>
                    Log X
                  </CheckField>
                  <CheckField checked={!!config.logY} onChange={(logY) => set({ logY })}>
                    Log Y
                  </CheckField>
                </div>
                <button type="button" onClick={() => onChange({ ...DEFAULT_CONFIG, x: config.x, y: config.y, minGames: suggestMinGames([config.x, config.y]) })} className={ghostBtn}>
                  Reset options
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GraphBuilder;
