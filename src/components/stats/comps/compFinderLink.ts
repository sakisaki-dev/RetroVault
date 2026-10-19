import type { Player } from '@/types/player';

/**
 * Navigation contract for the Comp Finder (and its Head-to-Head hand-off).
 *
 * Opening the Comp Finder on a player, from anywhere (player card, Stats hub search, Map page):
 *   openInCompFinder(player)
 *     → stores the key "POS:Name" as a pending request (kept until a Comp Finder consumes it, so it survives
 *       the Stats tab / Comps sub-tab mounting after the event), then
 *     → dispatches `window` CustomEvent 'retrovault:open-comp-finder' with detail { key: "POS:Name" }.
 *   Routers listen with onCompFinderRequest(cb) (cb gets the key) and show the Comps view
 *   (hash form: #stats/comps?p=POS:Name). A mounted <CompFinder> consumes the request itself
 *   (takeCompFinderRequest); it also accepts `initialPlayerKey` (e.g. the hash's `p`) and reports user
 *   selections through `onPlayerChange(key)` so a router can keep the hash in sync.
 *
 * "Compare in Head-to-Head" from a comp row:
 *   <CompFinder onCompare={(a, b) => …}> if given; otherwise openInHeadToHead(a, b), which dispatches
 *   'retrovault:open-head-to-head' with detail { a: "POS:Name", b: "POS:Name" } and keeps it pending
 *   (takeHeadToHeadRequest) for a Head-to-Head view to consume.
 */
export const COMP_FINDER_EVENT = 'retrovault:open-comp-finder';
export const HEAD_TO_HEAD_EVENT = 'retrovault:open-head-to-head';

const keyFor = (p: Pick<Player, 'position' | 'name'>) => `${p.position}:${p.name}`;

let pending: string | null = null;
let pendingH2H: { a: string; b: string } | null = null;

export const openInCompFinder = (p: Pick<Player, 'position' | 'name'>) => {
  pending = keyFor(p);
  window.dispatchEvent(new CustomEvent(COMP_FINDER_EVENT, { detail: { key: pending } }));
};

/** Returns and clears the pending player key, if any. */
export const takeCompFinderRequest = (): string | null => {
  const key = pending;
  pending = null;
  return key;
};

/** Subscribes to open requests (cb receives the player key); returns the unsubscribe function. */
export const onCompFinderRequest = (cb: (key: string) => void) => {
  const h = (e: Event) => cb(((e as CustomEvent<{ key: string }>).detail?.key ?? '') as string);
  window.addEventListener(COMP_FINDER_EVENT, h);
  return () => window.removeEventListener(COMP_FINDER_EVENT, h);
};

export const openInHeadToHead = (a: Pick<Player, 'position' | 'name'>, b: Pick<Player, 'position' | 'name'>) => {
  pendingH2H = { a: keyFor(a), b: keyFor(b) };
  window.dispatchEvent(new CustomEvent(HEAD_TO_HEAD_EVENT, { detail: pendingH2H }));
};

export const takeHeadToHeadRequest = () => {
  const r = pendingH2H;
  pendingH2H = null;
  return r;
};

export const onHeadToHeadRequest = (cb: (pair: { a: string; b: string }) => void) => {
  const h = (e: Event) => cb((e as CustomEvent<{ a: string; b: string }>).detail);
  window.addEventListener(HEAD_TO_HEAD_EVENT, h);
  return () => window.removeEventListener(HEAD_TO_HEAD_EVENT, h);
};
