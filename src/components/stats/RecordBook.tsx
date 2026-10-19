import { ArrowRight, Crown, Gauge, Timer } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import PositionBadge from '../PositionBadge';
import TeamBadge from '../brand/TeamBadge';
import TeamLogo from '../brand/TeamLogo';
import CountUp from '../brand/CountUp';
import ProPlayerBanner from '../brand/ProPlayerBanner';
import { overallRating } from '../brand/ProPlayerBanner.utils';
import { GROUP_META, MIN, PACE_MAX_SEASONS, keyOf, type PaceEntry, type RecordBoardData } from './records';
import { GRID_ITEM, gridVars } from './grid';

const fmt = (v: number, decimals: number) => formatDecimal(v, decimals);

type Select = (p: Player) => void;

// ---------- Headline record card ----------

const RecordHolderCard = ({ data, index, onSelect }: { data: RecordBoardData; index: number; onSelect: Select }) => {
  const { numberFor } = useJerseyNumbers();
  const officialOvr = useOfficialOvr();
  const [top, ...rest] = data.entries;
  const runnersUp = rest.slice(0, 2);
  const hsl = GROUP_META[data.group].hsl;
  const headingId = `rec-${data.id}`;

  return (
    <li className={cn(GRID_ITEM, 'stagger-in')} style={{ ['--i' as string]: index }}>
      <article
        aria-labelledby={headingId}
        className="glass-card flex h-full flex-col gap-3 overflow-hidden p-3 sm:p-4"
        style={{ boxShadow: `inset 0 3px 0 hsl(${hsl}), var(--shadow-card)` }}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 id={headingId} className="font-display text-base font-bold uppercase tracking-wider" style={{ color: `hsl(${hsl})` }}>
              {data.title}
            </h3>
            <CountUp value={top.value} decimals={data.decimals} className="block font-display text-5xl font-extrabold leading-none text-chalk" />
          </div>
          <span className="lamp mt-1 shrink-0">
            <Crown className="h-3 w-3" aria-hidden="true" />
            Record
          </span>
        </header>

        <button
          type="button"
          onClick={() => onSelect(top.player)}
          aria-label={`Record holder: ${top.player.name}. Open player`}
          className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <ProPlayerBanner
            size="compact"
            interactive
            name={top.player.name}
            position={top.player.position}
            team={top.player.team}
            number={numberFor(top.player)}
            ovr={overallRating(top.player, officialOvr)}
          />
        </button>

        {runnersUp.length > 0 && (
          <ol className="mt-auto flex gap-2" aria-label={`${data.title} runners-up`}>
            {runnersUp.map((e, i) => (
              <li key={keyOf(e.player)} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelect(e.player)}
                  className="flex w-full items-center gap-1.5 rounded-md border border-line bg-night/60 px-2 py-1.5 text-left transition-colors hover:border-gold/60 hover:bg-panel-2"
                >
                  <span className="font-pixel text-[9px] text-muted-foreground">
                    <span className="sr-only">Rank </span>
                    {i + 2}
                  </span>
                  {e.player.team && <TeamLogo team={e.player.team} size={16} decorative />}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{e.player.name}</span>
                  <span className="font-mono text-xs font-bold tabular-nums text-secondary-foreground">{fmt(e.value, data.decimals)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </article>
    </li>
  );
};

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
  headline: RecordBoardData[];
  leaders: RecordBoardData[];
  pace: PaceEntry[];
  onSelect: Select;
}

const RecordBook = ({ headline, leaders, pace, onSelect }: RecordBookProps) => {
  const chasing = pace.slice(0, 6);
  return (
    <section id="record-book" aria-labelledby="record-book-title" className="scroll-mt-20 space-y-8">
      <div className="space-y-3">
        <h2 id="record-book-title" className="section-title text-2xl">
          <Crown className="h-5 w-5 text-gold" aria-hidden="true" />
          Record Book
        </h2>
        <p className="text-sm text-muted-foreground">The all-time career marks, who owns them and who is next in line.</p>
        <ul className="flex flex-wrap gap-3" style={gridVars(headline.length, { base: 1, sm: 2, lg: 3 })}>
          {headline.map((b, i) => (
            <RecordHolderCard key={b.id} data={b} index={i} onSelect={onSelect} />
          ))}
        </ul>
      </div>

      {leaders.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
            <Gauge className="h-5 w-5 text-gold" aria-hidden="true" />
            Efficiency Leaders
          </h3>
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
