import { useMemo } from 'react';
import { Flag } from 'lucide-react';
import type { Player } from '@/types/player';
import { similarAmong, type Comp } from '@/config/advanced';
import { playerKey } from '@/config/ovr';
import TeamLogo from '../../brand/TeamLogo';

interface Props {
  /** League players: the similarity baseline (means, SDs, percentiles) */
  league: Player[];
  /** Real NFL players from the arcade pool */
  legends: Player[];
  player: Player;
  ovrMap: Map<string, number>;
  onSelect: (p: Player) => void;
}

const COUNT = 4;

const CompRow = ({ comp, ovr, onSelect }: { comp: Comp; ovr?: number; onSelect: (p: Player) => void }) => {
  const p = comp.player as Player & { photo?: { url?: string } };
  const pct = Math.round(comp.similarity);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(p)}
        aria-label={`${p.name}, real NFL ${p.position}: ${pct}% similar. Open card`}
        className="group flex w-full items-center gap-2.5 rounded-lg border border-line bg-night/40 px-2.5 py-2 text-left transition-colors hover:border-gold/60 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {p.photo?.url ? (
          <img src={p.photo.url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover object-top ring-1 ring-line" loading="lazy" />
        ) : (
          <TeamLogo team={p.team} size={30} decorative />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold group-hover:text-gold">{p.name}</span>
            <span className="shrink-0 rounded bg-red-500/15 px-1 font-pixel text-[8px] uppercase text-red-300 ring-1 ring-red-400/40">NFL</span>
          </span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
            <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.max(pct, 2)}%` }} />
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {p.games} G{(p as { isCurrentNFL?: boolean }).isCurrentNFL ? ' · active, approx. totals' : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-display text-lg font-extrabold tabular-nums text-gold">{pct}%</span>
          {ovr != null && <span className="font-pixel text-[8px] text-muted-foreground">OVR {ovr}</span>}
        </span>
      </button>
    </li>
  );
};

/**
 * Real-life comps: the NFL players from the arcade pool who play most like this league player, on the league's own
 * baseline (same features and scales as the league comps above).
 */
const DdRealComps = ({ league, legends, player, ovrMap, onSelect }: Props) => {
  const sets = useMemo(
    () =>
      player.isRealLegend
        ? []
        : (['style', 'level'] as const).map((mode) => ({ mode, comps: similarAmong(league, player, legends, COUNT, mode).filter((c) => c.similarity > 0) })),
    [league, legends, player],
  );
  if (!sets.some((s) => s.comps.length)) return null;
  return (
    <div className="mt-4 rounded-xl border border-line bg-panel/40 p-3 sm:p-4">
      <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-bold uppercase">
        <Flag className="h-4 w-4 text-red-300" aria-hidden="true" />
        Real-life comps
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Real NFL players whose career rates look most like his, measured on the league&rsquo;s own scale. Tap one for his card.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {sets.map((s) => (
          <section key={s.mode} aria-label={s.mode === 'style' ? 'Plays like, real NFL' : 'Closest overall, real NFL'}>
            <h4 className="mb-1.5 font-pixel text-[10px] uppercase text-gold">{s.mode === 'style' ? 'Plays like (style)' : 'Closest overall (level + style)'}</h4>
            {s.comps.length ? (
              <ol className="space-y-1.5">
                {s.comps.map((c) => (
                  <CompRow key={playerKey(c.player)} comp={c} ovr={ovrMap.get(playerKey(c.player))} onSelect={onSelect} />
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">No close match.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default DdRealComps;
