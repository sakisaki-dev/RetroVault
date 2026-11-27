import { useEffect, useRef } from 'react';

/**
 * Open a section of a page from outside it (the phone tab bar's hold menus: News > Injuries, Arcade > Blind Rank).
 * A request made before the page has mounted waits in `pending` and is taken on mount.
 */
const EVENT = 'rv:open-section';
const pending: Record<string, string> = {};

export const requestSection = (tab: string, value: string) => {
  pending[tab] = value;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { tab, value } }));
};

export const useSectionRequest = (tab: string, onSection: (value: string) => void) => {
  const cb = useRef(onSection);
  cb.current = onSection;
  useEffect(() => {
    const take = () => {
      const v = pending[tab];
      if (v === undefined) return;
      delete pending[tab];
      cb.current(v);
    };
    take();
    const on = (e: Event) => {
      if ((e as CustomEvent<{ tab: string }>).detail?.tab === tab) take();
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [tab]);
};
