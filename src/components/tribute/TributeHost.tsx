import { Suspense, lazy, useEffect, useState } from 'react';
import { OPEN_TRIBUTE_EVENT, takePendingTribute } from './openTribute';

// The view (and its CSS) loads only when a tribute is first opened
const TributeView = lazy(() => import('./TributeView'));

/**
 * Mount once (pages/Index.tsx). Answers openTribute(key) from anywhere with the tribute's reading sheet. The sheet's
 * code loads on the first open; until it is in, a small loader fades in after ~150 ms (never a blank pop). Closing
 * keeps the last tribute mounted so the sheet plays its exit.
 */
const TributeHost = () => {
  const [state, setState] = useState<{ key: string | null; open: boolean }>({ key: null, open: false });
  useEffect(() => {
    const first = takePendingTribute();
    if (first) setState({ key: first, open: true });
    const on = (e: Event) => {
      takePendingTribute();
      setState({ key: String((e as CustomEvent).detail), open: true });
    };
    window.addEventListener(OPEN_TRIBUTE_EVENT, on);
    return () => window.removeEventListener(OPEN_TRIBUTE_EVENT, on);
  }, []);
  if (!state.key) return null;
  return (
    <Suspense
      fallback={
        state.open ? (
          <div className="rv-fallback pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center" role="status" aria-live="polite">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/95 px-4 py-2 text-sm text-muted-foreground shadow-lg">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gold motion-reduce:animate-none" aria-hidden="true" /> Opening the tribute…
            </span>
          </div>
        ) : null
      }
    >
      <TributeView playerKey={state.key} open={state.open} onClose={() => setState((s) => ({ ...s, open: false }))} />
    </Suspense>
  );
};

export default TributeHost;
