import { useSyncExternalStore } from 'react';

/**
 * Home Screen app support (owner: "a proper icon, a splash screen and stopping the 7-day wipe").
 *
 * Safari deletes a site's script-writable storage (localStorage, IndexedDB: the card collection, coins, settings)
 * after 7 days of Safari use without a visit. Web apps added to the Home Screen are exempt, so on an iPhone in a
 * Safari tab the site offers the Add to Home Screen steps (AddToHomeScreen.tsx, at most once a week), and it asks
 * for persistent storage (navigator.storage.persist) where the browser grants it without a prompt: in the Home Screen
 * app, Safari and Chromium. Firefox asks the user, so there it is asked only from the Collection's storage tag.
 */

type Persist = 'unsupported' | 'unknown' | 'persisted' | 'best-effort';

const nav = () => (typeof navigator === 'undefined' ? null : (navigator as Navigator & { standalone?: boolean }));

/** An iPhone, iPod or iPad (iPadOS reports a Mac with touch). */
export const isIOS = () => {
  const n = nav();
  if (!n) return false;
  return /iPhone|iPod|iPad/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
};

/** Running as the Home Screen app (iOS sets navigator.standalone; others match the display mode). */
export const isStandalone = () => {
  const n = nav();
  if (!n) return false;
  if (n.standalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
};

const isFirefox = () => /Firefox\//.test(nav()?.userAgent ?? '');

// ---- persistent storage: one small store, read with usePersistence() ----
let state: Persist = 'unknown';
const listeners = new Set<() => void>();
const set = (s: Persist) => {
  if (s === state) return;
  state = s;
  listeners.forEach((l) => l());
};

const storage = () => nav()?.storage as (StorageManager & { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> }) | undefined;

/** Ask for persistent storage (no prompt in Safari and Chromium; Firefox shows one, so only call it there on a tap). */
export const requestPersistence = async (): Promise<Persist> => {
  const s = storage();
  if (!s?.persist || !s.persisted) {
    set('unsupported');
    return state;
  }
  try {
    if (await s.persisted()) set('persisted');
    else set((await s.persist()) ? 'persisted' : 'best-effort');
  } catch {
    set('best-effort');
  }
  return state;
};

let started = false;
/** Once per page load: read the current grant and, where it is silent, ask for it. */
export const initPersistence = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  const s = storage();
  if (!s?.persist || !s.persisted) {
    set('unsupported');
    return;
  }
  s.persisted()
    .then((yes) => {
      if (yes) set('persisted');
      else if (isStandalone() || !isFirefox()) void requestPersistence();
      else set('best-effort');
    })
    .catch(() => set('best-effort'));
};

export const usePersistence = () => {
  const persist = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => 'unknown' as Persist,
  );
  return { persist, standalone: isStandalone(), ios: isIOS(), askOnTap: isFirefox() };
};

// ---- the Add to Home Screen guide ----
const KEY = 'rv:a2hs:shown';
const WEEK = 7 * 24 * 60 * 60 * 1000;
export const INSTALL_EVENT = 'rv:install-guide';

/** Should the guide show by itself: an iPhone (or iPad) browser tab, not shown in the last week. */
export const installGuideDue = () => {
  if (!isIOS() || isStandalone()) return false;
  try {
    const last = Number(localStorage.getItem(KEY) ?? 0);
    return !(last > 0 && Date.now() - last < WEEK);
  } catch {
    return true;
  }
};

export const markInstallGuideShown = () => {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode: it may show again, nothing breaks */
  }
};

/** Open the guide on demand (the Collection's storage tag). */
export const openInstallGuide = () => window.dispatchEvent(new Event(INSTALL_EVENT));
