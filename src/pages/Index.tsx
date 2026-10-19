import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import CareerTab from '@/components/tabs/CareerTab';
import HallOfFameTab from '@/components/tabs/HallOfFameTab';
import TeamRankingsTab from '@/components/tabs/TeamRankingsTab';
import GamesTab from '@/components/tabs/GamesTab';
import TimelineTab from '@/components/tabs/TimelineTab';
import FrontOfficeTab from '@/components/tabs/FrontOfficeTab';
import CollectionTab from '@/components/tabs/CollectionTab';
import CardUnlockToasts from '@/components/collection/CardUnlockToasts';
import CeremonyHost from '@/components/ceremony/CeremonyHost';
import { DATA_SOURCE_KEY, LeagueProvider, isBundledLeague, useLeague } from '@/context/LeagueContext';
import { Helmet } from 'react-helmet-async';

const IndexContent = () => {
  const [activeTab, setActiveTab] = useState('games');
  const { loadCareerData } = useLeague();

  // Load the bundled league on a first visit, and refresh it on later visits while the user is still
  // on bundled data (so rebuilt league data shows up). Uploaded sheets are never replaced.
  useEffect(() => {
    let keepSaved = false;
    try {
      const saved = localStorage.getItem('retroVault:careerCsv');
      keepSaved = (!!saved && !isBundledLeague(saved, localStorage.getItem(DATA_SOURCE_KEY))) || !!localStorage.getItem('retroVault:seasonSnapshots');
    } catch {
      // Storage unavailable; fall through and load the bundled league
    }
    if (keepSaved) return;

    fetch('/data/initial-data.csv')
      .then((res) => res.text())
      .then((content) => {
        if (content && content.includes('QB')) {
          loadCareerData(content, 'bundled');
        }
      })
      .catch(() => {
        // No initial data available, user will upload
      });
  }, [loadCareerData]);

  return (
    <>
      <Helmet>
        <title>Retro Vault — League Hub</title>
        <meta name="description" content="Retro Vault is the league hub for your Retro Bowl franchise: career stats, team pages, records and the Hall of Fame." />
      </Helmet>
      
      <div className="min-h-screen flex flex-col">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
        
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {activeTab === 'career' && <CareerTab />}
          {activeTab === 'teams' && <TeamRankingsTab />}
          {activeTab === 'hof' && <HallOfFameTab />}
          {activeTab === 'collection' && <CollectionTab />}
          {activeTab === 'timeline' && <TimelineTab />}
          {activeTab === 'office' && <FrontOfficeTab />}
          {activeTab === 'games' && <GamesTab />}
        </main>

        <CeremonyHost />
        <CardUnlockToasts />
        <footer className="mt-12 border-t border-line/70 bg-night">
          <div className="h-1 turf-stripes" aria-hidden="true" />
          <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <p className="font-display text-lg font-bold italic uppercase tracking-tight text-chalk">
              Retro <span className="text-gold">Vault</span>
            </p>
            <p className="text-xs text-center sm:text-right max-w-md">
              Fan-made league hub for Retro Bowl. Team names and logos belong to their respective owners; this site is
              not affiliated with or endorsed by any league or team.
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
