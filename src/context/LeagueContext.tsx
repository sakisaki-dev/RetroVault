import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { parseCSV } from '@/utils/csvParser';
import { diffLeagueData } from '@/utils/seasonDiff';
import { recordAllPlayersSeasonData, getPlayerSeasonHistory, loadSeasonHistory, saveSeasonHistory, type SeasonSnapshot } from '@/utils/seasonHistory';

interface LeagueContextType {
  careerData: LeagueData | null;
  seasonData: LeagueData | null;
  previousData: LeagueData | null;
  currentSeason: string;
  loadCareerData: (csvContent: string) => void;
  loadSeasonData: (csvContent: string, seasonName: string) => void;
  purgeSeason: (seasonName: string) => void;
  getAllPlayers: () => Player[];
  getSeasonHistory: (player: Player) => SeasonSnapshot[];
  getAvailableSeasons: () => string[];
  isLoading: boolean;
}

const LeagueContext = createContext<LeagueContextType | null>(null);

const STORAGE_KEYS = {
  careerCsv: 'retroVault:careerCsv',
  prevCareerCsv: 'retroVault:prevCareerCsv',
  currentSeason: 'retroVault:currentSeason',
} as const;

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [careerData, setCareerData] = useState<LeagueData | null>(null);
  const [seasonData, setSeasonData] = useState<LeagueData | null>(null);
  const [previousData, setPreviousData] = useState<LeagueData | null>(null);
  const [currentSeason, setCurrentSeason] = useState<string>('Y30');
  const [isLoading, setIsLoading] = useState(false);

  // Restore last session (keeps the app usable locally with just CSV inputs)
  useEffect(() => {
    try {
      const savedSeason = localStorage.getItem(STORAGE_KEYS.currentSeason);
      
      const savedCareer = localStorage.getItem(STORAGE_KEYS.careerCsv);
      if (savedCareer) {
        setCareerData(parseCSV(savedCareer));
      }

      const savedPrev = localStorage.getItem(STORAGE_KEYS.prevCareerCsv);
      if (savedPrev) {
        setPreviousData(parseCSV(savedPrev));
      }

      // If both exist, compute season diff for commentary.
      if (savedCareer && savedPrev) {
        const prev = parseCSV(savedPrev);
        const next = parseCSV(savedCareer);
        setSeasonData(diffLeagueData(prev, next));
        // Only set current season if we have valid season data
        if (savedSeason) setCurrentSeason(savedSeason);
      } else {
        // No season data, clear current season
        setCurrentSeason('');
      }
    } catch {
      // Ignore storage issues
    }
  }, []);

  const loadCareerData = useCallback((csvContent: string) => {
    setIsLoading(true);
    try {
      const data = parseCSV(csvContent);
      setCareerData(data);
      setSeasonData(null);
      setPreviousData(null);

      localStorage.setItem(STORAGE_KEYS.careerCsv, csvContent);
      localStorage.removeItem(STORAGE_KEYS.prevCareerCsv);
    } catch (error) {
      console.error('Error parsing CSV:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSeasonData = useCallback(
    (csvContent: string, seasonName: string) => {
      setIsLoading(true);
      try {
        const prev = careerData;
        const next = parseCSV(csvContent);

        setCurrentSeason(seasonName);
        localStorage.setItem(STORAGE_KEYS.currentSeason, seasonName);

        if (prev) {
          setPreviousData(prev);
          const seasonDiff = diffLeagueData(prev, next);
          setSeasonData(seasonDiff);

          // Record season stats for each player
          recordAllPlayersSeasonData({
            quarterbacks: seasonDiff.quarterbacks,
            runningbacks: seasonDiff.runningbacks,
            widereceivers: seasonDiff.widereceivers,
            tightends: seasonDiff.tightends,
            offensiveline: seasonDiff.offensiveline,
            linebackers: seasonDiff.linebackers,
            defensivebacks: seasonDiff.defensivebacks,
            defensiveline: seasonDiff.defensiveline,
          }, seasonName);

          const prevCsv = localStorage.getItem(STORAGE_KEYS.careerCsv);
          if (prevCsv) localStorage.setItem(STORAGE_KEYS.prevCareerCsv, prevCsv);
        }

        setCareerData(next);
        localStorage.setItem(STORAGE_KEYS.careerCsv, csvContent);
      } catch (error) {
        console.error('Error parsing season CSV:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [careerData],
  );

  const purgeSeason = useCallback((seasonName: string) => {
    // Remove from season history storage
    const history = loadSeasonHistory();
    Object.keys(history).forEach((key) => {
      history[key] = history[key].filter((s) => s.season !== seasonName);
      if (history[key].length === 0) {
        delete history[key];
      }
    });
    saveSeasonHistory(history);

    // Always clear season-specific state when purging any season
    // This forces a fresh recalculation on next upload
    setSeasonData(null);
    setPreviousData(null);
    localStorage.removeItem(STORAGE_KEYS.prevCareerCsv);
    
    // Find the most recent remaining season
    const remainingSeasons = new Set<string>();
    Object.values(history).forEach((snapshots) => {
      snapshots.forEach((s) => remainingSeasons.add(s.season));
    });
    
    const sortedSeasons = Array.from(remainingSeasons).sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      return bNum - aNum;
    });
    
    // Update current season to most recent or clear if none
    const newCurrentSeason = sortedSeasons[0] || '';
    setCurrentSeason(newCurrentSeason);
    if (newCurrentSeason) {
      localStorage.setItem(STORAGE_KEYS.currentSeason, newCurrentSeason);
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentSeason);
    }
  }, []);

  const getAvailableSeasons = useCallback((): string[] => {
    const history = loadSeasonHistory();
    const allSeasons = new Set<string>();
    
    // Add seasons from history
    Object.values(history).forEach((snapshots) => {
      snapshots.forEach((s) => allSeasons.add(s.season));
    });
    
    // Also include current season if it exists and has season data
    if (currentSeason && seasonData) {
      allSeasons.add(currentSeason);
    }
    
    return Array.from(allSeasons).sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });
  }, [currentSeason, seasonData]);

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
