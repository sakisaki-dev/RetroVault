import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import type { Overall, SkillGrade } from '@/config/skillGrades';
import { ordinal } from '../analytics/viz';
import { DdBar, GradeChip } from './ddParts';

interface Props {
  player: Player;
  /** Official OVR (the only OVR on the page). */
  ovr: number | undefined;
  traits: SkillGrade[];
  overall: Overall | null;
}

/** Broadcast-style rating cards: one letter grade per play-style skill, graded by percentile within the position. */
const DdSkills = ({ player, ovr, traits, overall }: Props) => {
  const graded = traits.filter((t) => t.grade);
  if (!graded.length) {
    return (
      <p className="glass-card p-4 text-sm text-muted-foreground">
        No graded skills yet: too few of {player.name}&rsquo;s rates are on record. Grades appear once he has the stats for them.
      </p>
    );
  }
  const best = [...graded].sort((a, b) => b.percentile - a.percentile)[0];
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      {overall && (
        <div className={cn('glass-card flex flex-row items-center gap-4 p-4 lg:flex-col lg:items-start', overall.grade.grade === 'S' && 'dd-card--s')}>
          <GradeChip grade={overall.grade} size="xl" />
          <div className="min-w-0 space-y-1.5">
            <p className="font-pixel text-[9px] uppercase text-gold">Skill grade</p>
            <div className="flex flex-wrap gap-1.5">
              {ovr != null && (
                <span className="lamp" title="Official overall rating">
                  OVR <b>{ovr}</b>
                </span>
              )}
              <span className="lamp" title="Per-game skills only; ignores career length and awards">
                Skill rating <b>{overall.rating}</b>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Skill rating: per-game skills only, ignores career length and awards.</p>
            <p className="text-xs text-muted-foreground">
              {ordinal(overall.pct)} percentile across his {graded.length} skill{graded.length === 1 ? '' : 's'} among {player.position}s. Best:{' '}
              <b className="text-foreground">{best.trait.name}</b>.
            </p>
          </div>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${player.name} skill grades`}>
        {traits.map((t, i) => {
          const s = t.grade?.grade === 'S';
          return (
            <li
              key={t.trait.id}
              className={cn('dd-enter flex items-center gap-3 rounded-lg border border-line bg-panel/80 p-3', s && 'dd-card--s', !t.grade && 'opacity-70')}
              style={{ '--i': i } as CSSProperties}
              title={t.trait.definition}
            >
              <GradeChip grade={t.grade} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-base font-bold uppercase tracking-wide">{t.trait.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-chalk">{t.display}</span>
                </div>
                <DdBar pct={t.grade ? t.percentile : null} color={t.grade?.color} label={`${t.trait.name} percentile`} />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{t.trait.label}</span>
                  <span>{t.grade ? `${ordinal(t.percentile)} pct` : 'no data'}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DdSkills;
