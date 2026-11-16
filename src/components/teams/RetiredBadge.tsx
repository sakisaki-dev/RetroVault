import { useMemo, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { getNFLTeamById } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { useRafters } from '@/utils/rafters';
import { openRafters } from '@/utils/raftersLink';
import type { RetiredNumber } from '@/utils/jerseys';
import './rafters.css';

/** At most this many clubs' banners hang on a card */
const MAX_CLUBS = 2;

const colours = (r: RetiredNumber): CSSProperties => {
  const t = getNFLTeamById(r.teamKey);
  const p = t?.primaryColor ?? '226 33% 30%';
  const fg = getReadableTextOn(p);
  return { '--raf-club': p, '--raf-fg': fg, '--raf-accent': fg === 'hsl(0 0% 100%)' ? '#ffd86b' : 'hsl(228 47% 12%)' } as CSSProperties;
};

/** The clubs that hang his number (his numbering club first), at most MAX_CLUBS */
const useRetiredClubs = (player: Pick<Player, 'name' | 'position' | 'isRealLegend'> | null | undefined) => {
  const { retiredForPlayer } = useRafters();
  return useMemo(() => (player && !player.isRealLegend ? retiredForPlayer(player).slice(0, MAX_CLUBS) : []), [player, retiredForPlayer]);
};

/** Close the card, then open the club's rafters (Hall of Fame tab, Rafters section) once the dialog has let go */
const go = (r: RetiredNumber, onLeave?: () => void) => {
  onLeave?.();
  window.setTimeout(() => openRafters(r.teamKey), 60);
};

/**
 * The player card hero's retired-number banners (CardBanner.dc.html): a small banner per club that retired his number
 * hanging from the top edge on a steel bar, RETIRED, the number and the club's abbreviation in its colours. Tap one
 * for that club's rafters. Never on Collection card faces (cards are timeless).
 */
export const RetiredHangers = ({ player, onLeave, className }: { player: Player | null | undefined; onLeave?: () => void; className?: string }) => {
  const clubs = useRetiredClubs(player);
  if (!clubs.length) return null;
  return (
    <div className={cn('raf-hangers', className)}>
      {clubs.map((r) => {
        const t = getNFLTeamById(r.teamKey);
        return (
          <button
            key={r.teamKey}
            type="button"
            className="raf-hanger"
            style={colours(r)}
            onClick={() => go(r, onLeave)}
            aria-label={`Number ${r.number} retired by the ${r.teamLabel}: open their rafters`}
          >
            <span className="raf-hanger__bar" aria-hidden="true" />
            <span className="raf-hanger__wires" aria-hidden="true">
              <i />
              <i />
            </span>
            <span className="raf-hanger__cloth" aria-hidden="true">
              <span className="raf-hanger__k">Retired</span>
              <span className="raf-hanger__n">{r.number}</span>
              <span className="raf-hanger__k">{t?.abbreviation ?? r.teamLabel.slice(0, 3).toUpperCase()}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * The identity area's retired-number strip: "#4 retired by the Vikings", the other numbers in those rafters and the
 * Ring of Honor, in the club's colours. Tap it for that club's rafters.
 */
export const RetiredStrip = ({ player, onLeave, className }: { player: Player | null | undefined; onLeave?: () => void; className?: string }) => {
  const clubs = useRetiredClubs(player);
  const { bannersFor, ringFor } = useRafters();
  if (!clubs.length || !player) return null;
  return (
    <div className={cn('raf-strips', className)}>
      {clubs.map((r) => {
        const t = getNFLTeamById(r.teamKey);
        const others = bannersFor(r.teamKey).filter((b) => b.r.playerKey !== r.playerKey);
        const inRing = ringFor(t).some((e) => `${e.pos}:${e.name}` === `${player.position}:${player.name}`);
        const named = others.slice(0, 2).map((b) => `#${b.r.number} ${b.last}`);
        const more = others.length - named.length;
        const sub = [
          named.length ? `Hangs in their rafters with ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}` : 'The only number in their rafters',
          inRing ? 'Ring of Honor' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <button key={r.teamKey} type="button" className="raf-strip" style={colours(r)} onClick={() => go(r, onLeave)}>
            <span className="raf-strip__flag" aria-hidden="true">
              {r.number}
            </span>
            <span className="raf-strip__text">
              <span className="raf-strip__title">
                #{r.number} retired by the {t?.name ?? r.teamLabel}
              </span>
              <span className="raf-strip__sub">{sub}</span>
            </span>
            <ChevronRight className="raf-strip__go h-5 w-5" aria-hidden="true" />
            <span className="sr-only">: open their rafters</span>
          </button>
        );
      })}
    </div>
  );
};
