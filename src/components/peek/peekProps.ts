import type { Player } from '@/types/player';

/** Fired when a quick-look action runs (detail { id, key }): an open search sheet closes for it */
export const PEEK_ACTION_EVENT = 'retrovault:peek-action';

type Peekable = Pick<Player, 'position' | 'name'> & { isRealLegend?: boolean };

/**
 * Spread on anything that shows a player to give it the press-and-hold quick look (PlayerPeek.tsx):
 * `<tr {...peekProps(player)}>`. Real NFL legends get nothing (they have no league card), and so does a missing player
 * (a name the data can't match), so a call site can pass whatever it has.
 */
export const peekProps = (p: Peekable | null | undefined) =>
  !p || p.isRealLegend || !p.position || !p.name ? {} : { 'data-player-key': `${p.position}:${p.name}` };

/** The same from a "POS:Name" key a component already carries (an unknown key is ignored by the quick look). */
export const peekKeyProps = (key: string | null | undefined) => (key && key.includes(':') ? { 'data-player-key': key } : {});
