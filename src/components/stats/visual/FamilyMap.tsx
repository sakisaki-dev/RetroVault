import { useEffect, useMemo, useState } from 'react';
import type { Player, Position } from '@/types/player';
import { SIM_MIN_GAMES } from '@/config/advanced';
import { familiesFor } from '@/config/families';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import CompMap from '../comps/CompMap';
import { buildShapeMap } from './shapeMap';
import { openInCompFinder } from '../comps/compFinderLink';

const useWide = () => {
  const q = '(min-width: 768px)';
  const [on, setOn] = useState(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return on;
};

/**
 * The whole-position similarity map ("Plays like" distance) with its family zones: one position at a time, so
 * zones never mix positions. Clicking a dot or a member opens his Deep Dive.
 */
const FamilyMap = ({ players, position }: { players: Player[]; position: Position }) => {
  const ovrMap = useOfficialOvr();
  const wide = useWide();
  const fams = useMemo(() => familiesFor(players, position), [players, position]);
  const map = useMemo(() => (fams ? buildShapeMap(fams) : null), [fams]);
  if (!fams || !map) {
    return (
      <div className="space-y-2 rounded-md border border-line/60 p-4 text-sm text-muted-foreground">
        <p>
          {fams && !fams.shaped
            ? `${position}s have a single style rate (blocks per game), so they have no play-style shape: one family, no zones.`
            : `Too few ${position}s with enough games to form families.`}
        </p>
        {fams && (
          <ol className="flex flex-wrap gap-1.5">
            {fams.families[0].members.map((p) => (
              <li key={p.name}>
                <button type="button" className="rounded-full border border-line/70 px-2 py-0.5 text-xs font-semibold text-foreground hover:border-gold/60 hover:text-gold" onClick={() => openInCompFinder(p)}>
                  {p.name} <span className="font-mono text-[10px] text-muted-foreground">{Math.round(p.careerLegacy).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <CompMap map={map} ovrMap={ovrMap} selectedKey="" topComps={[]} overlayKey="" onPick={(p) => openInCompFinder(p)} wide={wide} nnLabel="Closest shape" />
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold hover:text-foreground">How the zones work</summary>
        <p className="mt-1.5">
          Dots are placed by play-style shape: each {position}'s style percentiles with his overall level taken out, so an elite and an average deep threat sit together and
          closer = leans on the same things. Families are k-means clusters of those shapes (k from 3 to 5 for big positions, picked by silhouette), fitted on players with{' '}
          {SIM_MIN_GAMES}+ games; smaller samples join the nearest family. Names come from a fixed label table for the position, matched to each family's average shape; a family
          with no clear lean is "Balanced". Grey links join each player to his closest shape. How good a family is shows separately (average percentile and Career Legacy).
        </p>
      </details>
    </div>
  );
};

export default FamilyMap;
