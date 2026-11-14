/*
 * Overlays as history entries (phones and touch screens only): Safari's edge swipe and Android Back close the open
 * dialog, sheet or card instead of leaving the page.
 *
 * Opening an overlay pushes an entry with the same URL and the page's own entry id ({ rv }, hashRoute.ts) plus an
 * overlay sequence number ({ ov }). Because rv and the hash are unchanged, the hash router ignores these entries: no
 * route change, no scroll save or restore. Back pops the entry and `popstate` closes every overlay above the entry now
 * shown (their ov is higher). Closing by X, tap or swipe pops the overlay's own entry (history.back, which this module
 * swallows), so history never piles up.
 *
 * - A route change while an overlay entry is on top replaces it rather than pushing (hashRoute.navigate asks
 *   `overlayOnTop()`), so a card that hands off to the Deep Dive leaves page, Deep Dive: Back goes to the page.
 * - The release is deferred a tick: closing one overlay and opening the next in the same commit (React StrictMode's
 *   double mount, next / previous in a sheet) reuses the entry instead of popping and pushing.
 * - A push that arrives while our own Back is still in flight waits for it, so the two never race.
 */
import { MOBILE_MOTION } from './motion';

type Entry = { id: number; close: () => void };

const stack: Entry[] = [];
const pendingRelease = new Set<number>();
let seq = 0;
let swallow = 0;
let swallowTimer = 0;
const waiting: (() => void)[] = [];
let installed = false;

const ovOf = (s: unknown): number => {
  const v = (s as { ov?: unknown } | null)?.ov;
  return typeof v === 'number' ? v : 0;
};

let mq: MediaQueryList | null = null;
/** Phones and touch screens: where a system Back gesture exists to honour */
export const overlayHistoryOn = (): boolean => {
  try {
    mq ??= window.matchMedia(MOBILE_MOTION);
    return mq.matches;
  } catch {
    return false;
  }
};

const onPop = (e: PopStateEvent) => {
  if (swallow > 0) {
    swallow -= 1;
    if (!swallow) window.clearTimeout(swallowTimer);
    const run = waiting.splice(0);
    run.forEach((f) => f());
    return;
  }
  const cur = ovOf(e.state);
  // Every overlay whose entry is no longer in the history above the one shown closes, top first
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const en = stack[i];
    if (en.id <= cur) break;
    stack.splice(i, 1);
    en.close();
  }
};

const install = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // A reload keeps history.state: an overlay entry left over from before is not an open overlay
  const st = window.history.state as Record<string, unknown> | null;
  if (st && 'ov' in st) {
    const rest = { ...st };
    delete rest.ov;
    window.history.replaceState(rest, '');
  }
  seq = Math.max(seq, ovOf(st));
  window.addEventListener('popstate', onPop);
};

/** Is the history entry on screen one of ours (an open overlay above the page)? */
export const overlayOnTop = (): boolean => typeof window !== 'undefined' && ovOf(window.history.state) > 0;

/** Back from an entry, swallowing the popstate it causes (the overlay is already closing) */
const popOwn = () => {
  swallow += 1;
  window.clearTimeout(swallowTimer);
  // Safety: a Back that never fires popstate (no entry, a page unload) must not swallow the next real one
  swallowTimer = window.setTimeout(() => {
    swallow = 0;
    waiting.splice(0).forEach((f) => f());
  }, 600);
  window.history.back();
};

/**
 * Register an open overlay. Returns its release: call it when the overlay closes (any way). Does nothing on desktop.
 * `close` is called when Back (a swipe or the system button) pops the overlay's entry.
 */
export const pushOverlay = (close: () => void): (() => void) => {
  if (typeof window === 'undefined' || !overlayHistoryOn()) return () => undefined;
  install();
  const entry: Entry = { id: 0, close };
  let released = false;
  const doPush = () => {
    if (released) return;
    entry.id = ++seq;
    const st = (window.history.state ?? {}) as Record<string, unknown>;
    const top = ovOf(st);
    if (top && pendingRelease.has(top)) {
      // The overlay that just closed hands its entry over
      pendingRelease.delete(top);
      window.history.replaceState({ ...st, ov: entry.id }, '');
    } else {
      window.history.pushState({ ...st, ov: entry.id }, '');
    }
    stack.push(entry);
  };
  if (swallow > 0) waiting.push(doPush);
  else doPush();

  return () => {
    if (released) return;
    released = true;
    const i = stack.indexOf(entry);
    if (i < 0) return; // closed by Back (its entry is gone) or never pushed
    stack.splice(i, 1);
    const id = entry.id;
    pendingRelease.add(id);
    window.setTimeout(() => {
      if (!pendingRelease.delete(id)) return; // reused by the next overlay
      // Pop only while our entry is still the one on screen (a route change may have replaced it)
      if (ovOf(window.history.state) === id) popOwn();
    }, 0);
  };
};
