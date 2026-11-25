import { useCallback, useRef, useState } from 'react';

/**
 * The mark a sprite box shows while its sprite is on its way (GameSprite, CoachSprite): a faint pixel figure (or bust)
 * in the sprite's own box, so nothing shifts when the sprite lands. It stays invisible for its first 120 ms (CSS delay,
 * no timer), so a sprite that is cached or quick never flashes it; reduced motion and lite mode hold it still
 * (`.sprite-ph` in src/index.css).
 */
export const SpritePlaceholder = ({ bust = false }: { bust?: boolean }) => (
  <svg
    aria-hidden="true"
    className="sprite-ph pointer-events-none absolute inset-0 h-full w-full"
    viewBox={bust ? '16 6 32 36' : '0 0 64 64'}
    preserveAspectRatio="none"
    shapeRendering="crispEdges"
  >
    {/* head, shoulders and torso, two legs: the sprite's own proportions on the 64-unit frame, feet on row 58 */}
    <rect x="27" y="10" width="10" height="11" />
    <rect x="22" y="22" width="20" height="3" />
    <rect x="24" y="25" width="16" height="18" />
    <rect x="24" y="43" width="7" height="15" />
    <rect x="33" y="43" width="7" height="15" />
  </svg>
);

let observer: IntersectionObserver | null = null;
const watchers = new Map<Element, () => void>();
const sharedObserver = (): IntersectionObserver | null => {
  if (observer || typeof IntersectionObserver === 'undefined') return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const fn = watchers.get(e.target);
        if (fn) {
          watchers.delete(e.target);
          observer?.unobserve(e.target);
          fn();
        }
      }
    },
    { rootMargin: '400px 300px' },
  );
  return observer;
};

/**
 * A callback ref and whether the element has come within about 400 px of the screen (and stays true after). A sprite
 * asks for its files only then, so a page of hundreds (Stats, a roster, a long search) loads what is in view first.
 * Without IntersectionObserver it is true at once.
 */
export const useNearViewport = (): [(el: Element | null) => void, boolean] => {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  const cur = useRef<Element | null>(null);
  const ref = useCallback((el: Element | null) => {
    if (cur.current && cur.current !== el) {
      watchers.delete(cur.current);
      observer?.unobserve(cur.current);
    }
    cur.current = el;
    if (!el) return;
    const io = sharedObserver();
    if (!io) return;
    watchers.set(el, () => setNear(true));
    io.observe(el);
  }, []);
  return [ref, near];
};

export default SpritePlaceholder;
