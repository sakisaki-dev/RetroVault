import { Trophy } from 'lucide-react';
import { getReadableTextOn } from '@/utils/teamColors';
import TeamLogo from '../brand/TeamLogo';
import { tenureText, type FranchiseRecord, type TeamSummary } from './teamStats';
import type { CoachedSummary } from '@/utils/frontOffice';

interface TeamCardProps {
  summary: TeamSummary;
  record?: FranchiseRecord;
  onOpen: () => void;
  /** Your coaching tenure here, from the season-by-season history */
  coached?: CoachedSummary;
  onHighlight?: (key: string | null) => void;
}

const titlesText = (n: number) => `${n} ${n === 1 ? 'title' : 'titles'}`;

/** Franchise tile for the Teams hub: a bold card in the team's colours. The whole card opens the team page. */
const TeamCard = ({ summary, record, onOpen, coached, onHighlight }: TeamCardProps) => {
  const t = summary.team;
  const primary = t?.primaryColor ?? '226 33% 30%';
  const secondary = t && t.secondaryColor !== t.primaryColor ? t.secondaryColor : '226 33% 18%';
  const fg = getReadableTextOn(primary);
  const coachedLine = coached ? `Coached here ${tenureText(coached.stints)} · ${titlesText(coached.titles)}` : null;
  const best = summary.topPlayer;
  const titles = record?.titles ?? 0;
  const stats: [string, string | number][] = [
    ['Titles', titles],
    ['SB apps', record?.appearances ?? 0],
    ['HOF', record?.hof.length ?? 0],
    ['Best OVR', record?.bestOvr ?? '—'],
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => onHighlight?.(summary.key)}
      onMouseLeave={() => onHighlight?.(null)}
      aria-label={`${summary.label}${t ? `, ${t.conference} ${t.division}` : ''}. Power rank ${record?.powerRank ?? '—'}. ${titlesText(titles)}, ${record?.appearances ?? 0} Super Bowl appearances, ${record?.hof.length ?? 0} Hall of Famers${best ? `, best player ${best.name}` : ''}.${coachedLine ? ` ${coachedLine}.` : ''} Open team page`}
      className="hover-lift group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 text-left shadow-card"
      style={{
        background: `linear-gradient(155deg, hsl(${primary}) 0%, hsl(${primary}) 52%, hsl(${secondary}) 135%)`,
        color: fg,
      }}
    >
      {/* Logo watermark + diagonal broadcast bands */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-8 opacity-[0.16] transition-transform duration-500 group-hover:scale-105">
        <TeamLogo team={t ?? summary.label} size={190} decorative />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'repeating-linear-gradient(115deg, transparent 0 22px, hsl(0 0% 100% / 0.035) 22px 44px)' }}
      />

      <div className="relative flex items-start justify-between gap-2 px-4 pt-3">
        <span className="rounded-sm bg-black/45 px-1.5 py-1 font-pixel text-[8px] uppercase tracking-wider text-white">
          {t ? `${t.conference} ${t.division}` : 'Custom team'}
        </span>
        {record && (
          <span className="rounded-sm bg-black/75 px-1.5 py-1 font-pixel text-[9px] text-gold" aria-hidden="true">
            #{record.powerRank}
          </span>
        )}
      </div>

      <div className="relative flex items-center gap-3 px-4 pt-2">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-lg ring-2 ring-black/10">
          <TeamLogo team={t ?? summary.label} size={44} decorative />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold uppercase tracking-wider opacity-80">{t?.city ?? 'League'}</span>
          <span className="block truncate font-display text-[1.7rem] font-extrabold italic uppercase leading-none">{t?.name ?? summary.label}</span>
        </span>
      </div>

      {titles > 0 && (
        <span className="relative mx-4 mt-2 flex flex-wrap items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: Math.min(titles, 10) }, (_, i) => (
            <Trophy key={i} className="h-3.5 w-3.5 fill-gold text-gold drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]" />
          ))}
          {titles > 10 && <span className="ml-1 font-pixel text-[8px]">+{titles - 10}</span>}
        </span>
      )}

      <dl className="relative mx-3 mt-3 grid grid-cols-4 gap-1 rounded-lg bg-black/45 py-2 text-center text-white backdrop-blur-[2px]">
        {stats.map(([k, v]) => (
          <div key={k} className="flex flex-col-reverse">
            <dt className="mt-1 font-pixel text-[7px] uppercase opacity-75">{k}</dt>
            <dd className={`font-display text-xl font-extrabold leading-none tabular-nums ${k === 'Titles' && titles > 0 ? 'text-gold' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="relative mt-auto space-y-1.5 px-3 pb-3 pt-2.5">
        {best && (
          <p className="flex min-w-0 items-baseline gap-1.5 rounded-md bg-black/30 px-2 py-1 text-xs text-white">
            <span className="font-pixel text-[7px] uppercase text-gold shrink-0">Icon</span>
            <span className="min-w-0 truncate font-semibold">{best.name}</span>
            <span className="shrink-0 opacity-75">
              {best.position} · {Math.round(best.careerLegacy || 0).toLocaleString()}
            </span>
          </p>
        )}
        {coached && (
          <p className="flex min-w-0 items-center gap-1.5 rounded-md border border-gold/50 bg-black/60 px-2 py-1 text-xs text-white">
            <span className="font-pixel text-[7px] uppercase text-gold shrink-0">Coached</span>
            <span className="min-w-0 truncate" title={coachedLine ?? undefined}>
              {tenureText(coached.stints)} · {titlesText(coached.titles)}
            </span>
          </p>
        )}
      </div>
    </button>
  );
};

export default TeamCard;
