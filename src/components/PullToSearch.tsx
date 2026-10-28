import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { openQuickSearch } from '@/components/QuickPlayerSearch';
import { MOBILE_MOTION, dur, ease, reducedMotion } from '@/utils/motion';

/*
 * Pull down to search (phones and touch screens), like Spotlight on iOS: with the page at the very top, a downward
 * drag that starts on the page content pulls a search pill out from under the header. Past THRESHOLD (or on a quick
 * flick) releasing opens the ⌘K player search with the keyboard up; short of it the pill springs back.
 *
 * Never fires: inside a dialog or sheet (or while one is open), on inputs, on anything that handles its own
 * touches (charts, maps, the card browser, cards, [data-no-pull]), on a horizontal drag, or when the page isn't at
 * the top. While pulling it cancels the native overscroll (so iOS's bounce and Chrome's pull-to-refresh don't run
 * under it); otherwise native scrolling is untouched. Lite mode / reduced motion: no rubber band or content shift,
 * just the threshold and the open.
 */
const THRESHOLD = 76; // px of (resisted) pull
const FLICK = 0.6; // px per ms
const HINT_KEY = 'retroVault:pullSearchUsed';
const EXCLUDE =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [data-swipe-root], [data-no-pull], svg[role="group"], canvas, .fut, .cbw, .gp-sheet, .bnav, [style*="touch-action"]';

const used = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
};
const markUsed = () => {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* storage blocked */
  }
};

/** Something modal is up (Radix locks the body and marks open dialogs / sheets) */
const modalOpen = () => !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') || document.body.hasAttribute('data-scroll-locked');

/**
 * iOS only raises the keyboard for a focus that happens inside the user's gesture. The search dialog focuses its
 * input a frame later, so focus a stand-in input now; focus moving from it to the real input keeps the keyboard up.
 */
const primeKeyboard = () => {
  const el = document.createElement('input');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none;';
  document.body.appendChild(el);
  el.focus({ preventScroll: true });
  window.setTimeout(() => el.remove(), 1500);
};

const PullToSearch = () => {
  const pillRef = useRef<HTMLDivElement | null>(null);
  const [hint, setHint] = useState(false);

  // One-time hint: on phones, until the pull has been used once (at most once per visit, for a few seconds)
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(max-width: 640px)');
    } catch {
      return;
    }
    if (!mq.matches || used()) return;
    const show = window.setTimeout(() => window.scrollY <= 0 && setHint(true), 1800);
    const hide = window.setTimeout(() => setHint(false), 7800);
    const off = () => setHint(false);
    window.addEventListener('scroll', off, { passive: true, once: true });
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.removeEventListener('scroll', off);
    };
  }, []);

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(MOBILE_MOTION);
    } catch {
      return;
    }
    const pill = pillRef.current;
    if (!pill) return;
    let state: 'idle' | 'pending' | 'pull' = 'idle';
    let x0 = 0;
    let y0 = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let shown = 0;
    let still = false;
    const main = () => document.getElementById('main');

    // Resisted distance: linear-ish up to the threshold, then a rubber band
    const resist = (d: number) => {
      const r = d * 0.55;
      if (still) return Math.min(r, THRESHOLD);
      return r <= THRESHOLD ? r : THRESHOLD + (r - THRESHOLD) * 0.3;
    };
    const paint = (d: number, animate: false | 'back' | 'open') => {
      shown = d;
      const p = Math.min(1, d / THRESHOLD);
      const t = animate === false ? 'none' : `translate ${dur.slow}ms ${ease.spring}, scale ${dur.slow}ms ${ease.spring}, opacity ${dur.base}ms ${ease.out}`;
      pill.style.transition = t;
      pill.style.translate = `-50% ${Math.round(d - 52)}px`;
      pill.style.scale = String(0.7 + 0.3 * p);
      pill.style.opacity = animate === 'open' ? '0' : String(Math.min(1, p * 1.4));
      pill.dataset.ready = p >= 1 ? 'true' : 'false';
      const m = main();
      if (m) {
        m.style.transition = animate === false ? 'none' : `translate ${dur.slow}ms ${ease.spring}`;
        m.style.translate = d && !still ? `0 ${Math.round(d * 0.5)}px` : '';
      }
    };
    const clear = () => {
      window.setTimeout(() => {
        if (state !== 'idle') return;
        pill.style.transition = '';
        const m = main();
        if (m) m.style.transition = '';
      }, dur.slow + 40);
    };

    const onStart = (e: TouchEvent) => {
      state = 'idle';
      if (!mq.matches || e.touches.length !== 1 || window.scrollY > 0 || modalOpen()) return;
      const target = e.target as Element | null;
      if (!target || target.closest(EXCLUDE)) return;
      const t = e.touches[0];
      x0 = t.clientX;
      y0 = lastY = t.clientY;
      lastT = e.timeStamp;
      vel = 0;
      still = reducedMotion();
      state = 'pending';
    };
    const onMove = (e: TouchEvent) => {
      if (state === 'idle') return;
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) {
        state = 'idle';
        paint(0, 'back');
        clear();
        return;
      }
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (state === 'pending') {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        // Down and mostly vertical, with the page still at the top; anything else is ordinary scrolling
        if (dy <= 0 || Math.abs(dx) > dy * 0.8 || window.scrollY > 0) {
          state = 'idle';
          return;
        }
        state = 'pull';
        setHint(false);
      }
      if (e.cancelable) e.preventDefault();
      if (e.timeStamp > lastT) vel = 0.7 * ((t.clientY - lastY) / (e.timeStamp - lastT)) + 0.3 * vel;
      lastY = t.clientY;
      lastT = e.timeStamp;
      paint(resist(Math.max(0, dy)), false);
    };
    const onEnd = () => {
      if (state !== 'pull') {
        state = 'idle';
        return;
      }
      state = 'idle';
      const go = shown >= THRESHOLD - 0.5 || (vel > FLICK && shown > 28);
      if (go) {
        primeKeyboard();
        markUsed();
        setHint(false);
        openQuickSearch();
        paint(0, 'open');
      } else paint(0, 'back');
      clear();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return (
    <>
      <div ref={pillRef} className="pts-pill" aria-hidden="true" data-ready="false">
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="pts-pill__idle">Pull to search players</span>
        <span className="pts-pill__ready">Release to search</span>
      </div>
      {hint && (
        <button
          type="button"
          className="pts-hint"
          onClick={() => {
            setHint(false);
            markUsed();
            openQuickSearch();
          }}
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Pull down to search
        </button>
      )}
    </>
  );
};

export default PullToSearch;
