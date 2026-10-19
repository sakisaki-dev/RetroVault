import { cn } from '@/lib/utils';
import type { Position } from '@/types/player';
import { POSITION_NAMES } from '@/utils/playerMeta';

const POSITION_CLASSES: Record<Position, string> = {
  QB: 'position-qb',
  RB: 'position-rb',
  WR: 'position-wr',
  TE: 'position-te',
  OL: 'position-ol',
  LB: 'position-lb',
  DB: 'position-db',
  DL: 'position-dl',
};

interface PositionBadgeProps {
  position: Position;
  className?: string;
}

/** Position chip; the abbreviation expands to the full name on hover and for assistive tech. */
const PositionBadge = ({ position, className }: PositionBadgeProps) => (
  <abbr
    title={POSITION_NAMES[position] ?? position}
    className={cn('position-badge no-underline', POSITION_CLASSES[position], className)}
  >
    {position}
  </abbr>
);

export default PositionBadge;
