import { useSyncExternalStore } from 'react';

/*
 * The desktop screensaver (owner, 2026-11-17: "a screensaver option for the desktop site so that I can leave my computer
 * and it'll rifle through beautiful artwork, players, banners etc with animations"). Started from the header's
 * Screensaver button, or by itself after the chosen idle time; any key, click or real mouse move ends it.
 * Desktop only: a wide screen with a fine pointer. The idle choice is a per-device convenience (localStorage).
 */

export const SAVER_IDLE_KEY = 'rv:saver:idle';
/** Idle minutes before it starts by itself; 0 = only from the button */
export const SAVER_IDLE_CHOICES = [0, 2, 5, 10, 15] as const;
const DEFAULT_IDLE = 5;

const START = 'rv:screensaver:start';
const listeners = new Set<() => void>();

const readIdle = (): number => {
  try {
    const v = Number(localStorage.getItem(SAVER_IDLE_KEY));
    const raw = localStorage.getItem(SAVER_IDLE_KEY);
    return raw !== null && (SAVER_IDLE_CHOICES as readonly number[]).includes(v) ? v : DEFAULT_IDLE;
  } catch {
    return DEFAULT_IDLE;
  }
};

let idle = readIdle();

export const setSaverIdle = (min: number) => {
  idle = min;
  try {
    localStorage.setItem(SAVER_IDLE_KEY, String(min));
  } catch {
    /* private window: the choice lasts this visit */
  }
  listeners.forEach((l) => l());
};

export const useSaverIdle = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => idle,
    () => DEFAULT_IDLE,
  );

/** Start it now (the header button). Called inside the click, so it can go full screen. */
export const startScreensaver = () => window.dispatchEvent(new Event(START));
export const onScreensaverStart = (fn: () => void) => {
  window.addEventListener(START, fn);
  return () => window.removeEventListener(START, fn);
};

/** A desktop: wide and a mouse or trackpad */
export const saverSupported = () => {
  try {
    return window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
  } catch {
    return false;
  }
};
