import { useMemo, type CSSProperties } from 'react';
import { ChevronRight, Radar } from 'lucide-react';
import type { Player } from '@/types/player';
import { compFeatureLabels, similarPlayers } from '@/config/advanced';
import { findNFLTeam } from '@/utils/nflTeams';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import { fmtNum } from '@/components/stats/analytics/viz';
import { openInCompFinder } from '@/components/stats/comps/compFinderLink';
import { headlineStats } from './statLines';

interface Props {
  player: Player;
  players: Player[];
  numberFor: (p: Player) => number;
  onSelect: (p: Player) => void;
  /** Called after "Open Deep Dive" (e.g. to close the card dialog). */
  onNavigate?: () => void;
}

/** The three most similar careers at the position; each one switches the card. */
const CompsPanel = ({ player, players, numberFor, onSelect, onNavigate }: Props) => {
  const comps = useMemo(() => similarPlayers(players, player, 3), [players, player]);
  const mine = headlineStats(player);
  if (!comps.length) return <p className="text-sm text-muted-foreground">No comparable careers at this position yet.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Nearest league {player.position}s by profile ({compFeatureLabels(player.position).join(', ')}), each z-scored within the position.
          100 = identical profile.
        </p>
        <button
          type="button"
          onClick={() => {
            openInCompFinder(player);
            onNavigate?.();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-semibold text-[color:var(--tc-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tc-accent)]"
        >
          <Radar className="h-3.5 w-3.5" aria-hidden="true" />
          Open Deep Dive
        </button>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {comps.map((comp, i) => {
          const { player: c, similarity } = comp;
          const smallSample = (comp as { smallSample?: boolean }).smallSample;
          const theirs = headlineStats(c);
          return (
            <li key={`${c.position}:${c.name}`} className="pc-enter" style={{ '--i': i } as CSSProperties}>
              <div className="pc-tile group relative flex h-full w-full flex-col overflow-hidden text-left transition-transform focus-within:ring-2 focus-within:ring-[color:var(--tc-accent)] hover:-translate-y-0.5">
                <ProPlayerBanner
                  size="compact"
                  name={c.name}
                  position={c.position}
                  team={findNFLTeam(c.team) ?? c.team}
                  number={numberFor(c)}
                  className="rounded-none [&_.ppb\_\_field]:rounded-none"
                />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-pixel text-[9px] uppercase text-muted-foreground">
                      Similarity{smallSample ? ' · small sample' : ''}
                    </span>
                    <span className="font-display text-2xl font-bold tabular-nums text-chalk">{Math.round(similarity)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-sm bg-[color:var(--tc-track)]" aria-hidden="true">
                    <div className="h-full rounded-r-[4px] bg-[color:var(--tc-accent)]" style={{ width: `${similarity}%` }} />
                  </div>
                  <table className="mt-1 w-full text-[11px]">
                    <thead>
                      <tr className="font-pixel text-[8px] uppercase text-muted-foreground">
                        <th scope="col" className="text-left font-normal">
                          <span className="sr-only">Stat</span>
                        </th>
                        <th scope="col" className="text-right font-normal">{c.name.split(' ').slice(-1)[0]}</th>
                        <th scope="col" className="pl-3 text-right font-normal">{player.name.split(' ').slice(-1)[0]}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {theirs.slice(0, 3).map((s, k) => (
                        <tr key={s.key}>
                          <th scope="row" className="truncate text-left font-normal text-muted-foreground">{s.label}</th>
                          <td className="text-right font-mono tabular-nums text-chalk">{s.value == null ? '—' : fmtNum(s.value, s.decimals ?? 0)}</td>
                          <td className="pl-3 text-right font-mono tabular-nums text-muted-foreground">
                            {mine[k]?.value == null ? '—' : fmtNum(mine[k].value as number, mine[k].decimals ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Stretched button: the whole tile is clickable, but only this element is interactive */}
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-[color:var(--tc-accent)] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                  >
                    Open {c.name}&rsquo;s card
                    <span className="sr-only"> ({Math.round(similarity)} similarity)</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CompsPanel;
