import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';

/** A news section header: kicker, title, count, and a rule in the section's colour (newsFeed.css .en-rub) */
export const Rubric = ({ id, kicker, count, icon, club, big, children }: { id: string; kicker: string; count?: number; icon?: ReactNode; club?: string; big?: boolean; children: ReactNode }) => (
  <header className={cn('en-rub', big && 'en-rub--big')}>
    <p className="en-rub__kicker">
      {club && <TeamLogo team={club} size={16} decorative />}
      {kicker}
    </p>
    <h3 id={id} className="en-rub__title">
      {icon}
      {children}
      {count != null && <span className="en-rub__n">{count}</span>}
    </h3>
  </header>
);
