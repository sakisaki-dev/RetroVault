import type { LBPlayer, DBPlayer, DLPlayer } from '@/types/player';
import PlayerStatTable, { type StatColumn } from './PlayerStatTable';

type DefensivePlayer = LBPlayer | DBPlayer | DLPlayer;

interface DefenseTableProps {
  players: DefensivePlayer[];
  position: 'LB' | 'DB' | 'DL';
  title: string;
  searchQuery?: string;
}

const COLUMNS: StatColumn<DefensivePlayer>[] = [
  { key: 'games', label: 'GP', tip: 'Games played', get: (p) => p.games },
  { key: 'tackles', label: 'Tackles', tip: 'Total tackles', get: (p) => p.tackles },
  { key: 'interceptions', label: 'INT', tip: 'Interceptions', get: (p) => p.interceptions },
  { key: 'sacks', label: 'Sacks', tip: 'Sacks', get: (p) => p.sacks },
  { key: 'forcedFumbles', label: 'FF', tip: 'Forced fumbles', get: (p) => p.forcedFumbles },
];

const DefenseTable = ({ players, position, title, searchQuery = '' }: DefenseTableProps) => (
  <PlayerStatTable
    title={title}
    position={position}
    players={players}
    columns={COLUMNS}
    searchQuery={searchQuery}
    isDefense
  />
);

export default DefenseTable;
