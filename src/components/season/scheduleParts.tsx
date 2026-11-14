import { Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeadToHead } from '@/utils/schedule';
import TeamLogo from '@/components/timeline/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { FormPips, lampText } from './seasonGamesUi';
import { SectionTitle, useOpenTeam } from './SeasonGames';

/**
 * The Season page's all-time head-to-head, from public/data/league/schedule.json (scripts/schedule_content.py): the
 * coach's record with every club met in a season with weekly scores. Rules only.
 */

/* ---------------- Head-to-head ---------------- */

/** Every club the coach has met in a season with weekly scores, as a club banner tile: the club's colours with its
 * secondary edge, the logo large with a faint watermark, the name in display type, the record in lamp digits over a
 * win-share bar, the last meetings as pips and the games count. Opens the team. Sorted by meetings. */
export const HeadToHeadGrid = ({ h2h, span }: { h2h: Record<string, HeadToHead>; span?: string }) => {
  const rows = Object.values(h2h)
    .filter((r) => r.games > 0)
    .sort((a, b) => b.games - a.games || b.w - b.l - (a.w - a.l) || a.team.localeCompare(b.team));
  const openTeam = useOpenTeam();
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <SectionTitle icon={Swords}>Head-to-head{span ? ` · ${span}` : ''}</SectionTitle>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        {rows.map((r) => {
          const nfl = findNFLTeam(r.team);
          const prim = nfl?.primaryColor ?? '226 38% 27%';
          const ink = getReadableTextOn(prim);
          const pct = (r.w + r.t / 2) / r.games;
          const last = r.meetings.slice(-5).map((m) => m.result).join('');
          return (
            <li key={r.team}>
              <button
                type="button"
                onClick={() => openTeam(r.team)}
                aria-label={`${r.team}: ${r.record} in ${r.games} games, ${Math.round(pct * 100)}% won. Open the team`}
                className="group relative flex h-16 w-full items-center gap-2 overflow-hidden rounded-lg pl-2.5 pr-2 text-left shadow-[0_6px_18px_hsl(228_60%_2%/0.35)] ring-1 ring-black/30 transition-[transform,filter] duration-150 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold))] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{
                  color: ink,
                  background: `linear-gradient(180deg, hsl(0 0% 100% / 0.12), transparent 50%), linear-gradient(100deg, hsl(${prim}) 0%, hsl(${prim}) 45%, color-mix(in srgb, hsl(${prim}) 55%, #000) 100%)`,
                  boxShadow: `inset 4px 0 0 hsl(${nfl?.secondaryColor ?? prim})`,
                }}
              >
                <TeamLogo team={r.team} decorative className="pointer-events-none absolute -right-3 -top-2 h-20 w-20 opacity-[0.13]" />
                <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-black/30">
                  <TeamLogo team={r.team} decorative className="h-8 w-8 drop-shadow" />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-bold uppercase leading-tight tracking-wide">{nfl?.name ?? r.team}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] opacity-85">
                    <span className="hidden sm:inline">
                      <FormPips form={last} label="Last meetings" />
                    </span>
                    <span className="tabular-nums">
                      {r.games} gm{r.games === 1 ? '' : 's'}
                    </span>
                  </span>
                </span>
                <span className="relative flex flex-shrink-0 flex-col items-end gap-1 rounded-md bg-black/45 px-1.5 py-1">
                  <span className={cn('font-pixel text-sm leading-none tabular-nums', lampText)}>{r.record}</span>
                  <span aria-hidden className="relative block h-1 w-12 overflow-hidden rounded-full bg-white/15">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: `hsl(${prim})`, boxShadow: '0 0 0 1px hsl(0 0% 100% / 0.35) inset' }} />
                  </span>
                  <span className="font-pixel text-[7px] leading-none text-white/70">{Math.round(pct * 100)}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
