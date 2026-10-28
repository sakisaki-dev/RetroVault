import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { loadLegends } from '@/utils/useOfficialOvr';

/*
 * Intent prefetch for the player card (PlayerDetailCard): on hover or touch-down of something that opens it, start
 * what the card loads from the network, so the tap finds it ready: the team logo at banner size (an ESPN image) and,
 * for a real-life legend, legends.json and his Commons photo. Each URL is fetched and decoded once per page load.
 * Nothing here computes card data: that is cheap per open and memoised in the card itself.
 */

const warmed = new Set<string>();

const preload = (url: string | undefined | null) => {
  if (!url || warmed.has(url) || typeof Image === 'undefined') return;
  warmed.add(url);
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.decoding = 'async';
  img.src = url;
  img.decode?.().catch(() => {});
};

export const warmPlayerCard = (player: Pick<Player, 'name' | 'position' | 'team'> & { isRealLegend?: boolean } | null | undefined) => {
  if (!player) return;
  preload(findNFLTeam(player.team)?.logoUrl);
  if (!player.isRealLegend) return;
  const carried = (player as { photo?: { url?: string } }).photo?.url;
  if (carried) return preload(carried);
  void loadLegends().then((list) => preload(list.find((l) => l.name === player.name && l.position === player.position)?.photo?.url));
};
