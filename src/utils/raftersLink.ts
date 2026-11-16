/**
 * Opening a club's rafters from anywhere (the player card's retired-number strip and hanging banner): the Hall of Fame
 * tab's Rafters section with that club picked. openRafters(clubId) keeps the request pending until the section takes it
 * (so it survives the tab mounting after the event) and dispatches a window event; pages/Index.tsx answers by switching
 * to the Hall of Fame tab, and a mounted section by picking the club and scrolling to itself.
 */
export const RAFTERS_EVENT = 'rv:open-rafters';
/** The section's anchor (BottomNav's Hall of Fame sections use it too) */
export const RAFTERS_ANCHOR = 'hof-rafters-title';

let pending: string | null = null;

/** Open the rafters of a club (NFL team id, "eagles") */
export const openRafters = (clubId: string) => {
  pending = clubId;
  window.dispatchEvent(new CustomEvent(RAFTERS_EVENT, { detail: clubId }));
};

/** The pending request, if any (read once) */
export const takeRaftersRequest = (): string | null => {
  const id = pending;
  pending = null;
  return id;
};

/** Listen for requests (Index switches tabs); returns the unsubscribe */
export const onRaftersRequest = (cb: (clubId: string) => void) => {
  const on = (e: Event) => cb(String((e as CustomEvent).detail));
  window.addEventListener(RAFTERS_EVENT, on);
  return () => window.removeEventListener(RAFTERS_EVENT, on);
};
