import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { parseCSV } from '@/utils/csvParser';
import { diffLeagueData } from '@/utils/seasonDiff';
import {
  recordAllPlayersSeasonData,
  getPlayerSeasonHistory,
  loadSeasonHistory,
  saveSeasonHistory,
  type SeasonSnapshot,
} from '@/utils/seasonHistory';
import {
  getPlayerEdits,
  migrateFromLocalStorage,
  type PlayerEdit,
} from '@/utils/indexedDB';

interface LeagueContextType {
  careerData: LeagueData | null;
  seasonData: LeagueData | null;
  previousData: LeagueData | null;
  currentSeason: string;
  loadCareerData: (csvContent: string) => void;
  loadSeasonData: (csvContent: string, seasonName: string) => void;
  /** Purges the requested season AND any later seasons (they depend on it). Returns all removed season names. */
  purgeSeason: (seasonName: string) => string[];
  getAllPlayers: () => Player[];
  getSeasonHistory: (player: Player) => SeasonSnapshot[];
  getAvailableSeasons: () => string[];
  /** Triggers a refresh of all data (e.g., after player edits) */
  refreshData: () => void;
  /** Version counter to force re-renders when data changes */
  dataVersion: number;
  isLoading: boolean;
}

const LeagueContext = createContext<LeagueContextType | null>(null);

type SeasonCsvSnapshots = Record<string, string>;

const STORAGE_KEYS = {
  careerBaseCsv: 'retroVault:careerBaseCsv',
  seasonSnapshots: 'retroVault:seasonSnapshots',
  careerCsv: 'retroVault:careerCsv',
  prevCareerCsv: 'retroVault:prevCareerCsv',
  currentSeason: 'retroVault:currentSeason',
} as const;

const seasonNum = (season: string): number => {
  const n = parseInt((season || '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

const sortSeasonAsc = (a: string, b: string) => seasonNum(a) - seasonNum(b);

const loadSeasonSnapshots = (): SeasonCsvSnapshots => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.seasonSnapshots);
    return raw ? (JSON.parse(raw) as SeasonCsvSnapshots) : {};
  } catch {
    return {};
  }
};

const saveSeasonSnapshots = (snapshots: SeasonCsvSnapshots) => {
  try {
    localStorage.setItem(STORAGE_KEYS.seasonSnapshots, JSON.stringify(snapshots));
  } catch {
    // Ignore storage issues
  }
};

const getPrevCsvForSeason = (
  seasonName: string,
  snapshots: SeasonCsvSnapshots,
  baseCsv: string | null,
): string | null => {
  const target = seasonNum(seasonName);
  const seasons = Object.keys(snapshots).sort(sortSeasonAsc);
  const prevSeason = [...seasons].reverse().find((s) => seasonNum(s) < target);
  if (prevSeason) return snapshots[prevSeason] ?? null;
  return baseCsv;
};

const getLatestSeasonFromSnapshots = (snapshots: SeasonCsvSnapshots): string => {
  const seasons = Object.keys(snapshots).sort(sortSeasonAsc);
  return seasons[seasons.length - 1] || '';
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
        position: edit.position as any,
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
        arr[existingIndex] = { ...existing, ...mergedPlayer };
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

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [careerData, setCareerData] = useState<LeagueData | null>(null);
  const [seasonData, setSeasonData] = useState<LeagueData | null>(null);
  const [previousData, setPreviousData] = useState<LeagueData | null>(null);
  const [currentSeason, setCurrentSeason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  // Core function to rebuild all data from storage + edits
  const rebuildDataFromStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const baseCsv = localStorage.getItem(STORAGE_KEYS.careerBaseCsv);
      const snapshots = loadSeasonSnapshots();
      const savedSeason = localStorage.getItem(STORAGE_KEYS.currentSeason) || '';

      // New model: restore from per-season snapshots (most robust)
      if (Object.keys(snapshots).length > 0) {
        const seasonToRestore = savedSeason && snapshots[savedSeason] ? savedSeason : getLatestSeasonFromSnapshots(snapshots);
        const nextCsv = snapshots[seasonToRestore];
        const parsedData = parseCSV(nextCsv);
        const nextData = await mergePlayerEdits(parsedData);
        setCareerData(nextData);

        const prevCsv = getPrevCsvForSeason(seasonToRestore, snapshots, baseCsv);
        if (prevCsv) {
          const prevData = parseCSV(prevCsv);
          const mergedPrevData = await mergePlayerEdits(prevData);
          setPreviousData(mergedPrevData);
          setSeasonData(diffLeagueData(mergedPrevData, nextData));
          localStorage.setItem(STORAGE_KEYS.prevCareerCsv, prevCsv);
        } else {
          setPreviousData(null);
          setSeasonData(null);
          localStorage.removeItem(STORAGE_KEYS.prevCareerCsv);
        }

        setCurrentSeason(seasonToRestore);
        localStorage.setItem(STORAGE_KEYS.currentSeason, seasonToRestore);
        localStorage.setItem(STORAGE_KEYS.careerCsv, nextCsv);
        return;
      }

      // Legacy model fallback
      const savedCareer = localStorage.getItem(STORAGE_KEYS.careerCsv);
      const savedPrev = localStorage.getItem(STORAGE_KEYS.prevCareerCsv);

      if (savedCareer) {
        const parsedData = parseCSV(savedCareer);
        const mergedData = await mergePlayerEdits(parsedData);
        setCareerData(mergedData);
      }

      if (savedPrev) {
        const parsedPrev = parseCSV(savedPrev);
        const mergedPrev = await mergePlayerEdits(parsedPrev);
        setPreviousData(mergedPrev);
        // If base missing, use the earliest known baseline.
        if (!baseCsv) localStorage.setItem(STORAGE_KEYS.careerBaseCsv, savedPrev);
      }

      if (savedCareer && savedPrev) {
        const prev = await mergePlayerEdits(parseCSV(savedPrev));
        const next = await mergePlayerEdits(parseCSV(savedCareer));
        setSeasonData(diffLeagueData(prev, next));
        if (savedSeason) setCurrentSeason(savedSeason);
      } else {
        setCurrentSeason('');
      }
    } catch (error) {
      console.error('Error rebuilding data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh data function - rebuilds all data and increments version
  const refreshData = useCallback(() => {
    rebuildDataFromStorage().then(() => {
      setDataVersion((v) => v + 1);
    });
  }, [rebuildDataFromStorage]);

  // Initial data load
  useEffect(() => {
    rebuildDataFromStorage();
  }, [rebuildDataFromStorage]);

  const loadCareerData = useCallback(async (csvContent: string) => {
    setIsLoading(true);
    try {
      const parsedData = parseCSV(csvContent);
      const data = await mergePlayerEdits(parsedData);
      setCareerData(data);

      // Career upload = new baseline; clear any season diff context
      setSeasonData(null);
      setPreviousData(null);
      setCurrentSeason('');

      // Persist baseline + reset season chain (prevents "glitchy" mixed timelines)
      localStorage.setItem(STORAGE_KEYS.careerBaseCsv, csvContent);
      localStorage.setItem(STORAGE_KEYS.careerCsv, csvContent);
      localStorage.removeItem(STORAGE_KEYS.prevCareerCsv);
      localStorage.removeItem(STORAGE_KEYS.currentSeason);

      saveSeasonSnapshots({});
      saveSeasonHistory({});
      
      setDataVersion((v) => v + 1);
    } catch (error) {
      console.error('Error parsing CSV:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSeasonData = useCallback(async (csvContent: string, seasonName: string) => {
    setIsLoading(true);
    try {
      const baseCsv = localStorage.getItem(STORAGE_KEYS.careerBaseCsv);
      const snapshots = loadSeasonSnapshots();

      // If user is coming from older storage format, treat the current careerCsv as the baseline.
      const legacyCareerCsvAtStart = localStorage.getItem(STORAGE_KEYS.careerCsv);
      const inferredBaseCsv = !baseCsv && legacyCareerCsvAtStart && Object.keys(snapshots).length === 0
        ? legacyCareerCsvAtStart
        : baseCsv;

      // Choose previous snapshot by season number (works even after deleting + re-uploading)
      const prevCsv = getPrevCsvForSeason(seasonName, snapshots, inferredBaseCsv);
      const parsedNext = parseCSV(csvContent);
      const next = await mergePlayerEdits(parsedNext);

      setCurrentSeason(seasonName);
      localStorage.setItem(STORAGE_KEYS.currentSeason, seasonName);

      if (prevCsv) {
        const parsedPrev = parseCSV(prevCsv);
        const prev = await mergePlayerEdits(parsedPrev);
        setPreviousData(prev);

        const seasonDiff = diffLeagueData(prev, next);
        setSeasonData(seasonDiff);

        recordAllPlayersSeasonData(
          {
            quarterbacks: seasonDiff.quarterbacks,
            runningbacks: seasonDiff.runningbacks,
            widereceivers: seasonDiff.widereceivers,
            tightends: seasonDiff.tightends,
            offensiveline: seasonDiff.offensiveline,
            linebackers: seasonDiff.linebackers,
            defensivebacks: seasonDiff.defensivebacks,
            defensiveline: seasonDiff.defensiveline,
          },
          seasonName,
        );

        localStorage.setItem(STORAGE_KEYS.prevCareerCsv, prevCsv);
      } else {
        // No baseline available - this is the FIRST season upload
        // Treat all current career stats as the first season's stats (no diffing needed)
        // Create an "empty" baseline so we can diff properly
        const emptyBaseline: LeagueData = {
          quarterbacks: [],
          runningbacks: [],
          widereceivers: [],
          tightends: [],
          offensiveline: [],
          linebackers: [],
          defensivebacks: [],
          defensiveline: [],
        };
        
        setPreviousData(emptyBaseline);
        
        // Diff against empty baseline - all players become "new" and get their full stats as season stats
        const seasonDiff = diffLeagueData(emptyBaseline, next);
        setSeasonData(seasonDiff);
        
        // Record season history for all players
        recordAllPlayersSeasonData(
          {
            quarterbacks: seasonDiff.quarterbacks,
            runningbacks: seasonDiff.runningbacks,
            widereceivers: seasonDiff.widereceivers,
            tightends: seasonDiff.tightends,
            offensiveline: seasonDiff.offensiveline,
            linebackers: seasonDiff.linebackers,
            defensivebacks: seasonDiff.defensivebacks,
            defensiveline: seasonDiff.defensiveline,
          },
          seasonName,
        );
        
        localStorage.removeItem(STORAGE_KEYS.prevCareerCsv);
      }

      // Save snapshot for this season and mark as latest career state
      const updatedSnapshots: SeasonCsvSnapshots = { ...snapshots, [seasonName]: csvContent };
      saveSeasonSnapshots(updatedSnapshots);

      setCareerData(next);
      localStorage.setItem(STORAGE_KEYS.careerCsv, csvContent);

      // If we inferred a base, persist it for future operations
      if (inferredBaseCsv && !baseCsv) {
        localStorage.setItem(STORAGE_KEYS.careerBaseCsv, inferredBaseCsv);
      }
      
      setDataVersion((v) => v + 1);
    } catch (error) {
      console.error('Error parsing season CSV:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const purgeSeason = useCallback((seasonName: string): string[] => {
    const target = seasonNum(seasonName);

    // 1) Remove CSV snapshots for this season AND any later seasons
    const snapshots = loadSeasonSnapshots();
    const allSeasons = Object.keys(snapshots);
    const removedSeasons = allSeasons
      .filter((s) => seasonNum(s) >= target)
      .sort(sortSeasonAsc);

    const remainingSnapshots: SeasonCsvSnapshots = {};
    allSeasons.forEach((s) => {
      if (seasonNum(s) < target) remainingSnapshots[s] = snapshots[s];
    });
    saveSeasonSnapshots(remainingSnapshots);

    // 2) Purge season-history stats for removed seasons
    const history = loadSeasonHistory();
    const removedSet = new Set(removedSeasons);
    Object.keys(history).forEach((key) => {
      history[key] = history[key].filter((snap) => !removedSet.has(snap.season));
      if (history[key].length === 0) delete history[key];
    });
    saveSeasonHistory(history);

    // 3) Roll back the app's "current career" state to the latest remaining snapshot (or baseline)
    const baseCsv = localStorage.getItem(STORAGE_KEYS.careerBaseCsv);
    const latestRemainingSeason = getLatestSeasonFromSnapshots(remainingSnapshots);
    const rollbackCsv = latestRemainingSeason ? remainingSnapshots[latestRemainingSeason] : baseCsv;

    setSeasonData(null);
    setPreviousData(null);
    localStorage.removeItem(STORAGE_KEYS.prevCareerCsv);

    if (rollbackCsv) {
      const parsedData = parseCSV(rollbackCsv);
      mergePlayerEdits(parsedData).then((merged) => {
        setCareerData(merged);
        setDataVersion((v) => v + 1);
      });
      localStorage.setItem(STORAGE_KEYS.careerCsv, rollbackCsv);
    } else {
      setCareerData(null);
      localStorage.removeItem(STORAGE_KEYS.careerCsv);
    }

    setCurrentSeason(latestRemainingSeason);
    if (latestRemainingSeason) {
      localStorage.setItem(STORAGE_KEYS.currentSeason, latestRemainingSeason);
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentSeason);
    }

    return removedSeasons;
  }, []);

  const getAvailableSeasons = useCallback((): string[] => {
    const snapshots = loadSeasonSnapshots();
    const allSeasons = new Set<string>(Object.keys(snapshots));

    // Back-compat: also include anything present in seasonHistory
    const history = loadSeasonHistory();
    Object.values(history).forEach((snaps) => {
      snaps.forEach((s) => allSeasons.add(s.season));
    });

    return Array.from(allSeasons).sort(sortSeasonAsc);
  }, []);

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

  const getSeasonHistory = useCallback((player: Player): SeasonSnapshot[] => {
    return getPlayerSeasonHistory(player);
  }, []);

  return (
    <LeagueContext.Provider
      value={{
        careerData,
        seasonData,
        previousData,
        currentSeason,
        loadCareerData,
        loadSeasonData,
        purgeSeason,
        getAllPlayers,
        getSeasonHistory,
        getAvailableSeasons,
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
