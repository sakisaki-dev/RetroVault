import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import { useGamePool } from '@/utils/useOfficialOvr';

/**
 * "Include real NFL players" for the Analytics Lab and League Landscape: off by default, remembered per viewer
 * (localStorage, guarded), and kept in sync between every chart that reads it.
 */
const KEY = 'retroVault:labIncludeNFL';
const EVENT = 'retrovault:include-nfl';

const read = () => {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const useIncludeLegends = () => {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const set = useCallback((v: boolean) => {
    try {
      window.localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* private mode: the toggle still works for this page view */
    }
    setOn(v);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set] as const;
};

/** Real NFL legends to overlay (empty when the toggle is off). They never join any league baseline. */
export const useOverlayLegends = (): Player[] => {
  const [on] = useIncludeLegends();
  const { legends } = useGamePool();
  return useMemo(() => (on ? (legends as Player[]) : []), [on, legends]);
};
