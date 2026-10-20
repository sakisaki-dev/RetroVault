import type { CSSProperties } from 'react';
import { ArrowRight, Flag, Shirt, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TeamLogo from '@/components/brand/TeamLogo';
import { getReadableTextOn, liftForDarkBg } from '@/utils/teamColors';
import { stintYears, type ArcRing, type ArcStint, type CareerArcData } from './arcData';

const NEUTRAL = '226 33% 34%';

/** Small championship-ring glyph (original): band + stone. */
const RingGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={cn('h-3.5 w-3.5 shrink-0', className)} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="8" cy="10" r="4.6" />
    <path d="M5.6 4.2 8 1.8l2.4 2.4L8 6.3Z" fill="currentColor" stroke="none" />
  </svg>
);

const LikelyTag = () => (
  <span className="rounded-sm border border-dashed border-current px-1 font-pixel text-[8px] uppercase leading-[14px] opacity-90">likely</span>
);

const RingChip = ({ ring }: { ring: ArcRing }) => {
  const likely = ring.evidence === 'likely';
  const detail = `Super Bowl ${ring.roman}, Y${ring.year}${ring.opponent ? ` vs ${ring.opponent}` : ''}${ring.score ? ` (${ring.score})` : ''}`;
  const why = `${detail}. ${likely ? 'Likely: ' : 'Confirmed: '}${ring.reason}.`;
  // Hover shows the reason (title); a tap opens it in a popover, since phones have no hover
  return (
    <li>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cn('arc-ring', likely && 'arc-ring--likely')} title={why}>
            <RingGlyph />
            <span className="font-display text-sm font-bold leading-none">Y{ring.year}</span>
            <span className="font-pixel text-[8px] uppercase leading-none opacity-80">{ring.roman}</span>
            {likely && <LikelyTag />}
            <span className="sr-only">{why}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-auto max-w-[min(18rem,calc(100vw-2rem))] border-line bg-night p-2.5 text-xs leading-snug">
          {why}
        </PopoverContent>
      </Popover>
    </li>
  );
};

const stintVars = (s: ArcStint) => {
  const p = s.team?.primaryColor ?? NEUTRAL;
  const sec = s.team && s.team.secondaryColor !== s.team.primaryColor ? s.team.secondaryColor : '0 0% 100%';
  return {
    '--arc-p': p,
    '--arc-s': sec,
    '--arc-ink': getReadableTextOn(p),
    '--arc-accent': liftForDarkBg(p),
    '--i': 0,
  } as CSSProperties;
};

const Stint = ({ stint, index, total }: { stint: ArcStint; index: number; total: number }) => {
  const years = stintYears(stint);
  const likely = stint.evidence === 'likely';
  return (
    <li className={cn('arc-stint pc-enter', likely && 'arc-stint--likely')} style={{ ...stintVars(stint), '--i': index + 1 } as CSSProperties}>
      <div className="arc-rail" aria-hidden="true" />
      {(index > 0 || stint.arrival) && (
        <p className="arc-arrival">
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
          {stint.arrival ?? (likely ? 'Likely moved' : 'Moved')}
        </p>
      )}
      <div className="flex items-center gap-2.5">
        <span className="arc-logo">
          <TeamLogo team={stint.team ?? stint.label} size={34} decorative />
        </span>
        <div className="min-w-0">
          <h4 className="font-display font-bold uppercase leading-none tracking-wide text-chalk">
            <span className="sr-only">Stop {index + 1} of {total}: </span>
            {stint.team && <span className="block truncate text-[11px] font-semibold tracking-wider text-muted-foreground">{stint.team.city}</span>}
            <span className="block truncate text-lg">{stint.team?.name ?? stint.label}</span>
          </h4>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
            {years && <span className="font-semibold text-[color:var(--arc-accent)]">{years}</span>}
            {stint.tag && <span>{stint.tag}</span>}
            {likely && <LikelyTag />}
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground/90">{stint.source}</p>
      {stint.rings.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label={`Rings with the ${stint.label}`}>
          {stint.rings.map((r) => (
            <RingChip key={r.year} ring={r} />
          ))}
        </ul>
      )}
    </li>
  );
};

interface Props {
  arc: CareerArcData;
  headingId: string;
}

/** Horizontal (stacked on phones) career timeline: eras, franchise stops with rings, then honors. */
const CareerArc = ({ arc, headingId }: Props) => {
  const { eras, stints, undatedRings, totalRings, hallOfFame, retired, legend, tagline } = arc;
  const anyLikely = stints.some((s) => s.evidence === 'likely' || s.rings.some((r) => r.evidence === 'likely'));
  const n = stints.length;

  return (
    <div className="space-y-3">
      {tagline && (
        <p className="border-l-[3px] border-[color:var(--tc-accent)] pl-3 font-display text-lg font-semibold italic leading-snug text-chalk">
          &ldquo;{tagline}&rdquo;
          <span className="ml-2 align-middle font-pixel text-[8px] not-italic uppercase text-muted-foreground">League notes</span>
        </p>
      )}
      {eras.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Eras">
          {eras.map((e) => (
            <li key={e.name} className="arc-era" title={e.source}>
              <Sparkles className="h-3 w-3 text-[color:var(--tc-accent)]" aria-hidden="true" />
              <span className="font-semibold text-chalk">{e.name}</span>
              {e.start != null && (
                <span className="font-pixel text-[9px] text-muted-foreground">
                  {e.approx ? '~' : ''}Y{e.start}
                  {e.end !== e.start ? `–${e.end}` : ''}
                </span>
              )}
              <span className="sr-only">. {e.source}</span>
            </li>
          ))}
        </ul>
      )}

      <ol className="arc-track" aria-labelledby={headingId}>
        {legend && (
          <li className="arc-node pc-enter" style={{ '--i': 0 } as CSSProperties}>
            <Flag className="h-4 w-4 text-[color:var(--tc-accent)]" aria-hidden="true" />
            <span className="font-display text-sm font-bold uppercase">Imported legend</span>
            <span className="text-[11px] text-muted-foreground">Real NFL career stats</span>
          </li>
        )}
        {stints.map((s, i) => (
          <Stint key={s.key} stint={s} index={i} total={n} />
        ))}
        {undatedRings > 0 && (
          <li className="arc-node pc-enter" style={{ '--i': n + 1 } as CSSProperties}>
            <span className="flex items-center gap-1 text-gold">
              <RingGlyph className="h-4 w-4" />
              <span className="font-display text-2xl font-bold leading-none">{undatedRings}</span>
            </span>
            <span className="font-display text-sm font-bold uppercase">
              {undatedRings === totalRings ? (undatedRings === 1 ? 'Ring' : 'Rings') : `More ${undatedRings === 1 ? 'ring' : 'rings'}`}
            </span>
            <span className="text-[11px] leading-snug text-muted-foreground">Year not on record</span>
          </li>
        )}
        {hallOfFame && (
          <li className="arc-node arc-node--gold pc-enter" style={{ '--i': n + 2 } as CSSProperties}>
            <Trophy className="h-4 w-4" aria-hidden="true" />
            <span className="font-display text-sm font-bold uppercase">Hall of Fame</span>
            <span className="font-pixel text-[9px] uppercase">{hallOfFame.tier}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">Career Legacy over the bar; induction year not recorded</span>
          </li>
        )}
        {retired && (
          <li className="arc-node arc-node--gold pc-enter" style={{ '--i': n + 3 } as CSSProperties}>
            <Shirt className="h-4 w-4" aria-hidden="true" />
            <span className="font-display text-sm font-bold uppercase">#{retired.number} retired</span>
            <span className="text-[11px] leading-snug text-muted-foreground">
              By the {retired.teamLabel}
              {retired.years ? ` · ${retired.years}` : ''}
            </span>
          </li>
        )}
      </ol>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="arc-key arc-key--solid" aria-hidden="true" /> Confirmed: stated in his notes or the league sheet
        </span>
        {anyLikely && (
          <span className="inline-flex items-center gap-1">
            <span className="arc-key arc-key--dashed" aria-hidden="true" /> Likely: inferred from his eras and Super Bowl results (tap or hover a ring for why)
          </span>
        )}
        <span>No season-by-season data, so stops are in order, not to scale.</span>
      </p>
    </div>
  );
};

export default CareerArc;
