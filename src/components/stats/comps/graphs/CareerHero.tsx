import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { Player } from '@/types/player';
import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import { useWidth } from '../../visual/chartKit';
import HeroPlot, { HERO_M, heroGeom } from './HeroPlot';
import SeasonPanel from './SeasonPanel';
import { SparkRows } from './Extras';
import type { Career } from './careerStory';
import { clubInk, yLabel, type GraphMetric } from './graphKit';

/** Metric chips, grouped (Card · Season · Rates), in one scrolling row. */
export const MetricChips = ({ metrics, value, onChange, label }: { metrics: GraphMetric[]; value: string; onChange: (id: string) => void; label: string }) => {
  const groups = ['Card', 'Season', 'Rate'] as const;
  return (
    <div role="radiogroup" aria-label={label} className="cg-chips scrollbar-none" data-no-swipe-x>
      {groups.map((g) => {
        const ms = metrics.filter((m) => m.group === g);
        if (!ms.length) return null;
        return (
          <span key={g} className="cg-chips__group">
            <span className="cg-chips__label">{g === 'Rate' ? 'Rates' : g}</span>
            {ms.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === value}
                title={m.definition}
                onClick={() => onChange(m.id)}
                className={cn('cg-chip', m.id === value && 'cg-chip--on')}
              >
                {m.short}
              </button>
            ))}
          </span>
        );
      })}
    </div>
  );
};

/** Consecutive seasons at one club, for the logo strip over the chart. */
const clubRuns = (career: Career) => {
  const runs: { club: string | null; from: number; to: number }[] = [];
  career.clubs.forEach((c, i) => {
    const last = runs[runs.length - 1];
    if (last && last.club === c) last.to = i;
    else runs.push({ club: c, from: i, to: i });
  });
  return runs;
};

/**
 * The career timeline hero: a wide chart of one metric by season over bands in each club's colours (logos above), with
 * ring, award and record glyphs on the seasons they came, and a season cursor: drag a finger across it to scrub
 * (a vertical drag still scrolls the page), hover on a desktop, arrows on a keyboard. The side panel follows the
 * cursor. Only the cursor and the panel re-render as it moves; the chart is memoised.
 */
const CareerHero = ({
  player,
  career,
  metrics,
  metricId,
  onMetric,
  idx,
  onIdx,
  wide,
  reduced,
}: {
  player: Player;
  career: Career;
  metrics: GraphMetric[];
  metricId: string;
  onMetric: (id: string) => void;
  idx: number;
  onIdx: (i: number) => void;
  wide: boolean;
  reduced: boolean;
}) => {
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const [ref, width] = useWidth();
  const height = wide ? 300 : 210;
  const n = career.points.length;
  const geom = useMemo(() => (width > 0 ? heroGeom(career, metric, width, height) : null), [career, metric, width, height]);
  const runs = useMemo(() => clubRuns(career), [career]);
  const box = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const pending = useRef<number | null>(null);
  const dragging = useRef(false);

  const idxAt = useCallback(
    (clientX: number) => {
      const el = box.current;
      if (!el || !geom) return null;
      const r = el.getBoundingClientRect();
      const i = Math.floor((clientX - r.left - HERO_M.l) / geom.colW);
      return Math.max(0, Math.min(n - 1, i));
    },
    [geom, n],
  );
  const schedule = (clientX: number) => {
    pending.current = clientX;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const i = pending.current == null ? null : idxAt(pending.current);
      if (i != null && i !== idx) onIdx(i);
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    if (e.pointerType === 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
    schedule(e.clientX);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || dragging.current) schedule(e.clientX);
  };
  const onUp = () => {
    dragging.current = false;
  };
  const onKey = (e: KeyboardEvent) => {
    const j = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? idx + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? idx - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (j == null) return;
    e.preventDefault();
    onIdx(Math.max(0, Math.min(n - 1, j)));
  };

  const p = career.points[idx];
  const v = geom?.values[idx];
  const cx = geom ? geom.x(idx) : 0;
  const cy = geom && v != null && Number.isFinite(v) ? geom.y(v) : null;
  const club = career.clubs[idx];
  const valueText = `${yLabel(p.year)}${club ? `, ${club}` : ''}: ${metric.label} ${v == null ? 'no value' : metric.fmt(v)}`;

  return (
    <div className="cg-hero glass-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-base font-bold uppercase tracking-wide">Career timeline</h3>
        <p className="text-[11px] text-muted-foreground">{metric.definition}</p>
      </div>
      <MetricChips metrics={metrics} value={metric.id} onChange={onMetric} label="Timeline metric" />
      <div className="cg-hero__grid">
        <div className="min-w-0">
          {/* club strip: one segment per stint, logo and name, aligned to the chart's seasons */}
          <div className="cg-clubs" style={{ paddingLeft: HERO_M.l, paddingRight: HERO_M.r }} aria-label="Clubs by season">
            {geom &&
              runs.map((r) => {
                const ink = clubInk(r.club);
                const w = (r.to - r.from + 1) * geom.colW;
                return (
                  <span key={`${r.club}-${r.from}`} className="cg-clubs__seg" style={{ width: w, borderColor: ink.mark, color: ink.mark }} title={r.club ? `${r.club}: ${yLabel(career.points[r.from].year)}–${yLabel(career.points[r.to].year)}` : 'Retired'}>
                    {ink.team ? <TeamLogo team={ink.team} size={16} decorative /> : null}
                    {w > 64 && <span className="truncate">{r.club ?? 'Retired'}</span>}
                  </span>
                );
              })}
          </div>
          <div
            ref={(el) => {
              box.current = el;
              ref(el);
            }}
            className="cg-plot"
            style={{ height }}
            data-no-swipe-x
            role="slider"
            tabIndex={0}
            aria-label={`${player.name} season cursor`}
            aria-valuemin={career.points[0].year}
            aria-valuemax={career.points[n - 1].year}
            aria-valuenow={p.year}
            aria-valuetext={valueText}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={(e) => e.pointerType === 'mouse' || onUp()}
            onKeyDown={onKey}
          >
            {width > 0 && <HeroPlot career={career} metric={metric} width={width} height={height} reduced={reduced} />}
            {geom && (
              <div className={cn('cg-cursor', reduced && 'cg-cursor--still')} style={{ transform: `translateX(${cx}px)`, top: HERO_M.t - 2, bottom: HERO_M.b }} aria-hidden="true">
                <span className="cg-cursor__pill">{yLabel(p.year)}</span>
              </div>
            )}
            {geom && cy != null && (
              <div className={cn('cg-dot', reduced && 'cg-cursor--still', cx > width - 90 && 'cg-dot--flip')} style={{ transform: `translate(${cx}px, ${cy}px)` }} aria-hidden="true">
                <span className="cg-dot__val">{metric.fmt(v as number)}</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Drag across the chart to scrub seasons{wide ? ' (or hover; arrow keys when focused)' : ''}. Hatched: no season line (first record, idle or an import correction). Hollow dot: a short or live season.
          </p>
          <SparkRows career={career} metrics={metrics} metricId={metric.id} onMetric={onMetric} idx={idx} />
        </div>
        <SeasonPanel player={player} career={career} idx={idx} />
      </div>
    </div>
  );
};

export default CareerHero;
