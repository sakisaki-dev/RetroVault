import { Crown, Flame, Gem, Shield, Sparkles, Star, Trophy } from 'lucide-react';

/** Icon per card finish (pills, filters, card footers). */
export const FINISH_ICON = { base: Star, silver: Gem, gold: Trophy, holo: Sparkles } as const;

/** Icon per player tier. */
export const TIER_ICON = { common: Shield, rare: Gem, epic: Flame, legendary: Crown } as const;

/** Text color per finish and per tier. */
export const FINISH_TEXT = {
  base: 'text-muted-foreground',
  silver: 'text-slate-200',
  gold: 'text-gold',
  holo: 'text-fuchsia-300',
} as const;
export const TIER_TEXT = {
  common: 'text-muted-foreground',
  rare: 'text-sky-300',
  epic: 'text-orange-300',
  legendary: 'text-amber-300',
} as const;
