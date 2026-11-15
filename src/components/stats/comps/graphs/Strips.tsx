import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import TeamLogo from '@/components/brand/TeamLogo';
import { cn } from '@/lib/utils';
import { ordinal } from '../../analytics/viz';
import type { Career } from './careerStory';
import { BOX, groupOf, seasonRates } from './statDefs';
import { EVENT_LABEL, GlyphIcon, clubInk, pctFill, yLabel } from './graphKit';
import { seasonScore } from './careerModel';

const shortYear = (y: number, narrow: boolean) => (narrow ? `'${y % 100}` : yLabel(y));

/**
 * Percentile heat strip: seasons across, his skill-grade traits (and the box stats per game) down, each cell his
 * percentile among the position's qualifying seasons that year. Lighter = better. Tap a cell to move the cursor.
 */
export const HeatStrip = ({ player, career, idx, onIdx, wide }: { player: Player; career: Career; idx: number; onIdx: (i: number) => void; wide: boolean }) => {
  const pts = career.points;
  const rates = seasonRates(player.position).filter((r) => pts.some((p) => Number.isFinite(p.pct[r.id])));
  const box = BOX[groupOf(player.position)].filter((b) => pts.some((p) => Number.isFinite(p.pct[b.key])));
  const rows = [
    { id: '__score', label: 'Season score', pct: (i: number) => seasonScore(player.position, pts[i]) ?? undefined, title: 'Mean percentile of his skill-grade traits that season' },
    ...rates.map((r) => ({ id: r.id, label: r.trait ? r.name : r.label, pct: (i: number) => pts[i].pct[r.id], title: r.definition })),
    ...box.map((b) => ({ id: `b:${b.key}`, label: `${b.short}/G`, pct: (i: number) => pts[i].pct[b.key], title: `${b.label} per game` })),
  ];
  const narrow = !wide && pts.length > 10;
  const label = wide ? '9.5rem' : '5.6rem';
  const grid: CSSProperties = { gridTemplateColumns: `${label} repeat(${pts.length}, minmax(0, 1fr))` };
  return (
    <div className="cg-card glass-card cg-span">
      <h3>Percentile heat strip</h3>
      <p className="cg-sub">
        Each season ranked among {player.position}s with 8+ games that season (rates, and box stats per game). Lighter is better; hatched: no season line. Rates
        needing attempts or carries appear only where the live save supplies them.
      </p>
      <div className="cg-heat" style={grid} role="table" aria-label={`${player.name} percentiles by season`} data-no-swipe-x>
        <span role="columnheader" />
        {pts.map((p, i) => (
          <span key={p.year} role="columnheader" className={cn('text-center text-[9.5px] tabular-nums', i === idx ? 'font-bold text-gold' : 'text-muted-foreground')}>
            {shortYear(p.year, narrow)}
          </span>
        ))}
        {rows.map((r) => (
          <div key={r.id} role="row" className="contents">
            <span role="rowheader" className={cn('cg-heat__row', r.id === '__score' && 'text-gold')} title={r.title}>
              {r.label}
            </span>
            {pts.map((p, i) => {
              const pct = r.pct(i);
              const f = pctFill(pct);
              const has = pct != null && Number.isFinite(pct);
              return (
                <button
                  key={p.year}
                  type="button"
                  role="cell"
                  onClick={() => onIdx(i)}
                  className={cn('cg-heat__cell', !has && 'cg-heat__cell--none', i === idx && 'cg-heat__cell--sel')}
                  style={has ? { background: f.bg, color: f.ink } : undefined}
                  aria-label={`${r.label}, ${yLabel(p.year)}: ${has ? `${ordinal(pct!)} percentile` : 'no season line'}`}
                  title={`${r.label} · ${yLabel(p.year)}: ${has ? `${ordinal(pct!)} percentile` : 'no season line'}`}
                >
                  {has && !narrow ? Math.round(pct!) : has && pct! >= 90 ? '★' : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground" aria-hidden="true">
        <span>0</span>
        <span className="h-2 w-32 rounded-sm" style={{ background: `linear-gradient(90deg, ${pctFill(0).bg}, ${pctFill(50).bg}, ${pctFill(100).bg})` }} />
        <span>100th percentile</span>
        {narrow && <span>· ★ = 90th+</span>}
      </div>
    </div>
  );
};

/**
 * The trophy shelf: one column per season with his rings stacking up (the season's new ones bright), the awards and
 * records that came that season, and the club logo; the Hall of Fame class closes it.
 */
export const TrophyShelf = ({ player, career, idx, onIdx, wide }: { player: Player; career: Career; idx: number; onIdx: (i: number) => void; wide: boolean }) => {
  const pts = career.points;
  const narrow = !wide && pts.length > 10;
  const hof = career.events.find((e) => e.kind === 'hof');
  const total = pts[pts.length - 1].totals.rings ?? 0;
  const grid: CSSProperties = { gridTemplateColumns: `repeat(${pts.length}, minmax(0, 1fr))` };
  const awardsOf = (y: number) => career.events.filter((e) => e.year === y && e.kind !== 'ring' && e.kind !== 'club' && e.kind !== 'hof');
  return (
    <div className="cg-card glass-card cg-span">
      <h3>Trophy shelf</h3>
      <p className="cg-sub">
        Rings stack up season by season ({total} in all{pts[0].totals.rings ? `, ${pts[0].totals.rings} before the records begin in ${yLabel(pts[0].year)}` : ''}); the season&rsquo;s new ones glow. Awards and
        records sit on top, the club underneath.
        {hof ? ` ${hof.label}: ${hof.detail}.` : ''}
      </p>
      <div className="cg-shelf" style={grid} data-no-swipe-x>
        {pts.map((p, i) => {
          const rings = p.totals.rings ?? 0;
          const fresh = p.awards?.rings ?? 0;
          const aw = awardsOf(p.year);
          const ink = clubInk(career.clubs[i]);
          const label = `${yLabel(p.year)}: ${rings} career ring${rings === 1 ? '' : 's'}${fresh ? ` (${fresh} new)` : ''}${aw.length ? `; ${aw.map((e) => e.label).join(', ')}` : ''}`;
          return (
            <button key={p.year} type="button" onClick={() => onIdx(i)} className={cn('cg-shelf__col', i === idx && 'cg-shelf__col--sel')} aria-label={label} title={label}>
              <span className={cn('text-[9.5px] tabular-nums', i === idx ? 'font-bold text-gold' : 'text-muted-foreground')}>{shortYear(p.year, narrow)}</span>
              <span className="flex h-5 items-center justify-center" style={{ opacity: ink.team ? 1 : 0.3 }}>
                {ink.team ? <TeamLogo team={ink.team} size={narrow ? 14 : 18} decorative /> : <span className="text-[9px] text-muted-foreground">—</span>}
              </span>
              <span className="flex flex-col-reverse items-center gap-px" aria-hidden="true">
                {Array.from({ length: rings }, (_, r) => (
                  <span key={r} style={{ opacity: r >= rings - fresh ? 1 : 0.42, filter: r >= rings - fresh ? 'drop-shadow(0 0 3px hsl(43 100% 62% / 0.8))' : undefined }}>
                    <GlyphIcon kind="ring" px={narrow ? 1.6 : 2} />
                  </span>
                ))}
              </span>
              {rings > 0 && <span className="font-display text-[10px] font-bold tabular-nums text-gold">{rings}</span>}
              <span className="flex flex-col-reverse items-center gap-0.5" aria-hidden="true">
                {aw.slice(0, 4).map((e, k) => (
                  <GlyphIcon key={k} kind={e.kind} px={narrow ? 1.6 : 2} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="cg-legend" aria-label="Glyph key">
        {(['ring', 'mvp', 'poy', 'sbmvp', 'record', 'final', 'ceiling'] as const)
          .filter((k) => k === 'ring' || career.events.some((e) => e.kind === k))
          .map((k) => (
            <li key={k}>
              <GlyphIcon kind={k} px={2} />
              {EVENT_LABEL[k]}
            </li>
          ))}
      </ul>
    </div>
  );
};
