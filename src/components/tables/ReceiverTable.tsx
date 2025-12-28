import { useMemo } from 'react';
import type { WRPlayer, TEPlayer } from '@/types/player';
import PositionBadge from '../PositionBadge';
import StatusBadge from '../StatusBadge';
import MetricCell from '../MetricCell';
import StatCell from '../StatCell';
import { calculateLeaders } from '@/utils/csvParser';

interface ReceiverTableProps {
  players: (WRPlayer | TEPlayer)[];
  position: 'WR' | 'TE';
  title: string;
}

const ReceiverTable = ({ players, position, title }: ReceiverTableProps) => {
  const leaders = useMemo(() => {
    return calculateLeaders(players, [
      'games', 'receptions', 'recYds', 'recTD', 'longest',
      'rings', 'trueTalent', 'dominance', 'careerLegacy', 'tpg'
    ]);
  }, [players]);

  const isLeader = (name: string, stat: string) => {
    return leaders.get(stat)?.name === name;
  };

  return (
    <div className="glass-card overflow-hidden animate-slide-in">
      <div className="p-4 border-b border-border/30 flex items-center gap-3">
        <PositionBadge position={position} />
        <h3 className="font-display font-bold text-lg tracking-wide">{title}</h3>
        <span className="text-muted-foreground text-sm">({players.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="sticky left-0 bg-secondary/80 backdrop-blur z-10">Player</th>
              <th>Status</th>
              <th>GP</th>
              <th>Rec</th>
              <th>Rec Yds</th>
              <th>Rec TD</th>
              <th>Fum</th>
              <th>Long</th>
              <th>Rings</th>
              <th className="text-primary">True Talent</th>
              <th className="text-primary">Dominance</th>
              <th className="text-primary">Legacy</th>
              <th className="text-primary">TPG</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name} className="hover:bg-secondary/20 transition-colors">
                <td className="sticky left-0 bg-card/90 backdrop-blur z-10">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{player.name}</span>
                    {player.nickname && (
                      <span className="text-xs text-muted-foreground italic">{player.nickname}</span>
                    )}
                  </div>
                </td>
                <td><StatusBadge status={player.status} /></td>
                <td><StatCell value={player.games} isLeader={isLeader(player.name, 'games')} /></td>
                <td><StatCell value={player.receptions} isLeader={isLeader(player.name, 'receptions')} /></td>
                <td><StatCell value={player.recYds} isLeader={isLeader(player.name, 'recYds')} /></td>
                <td><StatCell value={player.recTD} isLeader={isLeader(player.name, 'recTD')} /></td>
                <td><StatCell value={player.fumbles} /></td>
                <td><StatCell value={player.longest} isLeader={isLeader(player.name, 'longest')} /></td>
                <td><StatCell value={player.rings} isLeader={isLeader(player.name, 'rings')} /></td>
                <td><MetricCell value={player.trueTalent} metric="trueTalent" isLeader={isLeader(player.name, 'trueTalent')} /></td>
                <td><MetricCell value={player.dominance} metric="dominance" isLeader={isLeader(player.name, 'dominance')} /></td>
                <td><MetricCell value={player.careerLegacy} metric="careerLegacy" isLeader={isLeader(player.name, 'careerLegacy')} /></td>
                <td><MetricCell value={player.tpg} metric="tpg" isLeader={isLeader(player.name, 'tpg')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReceiverTable;
