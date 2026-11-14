import { useMemo, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Player } from '@/types/player';
import { formatNumber } from '@/utils/metricColors';
import { findNFLTeam } from '@/utils/nflTeams';
import ChartFrame from '../stats/analytics/ChartFrame';
import { VIZ } from '../stats/analytics/viz';
import { GOLD, niceStep, teamMark, useWidth } from '../stats/visual/chartKit';
import { ChartTip } from '../stats/visual/chartParts';
import { RATINGS, useSaveState, type Rating } from './saveData';
import { DECLINE_AGE, DEFENSE, OFFENSE, agePyramid, buildClock, finalAge, improveChance, ratingsByBin, type ClockPlayer } from './clockModel';
import { RATING_LABEL } from './clockParts';
import './clock.css';

/**
 * Stats › Graphs › Age curves (#stats/graphs/age-curves): the league's ages from the live save, in the Graphs page's
 * chart cards (ChartFrame: chart and table views). The age pyramid, the stars on the clock, the game's growth and
 * decline rules, and the league's own rating curves by age. All computed (clockModel.ts).
 */

const OFF_INK = VIZ.series[0];
const DEF_INK = VIZ.series[1];
const FLAG = 'hsl(354 90% 65%)';
const TURF = 'hsl(149 64% 45%)';
const tableCls = 'w-full text-left text-xs sm:text-sm [&_td]:border-t [&_td]:border-line/60 [&_td]:py-1 [&_th]:pb-1 [&_th]:font-semibold [&_th]:text-muted-foreground';

// ---------- 1. The age pyramid ----------

const Pyramid = ({ all }: { all: ClockPlayer[] }) => {
  const rows = useMemo(() => agePyramid(all), [all]);
  const peak = Math.max(1, ...rows.map((r) => Math.max(r.offN, r.defN)));
  const lastField = finalAge('RB', 0);
  const lastQb = finalAge('QB', 0);
  const parts = (side: typeof OFFENSE, counts: Partial<Record<string, number>>) =>
    side
      .filter((p) => counts[p])
      .map((p) => `${counts[p]} ${p}`)
      .join(' · ');
  return (
    <ChartFrame
      title="The age pyramid"
      icon={<CalendarClock className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`Every player on a club by age: offense left, defense right. Gold ages are final seasons (${lastField}, QBs ${lastQb}); red rows are the decline years (${DECLINE_AGE}+).`}
      chart={
        <div>
          <div className="clk-pyr__legend" aria-hidden="true">
            <span>
              <i style={{ background: OFF_INK }} /> Offense ({OFFENSE.join(', ')})
            </span>
            <span>
              <i style={{ background: DEF_INK }} /> Defense ({DEFENSE.join(', ')})
            </span>
          </div>
          <ol className="clk-pyr" aria-label="Players by age">
            {rows.map((r) => {
              const off = parts(OFFENSE, r.off);
              const def = parts(DEFENSE, r.def);
              const final = r.age === lastField || r.age === lastQb;
              return (
                <li
                  key={r.age}
                  className={r.age >= DECLINE_AGE ? 'clk-pyr__row is-decline' : 'clk-pyr__row'}
                  aria-label={`Age ${r.age}: ${r.offN} offense${off ? ` (${off})` : ''}, ${r.defN} defense${def ? ` (${def})` : ''}${final ? ', final season' : ''}`}
                >
                  <span className="clk-pyr__side clk-pyr__side--l" title={off} aria-hidden="true">
                    <span className="clk-pyr__lbl">{off}</span>
                    {r.offN > 0 && <i style={{ width: `${(r.offN / peak) * 82}%`, background: OFF_INK }} />}
                    <b>{r.offN || ''}</b>
                  </span>
                  <span className={final ? 'clk-pyr__age is-final' : 'clk-pyr__age'} aria-hidden="true">
                    {r.age}
                  </span>
                  <span className="clk-pyr__side" title={def} aria-hidden="true">
                    <b>{r.defN || ''}</b>
                    {r.defN > 0 && <i style={{ width: `${(r.defN / peak) * 82}%`, background: DEF_INK }} />}
                    <span className="clk-pyr__lbl">{def}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      }
      table={
        <table className={tableCls}>
          <thead>
            <tr>
              <th>Age</th>
              <th>Offense</th>
              <th>Defense</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.age}>
                <td>{r.age}</td>
                <td>
                  {r.offN} {parts(OFFENSE, r.off) && `(${parts(OFFENSE, r.off)})`}
                </td>
                <td>
                  {r.defN} {parts(DEFENSE, r.def) && `(${parts(DEFENSE, r.def)})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
};

// ---------- 2. Stars on the clock ----------

const fnv = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const shortName = (name: string) => {
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
};
const M = { top: 26, right: 14, bottom: 38, left: 52 };
const NAMED = 8;

const StarsScatter = ({ all, onSelect }: { all: ClockPlayer[]; onSelect: (p: Player) => void }) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<string | null>(null);
  const pts = useMemo(() => all.filter((c) => c.player && c.legacy > 0), [all]);
  const w = Math.max(300, width);
  const h = w < 520 ? 320 : 400;
  const ages = pts.map((c) => c.age);
  const a0 = Math.min(21, ...ages) - 0.6;
  const a1 = Math.max(...ages, finalAge('QB', 0)) + 0.6;
  const yMaxRaw = Math.max(1, ...pts.map((c) => c.legacy));
  const yStep = niceStep(yMaxRaw, 4);
  const yMax = Math.ceil(yMaxRaw / yStep) * yStep;
  const pw = w - M.left - M.right;
  const ph = h - M.top - M.bottom;
  const sx = (a: number) => M.left + ((a - a0) / (a1 - a0)) * pw;
  const sy = (v: number) => M.top + ph - (v / yMax) * ph;
  const placed = pts.map((c) => ({ c, x: sx(c.age + ((fnv(c.key) % 1000) / 1000 - 0.5) * 0.56), y: sy(c.legacy) }));
  const top = [...placed].sort((a, b) => b.c.legacy - a.c.legacy).slice(0, NAMED);
  // A name only where its label (logo + text) doesn't overlap a bigger star's (the rest stay focusable dots)
  const labelBox = (q: { c: ClockPlayer; x: number; y: number }) => {
    const wd = 26 + shortName(q.c.name).length * 6.6;
    const right = q.x > M.left + pw * 0.66;
    return right ? { x0: q.x - 10 - wd, x1: q.x - 6, y0: q.y - 10, y1: q.y + 10 } : { x0: q.x + 6, x1: q.x + 10 + wd, y0: q.y - 10, y1: q.y + 10 };
  };
  const boxes: ReturnType<typeof labelBox>[] = [];
  const named = new Set<string>();
  for (const s of top) {
    const b = labelBox(s);
    if (boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) continue;
    boxes.push(b);
    named.add(s.c.key);
  }
  const topKeys = new Set(top.map((s) => s.c.key));
  const hovered = placed.find((p) => p.c.key === hover);
  const ticksX: number[] = [];
  for (let a = Math.ceil(a0); a <= a1; a++) if (a % (w < 520 ? 3 : 2) === 0) ticksX.push(a);
  const ticksY: number[] = [];
  for (let v = 0; v <= yMax + 1e-6; v += yStep) ticksY.push(v);
  const xDecline = sx(DECLINE_AGE - 0.5);
  const lines = [
    { x: sx(finalAge('RB', 0)), t: `Final ${finalAge('RB', 0)}` },
    { x: sx(finalAge('QB', 0)), t: `QB final ${finalAge('QB', 0)}` },
  ];

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    let best: string | null = null;
    let bd = 26 * 26;
    for (const p of placed) {
      const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d < bd) {
        bd = d;
        best = p.c.key;
      }
    }
    setHover(best);
  };
  const onKey = (e: KeyboardEvent, c: ClockPlayer) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(c.player!);
    }
  };

  return (
    <ChartFrame
      title="Stars on the clock"
      icon={<CalendarClock className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`Every carded player on a club by age and Career Legacy, dots in club colours, the ${NAMED} biggest careers named with their club. The red band is the decline years (${DECLINE_AGE}+); dashed lines are the final seasons.`}
      chart={
        <div ref={ref} className="relative">
          <svg
            width={w}
            height={h}
            role="img"
            aria-label={`Age against Career Legacy for ${pts.length} players. Biggest careers: ${top.map((s) => `${s.c.name}, ${s.c.age}, ${formatNumber(Math.round(s.c.legacy))}`).join('; ')}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onClick={() => hovered && onSelect(hovered.c.player!)}
            className="block max-w-full touch-pan-y"
            style={{ cursor: hovered ? 'pointer' : 'default' }}
          >
            <rect x={xDecline} y={M.top} width={Math.max(0, M.left + pw - xDecline)} height={ph} fill={FLAG} opacity={0.08} />
            <text x={xDecline + 4} y={M.top - 8} fontSize={11} fontWeight={600} fill={FLAG}>
              Decline years ({DECLINE_AGE}+)
            </text>
            {ticksY.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + pw} y1={sy(v)} y2={sy(v)} stroke={VIZ.grid} />
                <text x={M.left - 8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.muted}>
                  {v >= 1000 ? `${v / 1000}k` : v}
                </text>
              </g>
            ))}
            {ticksX.map((a) => (
              <text key={a} x={sx(a)} y={M.top + ph + 18} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
                {a}
              </text>
            ))}
            <text x={M.left + pw / 2} y={h - 4} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
              Age
            </text>
            <text transform={`translate(12 ${M.top + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
              Career Legacy
            </text>
            {lines.map((l, i) => (
              <g key={l.t}>
                <line x1={l.x} x2={l.x} y1={M.top} y2={M.top + ph} stroke={GOLD} strokeDasharray="4 4" />
                <text x={l.x - 4} y={M.top + ph - 6 - i * 14} textAnchor="end" fontSize={10} fill={GOLD}>
                  {l.t}
                </text>
              </g>
            ))}
            {placed.map((p) => (
              <circle
                key={p.c.key}
                cx={p.x}
                cy={p.y}
                r={p.c.key === hover ? 6.5 : topKeys.has(p.c.key) ? 5 : 3.6}
                fill={teamMark(p.c.team)}
                stroke={topKeys.has(p.c.key) ? GOLD : 'hsl(228 47% 7%)'}
                strokeWidth={topKeys.has(p.c.key) ? 1.6 : 1}
                opacity={hover && p.c.key !== hover ? 0.5 : 0.95}
              />
            ))}
            {top.map((s) => {
              const right = s.x > M.left + pw * 0.66;
              const logo = findNFLTeam(s.c.team)?.logoUrl;
              const lx = right ? s.x - 10 - 18 : s.x + 10;
              return (
                <g
                  key={s.c.key}
                  tabIndex={0}
                  role="button"
                  aria-label={`${s.c.name}, ${s.c.pos}, ${s.c.team}, age ${s.c.age}, Career Legacy ${formatNumber(Math.round(s.c.legacy))}. Open his card`}
                  onKeyDown={(e) => onKey(e, s.c)}
                  onFocus={() => setHover(s.c.key)}
                  onBlur={() => setHover(null)}
                  className="clk-star focus:outline-none"
                >
                  <circle cx={s.x} cy={s.y} r={10} fill="transparent" className="clk-star__ring" />
                  {named.has(s.c.key) && (
                    <>
                      {logo && <image href={logo} x={lx} y={s.y - 9} width={18} height={18} preserveAspectRatio="xMidYMid meet" />}
                      <text
                        x={right ? lx - 4 : lx + 22}
                        y={s.y}
                        dy="0.32em"
                        textAnchor={right ? 'end' : 'start'}
                        fontSize={11}
                        fontWeight={600}
                        fill={VIZ.ink}
                        paintOrder="stroke"
                        stroke="hsl(226 40% 11%)"
                        strokeWidth={3}
                      >
                        {shortName(s.c.name)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          {hovered && (
            <ChartTip x={hovered.x} y={hovered.y} width={w}>
              <p className="font-semibold text-chalk">{hovered.c.name}</p>
              <p className="text-muted-foreground">
                {hovered.c.pos} · {hovered.c.team} · Age {hovered.c.age}
              </p>
              <p>
                Career Legacy <b className="text-gold">{formatNumber(Math.round(hovered.c.legacy))}</b>
              </p>
              <p className="text-muted-foreground">{hovered.c.left === 0 ? 'Final season' : `${hovered.c.left} season${hovered.c.left === 1 ? '' : 's'} left after this one`}</p>
            </ChartTip>
          )}
        </div>
      }
      table={
        <table className={tableCls}>
          <thead>
            <tr>
              <th>Player</th>
              <th>Club</th>
              <th>Age</th>
              <th>Career Legacy</th>
            </tr>
          </thead>
          <tbody>
            {[...pts]
              .sort((a, b) => b.legacy - a.legacy)
              .slice(0, 25)
              .map((c) => (
                <tr key={c.key}>
                  <td>
                    {c.name} ({c.pos})
                  </td>
                  <td>{c.team}</td>
                  <td>{c.age}</td>
                  <td>{formatNumber(Math.round(c.legacy))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      }
    />
  );
};

// ---------- 3. The rules: growth chance by age, then the decline ----------

const RulesRows = () => {
  const last = finalAge('QB', 0);
  const ages: number[] = [];
  for (let a = 21; a <= last; a++) ages.push(a);
  const growth = ages.filter((a) => a < DECLINE_AGE);
  return (
    <ChartFrame
      title="Growth and decline by age"
      icon={<CalendarClock className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`The game's rules at each season's end. Through age ${DECLINE_AGE - 1} a rating can go up, less often every year; from ${DECLINE_AGE} nothing grows and two points come off every season.`}
      chart={
        <div className="clk-rules" style={{ ['--n' as string]: ages.length }}>
          <p className="clk-rules__k">Chance a rating goes up</p>
          <div className="clk-rules__row clk-rules__row--bars" aria-hidden="true">
            {ages.map((a) => (
              <span key={a} className="clk-rules__cell">
                {a < DECLINE_AGE && (
                  <>
                    <em>{Math.round(improveChance(a) * 100)}</em>
                    <i style={{ height: `${improveChance(a) * 100}%`, background: TURF }} />
                  </>
                )}
              </span>
            ))}
          </div>
          <div className="clk-rules__row clk-rules__row--ages" aria-hidden="true">
            {ages.map((a) => (
              <span key={a} className={a === DECLINE_AGE ? 'is-decline' : undefined}>
                {a}
              </span>
            ))}
          </div>
          <p className="clk-rules__k">Decline</p>
          <div className="clk-rules__row" aria-hidden="true">
            <span className="clk-rules__none" style={{ gridColumn: `1 / span ${growth.length}` }}>
              None
            </span>
            <span className="clk-rules__band" style={{ gridColumn: `${growth.length + 1} / span ${ages.length - growth.length}` }}>
              −1 stamina and −1 speed or strength, every season
            </span>
          </div>
          <p className="clk-rules__note">QBs and kickers under 35 always lose the speed point, never strength. Retirement comes after 35 (QBs and kickers after 40), a year later per delay.</p>
        </div>
      }
      table={
        <table className={tableCls}>
          <thead>
            <tr>
              <th>Age</th>
              <th>Chance a rating goes up</th>
              <th>Decline</th>
            </tr>
          </thead>
          <tbody>
            {ages.map((a) => (
              <tr key={a}>
                <td>{a}</td>
                <td>{Math.round(improveChance(a) * 100)}%</td>
                <td>{a >= DECLINE_AGE ? '−1 stamina, −1 speed or strength' : 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
};

// ---------- 4. The league's own curves (two-year bins) ----------

const MiniCurve = ({ r, rows, w }: { r: Rating; rows: ReturnType<typeof ratingsByBin>; w: number }) => {
  const h = 132;
  const m = { top: 10, right: 10, bottom: 22, left: 24 };
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;
  const x0 = rows[0]?.mid ?? 21;
  const x1 = rows[rows.length - 1]?.mid ?? 35;
  const sx = (a: number) => m.left + ((a - x0) / Math.max(1, x1 - x0)) * pw;
  const sy = (v: number) => m.top + ph - (v / 10) * ph;
  const path = (f: (x: (typeof rows)[number]) => number) => rows.map((x, i) => `${i ? 'L' : 'M'}${sx(x.mid).toFixed(1)},${sy(f(x)).toFixed(1)}`).join('');
  const peak = rows.reduce((b, x) => (x.now[r] > b.now[r] ? x : b), rows[0]);
  return (
    <figure className="clk-mini">
      <figcaption>
        {RATING_LABEL[r]} <span>peaks at {peak?.label}</span>
      </figcaption>
      <svg width={w} height={h} aria-hidden="true" className="block max-w-full">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + pw} y1={sy(v)} y2={sy(v)} stroke={VIZ.grid} />
            <text x={m.left - 5} y={sy(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.muted}>
              {v}
            </text>
          </g>
        ))}
        <path d={path((x) => x.max[r])} fill="none" stroke={GOLD} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={path((x) => x.now[r])} fill="none" stroke={VIZ.bar} strokeWidth={2.5} />
        {rows.map((x) => (
          <circle key={x.label} cx={sx(x.mid)} cy={sy(x.now[r])} r={2.6} fill={VIZ.bar} />
        ))}
        {[rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].filter(Boolean).map((x, i) => (
          <text key={x.label} x={sx(x.mid)} y={h - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize={11} fill={VIZ.muted}>
            {x.label}
          </text>
        ))}
      </svg>
    </figure>
  );
};

const LeagueCurves = ({ all }: { all: ClockPlayer[] }) => {
  const [ref, width] = useWidth();
  const rows = useMemo(() => ratingsByBin(all, 2), [all]);
  const cols = width >= 460 ? 2 : 1;
  const w = Math.max(200, Math.floor((width - (cols - 1) * 16) / cols));
  return (
    <ChartFrame
      title="The league's rating curves"
      icon={<CalendarClock className="h-4 w-4 text-gold" aria-hidden="true" />}
      description="Average rating (blue) and average ceiling (gold, dashed) of the players on a club, in two-year age groups. Ratings run 1 to 10."
      chart={
        <div ref={ref} className="clk-minis" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {width > 0 && rows.length > 1 && RATINGS.map((r) => <MiniCurve key={r} r={r} rows={rows} w={w} />)}
        </div>
      }
      table={
        <table className={tableCls}>
          <thead>
            <tr>
              <th>Ages</th>
              <th>Players</th>
              {RATINGS.map((r) => (
                <th key={r}>{RATING_LABEL[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.label}>
                <td>{x.label}</td>
                <td>{x.n}</td>
                {RATINGS.map((r) => (
                  <td key={r}>
                    {x.now[r].toFixed(1)} / {x.max[r].toFixed(1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
};

/** The Graphs page's Age curves section (loads the live save itself; nothing when no save is imported) */
const LeagueAgeCurves = ({ players, onSelect }: { players: Player[]; onSelect: (p: Player) => void }) => {
  const state = useSaveState();
  const all = useMemo(() => (state ? buildClock(state, players) : []), [state, players]);
  if (!state || !all.length) return null;
  const avg = all.reduce((s, c) => s + c.age, 0) / all.length;
  const decline = all.filter((c) => c.age >= DECLINE_AGE).length;
  return (
    <section id="age-curves" aria-labelledby="age-curves-h" className="space-y-4 pt-4">
      <header>
        <p className="font-pixel text-[10px] uppercase text-gold">
          Graphs · Y{state.season} week {state.week} save
        </p>
        <h2 id="age-curves-h" className="font-display text-2xl font-extrabold italic uppercase leading-none sm:text-4xl">
          Age curves
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-secondary-foreground">
          {all.length} players are on a club; the average age is {avg.toFixed(1)}, and {decline} ({Math.round((decline / all.length) * 100)}%) are {DECLINE_AGE} or older, past the last growth season.
        </p>
      </header>
      <div className="clk-curves">
        <Pyramid all={all} />
        <StarsScatter all={all} onSelect={onSelect} />
        <RulesRows />
        <LeagueCurves all={all} />
      </div>
    </section>
  );
};

export default LeagueAgeCurves;
