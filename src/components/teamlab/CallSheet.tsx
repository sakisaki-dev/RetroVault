import type { CSSProperties } from 'react';
import {
  AlarmClock,
  ArrowRightLeft,
  Flag,
  Footprints,
  Hand,
  Hourglass,
  Info,
  Megaphone,
  Plus,
  Printer,
  Repeat2,
  Ruler,
  Shield,
  Swords,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useJerseyNumbers } from '@/utils/jerseys';
import { getTeamColors } from '@/utils/teamColors';
import type { FourthCall, Impact, PlayerProfile, Situation, TeamAnalysis } from '@/utils/teamLab';
import './teamlab.css';

const SITUATION_ICON: Record<Situation | string, LucideIcon> = {
  every: Megaphone,
  early: Zap,
  'third-short': Footprints,
  'third-medium': Target,
  'third-long': Ruler,
  redzone: Flag,
  'two-point': Plus,
  fourth: Repeat2,
  lead: Shield,
  trailing: AlarmClock,
  takeaway: Hand,
  half: Hourglass,
  // Head-to-head matchup ids
  pass: Target,
  run: Footprints,
  protect: Shield,
  secure: Hand,
  cover: Shield,
  'stop-run': Footprints,
  rush: Zap,
  overall: Swords,
};

/** Icon for a call-sheet situation or a head-to-head matchup id. */
export const SituationIcon = ({ id, className }: { id: string; className?: string }) => {
  const Icon = SITUATION_ICON[id] ?? Megaphone;
  return <Icon className={className} aria-hidden="true" />;
};

const IMPACT: Record<Impact, { label: string; edge: string; tag: string }> = {
  high: { label: 'High', edge: 'border-l-gold', tag: 'bg-gold text-black' },
  med: { label: 'Med', edge: 'border-l-turf', tag: 'bg-turf/30 text-chalk' },
  low: { label: 'Low', edge: 'border-l-line', tag: 'bg-panel-2 text-muted-foreground' },
};

/** Impact tag: always printed as text; the colour only reinforces it. */
export const ImpactTag = ({ impact }: { impact: Impact }) => (
  <span className={cn('shrink-0 rounded-sm px-1 py-px font-pixel text-[7px] uppercase leading-none', IMPACT[impact].tag)}>
    <span className="sr-only">Impact: </span>
    {IMPACT[impact].label}
  </span>
);

/** Team-coloured jersey-number plate for the player a call is aimed at. */
export const NumberPlate = ({ p }: { p: PlayerProfile }) => {
  const { numberFor } = useJerseyNumbers();
  const c = getTeamColors(p.team);
  return (
    <span
      className="number-plate inline-flex h-5 min-w-[1.6rem] shrink-0 items-center justify-center px-1 font-display text-xs font-extrabold italic tabular-nums text-white [clip-path:polygon(14%_0,100%_0,86%_100%,0_100%)]"
      style={{ background: c ? `hsl(${c.primary})` : 'hsl(var(--line))', textShadow: '0 1px 0 rgb(0 0 0 / 0.5)' } as CSSProperties}
      title={`${p.position} ${p.name}`}
    >
      <span aria-hidden="true">{numberFor(p.player)}</span>
      <span className="sr-only">
        {p.position} {p.name}
      </span>
    </span>
  );
};

/** ⓘ that reveals the stat reason: tap opens a popover, hover shows the title. */
export const WhyButton = ({ why, subject }: { why: string; subject: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        title={why}
        aria-label={`Why: ${subject}`}
        className="no-print shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent side="top" className="z-[70] w-72 border-line bg-popover p-3 text-sm text-chalk/90">
      {why}
    </PopoverContent>
  </Popover>
);

const FOURTH_STYLE: Record<FourthCall, string> = {
  GO: 'bg-turf/35 text-chalk ring-turf/70',
  FG: 'bg-gold/25 text-chalk ring-gold/60',
  PUNT: 'bg-panel-2 text-muted-foreground ring-line',
};

const CallSheet = ({ analysis: a }: { analysis: TeamAnalysis }) => {
  const S = a.slots;
  return (
    <section id="lab-callsheet" aria-labelledby="lab-callsheet-title" className="glass-card min-w-0 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 id="lab-callsheet-title" className="section-title min-w-[10rem] flex-1 text-lg">
          <Megaphone className="h-5 w-5 text-gold" aria-hidden="true" /> Call sheet
        </h3>
        <Button type="button" size="sm" variant="outline" className="no-print h-7 border-line px-2 text-xs" onClick={() => window.print()}>
          <Printer className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Print wristband
        </Button>
      </div>

      {/* Must-knows */}
      <ol className="mb-3 space-y-1" aria-label="Must-knows">
        {a.mustKnows.map((r) => (
          <li key={r.id} className={cn('flex min-w-0 items-center gap-2 rounded-r-md border-l-4 bg-black/45 py-1.5 pl-2 pr-1.5', IMPACT[r.impact].edge)}>
            <ImpactTag impact={r.impact} />
            <span className="min-w-0 flex-1 font-display text-[17px] font-extrabold uppercase leading-tight tracking-wide text-chalk">{r.short}</span>
            <span className="lamp shrink-0">
              <b>{r.stat}</b>
            </span>
            <WhyButton why={r.why} subject={r.short} />
          </li>
        ))}
      </ol>

      {/* Situations */}
      <div className="grid gap-1.5 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {a.callSheet.map((g) => {
          return (
            <div key={g.situation} className="min-w-0 rounded-md bg-black/35 p-2 ring-1 ring-line/50">
              <p className="mb-1 flex items-center gap-1.5 font-pixel text-[9px] uppercase text-gold">
                <SituationIcon id={g.situation} className="h-3.5 w-3.5" /> {g.label}
              </p>
              <ul className="space-y-1">
                {g.calls.map((c, i) => (
                  <li key={i} className={cn('flex min-w-0 items-center gap-1.5 border-l-2 pl-1.5', IMPACT[c.impact].edge)}>
                    {c.target && <NumberPlate p={S[c.target]} />}
                    <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-chalk">{c.text}</span>
                    <ImpactTag impact={c.impact} />
                    <WhyButton why={c.why} subject={c.text} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Decision charts */}
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 font-pixel text-[9px] uppercase text-gold">
            <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" /> 4th-down chart
          </p>
          <table className="w-full table-fixed border-separate border-spacing-0.5 text-center text-[11px]">
            <caption className="sr-only">4th down: go, field goal or punt by field zone and distance. {a.fourthDown.note}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[38%] text-left font-normal text-muted-foreground">
                  Zone \ to go
                </th>
                {a.fourthDown.distances.map((d) => (
                  <th key={d} scope="col" className="font-display text-sm font-bold text-chalk">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.fourthDown.zones.map((z, zi) => (
                <tr key={z}>
                  <th scope="row" className="truncate text-left font-normal text-muted-foreground">
                    {z}
                  </th>
                  {a.fourthDown.cells[zi].map((c, di) => (
                    <td key={di} className={cn('rounded-sm py-1 font-display text-sm font-extrabold ring-1', FOURTH_STYLE[c])}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-muted-foreground">{a.fourthDown.note}</p>
        </div>
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 font-pixel text-[9px] uppercase text-gold">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> After a TD, late
          </p>
          <table className="w-full table-fixed border-separate border-spacing-0.5 text-center text-[11px]">
            <caption className="sr-only">Two-point chart: score margin after the touchdown, go for 2 or kick. {a.twoPoint.note}</caption>
            <thead>
              <tr>
                {a.twoPoint.cells.map((c) => (
                  <th key={c.margin} scope="col" className="font-normal text-muted-foreground">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {a.twoPoint.cells.map((c) => (
                  <td key={c.margin} className={cn('rounded-sm py-1 font-display text-sm font-extrabold ring-1', c.go ? FOURTH_STYLE.GO : FOURTH_STYLE.PUNT)}>
                    {c.go ? 'GO 2' : 'KICK'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-muted-foreground">Margin after the TD, before the try. {a.twoPoint.note}</p>
        </div>
      </div>

      {/* Target board */}
      <div className="mt-3">
        <p className="mb-1 flex items-center gap-1.5 font-pixel text-[9px] uppercase text-gold">
          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" /> Who gets the ball
        </p>
        <ul className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
          {a.targets.map((t) => (
            <li key={t.slot} className="min-w-0 rounded-md bg-black/35 p-2 ring-1 ring-line/50">
              <p className="flex min-w-0 items-center gap-1.5">
                <NumberPlate p={t.profile} />
                <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold uppercase italic text-chalk">{t.profile.name}</span>
                <span className="font-pixel text-[8px] text-muted-foreground">{t.profile.position}</span>
              </p>
              <p className="mt-1 flex flex-wrap gap-1">
                {t.roles.map((r) => (
                  <span
                    key={r.label}
                    className={cn(
                      'rounded-sm px-1 py-px text-[10px] font-semibold',
                      r.tone === 'good' ? 'bg-turf/25 text-chalk' : r.tone === 'warn' ? 'bg-destructive/25 text-chalk' : 'bg-panel-2 text-muted-foreground',
                    )}
                  >
                    {r.tone === 'warn' && <span aria-hidden="true">⚠ </span>}
                    {r.label}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{t.numbers.join(' · ')}</p>
            </li>
          ))}
        </ul>
      </div>

      <details className="no-print mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-chalk">Full game plan with reasons</summary>
        <ol className="mt-2 space-y-1.5">
          {a.gamePlan.map((r, i) => (
            <li key={r.id} className={cn('rounded-r border-l-2 bg-black/30 py-1 pl-2 pr-1', IMPACT[r.impact].edge)}>
              <p className="flex items-center gap-2 font-semibold text-chalk">
                <span className="tabular-nums text-gold">{i + 1}.</span> {r.title} <ImpactTag impact={r.impact} />
              </p>
              <p className="text-xs text-chalk/80">{r.what}</p>
              <p className="text-xs text-muted-foreground">{r.why}</p>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
};

export default CallSheet;
