import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, Equal, Flame, Gauge, Shield, Swords, Target, TrendingDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameRef, ScheduleSeason, TableRow } from '@/utils/schedule';
import TeamLogo from './TeamLogo';
import { BOARD_BG, BoardTile, LampGrid, ScoreSide, color, pct, rate, signed } from './seasonGamesUi';

/**
 * "Season by the numbers" (league-wide tiles and the weekly scoring chart) and the season's notable games as
 * broadcast lower-thirds. Every figure comes from schedule.json (`league`, `upset`, `blowout`, `shootout`, `leaders`).
 */

/* ---------------- By the numbers ---------------- */

export const NumbersStrip = ({ season }: { season: ScheduleSeason }) => {
  const l = season.league;
  if (!l) return null;
  const tiles = [
    { label: 'Points per club', value: l.ppg.toFixed(1), sub: 'Per game' },
    { label: 'Combined', value: l.combinedAvg.toFixed(1), sub: 'Points per game' },
    { label: 'Avg margin', value: l.avgMargin.toFixed(1), sub: 'Points' },
    { label: 'Home win %', value: rate(l.homeWinPct), sub: `${l.homeWins} home, ${l.awayWins} away wins` },
    { label: 'One-score games', value: pct(l.oneScoreShare), sub: `${l.oneScoreGames} of ${l.games} by 8 or fewer` },
    { label: '50-point games', value: l.fiftyPointGames, sub: 'A club scored 50+' },
    { label: 'Ties', value: l.ties.length, sub: `${l.games} games, ${l.points.toLocaleString()} points` },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {tiles.map((t, i) => (
        <BoardTile key={t.label} label={t.label} value={t.value} sub={t.sub} className={cn(i === tiles.length - 1 && 'col-span-2 sm:col-span-1')} />
      ))}
    </dl>
  );
};

/* ---------------- Weekly scoring chart ---------------- */

const useWidth = <T extends HTMLElement>(fallback: number) => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
};

const AVG_INK = 'hsl(var(--sky))';
const HIGH_INK = 'hsl(var(--gold) / 0.45)';

export const WeeklyChart = ({ season }: { season: ScheduleSeason }) => {
  const weeks = season.league?.weeks ?? [];
  const team = season.coachTeam;
  const club = useMemo(() => {
    const m = new Map<number, { for: number; against: number; opp?: string; result?: string }>();
    for (const g of season.coachGames) if (!g.playoff && g.for !== undefined && g.against !== undefined) m.set(g.week, { for: g.for, against: g.against, opp: g.opp, result: g.result });
    return m;
  }, [season]);
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const peak = useMemo(() => weeks.reduce((a, w) => (w.high > a.high ? w : a), weeks[0] ?? { week: 0, avg: 0, high: 0 }), [weeks]);
  const [active, setActive] = useState<number | null>(null);
  if (!weeks.length) return null;

  const H = 210;
  const M = { top: 18, right: 8, bottom: 24, left: 30 };
  const iw = Math.max(120, width - M.left - M.right);
  const ih = H - M.top - M.bottom;
  const top = Math.max(peak.high, ...[...club.values()].map((c) => c.for));
  const step = top > 60 ? 20 : 10;
  const yMax = Math.ceil(top / step) * step || step;
  const y = (v: number) => M.top + ih - (v / yMax) * ih;
  const band = iw / weeks.length;
  const x = (i: number) => M.left + band * i + band / 2;
  const barW = Math.max(3, Math.min(12, band * 0.42));
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);
  const everyLabel = band >= 20 ? 1 : 2;
  const avgPath = weeks.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.avg).toFixed(1)}`).join(' ');
  const shown = weeks.find((w) => w.week === active) ?? null;
  const shownClub = shown ? club.get(shown.week) : undefined;

  return (
    <figure className="relative overflow-hidden rounded-lg border border-[hsl(var(--line)/0.7)] p-3" style={{ background: BOARD_BG }}>
      <LampGrid />
      <figcaption className="relative mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">
          <Activity className="h-3.5 w-3.5" aria-hidden /> Weekly scoring
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-hidden>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2 rounded-sm" style={{ background: HIGH_INK }} /> Week's high score
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-3 rounded" style={{ background: AVG_INK }} /> League average per club
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full ring-1 ring-white/70" style={{ background: color(team) }} /> {team} points
          </span>
        </span>
      </figcaption>
      <div ref={ref} className="relative w-full">
        <svg width={iw + M.left + M.right} height={H} role="img" aria-label={`Weekly scoring, ${season.season}: league average points per club and the week's high score, weeks 1 to ${weeks[weeks.length - 1].week}. Data in the table below.`} className="block max-w-full" onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} stroke="hsl(var(--line))" strokeOpacity={t === 0 ? 0.9 : 0.4} strokeDasharray={t === 0 ? undefined : '2 4'} />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))" className="tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const h = y(0) - y(w.high);
            return (
              <path
                key={`h${w.week}`}
                d={`M${x(i) - barW / 2},${y(0)} v${-(h - 3)} q0,-3 3,-3 h${barW - 6} q3,0 3,3 v${h - 3} z`}
                fill={active === w.week ? 'hsl(var(--gold) / 0.8)' : HIGH_INK}
              />
            );
          })}
          <path d={avgPath} fill="none" stroke={AVG_INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {weeks.map((w, i) => (
            <circle key={`a${w.week}`} cx={x(i)} cy={y(w.avg)} r={active === w.week ? 4 : 2.5} fill={AVG_INK} stroke={BOARD_BG} strokeWidth={1.5} />
          ))}
          {weeks.map((w, i) => {
            const c = club.get(w.week);
            return c ? <circle key={`c${w.week}`} cx={x(i)} cy={y(c.for)} r={active === w.week ? 5 : 4} fill={color(team)} stroke="hsl(var(--chalk) / 0.85)" strokeWidth={1.5} /> : null;
          })}
          {/* Direct label: the season's highest score */}
          <text x={x(weeks.indexOf(peak))} y={y(peak.high) - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="hsl(var(--gold))" className="tabular-nums">
            {peak.high}
          </text>
          {weeks.map((w, i) =>
            i % everyLabel === 0 || i === weeks.length - 1 ? (
              <text key={`x${w.week}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={active === w.week ? 'hsl(var(--chalk))' : 'hsl(var(--muted-foreground))'} className="tabular-nums">
                {w.week}
              </text>
            ) : null,
          )}
          {/* Hit targets wider than the marks */}
          {weeks.map((w, i) => (
            <rect
              key={`t${w.week}`}
              x={M.left + band * i}
              y={M.top}
              width={band}
              height={ih}
              fill="transparent"
              onPointerEnter={() => setActive(w.week)}
              onPointerDown={() => setActive(w.week)}
            />
          ))}
        </svg>
      </div>
      <p className="relative mt-1 min-h-[1.25rem] text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
        {shown ? (
          <>
            <span className="font-semibold text-foreground">Week {shown.week}</span>: league average {shown.avg.toFixed(1)}, high {shown.high}
            {shownClub ? `, ${team} ${shownClub.for}–${shownClub.against}${shownClub.opp ? ` vs ${shownClub.opp}` : ''}` : `, ${team} bye`}
          </>
        ) : (
          <>
            Highest score: {peak.high} in week {peak.week}. Hover or tap a week for its numbers.
          </>
        )}
      </p>
      <details className="relative mt-1 text-[11px]">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Weekly scoring table</summary>
        <div className="mt-1 max-h-60 overflow-auto rounded border border-[hsl(var(--line)/0.6)]">
          <table className="w-full text-[11px]">
            <caption className="sr-only">Weekly scoring, {season.season}</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="px-2 py-1 text-left">Week</th>
                <th scope="col" className="px-2 py-1 text-right">League avg</th>
                <th scope="col" className="px-2 py-1 text-right">High</th>
                <th scope="col" className="px-2 py-1 text-right">{team}</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const c = club.get(w.week);
                return (
                  <tr key={w.week} className="border-t border-[hsl(var(--line)/0.4)]">
                    <th scope="row" className="px-2 py-1 text-left font-normal">{w.week}</th>
                    <td className="px-2 py-1 text-right tabular-nums">{w.avg.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{w.high}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{c ? `${c.for}–${c.against}` : 'Bye'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};

/* ---------------- Notable games (lower-thirds) ---------------- */

const LowerThird = ({ kicker, icon: Icon, g, caption, accent }: { kicker: string; icon: typeof Zap; g: GameRef; caption?: ReactNode; accent?: string }) => {
  const tie = g.winner === null;
  return (
    <li className="overflow-hidden rounded-lg border border-[hsl(var(--line)/0.7)] shadow-[0_6px_18px_hsl(228_60%_2%/0.35)]" style={{ background: BOARD_BG }}>
      <div className="flex items-stretch">
        <span
          className="inline-flex items-center gap-1 px-2 py-1 font-pixel text-[9px] uppercase tracking-widest text-[hsl(228_47%_7%)]"
          style={{ background: accent ?? 'hsl(var(--gold))' }}
        >
          <Icon className="h-3 w-3" aria-hidden /> {kicker}
        </span>
        <span className="flex flex-1 items-center justify-end bg-black/40 px-2 font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">
          Week {g.week} · Final{tie ? ' · Tie' : ''}
        </span>
      </div>
      <p className="sr-only">
        {g.away} {g.awayScore} at {g.home} {g.homeScore}
      </p>
      <div className="flex items-stretch" aria-hidden>
        <ScoreSide team={g.away} score={g.awayScore} won={tie ? null : g.winner === g.away} />
        <span className="flex items-center bg-black/60 px-1.5 font-pixel text-[9px] text-muted-foreground">@</span>
        <ScoreSide team={g.home} score={g.homeScore} won={tie ? null : g.winner === g.home} align="right" />
      </div>
      {caption && <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">{caption}</p>}
    </li>
  );
};

const LeadersTile = ({ season }: { season: ScheduleSeason }) => {
  const byTeam = useMemo(() => new Map(season.table.map((r) => [r.team, r])), [season]);
  const { leaders } = season;
  const rows = [
    { label: 'Best offense', team: leaders?.bestOffense, stat: (r: TableRow) => `${r.ppg.toFixed(1)} pts/game` },
    { label: 'Best defense', team: leaders?.bestDefense, stat: (r: TableRow) => `${r.papg.toFixed(1)} allowed/game` },
    { label: 'Best differential', team: leaders?.bestDiff, stat: (r: TableRow) => signed(r.diff) },
    { label: 'Leakiest defense', team: leaders?.worstDefense, stat: (r: TableRow) => `${r.papg.toFixed(1)} allowed/game` },
  ].filter((l) => l.team);
  if (!rows.length) return null;
  return (
    <li className="relative overflow-hidden rounded-lg border border-[hsl(var(--line)/0.7)] p-3" style={{ background: BOARD_BG }}>
      <LampGrid />
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[hsl(var(--gold))]" />
      <h4 className="relative mb-2 flex items-center gap-1.5 font-pixel text-[9px] uppercase tracking-widest text-muted-foreground">
        <Shield className="h-3.5 w-3.5" aria-hidden /> Leaders
      </h4>
      <dl className="relative space-y-1.5 text-sm">
        {rows.map((l) => {
          const row = byTeam.get(l.team!);
          return (
            <div key={l.label} className="flex items-center gap-2 rounded px-1.5 py-1" style={{ background: `linear-gradient(90deg, ${color(l.team, 0.3)}, transparent)` }}>
              <dt className="w-24 flex-shrink-0 text-[11px] text-muted-foreground">{l.label}</dt>
              <dd className="flex min-w-0 flex-1 items-center gap-1.5">
                <TeamLogo team={l.team} decorative className="h-5 w-5 flex-shrink-0" />
                <span className="truncate font-medium">{l.team}</span>
                {row && <span className="ml-auto flex-shrink-0 text-[11px] tabular-nums text-muted-foreground">{l.stat(row)}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
};

export const NotableGames = ({ season }: { season: ScheduleSeason }) => {
  const { upset, blowout, shootout } = season;
  const l = season.league;
  const items: { key: string; kicker: string; icon: typeof Zap; g: GameRef; caption?: string; accent?: string }[] = [];
  if (upset)
    items.push({
      key: 'upset',
      kicker: 'Upset',
      icon: Zap,
      g: upset,
      caption: upset.winnerRecord && upset.loserRecord ? `${upset.winner} (${upset.winnerRecord}) beat ${upset.loser} (${upset.loserRecord}) by ${upset.margin}` : undefined,
      accent: 'hsl(var(--sky))',
    });
  if (blowout) items.push({ key: 'blowout', kicker: 'Blowout', icon: Swords, g: blowout, caption: `Won by ${blowout.margin}`, accent: 'hsl(var(--flag))' });
  if (shootout) items.push({ key: 'shootout', kicker: 'Shootout', icon: Flame, g: shootout, caption: `${shootout.total} combined points` });
  if (l?.closest) items.push({ key: 'closest', kicker: 'Closest', icon: Target, g: l.closest, caption: `Decided by ${l.closest.margin}, ${l.closest.total} combined points`, accent: 'hsl(var(--turf))' });
  if (l?.mostInLoss)
    items.push({
      key: 'mostInLoss',
      kicker: 'Most in a loss',
      icon: TrendingDown,
      g: l.mostInLoss,
      caption: `${l.mostInLoss.loser} scored ${Math.min(l.mostInLoss.awayScore, l.mostInLoss.homeScore)} and lost`,
      accent: 'hsl(var(--flag))',
    });
  if (l?.fewestInWin)
    items.push({
      key: 'fewestInWin',
      kicker: 'Fewest in a win',
      icon: Gauge,
      g: l.fewestInWin,
      caption: `${l.fewestInWin.winner} won with ${Math.max(l.fewestInWin.awayScore, l.fewestInWin.homeScore)}`,
      accent: 'hsl(var(--turf))',
    });
  for (const t of l?.ties ?? [])
    items.push({ key: `tie-${t.week}-${t.away}`, kicker: 'Tie', icon: Equal, g: t, caption: `Level at ${t.awayScore}, ${t.total} combined points`, accent: 'hsl(225 20% 65%)' });
  if (!items.length && !season.leaders) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ key, ...it }) => (
        <LowerThird key={key} {...it} />
      ))}
      <LeadersTile season={season} />
    </ul>
  );
};
