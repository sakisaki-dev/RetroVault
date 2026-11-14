import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';

export interface TeamLogoProps {
  /** Team string from player data, or a resolved NFLTeam */
  team?: string | NFLTeam | null;
  /** Rendered square size in px */
  size?: number;
  className?: string;
  /** When true the logo is purely visual (alt=""); use when the team name is shown next to it */
  decorative?: boolean;
  /** Eager-load above-the-fold logos */
  priority?: boolean;
  /**
   * A faint light disc behind the mark (plus a hairline outline for clubs with a dark primary), for logos sitting on
   * dark rows (leaderboards, tables) where navy or dark green marks would otherwise vanish. See .logo-backed in index.css.
   */
  backed?: boolean;
}

/** Lightness (%) of an "H S% L%" colour string; 50 when it can't be read. */
const lightnessOf = (hsl?: string) => {
  const m = hsl?.match(/(\d+(?:\.\d+)?)%\s*$/);
  return m ? Number(m[1]) : 50;
};
/** Clubs whose primary colour is this dark or darker also get the hairline outline. */
export const DARK_PRIMARY_L = 36;
export const logoBackingClass = (team?: NFLTeam | null) =>
  cn('logo-backed', team && lightnessOf(team.primaryColor) <= DARK_PRIMARY_L && 'logo-backed--dark');

export const resolveTeam = (team?: string | NFLTeam | null): NFLTeam | null =>
  !team ? null : typeof team === 'string' ? findNFLTeam(team) : team;

const initials = (raw: string) =>
  raw
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

/**
 * Official team logo (hotlinked from ESPN's CDN via NFL_TEAMS), with a fixed box so layout never shifts.
 * Falls back to a team-colored monogram if the image fails or the team is unknown.
 */
const TeamLogo = ({ team, size = 32, className, decorative = false, priority = false, backed = false }: TeamLogoProps) => {
  const resolved = resolveTeam(team);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [resolved?.logoUrl]);

  const label = resolved?.fullName ?? (typeof team === 'string' ? team : 'Unknown team');
  const box = { width: size, height: size };

  if (!resolved || failed) {
    const fill = resolved?.primaryColor;
    const ring = resolved?.secondaryColor;
    const text = resolved?.abbreviation ?? (typeof team === 'string' && team ? initials(team) : '—');
    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : `${label} logo`}
        aria-hidden={decorative || undefined}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold leading-none select-none',
          !fill && 'bg-muted text-muted-foreground',
          className,
        )}
        style={{
          ...box,
          fontSize: Math.max(9, Math.round(size * (text.length > 2 ? 0.32 : 0.4))),
          background: fill ? `hsl(${fill})` : undefined,
          color: fill ? getReadableTextOn(fill) : undefined,
          boxShadow: ring ? `inset 0 0 0 ${Math.max(2, Math.round(size / 16))}px hsl(${ring})` : undefined,
        }}
      >
        {text}
      </span>
    );
  }

  return (
    <img
      src={resolved.logoUrl}
      alt={decorative ? '' : `${resolved.fullName} logo`}
      width={size}
      height={size}
      // Lazy: pages render hundreds of logos, and loading every one at mount queued the phone's network behind them
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('shrink-0 object-contain select-none', backed && logoBackingClass(resolved), className)}
      style={box}
    />
  );
};

export default TeamLogo;
