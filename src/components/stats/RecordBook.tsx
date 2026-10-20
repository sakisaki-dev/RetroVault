import { Crown, Gauge } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import TeamLogo from '../brand/TeamLogo';
import CountUp from '../brand/CountUp';
import { GROUP_META, type PaceEntry, type RecordBoardData } from './records';
import { GRID_ITEM, gridVars } from './grid';
import MarginStrip from './visual/MarginStrip';
import { marginText } from './visual/chartKit';
import ChaseChart from './visual/ChaseChart';

const fmt = (v: number, decimals: number) => formatDecimal(v, decimals);

type Select = (p: Player) => void;

// ---------- Compact record strip (top of the page) ----------

const RecordChip = ({ data, index, onSelect }: { data: RecordBoardData; index: number; onSelect: Select }) => {
  const top = data.entries[0];
  const second = data.entries[1];
  const margin = marginText(data);
  const hsl = GROUP_META[data.group].hsl;
  return (
    <li className={cn(GRID_ITEM, 'stagger-in')} style={{ ['--i' as string]: index }}>
      <button
        type="button"
        onClick={() => onSelect(top.player)}
        aria-label={`${data.title} record: ${fmt(top.value, data.decimals)} by ${top.player.name}${margin ? `, ${margin}${second ? ` (${second.player.name})` : ''}` : ''}. Open player`}
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
        {margin && (
          <span className="mt-auto block space-y-0.5 pt-1">
            <MarginStrip board={data} />
            <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">{margin}</span>
          </span>
        )}
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
    <p className="text-sm text-muted-foreground">
      The headline career records. Under each: the top five on a strip from #5 to the record, the gold diamond is the holder and the
      gold bar his lead over #2.
    </p>
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
  const margin = marginText(data);
  const hsl = GROUP_META[data.group].hsl;
  return (
    <li className={GRID_ITEM}>
      <button
        type="button"
        onClick={() => onSelect(top.player)}
        aria-label={`${data.title}: ${top.player.name}, ${fmt(top.value, data.decimals)}${data.minLabel ? ` (${data.minLabel})` : ''}${margin ? `, ${margin}` : ''}. Open player`}
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
        {margin && (
          <span className="mt-auto block space-y-0.5 pt-1.5">
            <MarginStrip board={data} />
            <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">{margin}</span>
          </span>
        )}
        {data.minLabel && <span className={cn('pt-1 font-pixel text-[8px] uppercase text-muted-foreground', !margin && 'mt-auto')}>{data.minLabel}</span>}
      </button>
    </li>
  );
};

// ---------- Pace tracker: see visual/ChaseChart ----------

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
          <p className="text-sm text-muted-foreground">
            Quality over quantity. Rate stats only count players with a full sample. The strip under each mark shows the top five, with the
            leader's margin over #2 in gold.
          </p>
          <ul className="flex flex-wrap gap-3" style={gridVars(leaders.length, { base: 2, sm: 3, lg: 5 })}>
            {leaders.map((b) => (
              <LeaderTile key={b.id} data={b} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      )}

      {chasing.length > 0 && <ChaseChart pace={chasing} onSelect={onSelect} />}
    </section>
  );
};

export default RecordBook;
