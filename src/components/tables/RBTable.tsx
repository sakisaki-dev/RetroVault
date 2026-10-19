import type { RBPlayer } from '@/types/player';
import PlayerStatTable, { type StatColumn } from './PlayerStatTable';

interface RBTableProps {
  players: RBPlayer[];
  searchQuery?: string;
}

const COLUMNS: StatColumn<RBPlayer>[] = [
  { key: 'games', label: 'GP', tip: 'Games played', get: (p) => p.games },
  { key: 'rushYds', label: 'Rush Yds', tip: 'Rushing yards', get: (p) => p.rushYds },
  { key: 'rushTD', label: 'Rush TD', tip: 'Rushing touchdowns', get: (p) => p.rushTD },
  { key: 'receptions', label: 'Rec', tip: 'Receptions', get: (p) => p.receptions },
  { key: 'recYds', label: 'Rec Yds', tip: 'Receiving yards', get: (p) => p.recYds },
];

const RBTable = ({ players, searchQuery = '' }: RBTableProps) => (
  <PlayerStatTable
    title="Running Backs"
    position="RB"
    players={players}
    columns={COLUMNS}
    searchQuery={searchQuery}
  />
);

export default RBTable;
