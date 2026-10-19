import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { parseCSV } from '@/utils/csvParser';
import { getPlayerEdits, type PlayerEdit } from '@/utils/indexedDB';
import { normalizeLeague } from '@/config/stats';

interface LeagueContextType {
  /** League players with position-normalized metrics. Excludes real-life legends. */
  careerData: LeagueData | null;
  /** Real-life legends (isRealLegend), kept out of all league stats. Normalized with the league's factors. */
  legends: Player[];
  getAllPlayers: () => Player[];
  /** Triggers a refresh of all data (e.g., after player edits) */
  refreshData: () => void;
  /** Version counter to force re-renders when data changes */
  dataVersion: number;
  isLoading: boolean;
}

const LeagueContext = createContext<LeagueContextType | null>(null);

/**
 * Single source of truth: the league is always the bundled file built from data/y80 by
 * scripts/build_league_data.py. Nothing league-related is stored in the browser, so every
 * browser sees the same data; new data comes in by rebuilding that file.
 */
const LEAGUE_URL = '/data/initial-data.csv';

// Keys from earlier versions (uploaded sheets, cached league copies, per-season tracking).
const LEGACY_KEYS = [
  'retroVault:careerCsv',
  'retroVault:dataSource',
  'retroVault:careerBaseCsv',
  'retroVault:seasonSnapshots',
  'retroVault:prevCareerCsv',
  'retroVault:currentSeason',
  'retroVault:seasonHistory',
];

const clearLegacyKeys = () => {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage unavailable; nothing to clear
  }
};

const fetchLeagueCsv = async (): Promise<string> => {
  const res = await fetch(LEAGUE_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${LEAGUE_URL} (${res.status})`);
  return res.text();
};

// Merge player edits from IndexedDB into parsed league data
const mergePlayerEdits = async (baseData: LeagueData): Promise<LeagueData> => {
  try {
    const edits = await getPlayerEdits();
    if (!edits || Object.keys(edits).length === 0) return baseData;

    const mergedData: LeagueData = {
      quarterbacks: [...baseData.quarterbacks],
      runningbacks: [...baseData.runningbacks],
      widereceivers: [...baseData.widereceivers],
      tightends: [...baseData.tightends],
      offensiveline: [...baseData.offensiveline],
      linebackers: [...baseData.linebackers],
      defensivebacks: [...baseData.defensivebacks],
      defensiveline: [...baseData.defensiveline],
    };

    const positionArrayMap: Record<string, keyof LeagueData> = {
      QB: 'quarterbacks',
      RB: 'runningbacks',
      WR: 'widereceivers',
      TE: 'tightends',
      OL: 'offensiveline',
      LB: 'linebackers',
      DB: 'defensivebacks',
      DL: 'defensiveline',
    };

    Object.values(edits).forEach((edit: PlayerEdit) => {
      const arrayKey = positionArrayMap[edit.position];
      if (!arrayKey) return;

      const arr = mergedData[arrayKey] as Player[];
      const existingIndex = arr.findIndex((p) => p.name === edit.name && p.position === edit.position);

      const mergedPlayer: Player = {
        name: edit.name,
        position: edit.position as Player['position'],
        team: edit.team || '',
        nickname: edit.nickname,
        status: edit.status,
        games: edit.games,
        rings: edit.rings,
        mvp: edit.mvp,
        opoy: edit.opoy,
        sbmvp: edit.sbmvp,
        roty: edit.roty,
        trueTalent: edit.trueTalent,
        dominance: edit.dominance,
        careerLegacy: edit.careerLegacy,
        tpg: edit.tpg,
        ...edit.positionStats,
      } as Player;

      if (existingIndex >= 0) {
        // Merge: edit values override CSV values
        const existing = arr[existingIndex];
        // A blank team (or nickname) in an edit never erases the sheet's value.
        arr[existingIndex] = {
          ...existing,
          ...mergedPlayer,
          team: mergedPlayer.team || existing.team || '',
          nickname: mergedPlayer.nickname || existing.nickname,
        };
      } else if (edit.isManuallyAdded) {
        // Add new player
        arr.push(mergedPlayer);
      }
    });

    return mergedData;
  } catch (error) {
    console.error('Error merging player edits:', error);
    return baseData;
  }
};

const POSITION_KEYS: (keyof Omit<LeagueData, 'metadata'>)[] = [
  'quarterbacks',
  'runningbacks',
  'widereceivers',
  'tightends',
  'offensiveline',
  'linebackers',
  'defensivebacks',
  'defensiveline',
];

/**
 * Refits position normalization on the merged data (edits included; edit TT is treated as raw),
 * then splits real-life legends out of the league.
 */
const normalizeAndSplit = (data: LeagueData): { careerData: LeagueData; legends: Player[] } => {
  const all = POSITION_KEYS.flatMap((k) => data[k] as Player[]);
  const normalized = normalizeLeague(all);
  const byIdentity = new Map(all.map((p, i) => [p, normalized[i]]));

  const careerData = { ...data } as LeagueData;
  POSITION_KEYS.forEach((k) => {
    (careerData[k] as Player[]) = (data[k] as Player[])
      .map((p) => byIdentity.get(p) ?? p)
      .filter((p) => !p.isRealLegend);
  });
  return { careerData, legends: normalized.filter((p) => p.isRealLegend) };
};

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [careerData, setCareerData] = useState<LeagueData | null>(null);
  const [legends, setLegends] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const applyLeague = useCallback(async (csv: string) => {
    const result = normalizeAndSplit(await mergePlayerEdits(parseCSV(csv)));
    setCareerData(result.careerData);
    setLegends(result.legends);
  }, []);

  const rebuildDataFromStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      clearLegacyKeys();
      await applyLeague(await fetchLeagueCsv());
    } catch (error) {
      console.error('Error rebuilding data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applyLeague]);

  const refreshData = useCallback(() => {
    rebuildDataFromStorage().then(() => {
      setDataVersion((v) => v + 1);
    });
  }, [rebuildDataFromStorage]);

  useEffect(() => {
    rebuildDataFromStorage();
  }, [rebuildDataFromStorage]);

  const getAllPlayers = useCallback((): Player[] => {
    if (!careerData) return [];

    return [
      ...careerData.quarterbacks,
      ...careerData.runningbacks,
      ...careerData.widereceivers,
      ...careerData.tightends,
      ...careerData.offensiveline,
      ...careerData.linebackers,
      ...careerData.defensivebacks,
      ...careerData.defensiveline,
    ];
  }, [careerData]);

  return (
    <LeagueContext.Provider
      value={{
        careerData,
        legends,
        getAllPlayers,
        refreshData,
        dataVersion,
        isLoading,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
};

export const useLeague = () => {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
};
