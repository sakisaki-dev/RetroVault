/**
 * Opens a player's card (PlayerDetailCard) from anywhere: a tap on a stadium figure or a ticker name (owner: "always
 * open the player card, then we can decide if we want the deep dive"). The quick-look layer (peek/PlayerPeek.tsx, loaded
 * by a LazyHost that this event wakes) shows it; a request made before that chunk arrives waits in `pending`.
 */
export const OPEN_PLAYER_CARD_EVENT = 'rv:open-player-card';
let pending: string | null = null;
export const takePendingCard = () => {
  const k = pending;
  pending = null;
  return k;
};
export const openPlayerCard = (key: string) => {
  pending = key;
  window.dispatchEvent(new CustomEvent(OPEN_PLAYER_CARD_EVENT, { detail: { key } }));
};
