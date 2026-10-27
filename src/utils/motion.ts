import { useEffect, useState } from 'react';
import { isLite } from '@/hooks/usePerfMode';

/*
 * Shared motion system. The CSS custom properties in src/index.css (--dur-*, --ease-*, --stagger, --rise) are the
 * source of truth for stylesheets; this file mirrors them for JS-driven motion (Web Animations, swipe springs) and
 * owns the global press feedback.
 *
 *   dur.fast 120 ms   presses, small fades, exits of small things
 *   dur.base 200 ms   popovers, colour/indicator changes, dialog exits
 *   dur.slow 280 ms   view changes (tab / sub-tab), list items, dialog entrances on desktop
 *   dur.xslow 360 ms  sheets and phone dialogs sliding up
 *
 * Performance mode (data-perf="lite") and prefers-reduced-motion collapse everything to short fades: no slides, no
 * staggers, no press scaling (src/index.css redefines the tokens; `reducedMotion()` tells JS).
 */
export const dur = { fast: 120, base: 200, slow: 280, xslow: 360 } as const;

export const ease = {
  /** Standard deceleration: most entrances and state changes */
  out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  /** Emphasised, spring-like (a hint of overshoot): sheets, dialogs, the active-tab indicator */
  spring: 'cubic-bezier(0.32, 1.25, 0.5, 1)',
  /** Exits: accelerate away */
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/** Per-item delay for staggered lists, and how many items get one (the rest arrive with the last) */
export const STAGGER_MS = 35;
export const STAGGER_CAP = 12;

export const reducedMotion = (): boolean => {
  if (isLite()) return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Staggered first appearance for a list or grid: put the returned class on the container. Its first items fade up
 * one after another when it mounts; once that is over the class settles, so items added later (a filter, "Show
 * more") just fade in, with no slide and no delay. Changing the class never restarts finished animations (the
 * animation name stays the same; only its delay, duration and the rise distance change).
 */
export const useStagger = (ready = true): string => {
  const [settled, setSettled] = useState(false);
  // `ready`: the list has actually mounted (data loaded); the first-appearance window starts then
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setSettled(true), STAGGER_CAP * STAGGER_MS + dur.slow + 60);
    return () => window.clearTimeout(t);
  }, [ready]);
  return settled ? 'rv-stagger is-settled' : 'rv-stagger';
};

/*
 * Press feedback. CSS (`[data-pressed]` in index.css) gives an instant scale 0.97 + brightness on touch-down; on
 * release the element eases back with a Web Animation, so the press never fights an element's own transition-property
 * (transition-colors and friends stay as they are). Anything clickable counts: buttons, links, role=button/tab/option,
 * summaries and labels that wrap an input. Skipped: disabled controls, big surfaces (over 45% of the viewport, e.g. a
 * full-screen card), drag handles and [data-no-press]. A finger that starts scrolling releases the press.
 */
const PRESSABLE_BASE = 'button, a[href], [role="button"], [role="tab"], [role="option"], [role="menuitem"], summary, .rv-press';
const hasSupported = () => {
  try {
    return CSS.supports('selector(label:has(> input))');
  } catch {
    return false;
  }
};
const SKIP = '[data-no-press], [data-swipe-handle], input, textarea, select, [contenteditable="true"]';

let installed = false;
export const installPressFeedback = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const PRESSABLE = hasSupported() ? `${PRESSABLE_BASE}, label:has(> input)` : PRESSABLE_BASE;
  let el: HTMLElement | null = null;
  let x = 0;
  let y = 0;

  const release = (animate: boolean) => {
    const n = el;
    el = null;
    if (!n) return;
    delete n.dataset.pressed;
    if (!animate || reducedMotion() || typeof n.animate !== 'function') return;
    // From the pressed look back to rest (the base style), smoothly
    const filter = n.classList.contains('fut__card') ? [] : [{ filter: 'brightness(1.12)' }, { filter: 'none' }];
    n.animate(
      filter.length
        ? [
            { scale: '0.97', ...filter[0] },
            { scale: '1', ...filter[1] },
          ]
        : [{ scale: '0.97' }, { scale: '1' }],
      { duration: dur.base + 40, easing: ease.out },
    );
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t || t.closest(SKIP)) return;
    const n = t.closest<HTMLElement>(PRESSABLE);
    if (!n || n.matches(':disabled, [aria-disabled="true"]')) return;
    const r = n.getBoundingClientRect();
    if (r.width * r.height > window.innerWidth * window.innerHeight * 0.45) return;
    release(false);
    el = n;
    x = e.clientX;
    y = e.clientY;
    n.dataset.pressed = '';
  };
  const onMove = (e: PointerEvent) => {
    if (el && Math.hypot(e.clientX - x, e.clientY - y) > 10) release(true);
  };

  window.addEventListener('pointerdown', onDown, { passive: true, capture: true });
  window.addEventListener('pointermove', onMove, { passive: true, capture: true });
  window.addEventListener('pointerup', () => release(true), { passive: true, capture: true });
  window.addEventListener('pointercancel', () => release(true), { passive: true, capture: true });
  window.addEventListener('blur', () => release(false));
  // iOS only applies :active (and fires pointer events promptly) when a touch listener exists
  document.addEventListener('touchstart', () => undefined, { passive: true });
};
