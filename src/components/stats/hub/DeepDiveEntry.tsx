import { useMemo } from 'react';
import { ArrowRight, Radar } from 'lucide-react';
import type { Player } from '@/types/player';
import PlayerSearchSelect from '../../PlayerSearchSelect';
import { openInCompFinder } from '../comps/compFinderLink';
import { keyOf } from '../records';
import { buildHash } from './hashRoute';

/**
 * Compact launcher that replaces the Analytics Lab's old "player profile & comps" panel: the full single-player
 * view lives in Stats › Deep Dive, and league-wide similarity lives on the Map.
 */
const DeepDiveEntry = ({ players }: { players: Player[] }) => {
  const sorted = useMemo(() => [...players].sort((a, b) => b.careerLegacy - a.careerLegacy), [players]);
  return (
    <section aria-labelledby="lab-deepdive-title" className="glass-card flex flex-col gap-3 p-4">
      <h3 id="lab-deepdive-title" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
        <Radar className="h-4 w-4 text-gold" aria-hidden="true" />
        Player profile &amp; comps
      </h3>
      <a
        href={buildHash({ tab: 'career', sub: 'deepdive' })}
        className="inline-flex items-center gap-1.5 self-start rounded-md border border-gold/50 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/20"
      >
        Moved to Deep Dive
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
      <p className="text-sm text-muted-foreground">
        The player search with his profile, percentiles and closest comps now lives in Stats › Deep Dive. Pick a player to jump straight there.
      </p>
      <PlayerSearchSelect showOvr
        players={sorted}
        value=""
        onValueChange={(key) => {
          const p = sorted.find((x) => keyOf(x) === key);
          if (p) openInCompFinder(p);
        }}
        placeholder="Open a player Deep Dive…"
        ariaLabel="Open a player Deep Dive"
      />
    </section>
  );
};

export default DeepDiveEntry;
