import React, { createContext, useContext, useState, useCallback } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { parseCSV } from '@/utils/csvParser';

interface LeagueContextType {
  careerData: LeagueData | null;
  seasonData: LeagueData | null;
  previousData: LeagueData | null;
  currentSeason: string;
  loadCareerData: (csvContent: string) => void;
  loadSeasonData: (csvContent: string, seasonName: string) => void;
  getAllPlayers: () => Player[];
  isLoading: boolean;
}

const LeagueContext = createContext<LeagueContextType | null>(null);

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [careerData, setCareerData] = useState<LeagueData | null>(null);
  const [seasonData, setSeasonData] = useState<LeagueData | null>(null);
  const [previousData, setPreviousData] = useState<LeagueData | null>(null);
  const [currentSeason, setCurrentSeason] = useState<string>('Y30');
  const [isLoading, setIsLoading] = useState(false);

  const loadCareerData = useCallback((csvContent: string) => {
    setIsLoading(true);
    try {
      const data = parseCSV(csvContent);
      setCareerData(data);
    } catch (error) {
      console.error('Error parsing CSV:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSeasonData = useCallback((csvContent: string, seasonName: string) => {
    setIsLoading(true);
    try {
      // Store previous data for comparison
      if (careerData) {
        setPreviousData(careerData);
      }
      
      const newData = parseCSV(csvContent);
      setCareerData(newData);
      setCurrentSeason(seasonName);
      
      // Calculate season stats as difference
      if (previousData) {
        // This would calculate the diff - for now just store the new data
        setSeasonData(newData);
      }
    } catch (error) {
      console.error('Error parsing season CSV:', error);
    } finally {
      setIsLoading(false);
    }
  }, [careerData, previousData]);

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
    <LeagueContext.Provider value={{
      careerData,
      seasonData,
      previousData,
      currentSeason,
      loadCareerData,
      loadSeasonData,
      getAllPlayers,
      isLoading,
    }}>
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
