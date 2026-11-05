import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, Dice5, Gauge, Home, LineChart, Scale, Shield, TrendingUp, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { useCurrentClub } from '@/utils/club';
import { scheduleSeasons, useSchedule, type ScheduleSeason, type TableRow, type TeamSeasonRow } from '@/utils/schedule';
import TeamLogo from '../timeline/TeamLogo';

/**
 * Stats → Teams: advanced team stats from the weekly league scores (public/data/league/schedule.json, built by
 * scripts/schedule_content.py) and each club's progression across the seasons that have scores. Every number and
 * every insight below is a rule over that file; seasons without an upload are simply absent and shown as gaps.
 */

const NEUTRAL = '220 10% 40%';
const teamColor = (team?: string | null) => `hsl(${findNFLTeam(team ?? undefined)?.primaryColor ?? NEUTRAL})`;
const UP = 'text-[hsl(145_63%_52%)]';
const DOWN = 'text-[hsl(357_80%_68%)]';
const signTone = (n?: number | null) => (n == null || n === 0 ? '' : n > 0 ? UP : DOWN);
const signed = (n: number, digits = 0) => {
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : digits ? (0).toFixed(digits) : '0';
};
const rate = (n: number) => n.toFixed(3).replace(/^(-?)0/, '$1');
const signedRate = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + rate(Math.abs(n));
const seasonNum = (s: string) => Number(s.replace(/\D/g, '')) || 0;
const dash = '—';

/** "7-2" or "7-2-1" → win % (ties count half), null when there were no games. */
const recordPct = (rec?: string) => {
  if (!rec) return null;
  const [w = 0, l = 0, t = 0] = rec.split('-').map(Number);
  const g = w + l + t;
  return g ? (w + t / 2) / g : null;
};
/** "W7" → 7, "L3" → −3, "T1" → 0. */
const streakValue = (s?: string) => {
  const m = s?.match(/^([WLT])(\d+)$/);
  if (!m) return null;
  return m[1] === 'W' ? Number(m[2]) : m[1] === 'L' ? -Number(m[2]) : 0;
};

const useWidth = <T extends HTMLElement>(fallback: number) => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
};

const ClubName = ({ team, className, logo = 'h-5 w-5' }: { team: string; className?: string; logo?: string }) => (
  <span className={cn('flex min-w-0 items-center gap-2', className)}>
    <span aria-hidden className="h-5 w-1 flex-shrink-0 rounded-full" style={{ background: teamColor(team) }} />
    <TeamLogo team={team} decorative className={cn(logo, 'flex-shrink-0')} />
    <span className="truncate">{team}</span>
  </span>
);

const PIP_STYLE: Record<string, string> = {
  W: 'bg-[hsl(145_63%_42%)]',
  L: 'bg-[hsl(357_80%_62%)]',
  T: 'bg-muted-foreground',
};
const PIP_WORD: Record<string, string> = { W: 'win', L: 'loss', T: 'tie' };
const Last5 = ({ value }: { value?: string }) =>
  value ? (
    <span role="img" aria-label={`Last five, oldest first: ${[...value].map((c) => PIP_WORD[c] ?? c).join(', ')}`} className="inline-flex gap-0.5">
      {[...value].map((c, i) => (
        <span key={i} aria-hidden className={cn('h-3 w-1.5 rounded-sm', PIP_STYLE[c] ?? 'bg-muted')} />
      ))}
    </span>
  ) : (
    <span className="text-muted-foreground">{dash}</span>
  );

/* ---------------- Advanced table ---------------- */

type SortKey = 'power' | 'team' | 'record' | 'expWins' | 'luck' | 'adjMargin' | 'marginSd' | 'homeEdge' | 'oneScore' | 'streak' | 'last5';

interface Column {
  key: SortKey;
  label: string;
  title?: string;
  compact: boolean;
  /** Lower is better, so the first click sorts ascending */
  asc?: boolean;
  value: (r: TableRow) => number | string | null;
  cell: (r: TableRow) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { key: 'power', label: '#', title: 'Power rank', compact: true, asc: true, value: (r) => r.power, cell: (r) => <span className="font-display font-bold">{r.power}</span> },
  { key: 'team', label: 'Club', compact: true, asc: true, value: (r) => r.team, cell: () => null, align: 'left' },
  { key: 'record', label: 'W-L-T', title: 'Record', compact: true, value: (r) => r.pct, cell: (r) => <span className="font-semibold">{`${r.w}-${r.l}-${r.t}`}</span> },
  {
    key: 'expWins',
    label: 'xW',
    title: 'Pythagorean expected wins (points scored and allowed, exponent 2.37)',
    compact: true,
    value: (r) => r.expWins ?? null,
    cell: (r) => (r.expWins != null ? r.expWins.toFixed(1) : dash),
  },
  {
    key: 'luck',
    label: 'Luck',
    title: 'Actual wins minus Pythagorean expected wins',
    compact: true,
    value: (r) => r.luck ?? null,
    cell: (r) => (r.luck != null ? <span className={cn('font-semibold', signTone(r.luck))}>{signed(r.luck, 1)}</span> : dash),
  },
  {
    key: 'adjMargin',
    label: 'Adj',
    title: 'Adjusted margin: points per game adjusted for the schedule',
    compact: false,
    value: (r) => r.adjMargin ?? null,
    cell: (r) => (r.adjMargin != null ? <span className={signTone(r.adjMargin)}>{signed(r.adjMargin, 1)}</span> : dash),
  },
  {
    key: 'marginSd',
    label: 'SD',
    title: 'Consistency: standard deviation of game margins (lower is steadier)',
    compact: false,
    asc: true,
    value: (r) => r.marginSd ?? null,
    cell: (r) => (r.marginSd != null ? r.marginSd.toFixed(1) : dash),
  },
  {
    key: 'homeEdge',
    label: 'Home',
    title: 'Home edge: home win % minus away win %',
    compact: false,
    value: (r) => r.homeEdge ?? null,
    cell: (r) => (r.homeEdge != null ? <span className={signTone(r.homeEdge)}>{signedRate(r.homeEdge)}</span> : dash),
  },
  {
    key: 'oneScore',
    label: '1-Score',
    title: 'Record in games decided by 8 points or fewer',
    compact: false,
    value: (r) => recordPct(r.oneScore),
    cell: (r) => r.oneScore ?? dash,
  },
  { key: 'streak', label: 'Strk', title: 'Streak at season end', compact: false, value: (r) => streakValue(r.streak), cell: (r) => r.streak ?? dash },
  {
    key: 'last5',
    label: 'Last 5',
    title: 'Last five results, oldest first',
    compact: true,
    value: (r) => (r.last5 ? [...r.last5].filter((c) => c === 'W').length : null),
    cell: (r) => <Last5 value={r.last5} />,
    align: 'center',
  },
];

const thBase = 'px-1.5 py-2 font-semibold sm:px-2';
const tdBase = 'px-1.5 py-1.5 tabular-nums whitespace-nowrap sm:px-2';
const alignClass = (a: Column['align']) => (a === 'left' ? 'text-left' : a === 'center' ? 'text-center' : 'text-right');

const SeasonPicker = ({ seasons, value, onChange }: { seasons: ScheduleSeason[]; value: string; onChange: (s: string) => void }) => (
  <div role="group" aria-label="Season" className="flex min-w-0 items-center gap-2">
    <span className="font-pixel text-[9px] uppercase text-muted-foreground shrink-0">Season</span>
    <div className="flex min-w-0 gap-1 overflow-x-auto scrollbar-none rounded-lg bg-secondary/50 p-1">
      {seasons.map((s) => (
        <button
          key={s.season}
          type="button"
          aria-pressed={value === s.season}
          onClick={() => onChange(s.season)}
          className={cn(
            'shrink-0 rounded-md px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors',
            value === s.season ? 'bg-gold text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {s.season}
        </button>
      ))}
    </div>
  </div>
);

const AdvancedTable = ({ season, compact, onTrack }: { season: ScheduleSeason; compact: boolean; onTrack: (team: string) => void }) => {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'power', asc: true });
  const columns = compact ? COLUMNS.filter((c) => c.compact) : COLUMNS;
  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[0];
    return [...season.table].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (va == null && vb == null) return a.power - b.power;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'string' || typeof vb === 'string' ? String(va).localeCompare(String(vb)) : va - vb;
      return (sort.asc ? cmp : -cmp) || a.power - b.power;
    });
  }, [season, sort]);
  const sortBy = (c: Column) => setSort((s) => (s.key === c.key ? { key: c.key, asc: !s.asc } : { key: c.key, asc: !!c.asc }));

  return (
    <div className="max-h-[34rem] overflow-auto rounded-lg border border-border/40">
      <table className={cn('w-full text-sm', compact ? 'min-w-[340px]' : 'min-w-[760px]')}>
        <caption className="sr-only">
          Advanced team stats, {season.season}. Sorted by {COLUMNS.find((c) => c.key === sort.key)?.title ?? sort.key}, {sort.asc ? 'ascending' : 'descending'}.
        </caption>
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {columns.map((c) => {
              const active = sort.key === c.key;
              const Icon = active ? (sort.asc ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}
                  className={cn(thBase, alignClass(c.align), c.key === 'team' && 'sticky left-0 z-10 bg-card sm:static')}
                >
                  <button
                    type="button"
                    onClick={() => sortBy(c)}
                    title={c.title}
                    className={cn(
                      'inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground',
                      active && 'text-gold',
                      c.align !== 'left' && c.align !== 'center' && 'flex-row-reverse',
                    )}
                  >
                    {c.title ? <abbr title={c.title} className="no-underline">{c.label}</abbr> : c.label}
                    <Icon className="h-3 w-3 opacity-70" aria-hidden />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const coach = r.team === season.coachTeam;
            return (
              <tr key={r.abbr} className={cn('border-t border-border/30', coach ? 'bg-primary/15' : 'hover:bg-secondary/20')} aria-current={coach ? 'true' : undefined}>
                {columns.map((c) =>
                  c.key === 'team' ? (
                    <th
                      key={c.key}
                      scope="row"
                      className={cn(
                        'sticky left-0 bg-card px-2 py-1.5 text-left font-medium sm:static sm:bg-transparent sm:shadow-none',
                        coach && 'shadow-[inset_0_0_0_999px_hsl(var(--primary)/0.15)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onTrack(r.team)}
                        title={`Show ${r.team} progression`}
                        className="flex max-w-[9.5rem] items-center gap-1.5 text-left hover:text-gold sm:max-w-none"
                      >
                        <ClubName team={r.team} />
                        {coach && (
                          <span className="hidden rounded bg-primary/25 px-1 text-[9px] font-bold uppercase tracking-wider text-foreground sm:inline">
                            Coached<span className="sr-only"> club</span>
                          </span>
                        )}
                      </button>
                    </th>
                  ) : (
                    <td key={c.key} className={cn(tdBase, alignClass(c.align), c.key === 'power' && 'w-8')}>
                      {c.cell(r)}
                    </td>
                  ),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ---------------- Insight cards ---------------- */

interface Insight {
  id: string;
  label: string;
  icon: typeof Dice5;
  row: TableRow;
  value: string;
  tone: string;
  detail: string;
}

const pick = (rows: TableRow[], field: (r: TableRow) => number | undefined, best: 'max' | 'min') => {
  let out: TableRow | null = null;
  for (const r of [...rows].sort((a, b) => a.power - b.power)) {
    const v = field(r);
    if (v == null) continue;
    const cur = out ? field(out)! : null;
    if (cur == null || (best === 'max' ? v > cur : v < cur)) out = r;
  }
  return out;
};

const buildInsights = (season: ScheduleSeason): Insight[] => {
  const rows = season.table;
  const out: Insight[] = [];
  const add = (row: TableRow | null, make: (r: TableRow) => Omit<Insight, 'row'>) => {
    if (row) out.push({ row, ...make(row) });
  };
  add(pick(rows, (r) => r.luck, 'max'), (r) => ({
    id: 'luckiest',
    label: 'Luckiest',
    icon: Dice5,
    value: `${signed(r.luck!, 1)} W`,
    tone: signTone(r.luck),
    detail: `${r.record} against ${r.expWins?.toFixed(1) ?? dash} expected wins`,
  }));
  add(pick(rows, (r) => r.luck, 'min'), (r) => ({
    id: 'unluckiest',
    label: 'Unluckiest',
    icon: Dice5,
    value: `${signed(r.luck!, 1)} W`,
    tone: signTone(r.luck),
    detail: `${r.record} against ${r.expWins?.toFixed(1) ?? dash} expected wins`,
  }));
  add(pick(rows, (r) => r.marginSd, 'min'), (r) => ({
    id: 'steadiest',
    label: 'Most consistent',
    icon: Gauge,
    value: `±${r.marginSd!.toFixed(1)}`,
    tone: '',
    detail: `Game margins spread ${r.marginSd!.toFixed(1)} points (standard deviation)`,
  }));
  add(pick(rows, (r) => r.marginSd, 'max'), (r) => ({
    id: 'volatile',
    label: 'Most volatile',
    icon: Waves,
    value: `±${r.marginSd!.toFixed(1)}`,
    tone: '',
    detail: `Game margins spread ${r.marginSd!.toFixed(1)} points (standard deviation)`,
  }));
  add(pick(rows, (r) => r.homeEdge, 'max'), (r) => ({
    id: 'home',
    label: 'Biggest home edge',
    icon: Home,
    value: signedRate(r.homeEdge!),
    tone: signTone(r.homeEdge),
    detail: `${r.home ?? dash} at home, ${r.away ?? dash} away (win % gap)`,
  }));
  add(pick(rows, (r) => r.adjMargin, 'max'), (r) => ({
    id: 'adj',
    label: 'Best adjusted margin',
    icon: Scale,
    value: signed(r.adjMargin!, 1),
    tone: signTone(r.adjMargin),
    detail: `Points per game after the schedule; raw ${signed(r.ppg - r.papg, 1)}`,
  }));
  add(pick(rows, (r) => r.sos, 'max'), (r) => ({
    id: 'sos',
    label: 'Strongest schedule',
    icon: Shield,
    value: rate(r.sos),
    tone: '',
    detail: `Opponents' average final win %, went ${r.record}`,
  }));
  return out;
};

const InsightCards = ({ season }: { season: ScheduleSeason }) => {
  const insights = useMemo(() => buildInsights(season), [season]);
  if (!insights.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-label={`Season insights, ${season.season}`}>
      {insights.map((i) => (
        <li
          key={i.id}
          className="relative overflow-hidden rounded-xl border border-border/50 bg-secondary/25 p-3"
          style={{ boxShadow: `inset 3px 0 0 ${teamColor(i.row.team)}` }}
        >
          <TeamLogo team={i.row.team} decorative className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 opacity-10" />
          <p className="flex items-center gap-1.5 font-pixel text-[9px] uppercase text-muted-foreground">
            <i.icon className="h-3.5 w-3.5" aria-hidden /> {i.label}
          </p>
          <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
            <ClubName team={i.row.team} className="font-display text-base font-bold uppercase sm:text-lg" logo="h-6 w-6" />
            <span className={cn('font-display text-2xl font-extrabold tabular-nums leading-none', i.tone)}>{i.value}</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{i.detail}</p>
        </li>
      ))}
    </ul>
  );
};

/* ---------------- Progression ---------------- */

const PAD = { l: 34, r: 14, t: 30, b: 22 };

const xScale = (rows: TeamSeasonRow[], width: number) => {
  const nums = rows.map((r) => seasonNum(r.season));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const inner = width - PAD.l - PAD.r;
  return (season: string) => (max === min ? PAD.l + inner / 2 : PAD.l + ((seasonNum(season) - min) / (max - min)) * inner);
};

/** Pairs of consecutive seasons with data that skip one or more seasons. */
const gapsOf = (rows: TeamSeasonRow[]) =>
  rows.slice(1).flatMap((cur, i) => {
    const prev = rows[i];
    const missing = seasonNum(cur.season) - seasonNum(prev.season) - 1;
    return missing > 0 ? [{ prev, cur, missing }] : [];
  });

const SeasonAxis = ({ rows, x, y }: { rows: TeamSeasonRow[]; x: (s: string) => number; y: number }) => (
  <g className="fill-muted-foreground" fontSize={10}>
    {rows.map((r) => (
      <text key={r.season} x={x(r.season)} y={y} textAnchor="middle">
        {r.season}
      </text>
    ))}
  </g>
);

const PowerChart = ({ team, rows, clubs, width }: { team: string; rows: TeamSeasonRow[]; clubs: number; width: number }) => {
  const H = 170;
  const x = xScale(rows, width);
  const y = (rank: number) => PAD.t + ((rank - 1) / Math.max(1, clubs - 1)) * (H - PAD.t - PAD.b);
  const ticks = [1, 8, 16, 24, clubs].filter((v, i, a) => v <= clubs && a.indexOf(v) === i);
  const gaps = gapsOf(rows);
  const segments = rows.slice(1).map((cur, i) => ({ prev: rows[i], cur, gap: seasonNum(cur.season) - seasonNum(rows[i].season) > 1 }));
  const stroke = teamColor(team);
  const label = `${team} power rank by season: ${rows.map((r) => `${r.season} No. ${r.power}`).join(', ')}${
    gaps.length ? `. Gaps: ${gaps.map((g) => `${g.missing} season${g.missing > 1 ? 's' : ''} without scores between ${g.prev.season} and ${g.cur.season}`).join('; ')}` : ''
  }.`;
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={label} className="block">
      <text x={4} y={10} fontSize={9} className="fill-muted-foreground font-semibold uppercase tracking-wider">
        Power rank
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeOpacity={0.5} strokeDasharray={t === 1 ? undefined : '2 3'} />
          <text x={PAD.l - 6} y={y(t) + 3} fontSize={10} textAnchor="end" className="fill-muted-foreground tabular-nums">
            #{t}
          </text>
        </g>
      ))}
      {segments.map(({ prev, cur, gap }) => (
        <line
          key={cur.season}
          x1={x(prev.season)}
          y1={y(prev.power)}
          x2={x(cur.season)}
          y2={y(cur.power)}
          stroke={stroke}
          strokeWidth={2.5}
          strokeDasharray={gap ? '4 4' : undefined}
          strokeOpacity={gap ? 0.6 : 1}
          className="[filter:brightness(1.6)]"
        />
      ))}
      {gaps.map((g) => (
        <text
          key={g.cur.season}
          x={(x(g.prev.season) + x(g.cur.season)) / 2}
          y={(y(g.prev.power) + y(g.cur.power)) / 2 - 6}
          fontSize={9}
          textAnchor="middle"
          className="fill-muted-foreground"
        >
          {g.missing} missing
        </text>
      ))}
      {rows.map((r) => (
        <g key={r.season}>
          <circle cx={x(r.season)} cy={y(r.power)} r={5} fill={stroke} className="stroke-foreground" strokeWidth={1.5} />
          <text x={x(r.season)} y={y(r.power) - 9} fontSize={10} textAnchor="middle" className="fill-foreground font-semibold tabular-nums">
            #{r.power}
          </text>
        </g>
      ))}
      <SeasonAxis rows={rows} x={x} y={H - 6} />
    </svg>
  );
};

const DiffChart = ({ team, rows, width }: { team: string; rows: TeamSeasonRow[]; width: number }) => {
  const H = 150;
  const x = xScale(rows, width);
  const peak = Math.max(50, ...rows.map((r) => Math.abs(r.diff)));
  const bound = Math.ceil(peak / 50) * 50;
  const y = (v: number) => PAD.t + ((bound - v) / (2 * bound)) * (H - PAD.t - PAD.b);
  const nums = rows.map((r) => seasonNum(r.season));
  const span = Math.max(1, Math.max(...nums) - Math.min(...nums));
  const barW = Math.max(6, Math.min(26, ((width - PAD.l - PAD.r) / (span + 1)) * 0.6));
  const label = `${team} point differential by season: ${rows.map((r) => `${r.season} ${signed(r.diff)}`).join(', ')}.`;
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={label} className="block">
      <text x={4} y={10} fontSize={9} className="fill-muted-foreground font-semibold uppercase tracking-wider">
        Point differential
      </text>
      {[bound, 0, -bound].map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeOpacity={t === 0 ? 0.9 : 0.4} strokeDasharray={t === 0 ? undefined : '2 3'} />
          <text x={PAD.l - 6} y={y(t) + 3} fontSize={10} textAnchor="end" className="fill-muted-foreground tabular-nums">
            {signed(t)}
          </text>
        </g>
      ))}
      {rows.map((r) => {
        const top = Math.min(y(r.diff), y(0));
        const h = Math.max(1, Math.abs(y(r.diff) - y(0)));
        return (
          <g key={r.season}>
            <rect
              x={x(r.season) - barW / 2}
              y={top}
              width={barW}
              height={h}
              rx={2}
              className={r.diff >= 0 ? 'fill-[hsl(145_63%_42%)]' : 'fill-[hsl(357_80%_62%)]'}
            />
            <text
              x={x(r.season)}
              y={r.diff >= 0 ? top - 4 : top + h + 11}
              fontSize={10}
              textAnchor="middle"
              className="fill-foreground font-semibold tabular-nums"
            >
              {signed(r.diff)}
            </text>
          </g>
        );
      })}
      <SeasonAxis rows={rows} x={x} y={H - 6} />
    </svg>
  );
};

const ChangeCell = ({ row }: { row: TeamSeasonRow }) => {
  const c = row.change;
  if (!c) return <span className="text-muted-foreground">First with scores</span>;
  const gap = seasonNum(row.season) - seasonNum(c.since) > 1;
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
      <span className={signTone(c.power)} aria-label={`Power rank ${c.power > 0 ? 'up' : c.power < 0 ? 'down' : 'unchanged'} ${Math.abs(c.power)}`}>
        {c.power > 0 ? '▲' : c.power < 0 ? '▼' : '='}
        {c.power ? Math.abs(c.power) : ''}
      </span>
      <span className={signTone(c.diff)}>{signed(c.diff)} diff</span>
      <span className={signTone(c.wins)}>{signed(c.wins)} W</span>
      <span className={cn('text-[11px] text-muted-foreground', gap && 'rounded bg-secondary/60 px-1')}>since {c.since}</span>
    </span>
  );
};

const Progression = ({ progression, clubs, team, onTeam }: { progression: Record<string, TeamSeasonRow[]>; clubs: number; team: string; onTeam: (t: string) => void }) => {
  const [ref, width] = useWidth<HTMLDivElement>(340);
  const teams = useMemo(() => Object.keys(progression).sort((a, b) => a.localeCompare(b)), [progression]);
  const rows = useMemo(() => [...(progression[team] ?? [])].sort((a, b) => seasonNum(a.season) - seasonNum(b.season)), [progression, team]);
  const gaps = gapsOf(rows);
  const latest = rows.at(-1);

  return (
    <div className="glass-card space-y-4 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <TeamLogo team={team} decorative className="h-10 w-10 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold uppercase leading-tight">{team}</p>
            <p className="text-xs text-muted-foreground">
              {rows.length} season{rows.length === 1 ? '' : 's'} with weekly scores
              {latest ? ` · latest ${latest.season}: ${latest.record}, No. ${latest.power}` : ''}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-pixel text-[9px] uppercase text-muted-foreground">Club</span>
          <select
            value={team}
            onChange={(e) => onTeam(e.target.value)}
            className="min-w-0 rounded-md border border-border bg-secondary/50 px-2 py-1.5 font-display text-sm font-bold uppercase tracking-wide"
          >
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length > 0 && (
        <div ref={ref} className="min-w-0 space-y-2">
          <PowerChart team={team} rows={rows} clubs={clubs} width={width} />
          <DiffChart team={team} rows={rows} width={width} />
          {rows.length === 1 ? (
            <p className="text-xs text-muted-foreground">
              One season of weekly scores so far ({rows[0].season}). The chart fills in as more seasons are uploaded.
            </p>
          ) : gaps.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Dashed stretches skip seasons without weekly scores ({gaps.map((g) => `${g.prev.season} to ${g.cur.season}`).join(', ')}); nothing is filled in.
            </p>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full min-w-[340px] text-sm">
          <caption className="sr-only">{team} season by season, newest first, with the change against the previous season that has weekly scores</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className={cn(thBase, 'text-left')}>Season</th>
              <th scope="col" className={cn(thBase, 'text-right')}>W-L-T</th>
              <th scope="col" className={cn(thBase, 'text-right')}>
                <abbr title="Power rank" className="no-underline">Pwr</abbr>
              </th>
              <th scope="col" className={cn(thBase, 'text-right')}>Diff</th>
              <th scope="col" className={cn(thBase, 'hidden text-right sm:table-cell')}>
                <abbr title="Pythagorean expected wins" className="no-underline">xW</abbr>
              </th>
              <th scope="col" className={cn(thBase, 'text-right')}>Change</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.season} className="border-t border-border/30">
                <th scope="row" className="px-2 py-1.5 text-left font-display font-bold">{r.season}</th>
                <td className={cn(tdBase, 'text-right font-semibold')}>{`${r.w}-${r.l}-${r.t}`}</td>
                <td className={cn(tdBase, 'text-right')}>{r.power}</td>
                <td className={cn(tdBase, 'text-right', signTone(r.diff))}>{signed(r.diff)}</td>
                <td className={cn(tdBase, 'hidden text-right sm:table-cell')}>
                  {r.expWins != null ? r.expWins.toFixed(1) : dash}
                  {r.pythag != null && <span className="ml-1 text-[11px] text-muted-foreground">({rate(r.pythag)})</span>}
                </td>
                <td className={cn(tdBase, 'text-right text-xs')}>
                  <ChangeCell row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Movers = ({ progression, season, seasonsWithData, onTrack }: { progression: Record<string, TeamSeasonRow[]>; season: string; seasonsWithData: number; onTrack: (t: string) => void }) => {
  const moved = useMemo(
    () =>
      Object.entries(progression)
        .map(([team, rows]) => ({ team, row: rows.find((r) => r.season === season) }))
        .filter((m): m is { team: string; row: TeamSeasonRow & { change: NonNullable<TeamSeasonRow['change']> } } => !!m.row?.change),
    [progression, season],
  );
  if (seasonsWithData < 2) {
    return (
      <p className="glass-card p-4 text-sm text-muted-foreground">
        Risers and fallers appear once a second season of weekly scores is uploaded: each club's power rank against its previous season with scores.
      </p>
    );
  }
  if (!moved.length) {
    return <p className="glass-card p-4 text-sm text-muted-foreground">{season} is the first season with weekly scores, so there is nothing to compare it with.</p>;
  }
  const byChange = [...moved].sort((a, b) => b.row.change.power - a.row.change.power || a.row.power - b.row.power || a.team.localeCompare(b.team));
  const risers = byChange.filter((m) => m.row.change.power > 0).slice(0, 5);
  const fallers = [...byChange].reverse().filter((m) => m.row.change.power < 0).slice(0, 5);
  const List = ({ title, items, up }: { title: string; items: typeof moved; up: boolean }) => (
    <div className="glass-card min-w-0 p-3 sm:p-4">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {up ? <ArrowUp className={cn('h-4 w-4', UP)} aria-hidden /> : <ArrowDown className={cn('h-4 w-4', DOWN)} aria-hidden />} {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None this season.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((m) => (
            <li key={m.team}>
              <button type="button" onClick={() => onTrack(m.team)} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-secondary/40">
                <ClubName team={m.team} className="flex-1 font-medium" />
                <span className="text-xs tabular-nums text-muted-foreground">
                  #{m.row.power + m.row.change.power} → #{m.row.power}
                </span>
                <span className={cn('w-10 text-right font-display font-bold tabular-nums', up ? UP : DOWN)}>
                  {up ? '▲' : '▼'}
                  {Math.abs(m.row.change.power)}
                </span>
                <span className="hidden w-16 text-right text-[11px] text-muted-foreground min-[420px]:inline">since {m.row.change.since}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <List title={`Risers, ${season}`} items={risers} up />
      <List title={`Fallers, ${season}`} items={fallers} up={false} />
    </div>
  );
};

/* ---------------- Section ---------------- */

const prefersCompact = () => !!(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches);

const TeamAdvanced = () => {
  const schedule = useSchedule();
  const currentClub = useCurrentClub();
  const seasons = useMemo(() => (schedule ? scheduleSeasons(schedule) : []), [schedule]);
  const [picked, setPicked] = useState<string | null>(null);
  const [compact, setCompact] = useState<boolean>(prefersCompact);
  const [tracked, setTracked] = useState<string | null>(null);
  const progressionRef = useRef<HTMLElement>(null);

  if (!schedule) return null;

  if (!seasons.length) {
    return (
      <section aria-labelledby="advanced-heading" className="space-y-3">
        <h2 id="advanced-heading" className="section-title text-2xl">Advanced team stats</h2>
        <p className="glass-card p-4 text-sm text-muted-foreground">
          No weekly scores yet. Advanced team stats (expected wins, luck, consistency, home edge) and each club's progression come from the LEAGUE
          schedule screens, one per week, plus the standings; they appear here once a season of them is uploaded.
        </p>
      </section>
    );
  }

  const season = seasons.find((s) => s.season === picked) ?? seasons[0];
  const progression = schedule.progression ?? {};
  const defaultTeam = [currentClub, seasons[0].coachTeam, Object.keys(progression).sort()[0]].find((t) => t && progression[t]) ?? null;
  const team = tracked && progression[tracked] ? tracked : defaultTeam;
  const track = (t: string) => {
    setTracked(t);
    progressionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <section aria-labelledby="advanced-heading" className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 id="advanced-heading" className="section-title text-2xl">
            Advanced team stats
            <span className="font-pixel text-[9px] text-muted-foreground">{season.season}</span>
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            From the weekly league scores: Pythagorean expected wins (points scored and allowed), luck (wins above or below them), margin adjusted for the
            schedule, consistency of game margins and the home edge. Pick a club to follow its progression.
          </p>
        </div>
        <div className="glass-card flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <SeasonPicker seasons={seasons} value={season.season} onChange={setPicked} />
          <div role="group" aria-label="Columns" className="flex items-center gap-2">
            <span className="font-pixel text-[9px] uppercase text-muted-foreground">Columns</span>
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
              {[
                { key: true, label: 'Key' },
                { key: false, label: 'All' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={compact === o.key}
                  onClick={() => setCompact(o.key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors',
                    compact === o.key ? 'bg-gold text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <InsightCards season={season} />
        <AdvancedTable season={season} compact={compact} onTrack={track} />
      </section>

      <section ref={progressionRef} aria-labelledby="progression-heading" className="scroll-mt-20 space-y-4">
        <h2 id="progression-heading" className="section-title text-2xl">
          <LineChart className="h-5 w-5 text-gold" aria-hidden /> Progression
          <span className="font-pixel text-[9px] text-muted-foreground">
            <CalendarRange className="mr-1 inline h-3 w-3" aria-hidden />
            {seasons.length} season{seasons.length === 1 ? '' : 's'}
          </span>
        </h2>
        {team ? (
          <Progression progression={progression} clubs={season.table.length || 32} team={team} onTeam={setTracked} />
        ) : (
          <p className="glass-card p-4 text-sm text-muted-foreground">No club has a season of weekly scores yet.</p>
        )}
        <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-gold">
          <TrendingUp className="h-4 w-4" aria-hidden /> Risers and fallers
        </h3>
        <Movers progression={progression} season={season.season} seasonsWithData={seasons.length} onTrack={track} />
      </section>
    </>
  );
};

export default TeamAdvanced;
