import { useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { canGoBackInApp, useHubRoute, type Route } from '@/components/stats/hub/hashRoute';
import { useSwipeToDismiss } from './useSwipeToDismiss';

/*
 * Swipe right to go back, for a page that feels like a pushed screen (the Deep Dive). The page follows the finger
 * (useSwipeToDismiss with `right`), a "Back" marker slides in behind it on the left, and past a third of the width or a
 * flick the page leaves and history goes back one page; else it springs back. Only from more than 24 px in from the
 * left edge (nearer is Safari's own Back swipe) and never on a sideways scroller or a zoomed chart. With no earlier page
 * of the app to return to (a deep link opened cold), it goes to `fallback` instead.
 */
export const usePageSwipeBack = <T extends HTMLElement>(fallback: Route, label = 'Back') => {
  const { navigate } = useHubRoute();
  const hintRef = useRef<HTMLDivElement>(null);
  const ref = useSwipeToDismiss<T>({
    down: false,
    right: true,
    reveal: () => hintRef.current,
    onDismiss: () => {
      if (canGoBackInApp()) window.history.back();
      else navigate(fallback, { replace: true });
    },
  });
  const hint = (
    <div ref={hintRef} className="swipe-back-hint" aria-hidden="true">
      <ChevronLeft className="h-5 w-5" />
      <span>{label}</span>
    </div>
  );
  return { ref, hint };
};
