import { useSyncExternalStore } from 'react';
import './perf.css';

/*
 * Performance mode ("lite"): a per-viewer setting (localStorage) that turns off the costly effects: card tilt,
 * shimmer and glare, backdrop blur, drop-shadow filters, the market ticker, and shortens walkouts to a quick reveal.
 * CSS reads `data-perf="lite"` on <html> (src/hooks/perf.css); JS effects call isLite().
 *
 * "auto" (the default) is on when the viewer prefers reduced motion or the device looks low-end
 * (4 cores or fewer, or 4 GB of memory or less).
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
  return (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4) || (nav.deviceMemory != null && nav.deviceMemory <= 4);
};

let setting: PerfSetting = typeof window === 'undefined' ? 'auto' : read();
const resolve = (s: PerfSetting) => (s === 'auto' ? suggestLite() : s === 'on');
let lite = typeof window === 'undefined' ? false : resolve(setting);

const apply = () => {
  if (typeof document === 'undefined') return;
  if (lite) document.documentElement.dataset.perf = 'lite';
  else delete document.documentElement.dataset.perf;
};
apply();

/** True while performance mode is on (for JS-driven effects: tilt, walkout timing). */
export const isLite = () => lite;

export const setPerfSetting = (s: PerfSetting) => {
  setting = s;
  lite = resolve(s);
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

/** { setting, lite } for the header toggle. */
export const usePerfMode = () => {
  const s = useSyncExternalStore(subscribe, () => setting, () => 'auto' as PerfSetting);
  const on = useSyncExternalStore(subscribe, () => lite, () => false);
  return { setting: s, lite: on };
};
