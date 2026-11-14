import { useCallback, useRef } from 'react';

/*
 * data-vis="on" while an element is on screen (or within 80 px of it), from one shared IntersectionObserver. CSS runs
 * idle loops (sheens, glows) only under [data-vis], so the ones scrolled out of view stop ticking: an off-screen loop
 * cannot run on the compositor, and on the main thread it updated the page every frame.
 */
let io: IntersectionObserver | null = null;
const shared = () =>
  (io ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const t = e.target as HTMLElement;
        if (e.isIntersecting) t.dataset.vis = 'on';
        else delete t.dataset.vis;
      }),
    { rootMargin: '80px' },
  ));

/** A callback ref that keeps data-vis on the element while it is on screen (pass active = false to skip). */
export const useOnScreenFlag = <T extends HTMLElement>(active = true) => {
  const prev = useRef<T | null>(null);
  return useCallback(
    (el: T | null) => {
      if (prev.current && prev.current !== el && typeof IntersectionObserver !== 'undefined') {
        shared().unobserve(prev.current);
        delete prev.current.dataset.vis;
      }
      prev.current = el;
      if (!el || !active || typeof IntersectionObserver === 'undefined') return;
      shared().observe(el);
    },
    [active],
  );
};

