import type { Player } from '@/types/player';
import { useSlot, type Slot } from '@/utils/slot';
import PlayerDetailCard from '../PlayerDetailCard';

/**
 * The player card for a page that keeps its open player in a slot (utils/slot.ts): opening it re-renders this layer
 * only, not the page's tables and tiles.
 */
const PlayerCardLayer = ({ slot }: { slot: Slot<Player | null> }) => {
  const player = useSlot(slot);
  return <PlayerDetailCard player={player} onClose={() => slot.set(null)} />;
};

export default PlayerCardLayer;
