import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import TeamLogo from './TeamLogo';
import { MarkerButton } from './SuperBowlMarker';
import { useRovingFocus } from './useRovingFocus';
import { describeSuperBowl, eraForYear, type PlacedEra, type TimelineModel, type YearSlot } from './timelineModel';
import Collapse from '@/components/ui/collapse';

interface TrackProps {
  model: TimelineModel;
  season?: string;
  selectedEraId: string | null;
  activeYear: number | null;
  detailId: string;
  onSelectEra: (id: string | null) => void;
  onActiveYear: (year: number | null) => void;
  /** Mobile renders the open era's detail inline under its card. */
  renderDetail?: (placed: PlacedEra) => ReactNode;
}

const eraLabel = (p: PlacedEra) =>
  `${p.era.name}, Y${p.era.startYear} to Y${p.era.endYear}. ${p.record.won} Super Bowl wins, ${p.record.lost} losses.`;

// ---------------------------------------------------------------------------
// Desktop: horizontal track
// ---------------------------------------------------------------------------

export const HorizontalTrack = ({
  model,
  season,
  selectedEraId,
  activeYear,
  detailId,
  onSelectEra,
  onActiveYear,
}: TrackProps) => {
  const { firstYear, lastYear, years, eras, laneCount, gaps } = model;
  const cols = lastYear - firstYear + 1;
  const col = (y: number) => y - firstYear + 1;
  const eraNav = useRovingFocus(eras.length);
  const yearNav = useRovingFocus(years.length, years.length - 1);
  const ticks = years.filter((s) => s.year === firstYear || s.year % 10 === 0);

  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[760px] space-y-1.5 px-1">
        {/* Era bands */}
        <div
          role="group"
          aria-label="Eras. Use arrow keys to move between eras, Enter to open one."
          className="grid gap-x-0 gap-y-1.5"
          style={{ ...grid, gridTemplateRows: `repeat(${laneCount}, 56px)` }}
          onKeyDown={eraNav.onKeyDown}
        >
          {gaps.map((g) => (
            <div
              key={`gap-${g.startYear}`}
              aria-hidden
              className="flex items-center justify-center rounded-md border border-dashed border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground/60"
              style={{ gridColumn: `${col(g.startYear)} / ${col(g.endYear) + 1}`, gridRow: 1 }}
              title={`Y${g.startYear}${g.endYear !== g.startYear ? `–${g.endYear}` : ''}: between eras`}
            >
              {g.endYear - g.startYear >= 1 ? '·' : ''}
            </div>
          ))}
          {eras.map((p, i) => {
            const span = p.era.endYear - p.era.startYear + 1;
            const selected = selectedEraId === p.era.id;
            const dimmed = selectedEraId !== null && !selected;
            return (
              <button
                key={p.era.id}
                type="button"
                {...eraNav.itemProps(i)}
                aria-expanded={selected}
                aria-controls={selected ? detailId : undefined}
                aria-label={eraLabel(p)}
                onClick={() => onSelectEra(selected ? null : p.era.id)}
                className={cn(
                  'group relative mx-px flex min-w-0 flex-col justify-center overflow-hidden rounded-md px-2 text-left text-white outline-none transition-[transform,opacity,box-shadow] duration-200',
                  'shadow-sm ring-1 ring-black/20 hover:-translate-y-0.5 hover:shadow-lg',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  selected && 'ring-2 ring-foreground -translate-y-0.5 shadow-lg',
                  dimmed && 'opacity-55 hover:opacity-100 focus-visible:opacity-100',
                )}
                style={{ gridColumn: `${col(p.era.startYear)} / ${col(p.era.endYear) + 1}`, gridRow: p.lane + 1, background: p.background }}
              >
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/35" />
                <span className="relative flex items-center gap-1.5" style={{ textShadow: '0 1px 2px rgb(0 0 0 / 0.7)' }}>
                  {span >= 7 &&
                    p.era.yourTeams.slice(0, 3).map((t) => (
                      <TeamLogo key={t} team={t} decorative className="h-5 w-5 flex-shrink-0 drop-shadow" />
                    ))}
                  <span className="truncate font-display text-xs font-bold uppercase tracking-wide xl:text-sm">{p.era.name}</span>
                </span>
                <span className="relative truncate text-[10px] font-medium text-white/85" style={{ textShadow: '0 1px 2px rgb(0 0 0 / 0.7)' }}>
                  Y{p.era.startYear}–{p.era.endYear}
                  {span >= 5 ? ` · ${p.record.won}–${p.record.lost}` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Team ribbon: your franchise in each Super Bowl appearance */}
        <div className="grid h-1.5 overflow-hidden rounded-full bg-secondary/40" style={grid} aria-hidden>
          {years.map((s) => (
            <span key={s.year} style={{ background: s.coachColor ? `hsl(${s.coachColor})` : 'transparent' }} />
          ))}
        </div>

        {/* Super Bowl markers */}
        <div
          role="group"
          aria-label={`Super Bowl results, Y${firstYear} to Y${lastYear}. Use arrow keys to move between years.`}
          className="grid"
          style={grid}
          onKeyDown={yearNav.onKeyDown}
          onMouseLeave={() => onActiveYear(null)}
        >
          {years.map((s, i) => (
            <MarkerButton
              key={s.year}
              variant="column"
              yearSlot={s}
              active={activeYear === s.year}
              label={describeSuperBowl(s, season)}
              {...yearNav.itemProps(i)}
              onFocus={() => {
                yearNav.setIndex(i);
                onActiveYear(s.year);
              }}
              onMouseEnter={() => onActiveYear(s.year)}
              onClick={() => {
                onActiveYear(s.year);
                const era = eraForYear(model, s.year);
                if (era) onSelectEra(era.era.id);
              }}
            />
          ))}
        </div>

        {/* Axis */}
        <div className="relative grid h-4" style={grid} aria-hidden>
          {ticks.map((s) => (
            <span
              key={s.year}
              className="text-[10px] font-mono tabular-nums text-muted-foreground"
              style={{ gridColumn: `${col(s.year)} / span 1`, gridRow: 1 }}
            >
              <span className="block -translate-x-1/4 whitespace-nowrap">Y{s.year}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Mobile: vertical rail of era cards
// ---------------------------------------------------------------------------

type RailItem = { kind: 'era'; placed: PlacedEra } | { kind: 'gap'; start: number; end: number };

export const VerticalTrack = (props: TrackProps) => {
  const { model } = props;
  const items: RailItem[] = [
    ...model.eras.map((placed) => ({ kind: 'era' as const, placed, start: placed.era.startYear })),
    ...model.gaps.map((g) => ({ kind: 'gap' as const, start: g.startYear, end: g.endYear })),
  ].sort((a, b) => a.start - b.start);

  return (
    <ol className="relative space-y-4 pl-6" aria-label="Eras">
      <span aria-hidden className="absolute bottom-2 left-[9px] top-2 w-0.5 rounded-full bg-border/60" />
      {items.map((item) => (
        <Fragment key={item.kind === 'era' ? item.placed.era.id : `gap-${item.start}`}>
          {item.kind === 'era' ? (
            <EraCard {...props} placed={item.placed} />
          ) : (
            <GapRow {...props} start={item.start} end={item.end} />
          )}
        </Fragment>
      ))}
    </ol>
  );
};

const YearChips = ({
  slots,
  model,
  season,
  activeYear,
  onActiveYear,
  label,
}: {
  slots: YearSlot[];
  model: TimelineModel;
  season?: string;
  activeYear: number | null;
  onActiveYear: (y: number | null) => void;
  label: string;
}) => {
  const nav = useRovingFocus(slots.length);
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1"
      onKeyDown={nav.onKeyDown}
    >
      {slots.map((s, i) => (
        <MarkerButton
          key={s.year}
          variant="chip"
          yearSlot={s}
          active={activeYear === s.year}
          label={describeSuperBowl(s, season)}
          {...nav.itemProps(i)}
          onFocus={() => {
            nav.setIndex(i);
            onActiveYear(s.year);
          }}
          onClick={() => onActiveYear(s.year)}
        />
      ))}
    </div>
  );
};

const EraCard = ({
  placed,
  model,
  season,
  selectedEraId,
  activeYear,
  detailId,
  onSelectEra,
  onActiveYear,
  renderDetail,
}: TrackProps & { placed: PlacedEra }) => {
  const { era, record, dominantTeam } = placed;
  const selected = selectedEraId === era.id;
  const slots = model.years.filter((s) => s.year >= era.startYear && s.year <= era.endYear);
  const dot = model.years.find((s) => s.team === dominantTeam)?.color;

  return (
    <li className="relative">
      <span
        aria-hidden
        className="absolute -left-6 top-4 h-[18px] w-[18px] rounded-full border-2 border-background"
        style={{ background: dot ? `hsl(${dot})` : 'hsl(var(--muted))' }}
      />
      <div className={cn('overflow-hidden rounded-xl border bg-card', selected ? 'border-foreground/40' : 'border-border/40')}>
        <button
          type="button"
          aria-expanded={selected}
          aria-controls={selected ? detailId : undefined}
          onClick={() => onSelectEra(selected ? null : era.id)}
          className="relative block w-full p-3 text-left text-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          style={{ background: placed.background }}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-black/10" />
          <span className="relative flex items-center justify-between gap-2" style={{ textShadow: '0 1px 2px rgb(0 0 0 / 0.7)' }}>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Y{era.startYear}–{era.endYear}
                {era.superBowlRange ? ` · ${era.superBowlRange}` : ''}
              </span>
              <span className="block truncate font-display text-lg font-bold uppercase leading-tight">{era.name}</span>
              <span className="block text-xs text-white/85">
                {record.won}–{record.lost} in Super Bowls · {era.yourTeams.join(', ')}
              </span>
            </span>
            <span className="flex flex-shrink-0 -space-x-1.5">
              {era.yourTeams.slice(0, 3).map((t) => (
                <TeamLogo key={t} team={t} decorative className="h-7 w-7 rounded-full bg-black/30 p-0.5" />
              ))}
            </span>
          </span>
          <span className="sr-only">{selected ? ', collapse details' : ', expand details'}</span>
        </button>
        <div className="p-2">
          <YearChips
            slots={slots}
            model={model}
            season={season}
            activeYear={activeYear}
            onActiveYear={onActiveYear}
            label={`Super Bowl results during the ${era.name}`}
          />
        </div>
      </div>
      {renderDetail && (
        <Collapse open={selected}>
          <div className="pt-3">{renderDetail(placed)}</div>
        </Collapse>
      )}
    </li>
  );
};

const GapRow = ({ start, end, model, season, activeYear, onActiveYear }: TrackProps & { start: number; end: number }) => {
  const slots = model.years.filter((s) => s.year >= start && s.year <= end);
  return (
    <li className="relative">
      <span aria-hidden className="absolute -left-[21px] top-3 h-3 w-3 rounded-full border-2 border-dashed border-muted-foreground/60 bg-background" />
      <div className="rounded-xl border border-dashed border-border/50 p-2">
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Y{start}
          {end !== start ? `–${end}` : ''} · Between eras
        </p>
        <YearChips
          slots={slots}
          model={model}
          season={season}
          activeYear={activeYear}
          onActiveYear={onActiveYear}
          label={`Super Bowl results, Y${start} to Y${end}`}
        />
      </div>
    </li>
  );
};
