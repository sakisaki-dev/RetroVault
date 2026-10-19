import type { LucideIcon } from 'lucide-react';
import { Award, Crown, Medal, Star, Trophy } from 'lucide-react';
import type { Position } from '@/types/player';

// Shared player display metadata (position names, award labels/icons/colors).

export const POSITION_NAMES: Record<Position, string> = {
  QB: 'Quarterback',
  RB: 'Running back',
  WR: 'Wide receiver',
  TE: 'Tight end',
  OL: 'Offensive line',
  LB: 'Linebacker',
  DB: 'Defensive back',
  DL: 'Defensive line',
};

export type AwardKey = 'rings' | 'mvp' | 'opoy' | 'sbmvp' | 'roty';

export interface AwardMeta {
  key: AwardKey;
  /** Short label (singular) */
  label: string;
  /** Long label for tooltips / screen readers (singular) */
  long: string;
  Icon: LucideIcon;
  /** HSL triplet or var() reference, used as `hsl(<hsl>)` */
  hsl: string;
}

const BASE_AWARDS: AwardMeta[] = [
  { key: 'rings', label: 'Ring', long: 'Championship ring', Icon: Trophy, hsl: 'var(--gold)' },
  { key: 'mvp', label: 'MVP', long: 'League MVP', Icon: Crown, hsl: 'var(--chart-2)' },
  { key: 'opoy', label: 'OPOY', long: 'Offensive Player of the Year', Icon: Star, hsl: 'var(--sky)' },
  { key: 'sbmvp', label: 'SB MVP', long: 'Super Bowl MVP', Icon: Medal, hsl: 'var(--turf)' },
  { key: 'roty', label: 'ROTY', long: 'Rookie of the Year', Icon: Award, hsl: '25 95% 60%' },
];

/** One place for award labels, icons and colors. Defenders store DPOY in `opoy`. */
export const AWARD_META: { offense: AwardMeta[]; defense: AwardMeta[] } = {
  offense: BASE_AWARDS,
  defense: BASE_AWARDS.map((a) =>
    a.key === 'opoy' ? { ...a, label: 'DPOY', long: 'Defensive Player of the Year' } : a,
  ),
};
