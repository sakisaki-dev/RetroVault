import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { liftForDarkBg } from '@/utils/teamColors';
import type { PlayerStints } from '@/utils/playerExtras';

const NEUTRAL = { primary: '226 33% 30%', secondary: '43 100% 62%' };

/** A club's primary / secondary HSL triplets (navy and gold for an unknown club). */
export const clubColors = (team?: string | NFLTeam | null) => {
  const t = typeof team === 'string' || !team ? findNFLTeam(team as string | null) : team;
  if (!t) return { team: null, ...NEUTRAL, ink: 'hsl(var(--chalk))' };
  const secondary = t.secondaryColor !== t.primaryColor ? t.secondaryColor : '0 0% 100%';
  return { team: t, primary: t.primaryColor, secondary, ink: liftForDarkBg(t.primaryColor) };
};

/** Tile/panel fill in the club's colours, darkened so white text reads on any club. */
export const clubFill = (team?: string | NFLTeam | null): CSSProperties => {
  const c = clubColors(team);
  return {
    background: `linear-gradient(180deg, hsl(228 60% 4% / 0) 0%, hsl(228 60% 4% / 0.35) 45%, hsl(228 60% 4% / 0.88) 100%), linear-gradient(135deg, hsl(${c.primary}) 0%, hsl(${c.primary} / 0.85) 55%, hsl(${c.secondary} / 0.55) 100%)`,
  };
};

/** "Y12–Y30" from his stints, else null. */
export const yearsOf = (stints?: PlayerStints) => {
  const list = stints?.stints ?? [];
  if (!list.length) return null;
  const from = Math.min(...list.map((s) => s.from));
  const to = Math.max(...list.map((s) => s.to));
  return from === to ? `Y${from}` : `Y${from}–Y${to}`;
};

export const POS_NAMES: Record<string, string> = {
  QB: 'Quarterback',
  RB: 'Running back',
  WR: 'Wide receiver',
  TE: 'Tight end',
  OL: 'Offensive line',
  LB: 'Linebacker',
  DB: 'Defensive back',
  DL: 'Defensive line',
};

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'] as const;

/** The key career numbers for his position (label, value). */
export const careerLine = (p: Player): { label: string; value: number }[] => {
  const g = { label: 'Games', value: p.games };
  switch (p.position) {
    case 'QB':
      return [{ label: 'Pass yds', value: p.passYds }, { label: 'Pass TD', value: p.passTD }, { label: 'INT', value: p.interceptions }, { label: 'Rush yds', value: p.rushYds }, g];
    case 'RB':
      return [{ label: 'Rush yds', value: p.rushYds }, { label: 'Rush TD', value: p.rushTD }, { label: 'Rec yds', value: p.recYds }, { label: 'Rec TD', value: p.recTD }, g];
    case 'WR':
    case 'TE':
      return [{ label: 'Catches', value: p.receptions }, { label: 'Rec yds', value: p.recYds }, { label: 'Rec TD', value: p.recTD }, { label: 'Long', value: p.longest }, g];
    case 'OL':
      return [{ label: 'Blocks', value: p.blocks }, g];
    default:
      return [{ label: 'Tackles', value: p.tackles }, { label: 'Sacks', value: p.sacks }, { label: 'INT', value: p.interceptions }, { label: 'FF', value: p.forcedFumbles }, g];
  }
};

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export const ordinal = (n: number) => {
  const r = Math.round(n);
  const s = r % 100 >= 11 && r % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][r % 10] ?? 'th';
  return `${r}${s}`;
};
