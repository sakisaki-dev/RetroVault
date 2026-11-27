import { reducedMotion } from '@/utils/motion';

/*
 * One shared mechanism for "swipe between pills" and "slide when a pill changes" (owner: "the swipe works but the
 * animation for it is super snappy and not at all smooth").
 *
 *  - Interactive drag: after ~10px of horizontal-dominant movement the content under the navigator follows the finger
 *    (translateX with slight resistance, a faint fade), the navigator's pill thumb tracks toward the next option, and
 *    vertical scroll stays native (a vertical-dominant start never locks). At the first or last option the content
 *    rubber-bands. Past 25% of the width, or a flick over 0.4 px/ms, it slides out and the next option's content
 *    slides in from that side (~320ms, the site's --ease-out); otherwise it springs back.
 *  - Two-finger trackpad swipe (desktop): horizontal wheel events (|deltaX| > |deltaY|) do the same through the same
 *    code: the content follows the accumulated deltaX, and past WHEEL_PX one switch happens per gesture; the gesture ends
 *    after WHEEL_GAP_MS with no wheel event (momentum included, which is swallowed so it can't switch twice). Never acts
 *    over horizontal scrollers, ignored elements, with ctrl/meta held (zoom), at the first/last option, or when the page
 *    itself scrolls sideways; vertical wheel is never touched.
 *  - Taps: when a pill is pressed, the new content slides in from the side it lies on (the order of the options).
 *  - The incoming slide starts when the content really changed (a mutation under the content's container once the
 *    navigator's index moved, and not while a `[data-swipe-pending]` ancestor says a lazy view is still loading), so a
 *    slow chunk never slides in the old page.
 *  - Transforms and opacity only. prefers-reduced-motion and lite mode (html[data-perf="lite"]) crossfade, short.
 */
export type Dir = 1 | -1;

export interface SwipeCtx {
  /** The content to move, read again after the switch (the nodes may have been replaced) */
  content: () => HTMLElement[];
  has: (d: Dir) => boolean;
  go: (d: Dir) => void;
  /** The current option's index, to see that the switch happened (-1: unknown) */
  index: () => number;
  nav?: Element | null;
}

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
export const IN_MS = 320;
export const OUT_MS = 150;
const THRESHOLD = 0.25;
const FLICK = 0.4;
const LOCK_PX = 10;
// a deliberate two-finger swipe, not a brush (owner: "the swipe threshold should be increased since I can swipe on accident")
const WHEEL_PX = 220;
const WHEEL_GAP_MS = 180;

const calm = () => reducedMotion() || document.documentElement.dataset.perf === 'lite';

/** True while a swipe's own click is pressing the next pill (the tap listener leaves it) */
let engineGo = false;
export const press = (d: Dir, ctx: SwipeCtx) => {
  engineGo = true;
  try {
    ctx.go(d);
  } finally {
    engineGo = false;
  }
};
export const isEngineGo = () => engineGo;

// ---------- navigators ----------
export const NAV = '.cs-toggle:not(.cs-toggle--wrap), [role="tablist"], [data-swipe-nav]';
export const OPT = 'button, [role="tab"], a[href]';
export const ON = '.is-on, [aria-selected="true"], [aria-pressed="true"], [aria-current="page"], [aria-current="true"], [data-state="active"], [data-state="on"]';

export const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
export const optionsOf = (nav: Element) => [...nav.querySelectorAll<HTMLElement>(OPT)].filter((o) => o.closest(NAV) === nav && visible(o) && !(o as HTMLButtonElement).disabled);

const inFlow = (el: HTMLElement) => {
  if (el.offsetHeight <= 0 || el.classList.contains('sr-only')) return false;
  const p = getComputedStyle(el).position;
  return p !== 'fixed' && p !== 'absolute';
};

/**
 * What a navigator governs: the siblings after it (or after the nearest ancestor that has some, climbing until they
 * add up to a screen's worth of content), never past the dialog or the page's main area.
 */
export const contentAfter = (nav: Element): HTMLElement[] => {
  const stop = nav.closest('[role="dialog"]');
  for (let c: Element | null = nav; c && c !== stop && c !== document.body; c = c.parentElement) {
    const sibs: HTMLElement[] = [];
    for (let s = c.nextElementSibling; s; s = s.nextElementSibling) if (s instanceof HTMLElement && inFlow(s)) sibs.push(s);
    if (sibs.reduce((n, s) => n + s.offsetHeight, 0) >= 160) return sibs;
    if (c.matches('main')) break;
  }
  return [];
};

export const ctxForNav = (nav: Element): SwipeCtx => ({
  nav,
  content: () => contentAfter(nav),
  index: () => (nav.isConnected && !nav.closest('[data-swipe-pending]') ? optionsOf(nav).findIndex((o) => o.matches(ON)) : -2),
  has: (d) => {
    const o = optionsOf(nav);
    const i = o.findIndex((x) => x.matches(ON));
    return i >= 0 && !!o[i + d];
  },
  go: (d) => {
    const o = optionsOf(nav);
    const i = o.findIndex((x) => x.matches(ON));
    o[i + d]?.click();
  },
});

/** The navigator that governs a point in the page: innermost section first, the last one above the target */
export const governing = (target: Element): Element | null => {
  const box = target.closest('[role="dialog"]');
  for (let a: Element | null = target.parentElement; a; a = a.parentElement) {
    const found = [...a.querySelectorAll(NAV)].filter((nav) => {
      if (nav.contains(target) || !visible(nav)) return false;
      if (nav.closest('[role="dialog"]') !== box) return false;
      if (!(nav.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      const n = optionsOf(nav).length;
      return n >= 2 && n <= 7;
    });
    if (found.length) return found[found.length - 1];
    if (a === box) break;
  }
  return null;
};

export const scrollsSideways = (el: Element | null, stop?: Element | null): boolean => {
  for (let n: Element | null = el; n && n !== document.body && n !== stop?.parentElement; n = n.parentElement) {
    if (n instanceof HTMLElement && n.scrollWidth > n.clientWidth + 2) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
};

// ---------- the slide in ----------
/** Slide (or, calm, fade) elements in from the side `dir` points to: +1 = from the right (the next option) */
export const animateIn = (els: HTMLElement[], dir: Dir) => {
  const c = calm();
  const from = c ? 0 : dir * Math.round(Math.min(window.innerWidth, 640) * 0.28);
  els.forEach((el) => {
    el.style.transform = '';
    el.style.opacity = '';
    el.style.willChange = '';
    el.animate(
      [
        { transform: `translate3d(${from}px,0,0)`, opacity: 0 },
        { transform: 'translate3d(0,0,0)', opacity: 1 },
      ],
      { duration: c ? 180 : IN_MS, easing: EASE },
    );
  });
};

/**
 * After a switch was requested: wait until the content really changed, then slide the new content in. `held` are the
 * old nodes a swipe left invisible; they are released either way.
 */
export const afterSwitch = (ctx: SwipeCtx, startIdx: number, dir: Dir, held: HTMLElement[] | null) => {
  const region = ctx.content()[0]?.parentElement ?? held?.[0]?.parentElement ?? document.body;
  let done = false;
  let changedAt = 0;
  const t0 = performance.now();
  const release = () => held?.forEach((h) => { h.style.transform = ''; h.style.opacity = ''; h.style.willChange = ''; });
  const finish = (play: boolean) => {
    if (done) return;
    done = true;
    mo.disconnect();
    cancelAnimationFrame(raf);
    release();
    const els = ctx.content();
    if (play && els.length) animateIn(els, dir);
  };
  const changed = () => {
    const i = ctx.index();
    return i !== -2 && i !== startIdx;
  };
  const mo = new MutationObserver(() => {
    if (changed()) finish(true);
  });
  mo.observe(region, { childList: true, subtree: true });
  const tick = () => {
    if (done) return;
    const now = performance.now();
    if (changed()) {
      changedAt ||= now;
      if (now - changedAt > 150) return finish(true); // same nodes, updated in place
    }
    if (now - t0 > 2500) return finish(false);
    raf = requestAnimationFrame(tick);
  };
  let raf = requestAnimationFrame(tick);
};

// ---------- the drag ----------
export interface DragOptions {
  /** Which part of the page a touch that starts on `target` swipes, or null */
  resolve: (target: Element) => SwipeCtx | null;
  /** Elements a drag never starts on (anything that scrolls or drags itself) */
  ignore: string;
  /** Stop climbing for horizontal scrollers at this element */
  within?: Element | null;
  /** A host that handles its own area marks events so the document-level instance leaves them */
  claim?: boolean;
}

const thumbOf = (nav: Element | null | undefined) => nav?.querySelector<HTMLElement>(':scope > .cs-toggle__thumb, :scope > .pt__thumb') ?? null;

export const attachSwipe = (root: Document | HTMLElement, o: DragOptions) => {
  let st: 'idle' | 'pending' | 'drag' = 'idle';
  let sx = 0, sy = 0, lx = 0, lt = 0, vel = 0, W = 1, off = 0;
  let target: Element | null = null;
  let ctx: SwipeCtx | null = null;
  let els: HTMLElement[] = [];
  let thumb: { el: HTMLElement; from: HTMLElement; to: HTMLElement | null; t0: string; w0: string } | null = null;
  let moveOn = false;

  const reset = () => {
    st = 'idle';
    ctx = null;
    if (moveOn) {
      root.removeEventListener('touchmove', move as EventListener);
      moveOn = false;
    }
  };

  const place = (dx: number, dir: Dir) => {
    const has = !!ctx?.has(dir);
    off = has ? dx * 0.88 : Math.sign(dx) * Math.min(W * 0.22, Math.abs(dx) * 0.3);
    const fade = 1 - 0.3 * Math.min(1, Math.abs(off) / (W * 0.6));
    const reduce = reducedMotion();
    els.forEach((el) => {
      el.style.transform = reduce ? '' : `translate3d(${off.toFixed(1)}px,0,0)`;
      el.style.opacity = reduce ? String(1 - 0.5 * Math.min(1, Math.abs(off) / W)) : fade.toFixed(3);
    });
    if (thumb && has) {
      const p = Math.min(1, Math.abs(dx) / (W * 0.5));
      const a = thumb.from, b = thumb.to;
      if (b) {
        thumb.el.style.transition = 'none';
        thumb.el.style.width = `${a.offsetWidth + (b.offsetWidth - a.offsetWidth) * p}px`;
        thumb.el.style.transform = `translate(${a.offsetLeft + (b.offsetLeft - a.offsetLeft) * p}px, ${a.offsetTop}px)`;
      }
    }
  };

  const start = (e: Event) => {
    const te = e as TouchEvent & { rvClaimed?: boolean };
    st = 'idle';
    if (te.rvClaimed) return;
    if (o.claim) te.rvClaimed = true;
    if (te.touches.length !== 1) return;
    const t = te.target as Element | null;
    if (!t || t.closest(o.ignore) || scrollsSideways(t, o.within)) return;
    const c = o.resolve(t);
    if (!c) return;
    ctx = c;
    target = t;
    sx = lx = te.touches[0].clientX;
    sy = te.touches[0].clientY;
    lt = te.timeStamp;
    vel = 0;
    st = 'pending';
    if (!moveOn) {
      root.addEventListener('touchmove', move as EventListener, { passive: false });
      moveOn = true;
    }
  };

  /** Gets the content and the navigator's thumb ready to follow a drag toward `dir` */
  const begin = (c: SwipeCtx, dir: Dir) => {
    els = c.content();
    if (!els.length) return false;
    W = els[0].offsetWidth || window.innerWidth;
    const nav = c.nav;
    const th = thumbOf(nav);
    if (th && nav) {
      const opts = optionsOf(nav);
      const i = opts.findIndex((x) => x.matches(ON));
      if (i >= 0) thumb = { el: th, from: opts[i], to: opts[i + dir] ?? null, t0: th.style.transform, w0: th.style.width };
    }
    els.forEach((el) => (el.style.willChange = 'transform, opacity'));
    return true;
  };

  function move(e: TouchEvent) {
    if (st === 'idle' || !ctx) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (st === 'pending') {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      if (Math.abs(dx) < 1.3 * Math.abs(dy) || (sx < 24 && dx > 0)) return reset();
      if (!begin(ctx, dx < 0 ? 1 : -1)) return reset();
      st = 'drag';
      void target;
    }
    if (e.cancelable) e.preventDefault();
    if (e.timeStamp > lt) vel = 0.7 * ((t.clientX - lx) / (e.timeStamp - lt)) + 0.3 * vel;
    lx = t.clientX;
    lt = e.timeStamp;
    // direction can flip mid-drag: the thumb follows the current side
    const dir: Dir = dx < 0 ? 1 : -1;
    if (thumb && ctx.nav) {
      const opts = optionsOf(ctx.nav);
      const i = opts.indexOf(thumb.from);
      thumb.to = opts[i + dir] ?? null;
    }
    place(dx, dir);
  }

  const end = (e: Event) => {
    const c = ctx;
    const was = st;
    reset();
    if (was !== 'drag' || !c) return;
    const te = e as TouchEvent;
    settle(c, (te.changedTouches?.[0]?.clientX ?? lx) - sx, te.type === 'touchcancel');
  };

  /** A drag is over: slide on to the next option (a far or fast enough drag, or `force`d by the wheel) or spring back */
  const settle = (c: SwipeCtx, dx: number, cancelled: boolean, force = false) => {
    const dir: Dir = dx < 0 ? 1 : -1;
    const commit = !cancelled && c.has(dir) && (force || Math.abs(dx) > W * THRESHOLD || (Math.abs(vel) > FLICK && Math.abs(dx) > 16));
    const nodes = els;
    const curOp = nodes[0]?.style.opacity || '1';
    const curTf = `translate3d(${off.toFixed(1)}px,0,0)`;
    const th = thumb;
    thumb = null;
    nodes.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; });
    if (th) {
      th.el.style.transition = '';
      if (!commit) {
        th.el.style.transform = th.t0;
        th.el.style.width = th.w0;
      } else if (th.to) {
        th.el.style.width = `${th.to.offsetWidth}px`;
        th.el.style.transform = `translate(${th.to.offsetLeft}px, ${th.from.offsetTop}px)`;
      }
    }
    const still = reducedMotion();
    if (!commit) {
      nodes.forEach((el) => {
        const a = el.animate([{ transform: still ? 'none' : curTf, opacity: curOp }, { transform: 'none', opacity: 1 }], { duration: IN_MS, easing: EASE });
        a.onfinish = a.oncancel = () => { el.style.willChange = ''; };
      });
      return;
    }
    const startIdx = c.index();
    const side = dx < 0 ? -1 : 1;
    const outTf = still ? 'none' : `translate3d(${side * Math.round(W * 0.3)}px,0,0)`;
    let pending = nodes.length;
    const swap = () => {
      if (--pending > 0) return;
      nodes.forEach((el) => { el.style.opacity = '0'; });
      press(dir, c);
      afterSwitch(c, startIdx, dir, nodes);
    };
    nodes.forEach((el) => {
      const a = el.animate([{ transform: still ? 'none' : curTf, opacity: curOp }, { transform: outTf, opacity: 0 }], { duration: OUT_MS, easing: EASE_IN, fill: 'forwards' });
      a.onfinish = () => {
        swap();
        a.cancel();
      };
    });
  };

  // ----- two-finger trackpad swipe -----
  let wst: 'idle' | 'drag' | 'spent' = 'idle';
  let wctx: SwipeCtx | null = null;
  let acc = 0;
  let wtimer = 0;
  const wheelEnd = () => {
    const was = wst, c = wctx;
    wst = 'idle';
    wctx = null;
    acc = 0;
    if (was === 'drag' && c) {
      vel = 0;
      settle(c, off, true); // short of the threshold: spring back
    }
  };
  const wheel = (e: Event) => {
    const we = e as WheelEvent & { rvClaimed?: boolean };
    if (we.ctrlKey || we.metaKey) return; // pinch / zoom
    const k = we.deltaMode === 1 ? 16 : we.deltaMode === 2 ? window.innerWidth : 1;
    const dX = we.deltaX * k;
    const dY = we.deltaY * k;
    if (wst === 'idle') {
      if (Math.abs(dX) <= 2 * Math.abs(dY) || Math.abs(dX) < 4 || we.rvClaimed) return; // clearly sideways only; vertical wheel is never touched
      if (o.claim) we.rvClaimed = true;
      const t = we.target as Element | null;
      if (!t || t.closest(o.ignore) || scrollsSideways(t, o.within)) return;
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 2) return; // the page itself scrolls sideways: let it
      const c = o.resolve(t);
      const dir: Dir = dX > 0 ? 1 : -1;
      if (!c || !c.has(dir) || !begin(c, dir)) return;
      wctx = c;
      wst = 'drag';
      acc = 0;
      off = 0;
    } else if (Math.abs(dX) < Math.abs(dY) && Math.abs(dX) < 2) {
      return; // a vertical turn in the middle of a gesture
    }
    // we act on this gesture: keep the browser's back/forward swipe out of it
    if (we.cancelable) we.preventDefault();
    clearTimeout(wtimer);
    wtimer = window.setTimeout(wheelEnd, WHEEL_GAP_MS);
    if (wst !== 'drag' || !wctx) return; // spent: momentum after the switch is swallowed
    acc += dX;
    const dir: Dir = acc > 0 ? 1 : -1;
    place(-acc, dir);
    if (Math.abs(acc) >= WHEEL_PX && wctx.has(dir)) {
      const c = wctx;
      wst = 'spent';
      vel = 0;
      settle(c, -acc, false, true);
    }
  };

  root.addEventListener('wheel', wheel, { passive: false });
  root.addEventListener('touchstart', start as EventListener, { passive: true });
  root.addEventListener('touchend', end, { passive: true });
  root.addEventListener('touchcancel', end, { passive: true });
  return () => {
    clearTimeout(wtimer);
    root.removeEventListener('wheel', wheel);
    root.removeEventListener('touchstart', start as EventListener);
    root.removeEventListener('touchend', end);
    root.removeEventListener('touchcancel', end);
    reset();
  };
};

/** Tapping a pill: the new content slides in from the side the pill lies on */
export const attachTapSlide = () => {
  const onClick = (e: Event) => {
    if (engineGo || e.defaultPrevented) return;
    const opt = (e.target as Element | null)?.closest(OPT);
    const nav = opt?.closest(NAV);
    if (!opt || !nav || nav.closest('[role="menu"], [role="listbox"], [data-no-swipe]')) return;
    const opts = optionsOf(nav);
    const n = opts.length;
    const clicked = opts.indexOf(opt as HTMLElement);
    const cur = opts.findIndex((x) => x.matches(ON));
    if (n < 2 || n > 7 || clicked < 0 || cur < 0 || clicked === cur) return;
    const ctx = ctxForNav(nav);
    if (!ctx.content().length) return;
    afterSwitch(ctx, cur, clicked > cur ? 1 : -1, null);
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
};
