import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import type { Player } from '@/types/player';
import {
  SIMILARITY_DEFINITIONS,
  SIMILARITY_LABELS,
  compFeatureLabels,
  evaluatePosition,
  hasSimilarityData,
  metricsFor,
  similarPlayers,
  type AdvContext,
} from '@/config/advanced';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import PlayerSearchSelect from '../../PlayerSearchSelect';
import PositionBadge from '../../PositionBadge';
import TeamBadge from '../../brand/TeamBadge';
import TeamLogo from '../../brand/TeamLogo';
import MetricLabel from './MetricLabel';
import PercentileBar from './PercentileBar';
import { fmtNum, fmtPlus, ordinal } from './viz';
import { keyOf } from '../records';

interface Props {
  players: Player[];
  ctx: AdvContext;
  onSelect: (p: Player) => void;
}

/** Percentile profile of one player against his position, plus his three most similar careers. */
const PlayerComps = ({ players, ctx, onSelect }: Props) => {
  const ovrMap = useOfficialOvr();
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.careerLegacy - a.careerLegacy), [players]);
  const [selKey, setSelKey] = useState('');
  const player = players.find((p) => keyOf(p) === selKey) ?? sortedPlayers[0];

  const profile = useMemo(() => {
    if (!player) return [];
    const boards = evaluatePosition(players, player.position, ctx);
    return metricsFor(player.position).map((m) => ({ metric: m, row: boards.get(m.id)?.rows.find((r) => r.player === player) }));
  }, [players, player, ctx]);
  const compSets = useMemo(
    () => (player ? (['style', 'level'] as const).map((mode) => ({ mode, comps: similarPlayers(players, player, 3, mode) })) : []),
    [players, player],
  );

  if (!player) return null;
  const ovr = ovrMap.get(keyOf(player));

  return (
    <section aria-labelledby="lab-comps-title" className="glass-card flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <div>
        <h3 id="lab-comps-title" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
          <Users className="h-4 w-4 text-gold" aria-hidden="true" />
          Player profile &amp; comps
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Percentile against every qualified player at the same position, and the players whose per-game and efficiency rates look most like his, regardless of career length.</p>
      </div>

      <PlayerSearchSelect players={sortedPlayers} value={keyOf(player)} onValueChange={(v) => v && setSelKey(v)} ariaLabel="Profile player" />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onSelect(player)} className="truncate font-display text-xl font-bold uppercase hover:text-gold">
          {player.name}
        </button>
        <PositionBadge position={player.position} />
        <TeamBadge team={player.team} size="sm" />
        {ovr != null && (
          <span className="lamp">
            OVR <b>{ovr}</b>
          </span>
        )}
        <span className="lamp">
          Games <b>{player.games}</b>
        </span>
      </div>

      <ul className="space-y-2" aria-label={`${player.name} percentiles among ${POSITION_NAMES[player.position].toLowerCase()}s`}>
        {profile.map(({ metric, row }) => (
          <li key={metric.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)_7.5rem]">
            <MetricLabel metric={metric} className="text-xs font-semibold text-secondary-foreground sm:text-sm" />
            {row ? (
              <>
                <span className="text-right font-mono text-xs tabular-nums text-chalk sm:order-last">
                  {fmtNum(row.value, metric.decimals)}
                  {metric.suffix ?? ''}
                  {row.plus != null && <span className="ml-1.5 text-muted-foreground">{fmtPlus(row.plus)}+</span>}
                </span>
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <PercentileBar pct={row.pct} label={`${metric.label} percentile`} className="h-2 flex-1 overflow-hidden rounded-sm" />
                  <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{ordinal(row.pct)}</span>
                </div>
              </>
            ) : (
              <span className="col-span-1 text-right text-xs text-muted-foreground sm:col-span-2">Below {metric.minLabel}</span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2 border-t border-line/70 pt-3">
        {compSets.map(({ mode, comps }) => (
          <div key={mode} className="space-y-2">
            <h4 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground" title={SIMILARITY_DEFINITIONS[mode]}>
              {SIMILARITY_LABELS[mode]}
            </h4>
            {comps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasSimilarityData(player) ? `Not enough ${player.position}s to compare.` : 'Insufficient data: too few of his rates are recorded to compare.'}
              </p>
            ) : (
              <ol className="grid gap-2 sm:grid-cols-3">
                {comps.map((c) => (
                  <li key={keyOf(c.player)}>
                    <button
                      type="button"
                      onClick={() => setSelKey(keyOf(c.player))}
                      aria-label={`${c.player.name}, ${mode === 'style' ? 'style match' : 'similarity'} ${Math.round(c.similarity)} of 100. Show his profile`}
                      className="hover-lift flex h-full w-full flex-col gap-1 rounded-lg border border-line bg-panel p-2.5 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {c.player.team && <TeamLogo team={c.player.team} size={18} decorative />}
                        <span className="truncate text-sm font-semibold">{c.player.name}</span>
                      </span>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-2xl font-extrabold leading-none text-chalk">{Math.round(c.similarity)}</span>
                        <span className="font-pixel text-[8px] uppercase text-muted-foreground">{mode === 'style' ? 'style match' : 'similarity'}</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.player.games} G · TPG {fmtNum(c.player.tpg, 2)}
                        {c.smallSample && <span className="ml-1 text-gold">· small sample</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          Both scores (0–100) use rates z-scored within the position: {compFeatureLabels(player.position).join(', ')}. Career length, totals and True Talent are left out. Plays like asks whether he is above or below the position average in the same places (what the hexagon shows); closest overall needs the numbers to match too (~60 = about one standard deviation apart on average).
        </p>
      </div>
    </section>
  );
};

export default PlayerComps;
