import { useState } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { cn } from '@/lib/utils';
import { logoBackingClass } from '@/components/brand/TeamLogo';

interface TeamLogoProps {
  team?: string | null;
  className?: string;
  /** Decorative logos sit next to a visible team name. */
  decorative?: boolean;
  /** Faint light backing for logos on dark rows (see brand/TeamLogo `backed`). */
  backed?: boolean;
}

/** Team logo with a colored monogram fallback (offline / unknown team). */
const TeamLogo = ({ team, className, decorative = false, backed = false }: TeamLogoProps) => {
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
      // ESPN's logos are 500 x 500: the attributes give the box its square shape before the file arrives, so a logo
      // loading never re-lays out the table around it. Loaded with the page, not lazily mid-scroll (each lazy load
      // repainted the page under the finger); the 32 files come from the HTTP cache after the first page.
      width={500}
      height={500}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-contain', backed && logoBackingClass(nfl), className)}
    />
  );
};

export default TeamLogo;
