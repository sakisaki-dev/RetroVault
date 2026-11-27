import { useEffect } from 'react';
import { attachSwipe, attachTapSlide, ctxForNav, governing } from '@/utils/swipeSlide';

/*
 * Swipe between pills, everywhere (owner: "anything with a pill or submenus should allow me to swipe between, this includes
 * the stats page ... unless another interaction takes it over"), and now interactively (src/utils/swipeSlide.ts): the
 * content under the governing navigator follows the finger, the pill's thumb leans toward the next option, and a release
 * past a quarter of the width (or a flick) slides the next option's content in from that side; otherwise it springs back.
 * The governing navigator is the nearest one above the finger inside the innermost section that has one (a card's own
 * toggle for that card, the page's tabs elsewhere), never across a dialog's edge. Pages that wire useSwipeTabs
 * themselves claim their touches and are skipped. Taps on a pill slide the new content in from its side too.
 * Left alone: anything that drags or scrolls sideways itself, the system Back edge, and long pickers (more than 7 options).
 * A navigator marked [data-swipe-nav] (the Stats hub's bar) can be swiped on itself.
 */
const IGNORE = 'input, textarea, select, canvas, [role="slider"], [data-no-swipe], [data-no-swipe-x], .rf-banner, [class*="rafters"], [class*="binder"], [class*="carousel"], [class*="ticker"], [class*="marquee"], [class*="tape"], .cs-select__menu';
const NAV_ONLY = '.cs-toggle:not(.cs-toggle--wrap), [role="tablist"]';

const SwipeNav = () => {
  useEffect(() => {
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    const off = attachSwipe(document, {
      ignore: `${IGNORE}, ${NAV_ONLY}`,
      resolve: (t) => {
        const nav = t.closest('[data-swipe-nav]') ?? governing(t);
        return nav ? ctxForNav(nav) : null;
      },
    });
    const offTap = touch ? attachTapSlide() : () => {};
    return () => {
      off();
      offTap();
    };
  }, []);
  return null;
};

export default SwipeNav;
