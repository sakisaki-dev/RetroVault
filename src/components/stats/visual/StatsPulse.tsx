import { useMemo, type ReactNode } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { POSITIONS, leaguePlayers } from '@/config/advanced';
import { playerKey } from '@/config/ovr';
import { HOF_THRESHOLD, isHallOfFamer } from '@/config/stats';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import CountUp from '../../brand/CountUp';
import TeamLogo from '../../brand/TeamLogo';
import { VIZ, fmtNum } from '../analytics/viz';
import type { RecordBook } from '../records';
import { GOLD } from './chartKit';

const ELITE_OVR = 90;

interface Col {
  label: string;
  value: number;
  hot: boolean;
  tip: string;
}

/** Mini column chart (decorative; the card's text and aria summary carry the numbers). */
const MiniColumns = ({ cols, showLabels }: { cols: Col[]; showLabels?: boolean }) => {
  const max = Math.max(...cols.map((c) => c.value), 1);
  return (
    <span className="block" aria-hidden="true">
      <span className="flex h-12 items-end gap-[2px]">
        {cols.map((c) => (
          <span key={c.label} title={c.tip} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max((c.value / max) * 100, c.value ? 6 : 2)}%`, background: c.hot ? GOLD : VIZ.series[0], opacity: c.value ? 1 : 0.3 }} />
        ))}
      </span>
      {showLabels && (
        <span className="mt-0.5 flex gap-[2px]">
          {cols.map((c) => (
            <span key={c.label} className="flex-1 text-center font-pixel text-[7px] text-muted-foreground">
              {c.label}
            </span>
          ))}
        </span>
      )}
    </span>
  );
};

const Card = ({ title, value, decimals = 0, suffix, sub, chart, summary }: { title: string; value: number | null; decimals?: number; suffix?: string; sub: ReactNode; chart: ReactNode; summary: string }) => (
  <li className="glass-card flex min-w-0 flex-col gap-1.5 p-3">
    <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
    <span className="font-display text-3xl font-extrabold leading-none text-chalk sm:text-4xl">
      {value == null ? '—' : <CountUp value={value} decimals={decimals} />}
      {suffix && <span className="text-lg text-gold">{suffix}</span>}
    </span>
    <span className="min-h-[1.25rem] text-xs text-secondary-foreground">{sub}</span>
    <span className="mt-auto pt-1">{chart}</span>
    <span className="sr-only">{summary}</span>
  </li>
);

/** Headline numbers with a mini chart each: league size, the Hall of Fame, elite OVRs and the closest record chase. */
const StatsPulse = ({ data, book, onSelect }: { data: LeagueData; book: RecordBook; onSelect: (p: Player) => void }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const ovrMap = useOfficialOvr();

  const pos = useMemo(() => POSITIONS.map((p) => ({ label: p, value: players.filter((x) => x.position === p).length, hot: false, tip: `${p}: ${players.filter((x) => x.position === p).length}` })), [players]);
  const hof = players.filter(isHallOfFamer).length;
  const legacyBins = useMemo(() => {
    const top = Math.max(...players.map((p) => p.careerLegacy), HOF_THRESHOLD);
    const n = Math.ceil(top / 1000);
    return Array.from({ length: n }, (_, i) => {
      const lo = i * 1000;
      const c = players.filter((p) => p.careerLegacy >= lo && p.careerLegacy < lo + 1000).length;
      return { label: `${i}k`, value: c, hot: lo >= HOF_THRESHOLD, tip: `${fmtNum(lo, 0)}–${fmtNum(lo + 999, 0)}: ${c}` };
    });
  }, [players]);
  const ovrs = useMemo(() => players.map((p) => ovrMap.get(playerKey(p))).filter((v): v is number => v != null), [players, ovrMap]);
  const ovrBins = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const lo = 60 + i * 5;
        const c = ovrs.filter((v) => v >= lo && v < lo + 5).length;
        return { label: String(lo), value: c, hot: lo >= ELITE_OVR, tip: `${lo}–${lo + 4}: ${c}` };
      }),
    [ovrs],
  );
  const elite = ovrs.filter((v) => v >= ELITE_OVR).length;
  const chase = book.pace[0];

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="League at a glance">
      <Card
        title="League players"
        value={players.length}
        sub="by position"
        chart={<MiniColumns cols={pos} showLabels />}
        summary={`Players by position: ${pos.map((c) => `${c.label} ${c.value}`).join(', ')}.`}
      />
      <Card
        title="Hall of Famers"
        value={hof}
        sub={`${players.length ? Math.round((hof / players.length) * 100) : 0}% of the league · ${fmtNum(HOF_THRESHOLD, 0)}+ legacy`}
        chart={<MiniColumns cols={legacyBins} />}
        summary={`Career Legacy histogram in 1,000-point bins, Hall of Fame bins in gold: ${legacyBins.map((b) => `${b.label} ${b.value}`).join(', ')}.`}
      />
      <Card
        title={`${ELITE_OVR}+ overall`}
        value={ovrs.length ? elite : null}
        sub={ovrs.length ? `of ${ovrs.length} rated players` : 'Loading ratings…'}
        chart={<MiniColumns cols={ovrBins} showLabels />}
        summary={`Official OVR histogram in 5-point bins: ${ovrBins.map((b) => `${b.label} ${b.value}`).join(', ')}.`}
      />
      {chase ? (
        <Card
          title="Closest record chase"
          value={Math.floor(chase.percentToRecord)}
          suffix="%"
          sub={
            <button type="button" onClick={() => onSelect(chase.player)} className="inline-flex max-w-full items-center gap-1.5 rounded font-semibold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {chase.player.team && <TeamLogo team={chase.player.team} size={16} decorative />}
              <span className="truncate">{chase.player.name}</span>
            </button>
          }
          chart={
            <span className="block space-y-1" aria-hidden="true">
              <span className="relative block h-2.5 rounded-sm bg-night/80">
                <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${Math.min(chase.percentToRecord, 100)}%`, background: VIZ.series[0] }} />
                <span className="absolute -inset-y-1 right-0 w-0.5" style={{ background: GOLD }} />
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {chase.recordName} · ETA {chase.seasonsToBreak} {chase.seasonsToBreak === 1 ? 'season' : 'seasons'}
              </span>
            </span>
          }
          summary={`${chase.player.name} has ${Math.floor(chase.percentToRecord)}% of the ${chase.recordName} record and is on pace to pass it in ${chase.seasonsToBreak} seasons.`}
        />
      ) : (
        <Card title="Career records" value={book.boards.size} sub="tracked boards" chart={null} summary="" />
      )}
    </ul>
  );
};

export default StatsPulse;
