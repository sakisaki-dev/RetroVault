import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { GradeStep } from '@/config/skillGrades';
import type { PlayerProfile } from '@/utils/teamLab';
import { getTeamColors } from '@/utils/teamColors';
import TeamLogo from '@/components/brand/TeamLogo';

/** Letter grade chip: the letter is always printed, the colour only reinforces it. */
export const GradeChip = ({ grade, size = 'md', label }: { grade: GradeStep | null; size?: 'sm' | 'md' | 'lg'; label?: string }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded font-display font-extrabold leading-none tabular-nums',
      size === 'sm' && 'h-5 min-w-[1.6rem] px-1 text-xs',
      size === 'md' && 'h-7 min-w-[2.1rem] px-1.5 text-base',
      size === 'lg' && 'h-11 min-w-[3.2rem] px-2 text-3xl',
    )}
    style={{ background: grade?.color ?? 'hsl(var(--line))', color: '#0b1020' }}
    aria-label={label ?? (grade ? `Grade ${grade.grade}` : 'No grade')}
    title={label}
  >
    {grade?.grade ?? '—'}
  </span>
);

/** Horizontal 0–100 bar with its value and letter; the bar is decorative (the numbers carry the meaning). */
export const ScoreBar = ({ label, score, grade, hint }: { label: ReactNode; score: number; grade: GradeStep; hint?: string }) => (
  <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto]" title={hint}>
    <span className="truncate font-display text-[15px] font-bold uppercase tracking-wide text-chalk">{label}</span>
    <span className="relative h-3 overflow-hidden rounded-sm bg-black/50 ring-1 ring-line/60" aria-hidden="true">
      <span
        className="absolute inset-y-0 left-0 rounded-sm motion-safe:transition-[width] motion-safe:duration-500"
        style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: `linear-gradient(90deg, ${grade.color}99, ${grade.color})` }}
      />
      {[25, 50, 75].map((x) => (
        <span key={x} className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${x}%` }} />
      ))}
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-7 text-right font-display text-base font-bold tabular-nums text-chalk">{Math.round(score)}</span>
      <GradeChip grade={grade} size="sm" />
    </span>
  </div>
);

/** Small team-coloured player row (upgrades, head-to-head). */
export const PlayerChip = ({ p, right, className }: { p: PlayerProfile; right?: ReactNode; className?: string }) => {
  const c = getTeamColors(p.team);
  const style = { '--pc': c ? `hsl(${c.primary})` : 'hsl(var(--line))' } as CSSProperties;
  return (
    <span
      className={cn('flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5', className)}
      style={{ ...style, boxShadow: 'inset 3px 0 0 var(--pc)', background: 'linear-gradient(100deg, color-mix(in srgb, var(--pc) 28%, transparent), transparent 75%)' }}
    >
      <span className="shrink-0 rounded bg-black/40 px-1 py-0.5 font-pixel text-[8px] text-gold">{p.position}</span>
      <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold uppercase italic tracking-wide text-chalk">{p.name}</span>
      {p.team ? <TeamLogo team={p.team} size={18} decorative /> : null}
      <span className="shrink-0 rounded border border-[color:var(--pc)] bg-black/50 px-1 font-display text-xs font-extrabold tabular-nums text-chalk">
        {p.ovr}
        <span className="sr-only"> OVR</span>
      </span>
      {right}
    </span>
  );
};

export const Card = ({ title, icon, children, className, action }: { title: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) => (
  <section className={cn('glass-card min-w-0 p-4 sm:p-5', className)}>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="section-title min-w-[10rem] flex-1 text-lg">
        {icon}
        {title}
      </h3>
      {action}
    </div>
    {children}
  </section>
);
