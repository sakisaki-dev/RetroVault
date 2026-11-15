import { useMemo, useState } from 'react';
import type { Player, Position } from '@/types/player';
import { cn } from '@/lib/utils';
import { peekKeyProps } from '@/components/peek/peekProps';
import { GOLD } from '../../visual/chartKit';
import { VIZ } from '../../analytics/viz';
import type { LeagueSeasons } from './careerModel';
import type { Career } from './careerStory';
import { BOX, HEADLINE, groupOf } from './statDefs';
import MultiLine, { type LineSeries, type Marker } from './MultiLine';
import { shortNum, yLabel } from './graphKit';

const OTHERS = [VIZ.series[0], VIZ.series[1], VIZ.series[2]];
const posOf = (k: string) => k.slice(0, k.indexOf(':')) as Position;
const nameOf = (k: string) => k.slice(k.indexOf(':') + 1);

/**
 * The cumulative race: his career total of one stat at each season end against the position's all-time top five in
 * it (the league record holder first), with the record as a line, and a ring where he passed each of them.
 */
const RaceChart = ({ player, career, league, idx, onIdx }: { player: Player; career: Career; league: LeagueSeasons; idx: number; onIdx: (i: number) => void }) => {
  const g = groupOf(player.position);
  const [stat, setStat] = useState(HEADLINE[g]);
  const key = career.key;
  const data = useMemo(() => {
    const years = league.seasons.filter((y) => y >= career.points[0].year);
    const same = [...league.byKey.entries()].filter(([k]) => groupOf(posOf(k)) === g);
    const final = (pts: typeof career.points) => pts.filter((p) => p.status !== 'live').slice(-1)[0]?.totals[stat] ?? 0;
    const ranked = same.map(([k, pts]) => ({ k, total: final(pts), pts })).sort((a, b) => b.total - a.total);
    const record = ranked[0];
    const top = ranked.filter((r) => r.k !== key && r.total > 0).slice(0, 5);
    const line = (pts: typeof career.points) => years.flatMap((y) => {
      const p = pts.find((q) => q.year === y && q.status !== 'live');
      return p ? [{ x: y, y: p.totals[stat] ?? 0 }] : [];
    });
    const mine = line(career.points);
    const series: LineSeries[] = top.map((r, i) => ({
      key: r.k,
      label: nameOf(r.k).split(' ').slice(-1)[0],
      color: i < 3 ? OTHERS[i] : VIZ.muted,
      points: line(r.pts),
      width: 1.5,
      dash: i >= 3 ? '3 3' : undefined,
      peekKey: r.k,
    }));
    series.push({ key, label: player.name.split(' ').slice(-1)[0], color: GOLD, points: mine, width: 3 });
    // where he passed each of them
    const markers: Marker[] = [];
    const passed: { k: string; year: number }[] = [];
    top.forEach((r, i) => {
      const theirs = new Map(line(r.pts).map((p) => [p.x, p.y]));
      for (let j = 1; j < mine.length; j++) {
        const a = theirs.get(mine[j - 1].x);
        const b = theirs.get(mine[j].x);
        if (a != null && b != null && mine[j - 1].y < a && mine[j].y >= b && mine[j].y > 0) {
          markers.push({ x: mine[j].x, y: mine[j].y, label: `Passed ${nameOf(r.k)}`, color: i < 3 ? OTHERS[i] : VIZ.muted });
          passed.push({ k: r.k, year: mine[j].x });
          break;
        }
      }
    });
    const rank = 1 + ranked.filter((r) => r.k !== key && r.total > final(career.points)).length;
    return { years, series, markers, record, passed, rank, top };
  }, [league, career, g, stat, key, player.name]);
  const b = BOX[g].find((x) => x.key === stat)!;
  const holder = data.record && data.record.k !== key ? nameOf(data.record.k) : null;
  const sel = career.points[idx]?.year;
  return (
    <div className="cg-card glass-card cg-span">
      <h3>The race</h3>
      <p className="cg-sub">
        Career {b.label.toLowerCase()} at each season end against the all-time top five {g === 'DEF' ? 'defenders' : `${player.position}s`}. He is{' '}
        <b className="text-chalk">{data.rank === 1 ? 'the all-time leader' : `#${data.rank} all time`}</b>
        {holder ? <> · record: {holder} ({shortNum(data.record.total)})</> : null}.
      </p>
      <div className="cg-pick" role="radiogroup" aria-label="Race stat">
        {BOX[g].map((x) => (
          <button key={x.key} type="button" role="radio" aria-checked={x.key === stat} onClick={() => setStat(x.key)} className={cn('cg-chip', x.key === stat && 'cg-chip--on')}>
            {x.short}
          </button>
        ))}
      </div>
      <MultiLine
        series={data.series}
        xs={data.years}
        xLabel={yLabel}
        refLine={data.record ? { y: data.record.total, label: 'Record' } : undefined}
        markers={data.markers}
        selX={sel}
        onX={(y) => {
          const i = career.points.findIndex((p) => p.year === y);
          if (i >= 0) onIdx(i);
        }}
        ariaLabel={`${player.name}'s career ${b.label.toLowerCase()} by season against the top five`}
      />
      {data.passed.length > 0 && (
        <ul className="cg-legend">
          {data.passed.map((p) => (
            <li key={p.k} {...peekKeyProps(p.k)}>
              Passed <b className="text-chalk">{nameOf(p.k)}</b> in {yLabel(p.year)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RaceChart;
