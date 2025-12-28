import type { Position } from '@/types/player';

interface PositionBadgeProps {
  position: Position;
  className?: string;
}

const PositionBadge = ({ position, className = '' }: PositionBadgeProps) => {
  const positionClasses: Record<Position, string> = {
    QB: 'position-qb',
    RB: 'position-rb',
    WR: 'position-wr',
    TE: 'position-te',
    OL: 'position-ol',
    LB: 'position-lb',
    DB: 'position-db',
    DL: 'position-dl',
  };

  return (
    <span className={`position-badge ${positionClasses[position]} ${className}`}>
      {position}
    </span>
  );
};

export default PositionBadge;
