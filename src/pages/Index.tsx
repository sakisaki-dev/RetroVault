import { Suspense, lazy, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import TabFallback from '@/components/TabFallback';
import { GIFTS, giftSummary, redeemAutoGifts } from '@/utils/collection';
import CardUnlockToasts from '@/components/collection/CardUnlockToasts';
import LegendExchange from '@/components/collection/LegendExchange';
import CeremonyHost from '@/components/ceremony/CeremonyHost';
import QuickPlayerSearch from '@/components/QuickPlayerSearch';
import { LeagueProvider } from '@/context/LeagueContext';
import { onCompFinderRequest, onHeadToHeadRequest } from '@/components/stats/comps/compFinderLink';
import { HubRouteContext, useHashRoute } from '@/components/stats/hub/hashRoute';
import { Helmet } from 'react-helmet-async';
import { decodeProgress, importProgress } from '@/utils/deviceSync';

// Every tab is its own chunk, loaded the first time it is opened (the Collection one carries the card art, the
// sprite engine and pack opening; the Art lab and Card designs split off again inside it).
const CareerTab = lazy(() => import('@/components/tabs/CareerTab'));
const HallOfFameTab = lazy(() => import('@/components/tabs/HallOfFameTab'));
const GamesTab = lazy(() => import('@/components/tabs/GamesTab'));
const TimelineTab = lazy(() => import('@/components/tabs/TimelineTab'));
const FrontOfficeTab = lazy(() => import('@/components/tabs/FrontOfficeTab'));
const CollectionTab = lazy(() => import('@/components/tabs/CollectionTab'));
const TeamLabTab = lazy(() => import('@/components/teamlab/TeamLabTab'));

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

  // One-time pack gifts (collection.ts AUTO_GIFTS): granted once per device on the first load of a build that has them
  useEffect(() => {
    redeemAutoGifts().forEach((id) =>
      toast.success(`New packs added: ${giftSummary(id)}`, {
        description: `${GIFTS[id].label} for the new card art, uniforms and poses.`,
        duration: 12000,
        action: { label: 'Open', onClick: () => navigate({ tab: 'collection' }) },
      }),
    );
    // Once per load; navigate is stable
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
            <Suspense fallback={<TabFallback />}>
              {activeTab === 'career' && <CareerTab />}
              {activeTab === 'lab' && <TeamLabTab />}
              {activeTab === 'hof' && <HallOfFameTab />}
              {activeTab === 'collection' && <CollectionTab />}
              {activeTab === 'timeline' && <TimelineTab />}
              {activeTab === 'office' && <FrontOfficeTab />}
              {activeTab === 'games' && <GamesTab />}
            </Suspense>
          </main>
        </HubRouteContext.Provider>

        <CeremonyHost />
        <QuickPlayerSearch />
        <CardUnlockToasts />
        <LegendExchange />
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
