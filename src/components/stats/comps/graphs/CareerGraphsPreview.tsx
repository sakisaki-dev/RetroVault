import { LineChart } from 'lucide-react';
import type { Player } from '@/types/player';
import { useCareerSeasons } from '@/utils/careerSeasons';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import { findNFLTeam } from '@/utils/nflTeams';
import { liftForDarkBg } from '@/utils/teamColors';
import { openDeepDiveAt } from '../compFinderLink';
import { groupOf } from './statDefs';
import { shortNum } from './graphKit';

/**
 * The player card's way into the career graphs: his card value at each season end as a sparkline coloured by club,
 * a gold tick on each ring season, and a link to the Deep Dive's Career graphs. Nothing when he has under two
 * season ends on record (real NFL legends included).
 */
const CareerGraphsPreview = ({ player, onNavigate }: { player: Player; onNavigate?: () => void }) => {
  const file = useCareerSeasons();
  const extras = usePlayerExtras();
  const entry = file?.players[`${player.position}:${player.name}`];
  if (!file || !entry || player.isRealLegend) return null;
  const start = file.seasons.indexOf(entry.from);
  const ringAt = (file.fields[groupOf(player.position)] ?? []).indexOf('rings');
  const pts = entry.rows.flatMap((r, i) => (r ? [{ year: file.seasons[start + i], value: Number(r[3]) || 0, rings: ringAt >= 0 ? Number(r[5 + ringAt]) || 0 : 0 }] : []));
  if (pts.length < 2) return null;
  const st = extras.stints[normalizeName(player.name)]?.stints ?? [];
  const clubOf = (y: number) => (st.find((s) => y >= s.from && y <= s.to) ?? (y < (st[0]?.from ?? 0) ? st[0] : st[st.length - 1]))?.team ?? player.team;
  const W = 300;
  const H = 54;
  const max = Math.max(1, ...pts.map((p) => p.value));
  const x = (i: number) => 4 + (i * (W - 8)) / (pts.length - 1);
  const y = (v: number) => H - 6 - (v / max) * (H - 14);
  const last = pts[pts.length - 1];
  return (
    <div className="mt-4 rounded-lg border border-line/70 bg-panel/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold uppercase tracking-wide">Career graphs</p>
        <button
          type="button"
          className="link-chip shrink-0 text-xs text-[color:var(--tc-accent)]"
          onClick={() => {
            openDeepDiveAt(player, 'dd-graphs');
            onNavigate?.();
          }}
        >
          <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
          Open the graphs
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block h-14 w-full" preserveAspectRatio="none" role="img" aria-label={`Card value by season, Y${pts[0].year} to Y${last.year}: ${shortNum(pts[0].value)} to ${shortNum(last.value)} coins`}>
        {pts.slice(1).map((p, i) => {
          const t = findNFLTeam(clubOf(p.year));
          return <line key={p.year} x1={x(i)} y1={y(pts[i].value)} x2={x(i + 1)} y2={y(p.value)} stroke={t ? liftForDarkBg(t.primaryColor, 58) : 'hsl(225 30% 70%)'} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
        })}
        {pts.map((p, i) => (i > 0 && p.rings > pts[i - 1].rings ? <rect key={p.year} x={x(i) - 1.5} y={2} width={3} height={5} fill="hsl(43 100% 62%)" /> : null))}
      </svg>
      <p className="text-[11px] text-muted-foreground">
        Card value by season end, Y{pts[0].year}–Y{last.year}, coloured by club; gold ticks are ring seasons. Every season&rsquo;s box score, percentiles and the race to the record are in the Deep Dive.
      </p>
    </div>
  );
};

export default CareerGraphsPreview;
