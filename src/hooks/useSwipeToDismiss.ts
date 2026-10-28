import { useCallback, useEffect, useRef, useState, type MutableRefObject, type Ref } from 'react';
import { isLite } from './usePerfMode';
import { dur, ease, isMobileMotion } from '@/utils/motion';

/*
 * Swipe down to dismiss (touch only), for dialogs and bottom sheets.
 *
 * A downward drag closes the element when it starts on a grab handle / header ([data-swipe-handle]) or when every
 * scroller between the finger and the element is already at its top. Otherwise the drag is ordinary scrolling.
 * Sideways drags (matrix and chip rows), range sliders and text fields are left alone. The element follows the finger
 * (the `translate` property, so it composes with any centring transform) and the backdrop fades with it; past a
 * distance or a flick it glides out at the finger's speed (at least 300 ms on phones), otherwise it glides back. In performance mode or with reduced motion nothing
 * moves, but a long enough drag still closes it.
 *
 * Nested roots (a sheet inside a dialog) each mark themselves data-swipe-root; a drag belongs to the innermost one.
 */

export interface SwipeOptions {
  onDismiss: () => void;
  enabled?: boolean;
  /** Element to fade with the drag (a backdrop) */
  backdrop?: () => HTMLElement | null;
  /**
   * Hand the release straight to onDismiss, leaving the element where the finger left it (the caller runs its own
   * exit from there) instead of sliding it the rest of the way out first
   */
  handoff?: boolean;
}

const CLOSE_FRACTION = 0.28; // of the element's visible height
const CLOSE_MAX = 160; // px: never require more than this
const FLICK = 0.55; // px per ms

const reducedMotion = () => {
  try {
    return isLite() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return isLite();
  }
};

/** Can this element scroll vertically (and is it scrolled down from the top)? */
const scrolledDown = (el: HTMLElement) => {
  if (el.scrollTop <= 0) return false;
  const oy = getComputedStyle(el).overflowY;
  return oy === 'auto' || oy === 'scroll' || oy === 'overlay';
};

export const useSwipeToDismiss = <T extends HTMLElement>({ onDismiss, enabled = true, backdrop, handoff = false }: SwipeOptions) => {
  const [el, setEl] = useState<T | null>(null);
  const opts = useRef({ onDismiss, backdrop, handoff });
  opts.current = { onDismiss, backdrop, handoff };

  useEffect(() => {
    if (!el || !enabled) return;
    el.dataset.swipeRoot = '';
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let state: 'idle' | 'pending' | 'drag' | 'off' = 'idle';
    let still = false;
    let height = 1;

    const bd = () => opts.current.backdrop?.() ?? null;
    // animate: false follows the finger; 'back' glides home; [ms, curve] slides out over that many ms on a curve whose
    // opening slope matches the finger's speed (see slideOut). The backdrop fades on the same clock.
    const set = (dy: number, animate: false | 'back' | [number, string]) => {
      const [ms, curve] = animate === false ? [0, ''] : animate === 'back' ? [dur.slow, ease.spring] : animate;
      el.style.transition = animate === false ? 'none' : `translate ${ms}ms ${curve}`;
      el.style.translate = dy ? `0 ${dy}px` : '';
      const b = bd();
      if (b) {
        b.style.transition = animate === false ? 'none' : `opacity ${ms}ms ${curve}`;
        b.style.opacity = dy ? String(Math.max(animate === false ? 0.15 : 0, 1 - dy / (height * 0.9))) : '';
      }
    };
    /*
     * The rest of the way out: never shorter than MIN_OUT (a calm glide, not a snap) and never longer than MAX_OUT.
     * The curve's first control point sets its opening slope (y1 / x1) to speed × duration ÷ distance, so the sheet
     * leaves at exactly the finger's speed, then eases out without overshoot.
     */
    const slideOut = (rest: number, speed: number): [number, string] => {
      const [lo, hi] = isMobileMotion() ? [300, 460] : [dur.fast, dur.slow];
      const ms = Math.round(Math.min(hi, Math.max(lo, (2 * rest) / Math.max(speed, 0.6))));
      const slope = Math.max(0.5, (speed * ms) / Math.max(rest, 1));
      let x1 = 0.25;
      let y1 = x1 * slope;
      if (y1 > 1) {
        y1 = 1;
        x1 = 1 / slope;
      }
      return [ms, `cubic-bezier(${x1.toFixed(3)}, ${y1.toFixed(3)}, 0.36, 1)`];
    };
    const reset = () => {
      el.style.transition = '';
      el.style.translate = '';
      delete el.dataset.swiped;
      const b = bd();
      if (b) {
        b.style.transition = '';
        b.style.opacity = '';
      }
    };

    const onStart = (e: TouchEvent) => {
      state = 'off';
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      // The innermost swipe root owns the gesture
      if (target.closest('[data-swipe-root]') !== el) return;
      if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return;
      const onHandle = !!target.closest('[data-swipe-handle]');
      if (!onHandle) {
        for (let n: HTMLElement | null = target; n; n = n.parentElement) {
          if (scrolledDown(n)) return;
          if (n === el) break;
        }
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = lastY = t.clientY;
      lastT = e.timeStamp;
      vel = 0;
      height = Math.min(el.getBoundingClientRect().height, window.innerHeight) || 1;
      still = reducedMotion();
      state = 'pending';
    };

    const onMove = (e: TouchEvent) => {
      if (state === 'off' || state === 'idle') return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (state === 'pending') {
        // Decide on the first move: iOS ignores preventDefault once a scroll has begun. Sideways or upward is not ours
        // (scrolling, a chip row, the matrix).
        if (dy <= 0 || Math.abs(dx) > dy) {
          state = 'off';
          return;
        }
        state = 'drag';
      }
      if (e.cancelable) e.preventDefault();
      const now = e.timeStamp;
      if (now > lastT) vel = 0.7 * ((t.clientY - lastY) / (now - lastT)) + 0.3 * vel;
      lastY = t.clientY;
      lastT = now;
      if (!still) set(Math.max(0, dy), false);
    };

    const onEnd = () => {
      if (state !== 'drag') {
        state = 'idle';
        return;
      }
      state = 'idle';
      const dy = lastY - startY;
      const close = dy > Math.min(CLOSE_MAX, height * CLOSE_FRACTION) || (vel > FLICK && dy > 30);
      if (!close) {
        if (still) reset();
        else set(0, 'back');
        return;
      }
      // Tells the dialog's exit to fade from here rather than replay its own slide (index.css, .dlg-anim)
      el.dataset.swiped = '';
      if (still) {
        reset();
        opts.current.onDismiss();
        return;
      }
      if (opts.current.handoff) {
        opts.current.onDismiss();
        // Put it back if it stays mounted (it normally unmounts once the caller's exit ends)
        window.setTimeout(reset, 1200);
        return;
      }
      // Slide the rest of the way out at the finger's speed, then close (the dialog's exit fades it from there)
      const rest = height + 40 - dy;
      const [ms, curve] = slideOut(rest, Math.max(vel, 0));
      set(height + 40, [ms, curve]);
      window.setTimeout(() => {
        opts.current.onDismiss();
        // The element may stay mounted (a sheet that only hides): put it back once it's gone
        window.setTimeout(reset, 420);
      }, ms - 20);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      delete el.dataset.swipeRoot;
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      reset();
    };
  }, [el, enabled]);

  return useCallback((node: T | null) => setEl(node), []);
};

/** Combine refs (a forwarded ref and a callback ref) */
export const mergeRefs =
  <T,>(...refs: (Ref<T> | undefined)[]) =>
  (node: T | null) => {
    refs.forEach((r) => {
      if (typeof r === 'function') r(node);
      else if (r) (r as MutableRefObject<T | null>).current = node;
    });
  };
