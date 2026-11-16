import { useMemo } from 'react';
import type { NFLTeam } from '@/utils/nflTeams';
import type { RetiredNumber } from '@/utils/jerseys';
import type { RingOfHonorEntry } from '@/utils/hallOfFame';
import { useRafters, type RafterBanner } from '@/utils/rafters';
import RaftersScene from './RaftersScene';

interface RetiredRaftersProps {
  team: NFLTeam | null;
  retired: RetiredNumber[];
  /** Years text when the stints have none for him at this club */
  yearsFor?: (r: RetiredNumber) => string | undefined;
  onSelect?: (r: RetiredNumber) => void;
  /** The club's Ring of Honor band (left out: none) */
  ring?: RingOfHonorEntry[];
  onRing?: (e: RingOfHonorEntry) => void;
  /** Kicker / heading text and its id, for more than one set of rafters on a page */
  title?: string;
  headingId?: string;
  /** No crowd and no note (a Hall of Fame plaque) */
  compact?: boolean;
}

/** A franchise's retired numbers as the rafters scene (RaftersScene.tsx), from the jersey index's retirements. */
const RetiredRafters = ({ team, retired, yearsFor, onSelect, ring, onRing, title, headingId = 'retired-numbers', compact }: RetiredRaftersProps) => {
  const { bannersOf } = useRafters();
  const banners = useMemo(
    (): RafterBanner[] => bannersOf(retired).map((b) => (b.years ? b : { ...b, years: yearsFor?.(b.r) })),
    [bannersOf, retired, yearsFor],
  );
  return (
    <RaftersScene
      team={team}
      banners={banners}
      ring={ring}
      onRing={onRing}
      onOpen={onSelect ? (b) => onSelect(b.r) : undefined}
      title={title}
      headingId={headingId}
      compact={compact}
    />
  );
};

export default RetiredRafters;
