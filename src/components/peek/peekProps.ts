import type { Player } from '@/types/player';

/** Fired when a quick-look action runs (detail { id, key }): an open search sheet closes for it */
export const PEEK_ACTION_EVENT = 'retrovault:peek-action';

/**
 * Spread on anything that shows a player to give it the press-and-hold quick look (PlayerPeek.tsx):
 * `<tr {...peekProps(player)}>`. Real NFL legends get nothing (they have no league card).
 */
export const peekProps = (p: Pick<Player, 'position' | 'name'> & { isRealLegend?: boolean }) =>
  p.isRealLegend ? {} : { 'data-player-key': `${p.position}:${p.name}` };
