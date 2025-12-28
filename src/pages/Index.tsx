import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import CareerTab from '@/components/tabs/CareerTab';
import SeasonTab from '@/components/tabs/SeasonTab';
import CommentaryTab from '@/components/tabs/CommentaryTab';
import HallOfFameTab from '@/components/tabs/HallOfFameTab';
import RecordsTab from '@/components/tabs/RecordsTab';
import TeamRankingsTab from '@/components/tabs/TeamRankingsTab';
import ComparisonTab from '@/components/tabs/ComparisonTab';
import { LeagueProvider, useLeague } from '@/context/LeagueContext';
import { Helmet } from 'react-helmet-async';

const IndexContent = () => {
  const [activeTab, setActiveTab] = useState('career');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDataCleared = () => {
    // Force a re-render by updating key and reloading the page
    setRefreshKey((k) => k + 1);
    window.location.reload();
  };

  return (
    <>
      <Helmet>
        <title>Retro Vault | League Analytics</title>
        <meta name="description" content="Track your Retro Bowl league stats with dynamic color-coded metrics, statistical leaders, and AI-powered commentary." />
      </Helmet>
      
      <div className="min-h-screen flex flex-col">
        <Header activeTab={activeTab} onTabChange={setActiveTab} onDataCleared={handleDataCleared} />
        
        <main className="flex-1">
          {activeTab === 'career' && <CareerTab />}
          {activeTab === 'season' && <SeasonTab />}
          {activeTab === 'teams' && <TeamRankingsTab />}
          {activeTab === 'hof' && <HallOfFameTab />}
          {activeTab === 'records' && <RecordsTab />}
          {activeTab === 'compare' && <ComparisonTab />}
          {activeTab === 'commentary' && <CommentaryTab />}
        </main>

        <footer className="glass-card border-t border-border/30 py-6 mt-8">
          <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
            <p>
              <span className="font-display text-lg tracking-wider">RETRO VAULT</span> • 
              Retro Bowl League Analytics
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

const Index = () => {
  return (
    <LeagueProvider>
      <IndexContent />
    </LeagueProvider>
  );
};

export default Index;
