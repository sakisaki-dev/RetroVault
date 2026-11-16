import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import PixelLoader from '@/components/ui/PixelLoader';
import { OPEN_RIVALRY_EVENT, takePendingRivalry } from '@/utils/rivalryFiles';

// The sheet (and its CSS, the player card it opens) loads only when a file is first opened
const RivalryFileSheet = lazy(() => import('./RivalryFileSheet'));

/**
 * Mount once (pages/Index.tsx). Answers openRivalryFile(id) from anywhere with the file as a phone sheet; a story or
 * take in its "In the papers" opens on the Timeline (`onTimeline` switches to it). Closing keeps the last file mounted
 * so the sheet plays its exit.
 */
const RivalryHost = ({ onTimeline }: { onTimeline: () => void }) => {
  const [state, setState] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });
  useEffect(() => {
    const first = takePendingRivalry();
    if (first) setState({ id: first, open: true });
    const on = (e: Event) => {
      takePendingRivalry();
      setState({ id: String((e as CustomEvent).detail), open: true });
    };
    window.addEventListener(OPEN_RIVALRY_EVENT, on);
    return () => window.removeEventListener(OPEN_RIVALRY_EVENT, on);
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  if (!state.id) return null;
  return (
    <Suspense fallback={state.open ? <PixelLoader variant="overlay" label="Files" what="the rivalry file" /> : null}>
      <RivalryFileSheet id={state.id} open={state.open} onClose={close} onTimeline={onTimeline} />
    </Suspense>
  );
};

export default RivalryHost;
