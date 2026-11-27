import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/utils/motion';

/** When the spring curve passes 90deg: the moment the far face is hidden. */
const EDGE_ON_MS = 114;

/** The flip's length (collection.css `.cd__flipper` transition); data-turning holds for all of it. */
export const FLIP_MS = 850;

/**
 * Drives a 3D .cd__flipper: which face shows (data-face, switched when the card turns edge-on so the far face is hidden
 * outright instead of trusting backface-visibility), whether it is mid-turn (data-turning, for the whole flip: the CSS
 * switches blend modes and animated finish layers off meanwhile, which is what made iOS Safari flicker) and whether the
 * back is mounted. The back stays mounted until the turn back has finished. A new `card` starts on the front, still.
 */
export const useFlipFaces = (flipped: boolean, card: unknown) => {
  const [backFace, setBackFace] = useState(flipped);
  const [mounted, setMounted] = useState(flipped);
  const [turning, setTurning] = useState<'to-back' | 'to-front' | null>(null);
  const settled = useRef(flipped);
  useLayoutEffect(() => {
    setBackFace(false);
    setMounted(false);
    setTurning(null);
    settled.current = false;
  }, [card]);
  useEffect(() => {
    if (flipped === settled.current) return;
    settled.current = flipped;
    if (flipped) setMounted(true);
    let instant = false;
    try {
      instant = reducedMotion();
    } catch {
      /* no matchMedia */
    }
    if (!instant) setTurning(flipped ? 'to-back' : 'to-front');
    const swap = window.setTimeout(() => setBackFace(flipped), instant ? 0 : EDGE_ON_MS);
    const done = window.setTimeout(() => setTurning(null), instant ? 0 : FLIP_MS);
    const unmount = flipped ? 0 : window.setTimeout(() => setMounted(false), FLIP_MS + 50);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(done);
      window.clearTimeout(unmount);
    };
  }, [flipped]);
  return { face: backFace ? 'back' : 'front', turning, backMounted: flipped || mounted } as const;
};
