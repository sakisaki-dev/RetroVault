import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { NFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { POSITION_NAMES } from '@/utils/playerMeta';
import type { Position } from '@/types/player';
import type { RafterBanner } from '@/utils/rafters';
import type { RingOfHonorEntry } from '@/utils/hallOfFame';
import { peekKeyProps } from '@/components/peek/peekProps';
import './rafters.css';

interface Props {
  team: NFLTeam | null;
  banners: RafterBanner[];
  /** The club's Ring of Honor (a band over the crowd); left out, no band */
  ring?: RingOfHonorEntry[];
  /** Tap a banner: his player card (holding it opens the quick look) */
  onOpen?: (b: RafterBanner) => void;
  /** Tap a Ring of Honor name */
  onRing?: (e: RingOfHonorEntry) => void;
  /** The kicker line (default "<Full name> · Retired numbers"); it is the section's heading */
  title?: string;
  headingId?: string;
  /** Shorter: no crowd and no note (a Hall of Fame plaque's rafters) */
  compact?: boolean;
  className?: string;
}

/** Small stable spread from a number: banners hang a little unevenly, always the same way */
const spread = (n: number, i: number) => {
  const h = (n * 37 + i * 11) % 7;
  return { wire: 20 + (h % 4) * 6, tilt: ((h % 5) - 2) * 0.55, dur: 5 + (h % 3), delay: -((n * 13) % 9) / 3 };
};

const ringsText = (n: number) => `${n} ring${n === 1 ? '' : 's'} here`;

/**
 * An arena ceiling for a club's retired numbers (Rafters.dc.html): a steel truss, spotlight cones, a banner per number in
 * the club's colours with a gold trim (HALL OF FAME, the number, the surname, position and years with the club, rings
 * won there), the Ring of Honor band over a crowd silhouette, and a note on how numbers go up. Banners sway a little
 * only when motion is allowed. An empty club shows the bare truss and the note.
 */
const RaftersScene = ({ team, banners, ring, onOpen, onRing, title, headingId = 'retired-numbers', compact = false, className }: Props) => {
  const primary = team?.primaryColor ?? '226 33% 30%';
  const fg = getReadableTextOn(primary);
  const light = fg !== 'hsl(0 0% 100%)';
  const vars = {
    '--raf-club': primary,
    '--raf-fg': fg,
    '--raf-accent': light ? 'hsl(228 47% 12%)' : '#ffd86b',
    '--raf-sub': light ? 'hsl(228 47% 12% / 0.8)' : 'rgb(255 255 255 / 0.82)',
  } as CSSProperties;
  const kicker = title ?? `${team?.fullName ?? 'Retired numbers'} · Retired numbers`;
  return (
    <section aria-labelledby={headingId} className={cn('rafters', compact && 'rafters--compact', !banners.length && 'rafters--empty', className)} style={vars}>
      <h3 id={headingId} className="rafters__kicker">
        {kicker}
        <span className="sr-only">: {banners.length ? `${banners.length} number${banners.length === 1 ? '' : 's'}` : 'none yet'}</span>
      </h3>
      <span className="rafters__beam" aria-hidden="true" />
      <span className="rafters__truss" aria-hidden="true" />
      <span className="rafters__rail" aria-hidden="true" />

      {banners.length > 0 ? (
        <ul className="rafters__row" data-no-swipe-x>
          {banners.map((b, i) => {
            const s = spread(b.r.number, i);
            const pos = b.r.position ? POSITION_NAMES[b.r.position as Position] ?? b.r.position : undefined;
            const label = `Number ${b.r.number}, ${b.r.name}${pos ? `, ${pos}` : ''}${b.years ? `, ${b.years}` : ''}${b.rings ? `, ${ringsText(b.rings)}` : ''}${b.hof ? ', Hall of Famer' : ''}`;
            const cloth = (
              <span className="rafter__cloth" aria-hidden="true">
                <span className="rafter__kick">{b.hof ? 'Hall of Fame' : 'Retired'}</span>
                <span className="rafter__num">{b.r.number}</span>
                <span className="rafter__name">{b.last}</span>
                <span className="rafter__line">
                  {b.r.position}
                  {b.r.position && b.years ? ' · ' : ''}
                  {b.years}
                </span>
                {b.rings > 0 && <span className="rafter__rings">{ringsText(b.rings)}</span>}
              </span>
            );
            return (
              <li key={`${b.r.number}-${b.r.name}`} className="rafter" style={{ '--wire': `${s.wire}px`, '--tilt': `${s.tilt}deg`, '--dur': `${s.dur}s`, '--delay': `${s.delay}s` } as CSSProperties}>
                <span className="rafter__cone" aria-hidden="true" />
                <span className="rafter__wire rafter__wire--l" aria-hidden="true" />
                <span className="rafter__wire rafter__wire--r" aria-hidden="true" />
                <span className="rafter__sway">
                  {onOpen && b.r.playerKey ? (
                    <button type="button" className="rafter__hit" {...peekKeyProps(b.r.playerKey)} onClick={() => onOpen(b)} aria-label={`${label}. Open player`}>
                      {cloth}
                    </button>
                  ) : (
                    <span className="rafter__hit" role="img" aria-label={label} {...peekKeyProps(b.r.playerKey)}>
                      {cloth}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rafters__bare" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="rafters__hook" />
          ))}
        </div>
      )}

      {ring && ring.length > 0 && (
        <div className="rafters__ring">
          <span className="rafters__ring-k">Ring of Honor</span>
          <ul className="rafters__ring-list" aria-label={`${team?.name ?? 'Club'} Ring of Honor`} data-no-swipe-x>
            {ring.map((e, i) => (
              <li key={`${e.pos}:${e.name}`}>
                {i > 0 && (
                  <span className="rafters__dot" aria-hidden="true">
                    ·
                  </span>
                )}
                {onRing ? (
                  <button type="button" onClick={() => onRing(e)} {...peekKeyProps(`${e.pos}:${e.name}`)} className={cn(e.hof && 'is-hof')}>
                    {e.name}
                  </button>
                ) : (
                  <span className={cn(e.hof && 'is-hof')}>{e.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && <span className="rafters__crowd" aria-hidden="true" />}

      {!compact && (
        <div className="rafters__note">
          <p className="rafters__note-k">{banners.length ? 'How a number goes up' : 'No numbers in the rafters yet'}</p>
          <p>
            {banners.length
              ? "Every Hall of Famer's number is retired by the club he is best known for, and hangs here on its own. Tap a banner for his card; hold it for a quick look. A new Hall of Fame class raises its banners at the next update."
              : `When a Hall of Famer best known with the ${team?.name ?? 'club'} is voted in, his number is retired and his banner goes up here, with his years and the rings he won here.`}
          </p>
        </div>
      )}
    </section>
  );
};

export default RaftersScene;
