import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tributeEntryOf, useLeagueContent } from '@/utils/leagueContent';
import { openTribute, prefetchTributeView } from './openTribute';

/**
 * "Tribute": opens a player's Player Tribute (the fifth AI lane) when he has one; renders nothing otherwise. Used by
 * the player card, the Deep Dive hero and a Hall of Fame plaque. `playerKey` is "POS:Name".
 */
const TributeButton = ({ playerKey, className, label = 'Tribute', onOpen }: { playerKey: string; className?: string; label?: string; onOpen?: () => void }) => {
  const { content } = useLeagueContent();
  const entry = tributeEntryOf(content, playerKey);
  if (!entry) return null;
  return (
    <button
      type="button"
      onPointerEnter={prefetchTributeView}
      onFocus={prefetchTributeView}
      onClick={() => {
        onOpen?.();
        openTribute(entry.key);
      }}
      aria-label={`Read the tribute to ${entry.name}`}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-display font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        className,
      )}
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
};

export default TributeButton;
