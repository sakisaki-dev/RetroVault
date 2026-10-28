import { useSyncExternalStore } from 'react';

/**
 * Phone layout breakpoint (max-width 640px, Tailwind's `sm` boundary). Components that need a different structure on
 * phones (not just restyled) branch on this; plain restyles use `max-sm:` classes instead, so desktop never changes.
 */
export const PHONE_QUERY = '(max-width: 640px)';

let mq: MediaQueryList | null = null;
const getMq = () => {
  if (typeof window === 'undefined') return null;
  try {
    mq ??= window.matchMedia(PHONE_QUERY);
  } catch {
    mq = null;
  }
  return mq;
};

const subscribe = (cb: () => void) => {
  const m = getMq();
  if (!m) return () => undefined;
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

export const isPhone = () => getMq()?.matches ?? false;

/** True on phone-width viewports; re-renders when the viewport crosses the breakpoint. */
export const usePhone = () => useSyncExternalStore(subscribe, isPhone, () => false);
