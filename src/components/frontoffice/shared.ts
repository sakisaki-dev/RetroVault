import type { CSSProperties } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';

/** HSL triplet for a team's primary color (falls back to the line token). */
export const teamColor = (team?: string | null): string => findNFLTeam(team)?.primaryColor ?? '226 38% 27%';

/** Inline style that sets --fo-team for the frontoffice.css team-tinted surfaces. */
export const teamVars = (team?: string | null): CSSProperties => ({ ['--fo-team' as string]: teamColor(team) }) as CSSProperties;

export const staggerStyle = (i: number): CSSProperties => ({ ['--i' as string]: i }) as CSSProperties;

export const yearSpan = (a: number, b: number) => (a === b ? `Y${a}` : `Y${a}–${b}`);
