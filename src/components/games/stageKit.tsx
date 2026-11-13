import { useEffect, useState, type CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { bannerTeamOf } from '@/utils/playerExtras';
import { liftForDarkBg } from '@/utils/teamColors';
import { teamStyle, type TeamStyle } from './gameUtils';

/**
 * Small presentation helpers shared by League Grid, Higher or Lower and Over/Under:
 * a player's club identity (colours, logo, readable ink) and a reduced-motion hook (the how-to strip is
 * HowToStrip.tsx). Rules live in each game; this file only draws.
 */

export interface ClubLook {
  style: TeamStyle;
  /** Club colour lifted so it reads as text on the dark arcade panels */
  ink: string;
  logo: string | null;
  abbr: string;
  name: string;
  /** CSS vars: --c1 / --c2 / --tx (gameUtils) plus --ink */
  vars: CSSProperties;
}

export const clubLook = (teamName?: string | null): ClubLook => {
  const style = teamStyle(teamName ?? undefined);
  const ink = style.team ? liftForDarkBg(style.team.primaryColor, 64) : '#f1f4ff';
  return {
    style,
    ink,
    logo: style.team?.logoUrl ?? null,
    abbr: style.team?.abbreviation ?? 'FA',
    name: style.team?.fullName ?? 'Free agent',
    vars: { '--c1': style.c1, '--c2': style.c2, '--tx': style.text, '--ink': ink } as CSSProperties,
  };
};

/** Where a player is best known (his club while active, his signature club once retired). */
export const playerClub = (p: Player) => clubLook(bannerTeamOf(p));

export const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { first: '', last: name };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
};

export const useReducedMotion = () => {
  const q = '(prefers-reduced-motion: reduce)';
  const [r, setR] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
};

/** Club logo that hides itself when the CDN image fails. */
export const ClubLogo = ({ look, className, size }: { look: ClubLook; className?: string; size?: number }) =>
  look.logo ? (
    <img
      src={look.logo}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={className}
      width={size}
      height={size}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  ) : null;
