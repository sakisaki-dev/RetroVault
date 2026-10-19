import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import PositionBadge from '../PositionBadge';
import AwardsCell from '../AwardsCell';
import PlayerDetailCard from '../PlayerDetailCard';
import TeamBadge from '../brand/TeamBadge';
import { calculateLeaders } from '@/utils/csvParser';
import { getTeamColors } from '@/utils/teamColors';
import { HeaderTip, LeaderStat, PlayerNameCell, TierMetric } from './cells';

export interface StatColumn<T> {
  key: string;
  label: string;
  tip?: string;
  get: (p: T) => number;
  /** Highlight the leader in this column */
  leader?: boolean;
  decimals?: number;
}

export interface MetricColumn {
  key: 'trueTalent' | 'dominance' | 'careerLegacy' | 'tpg';
  label: string;
  tip: string;
  format: 'number' | 'decimal';
}

export const METRIC_COLUMNS: MetricColumn[] = [
  { key: 'trueTalent', label: 'Talent', tip: 'True Talent: production-based rating for the career', format: 'number' },
  { key: 'dominance', label: 'Dom', tip: 'Dominance: talent plus award points (rings, MVPs, POY, SB MVP)', format: 'number' },
  { key: 'careerLegacy', label: 'Legacy', tip: 'Career Legacy: talent, dominance and longevity combined', format: 'number' },
  { key: 'tpg', label: 'TPG', tip: 'Talent per game, adjusted for career length', format: 'decimal' },
];

interface PlayerStatTableProps<T extends Player> {
  title: string;
  position: Position;
  players: T[];
  columns: StatColumn<T>[];
  searchQuery?: string;
  isDefense?: boolean;
  /** Resolve the team to display (e.g. apply local overrides) */
  getTeam?: (p: T) => string | undefined;
  headerActions?: ReactNode;
  children?: ReactNode;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

const SortHeader = ({
  k,
  label,
  tip,
  className,
  sort,
  onToggle,
}: {
  k: string;
  label: string;
  tip?: string;
  className?: string;
  sort: SortState;
  onToggle: (key: string) => void;
}) => {
  const active = sort?.key === k;
  const Icon = !active ? ArrowUpDown : sort!.dir === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      className={cn('num', className)}
      aria-sort={active ? (sort!.dir === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      <HeaderTip label={label} tip={tip}>
        <button
          type="button"
          onClick={() => onToggle(k)}
          className={cn('inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground', active && 'text-gold')}
        >
          {label}
          <Icon className={cn('h-3 w-3', !active && 'opacity-40')} aria-hidden="true" />
        </button>
      </HeaderTip>
    </th>
  );
};

function PlayerStatTable<T extends Player>({
  title,
  position,
  players,
  columns,
  searchQuery = '',
  isDefense = false,
  getTeam = (p) => p.team,
  headerActions,
  children,
}: PlayerStatTableProps<T>) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [sort, setSort] = useState<SortState>(null);

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return players.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [players, searchQuery]);

  const leaders = useMemo(
    () =>
      calculateLeaders(filteredPlayers, [
        ...columns.filter((c) => c.leader !== false).map((c) => c.key),
        ...METRIC_COLUMNS.map((m) => m.key),
      ]),
    [filteredPlayers, columns],
  );
  const isLeader = (name: string, key: string) => leaders.get(key)?.name === name;

  const sortedPlayers = useMemo(() => {
    if (!sort) return filteredPlayers;
    const getter =
      columns.find((c) => c.key === sort.key)?.get ??
      ((p: T) => Number((p as unknown as Record<string, unknown>)[sort.key]) || 0);
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...filteredPlayers].sort((a, b) => dir * ((getter(a) || 0) - (getter(b) || 0)));
  }, [filteredPlayers, sort, columns]);

  if (filteredPlayers.length === 0) return null;

  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : null));

  return (
    <>
      <section className="glass-card overflow-hidden animate-slide-in" aria-label={title}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
          <PositionBadge position={position} />
          <h3 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h3>
          <span className="font-pixel text-[10px] text-muted-foreground">{filteredPlayers.length} PLAYERS</span>
          {headerActions && <div className="ml-auto">{headerActions}</div>}
        </div>
        <div className="relative overflow-auto max-h-[70vh] overscroll-x-contain">
          <table className="stats-table">
            <caption className="sr-only">
              {title} career statistics. Select a column header to sort, or a player name for details.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky-col">Player</th>
                <th scope="col">Team</th>
                {columns.map((c) => (
                  <SortHeader key={c.key} k={c.key} label={c.label} tip={c.tip} sort={sort} onToggle={toggleSort} />
                ))}
                <th scope="col">Awards</th>
                {METRIC_COLUMNS.map((m) => (
                  <SortHeader key={m.key} k={m.key} label={m.label} tip={m.tip} sort={sort} onToggle={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => {
                const team = getTeam(player);
                const colors = getTeamColors(team);
                return (
                  <tr
                    key={`${player.name}-${player.position}`}
                    className="cursor-pointer"
                    onClick={() => setSelectedPlayer({ ...player, team } as Player)}
                  >
                    <td
                      className="sticky-col max-w-[9.5rem] sm:max-w-none"
                      style={colors ? { boxShadow: `inset 3px 0 0 hsl(${colors.primary}), 1px 0 0 hsl(var(--border))` } : undefined}
                    >
                      <PlayerNameCell player={player} onSelect={() => setSelectedPlayer({ ...player, team } as Player)} />
                    </td>
                    <td>
                      <TeamBadge team={team} size="sm" />
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="num">
                        <LeaderStat
                          value={c.get(player)}
                          decimals={c.decimals}
                          isLeader={c.leader !== false && isLeader(player.name, c.key)}
                        />
                      </td>
                    ))}
                    <td>
                      <AwardsCell
                        rings={player.rings}
                        mvp={player.mvp}
                        opoy={player.opoy}
                        sbmvp={player.sbmvp}
                        roty={player.roty}
                        isDefense={isDefense}
                      />
                    </td>
                    {METRIC_COLUMNS.map((m) => (
                      <td key={m.key} className="num">
                        <TierMetric
                          value={player[m.key]}
                          metric={m.key}
                          format={m.format}
                          isLeader={isLeader(player.name, m.key)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {children}

      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </>
  );
}

export default PlayerStatTable;
