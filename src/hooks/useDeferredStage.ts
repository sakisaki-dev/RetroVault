import { useEffect, useState } from 'react';
import { isMobileMotion, reducedMotion } from '@/utils/motion';

/*
 * Shell-first rendering for dialogs. The tap's own task should only build what the first frame shows (the frame, the
 * header, the card); heavy sections mount in the frames after it, while the open animation (transform and opacity,
 * on the compositor) is already running. Callers reserve the space of what is still to come, so nothing moves when
 * it fills in.
 */

/** Runs `cb` once the next frame has been painted (a rAF, then a task), or after `fallbackMs` when no frame comes (background tab). */
export const afterPaint = (cb: () => void, fallbackMs = 120): (() => void) => {
  let done = false;
  let timer = 0;
  const run = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    window.clearTimeout(safety);
    cancelAnimationFrame(raf);
    cb();
  };
  // rAF callbacks run just before the frame is painted; the task queued from there runs after it
  const raf = requestAnimationFrame(() => {
    timer = window.setTimeout(run, 0);
  });
  const safety = window.setTimeout(run, fallbackMs);
  return () => {
    done = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    window.clearTimeout(safety);
  };
};

/** How long heavy content waits while a dialog / sheet opens (phones open over ~480-500 ms, desktop ~280 ms) */
const PHONE_OPEN_HOLD_MS = 380;
const DESKTOP_OPEN_HOLD_MS = 220;

/**
 * 0 on the render where `active` turns true (and on a first mount that is already active), then 1, 2, … one per
 * painted frame, up to `stages`. Stays where it is while inactive. `finish()` jumps to the last stage at once, before
 * the first paint when called from a layout effect (for a caller that finds it cannot reserve the space and must
 * render everything now). `late`: the content came in after the first frame, so it may fade in.
 */
export const useDeferredStage = (active: boolean, stages = 1): { stage: number; late: boolean; finish: () => void } => {
  const [stage, setStage] = useState(0);
  const [eager, setEager] = useState(false);
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    // Adjusted during render, so the opening render itself is already the shell (no extra commit)
    setWasActive(active);
    if (active) {
      if (stage !== 0) setStage(0);
      if (eager) setEager(false);
    }
  }
  useEffect(() => {
    if (!active || stage >= stages) return;
    const next = () => setStage((s) => Math.min(stages, Math.max(s, stage + 1)));
    // The first heavy render waits until the opening has nearly landed (its last stretch barely moves), so a long
    // render never lands mid-animation and costs the opening its frames
    if (stage === 0 && !reducedMotion()) {
      let cancel = () => {};
      const timer = window.setTimeout(() => {
        cancel = afterPaint(next);
      }, isMobileMotion() ? PHONE_OPEN_HOLD_MS : DESKTOP_OPEN_HOLD_MS);
      return () => {
        window.clearTimeout(timer);
        cancel();
      };
    }
    return afterPaint(next);
  }, [active, stage, stages]);
  return {
    stage,
    late: stage > 0 && !eager,
    finish: () => {
      setEager(true);
      setStage(stages);
    },
  };
};
