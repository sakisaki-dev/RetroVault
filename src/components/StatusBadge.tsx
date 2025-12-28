import type { Status } from '@/types/player';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  return (
    <span className={`${status === 'Active' ? 'status-active' : 'status-retired'} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
