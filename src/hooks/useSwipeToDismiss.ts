import { useCallback, useEffect, useRef, useState, type MutableRefObject, type Ref } from 'react';
import { dur, ease, isMobileMotion } from '@/utils/motion';
import { reducedMotion } from '@/utils/motion';

/*
 * Swipe down to dismiss (touch only), for dialogs and bottom sheets.
 *
 * A downward drag closes the element when it starts on a grab handle / header ([data-swipe-handle]) or when every
 * scroller between the finger and the element is already at its top. Otherwise the drag is ordinary scrolling.
 * Sideways drags (matrix and chip rows), range sliders and text fields are left alone. The element follows the finger
 * (the `translate` property, so it composes with any centring transform) and the backdrop fades with it; past a
 * distance or a flick it glides out at the finger's speed (at least 300 ms on phones), otherwise it glides back. With reduced motion nothing
 * moves, but a long enough drag still closes it.
 *
 * Nested roots (a sheet inside a dialog) each mark themselves data-swipe-root; a drag belongs to the innermost one.
 *
 * `right` adds swipe right to close (phones' full-screen cards and pages): a sideways drag to the right that starts
 * more than EDGE_PX in from the left edge (the strip nearer the edge is the system's own Back swipe), not on a sideways
 * scroller or a [data-no-swipe-x] area (a card carousel with its own swipe), moves the element sideways with the finger
 * and the backdrop fading behind it; past a third of its width or a flick it leaves to the right, else it springs back.
 */

export interface SwipeOptions {
  onDismiss: () => void;
  enabled?: boolean;
  /** Swipe down to close (default true) */
  down?: boolean;
  /** Swipe right to close (default false) */
  right?: boolean;
  /** Element to fade with the drag (a backdrop) */
  backdrop?: () => HTMLElement | null;
  /** Element to bring in with the drag (what lies behind a page: a "Back to …" hint) */
  reveal?: () => HTMLElement | null;
  /**
   * Hand the release straight to onDismiss, leaving the element where the finger left it (the caller runs its own
   * exit from there) instead of sliding it the rest of the way out first
   */
  handoff?: boolean;
}

const CLOSE_FRACTION = 0.28; // of the element's visible height
const CLOSE_MAX = 160; // px: never require more than this
const FLICK = 0.55; // px per ms
/** Touches this close to the left edge belong to the system's Back swipe */
export const EDGE_PX = 24;
const CLOSE_FRACTION_X = 0.33; // of the element's width
const CLOSE_MAX_X = 150;


/** Can this element scroll sideways? (read once, at the touch's start) */
export const scrollsSideways = (el: HTMLElement) => {
  if (el.scrollWidth <= el.clientWidth + 1) return false;
  const ox = getComputedStyle(el).overflowX;
  return ox === 'auto' || ox === 'scroll' || ox === 'overlay';
};

/** Can this element scroll vertically (and is it scrolled down from the top)? */
const scrolledDown = (el: HTMLElement) => {
  if (el.scrollTop <= 0) return false;
  const oy = getComputedStyle(el).overflowY;
  return oy === 'auto' || oy === 'scroll' || oy === 'overlay';
};

export const useSwipeToDismiss = <T extends HTMLElement>({ onDismiss, enabled = true, down = true, right = false, backdrop, reveal, handoff = false }: SwipeOptions) => {
  const [el, setEl] = useState<T | null>(null);
  const opts = useRef({ onDismiss, backdrop, reveal, handoff });
  opts.current = { onDismiss, backdrop, reveal, handoff };

  useEffect(() => {
    if (!el || !enabled) return;
    // 'down' when the root takes downward drags (sheets): pull-to-search stays off those; a sideways-only root (the
    // Deep Dive's swipe back) leaves the pull alone
    el.dataset.swipeRoot = down ? 'down' : 'x';
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let lastX = 0;
    let velX = 0;
    let state: 'idle' | 'pending' | 'drag' | 'off' = 'idle';
    let still = false;
    let height = 1;
    let width = 1;
    let handle = false;
    // The drag's axis, fixed on its first move; which axes this touch may take (decided at its start)
    let axis: 'y' | 'x' = 'y';
    let canY = false;
    let canX = false;
    // Released past the line: the element is on its way out. A caller that turns the hook off as it closes (enabled
    // follows `open`) must not snap it back home in this effect's cleanup: the exit continues from where it is.
    let leaving = false;

    const bd = () => opts.current.backdrop?.() ?? null;
    // animate: false follows the finger; 'back' glides home; [ms, curve] slides out over that many ms on a curve whose
    // opening slope matches the finger's speed (see slideOut). The backdrop fades on the same clock.
    const set = (d: number, animate: false | 'back' | [number, string]) => {
      const [ms, curve] = animate === false ? [0, ''] : animate === 'back' ? [dur.slow, ease.spring] : animate;
      el.style.transition = animate === false ? 'none' : `translate ${ms}ms ${curve}`;
      el.style.translate = d ? (axis === 'x' ? `${d}px 0` : `0 ${d}px`) : '';
      const b = bd();
      if (b) {
        const size = axis === 'x' ? width : height;
        b.style.transition = animate === false ? 'none' : `opacity ${ms}ms ${curve}`;
        b.style.opacity = d ? String(Math.max(animate === false ? 0.15 : 0, 1 - d / (size * 0.9))) : '';
      }
      const rv = opts.current.reveal?.();
      if (rv) {
        const size = axis === 'x' ? width : height;
        const k = Math.min(1, Math.max(0, d) / (size * 0.33));
        rv.style.transition = animate === false ? 'none' : `opacity ${ms}ms ${curve}, translate ${ms}ms ${curve}`;
        rv.style.opacity = d > 0 ? String(k) : '';
        rv.style.translate = d > 0 ? `${Math.round(-28 * (1 - k))}px 0` : '';
        rv.dataset.ready = String(k >= 1);
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
      leaving = false;
      el.style.transition = '';
      el.style.translate = '';
      delete el.dataset.swiped;
      const rv = opts.current.reveal?.();
      if (rv) {
        rv.style.transition = '';
        rv.style.opacity = '';
        rv.style.translate = '';
        delete rv.dataset.ready;
      }
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
      const t = e.touches[0];
      const onHandle = !!target.closest('[data-swipe-handle]');
      handle = onHandle;
      canY = down;
      if (canY && !onHandle) {
        for (let n: HTMLElement | null = target; n; n = n.parentElement) {
          if (scrolledDown(n)) {
            canY = false;
            break;
          }
          if (n === el) break;
        }
      }
      canX = right && t.clientX > EDGE_PX && !target.closest('[data-no-swipe-x], input[type="range"]');
      if (canX) {
        for (let n: HTMLElement | null = target; n; n = n.parentElement) {
          // A sideways scroller, or a surface that takes its own drags (a zoomed map sets touch-action: none inline)
          if (n.style.touchAction === 'none' || scrollsSideways(n)) {
            canX = false;
            break;
          }
          if (n === el) break;
        }
      }
      if (!canY && !canX) return;
      startX = lastX = t.clientX;
      startY = lastY = t.clientY;
      lastT = e.timeStamp;
      vel = 0;
      velX = 0;
      const r = el.getBoundingClientRect();
      height = Math.min(r.height, window.innerHeight) || 1;
      width = Math.min(r.width, window.innerWidth) || 1;
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
        // Decide on the first move: iOS ignores preventDefault once a scroll has begun. Upward is not ours
        // (scrolling), nor is sideways unless swipe right is on and it heads right (a chip row, the matrix).
        // (On the grab handle an upward pull is ours too: it stretches a little and springs back.)
        if (Math.abs(dx) > Math.abs(dy)) {
          if (!canX || dx <= 0) {
            state = 'off';
            return;
          }
          axis = 'x';
        } else {
          if (!canY || (dy <= 0 && !handle)) {
            state = 'off';
            return;
          }
          axis = 'y';
        }
        state = 'drag';
      }
      if (e.cancelable) e.preventDefault();
      const now = e.timeStamp;
      if (now > lastT) {
        vel = 0.7 * ((t.clientY - lastY) / (now - lastT)) + 0.3 * vel;
        velX = 0.7 * ((t.clientX - lastX) / (now - lastT)) + 0.3 * velX;
      }
      lastY = t.clientY;
      lastX = t.clientX;
      lastT = now;
      if (still) return;
      // Right: follows the finger 1:1, a little resistance back past the start
      if (axis === 'x') set(dx >= 0 ? dx : -12 * (1 - 1 / (1 + -dx / 60)), false);
      // Down: follows the finger 1:1. Up (handle only): rubber-banded, at most about 24 px
      else set(dy >= 0 ? dy : -24 * (1 - 1 / (1 + -dy / 60)), false);
    };

    const onEnd = () => {
      if (state !== 'drag') {
        state = 'idle';
        return;
      }
      state = 'idle';
      const x = axis === 'x';
      const dy = x ? lastX - startX : lastY - startY;
      const v = x ? velX : vel;
      const size = x ? width : height;
      const close = x
        ? dy > Math.min(CLOSE_MAX_X, width * CLOSE_FRACTION_X) || (v > FLICK && dy > 30)
        : dy > Math.min(CLOSE_MAX, height * CLOSE_FRACTION) || (v > FLICK && dy > 30);
      if (!close) {
        if (still) reset();
        else set(0, 'back');
        return;
      }
      // Tells the dialog's exit to fade from here rather than replay its own slide (index.css, .dlg-anim)
      el.dataset.swiped = '';
      leaving = true;
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
      const rest = size + 40 - dy;
      const [ms, curve] = slideOut(rest, Math.max(v, 0));
      set(size + 40, [ms, curve]);
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
      if (!leaving) reset();
    };
  }, [el, enabled, down, right]);

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
