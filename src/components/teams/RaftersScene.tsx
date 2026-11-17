import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
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
  return { wire: 40 + (h % 4) * 8, tilt: ((h % 5) - 2) * 0.55, dur: 5 + (h % 3), delay: -((n * 13) % 9) / 3 };
};

const ringsText = (n: number) => `${n} ring${n === 1 ? '' : 's'} here`;

const reduceMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Pendulum: radians, a natural swing of about a second, gentle air damping, a hard stop at MAX */
const K = 18; // stiffness (g / L)
const DAMP = 0.9;
const MAX = (55 * Math.PI) / 180;
const DRAG_PX = 6; // a press that moves less is a tap (opens his card)

/**
 * A banner on its wires that swings (owner, 2026-11-17: "make the rafters swing, I can drag them"; then "it feels like it
 * isn't hanging its just a rotating asset"): a swing seat, not a stick. Each wire turns about its own hook on the rail
 * (the hooks never move) and the banner rides the arc their ends draw, staying level (it trails a touch while moving), so
 * it rises a little at the ends of its swing. Grab it and pull it sideways, let go and it swings until it settles. Only
 * `rotate` / `translate` are written (the idle sway keeps its own transform), one rAF loop per moving banner. A tap still
 * opens his card and a hold the quick look (a drag past a few pixels swallows the click). Reduced motion: it follows the
 * finger and eases straight back, no swing.
 */
const Pendulum = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let a = 0; // angle, rad (positive: swung right)
    let v = 0; // rad/s
    let raf = 0;
    let id = -1;
    let px = 0; // pointer x of the banner at rest (set at the grab)
    let sx = 0;
    let sy = 0;
    let dragging = false;
    let samples: { t: number; a: number }[] = [];
    const wires = [...el.querySelectorAll<HTMLElement>('.rafter__wire')];
    const cloth = el.querySelector<HTMLElement>('.rafter__sway');
    // the wire's length is the pendulum's: the banner hangs from the wires' lower ends
    const len = () => wires[0]?.offsetHeight || 40;
    const set = () => {
      const L = len();
      const on = Math.abs(a) > 1e-5;
      wires.forEach((w) => (w.style.rotate = on ? `${a.toFixed(4)}rad` : ''));
      if (cloth) {
        // clockwise turn (a > 0) swings the lower ends left: x = -L sin a, and they rise by L (1 - cos a)
        cloth.style.translate = on ? `${(-L * Math.sin(a)).toFixed(2)}px ${(-L * (1 - Math.cos(a))).toFixed(2)}px` : '';
        // level at rest or held still; while it moves the cloth trails a touch behind the wires (air drag)
        const lag = Math.max(-0.12, Math.min(0.12, v * 0.04));
        cloth.style.rotate = on && Math.abs(lag) > 1e-4 ? `${lag.toFixed(4)}rad` : '';
      }
    };
    // drag: the banner's sideways offset from its rest, turned into the wires' angle
    const angleFor = (x: number) => {
      const L = len();
      const off = Math.max(-L * Math.sin(MAX), Math.min(L * Math.sin(MAX), x - px));
      return -Math.asin(off / L);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const run = () => {
      stop();
      let prev = performance.now();
      const still = reduceMotion();
      const step = (now: number) => {
        const dt = Math.min(0.032, (now - prev) / 1000);
        prev = now;
        if (still) {
          a += (0 - a) * Math.min(1, dt * 12);
          v = 0;
        } else {
          v += (-K * Math.sin(a) - DAMP * v) * dt;
          a += v * dt;
          if (Math.abs(a) > MAX) {
            a = Math.sign(a) * MAX;
            v *= -0.4;
          }
        }
        set();
        if (Math.abs(a) < 0.0008 && Math.abs(v) < 0.004) {
          a = 0;
          v = 0;
          set();
          el.classList.remove('is-swinging');
          raf = 0;
          return;
        }
        raf = requestAnimationFrame(step);
      };
      el.classList.add('is-swinging');
      raf = requestAnimationFrame(step);
    };
    const onDown = (e: PointerEvent) => {
      if (id !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      dragging = false;

    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      if (!dragging) {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < DRAG_PX) return;
        dragging = true;
        stop();
        // keep the banner under the finger where it was grabbed: its rest is the pointer minus its current offset
        px = e.clientX + len() * Math.sin(a);
        samples = [];
        el.classList.add('is-swinging', 'is-held');
        try {
          el.setPointerCapture(id);
        } catch {
          /* already released */
        }
      }
      e.preventDefault();
      a = angleFor(e.clientX);
      samples.push({ t: e.timeStamp, a });
      if (samples.length > 6) samples.shift();
      set();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      el.classList.remove('is-held');
      if (!dragging) return;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = first && last ? (last.t - first.t) / 1000 : 0;
      v = dt > 0 ? Math.max(-8, Math.min(8, (last.a - first.a) / dt)) : 0;
      run();
    };
    // a drag is not a tap: swallow the click that follows it (the banner's button opens his card)
    const onClick = (e: MouseEvent) => {
      if (dragging) {
        e.preventDefault();
        e.stopPropagation();
        dragging = false;
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClick, true);
    return () => {
      stop();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, []);
  return (
    <span ref={ref} className="rafter__pend" style={style}>
      {children}
    </span>
  );
};

/**
 * An arena ceiling for a club's retired numbers (Rafters.dc.html): a steel truss, spotlight cones, a banner per number in
 * the club's colours with a gold trim (HALL OF FAME, the number, the surname, position and years with the club, rings
 * won there), the Ring of Honor band over a crowd silhouette, and a note on how numbers go up. Banners sway a little
 * only when motion is allowed, and swing when dragged (Pendulum). An empty club shows the bare truss and the note.
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
                <Pendulum>
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
                </Pendulum>
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
