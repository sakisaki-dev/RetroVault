import { ArrowRight, Crown, Gauge, Timer } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import PositionBadge from '../PositionBadge';
import TeamBadge from '../brand/TeamBadge';
import TeamLogo from '../brand/TeamLogo';
import CountUp from '../brand/CountUp';
import { GROUP_META, MIN, PACE_MAX_SEASONS, keyOf, type PaceEntry, type RecordBoardData } from './records';
import { GRID_ITEM, gridVars } from './grid';

const fmt = (v: number, decimals: number) => formatDecimal(v, decimals);

type Select = (p: Player) => void;

// ---------- Compact record strip (top of the page) ----------

const RecordChip = ({ data, index, onSelect }: { data: RecordBoardData; index: number; onSelect: Select }) => {
  const top = data.entries[0];
  const hsl = GROUP_META[data.group].hsl;
  return (
    <li className={cn(GRID_ITEM, 'stagger-in')} style={{ ['--i' as string]: index }}>
      <button
        type="button"
        onClick={() => onSelect(top.player)}
        aria-label={`${data.title} record: ${fmt(top.value, data.decimals)} by ${top.player.name}. Open player`}
        className="hover-lift flex h-full w-full flex-col gap-1 rounded-lg border border-line bg-panel px-3 py-2.5 text-left"
        style={{ boxShadow: `inset 0 2px 0 hsl(${hsl})` }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-xs font-bold uppercase tracking-wider" style={{ color: `hsl(${hsl})` }}>
            {data.title}
          </span>
          <Crown className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
        </span>
        <CountUp value={top.value} decimals={data.decimals} className="font-display text-2xl font-extrabold leading-none text-chalk sm:text-3xl" />
        <span className="flex min-w-0 items-center gap-1.5">
          {top.player.team && <TeamLogo team={top.player.team} size={16} decorative />}
          <span className="line-clamp-2 text-xs font-semibold leading-tight text-secondary-foreground">{top.player.name}</span>
        </span>
      </button>
    </li>
  );
};

/** Compact summary of the headline career records: one chip per record, holder and mark. */
export const RecordStrip = ({ headline, onSelect }: { headline: RecordBoardData[]; onSelect: Select }) => (
  <section id="record-book" aria-labelledby="record-book-title" className="scroll-mt-20 space-y-3">
    <h2 id="record-book-title" className="section-title text-2xl">
      <Crown className="h-5 w-5 text-gold" aria-hidden="true" />
      Record Book
    </h2>
    <ul className="flex flex-wrap gap-2 sm:gap-3" style={gridVars(headline.length, { base: 2, sm: 3, lg: 5, xl: 9 })}>
      {headline.map((b, i) => (
        <RecordChip key={b.id} data={b} index={i} onSelect={onSelect} />
      ))}
    </ul>
  </section>
);

// ---------- Efficiency leader tile ----------

const LeaderTile = ({ data, onSelect }: { data: RecordBoardData; onSelect: Select }) => {
  const top = data.entries[0];
  const hsl = GROUP_META[data.group].hsl;
  return (
    <li className={GRID_ITEM}>
      <button
        type="button"
        onClick={() => onSelect(top.player)}
        aria-label={`${data.title}: ${top.player.name}, ${fmt(top.value, data.decimals)}${data.minLabel ? ` (${data.minLabel})` : ''}. Open player`}
        className="hover-lift relative flex h-full w-full flex-col gap-1 overflow-hidden rounded-lg border border-line bg-panel p-3 text-left"
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: `hsl(${hsl})` }} />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{data.title}</span>
        <span className="font-display text-3xl font-extrabold leading-none tabular-nums" style={{ color: `hsl(${hsl})` }}>
          {fmt(top.value, data.decimals)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {top.player.team && <TeamLogo team={top.player.team} size={18} decorative />}
          <span className="truncate text-sm font-semibold text-foreground">{top.player.name}</span>
        </span>
        {data.minLabel && <span className="mt-auto pt-1 font-pixel text-[8px] uppercase text-muted-foreground">{data.minLabel}</span>}
      </button>
    </li>
  );
};

// ---------- Pace tracker ----------

const PaceCard = ({ pace, onSelect }: { pace: PaceEntry; onSelect: Select }) => {
  const pct = Math.min(pace.percentToRecord, 100);
  return (
    <li className={cn(GRID_ITEM, 'glass-card p-4')}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="button" onClick={() => onSelect(pace.player)} className="truncate font-display text-xl font-bold uppercase hover:text-gold">
              {pace.player.name}
            </button>
            <PositionBadge position={pace.player.position} />
            <TeamBadge team={pace.player.team} size="sm" />
          </div>
          <span className="lamp">
            ETA <b>{pace.seasonsToBreak}</b> {pace.seasonsToBreak === 1 ? 'season' : 'seasons'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Chasing <span className="font-semibold text-gold">{pace.recordName}</span> held by{' '}
          <button type="button" onClick={() => onSelect(pace.recordHolder)} className="font-semibold text-foreground underline-offset-2 hover:underline">
            {pace.recordHolder.name}
          </button>
        </p>
        <div className="mt-auto space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-mono font-bold tabular-nums">
              {fmt(pace.currentValue, 0)}
              <ArrowRight className="mx-1.5 inline h-3.5 w-3.5 text-gold" aria-label="toward" />
              <span className="text-gold">{fmt(pace.recordValue, 0)}</span>
            </span>
            <span className="text-xs text-muted-foreground">~{fmt(Math.round(pace.pacePerSeason), 0)} per 16 G</span>
          </div>
          <div
            role="progressbar"
            aria-label={`${pace.player.name} progress toward the record`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            className="h-2 overflow-hidden rounded-full bg-night"
          >
            <div className="h-full rounded-full turf-stripes transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </li>
  );
};

// ---------- Section ----------

interface RecordBookProps {
  leaders: RecordBoardData[];
  pace: PaceEntry[];
  onSelect: Select;
}

/** Efficiency leaders (rate records) and the pace tracker. The headline records live in RecordStrip. */
const RecordBook = ({ leaders, pace, onSelect }: RecordBookProps) => {
  const chasing = pace.slice(0, 6);
  if (leaders.length === 0 && chasing.length === 0) return null;
  return (
    <section id="efficiency" aria-labelledby="efficiency-title" className="scroll-mt-20 space-y-8">
      {leaders.length > 0 && (
        <div className="space-y-3">
          <h2 id="efficiency-title" className="section-title text-2xl">
            <Gauge className="h-5 w-5 text-gold" aria-hidden="true" />
            Efficiency Leaders
          </h2>
          <p className="text-sm text-muted-foreground">Quality over quantity. Rate stats only count players with a full sample.</p>
          <ul className="flex flex-wrap gap-3" style={gridVars(leaders.length, { base: 2, sm: 3, lg: 5 })}>
            {leaders.map((b) => (
              <LeaderTile key={b.id} data={b} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      )}

      {chasing.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
            <Timer className="h-5 w-5 text-gold" aria-hidden="true" />
            Chasing History
          </h3>
          <p className="text-sm text-muted-foreground">
            Players (min {MIN.games} games) on pace to pass a career record within {PACE_MAX_SEASONS} seasons at their
            per-16-game rate.
          </p>
          <ul className="flex flex-wrap gap-3" style={gridVars(chasing.length, { base: 1, sm: 1, lg: 2 })}>
            {chasing.map((p) => (
              <PaceCard key={`${keyOf(p.player)}:${p.recordName}`} pace={p} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default RecordBook;
