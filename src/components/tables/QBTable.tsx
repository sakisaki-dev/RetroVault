import type { QBPlayer } from '@/types/player';
import PlayerStatTable, { type StatColumn } from './PlayerStatTable';

interface QBTableProps {
  players: QBPlayer[];
  searchQuery?: string;
}

const COLUMNS: StatColumn<QBPlayer>[] = [
  { key: 'games', label: 'GP', tip: 'Games played', get: (p) => p.games },
  { key: 'passYds', label: 'Pass Yds', tip: 'Passing yards', get: (p) => p.passYds },
  { key: 'passTD', label: 'TD', tip: 'Passing touchdowns', get: (p) => p.passTD },
  { key: 'interceptions', label: 'INT', tip: 'Interceptions thrown', get: (p) => p.interceptions, leader: false },
  { key: 'rushYds', label: 'Rush Yds', tip: 'Rushing yards', get: (p) => p.rushYds },
];

const QBTable = ({ players, searchQuery = '' }: QBTableProps) => (
  <PlayerStatTable
    title="Quarterbacks"
    position="QB"
    players={players}
    columns={COLUMNS}
    searchQuery={searchQuery}
  />
);

export default QBTable;
