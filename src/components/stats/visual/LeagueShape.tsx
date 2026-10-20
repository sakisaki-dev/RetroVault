import { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import type { LeagueData, Player } from '@/types/player';
import { leaguePlayers } from '@/config/advanced';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import DistributionSwarm from './DistributionSwarm';
import { FranchiseBars, HofTiers } from './LeagueComposition';

/** League Shape: how talent is spread by position, how the Hall of Fame splits, and which franchises hold it. */
const LeagueShape = ({ data, onSelect }: { data: LeagueData; onSelect: (p: Player) => void }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const ovrMap = useOfficialOvr();
  if (players.length === 0) return null;
  return (
    <section id="league-shape" aria-labelledby="league-shape-title" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 id="league-shape-title" className="section-title text-2xl">
          <PieChart className="h-5 w-5 text-gold" aria-hidden="true" />
          League Shape
        </h2>
        <p className="text-sm text-muted-foreground">Where the talent sits: every player on one axis, the Hall of Fame by position, and the franchises behind it.</p>
      </div>
      <DistributionSwarm players={players} ovrMap={ovrMap} onSelect={onSelect} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <HofTiers players={players} />
        <FranchiseBars players={players} />
      </div>
    </section>
  );
};

export default LeagueShape;
