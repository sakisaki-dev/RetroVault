import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** The flip's length (collection.css `cd-turn`); the faces swap halfway, when the card is edge-on. */
export const FLIP_MS = 420;

/**
 * Drives a .cd__flipper: which face shows (its data-face attribute), whether it is mid-turn (data-turning, which runs
 * the squeeze animation) and whether the back is mounted. The flip is flat on purpose: the card squeezes to its edge,
 * swaps faces and opens again. The old 3D rotateY flip relied on backface-visibility, which iOS Safari doesn't honour
 * on faces with blend-mode and animated layers (the finishes, the tilt), so both faces flickered through each other.
 * The back stays mounted until the turn back to the front has finished. A new `card` starts on the front, still.
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
      instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* no matchMedia */
    }
    if (!instant) setTurning(flipped ? 'to-back' : 'to-front');
    const swap = window.setTimeout(() => setBackFace(flipped), instant ? 0 : FLIP_MS / 2);
    const done = window.setTimeout(() => setTurning(null), instant ? 0 : FLIP_MS);
    const unmount = flipped ? 0 : window.setTimeout(() => setMounted(false), FLIP_MS + 60);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(done);
      window.clearTimeout(unmount);
    };
  }, [flipped]);
  return { face: backFace ? 'back' : 'front', turning, backMounted: flipped || mounted } as const;
};
