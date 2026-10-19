import { Award, Ban, Flag, Medal, Shield, Ticket, Trophy, type LucideIcon } from 'lucide-react';
import type { FinishKind } from '@/utils/frontOffice';

/** One icon per season finish, so a finish never relies on colour alone. */
export const FINISH_ICONS: Record<FinishKind, LucideIcon> = {
  champions: Trophy,
  conference: Medal,
  'champ-round': Award,
  divisional: Shield,
  'wild-card': Ticket,
  division: Flag,
  missed: Ban,
};
