/**
 * Opening a Player Tribute from anywhere (the player card, the Deep Dive hero, a Hall of Fame plaque): a window event
 * that TributeHost (mounted once in pages/Index.tsx) answers. A request made before the host mounts waits for it.
 */
export const OPEN_TRIBUTE_EVENT = 'rv:open-tribute';

let pending: string | null = null;

/** Open the tribute of a player ("POS:Name") */
export const openTribute = (key: string) => {
  pending = key;
  window.dispatchEvent(new CustomEvent(OPEN_TRIBUTE_EVENT, { detail: key }));
};

/** The request made before the host mounted (read once) */
export const takePendingTribute = (): string | null => {
  const k = pending;
  pending = null;
  return k;
};

/** Warm the tribute view's code (a hover or focus on a Tribute button) so the tap opens it at once */
export const prefetchTributeView = () => {
  void import('./TributeView');
};
