import { useMemo } from 'react';
import { Crown, ScanSearch, Shuffle, Sprout } from 'lucide-react';
import type { Player } from '@/types/player';
import { isHallOfFamer } from '@/config/stats';
import PlayerSearchSelect from '../../PlayerSearchSelect';
import TeamLogo from '../../brand/TeamLogo';
import { keyOf } from '../records';

const chip =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-sm font-semibold transition-colors hover:border-gold/60 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

const PickChip = ({ p, onChoose }: { p: Player; onChoose: (key: string) => void }) => (
  <li>
    <button type="button" className={chip} onClick={() => onChoose(keyOf(p))}>
      {p.team && <TeamLogo team={p.team} size={18} decorative />}
      {p.name}
      <span className="font-pixel text-[8px] text-muted-foreground">{p.position}</span>
    </button>
  </li>
);

/** No player in the link: a big centred search plus optional quick picks (nothing loads until one is chosen). */
const DdEmpty = ({ options, onChoose, onRandom }: { options: Player[]; onChoose: (key: string) => void; onRandom: () => void }) => {
  const hofers = useMemo(() => options.filter(isHallOfFamer).slice(0, 3), [options]);
  const newest = useMemo(
    () =>
      options
        .filter((p) => p.status === 'Active' && p.games > 0)
        .sort((a, b) => a.games - b.games || b.careerLegacy - a.careerLegacy)
        .slice(0, 3),
    [options],
  );
  return (
    <div className="glass-card dd-enter mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-10 text-center sm:px-10 sm:py-14">
      <ScanSearch className="h-12 w-12 text-gold" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-pixel text-[10px] uppercase text-gold">Deep Dive</p>
        <h2 className="font-display text-3xl font-extrabold italic uppercase leading-none sm:text-4xl">Pick a player to scout</h2>
        <p className="text-sm text-muted-foreground">Skill grades, style hexagon, advanced profile, his neighbourhood, comps, career and records, all on one page.</p>
      </div>
      <div className="w-full max-w-xl [&_[role=combobox]]:h-14 [&_[role=combobox]]:text-base">
        <PlayerSearchSelect showOvr players={options} value="" onValueChange={(v) => v && onChoose(v)} placeholder="Search any league player..." ariaLabel="Deep Dive player" />
      </div>
      <div className="w-full space-y-3">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Or try</p>
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Quick picks">
          <li>
            <button type="button" className={chip} onClick={onRandom}>
              <Shuffle className="h-4 w-4 text-gold" aria-hidden="true" />
              Random player
            </button>
          </li>
        </ul>
        {hofers.length > 0 && (
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Crown className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Top Hall of Famers
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {hofers.map((p) => (
                <PickChip key={keyOf(p)} p={p} onChoose={onChoose} />
              ))}
            </ul>
          </div>
        )}
        {newest.length > 0 && (
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sprout className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Newest faces
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {newest.map((p) => (
                <PickChip key={keyOf(p)} p={p} onChoose={onChoose} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default DdEmpty;
