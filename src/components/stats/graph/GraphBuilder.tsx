import { useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, BarChart3, Check, Link2, Pin, SlidersHorizontal, Table2 } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { POSITIONS } from '@/config/advanced';
import { cn } from '@/lib/utils';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { NFL_TEAMS, findNFLTeam } from '@/utils/nflTeams';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Chips from '../analytics/Chips';
import LegendsToggle from '../visual/LegendsToggle';
import { buildHash } from '../hub/hashRoute';
import { TRY_THESE, applicablePositions, buildGraph, configToParams, type ColorBy, type GraphConfig } from './graphConfig';
import { GRAPH_STATS, STAT_BY_ID, STAT_GROUPS, type GraphDeps } from './graphStats';
import { graphSummary } from './graphText';
import { GraphLegend, GraphPlot, GraphTable } from './GraphParts';

type Mark = 'dots' | 'logos';
const MIN_GAMES = [0, 8, 16, 32, 64, 100];

const selectCls =
  'h-9 w-full min-w-0 rounded-md border border-line bg-night px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

const Field = ({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) => (
  <div className="min-w-0 space-y-1">
    <label htmlFor={htmlFor} className="block font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
  </div>
);

const StatSelect = ({ id, value, onChange, allowNone }: { id: string; value: string; onChange: (v: string) => void; allowNone?: boolean }) => (
  <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
    {allowNone && <option value="">None</option>}
    {STAT_GROUPS.map((g) => (
      <optgroup key={g} label={g}>
        {GRAPH_STATS.filter((s) => s.group === g).map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
            {s.positions.length < POSITIONS.length ? ` (${s.positions.length > 3 ? `${s.positions.length} pos` : s.positions.join('/')})` : ''}
          </option>
        ))}
      </optgroup>
    ))}
  </select>
);

const CheckField = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) => (
  <label className="inline-flex min-h-[32px] cursor-pointer items-center gap-2 text-sm">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(43_100%_62%)]" />
    {children}
  </label>
);

const statHint = (id: string) => {
  const s = STAT_BY_ID.get(id);
  if (!s) return undefined;
  return `${s.definition} ${s.lowerIsBetter ? 'Lower is better.' : ''}`.trim();
};

/**
 * Graph Builder: any stat against any stat as a scatter, with filters, bubble size, colour modes, log axes, a
 * trend line with r, quadrant names, a player search, a table view, a shareable link and saved presets.
 * Dialog on desktop, full-screen sheet on phones.
 */
const GraphBuilder = ({
  open,
  config,
  onChange,
  onClose,
  players,
  legends,
  deps,
  onSelect,
  onSavePreset,
}: {
  open: boolean;
  config: GraphConfig;
  onChange: (c: GraphConfig) => void;
  onClose: () => void;
  players: Player[];
  legends: Player[];
  deps: GraphDeps;
  onSelect: (p: Player) => void;
  onSavePreset: (name: string, c: GraphConfig) => void;
}) => {
  const uid = useId();
  const [mark, setMark] = useState<Mark>('dots');
  const [asTable, setAsTable] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const model = useMemo(() => buildGraph(config, players, legends, deps), [config, players, legends, deps]);
  const applicable = applicablePositions(config);
  const set = (patch: Partial<GraphConfig>) => {
    setSaved(false);
    // Fixed-chart extras (titles, custom quadrants) don't carry over once the axes change.
    const axesChanged = (patch.x && patch.x !== config.x) || (patch.y && patch.y !== config.y);
    onChange({ ...config, ...(axesChanged ? { title: undefined, subtitle: undefined, quadrants: undefined, diagonal: undefined, xSplit: undefined, ySplit: undefined, qualifyBy: undefined } : {}), ...patch });
  };
  const togglePos = (p: Position) => set({ pos: config.pos.includes(p) ? config.pos.filter((x) => x !== p) : [...config.pos, p] });
  const teams = useMemo(
    () => NFL_TEAMS.filter((t) => players.some((p) => findNFLTeam(p.team)?.id === t.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  const highlight = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2 || !model) return null;
    return model.points.find((p) => p.player.name.toLowerCase().includes(q))?.key ?? null;
  }, [search, model]);
  const title = model ? (config.title ?? `${model.ys.label} vs ${model.xs.label}`) : 'Graph Builder';

  const link = () => `${window.location.origin}${window.location.pathname}${buildHash({ tab: 'career', sub: 'players', q: configToParams(config) })}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', link());
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          'flex max-h-[94vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden border-line bg-panel p-0',
          'max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none',
        )}
      >
        <div className="border-b border-line px-4 py-3 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-extrabold italic uppercase leading-none">
            <SlidersHorizontal className="h-5 w-5 text-gold" aria-hidden="true" />
            Graph Builder
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Pick any two stats for an instant scatter. Medians, quadrants and the trend use league players only.
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-pixel text-[8px] uppercase text-muted-foreground">Try these</span>
            {TRY_THESE.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.config)}
                className="rounded-full border border-line bg-night/60 px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:border-gold/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[19rem_minmax(0,1fr)] lg:overflow-hidden">
          {/* Controls */}
          <div className="space-y-3 p-4 lg:overflow-y-auto lg:border-r lg:border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <Field label="X axis" htmlFor={`${uid}-x`}>
                <StatSelect id={`${uid}-x`} value={config.x} onChange={(x) => set({ x })} />
              </Field>
              <button
                type="button"
                onClick={() => set({ x: config.y, y: config.x, logX: config.logY, logY: config.logX })}
                className="mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-night/60 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                aria-label="Swap X and Y"
                title="Swap X and Y"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">{statHint(config.x)}</p>
            <Field label="Y axis" htmlFor={`${uid}-y`} hint={statHint(config.y)}>
              <StatSelect id={`${uid}-y`} value={config.y} onChange={(y) => set({ y })} />
            </Field>
            <Field label="Size by (optional)" htmlFor={`${uid}-s`}>
              <StatSelect id={`${uid}-s`} value={config.size ?? ''} onChange={(s) => set({ size: s || undefined })} allowNone />
            </Field>

            <div className="space-y-1">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground" id={`${uid}-pos`}>
                Positions {config.pos.length === 0 && <span className="font-sans text-[11px] normal-case">(all that apply)</span>}
              </p>
              <div role="group" aria-labelledby={`${uid}-pos`} className="flex flex-wrap gap-1">
                {POSITIONS.map((p) => {
                  const ok = applicable.includes(p);
                  const on = config.pos.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      disabled={!ok}
                      title={ok ? POSITION_NAMES[p] : `${POSITION_NAMES[p]}: not available for these stats`}
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
              {applicable.length === 0 && <p className="text-xs text-flag">These stats share no position. Pick another pair.</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Team" htmlFor={`${uid}-team`}>
                <select id={`${uid}-team`} value={config.team ?? ''} onChange={(e) => set({ team: e.target.value || undefined })} className={selectCls}>
                  <option value="">All teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Min games" htmlFor={`${uid}-min`}>
                <select id={`${uid}-min`} value={config.minGames} onChange={(e) => set({ minGames: Number(e.target.value) })} className={selectCls}>
                  {MIN_GAMES.map((g) => (
                    <option key={g} value={g}>
                      {g === 0 ? 'Any' : `${g}+`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

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

            <div className="grid grid-cols-2 gap-x-2">
              <CheckField checked={!!config.hof} onChange={(hof) => set({ hof })}>
                Hall of Famers only
              </CheckField>
              <CheckField checked={config.splits} onChange={(splits) => set({ splits })}>
                Medians &amp; quadrants
              </CheckField>
              <CheckField checked={!!config.trend} onChange={(trend) => set({ trend })}>
                Trend line (r)
              </CheckField>
              <CheckField checked={mark === 'logos'} onChange={(v) => setMark(v ? 'logos' : 'dots')}>
                Team logos
              </CheckField>
              <CheckField checked={!!config.logX} onChange={(logX) => set({ logX })}>
                Log X
              </CheckField>
              <CheckField checked={!!config.logY} onChange={(logY) => set({ logY })}>
                Log Y
              </CheckField>
            </div>
            <LegendsToggle />

            <Field label="Find a player" htmlFor={`${uid}-q`} hint={search.trim().length >= 2 ? (highlight ? 'Ringed and labelled in gold.' : 'Not on this chart.') : undefined}>
              <input
                id={`${uid}-q`}
                type="search"
                value={search}
                list={`${uid}-names`}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name…"
                className={selectCls}
              />
              <datalist id={`${uid}-names`}>
                {model?.points.map((p) => <option key={p.key} value={p.player.name} />)}
              </datalist>
            </Field>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-night/60 px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied ? 'Link copied' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt('Name this preset', title);
                  if (name && name.trim()) {
                    onSavePreset(name.trim(), config);
                    setSaved(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-gold px-2.5 py-1.5 text-xs font-bold text-night hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              >
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                {saved ? 'Pinned to the Lab' : 'Save as preset'}
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="order-first min-w-0 space-y-2 border-b border-line p-4 lg:order-none lg:overflow-y-auto lg:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-xl font-extrabold italic uppercase leading-tight sm:text-2xl">{title}</h3>
                {model && <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">{graphSummary(model)}</p>}
              </div>
              <button
                type="button"
                aria-pressed={asTable}
                onClick={() => setAsTable((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-night/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {asTable ? <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Table2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {asTable ? 'Chart' : 'Table'}
              </button>
            </div>
            {model && <GraphLegend model={model} color={config.color} />}
            {model ? (
              asTable ? (
                <GraphTable model={model} onSelect={onSelect} />
              ) : (
                <GraphPlot model={model} logos={mark === 'logos'} onSelect={onSelect} highlightKey={highlight} />
              )
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Pick two stats.</p>
            )}
            <p className="flex items-center justify-end gap-1.5 font-pixel text-[8px] uppercase tracking-wider text-muted-foreground/80" aria-hidden="true">
              <span className="inline-block h-1.5 w-1.5 rotate-45 bg-gold" />
              Retro Vault · League data
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GraphBuilder;
