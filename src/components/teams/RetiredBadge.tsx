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
  // One strip (owner, 2026-11-17: "make the little banner thing a bit more concise", then the single-club strip to
  // match): the number once, a chip per club in its colours (logo, name, ★ for its Ring of Honor); a chip opens that
  // club's rafters
  {
    const n = clubs[0].number;
    const same = clubs.every((r) => r.number === n);
    return (
      <div className={cn('raf-multi', className)}>
        <span className="raf-multi__flag" aria-hidden="true">
          {n}
        </span>
        <div className="raf-multi__body">
          <p className="raf-multi__title">
            {clubs.length === 1 ? `#${n} retired` : same ? `#${n} retired by ${clubs.length} clubs` : `Retired by ${clubs.length} clubs`}
          </p>
          <ul className="raf-multi__clubs" aria-label={clubs.length === 1 ? 'Club that retired his number' : 'Clubs that retired his number'}>
            {clubs.map((r) => {
              const t = getNFLTeamById(r.teamKey);
              const inRing = ringFor(t).some((e) => `${e.pos}:${e.name}` === `${player.position}:${player.name}`);
              return (
                <li key={r.teamKey}>
                  <button
                    type="button"
                    className="raf-multi__club"
                    style={colours(r)}
                    onClick={() => go(r, onLeave)}
                    aria-label={`${same ? '' : `#${r.number} `}${t?.name ?? r.teamLabel}${inRing ? ', Ring of Honor' : ''}: open their rafters`}
                  >
                    {t && <TeamLogo team={t.name} size={18} decorative />}
                    <span>{t?.name ?? r.teamLabel}</span>
                    {!same && <span className="raf-multi__n">#{r.number}</span>}
                    {inRing && (
                      <span className="raf-multi__ring" title="Ring of Honor" aria-hidden="true">
                        ★
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
};
