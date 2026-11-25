import { useEffect, useRef, useState, type ComponentType } from 'react';

/**
 * A global host that nothing on screen needs at first paint (the quick search dialog, the player quick look, the pack
 * toasts, the legend exchange): its code stays out of the entry bundle and loads `delay` ms after the page mounted, or at once when something wakes it. `wake` lists window events that load it immediately; the
 * event that woke it is fired again once it is mounted, so its own listener answers it ("open the search" from the
 * header before the chunk had arrived still opens it). `wakeKey` does the same for a shortcut: return the event name to
 * replay for a key press, or null.
 */
const QUIET = 1200;
const MAX = 25000;

const LazyHost = ({
  load,
  wake = [],
  wakeKey,
  delay = 3000,
}: {
  load: () => Promise<{ default: ComponentType }>;
  wake?: string[];
  wakeKey?: (e: KeyboardEvent) => string | null;
  delay?: number;
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
    // not before `delay`, and then only once the line has been quiet for a moment (no new resource requested for
    // `QUIET` ms, `MAX` at the latest): in a phone's first seconds it belongs to the page's own data, chunks and sprites
    let seen = -1;
    let quietSince = performance.now();
    const started0 = performance.now();
    let timer = window.setTimeout(function check() {
      const n = performance.getEntriesByType('resource').length;
      const now = performance.now();
      if (n !== seen) {
        seen = n;
        quietSince = now;
      }
      if (now - quietSince >= QUIET || now - started0 >= MAX) go();
      else timer = window.setTimeout(check, 400);
    }, delay);
    return () => {
      dead = true;
      wake.forEach((w) => window.removeEventListener(w, onWake));
      if (wakeKey) window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
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
