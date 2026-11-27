import { useSyncExternalStore } from 'react';
import './perf.css';

/*
 * Performance mode ("lite"): a per-viewer setting (localStorage) that turns off the costly effects: card tilt,
 * shimmer and glare, backdrop blur, drop-shadow filters, the market ticker, and shortens walkouts to a quick reveal.
 * CSS reads `data-perf="lite"` on <html> (src/hooks/perf.css); JS effects call isLite().
 *
 * "auto" (the default) is on when the viewer prefers reduced motion or the device reports 2 GB of memory or less
 * (Chrome on low-end Android). It no longer counts CPU cores: iOS Safari reports a capped core count, which put every
 * iPhone in performance mode. Motion (transform / opacity: dialogs, sheets, swipes, view changes) never depends on
 * this mode, only on prefers-reduced-motion (utils/motion.ts).
 *
 * REDUCE MOTION, the one source of truth: motion is reduced when the OS asks for it (prefers-reduced-motion) OR the
 * viewer turned the site's own switch (this setting, "On") on. `isReducedMotion()` / `useReducedMotion()` read it,
 * `<html data-reduce-motion>` mirrors it for CSS (the postcss plugin in postcss.config.js gives every
 * `@media (prefers-reduced-motion)` rule a twin under that attribute, and index.css has the global cut), and
 * `utils/motion.ts` `reducedMotion()` is the same value for plain JS. "Auto" follows the OS only.
 */
export type PerfSetting = 'auto' | 'on' | 'off';

const KEY = 'retroVault:perfMode';
const listeners = new Set<() => void>();

const read = (): PerfSetting => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
};

/** The suggested default: reduced motion, or a low-core / low-memory device. */
export const suggestLite = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {
    /* no matchMedia */
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory != null && nav.deviceMemory <= 2) return true;
  // TV browsers run on phone-class chips (owner, 2026-11-18: the screensaver on a Fire TV's Silk was "super choppy"):
  // Fire TV (Silk, AFT* models), Android TV, Tizen, webOS, smart-TV and console browsers
  if (/Silk|AFT[A-Z]|Android TV|BRAVIA|SMART-?TV|SmartTV|Tizen|Web0S|webOS|CrKey|AppleTV|PlayStation|Xbox/i.test(nav.userAgent)) return true;
  return nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 2;
};

let setting: PerfSetting = typeof window === 'undefined' ? 'auto' : read();
const resolve = (s: PerfSetting) => (s === 'auto' ? suggestLite() : s === 'on');
let lite = typeof window === 'undefined' ? false : resolve(setting);

const osMq: MediaQueryList | null = (() => {
  try {
    return typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return null;
  }
})();
const computeReduce = () => !!osMq?.matches || setting === 'on';
let reduce = typeof window === 'undefined' ? false : computeReduce();

const apply = () => {
  if (typeof document === 'undefined') return;
  if (lite) document.documentElement.dataset.perf = 'lite';
  else delete document.documentElement.dataset.perf;
  if (reduce) document.documentElement.dataset.reduceMotion = '';
  else delete document.documentElement.dataset.reduceMotion;
};
apply();

/*
 * Smooth scrolling is reduced here, once, for every caller: with reduce motion on, `behavior: 'smooth'` (scrollTo,
 * scrollBy, scrollIntoView on the window or any element) jumps instead.
 */
const jumpWhenReduced = (opts: unknown) =>
  reduce && opts && typeof opts === 'object' && (opts as ScrollToOptions).behavior === 'smooth' ? { ...(opts as ScrollToOptions), behavior: 'auto' as const } : opts;
if (typeof window !== 'undefined' && typeof Element !== 'undefined') {
  for (const [proto, names] of [
    [window, ['scroll', 'scrollTo', 'scrollBy']],
    [Element.prototype, ['scroll', 'scrollTo', 'scrollBy', 'scrollIntoView']],
  ] as const) {
    for (const name of names) {
      const orig = (proto as unknown as Record<string, unknown>)[name];
      if (typeof orig !== 'function') continue;
      (proto as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        return (orig as (...a: unknown[]) => unknown).apply(this, args.length ? [jumpWhenReduced(args[0]), ...args.slice(1)] : args);
      };
    }
  }
}

/** True when motion should be reduced: the OS setting or the site's own switch (Performance mode "On"). */
export const isReducedMotion = () => reduce;

/** True while performance mode is on (for JS-driven effects: tilt, walkout timing). */
export const isLite = () => lite;

export const setPerfSetting = (s: PerfSetting) => {
  setting = s;
  lite = resolve(s);
  reduce = computeReduce();
  try {
    if (s === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, s);
  } catch {
    /* storage blocked: the choice lasts this visit */
  }
  apply();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// The OS setting can change while the page is open
osMq?.addEventListener?.('change', () => {
  const was = reduce;
  const wasLite = lite;
  reduce = computeReduce();
  lite = resolve(setting);
  if (reduce !== was || lite !== wasLite) {
    apply();
    listeners.forEach((l) => l());
  }
});

/** Reactive reduce-motion flag (OS setting or the site's switch). */
export const useReducedMotion = () => useSyncExternalStore(subscribe, () => reduce, () => false);

/** { setting, lite } for the header toggle. */
export const usePerfMode = () => {
  const s = useSyncExternalStore(subscribe, () => setting, () => 'auto' as PerfSetting);
  const on = useSyncExternalStore(subscribe, () => lite, () => false);
  return { setting: s, lite: on };
};
