import type { Player, QBPlayer, RBPlayer, WRPlayer, TEPlayer, LBPlayer, DBPlayer, DLPlayer } from '@/types/player';

const STORAGE_KEY = 'retroVault:seasonHistory';

export interface SeasonSnapshot {
  season: string;
  games: number;
  rings?: number;
  mvp?: number;
  opoy?: number;
  sbmvp?: number;
  roty?: number;
  // QB stats
  passYds?: number;
  passTD?: number;
  interceptions?: number;
  rushYds?: number;
  rushTD?: number;
  // RB stats
  rushAtt?: number;
  recYds?: number;
  recTD?: number;
  // WR/TE stats
  receptions?: number;
  // Defensive stats
  tackles?: number;
  sacks?: number;
  forcedFumbles?: number;
}

export interface PlayerSeasonHistory {
  [playerKey: string]: SeasonSnapshot[];
}

function getPlayerKey(player: Player): string {
  return `${player.position}:${player.name}`;
}

export function loadSeasonHistory(): PlayerSeasonHistory {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveSeasonHistory(history: PlayerSeasonHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    console.error('Failed to save season history');
  }
}

export function recordSeasonForPlayer(
  player: Player,
  seasonName: string,
  seasonStats: Partial<Player>
): void {
  const history = loadSeasonHistory();
  const key = getPlayerKey(player);

  if (!history[key]) {
    history[key] = [];
  }

  // Don't duplicate seasons
  const existing = history[key].find((s) => s.season === seasonName);
  if (existing) return;

  const snapshot: SeasonSnapshot = {
    season: seasonName,
    games: (seasonStats as any).games || 0,
    rings: (seasonStats as any).rings || 0,
    mvp: (seasonStats as any).mvp || 0,
    opoy: (seasonStats as any).opoy || 0,
    sbmvp: (seasonStats as any).sbmvp || 0,
    roty: (seasonStats as any).roty || 0,
  };

  // Add position-specific stats
  const pos = player.position;
  if (pos === 'QB') {
    const qb = seasonStats as Partial<QBPlayer>;
    snapshot.passYds = qb.passYds || 0;
    snapshot.passTD = qb.passTD || 0;
    snapshot.interceptions = qb.interceptions || 0;
    snapshot.rushYds = qb.rushYds || 0;
    snapshot.rushTD = qb.rushTD || 0;
  } else if (pos === 'RB') {
    const rb = seasonStats as Partial<RBPlayer>;
    snapshot.rushYds = rb.rushYds || 0;
    snapshot.rushTD = rb.rushTD || 0;
    snapshot.rushAtt = rb.rushAtt || 0;
    snapshot.recYds = rb.recYds || 0;
    snapshot.recTD = rb.recTD || 0;
  } else if (pos === 'WR' || pos === 'TE') {
    const rec = seasonStats as Partial<WRPlayer | TEPlayer>;
    snapshot.recYds = rec.recYds || 0;
    snapshot.recTD = rec.recTD || 0;
    snapshot.receptions = rec.receptions || 0;
  } else if (['LB', 'DB', 'DL'].includes(pos)) {
    const def = seasonStats as Partial<LBPlayer | DBPlayer | DLPlayer>;
    snapshot.tackles = def.tackles || 0;
    snapshot.sacks = def.sacks || 0;
    snapshot.interceptions = def.interceptions || 0;
    snapshot.forcedFumbles = def.forcedFumbles || 0;
  }

  history[key].push(snapshot);
  // Sort by season (Y1, Y2, etc.)
  history[key].sort((a, b) => {
    const aNum = parseInt(a.season.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.season.replace(/\D/g, '')) || 0;
    return aNum - bNum;
  });

  saveSeasonHistory(history);
}

export function getPlayerSeasonHistory(player: Player): SeasonSnapshot[] {
  const history = loadSeasonHistory();
  const key = getPlayerKey(player);
  return history[key] || [];
}

export function recordAllPlayersSeasonData(
  seasonData: { [key: string]: Player[] },
  seasonName: string
): void {
  const allPlayers = Object.values(seasonData).flat();
  allPlayers.forEach((player) => {
    if ((player as any).games > 0) {
      recordSeasonForPlayer(player, seasonName, player);
    }
  });
}
