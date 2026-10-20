import { cn } from '@/lib/utils';
import { fmtPct } from '@/utils/cardMarket';

/** ▲ +12.4% / ▼ −3.0% / ■ 0.0%: arrow, sign and colour together, so the direction never rests on colour alone. */
const ChangeBadge = ({ change, className, label }: { change: number | null; className?: string; label?: string }) => {
  if (change == null) return <span className={cn('mk-badge mk-badge--new', className)}>New</span>;
  const dir = change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■';
  const words = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'unchanged';
  return (
    <span className={cn('mk-badge', `mk-badge--${dir}`, className)} aria-label={`${words} ${fmtPct(Math.abs(change))}${label ? ` ${label}` : ''}`}>
      <span aria-hidden="true">{arrow}</span>
      <span aria-hidden="true">{fmtPct(change)}</span>
    </span>
  );
};

export default ChangeBadge;
