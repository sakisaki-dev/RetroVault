import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { completeSpotifyLogin } from '@/utils/spotify';
import { isNightRest, onScreensaverStart, saverSupported, useSaverIdle, useSaverNight } from '@/utils/screensaver';

const Screensaver = lazy(() => import('./Screensaver'));

const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

/**
 * Mounted once (pages/Index.tsx): starts the screensaver from the header button, or after the chosen idle minutes on a
 * desktop while the tab is visible. The screensaver itself is lazy, so nothing loads until it runs.
 */
const ScreensaverHost = () => {
  const [on, setOn] = useState(false);
  const idle = useSaverIdle();
  const night = useSaverNight();
  const last = useRef(Date.now());

  useEffect(() => onScreensaverStart(() => saverSupported() && setOn(true)), []);
  // back from Spotify's sign-in (the screensaver's now playing card): finish it and tidy the address
  useEffect(() => {
    void completeSpotifyLogin();
  }, []);

  useEffect(() => {
    if (on || !idle) return;
    last.current = Date.now();
    const bump = () => {
      last.current = Date.now();
    };
    ACTIVITY.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    const t = window.setInterval(() => {
      if (document.hidden || !saverSupported() || (night && isNightRest())) return bump();
      if (Date.now() - last.current >= idle * 60_000) setOn(true);
    }, 5_000);
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      window.clearInterval(t);
    };
  }, [idle, on, night]);

  const close = useCallback(() => setOn(false), []);
  if (!on) return null;
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black" aria-hidden="true" />}>
      <Screensaver onClose={close} />
    </Suspense>
  );
};

export default ScreensaverHost;
