import type { NFLTeam } from '@/utils/nflTeams';
import type { RetiredNumber } from '@/utils/jerseys';
import { getReadableTextOn } from '@/utils/teamColors';
import { POSITION_NAMES } from '@/utils/playerMeta';
import type { Position } from '@/types/player';
import { splitPlayerName } from '../brand/ProPlayerBanner.utils';

interface RetiredRaftersProps {
  team: NFLTeam | null;
  retired: RetiredNumber[];
  /** "POS:Name" or name -> years text, when known */
  yearsFor?: (r: RetiredNumber) => string | undefined;
  onSelect?: (r: RetiredNumber) => void;
}

const NEUTRAL_PRIMARY = '226 33% 30%';
const NEUTRAL_SECONDARY = '43 100% 62%';

/** Hanging banners for a franchise's retired numbers, like the ones in an arena's rafters. */
const RetiredRafters = ({ team, retired, yearsFor, onSelect }: RetiredRaftersProps) => {
  const primary = team?.primaryColor ?? NEUTRAL_PRIMARY;
  const secondary = team && team.secondaryColor !== team.primaryColor ? team.secondaryColor : team ? '0 0% 100%' : NEUTRAL_SECONDARY;
  const fg = getReadableTextOn(primary);

  return (
    <section aria-labelledby="retired-numbers" className="relative">
      <h3 id="retired-numbers" className="section-title text-base mb-2">
        Retired numbers
        <span className="font-pixel text-[9px] text-muted-foreground">{retired.length}</span>
      </h3>
      {retired.length === 0 ? (
        <p className="text-sm text-muted-foreground">No numbers retired yet. Hall of Famers' numbers go up here automatically.</p>
      ) : (
        <div className="relative overflow-x-auto pb-2">
          {/* steel beam */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-2 rounded-sm"
            style={{ background: 'linear-gradient(180deg, hsl(220 10% 55%), hsl(220 12% 28%))', boxShadow: '0 2px 4px hsl(228 60% 3% / 0.6)' }}
          />
          <ul className="relative flex gap-3 px-1 pt-2">
            {retired.map((r) => {
              const { last } = splitPlayerName(r.name);
              const years = yearsFor?.(r) ?? r.years;
              const pos = r.position ? POSITION_NAMES[r.position as Position] ?? r.position : undefined;
              const label = `Number ${r.number}, ${r.name}${pos ? `, ${pos}` : ''}${years ? `, ${years}` : ''}`;
              const body = (
                <>
                  {/* hanging wires */}
                  <span aria-hidden="true" className="absolute -top-2 left-3 h-3 w-px bg-slate-400/70" />
                  <span aria-hidden="true" className="absolute -top-2 right-3 h-3 w-px bg-slate-400/70" />
                  <span
                    aria-hidden="true"
                    className="relative flex h-[10.5rem] w-[5.75rem] flex-col items-center overflow-hidden pt-2 pb-6 text-center"
                    style={{
                      background: `linear-gradient(180deg, hsl(${primary}) 0%, hsl(${primary}) 70%, hsl(${primary} / 0.85) 100%)`,
                      color: fg,
                      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%)',
                      boxShadow: `inset 0 6px 0 hsl(${secondary}), inset 0 -2px 0 hsl(${secondary})`,
                    }}
                  >
                    {/* cloth folds */}
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          'repeating-linear-gradient(90deg, hsl(0 0% 100% / 0.05) 0 2px, transparent 2px 14px), linear-gradient(90deg, hsl(228 60% 3% / 0.25), transparent 25%, transparent 75%, hsl(228 60% 3% / 0.25))',
                      }}
                    />
                    <span className="relative mt-1.5 font-pixel text-[7px] uppercase tracking-wider opacity-85">{team?.abbreviation ?? 'Retired'}</span>
                    <span
                      className="relative font-display text-5xl font-extrabold italic leading-none tabular-nums"
                      style={{ textShadow: `2px 2px 0 hsl(${secondary} / 0.75)` }}
                    >
                      {r.number}
                    </span>
                    <span className="relative mt-1 h-1 w-12" style={{ background: `hsl(${secondary})` }} />
                    <span className="relative mt-1.5 max-w-full px-1 font-display text-sm font-bold uppercase leading-tight break-words">
                      {last}
                    </span>
                    {r.position && <span className="relative font-display text-[11px] font-semibold uppercase opacity-85">{r.position}</span>}
                    {years && <span className="relative mt-0.5 text-[10px] font-semibold opacity-85">{years}</span>}
                  </span>
                </>
              );
              return (
                <li key={`${r.number}-${r.name}`} className="relative shrink-0" title={label}>
                  {onSelect && r.playerKey ? (
                    <button type="button" onClick={() => onSelect(r)} className="relative block rounded hover:brightness-110" aria-label={`${label}. Open player`}>
                      {body}
                    </button>
                  ) : (
                    <div className="relative" role="img" aria-label={label}>
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default RetiredRafters;
