import { Star } from 'lucide-react';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import { GRADE_SCALE } from '@/config/skillGrades';
import { getReadableTextOn, getTeamColors } from '@/utils/teamColors';
import TeamLogo from '../../brand/TeamLogo';

export interface TierEntry {
  player: Player;
  value: number;
}

export interface Tier {
  letter: string;
  label: string;
  entries: TierEntry[];
}

const letterColor = (letter: string) => GRADE_SCALE.find((g) => g.grade[0] === letter)?.color ?? '#8a93b5';

const TierChip = ({ e, onSelect }: { e: TierEntry; onSelect: (p: Player) => void }) => {
  const c = getTeamColors(e.player.team);
  const bg = c ? `hsl(${c.primary})` : 'hsl(var(--panel-2))';
  const ink = c ? getReadableTextOn(c.primary) : 'hsl(var(--foreground))';
  const hof = isHallOfFamer(e.player);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(e.player)}
        aria-label={`${e.player.name}${e.player.team ? `, ${e.player.team}` : ''}: ${e.value}${hof ? ', Hall of Famer' : ''}. Open player`}
        className="flex max-w-[13rem] items-center gap-1.5 rounded-md py-1 pl-1 pr-2 text-left text-xs font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-night"
        style={{ background: bg, color: ink, boxShadow: hof ? '0 0 0 2px hsl(var(--gold))' : undefined }}
      >
        {e.player.team && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-white/90">
            <TeamLogo team={e.player.team} size={16} decorative />
          </span>
        )}
        {hof && <Star className="h-3 w-3 shrink-0 fill-current" aria-hidden="true" />}
        <span className="truncate">{e.player.name}</span>
        <span className="shrink-0 font-mono tabular-nums opacity-80">{e.value}</span>
      </button>
    </li>
  );
};

/** Tier-list graphic: one row per letter, player chips in team colours (gold ring + star = Hall of Famer). */
const TierBoard = ({ tiers, onSelect }: { tiers: Tier[]; onSelect: (p: Player) => void }) => (
  <ol className="overflow-hidden rounded-lg border border-line" aria-label="Tier list">
    {tiers.map((t) => (
      <li key={t.letter} className="grid grid-cols-[3.25rem_minmax(0,1fr)] border-t border-line first:border-t-0 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center px-1 py-2 text-center" style={{ background: letterColor(t.letter), color: '#0b1020' }}>
          <span className="font-display text-3xl font-extrabold italic leading-none sm:text-4xl">{t.letter}</span>
          <span className="mt-0.5 font-pixel text-[6px] uppercase leading-tight sm:text-[7px]">{t.label}</span>
        </div>
        <div className="min-h-[3rem] bg-night/40 p-2">
          {t.entries.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={`${t.letter} tier`}>
              {t.entries.map((e) => (
                <TierChip key={`${e.player.position}:${e.player.name}`} e={e} onSelect={onSelect} />
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">Nobody yet</p>
          )}
        </div>
      </li>
    ))}
  </ol>
);

export default TierBoard;
