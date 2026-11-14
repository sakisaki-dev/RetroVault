import { useEffect, useState } from 'react';

/** A media query as state (read on mount, follows resizes). */
export const useMedia = (query: string): boolean => {
  const get = () => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  };
  const [on, setOn] = useState(get);
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(query);
    } catch {
      return;
    }
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [query]);
  return on;
};
