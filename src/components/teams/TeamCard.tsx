import { cn } from '@/lib/utils';
import { getReadableTextOn, liftForDarkBg } from '@/utils/teamColors';
import TeamLogo from '../brand/TeamLogo';
import type { TeamSummary } from './teamStats';

interface TeamCardProps {
  summary: TeamSummary;
  rank: number;
  onOpen: () => void;
}

const Stat = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <div className="flex flex-col-reverse items-center">
    <dt className="mt-1 font-pixel text-[9px] uppercase text-muted-foreground">{label}</dt>
    <dd className="font-display text-xl font-bold leading-none tabular-nums" style={accent ? { color: accent } : undefined}>
      {value}
    </dd>
  </div>
);

/** Franchise tile for the Teams hub. The whole card is one button that opens the team page. */
const TeamCard = ({ summary, rank, onOpen }: TeamCardProps) => {
  const t = summary.team;
  const primary = t?.primaryColor ?? '226 33% 30%';
  const secondary = t?.secondaryColor ?? '226 33% 20%';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${summary.label}: ${summary.players.length} players, ${summary.totalLegacy.toLocaleString()} total legacy. Open team page`}
      className={cn(
        'hover-lift group relative w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-card hover:border-line',
      )}
    >
      {/* Team-colored header band */}
      <div
        className="relative flex items-center gap-3 px-4 py-3 overflow-hidden"
        style={{
          background: `linear-gradient(110deg, hsl(${primary}) 0%, hsl(${primary}) 55%, hsl(${secondary}) 140%)`,
          color: getReadableTextOn(primary),
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -bottom-4 font-display text-7xl font-extrabold italic leading-none opacity-20"
        >
          {t?.abbreviation ?? ''}
        </span>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 shadow">
          <TeamLogo team={t ?? summary.label} size={38} decorative />
        </span>
        <div className="min-w-0 relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80 truncate">{t?.city ?? 'Custom team'}</p>
          <p className="font-display text-2xl font-extrabold uppercase leading-none truncate">{t?.name ?? summary.label}</p>
        </div>
        <span className="relative ml-auto self-start font-pixel text-[10px] rounded bg-black/70 text-gold px-1.5 py-1">
          #{rank}
        </span>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t ? `${t.conference} ${t.division}` : 'Unmatched team name'}</span>
          <span>
            {summary.hallOfFamers} HOF
          </span>
        </div>
        <dl className="grid grid-cols-4 gap-2 rounded-lg bg-secondary/40 py-2.5">
          <Stat label="Players" value={summary.players.length} />
          <Stat label="Σ Legacy" value={summary.totalLegacy >= 10000 ? `${(summary.totalLegacy / 1000).toFixed(1)}k` : summary.totalLegacy.toLocaleString()} accent={liftForDarkBg(primary)} />
          <Stat label="Rings" value={summary.rings} accent="hsl(var(--gold))" />
          <Stat label="MVPs" value={summary.mvps} />
        </dl>
        {summary.topPlayer && (
          <p className="text-xs text-muted-foreground truncate">
            <span className="font-pixel text-[9px] uppercase mr-1.5">Top</span>
            <span className="text-foreground font-medium">{summary.topPlayer.name}</span>{' '}
            <span>
              ({summary.topPlayer.position}, {Math.round(summary.topPlayer.careerLegacy || 0).toLocaleString()})
            </span>
          </p>
        )}
      </div>
    </button>
  );
};

export default TeamCard;
