import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { useStagger } from '@/utils/motion';
import { VALUE_ACROSS_MIN_GAMES, valueAcrossPositions } from '@/config/advanced';
import TeamLogo from '../../brand/TeamLogo';
import { fmtNum } from './viz';
import { keyOf } from '../records';

const SHOWN = 10;

/** Value / Game ranked across every position, each player scored against his own position's spread. */
const ValueAcrossBoard = ({ players, onSelect }: { players: Player[]; onSelect: (p: Player) => void }) => {
  const all = useMemo(() => valueAcrossPositions(players), [players]);
  const [expanded, setExpanded] = useState(false);
  const rowMotion = useStagger();
  if (all.length === 0) return null;
  const rows = expanded ? all.slice(0, 50) : all.slice(0, SHOWN);

  return (
    <section aria-labelledby="lab-across-title" className="glass-card flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div className="min-w-0">
        <h3 id="lab-across-title" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
          <Scale className="h-4 w-4 text-gold" aria-hidden="true" />
          Value / Game, every position
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          League Score per game, the rate beside OVR&apos;s career total. Positions score on different scales, so each player is ranked by how
          far above his own position&apos;s average he sits (<b className="text-foreground">σ</b>, standard deviations), min{' '}
          {VALUE_ACROSS_MIN_GAMES} games.
        </p>
      </div>

      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Players of every position ranked by Value / Game relative to their position (min {VALUE_ACROSS_MIN_GAMES} games)</caption>
        <thead>
          <tr className="text-left font-pixel text-[9px] uppercase text-muted-foreground">
            <th scope="col" className="w-7 pb-1 font-normal">
              #
            </th>
            <th scope="col" className="pb-1 font-normal">
              Player
            </th>
            <th scope="col" className="hidden w-12 pb-1 text-right font-normal sm:table-cell">
              G
            </th>
            <th scope="col" className="w-14 pb-1 text-right font-normal">
              Val/G
            </th>
            <th scope="col" className="w-14 pb-1 text-right font-normal">
              <abbr title="Standard deviations above the position average" className="no-underline">
                σ
              </abbr>
            </th>
            <th scope="col" className="w-16 pb-1 text-right font-normal">
              At pos
            </th>
          </tr>
        </thead>
        <tbody className={rowMotion}>
          {rows.map((r) => (
            <tr key={keyOf(r.player)} className="group border-t border-line/40">
              <td className={cn('py-1.5 font-pixel text-[10px]', r.rank === 1 ? 'text-gold' : 'text-muted-foreground')}>{r.rank}</td>
              <td className="py-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(r.player)}
                  className="flex w-full min-w-0 items-center gap-1.5 rounded text-left font-semibold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {r.player.team ? <TeamLogo team={r.player.team} size={18} decorative /> : <span className="w-[18px]" aria-hidden="true" />}
                  <span className="truncate">{r.player.name}</span>
                  <span className="shrink-0 font-pixel text-[9px] text-muted-foreground">{r.player.position}</span>
                </button>
              </td>
              <td className="hidden py-1.5 text-right font-mono tabular-nums text-muted-foreground sm:table-cell">{r.player.games}</td>
              <td className="py-1.5 text-right font-mono font-bold tabular-nums text-chalk">{fmtNum(r.value, 2)}</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-gold">+{fmtNum(r.sigma, 2)}</td>
              <td className="py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                #{r.posRank}
                <span className="sr-only"> of {r.posCount} {r.player.position}s</span>
                <span aria-hidden="true">/{r.posCount}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {all.length > SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start rounded-md border border-line bg-night/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {expanded ? 'Show top 10' : `Show top ${Math.min(50, all.length)}`}
        </button>
      )}
    </section>
  );
};

export default ValueAcrossBoard;
