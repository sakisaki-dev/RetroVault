import { useEffect, useRef, useState, type ComponentType } from 'react';

/**
 * A global host that nothing on screen needs at first paint (the quick search dialog, the player quick look, the pack
 * toasts, the legend exchange): its code stays out of the entry bundle and loads once the page has settled (`whenSettled`), or at once when something wakes it. `wake` lists window events that load it immediately; the
 * event that woke it is fired again once it is mounted, so its own listener answers it ("open the search" from the
 * header before the chunk had arrived still opens it). `wakeKey` does the same for a shortcut: return the event name to
 * replay for a key press, or null.
 */
const SETTLE_MS = 9000;
const INTERACTIONS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

/**
 * Runs `fn` once the page has settled: at the first interaction, or `SETTLE_MS` after the page started, whichever comes
 * first, and then only in an idle slot (requestIdleCallback, 4 s at most). In a phone's first seconds the line and the
 * main thread belong to the tab's own data and render; nothing deferred here may compete with them. Returns a cancel.
 */
export const whenSettled = (fn: () => void): (() => void) => {
  let done = false;
  let idle = 0;
  let timer = 0;
  const run = () => {
    if (done) return;
    done = true;
    off();
    const ric = (window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) idle = ric(fn, { timeout: 4000 });
    else timer = window.setTimeout(fn, 200);
  };
  const off = () => INTERACTIONS.forEach((e) => window.removeEventListener(e, run, true));
  INTERACTIONS.forEach((e) => window.addEventListener(e, run, { capture: true, passive: true, once: true }));
  const first = window.setTimeout(run, Math.max(0, SETTLE_MS - performance.now()));
  return () => {
    done = true;
    off();
    window.clearTimeout(first);
    window.clearTimeout(timer);
    const cic = (window as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback;
    if (idle && cic) cic(idle);
  };
};

const LazyHost = ({
  load,
  wake = [],
  wakeKey,
}: {
  load: () => Promise<{ default: ComponentType }>;
  wake?: string[];
  wakeKey?: (e: KeyboardEvent) => string | null;
}) => {
  const [Host, setHost] = useState<ComponentType | null>(null);
  const replay = useRef<{ type: string; detail?: unknown } | null>(null);
  useEffect(() => {
    let dead = false;
    let started = false;
    const go = (event?: { type: string; detail?: unknown } | null) => {
      if (event) replay.current = event;
      if (started) return;
      started = true;
      load()
        .then((m) => !dead && setHost(() => m.default))
        .catch(() => {
          started = false;
        });
    };
    const onWake = (e: Event) => go({ type: e.type, detail: (e as CustomEvent).detail });
    const onKey = (e: KeyboardEvent) => {
      const ev = wakeKey?.(e);
      if (ev) go({ type: ev });
    };
    wake.forEach((w) => window.addEventListener(w, onWake));
    if (wakeKey) window.addEventListener('keydown', onKey);
    const cancel = whenSettled(() => go());
    return () => {
      dead = true;
      wake.forEach((w) => window.removeEventListener(w, onWake));
      if (wakeKey) window.removeEventListener('keydown', onKey);
      cancel();
    };
    // the loader and wake list are module constants at the call sites
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!Host || !replay.current) return;
    const event = replay.current;
    replay.current = null;
    window.dispatchEvent(event.detail === undefined ? new Event(event.type) : new CustomEvent(event.type, { detail: event.detail }));
  }, [Host]);
  return Host ? <Host /> : null;
};

export default LazyHost;
