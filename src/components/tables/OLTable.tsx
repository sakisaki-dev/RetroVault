import type { OLPlayer } from '@/types/player';
import PlayerStatTable, { type StatColumn } from './PlayerStatTable';

interface OLTableProps {
  players: OLPlayer[];
  searchQuery?: string;
}

const COLUMNS: StatColumn<OLPlayer>[] = [
  { key: 'games', label: 'GP', tip: 'Games played', get: (p) => p.games },
  { key: 'blocks', label: 'Blocks', tip: 'Blocks made', get: (p) => p.blocks },
];

const OLTable = ({ players, searchQuery = '' }: OLTableProps) => (
  <PlayerStatTable
    title="Offensive Line"
    position="OL"
    players={players}
    columns={COLUMNS}
    searchQuery={searchQuery}
  />
);

export default OLTable;
