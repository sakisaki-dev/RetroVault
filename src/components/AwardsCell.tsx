import { Trophy, Star, Medal, Award, Crown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AwardsCellProps {
  rings?: number;
  mvp?: number;
  opoy?: number;  // OPOY for offense, DPOY for defense
  sbmvp?: number;
  roty?: number;
  isDefense?: boolean;
}

interface AwardBadgeProps {
  count: number;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const AwardBadge = ({ count, label, icon, color }: AwardBadgeProps) => {
  if (count === 0) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ 
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {icon}
            {count > 1 && <span className="text-[10px]">×{count}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{count} {label}{count > 1 ? 's' : ''}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AwardsCell = ({ rings = 0, mvp = 0, opoy = 0, sbmvp = 0, roty = 0, isDefense = false }: AwardsCellProps) => {
  const hasAwards = rings > 0 || mvp > 0 || opoy > 0 || sbmvp > 0 || roty > 0;

  if (!hasAwards) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <AwardBadge 
        count={rings} 
        label="Ring" 
        icon={<Trophy className="w-3 h-3" />}
        color="hsl(45, 100%, 50%)"  // Gold
      />
      <AwardBadge 
        count={mvp} 
        label="MVP" 
        icon={<Crown className="w-3 h-3" />}
        color="hsl(280, 100%, 65%)"  // Purple
      />
      <AwardBadge 
        count={opoy} 
        label={isDefense ? "DPOY" : "OPOY"}
        icon={<Star className="w-3 h-3" />}
        color="hsl(190, 100%, 50%)"  // Cyan
      />
      <AwardBadge 
        count={sbmvp} 
        label="SB MVP" 
        icon={<Medal className="w-3 h-3" />}
        color="hsl(150, 80%, 45%)"  // Green
      />
      <AwardBadge 
        count={roty} 
        label="ROTY" 
        icon={<Award className="w-3 h-3" />}
        color="hsl(25, 90%, 55%)"  // Orange
      />
    </div>
  );
};

export default AwardsCell;
