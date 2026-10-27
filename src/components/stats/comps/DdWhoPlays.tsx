import { useState } from 'react';
import { Hexagon, Swords } from 'lucide-react';
import type { Player } from '@/types/player';
import { SIMILARITY_DEFINITIONS, SIMILARITY_LABELS, type Comp, type SimilarityMode } from '@/config/advanced';
import { isHallOfFamer } from '@/config/stats';
import { fmtFeature } from '@/config/skillGrades';
import { cn } from '@/lib/utils';
import TeamLogo from '../../brand/TeamLogo';
import Chips from '../analytics/Chips';
import { VIZ, fmtNum, ordinal } from '../analytics/viz';
import { keyOf } from '../records';
import CompRadar from './CompRadar';
import { radarPair } from './compColors';
import { MIN_RADAR_AXES, type PositionModel } from './compModel';
import { SmallSampleChip } from './ddParts';
import { isApproxTotals } from './DdRealComps';

type Overlay = 'comp' | 'avg' | 'none';
const AVG_COLOR = 'hsl(226 20% 72%)';
const GOLD = 'hsl(43 100% 62%)';

interface Props {
  player: Player;
  model: PositionModel;
  mode: SimilarityMode;
  onMode: (m: SimilarityMode) => void;
  comps: Comp[];
  /** Top 3 in each mode for the side-by-side cards (Player profile & comps layout). */
  topSets: { mode: SimilarityMode; comps: Comp[] }[];
  /** The comp overlaid on the radar (and highlighted on the map). */
  overlay: Comp | undefined;
  onOverlay: (key: string) => void;
  /** Real NFL comps (both Real-life comps lists, once each): a second group below a divider. Overlay key "nfl:POS:Name". */
  realComps: Comp[];
  ovrMap: Map<string, number>;
  insufficient: boolean;
  onDive: (p: Player) => void;
  onCompare: (a: Player, b: Player) => void;
}

/**
 * "Who plays like him" (the Comp Finder view): style hexagon with the selected comp (or the position average)
 * overlaid, beside the ranked comp list with %, OVR, HOF and mini hexagons. Clicking a comp swaps the overlay.
 */
const DdWhoPlays = ({ player, model, mode, onMode, comps, topSets, overlay, onOverlay, realComps, ovrMap, insufficient, onDive, onCompare }: Props) => {
  const [kind, setKind] = useState<Overlay>('comp');
  const [axis, setAxis] = useState<number | null>(null);
  const hasRadar = !insufficient && model.axes >= MIN_RADAR_AXES;
  const labels = model.features.map((f) => f.label);
  const ok = model.stats.map((s) => s.ok);
  const mine = model.pct(player);
  const colors = radarPair(player.team, overlay?.player.team);
  const avgPct = model.avgPct();
  const second =
    kind === 'comp' && overlay
      ? { label: overlay.player.name, values: model.pct(overlay.player), color: colors.comp, player: overlay.player as Player | null }
      : kind === 'avg'
        ? { label: `${player.position} average`, values: avgPct, color: AVG_COLOR, player: null }
        : null;
  const f = axis != null ? model.features[axis] : null;
  const describe = (i: number) => {
    const ft = model.features[i];
    if (!ok[i]) return `${ft.label}: not enough league data`;
    const a = `${player.name} ${fmtFeature(ft, ft.get(player))}${mine[i] != null ? `, ${ordinal(mine[i] as number)} percentile` : ''}`;
    const b = second?.player ? `; ${second.label} ${fmtFeature(ft, ft.get(second.player))}` : '';
    return `${ft.label}. ${a}${b}. ${ft.definition}`;
  };

  // One ranked comp row (league or real NFL): click overlays him on the hexagon. NFL rows have no Deep Dive or
  // Head-to-Head (league players only), so the action buttons are league-only.
  const compRow = (c: Comp, i: number, nfl: boolean) => {
    const k = keyOf(c.player);
    const okey = nfl ? `nfl:${k}` : k;
    const on = !!overlay && !!overlay.player.isRealLegend === nfl && keyOf(overlay.player) === k;
    const cOvr = ovrMap.get(k);
    return (
      <li
        key={okey}
        className={cn(
          'grid items-center gap-1 rounded-lg border transition-colors',
          nfl ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_auto]',
          on ? 'border-gold/70 bg-panel-2' : 'border-line bg-panel hover:bg-panel-2',
        )}
      >
        <button
          type="button"
          aria-pressed={!!on}
          onClick={() => {
            onOverlay(okey);
            setKind('comp');
          }}
          aria-label={`${i + 1}. ${c.player.name}${nfl ? ', real NFL' : ''}, ${Math.round(c.similarity)}% similar${cOvr != null ? `, OVR ${cOvr}` : ''}. Overlay on the hexagon`}
          className={cn(
            'grid min-w-0 grid-cols-[1.5rem_auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
            nfl ? 'rounded-lg' : 'rounded-l-lg',
          )}
        >
          <span className={cn('font-display text-lg font-extrabold tabular-nums', on ? 'text-gold' : 'text-muted-foreground')}>{i + 1}</span>
          {c.player.team ? <TeamLogo team={c.player.team} size={24} decorative /> : <span className="w-6" />}
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-sm font-semibold">{c.player.name}</span>
              {nfl ? (
                <span className="shrink-0 rounded bg-red-500/15 px-1 font-pixel text-[8px] uppercase text-red-300 ring-1 ring-red-400/40">NFL</span>
              ) : (
                isHallOfFamer(c.player) && <span className="font-pixel text-[8px] text-gold">HOF</span>
              )}
              {c.smallSample && <SmallSampleChip />}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-14 overflow-hidden rounded-sm sm:w-20" style={{ background: VIZ.track }} aria-hidden="true">
                <span className="block h-full rounded-r-[3px]" style={{ width: `${c.similarity}%`, background: on ? GOLD : VIZ.bar }} />
              </span>
              <span className="font-mono text-[11px] tabular-nums text-chalk">{Math.round(c.similarity)}%</span>
            </span>
              {nfl && (
                <span className="truncate text-[10px] leading-tight text-muted-foreground">
                  {[
                    Number.isFinite(mode === 'style' ? c.level : c.style) && `${mode === 'style' ? 'overall' : 'style'} ${Math.round(mode === 'style' ? c.level : c.style)}%`,
                    isApproxTotals(c.player) && 'active, approx. totals',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
          </span>
          <span className="lamp !px-1.5">
            OVR <b>{cOvr ?? '—'}</b>
          </span>
          {hasRadar ? (
            <CompRadar
              mini
              labels={labels}
              axisOk={ok}
              series={[
                { label: player.name, values: mine, color: VIZ.muted },
                { label: c.player.name, values: model.pct(c.player), color: on ? colors.comp : VIZ.bar },
              ]}
              className="hidden h-10 w-10 shrink-0 sm:block"
            />
          ) : (
            <span className="hidden w-10 sm:block" />
          )}
        </button>
        {!nfl && (
        <span className="flex items-center gap-1 pr-1.5">
          <button
            type="button"
            onClick={() => onDive(c.player)}
            className="h-8 rounded-md px-1.5 text-[11px] font-semibold text-muted-foreground hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label={`Deep dive into ${c.player.name}`}
            title={`Deep dive into ${c.player.name}`}
          >
            Dive
          </button>
          <button
            type="button"
            onClick={() => onCompare(player, c.player)}
            className="inline-flex h-8 items-center rounded-md border border-line bg-night/60 px-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label={`Compare ${player.name} and ${c.player.name} in Head-to-Head`}
            title="Compare in Head-to-Head"
          >
            <Swords className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
        )}
      </li>
    );
  };

  const radar = hasRadar ? (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Overlay</span>
        <Chips
          label="Radar overlay"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'comp', label: 'Selected comp' },
            { value: 'avg', label: `${player.position} average` },
            { value: 'none', label: 'None' },
          ]}
        />
      </div>
      <div onMouseLeave={() => setAxis(null)}>
        <CompRadar
          labels={labels}
          axisOk={ok}
          series={[{ label: player.name, values: mine, color: colors.main }, ...(second ? [second] : [])]}
          className="mx-auto block h-auto w-full max-w-[500px]"
          ariaLabel={`${player.name} style hexagon. Each axis is a percentile among ${player.position}s, outward is better. Focus an axis for its numbers.`}
          activeAxis={axis}
          onAxis={setAxis}
          axisDescription={describe}
        />
      </div>
      <ul className="flex flex-wrap justify-center gap-2" aria-label="Legend">
        <li className="inline-flex items-center gap-2 rounded-full border border-line bg-night/60 py-1 pl-1.5 pr-3 text-sm font-semibold">
          <span className="h-3 w-5 rounded-sm" style={{ background: colors.main }} aria-hidden="true" />
          {player.name}
        </li>
        {second && (
          <li className="inline-flex items-center gap-2 rounded-full border border-line bg-night/60 py-1 pl-1.5 pr-3 text-sm font-semibold">
            <span className="h-0 w-5 border-t-[3px] border-dashed" style={{ borderColor: second.color }} aria-hidden="true" />
            {second.label}
            {kind === 'comp' && overlay && <span className="font-mono text-xs text-muted-foreground">{Math.round(overlay.similarity)}%</span>}
          </li>
        )}
      </ul>
      <div className="min-h-[7.5rem] rounded-lg border border-line/70 bg-night/50 p-3" aria-live="polite">
        {f && axis != null ? (
          <div className="space-y-1.5">
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-display text-lg font-bold uppercase text-gold">{f.label}</span>
              {f.lowerIsBetter && <span className="text-[11px] text-muted-foreground">lower is better (flipped)</span>}
            </p>
            <p className="text-xs text-muted-foreground">{f.definition}</p>
            {ok[axis] ? (
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <th scope="row" className="py-0.5 text-left font-semibold" style={{ color: colors.main }}>
                      {player.name}
                    </th>
                    <td className="text-right font-mono tabular-nums">{fmtFeature(f, f.get(player))}</td>
                    <td className="w-14 text-right font-mono text-xs tabular-nums text-muted-foreground">{mine[axis] != null ? ordinal(mine[axis] as number) : '—'}</td>
                  </tr>
                  {second?.player && (
                    <tr>
                      <th scope="row" className="py-0.5 text-left font-semibold" style={{ color: second.color }}>
                        {second.label}
                      </th>
                      <td className="text-right font-mono tabular-nums">{fmtFeature(f, f.get(second.player))}</td>
                      <td className="w-14 text-right font-mono text-xs tabular-nums text-muted-foreground">{second.values[axis] != null ? ordinal(second.values[axis] as number) : '—'}</td>
                    </tr>
                  )}
                  <tr>
                    <th scope="row" className="py-0.5 text-left font-normal text-muted-foreground">
                      {player.position} average
                    </th>
                    <td className="text-right font-mono tabular-nums text-muted-foreground">{fmtFeature(f, model.stats[axis].mean)}</td>
                    <td className="w-14 text-right font-mono text-xs tabular-nums text-muted-foreground">{avgPct[axis] != null ? ordinal(avgPct[axis] as number) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Too few league {player.position}s have this rate recorded to rank it (n/a).</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Hover, tap or focus an axis label to see the actual numbers behind it.</p>
        )}
      </div>
    </div>
  ) : (
    <div role="status" className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line p-6 text-center">
      <Hexagon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      {insufficient ? (
        <>
          <p className="font-display text-lg font-bold uppercase">Insufficient data</p>
          <p className="max-w-sm text-sm text-muted-foreground">Too few of {player.name}&rsquo;s rates are recorded to draw his shape or find comps.</p>
        </>
      ) : (
        <>
          <p className="font-display text-lg font-bold uppercase">No hexagon for {player.position}s</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {player.position} style is {model.features.length === 1 ? `a single rate (${model.features[0].label})` : `only ${model.axes} usable rates`}, so there is no shape to draw. The comps
            beside still rank by it.
          </p>
        </>
      )}
    </div>
  );

  const cards = (
    <div className="glass-card space-y-3 p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2">
        {topSets.map(({ mode: m, comps: cs }) => (
          <div key={m} className="space-y-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground" title={SIMILARITY_DEFINITIONS[m]}>
              {SIMILARITY_LABELS[m]}
            </h3>
            {cs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {insufficient ? 'Insufficient data: too few of his rates are recorded to compare.' : m === 'style' ? `Not enough shared rates for a style match at ${player.position}.` : `Not enough ${player.position}s to compare.`}
              </p>
            ) : (
              <ol className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                {cs.map((c) => (
                  <li key={keyOf(c.player)}>
                    <button
                      type="button"
                      onClick={() => onDive(c.player)}
                      aria-label={`${c.player.name}, ${m === 'style' ? 'style match' : 'similarity'} ${Math.round(c.similarity)} of 100. Deep dive into him`}
                      className="hover-lift flex h-full w-full flex-col gap-1 rounded-lg border border-line bg-panel p-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {c.player.team && <TeamLogo team={c.player.team} size={18} decorative />}
                        <span className="truncate text-sm font-semibold">{c.player.name}</span>
                      </span>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-2xl font-extrabold leading-none text-chalk">{Math.round(c.similarity)}</span>
                        <span className="font-pixel text-[8px] uppercase text-muted-foreground">{m === 'style' ? 'style match' : 'similarity'}</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.player.games} G · TPG {fmtNum(c.player.tpg, 2)}
                        {c.smallSample && <span className="ml-1 text-gold">· small sample</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Both scores (0–100) use rates z-scored within the position: {labels.join(', ')}. Career length, totals and True Talent are left out. Plays like asks whether he is above or below the
        position average in the same places (what the hexagon shows); closest overall needs the numbers to match too (~60 = about one standard deviation apart on average).
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
    {cards}
    <div className="glass-card grid grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {radar}

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground" title={SIMILARITY_DEFINITIONS[mode]}>
            Top comps
          </h3>
          <Chips
            label="Similarity mode"
            value={mode}
            onChange={onMode}
            options={(['style', 'level'] as const).map((m) => ({ value: m, label: m === 'style' ? 'Plays like' : 'Closest overall', title: `${SIMILARITY_LABELS[m]}: ${SIMILARITY_DEFINITIONS[m]}` }))}
          />
        </div>
        {comps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted-foreground">
            {insufficient
              ? 'Insufficient data: too few of his rates are recorded to compare.'
              : mode === 'style'
                ? `Style matching needs at least 4 shared rates; ${player.position}s don't have enough. Try "Closest overall".`
                : `No other ${player.position}s to compare with.`}
          </p>
        ) : (
          <ol className="space-y-1.5" aria-label={`Most similar ${player.position}s to ${player.name}`}>
            {comps.map((c, i) => compRow(c, i, false))}
          </ol>
        )}
        {realComps.length > 0 && (
          <>
            <div className="mt-1 flex items-center gap-2" role="separator" aria-label="Real NFL">
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
              <span className="inline-flex items-center gap-1.5 font-pixel text-[9px] uppercase text-red-300">Real NFL</span>
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
            </div>
            <ol className="space-y-1.5" aria-label={`Real NFL ${player.position}s most like ${player.name}`}>
              {[...realComps]
                .sort((x, y) => (Number.isFinite(y[mode]) ? y[mode] : -1) - (Number.isFinite(x[mode]) ? x[mode] : -1))
                .map((c, i) => compRow({ ...c, similarity: Number.isFinite(c[mode]) ? c[mode] : 0 }, i, true))}
            </ol>
          </>
        )}
        <p className="mt-auto text-[11px] text-muted-foreground">
          Click a comp to overlay him on the hexagon; mini hexagons show the comp (colour) over {player.name.split(' ').slice(-1)[0]} (grey). Dive opens his report; the swords send the pair to
          Head-to-Head.
        </p>
      </div>
    </div>
    </div>
  );
};

export default DdWhoPlays;
