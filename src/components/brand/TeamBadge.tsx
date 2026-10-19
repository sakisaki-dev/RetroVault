import { cn } from '@/lib/utils';
import type { NFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import TeamLogo, { resolveTeam } from './TeamLogo';

export interface TeamBadgeProps {
  team?: string | NFLTeam | null;
  /** sm: table cells, md: cards, lg: headers */
  size?: 'sm' | 'md' | 'lg';
  /** Show the nickname ("Buccaneers") after the chip */
  showName?: boolean;
  /** Show the full name ("Tampa Bay Buccaneers") after the chip; overrides showName */
  showFullName?: boolean;
  className?: string;
}

const SIZES = {
  sm: { logo: 20, chip: 'text-[11px] px-1.5 py-0.5 min-w-[2.25rem]', name: 'text-xs', gap: 'gap-1.5' },
  md: { logo: 28, chip: 'text-xs px-2 py-0.5 min-w-[2.5rem]', name: 'text-sm', gap: 'gap-2' },
  lg: { logo: 40, chip: 'text-sm px-2 py-1 min-w-[3rem]', name: 'text-base', gap: 'gap-2.5' },
} as const;

/**
 * Team logo + abbreviation chip in the team's colors. Unknown team strings render as a neutral chip
 * with the raw text; a missing team renders an em dash with screen-reader text.
 */
const TeamBadge = ({ team, size = 'sm', showName = false, showFullName = false, className }: TeamBadgeProps) => {
  const s = SIZES[size];
  const resolved = resolveTeam(team);
  const raw = typeof team === 'string' ? team.trim() : '';

  if (!resolved && !raw) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No team</span>
      </span>
    );
  }

  if (!resolved) {
    return (
      <span className={cn('inline-flex items-center', s.gap, className)}>
        <TeamLogo team={raw} size={s.logo} decorative />
        <span className={cn('rounded bg-muted font-semibold text-muted-foreground truncate max-w-[10rem]', s.chip)}>{raw}</span>
      </span>
    );
  }

  const label = showFullName ? resolved.fullName : showName ? resolved.name : null;

  return (
    <span className={cn('inline-flex items-center align-middle', s.gap, className)} title={resolved.fullName}>
      <TeamLogo team={resolved} size={s.logo} decorative />
      <span
        className={cn('inline-flex justify-center rounded font-display font-bold uppercase tracking-wide leading-tight', s.chip)}
        style={{
          background: `hsl(${resolved.primaryColor})`,
          color: getReadableTextOn(resolved.primaryColor),
          boxShadow: `inset 0 -2px 0 hsl(${resolved.secondaryColor})`,
        }}
      >
        {resolved.abbreviation}
      </span>
      {label ? (
        <span className={cn('font-medium text-foreground truncate', s.name)}>{label}</span>
      ) : (
        <span className="sr-only">{resolved.fullName}</span>
      )}
    </span>
  );
};

export default TeamBadge;
