import { useMemo, useState } from 'react';
import type { QBPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import StatusBadge from '../StatusBadge';
import MetricCell from '../MetricCell';
import StatCell from '../StatCell';
import AwardsCell from '../AwardsCell';
import PlayerDetailCard from '../PlayerDetailCard';
import PlayerEditButton from '../PlayerEditButton';
import { calculateLeaders } from '@/utils/csvParser';
import { getTeamColors } from '@/utils/teamColors';
import { useLeague } from '@/context/LeagueContext';

interface QBTableProps {
  players: QBPlayer[];
  searchQuery?: string;
  activeOnly?: boolean;
}

const QBTable = ({ players, searchQuery = '', activeOnly = false }: QBTableProps) => {
  const { refreshData } = useLeague();
  const [selectedPlayer, setSelectedPlayer] = useState<QBPlayer | null>(null);

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const matchesSearch = searchQuery === '' || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesActive = !activeOnly || p.status === 'Active';
      return matchesSearch && matchesActive;
    });
  }, [players, searchQuery, activeOnly]);

  const leaders = useMemo(() => {
    return calculateLeaders(filteredPlayers, [
      'games', 'passYds', 'passTD', 'interceptions', 'rushYds', 'rushTD',
      'rings', 'mvp', 'trueTalent', 'dominance', 'careerLegacy', 'tpg'
    ]);
  }, [filteredPlayers]);

  const isLeader = (name: string, stat: string) => {
    return leaders.get(stat)?.name === name;
  };

  if (filteredPlayers.length === 0) return null;

  return (
    <>
      <div className="glass-card overflow-hidden animate-slide-in">
        <div className="p-4 border-b border-border/30 flex items-center gap-3">
          <PositionBadge position="QB" />
          <h3 className="font-display font-bold text-lg tracking-wide">Quarterbacks</h3>
          <span className="text-muted-foreground text-sm">({filteredPlayers.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="sticky left-0 bg-secondary/80 backdrop-blur z-10">Player</th>
                <th>Team</th>
                <th>Status</th>
                <th>GP</th>
                <th>Pass Yds</th>
                <th>TD</th>
                <th>INT</th>
                <th>Rush Yds</th>
                <th>Awards</th>
                <th className="text-primary">Talent</th>
                <th className="text-primary">Dom</th>
                <th className="text-primary">Legacy</th>
                <th className="text-primary">TPG</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => {
                const teamColors = getTeamColors(player.team);
                return (
                  <tr 
                    key={player.name} 
                    className="group hover:bg-secondary/20 transition-colors cursor-pointer"
                    style={teamColors ? { borderLeft: `3px solid hsl(${teamColors.primary})` } : undefined}
                    onClick={() => setSelectedPlayer(player)}
                  >
                    <td className="sticky left-0 bg-card/90 backdrop-blur z-10">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col flex-1">
                          <span className="font-medium text-foreground">{player.name}</span>
                          {player.nickname && (
                            <span className="text-xs text-muted-foreground italic">"{player.nickname}"</span>
                          )}
                        </div>
                        <PlayerEditButton player={player} onSave={refreshData} />
                      </div>
                    </td>
                    <td>
                      {player.team ? (
                        <span 
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={teamColors ? {
                            backgroundColor: `hsl(${teamColors.primary} / 0.2)`,
                            color: `hsl(${teamColors.primary})`,
                          } : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                        >
                          {player.team}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td><StatusBadge status={player.status} /></td>
                    <td><StatCell value={player.games} isLeader={isLeader(player.name, 'games')} /></td>
                    <td><StatCell value={player.passYds} isLeader={isLeader(player.name, 'passYds')} /></td>
                    <td><StatCell value={player.passTD} isLeader={isLeader(player.name, 'passTD')} /></td>
                    <td><StatCell value={player.interceptions} /></td>
                    <td><StatCell value={player.rushYds} isLeader={isLeader(player.name, 'rushYds')} /></td>
                    <td>
                      <AwardsCell 
                        rings={player.rings} 
                        mvp={player.mvp} 
                        opoy={player.opoy} 
                        sbmvp={player.sbmvp} 
                        roty={player.roty}
                      />
                    </td>
                    <td><MetricCell value={player.trueTalent} metric="trueTalent" isLeader={isLeader(player.name, 'trueTalent')} format="number" /></td>
                    <td><MetricCell value={player.dominance} metric="dominance" isLeader={isLeader(player.name, 'dominance')} format="number" /></td>
                    <td><MetricCell value={player.careerLegacy} metric="careerLegacy" isLeader={isLeader(player.name, 'careerLegacy')} format="number" /></td>
                    <td><MetricCell value={player.tpg} metric="tpg" isLeader={isLeader(player.name, 'tpg')} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PlayerDetailCard 
        player={selectedPlayer} 
        onClose={() => setSelectedPlayer(null)} 
      />
    </>
  );
};

export default QBTable;
