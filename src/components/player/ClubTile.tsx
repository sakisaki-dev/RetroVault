import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { openTeamPage } from '@/utils/teamSearch';
import type { findNFLTeam } from '@/utils/nflTeams';

/** The card's Club tile: a button to the club's team sheet when the club is one of the 32, else a plain tile. */
const ClubTile = ({ team, onLeave, className, children }: { team: ReturnType<typeof findNFLTeam>; onLeave?: () => void; className: string; children: ReactNode }) =>
  team ? (
    <button
      type="button"
      className={cn(className, 'ix-card cursor-pointer text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold')}
      title={`Open the ${team.fullName} team page`}
      onClick={() => { onLeave?.(); openTeamPage(team.name); }}
    >
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
export default ClubTile;
