import { useState } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
  team?: string | null;
  className?: string;
  /** Decorative logos sit next to a visible team name. */
  decorative?: boolean;
}

/** Team logo with a colored monogram fallback (offline / unknown team). */
const TeamLogo = ({ team, className, decorative = false }: TeamLogoProps) => {
  const nfl = findNFLTeam(team ?? undefined);
  const [failed, setFailed] = useState(false);
  const label = nfl?.fullName ?? team ?? 'Unknown team';

  if (!nfl || failed) {
    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white',
          className,
        )}
        style={{ background: nfl ? `hsl(${nfl.primaryColor})` : 'hsl(var(--muted))' }}
      >
        {(nfl?.abbreviation ?? team ?? '?').slice(0, 3)}
      </span>
    );
  }

  return (
    <img
      src={nfl.logoUrl}
      alt={decorative ? '' : label}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-contain', className)}
    />
  );
};

export default TeamLogo;
