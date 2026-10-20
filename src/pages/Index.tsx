import { useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import CareerTab from '@/components/tabs/CareerTab';
import HallOfFameTab from '@/components/tabs/HallOfFameTab';
import GamesTab from '@/components/tabs/GamesTab';
import TimelineTab from '@/components/tabs/TimelineTab';
import FrontOfficeTab from '@/components/tabs/FrontOfficeTab';
import CollectionTab from '@/components/tabs/CollectionTab';
import TeamLabTab from '@/components/teamlab/TeamLabTab';
import CardUnlockToasts from '@/components/collection/CardUnlockToasts';
import CeremonyHost from '@/components/ceremony/CeremonyHost';
import QuickPlayerSearch from '@/components/QuickPlayerSearch';
import { LeagueProvider } from '@/context/LeagueContext';
import { onCompFinderRequest, onHeadToHeadRequest } from '@/components/stats/comps/compFinderLink';
import { HubRouteContext, useHashRoute } from '@/components/stats/hub/hashRoute';
import { Helmet } from 'react-helmet-async';
import { decodeProgress, importProgress } from '@/utils/deviceSync';

const IndexContent = () => {
  // The visible page lives in the URL hash (#stats/teams, #stats/deepdive?p=…) so it is linkable and Back works.
  const { route, navigate } = useHashRoute('games');
  const activeTab = route.tab;
  const hub = useMemo(() => ({ route, navigate }), [route, navigate]);
  // "Deep Dive" requests (player card, Map, Stats search) open Stats › Deep Dive on that player; the view consumes the
  // pending request itself. Head-to-Head hand-offs open Stats › Head-to-Head.
  // A shared transfer link (#sync=<code>) imports progress from another device, after confirmation
  useEffect(() => {
    const check = () => {
      if (!window.location.hash.startsWith('#sync=')) return;
      const code = window.location.hash;
      navigate({ tab: 'office' }, { replace: true });
      decodeProgress(code)
        .then((data) => {
          const n = Object.keys(data).length;
          if (
            window.confirm(
              `Import ${n} saved item${n === 1 ? '' : 's'} (collection, scores, saved teams) from your other device? This replaces this device's progress.`,
            )
          ) {
            importProgress(data);
            window.location.reload();
          }
        })
        .catch(() => window.alert('That transfer link could not be read.'));
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
    // Subscribes once; navigate is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const offDive = onCompFinderRequest((key) => {
      navigate({ tab: 'career', sub: 'deepdive', p: key || undefined });
    });
    const offH2H = onHeadToHeadRequest(() => navigate({ tab: 'career', sub: 'h2h' }));
    return () => {
      offDive();
      offH2H();
    };
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Retro Vault — League Hub</title>
        <meta
          name="description"
          content="Retro Vault is the league hub for your Retro Bowl franchise: career stats, team pages, records and the Hall of Fame."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Header activeTab={activeTab} onTabChange={(tab) => navigate({ tab })} />

        <HubRouteContext.Provider value={hub}>
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {activeTab === 'career' && <CareerTab />}
            {activeTab === 'lab' && <TeamLabTab />}
            {activeTab === 'hof' && <HallOfFameTab />}
            {activeTab === 'collection' && <CollectionTab />}
            {activeTab === 'timeline' && <TimelineTab />}
            {activeTab === 'office' && <FrontOfficeTab />}
            {activeTab === 'games' && <GamesTab />}
          </main>
        </HubRouteContext.Provider>

        <CeremonyHost />
        <QuickPlayerSearch />
        <CardUnlockToasts />
        <footer className="mt-12 border-t border-line/70 bg-night">
          <div className="h-1 turf-stripes" aria-hidden="true" />
          <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <p className="font-display text-lg font-bold italic uppercase tracking-tight text-chalk">
              Retro <span className="text-gold">Vault</span>
            </p>
            <p className="text-xs text-center sm:text-right max-w-md">
              Fan-made league hub for Retro Bowl. Team names and logos belong to their respective owners; this site is not affiliated with
              or endorsed by any league or team.
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
