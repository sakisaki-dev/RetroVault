import { useState } from 'react';
import { Crown, ListOrdered } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import { getTeamColors } from '@/utils/teamColors';
import PositionBadge from '../PositionBadge';
import TeamLogo from '../brand/TeamLogo';
import { GROUP_META, GROUP_ORDER, boardsForGroup, keyOf, type GroupKey, type RecordBoardData } from './records';
import { GRID_ITEM, gridVars } from './grid';

type Select = (p: Player) => void;

const GroupCard = ({ group, boards, onSelect }: { group: GroupKey; boards: RecordBoardData[]; onSelect: Select }) => {
  const [activeId, setActiveId] = useState(boards[0].id);
  const active = boards.find((b) => b.id === activeId) ?? boards[0];
  const { label, hsl } = GROUP_META[group];
  const headingId = `lead-${group}`;

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
                      'rounded px-2 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors',
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

        <div className="flex items-baseline justify-between gap-2 px-3 pt-2">
          <p className="font-pixel text-[9px] uppercase text-muted-foreground" aria-live="polite">
            {active.title}
          </p>
          {active.minLabel && <p className="shrink-0 font-pixel text-[8px] uppercase text-muted-foreground">{active.minLabel}</p>}
        </div>

        <ol className="flex-1 px-1.5 pb-2 pt-1" aria-label={`${label}: ${active.title} leaders`}>
          {active.entries.map((e, i) => {
            const leader = i === 0;
            const colors = getTeamColors(e.player.team);
            return (
              <li key={keyOf(e.player)}>
                <button
                  type="button"
                  onClick={() => onSelect(e.player)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-panel-2',
                    leader && 'bg-gradient-to-r from-gold/10 to-transparent',
                  )}
                  style={colors ? { boxShadow: `inset 2px 0 0 hsl(${colors.primary})` } : undefined}
                >
                  <span className={cn('w-4 shrink-0 text-center font-pixel text-[10px]', leader ? 'text-gold' : 'text-muted-foreground')}>
                    <span className="sr-only">Rank </span>
                    {i + 1}
                  </span>
                  {e.player.team ? (
                    <TeamLogo team={e.player.team} size={20} decorative />
                  ) : (
                    <span className="w-5" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{e.player.name}</span>
                  {active.mixed && <PositionBadge position={e.player.position} className="min-w-[2rem] px-1.5 py-0.5 text-[10px]" />}
                  <span
                    className={cn(
                      'inline-flex min-w-[3.75rem] items-center justify-end gap-1 font-mono text-sm font-bold tabular-nums',
                      leader ? 'text-gold' : 'text-chalk',
                    )}
                  >
                    {leader && <Crown className="h-3 w-3" aria-hidden="true" />}
                    {formatDecimal(e.value, active.decimals)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </article>
    </li>
  );
};

const PositionLeaders = ({ boards, onSelect }: { boards: Map<string, RecordBoardData>; onSelect: Select }) => {
  const groups = GROUP_ORDER.map((g) => ({ g, items: boardsForGroup(boards, g) })).filter((x) => x.items.length > 0);
  if (groups.length === 0) return null;

  return (
    <section id="leaders" aria-labelledby="leaders-title" className="scroll-mt-20 space-y-3">
      <h2 id="leaders-title" className="section-title text-2xl">
        <ListOrdered className="h-5 w-5 text-gold" aria-hidden="true" />
        Leaders by Position
      </h2>
      <p className="text-sm text-muted-foreground">Top five all-time at every position. Switch the stat to re-rank.</p>
      <ul className="flex flex-wrap gap-3" style={gridVars(groups.length, { base: 1, sm: 2, lg: 2, xl: 4 })}>
        {groups.map(({ g, items }) => (
          <GroupCard key={g} group={g} boards={items} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
};

export default PositionLeaders;
