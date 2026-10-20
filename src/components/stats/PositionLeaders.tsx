import { useState } from 'react';
import { Crown, ListOrdered } from 'lucide-react';
import type { LeagueData, Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import PositionBadge from '../PositionBadge';
import TeamLogo from '../brand/TeamLogo';
import { GROUP_META, GROUP_ORDER, boardsForGroup, keyOf, type GroupKey, type RecordBoardData } from './records';
import { GRID_ITEM, gridVars } from './grid';
import { teamMark } from './visual/chartKit';
import LeaderRadar from './visual/LeaderRadar';

type Select = (p: Player) => void;

/** Row height of the bar race (px). Rows are absolutely placed so a stat switch slides them to their new rank. */
const ROW = 44;

const RaceRow = ({ board, rank, value, player, max, onSelect }: { board: RecordBoardData; rank: number; value: number; player: Player; max: number; onSelect: Select }) => {
  const leader = rank === 0;
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  const fill = teamMark(player.team);
  return (
    <li
      className="absolute inset-x-0 motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
      style={{ height: ROW, transform: `translateY(${rank * ROW}px)` }}
    >
      <button
        type="button"
        onClick={() => onSelect(player)}
        aria-label={`Rank ${rank + 1}: ${player.name}${player.team ? `, ${player.team}` : ''}, ${formatDecimal(value, board.decimals)} ${board.title}. Open player`}
        className={cn(
          'flex h-full w-full flex-col justify-center gap-1 rounded-md px-1.5 text-left transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
          leader && 'bg-gradient-to-r from-gold/10 to-transparent',
        )}
      >
        <span className="flex w-full items-center gap-2">
          <span className={cn('w-4 shrink-0 text-center font-pixel text-[10px]', leader ? 'text-gold' : 'text-muted-foreground')} aria-hidden="true">
            {rank + 1}
          </span>
          {player.team ? <TeamLogo team={player.team} size={18} decorative /> : <span className="w-[18px]" aria-hidden="true" />}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{player.name}</span>
          {board.mixed && <PositionBadge position={player.position} className="min-w-[2rem] px-1.5 py-0.5 text-[10px]" />}
          <span className={cn('inline-flex shrink-0 items-center gap-1 font-mono text-sm font-bold tabular-nums', leader ? 'text-gold' : 'text-chalk')}>
            {leader && <Crown className="h-3 w-3" aria-hidden="true" />}
            {formatDecimal(value, board.decimals)}
          </span>
        </span>
        {/* Bar: team colour; length = share of the leader's mark */}
        <span aria-hidden="true" className="ml-6 block h-2 overflow-hidden rounded-sm bg-night/70">
          <span
            className="block h-full rounded-r-[4px] motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
            style={{ width: `${width}%`, background: fill, boxShadow: leader ? `0 0 0 1px hsl(var(--gold))` : undefined }}
          />
        </span>
      </button>
    </li>
  );
};

/** Bar race: the top players for the chosen stat, bars scaled to the leader, team coloured, sliding on change. */
const BarRace = ({ board, onSelect, label }: { board: RecordBoardData; onSelect: Select; label: string }) => {
  const max = board.entries[0]?.value ?? 0;
  return (
    <ol className="relative" style={{ height: board.entries.length * ROW }} aria-label={`${label}: ${board.title} leaders`}>
      {board.entries.map((e, i) => (
        <RaceRow key={keyOf(e.player)} board={board} rank={i} value={e.value} player={e.player} max={max} onSelect={onSelect} />
      ))}
    </ol>
  );
};

const leadText = (b: RecordBoardData) => {
  const [a, c] = b.entries;
  if (!a || !c) return null;
  const gap = a.value - c.value;
  if (gap <= 0) return 'Tied at the top';
  const pct = c.value > 0 ? (gap / c.value) * 100 : 0;
  return `Leads #2 by ${formatDecimal(gap, b.decimals)}${pct >= 0.5 ? ` (${Math.round(pct)}%)` : ''}`;
};

const GroupCard = ({ group, boards, onSelect }: { group: GroupKey; boards: RecordBoardData[]; onSelect: Select }) => {
  const [activeId, setActiveId] = useState(boards[0].id);
  const active = boards.find((b) => b.id === activeId) ?? boards[0];
  const { label, hsl } = GROUP_META[group];
  const headingId = `lead-${group}`;
  const lead = leadText(active);

  return (
    <li className={GRID_ITEM}>
      <article
        aria-labelledby={headingId}
        className="glass-card flex h-full flex-col overflow-hidden"
        style={{ boxShadow: `inset 0 3px 0 hsl(${hsl}), var(--shadow-card)` }}
      >
        <header className="space-y-2 border-b border-line bg-panel-2/40 px-3 pb-2.5 pt-3">
          <h3 id={headingId} className="font-display text-lg font-bold uppercase tracking-wide" style={{ color: `hsl(${hsl})` }}>
            {label}
          </h3>
          {boards.length > 1 && (
            <div role="group" aria-label={`${label} stat`} className="flex flex-wrap gap-1">
              {boards.map((b) => {
                const on = b.id === active.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={on}
                    title={b.title}
                    onClick={() => setActiveId(b.id)}
                    className={cn(
                      'min-h-[28px] rounded px-2 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                      on ? 'text-night' : 'bg-night/60 text-muted-foreground hover:text-foreground',
                    )}
                    style={on ? { background: `hsl(${hsl})` } : undefined}
                  >
                    {b.short}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <div className="space-y-0.5 px-3 pt-2" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-pixel text-[9px] uppercase text-muted-foreground">{active.title}</p>
            {active.minLabel && <p className="shrink-0 font-pixel text-[8px] uppercase text-muted-foreground">{active.minLabel}</p>}
          </div>
          {lead && <p className="text-[11px] text-secondary-foreground">{lead}</p>}
        </div>

        <div className="flex-1 px-1.5 pb-2 pt-1">
          <BarRace board={active} onSelect={onSelect} label={label} />
        </div>
      </article>
    </li>
  );
};

const PositionLeaders = ({ boards, data, onSelect }: { boards: Map<string, RecordBoardData>; data: LeagueData; onSelect: Select }) => {
  const groups = GROUP_ORDER.map((g) => ({ g, items: boardsForGroup(boards, g) })).filter((x) => x.items.length > 0);
  if (groups.length === 0) return null;

  return (
    <section id="leaders" aria-labelledby="leaders-title" className="scroll-mt-20 space-y-3">
      <h2 id="leaders-title" className="section-title text-2xl">
        <ListOrdered className="h-5 w-5 text-gold" aria-hidden="true" />
        Leaders by Position
      </h2>
      <p className="text-sm text-muted-foreground">
        Top ten all-time at every position. Bars are scaled to the leader and coloured by team; switch the stat and watch the board re-rank.
      </p>
      <ul className="flex flex-wrap gap-3" style={gridVars(groups.length, { base: 1, sm: 2, lg: 2, xl: 4 })}>
        {groups.map(({ g, items }) => (
          <GroupCard key={g} group={g} boards={items} onSelect={onSelect} />
        ))}
      </ul>
      <LeaderRadar data={data} onSelect={onSelect} />
    </section>
  );
};

export default PositionLeaders;
