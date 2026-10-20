import { ChevronLeft, ChevronRight, IdCard, Shuffle } from 'lucide-react';
import type { Player } from '@/types/player';
import { getLegacyTier, isHallOfFamer } from '@/config/stats';
import { SIM_MIN_GAMES } from '@/config/advanced';
import { findNFLTeam } from '@/utils/nflTeams';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { useJerseyNumbers } from '@/utils/jerseys';
import { normalizeName, signatureTeamOf, usePlayerExtras } from '@/utils/playerExtras';
import PlayerSearchSelect from '../../PlayerSearchSelect';
import ProPlayerBanner from '../../brand/ProPlayerBanner';
import TeamLogo from '../../brand/TeamLogo';
import { keyOf } from '../records';
import { SmallSampleChip } from './ddParts';

const ctl =
  'inline-flex h-12 items-center justify-center gap-1.5 rounded-md border border-line bg-night/60 px-3 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-panel-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-40';

interface Props {
  player: Player;
  options: Player[];
  ovr: number | undefined;
  wide: boolean;
  onChoose: (key: string) => void;
  onRandom: () => void;
  prev: Player | null;
  next: Player | null;
  onOpenCard: () => void;
}

/** Search + navigation bar and the full-width team-themed banner. */
const DdHero = ({ player, options, ovr, wide, onChoose, onRandom, prev, next, onOpenCard }: Props) => {
  const { numberFor, retiredInfo } = useJerseyNumbers();
  const extras = usePlayerExtras();
  // The banner wears his signature team (where he was best known); the franchise chips list them all
  const team = findNFLTeam(signatureTeamOf(extras, player));
  const tier = getLegacyTier(player.careerLegacy);
  const known = extras.franchises[normalizeName(player.name)] ?? [];
  const franchises = known.length ? known : player.team ? [player.team] : [];
  const retired = retiredInfo(player);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 [&_[role=combobox]]:h-12 [&_[role=combobox]]:text-base">
          <PlayerSearchSelect showOvr players={options} value={keyOf(player)} onValueChange={(v) => v && onChoose(v)} placeholder="Search any league player..." ariaLabel="Deep Dive player" />
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:flex">
          <button type="button" onClick={onRandom} className={ctl}>
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            Random
          </button>
          <button
            type="button"
            onClick={() => prev && onChoose(keyOf(prev))}
            disabled={!prev}
            className={ctl}
            aria-label={prev ? `Previous ${player.position} by OVR: ${prev.name}` : 'No previous player'}
            title={prev ? `Prev ${player.position}: ${prev.name}` : undefined}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Prev</span>
          </button>
          <button
            type="button"
            onClick={() => next && onChoose(keyOf(next))}
            disabled={!next}
            className={ctl}
            aria-label={next ? `Next ${player.position} by OVR: ${next.name}` : 'No next player'}
            title={next ? `Next ${player.position}: ${next.name}` : undefined}
          >
            <span className="hidden md:inline">Next</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenCard}
        aria-label={`Open ${player.name}'s player card`}
        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ProPlayerBanner
          size={wide ? 'hero' : 'card'}
          name={player.name}
          nickname={player.nickname}
          position={player.position}
          team={team ?? player.team}
          number={numberFor(player)}
          ovr={ovr ?? null}
          hallOfFamer={isHallOfFamer(player)}
          retiredBy={retired?.teamLabel ?? null}
          eyebrow={`${POSITION_NAMES[player.position]} · Scouting report`}
          nameAs="h1"
          interactive
        />
      </button>

      <div className="flex flex-wrap items-center gap-1.5">
        {tier ? (
          <span className="lamp">
            HOF <b>{tier.label}</b>
          </span>
        ) : null}
        <span className="lamp">
          GP <b>{player.games}</b>
        </span>
        {player.games < SIM_MIN_GAMES && <SmallSampleChip />}
        {franchises.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Franchise history">
            {franchises.map((f, i) => (
              <li key={`${f}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-xs">
                <TeamLogo team={f} size={16} decorative />
                <span>{findNFLTeam(f)?.name ?? f}</span>
              </li>
            ))}
          </ul>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
          Tap the banner for the full player card
        </span>
      </div>
    </div>
  );
};

export default DdHero;
