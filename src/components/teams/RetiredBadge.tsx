import { useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { getNFLTeamById } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { useRafters } from '@/utils/rafters';
import { openRafters } from '@/utils/raftersLink';
import TeamLogo from '@/components/brand/TeamLogo';
import type { RetiredNumber } from '@/utils/jerseys';
import './rafters.css';

/** At most this many clubs' banners hang on a card (Sherman Brandson's three clubs all hang; the banners slim down) */
const MAX_CLUBS = 3;

const colours = (r: RetiredNumber): CSSProperties => {
  const t = getNFLTeamById(r.teamKey);
  const p = t?.primaryColor ?? '226 33% 30%';
  const fg = getReadableTextOn(p);
  return { '--raf-club': p, '--raf-fg': fg, '--raf-accent': fg === 'hsl(0 0% 100%)' ? '#ffd86b' : 'hsl(228 47% 12%)' } as CSSProperties;
};

/** The clubs that hang his number (his numbering club first, the rest alphabetically), at most MAX_CLUBS */
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
    <div className={cn('raf-hangers', clubs.length > 2 && 'raf-hangers--slim', className)}>
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
  const { ringFor } = useRafters();
  if (!clubs.length || !player) return null;
  // A strip of the rafters (owner, 2026-11-17: the chip strip "looks a bit boring for what it represents"): a steel truss,
  // the number in gold with the clubs named, and a banner per club hanging on its wires in the club's colours (gold
  // trim, the number, the club's abbreviation, a star for its Ring of Honor), swaying a little; a banner opens that
  // club's rafters
  const n = clubs[0].number;
  const same = clubs.every((r) => r.number === n);
  const names = clubs.map((r) => getNFLTeamById(r.teamKey)?.name ?? r.teamLabel);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return (
    <div className={cn('raf-cere', className)}>
      <span className="raf-cere__truss" aria-hidden="true" />
      <div className="raf-cere__text">
        <span className="raf-cere__kick">{clubs.length > 1 ? 'Retired by ' + clubs.length + ' clubs' : 'Number retired'}</span>
        <span className="raf-cere__num">#{same ? n : clubs.map((r) => r.number).join(' · #')}</span>
        <span className="raf-cere__sub">In the rafters of the {list}</span>
      </div>
      <ul className="raf-cere__banners" aria-label={clubs.length === 1 ? 'Club that retired his number' : 'Clubs that retired his number'}>
        {clubs.map((r, i) => {
          const t = getNFLTeamById(r.teamKey);
          const inRing = ringFor(t).some((e) => `${e.pos}:${e.name}` === `${player.position}:${player.name}`);
          return (
            <li key={r.teamKey} style={{ ['--d' as string]: `${-i * 0.9}s` }}>
              <button
                type="button"
                className="raf-cere__banner"
                style={colours(r)}
                onClick={() => go(r, onLeave)}
                aria-label={`#${r.number} retired by the ${t?.name ?? r.teamLabel}${inRing ? ', Ring of Honor' : ''}: open their rafters`}
              >
                <span className="raf-cere__wires" aria-hidden="true">
                  <i />
                  <i />
                </span>
                <span className="raf-cere__cloth" aria-hidden="true">
                  {t ? <TeamLogo team={t.name} size={18} decorative /> : null}
                  <span className="raf-cere__cloth-n">{r.number}</span>
                  <span className="raf-cere__cloth-k">{t?.abbreviation ?? r.teamLabel.slice(0, 3).toUpperCase()}</span>
                  {inRing && <span className="raf-cere__ring">★</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
