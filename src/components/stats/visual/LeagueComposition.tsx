import { useMemo, useState } from 'react';
import { Layers3, Shield } from 'lucide-react';
import type { Player, Position } from '@/types/player';
import { POSITIONS } from '@/config/advanced';
import { HOF_THRESHOLD, LEGACY_TIERS, getLegacyTier, isHallOfFamer, type LegacyTierKey } from '@/config/stats';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { findNFLTeam } from '@/utils/nflTeams';
import { getAllChampions, useLeagueContent } from '@/utils/leagueContent';
import TeamLogo from '../../brand/TeamLogo';
import ChartFrame from '../analytics/ChartFrame';
import Chips from '../analytics/Chips';
import { fmtNum } from '../analytics/viz';
import { teamMark } from './chartKit';
import { Legend } from './chartParts';
import { useStagger } from '@/utils/motion';

// ---------- Hall of Fame tiers by position ----------

type Band = LegacyTierKey | 'none';

/** Sequential gold ramp (brighter = higher tier) plus a neutral for players below the Hall of Fame bar. */
const BAND_FILL: Record<Band, string> = {
  legendary: 'hsl(45 100% 70%)',
  elite: 'hsl(41 92% 56%)',
  great: 'hsl(37 80% 44%)',
  inductee: 'hsl(33 64% 33%)',
  none: 'hsl(226 26% 26%)',
};
const BAND_INK: Record<Band, string> = {
  legendary: 'hsl(228 47% 7%)',
  elite: 'hsl(228 47% 7%)',
  great: 'hsl(228 100% 97%)',
  inductee: 'hsl(228 100% 97%)',
  none: 'hsl(225 30% 75%)',
};
const BANDS: { key: Band; label: string }[] = [
  ...LEGACY_TIERS.map((t) => ({ key: t.key as Band, label: `${t.label[0]}${t.label.slice(1).toLowerCase()} (${fmtNum(t.min, 0)}+)` })),
  { key: 'none', label: `Not in the Hall (< ${fmtNum(HOF_THRESHOLD, 0)})` },
];

const bandOf = (p: Player): Band => getLegacyTier(p.careerLegacy)?.key ?? 'none';

interface TierRow {
  pos: Position;
  total: number;
  counts: Record<Band, number>;
  names: Record<Band, string[]>;
}

const TierBar = ({ row, max }: { row: TierRow; max: number }) => {
  const hof = row.total - row.counts.none;
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem] items-center gap-2">
      <span className="font-display text-sm font-bold" title={POSITION_NAMES[row.pos]}>
        {row.pos}
      </span>
      <span className="flex h-6 gap-[2px]" style={{ width: `${(row.total / max) * 100}%` }} aria-hidden="true">
        {BANDS.map(({ key, label }) => {
          const n = row.counts[key];
          if (!n) return null;
          return (
            <span
              key={key}
              title={`${label}: ${n}${row.names[key].length && key !== 'none' ? ` (${row.names[key].join(', ')})` : ''}`}
              className="flex h-full min-w-[4px] items-center justify-center overflow-hidden rounded-[3px] font-mono text-[10px] font-bold tabular-nums"
              style={{ flexGrow: n, flexBasis: 0, background: BAND_FILL[key], color: BAND_INK[key] }}
            >
              {n}
            </span>
          );
        })}
      </span>
      <span className="text-right font-mono text-xs tabular-nums text-secondary-foreground">
        <b className="text-gold">{hof}</b> / {row.total}
      </span>
      <span className="sr-only">
        {POSITION_NAMES[row.pos]}: {hof} Hall of Famers of {row.total} players.{' '}
        {BANDS.filter((b) => row.counts[b.key])
          .map((b) => `${b.label}: ${row.counts[b.key]}`)
          .join(', ')}
      </span>
    </li>
  );
};

export const HofTiers = ({ players }: { players: Player[] }) => {
  const rows: TierRow[] = useMemo(
    () =>
      POSITIONS.map((pos) => {
        const at = players.filter((p) => p.position === pos);
        const counts = { legendary: 0, elite: 0, great: 0, inductee: 0, none: 0 } as Record<Band, number>;
        const names = { legendary: [], elite: [], great: [], inductee: [], none: [] } as Record<Band, string[]>;
        at.forEach((p) => {
          const b = bandOf(p);
          counts[b] += 1;
          names[b].push(p.name);
        });
        return { pos, total: at.length, counts, names };
      }).filter((r) => r.total > 0),
    [players],
  );
  const max = Math.max(...rows.map((r) => r.total), 1);
  const hof = players.filter(isHallOfFamer).length;

  return (
    <ChartFrame
      title="Hall of Fame by position"
      icon={<Layers3 className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`Each bar is one position's players, split by legacy tier: ${hof} of ${players.length} league players are in the Hall (Career Legacy ${fmtNum(HOF_THRESHOLD, 0)}+). Bar length = players at the position; the right column is Hall of Famers / players.`}
      controls={
        <Legend
          label="Legacy tiers"
          items={BANDS.map((b) => ({ key: b.key, label: b.label, swatch: <span aria-hidden="true" className="h-2.5 w-3.5 rounded-sm" style={{ background: BAND_FILL[b.key] }} /> }))}
        />
      }
      chart={
        <ol className="space-y-2" aria-label="Legacy tiers by position">
          {rows.map((r) => (
            <TierBar key={r.pos} row={r} max={max} />
          ))}
        </ol>
      }
      table={
        <div className="overflow-x-auto rounded-md border border-line/60">
          <table className="w-full text-sm">
            <caption className="sr-only">Players per legacy tier, by position</caption>
            <thead className="bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-normal">Pos</th>
                {BANDS.map((b) => (
                  <th key={b.key} scope="col" className="px-2 py-1.5 text-right font-normal">
                    {b.key === 'none' ? 'Not HOF' : b.key}
                  </th>
                ))}
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pos} className="border-t border-line/40">
                  <th scope="row" className="px-2 py-1 text-left font-semibold">{r.pos}</th>
                  {BANDS.map((b) => (
                    <td key={b.key} className="px-2 py-1 text-right font-mono tabular-nums">{r.counts[b.key] || '—'}</td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
};

// ---------- Franchise breakdown ----------

type TeamMetric = 'titles' | 'hof' | 'players';

interface TeamRow {
  id: string;
  name: string;
  titles: number;
  hof: number;
  players: number;
  hofNames: string[];
}

const TEAM_METRICS: { id: TeamMetric; label: string; title: string }[] = [
  { id: 'titles', label: 'Titles', title: 'Super Bowl titles won in the save' },
  { id: 'hof', label: 'Hall of Famers', title: 'Hall of Famers whose current team it is' },
  { id: 'players', label: 'Players', title: 'League players on the team now' },
];

const SHOW = 10;

const TeamBar = ({ row, metric, max }: { row: TeamRow; metric: TeamMetric; max: number }) => {
  const v = row[metric];
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,7.5rem)_minmax(0,1fr)_2rem] items-center gap-2 sm:grid-cols-[1.5rem_minmax(0,9rem)_minmax(0,1fr)_2.5rem]">
      <TeamLogo team={row.name} size={22} decorative />
      <span className="truncate text-sm font-semibold">{row.name}</span>
      <span className="block h-3 rounded-sm bg-night/70" aria-hidden="true">
        <span
          className="block h-full rounded-r-[4px] motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${Math.max((v / max) * 100, 2)}%`, background: teamMark(row.name) }}
        />
      </span>
      <span className="text-right font-mono text-sm font-bold tabular-nums text-chalk">{v}</span>
    </li>
  );
};

export const FranchiseBars = ({ players }: { players: Player[] }) => {
  const { content } = useLeagueContent();
  const [metric, setMetric] = useState<TeamMetric>('titles');
  const [expanded, setExpanded] = useState(false);
  const rowMotion = useStagger();

  const all: TeamRow[] = useMemo(() => {
    const map = new Map<string, TeamRow>();
    const get = (raw?: string | null) => {
      const t = findNFLTeam(raw);
      if (!t) return null;
      if (!map.has(t.id)) map.set(t.id, { id: t.id, name: t.name, titles: 0, hof: 0, players: 0, hofNames: [] });
      return map.get(t.id)!;
    };
    players.forEach((p) => {
      const row = get(p.team);
      if (!row) return;
      row.players += 1;
      if (isHallOfFamer(p)) {
        row.hof += 1;
        row.hofNames.push(p.name);
      }
    });
    getAllChampions(content?.superBowls ?? []).forEach((c) => {
      const row = get(c.team);
      if (row) row.titles += c.titles;
    });
    return [...map.values()];
  }, [players, content]);

  const sorted = useMemo(() => all.filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name)), [all, metric]);
  const rows = expanded ? sorted : sorted.slice(0, SHOW);
  const max = Math.max(...sorted.map((r) => r[metric]), 1);
  const m = TEAM_METRICS.find((x) => x.id === metric)!;
  const total = sorted.reduce((s, r) => s + r[metric], 0);

  return (
    <ChartFrame
      title="Franchise breakdown"
      icon={<Shield className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`${m.title}, by franchise: ${total} across ${sorted.length} teams${sorted[0] ? `, led by the ${sorted[0].name} (${sorted[0][metric]})` : ''}. Bars use each team's colour; the logo and name carry the identity.`}
      controls={<Chips label="Franchise metric" value={metric} onChange={(v) => { setMetric(v); setExpanded(false); }} options={TEAM_METRICS.map((x) => ({ value: x.id, label: x.label, title: x.title }))} />}
      chart={
        sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{metric === 'titles' && !content ? 'Loading the Super Bowl history…' : 'Nothing to show yet.'}</p>
        ) : (
          <ol className={`space-y-1.5 ${rowMotion}`} aria-label={`Teams by ${m.label}`}>
            {rows.map((r) => (
              <TeamBar key={r.id} row={r} metric={metric} max={max} />
            ))}
          </ol>
        )
      }
      table={
        <div className="relative max-h-[420px] overflow-auto rounded-md border border-line/60">
          <table className="w-full text-sm">
            <caption className="sr-only">Titles, Hall of Famers and players per franchise</caption>
            <thead className="sticky top-0 bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-normal">Team</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Titles</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">HOF</th>
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Players</th>
                <th scope="col" className="hidden px-2 py-1.5 font-normal sm:table-cell">Hall of Famers</th>
              </tr>
            </thead>
            <tbody>
              {[...all].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name)).map((r) => (
                <tr key={r.id} className="border-t border-line/40">
                  <th scope="row" className="px-2 py-1 text-left font-semibold">{r.name}</th>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{r.titles}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{r.hof}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{r.players}</td>
                  <td className="hidden px-2 py-1 text-xs text-muted-foreground sm:table-cell">{r.hofNames.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      footer={
        sorted.length > SHOW ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="self-start rounded text-xs font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {expanded ? `Show top ${SHOW}` : `Show all ${sorted.length} teams`}
          </button>
        ) : undefined
      }
    />
  );
};

