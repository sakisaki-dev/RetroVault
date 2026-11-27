import { useEffect, useRef, type RefObject } from 'react';
import { NAV, attachSwipe, contentAfter, optionsOf, type Dir, type SwipeCtx } from '@/utils/swipeSlide';

/*
 * Swipe between a page's pill tabs (touch, and a two-finger trackpad swipe on a desktop), interactively: a horizontal-dominant drag on the content under the
 * navigator makes that content follow the finger and, past a quarter of the width or a flick, slides the previous or
 * next value's content in (shared mechanism: src/utils/swipeSlide.ts, also used site-wide by SwipeNav). Vertical
 * scrolling is never blocked (the area gets `touch-action: pan-y`). A drag that starts inside something that scrolls or
 * drags sideways itself is left alone: [data-no-swipe], inputs, sliders, canvases, horizontally scrollable rows,
 * carousels, tickers, the rafters banners and the binder. The page's touches are claimed, so SwipeNav leaves them.
 */
const IGNORE = 'input, textarea, select, canvas, [role="slider"], [data-no-swipe], [data-no-swipe-x], .rf-banner, [class*="rafters"], [class*="binder"], [class*="carousel"], [class*="ticker"], [class*="marquee"], [role="tablist"], .cs-toggle, .cs-select__menu';

export function useSwipeTabs<T extends string | number>({
  ref,
  values,
  value,
  onChange,
  enabled = true,
}: {
  ref: RefObject<HTMLElement | null>;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  enabled?: boolean;
}) {
  const live = useRef({ values, value, onChange });
  live.current = { values, value, onChange };
  const el = ref.current; // read during render: a page that mounts its area late re-renders and re-attaches
  useEffect(() => {
    if (!el || !enabled) return;
    el.style.touchAction = 'pan-y';
    const findNav = () => [...el.querySelectorAll(NAV)].find((n) => optionsOf(n).length >= 2) ?? null;
    const ctx: SwipeCtx = {
      get nav() { return findNav(); },
      content: () => {
        const nav = findNav();
        const c = nav ? contentAfter(nav) : [];
        return c.length ? c : [el];
      },
      index: () => live.current.values.indexOf(live.current.value),
      has: (d: Dir) => {
        const { values: vs, value: v } = live.current;
        const i = vs.indexOf(v);
        return i >= 0 && vs[i + d] !== undefined;
      },
      go: (d: Dir) => {
        const { values: vs, value: v, onChange: go } = live.current;
        const next = vs[vs.indexOf(v) + d];
        if (next !== undefined) go(next);
      },
    };
    const off = attachSwipe(el, { ignore: IGNORE, within: el, claim: true, resolve: () => ctx });
    return () => {
      off();
      el.style.touchAction = '';
    };
  }, [el, enabled]);
}
