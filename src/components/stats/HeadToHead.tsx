import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Swords, Users } from 'lucide-react';
import type { LeagueData, Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SIMILARITY_DEFINITIONS, SIMILARITY_LABELS, buildContext, compFeatureLabels, leaguePlayers } from '@/config/advanced';
import { isHallOfFamer } from '@/config/stats';
import { findNFLTeam } from '@/utils/nflTeams';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { getMetricTier, getTierColor, getTierLabel } from '@/utils/metricColors';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import PlayerSearchSelect from '../PlayerSearchSelect';
import ProPlayerBanner from '../brand/ProPlayerBanner';
import CountUp from '../brand/CountUp';
import TeamLogo from '../brand/TeamLogo';
import MetricLabel from './analytics/MetricLabel';
import { VIZ, fmtNum } from './analytics/viz';
import { keyOf } from './records';
import { onHeadToHeadRequest, takeHeadToHeadRequest } from './comps/compFinderLink';
import { LEAGUE_DEFS, buildMatchup, type Cell, type Matchup, type Row, type Side } from './matchup';

type Select = (p: Player) => void;

const useWide = () => {
  const query = '(min-width: 640px)';
  const [wide, setWide] = useState(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
};

const valueText = (cell: Cell, row: Row) => (cell.value == null || !Number.isFinite(cell.value) ? '—' : `${fmtNum(cell.value, row.decimals)}${row.suffix ?? ''}`);

// ---------- Hero ----------

const HeroCard = ({
  side,
  player,
  options,
  onChange,
  onSelect,
  wide,
}: {
  side: Side;
  player: Player | null;
  options: Player[];
  onChange: (key: string) => void;
  onSelect: Select;
  wide: boolean;
}) => {
  const ovrMap = useOfficialOvr();
  const { numberFor, retiredInfo } = useJerseyNumbers();
  const team = findNFLTeam(player?.team);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <PlayerSearchSelect showOvr
        players={options}
        value={player ? keyOf(player) : ''}
        onValueChange={(v) => v && onChange(v)}
        placeholder="Search for a player..."
        ariaLabel={`Player ${side}`}
      />
      {player ? (
        <button
          type="button"
          onClick={() => onSelect(player)}
          aria-label={`Open ${player.name}'s player card`}
          className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ProPlayerBanner
            size={wide ? 'hero' : 'card'}
            name={player.name}
            nickname={player.nickname}
            position={player.position}
            team={team ?? player.team}
            number={numberFor(player)}
            ovr={ovrMap.get(keyOf(player)) ?? null}
            hallOfFamer={isHallOfFamer(player)}
            retiredBy={retiredInfo(player)?.teamLabel ?? null}
            eyebrow={`${POSITION_NAMES[player.position]}${team ? ` · ${team.conference} ${team.division}` : ''}`}
            interactive
          />
        </button>
      ) : (
        <div className="flex min-h-[11.5rem] items-center justify-center rounded-xl border-2 border-dashed border-line p-6 text-center text-sm text-muted-foreground sm:min-h-[17rem]">
          Pick a player to load their card.
        </div>
      )}
      {player && (
        <div className="flex flex-wrap gap-1.5" aria-label={`${player.name} career summary`}>
          <span className="lamp">
            Legacy <b>{fmtNum(player.careerLegacy, 0)}</b>
          </span>
          <span className="lamp">
            Rings <b>{player.rings}</b>
          </span>
          <span className="lamp">
            MVP <b>{player.mvp}</b>
          </span>
          <span className="lamp">
            GP <b>{player.games}</b>
          </span>
        </div>
      )}
    </div>
  );
};

// ---------- Rows ----------

/** Two bars growing out from the middle, sized against the larger magnitude. Leader in gold. */
const SplitBar = ({ row }: { row: Row }) => {
  const pick = (c: Cell) => (c.belowMin ? null : row.cmpHigherIsBetter ? c.cmp ?? null : c.value);
  const a = pick(row.a);
  const b = pick(row.b);
  const max = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0));
  const w = (v: number | null) => (max > 0 && v != null && Number.isFinite(v) ? `${Math.max((Math.abs(v) / max) * 100, v === 0 ? 0 : 3)}%` : '0%');
  const fill = (v: number | null, lead: boolean) => (v != null && v < 0 ? `rgb(${VIZ.below})` : lead ? 'hsl(var(--gold))' : 'hsl(var(--line))');
  return (
    <div aria-hidden="true" className="mx-auto mt-1.5 grid max-w-[14rem] grid-cols-2 gap-[2px]">
      <div className="flex h-1.5 justify-end overflow-hidden rounded-l-sm bg-night">
        <div className="h-full rounded-l-[4px] motion-safe:transition-[width] motion-safe:duration-500" style={{ width: w(a), background: fill(a, row.leader === 1) }} />
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-r-sm bg-night">
        <div className="h-full rounded-r-[4px] motion-safe:transition-[width] motion-safe:duration-500" style={{ width: w(b), background: fill(b, row.leader === 2) }} />
      </div>
    </div>
  );
};

const ValueCell = ({ row, cell, side, lead }: { row: Row; cell: Cell; side: Side; lead: boolean }) => {
  const align = side === 1 ? 'text-right' : 'text-left';
  if (cell.belowMin) {
    return (
      <td className={cn('px-2 py-2 align-middle sm:px-4', align)}>
        <span className="font-pixel text-[9px] uppercase leading-tight text-muted-foreground">below min sample</span>
        {row.def && <span className="block text-[10px] text-muted-foreground">{row.def.minLabel}</span>}
      </td>
    );
  }
  const text = valueText(cell, row);
  const tier = cell.tierKey && cell.value != null ? getMetricTier(cell.value, cell.tierKey) : null;
  const number = (
    <span className={cn('font-mono text-base font-bold tabular-nums sm:text-lg', lead ? 'text-gold' : 'text-chalk')}>{text}</span>
  );
  return (
    <td className={cn('px-2 py-2 align-middle sm:px-4', align)}>
      <span className={cn('inline-flex items-center gap-1.5', side === 1 ? 'flex-row' : 'flex-row-reverse')}>
        {lead && (
          <>
            <Check className="h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
            <span className="sr-only">Leads: </span>
          </>
        )}
        {cell.hover ? (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="cursor-help rounded-sm underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                {number}
                <span className="sr-only"> ({cell.hover})</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="border-line bg-popover text-xs">
              {cell.hover}
            </TooltipContent>
          </Tooltip>
        ) : (
          number
        )}
      </span>
      {cell.sub && (
        <span className="block font-mono text-[10px] leading-tight text-muted-foreground tabular-nums sm:text-[11px]">
          <span aria-hidden={cell.subLabel ? true : undefined}>{cell.sub}</span>
          {cell.subLabel && <span className="sr-only">{cell.subLabel}</span>}
        </span>
      )}
      {tier && cell.tierKey && (
        <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: getTierColor(tier) }}>
          {getTierLabel(tier, cell.tierKey)}
        </span>
      )}
    </td>
  );
};

const LEGACY_PARTS = [
  { key: 'talent', label: 'Talent', color: VIZ.series[0] },
  { key: 'awards', label: 'Awards', color: VIZ.series[1] },
  { key: 'longevity', label: 'Longevity', color: VIZ.series[2] },
] as const;

/** Two stacked bars on one scale. Decorative: the same numbers are in the rows below. */
const LegacyBars = ({ p1, p2, m }: { p1: Player; p2: Player; m: Matchup }) => {
  const max = Math.max(m.legacy[0].total, m.legacy[1].total, 1);
  return (
    <div className="space-y-2 px-3 py-3 sm:px-6">
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-secondary-foreground" aria-hidden="true">
        {LEGACY_PARTS.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label}
          </li>
        ))}
      </ul>
      {[p1, p2].map((p, i) => {
        const mix = m.legacy[i];
        return (
          <div key={keyOf(p)} className="grid grid-cols-[minmax(0,6rem)_1fr] items-center gap-2 sm:grid-cols-[minmax(0,10rem)_1fr]" aria-hidden="true">
            <span className="truncate text-xs font-semibold sm:text-sm">{p.name}</span>
            <span className="flex items-center gap-2">
              <span className="flex h-3.5 gap-[2px] motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${(mix.total / max) * 100}%` }}>
                {LEGACY_PARTS.filter((part) => mix[part.key] > 0).map((part, j, shown) => (
                  <span
                    key={part.key}
                    title={`${part.label} ${fmtNum(mix[part.key], 0)}`}
                    className={j === shown.length - 1 ? 'rounded-r-[4px]' : undefined}
                    style={{ flex: `${mix[part.key]} 1 0px`, background: part.color, minWidth: 2 }}
                  />
                ))}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-secondary-foreground">{fmtNum(mix.total, 0)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** Headline "plays like" banner: style similarity (shape of their per-game profile) big, level + style as the secondary read. */
const SimilarityBlock = ({ p1, p2, m }: { p1: Player; p2: Player; m: Matchup }) => {
  if (m.similarity == null) return null;
  const style = m.styleSimilarity;
  const headline = style ?? m.similarity;
  const verdict = headline >= 85 ? 'Near clones' : headline >= 70 ? 'Very similar' : headline >= 50 ? 'Some overlap' : headline >= 25 ? 'Different styles' : 'Opposites';
  return (
    <section aria-label="How alike they play" className="border-b border-line bg-gradient-to-b from-gold/10 to-transparent px-3 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center sm:flex-row sm:gap-6 sm:text-left">
        <div className="flex shrink-0 flex-col items-center">
          <span className="font-pixel text-[10px] uppercase text-gold" title={SIMILARITY_DEFINITIONS.style}>
            {style != null ? 'Plays like' : SIMILARITY_LABELS.level}
          </span>
          <span className="font-display text-6xl font-extrabold italic leading-none tabular-nums text-chalk sm:text-7xl">
            <CountUp value={Math.round(headline)} />
            <span className="text-2xl text-gold sm:text-3xl">%</span>
          </span>
        </div>
        <div className="w-full min-w-0 space-y-2">
          <p className="font-display text-xl font-bold uppercase leading-tight sm:text-2xl">
            {verdict}
            <span className="block text-sm font-semibold normal-case text-secondary-foreground sm:text-base">
              {p1.name} and {p2.name}
            </span>
          </p>
          <div
            role="meter"
            aria-label={`${style != null ? 'Play-style' : 'Overall'} similarity between ${p1.name} and ${p2.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(headline)}
            className="h-3 w-full overflow-hidden rounded-sm"
            style={{ background: VIZ.track }}
          >
            <div className="h-full rounded-r-[4px] bg-gold motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${Math.max(headline, 1.5)}%` }} />
          </div>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-start">
            {style != null && (
              <span title={SIMILARITY_DEFINITIONS.level}>
                {SIMILARITY_LABELS.level}: <b className="tabular-nums text-chalk">{fmtNum(m.similarity, 0)}%</b>
              </span>
            )}
            <span>Compared on: {compFeatureLabels(p1.position).join(', ')}</span>
          </p>
        </div>
      </div>
    </section>
  );
};

// ---------- Section ----------

/**
 * Head-to-Head: two league players side by side across career, league metrics, position stats, every
 * applicable advanced metric (with + index and percentile), legacy composition and similarity.
 */
const HeadToHead = ({ data, onSelect }: { data: LeagueData; onSelect: Select }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const ctx = useMemo(() => buildContext(players), [players]);
  const ovrMap = useOfficialOvr();
  const wide = useWide();
  const sorted = useMemo(() => [...players].sort((a, b) => b.careerLegacy - a.careerLegacy), [players]);
  const byKey = useMemo(() => new Map(players.map((p) => [keyOf(p), p])), [players]);

  // Starts empty: the user picks both players.
  const [k1, setK1] = useState('');
  const [k2, setK2] = useState('');
  // "Compare in Head-to-Head" hand-off (e.g. from the Deep Dive), possibly sent before this view mounted.
  useEffect(() => {
    const apply = () => {
      const req = takeHeadToHeadRequest();
      if (!req) return;
      setK1(req.a);
      setK2(req.b);
    };
    apply();
    return onHeadToHeadRequest(apply);
  }, []);

  const p1 = byKey.get(k1) ?? null;
  const p2 = byKey.get(k2) ?? null;
  const options1 = useMemo(() => sorted.filter((p) => keyOf(p) !== k2), [sorted, k2]);
  const options2 = useMemo(() => sorted.filter((p) => keyOf(p) !== k1), [sorted, k1]);

  const m = useMemo(() => (p1 && p2 ? buildMatchup(players, ctx, p1, p2, ovrMap) : null), [players, ctx, p1, p2, ovrMap]);

  if (players.length < 2) return null;

  const swap = () => {
    setK1(k2);
    setK2(k1);
  };
  const leader = m && p1 && p2 ? (m.score[1] > m.score[2] ? p1 : m.score[2] > m.score[1] ? p2 : null) : null;

  return (
    <section id="head-to-head" aria-labelledby="h2h-title" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <p className="font-pixel text-[10px] uppercase text-gold">Featured matchup</p>
        <h2 id="h2h-title" className="flex items-center gap-2 font-display text-4xl font-extrabold italic uppercase leading-none sm:text-5xl">
          <Swords className="h-7 w-7 text-gold sm:h-8 sm:w-8" aria-hidden="true" />
          Head-to-<span className="text-gold">Head</span>
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Any two league players, every stat that applies to both. Advanced metrics show the + index (100 = position average) and the percentile within
          the position; hover or focus an underlined metric for its definition.
        </p>
      </div>

      <div className="glass-card relative overflow-hidden p-3 sm:p-5" style={{ boxShadow: 'inset 0 4px 0 hsl(var(--gold)), var(--shadow-card)' }}>
        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-5">
          <HeroCard side={1} player={p1} options={options1} onChange={setK1} onSelect={onSelect} wide={wide} />
          <div className="flex items-center justify-center gap-3 md:mt-28 md:flex-col">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gold bg-black font-display text-xl font-extrabold italic text-gold shadow-glow sm:h-14 sm:w-14 sm:text-2xl"
            >
              VS
            </span>
            <Button type="button" variant="outline" size="sm" onClick={swap} disabled={!k1 && !k2} className="gap-1.5 border-line">
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
              Swap
            </Button>
          </div>
          <HeroCard side={2} player={p2} options={options2} onChange={setK2} onSelect={onSelect} wide={wide} />
        </div>
      </div>

      {m && p1 && p2 ? (
        // overflow-clip (not hidden) so the scoreboard below can stay sticky
        <div className="glass-card overflow-clip">
          {/* Scoreboard: pinned under the site header while scrolling the rows, so each side stays labelled */}
          <div
            className="scoreboard-strip sticky z-30 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line bg-night/95 px-3 py-2.5 backdrop-blur-md sm:px-6"
            style={{ top: 'var(--site-header-h, 0px)' }}
          >
            <span className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-right font-display text-sm font-bold uppercase sm:text-xl">{p1.name}</span>
              <span className="hidden font-pixel text-[9px] text-muted-foreground sm:inline">{p1.position}</span>
              <TeamLogo team={p1.team} size={22} decorative />
            </span>
            <div className="flex items-center gap-2 rounded bg-black px-3 py-1.5 font-display text-3xl font-extrabold tabular-nums sm:text-4xl" aria-live="polite" aria-atomic="true">
              <span className="sr-only">Categories won: {p1.name}</span>
              <span className={m.score[1] >= m.score[2] ? 'text-gold' : 'text-muted-foreground'}>
                <CountUp value={m.score[1]} />
              </span>
              <span className="text-muted-foreground" aria-hidden="true">
                –
              </span>
              <span className="sr-only">, {p2.name}</span>
              <span className={m.score[2] >= m.score[1] ? 'text-gold' : 'text-muted-foreground'}>
                <CountUp value={m.score[2]} />
              </span>
            </div>
            <span className="flex min-w-0 items-center gap-2">
              <TeamLogo team={p2.team} size={22} decorative />
              <span className="hidden font-pixel text-[9px] text-muted-foreground sm:inline">{p2.position}</span>
              <span className="truncate font-display text-sm font-bold uppercase sm:text-xl">{p2.name}</span>
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5 border-b border-line px-3 py-2 text-center text-sm">
            <p>
              <span className="font-pixel text-[10px] uppercase text-muted-foreground">Categories won · </span>
              {leader ? <span className="font-semibold text-gold">{leader.name} leads</span> : <span className="font-semibold text-chalk">Dead even</span>}
            </p>
            <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Categories won by section">
              {m.tallies.map((t) => (
                <li key={t.id} className="lamp">
                  {t.short}{' '}
                  <b>
                    {t.a}–{t.b}
                  </b>
                </li>
              ))}
            </ul>
          </div>

          <SimilarityBlock p1={p1} p2={p2} m={m} />

          {!m.sameFamily || !m.samePosition ? (
            <p className="border-b border-line bg-panel-2/50 px-4 py-2 text-center text-xs text-muted-foreground">
              {!m.sameFamily
                ? `Cross-position matchup (${p1.position} vs ${p2.position}): only universal rows are compared — career, awards, league metrics, the advanced metrics that apply to both positions (judged by percentile within each position) and legacy composition. Position stats and similarity need the same position.`
                : `${p1.position} vs ${p2.position}: position stats compare directly; advanced metrics are judged by percentile within each position, and similarity needs the same position.`}
            </p>
          ) : null}

          <table className="mx-auto w-full max-w-4xl table-fixed text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <caption className="sr-only">
              {p1.name} compared with {p2.name}. Leading values are marked.
            </caption>
            <colgroup>
              <col className="w-[33%]" />
              <col className="w-[34%]" />
              <col className="w-[33%]" />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th scope="col">{p1.name}</th>
                <th scope="col">Stat</th>
                <th scope="col">{p2.name}</th>
              </tr>
            </thead>
            {m.sections.map((sec) => (
              <tbody key={sec.id}>
                <tr>
                  <th colSpan={3} scope="colgroup" className="bg-panel-2 px-4 py-1.5 text-center font-pixel text-[10px] font-normal uppercase text-gold">
                    {sec.title}
                  </th>
                </tr>
                {sec.note && (
                  <tr>
                    <td colSpan={3} className="px-4 pt-2 text-center text-[11px] text-muted-foreground">
                      {sec.note}
                    </td>
                  </tr>
                )}
                {sec.id === 'legacy' && (
                  <tr>
                    <td colSpan={3}>
                      <LegacyBars p1={p1} p2={p2} m={m} />
                    </td>
                  </tr>
                )}
                {sec.rows.map((row) => (
                  <tr key={`${sec.id}:${row.id}`} className="border-b border-border/40 last:border-b-0">
                    <ValueCell row={row} cell={row.a} side={1} lead={row.leader === 1} />
                    <th scope="row" className="px-1 py-2 text-center align-middle font-normal">
                      {row.def ? (
                        <MetricLabel
                          metric={row.def}
                          className="mx-auto justify-center text-center font-display text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm"
                        />
                      ) : (
                        <span className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm">{row.label}</span>
                      )}
                      {row.lowerIsBetter && <span className="block text-[9px] text-muted-foreground">lower is better</span>}
                      {row.note && <span className="block text-[9px] text-muted-foreground">{row.note}</span>}
                      <SplitBar row={row} />
                    </th>
                    <ValueCell row={row} cell={row.b} side={2} lead={row.leader === 2} />
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-line p-8 text-center sm:p-12">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-display text-2xl font-bold uppercase">Select two players</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Use the search boxes above to set up a head-to-head.</p>
        </div>
      )}
    </section>
  );
};

export default HeadToHead;
