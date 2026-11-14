import { useMemo } from 'react';
import type { Player } from '@/types/player';
import { VIZ } from '../stats/analytics/viz';
import { GOLD, teamMark, useWidth } from '../stats/visual/chartKit';
import { useSaveState } from './saveData';
import { DECLINE_AGE, ROOKIE_AGE, baseMaxAge, buildClock, growthSeasons, halfStars, improveChance, longClock, starsOf, type ClockPlayer } from './clockModel';
import { RatingBars, StarRow, clubVars, starText } from './clockParts';
import './clock.css';

/**
 * Deep Dive › Age & clock: one player's age from the live save, his retirement clock, his growth chance, ratings now
 * against his ceilings with the game's stars, and where he sits on his position's age curve. Players not in the save
 * (retired, or not on a club) get a quiet note. No morale; age is the only bio.
 */

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Average stars by age for his position (two-year groups), with his own dot */
const PositionCurve = ({ me, peers }: { me: ClockPlayer; peers: ClockPlayer[] }) => {
  const [ref, width] = useWidth();
  const w = Math.max(260, width);
  const h = 186;
  const m = { top: 26, right: 12, bottom: 28, left: 30 };
  const bins = useMemo(() => {
    const g = new Map<number, number[]>();
    for (const c of peers) {
      const b = ROOKIE_AGE + Math.floor((c.age - ROOKIE_AGE) / 2) * 2;
      g.set(b, [...(g.get(b) ?? []), halfStars(c.pos, c.now)]);
    }
    return [...g.entries()].sort((a, b) => a[0] - b[0]).map(([b, v]) => ({ mid: b + 0.5, label: `${b}-${b + 1}`, avg: v.reduce((n, x) => n + x, 0) / v.length, n: v.length }));
  }, [peers]);
  const a0 = Math.min(ROOKIE_AGE, me.age) - 0.5;
  const a1 = Math.max(me.age, ...peers.map((c) => c.age)) + 0.5;
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;
  const sx = (a: number) => m.left + ((a - a0) / (a1 - a0)) * pw;
  const sy = (half: number) => m.top + ph - (half / 10) * ph;
  const mine = halfStars(me.pos, me.now);
  const line = bins.map((b, i) => `${i ? 'L' : 'M'}${sx(b.mid).toFixed(1)},${sy(b.avg).toFixed(1)}`).join('');
  const ticks: number[] = [];
  for (let a = Math.ceil(a0); a <= a1; a++) if (a % 3 === 0) ticks.push(a);
  return (
    <div ref={ref}>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={`${me.pos}s on a club, average stars by age: ${bins.map((b) => `${b.label}: ${(b.avg / 2).toFixed(1)}`).join('; ')}. ${me.name} at ${me.age}: ${starText(mine)}.`}
        className="block max-w-full"
      >
        <rect x={sx(DECLINE_AGE - 0.5)} y={m.top} width={Math.max(0, m.left + pw - sx(DECLINE_AGE - 0.5))} height={ph} fill="hsl(354 90% 65%)" opacity={0.08} />
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + pw} y1={sy(v)} y2={sy(v)} stroke={VIZ.grid} />
            <text x={m.left - 6} y={sy(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.muted}>
              {v / 2}★
            </text>
          </g>
        ))}
        {ticks.map((a) => (
          <text key={a} x={sx(a)} y={h - 8} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
            {a}
          </text>
        ))}
        {peers.map((c) => (
          <circle key={c.key} cx={sx(c.age)} cy={sy(halfStars(c.pos, c.now))} r={2.5} fill={VIZ.muted} opacity={0.35} />
        ))}
        <path d={line} fill="none" stroke={VIZ.bar} strokeWidth={2.5} />
        <circle cx={sx(me.age)} cy={sy(mine)} r={7} fill={teamMark(me.team)} stroke={GOLD} strokeWidth={2} />
        <text x={sx(me.age) + (sx(me.age) > m.left + pw * 0.7 ? -11 : 11)} y={sy(mine) - 10} textAnchor={sx(me.age) > m.left + pw * 0.7 ? 'end' : 'start'} fontSize={12} fontWeight={700} fill={VIZ.ink} paintOrder="stroke" stroke="hsl(226 40% 11%)" strokeWidth={3}>
          {me.name.split(' ').slice(-1)[0]} · {me.age}
        </text>
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Blue: average stars of the {peers.length} {me.pos}s on a club, by two-year age group (grey dots: each of them). Red band: decline years.
      </p>
    </div>
  );
};

const DdClock = ({ player, players }: { player: Player; players: Player[] }) => {
  const state = useSaveState();
  const all = useMemo(() => (state ? buildClock(state, players) : []), [state, players]);
  const me = all.find((c) => c.key === `${player.position}:${player.name}`);
  if (state === undefined) return <p className="text-sm text-muted-foreground">Loading the save…</p>;
  if (!state || !me) {
    return (
      <p className="clk-empty text-sm">
        Not in the current save{state ? ` (Y${state.season} week ${state.week})` : ''}: he isn&apos;t playing for a club, so there is no age or rating to read.
      </p>
    );
  }
  const st = starsOf(me);
  const base = baseMaxAge(me.pos);
  const seasons: number[] = [];
  for (let a = me.age; a <= me.finalAge; a++) seasons.push(a);
  const chance = improveChance(me.age);
  const peers = all.filter((c) => c.pos === me.pos);
  const clock = me.left === 0 ? 'Final season' : me.left === 1 ? 'One more season' : `${me.left} seasons left`;
  return (
    <div className="clk-dd" style={clubVars(me.team)}>
      <div className="clk-dd__grid">
        <section className="clk-dd__card" aria-label="Retirement clock">
          <p className="clk-dd__k">Age</p>
          <p className="clk-dd__age">{me.age}</p>
          <p className="clk-dd__clock">{clock}</p>
          <p className="clk-dd__sub">
            {longClock(me.pos) ? `${me.pos}s play to ${base}` : `Everyone but QBs and kickers plays to ${base}`}
            {me.delay > 0 ? `, plus ${me.delay} delayed retirement${me.delay === 1 ? '' : 's'}` : ''}: his last season comes at {me.finalAge}.
          </p>
          <ol className="clk-dd__pips" aria-label={`Seasons left: ages ${seasons.join(', ')}`}>
            {seasons.map((a) => (
              <li key={a} className={a === me.age ? 'is-now' : a === me.finalAge ? 'is-last' : undefined} aria-hidden="true">
                {a}
              </li>
            ))}
          </ol>
        </section>
        <section className="clk-dd__card" aria-label="Development">
          <p className="clk-dd__k">Growth</p>
          {me.age < DECLINE_AGE ? (
            <>
              <p className="clk-dd__big">{pct(chance)}</p>
              <p className="clk-dd__sub">
                chance a rating goes up at this season&apos;s end, at {me.age}; about <b>{growthSeasons(me.age).toFixed(1)}</b> growth seasons left before {DECLINE_AGE}.
              </p>
            </>
          ) : (
            <>
              <p className="clk-dd__big clk-dd__big--down">−2</p>
              <p className="clk-dd__sub">rating points every season from {DECLINE_AGE}: −1 stamina and −1 speed or strength{longClock(me.pos) && me.age < 35 ? ' (speed, for a QB under 35)' : ''}. No more growth.</p>
            </>
          )}
          <p className="clk-dd__k mt-3">Room to grow</p>
          <p className="clk-dd__sub">
            <b className="text-gold">+{me.room}</b> rating points to his ceilings
          </p>
        </section>
        <section className="clk-dd__card clk-dd__card--wide" aria-label="Ratings and stars">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="clk-dd__k">Ratings now vs ceiling</p>
            <p className="clk-starline" aria-label={`${starText(st.now)} now, potential ${starText(st.potential)}`}>
              <StarRow half={st.now} px={3} label="" />
              <span className="clk-starline__arrow" aria-hidden="true">
                →
              </span>
              <StarRow half={st.potential} px={3} label="" />
            </p>
          </div>
          <RatingBars c={me} />
        </section>
      </div>
      <section className="clk-dd__card mt-3" aria-label={`Where he sits on the ${me.pos} age curve`}>
        <p className="clk-dd__k">On the {me.pos} age curve</p>
        <PositionCurve me={me} peers={peers} />
      </section>
    </div>
  );
};

export default DdClock;
