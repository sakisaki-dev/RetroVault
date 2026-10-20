import { fmtPct, type Mover } from '@/utils/cardMarket';
import type { CardInfo } from '../useCardPool';

/** A player's market row: latest base value, change over the chosen period, value history. */
export interface MarketRow extends Mover {
  info: CardInfo;
  /** Base value at every snapshot he is listed in, oldest first */
  spark: number[];
}

export const dirOf = (change: number) => (change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat');

/** "▲ +4.2%" for text contexts (labels, tiles). */
export const changeText = (c: number) => `${dirOf(c) === 'up' ? '▲' : dirOf(c) === 'down' ? '▼' : '■'} ${fmtPct(c)}`;
