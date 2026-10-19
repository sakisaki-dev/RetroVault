import { useMemo, useState } from 'react';
import type { WRPlayer, TEPlayer } from '@/types/player';
import TeamOverridesDialog from '../TeamOverridesDialog';
import { loadTeamOverrides } from '@/utils/teamOverrides';
import { Button } from '@/components/ui/button';
import PlayerStatTable, { type StatColumn } from './PlayerStatTable';

type Receiver = WRPlayer | TEPlayer;

interface ReceiverTableProps {
  players: Receiver[];
  position: 'WR' | 'TE';
  title: string;
  searchQuery?: string;
}

const COLUMNS: StatColumn<Receiver>[] = [
  { key: 'games', label: 'GP', tip: 'Games played', get: (p) => p.games },
  { key: 'receptions', label: 'Rec', tip: 'Receptions', get: (p) => p.receptions },
  { key: 'recYds', label: 'Rec Yds', tip: 'Receiving yards', get: (p) => p.recYds },
  { key: 'recTD', label: 'Rec TD', tip: 'Receiving touchdowns', get: (p) => p.recTD },
  { key: 'longest', label: 'Long', tip: 'Longest reception (yards)', get: (p) => p.longest },
];

const ReceiverTable = ({ players, position, title, searchQuery = '' }: ReceiverTableProps) => {
  const [teamOverrides, setTeamOverrides] = useState(() => loadTeamOverrides());
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);

  const playersMissingTeam = useMemo(() => players.filter((p) => !p.team).length, [players]);

  return (
    <PlayerStatTable
      title={title}
      position={position}
      players={players}
      columns={COLUMNS}
      searchQuery={searchQuery}
      getTeam={(p) => p.team || teamOverrides[p.name]}
      headerActions={
        playersMissingTeam > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setIsTeamDialogOpen(true)}>
            Set teams
          </Button>
        ) : undefined
      }
    >
      <TeamOverridesDialog
        open={isTeamDialogOpen}
        onOpenChange={setIsTeamDialogOpen}
        title={`${title}: set teams`}
        players={players}
        onApplied={(merged) => setTeamOverrides(merged)}
      />
    </PlayerStatTable>
  );
};

export default ReceiverTable;
