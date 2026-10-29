import { useEffect, useLayoutEffect, useState } from 'react';

/** When .cd__flipper's spring curve (0.85s) passes 90deg: the moment the far face is hidden. */
const EDGE_ON_MS = 114;

/**
 * Which face a .cd__flipper shows, for its data-face attribute, and whether the back is mounted. The far face is hidden
 * outright once the card turns edge-on: iOS Safari doesn't reliably honour backface-visibility on faces with
 * blend-mode and animated layers (the finishes), and both faces flickered through each other. The back stays mounted
 * until the turn back to the front has finished, so it never goes blank mid-turn. A new `card` starts on the front
 * with no delay.
 */
export const useFlipFaces = (flipped: boolean, card: unknown) => {
  const [backFace, setBackFace] = useState(flipped);
  const [mounted, setMounted] = useState(flipped);
  useLayoutEffect(() => {
    setBackFace(false);
    setMounted(false);
  }, [card]);
  useEffect(() => {
    if (flipped) setMounted(true);
    let instant = false;
    try {
      instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* no matchMedia */
    }
    const turn = window.setTimeout(() => setBackFace(flipped), instant ? 0 : EDGE_ON_MS);
    const unmount = flipped ? 0 : window.setTimeout(() => setMounted(false), 900);
    return () => {
      window.clearTimeout(turn);
      window.clearTimeout(unmount);
    };
  }, [flipped]);
  return { face: backFace ? 'back' : 'front', backMounted: flipped || mounted } as const;
};
