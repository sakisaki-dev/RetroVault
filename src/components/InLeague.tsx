import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import './inLeague.css';

/**
 * The Active tag (owner: "add in a little in the league rn indicator for the players that are", "An active tag"): a
 * live dot and an ACTIVE tag for players who are active on a club today. Free agents and the games' real NFL legends don't get it. Never on a
 * collectible card's face (cards are timeless); search rows, pickers, game cards and player pages only.
 */
export const isInLeague = (p: Pick<Player, 'status' | 'team'> & { isRealLegend?: boolean }): boolean =>
  p.status === 'Active' && !!p.team && p.team !== 'FA' && !p.isRealLegend;

export const InLeague = ({ player, label = true, className }: { player: Pick<Player, 'status' | 'team'> & { isRealLegend?: boolean }; label?: boolean; className?: string }) =>
  isInLeague(player) ? (
    <span className={cn('inl', label && 'inl--label', className)} title="Active: in the league now" aria-label="Active" role="img">
      <i aria-hidden="true" />
      {label && <b aria-hidden="true">Active</b>}
    </span>
  ) : null;

export default InLeague;
