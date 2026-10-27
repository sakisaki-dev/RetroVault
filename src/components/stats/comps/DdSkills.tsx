import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { overallBoard, skillBoard, type Overall, type SkillBoard, type SkillGrade } from '@/config/skillGrades';
import { ordinal } from '../analytics/viz';
import { DdBar, GradeChip } from './ddParts';
import LeaderboardPeek, { type PeekBoard } from './LeaderboardPeek';

interface Props {
  player: Player;
  /** Official OVR (the only OVR on the page). */
  ovr: number | undefined;
  traits: SkillGrade[];
  overall: Overall | null;
  /** League players (the grade pools are built from these) */
  players: Player[];
  onOpenPlayer: (p: Player) => void;
}

const toPeek = (title: string, metric: string, pos: string, b: SkillBoard): PeekBoard => ({
  title,
  sub: [metric, /^\d/.test(b.poolLabel) ? `${pos}s with ${b.poolLabel}` : `${pos}s, ${b.poolLabel}`, `${b.entries.length} qualifiers`, b.lowerIsBetter ? 'lower is better' : ''].filter(Boolean).join(' · '),
  rows: b.entries.map((e) => ({
    player: e.player,
    display: e.display,
    grade: e.grade,
  })),
});

/** Broadcast-style rating cards: one letter grade per play-style skill, graded by percentile within the position. */
const DdSkills = ({ player, ovr, traits, overall, players, onOpenPlayer }: Props) => {
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
        <LeaderboardPeek
          player={player}
          onOpenPlayer={onOpenPlayer}
          getBoard={() => toPeek('Skill rating', 'Overall skill grade', player.position, overallBoard(players, player.position))}
          self={() => ({
            player,
            display: String(overall.rating),
            grade: overall.grade,
          })}
        >
          <button
            type="button"
            aria-label={`Skill grade ${overall.grade.grade}, skill rating ${overall.rating}. Show the ${player.position} leaderboard`}
            className={cn(
              'rbk-chip glass-card flex flex-row items-center gap-4 p-4 text-left hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:flex-col lg:items-start',
              overall.grade.grade === 'S' && 'dd-card--s',
            )}
          >
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
          </button>
        </LeaderboardPeek>
      )}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${player.name} skill grades`}>
        {traits.map((t, i) => {
          const s = t.grade?.grade === 'S';
          return (
            <li key={t.trait.id} className="dd-enter" style={{ '--i': i } as CSSProperties}>
              <LeaderboardPeek
                player={player}
                onOpenPlayer={onOpenPlayer}
                getBoard={() => {
                  const b = skillBoard(players, player.position, t.trait.id);
                  return b && toPeek(t.trait.name, t.trait.label, player.position, b);
                }}
                self={() => ({ player, display: t.display, grade: t.grade })}
              >
                <button
                  type="button"
                  title={t.trait.definition}
                  aria-label={`${t.trait.name}: ${t.grade ? `grade ${t.grade.grade}, ` : ''}${t.display} ${t.trait.label}. Show the ${player.position} leaderboard`}
                  className={cn(
                    'rbk-chip flex h-full w-full items-center gap-3 rounded-lg border border-line bg-panel/80 p-3 text-left hover:border-gold/40 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                    s && 'dd-card--s',
                    !t.grade && 'opacity-70',
                  )}
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
                </button>
              </LeaderboardPeek>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DdSkills;
