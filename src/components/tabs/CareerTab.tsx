import { Suspense, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import PlayerDetailCard from '../PlayerDetailCard';
import CountUp from '../brand/CountUp';
import RecordBook, { RecordStrip } from '../stats/RecordBook';
import PositionLeaders from '../stats/PositionLeaders';
import StatTables from '../stats/StatTables';
import StatsPulse from '../stats/visual/StatsPulse';
import { HEADLINE_IDS, LEADER_IDS, buildRecordBook, pickBoards } from '../stats/records';
import StatsHub from '../stats/hub/StatsHub';
import { GraphsPage, HeadToHead, PlayerDeepDive, PlayersInsights, TeamRankingsTab, ViewLoading, prefetchStatsSub } from '../stats/hub/lazyViews';
import { buildHash, useHubRoute, type StatsSub } from '../stats/hub/hashRoute';

/** In-page jumps on the Players sub-tab (each is linkable: #stats/players/<id>). */
const JUMPS = [
  { id: 'analytics', label: 'Advanced' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'hidden-gems', label: 'Hidden Gems' },
  { id: 'league-shape', label: 'League Shape' },
  { id: 'record-book', label: 'Records' },
  { id: 'efficiency', label: 'Efficiency' },
  { id: 'leaders', label: 'Leaders' },
  { id: 'tables', label: 'Full Tables' },
];

/**
 * Stats hub. A sticky sub-nav switches between Players (record strip, records, efficiency, leaders, full tables, Analytics Lab),
 * Teams, Graphs (the Graph Builder), Head-to-Head and Deep Dive (one player, full width). The sub-tab lives in the
 * URL hash (see stats/hub/hashRoute.ts).
 */
const CareerTab = () => {
  const { careerData, isLoading, getAllPlayers } = useLeague();
  const { route, navigate } = useHubRoute();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const sub: StatsSub = route.sub ?? 'players';

  const book = useMemo(() => buildRecordBook(careerData, 10), [careerData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const players = useMemo(() => getAllPlayers(), [getAllPlayers, careerData]);


  if (!careerData) {
    // The league loads from the bundled data file; this only shows for a moment (or if that file is missing).
    return (
      <div className="container py-12 text-center" role="status">
        <Trophy className="mx-auto mb-4 h-8 w-8 text-gold" aria-hidden="true" />
        <p className="text-muted-foreground">Loading the league…</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container flex items-center justify-center py-20">
        <div role="status" aria-label="Loading league data" className="h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  const headline = pickBoards(book.boards, HEADLINE_IDS);
  const leaders = pickBoards(book.boards, LEADER_IDS);

  return (
    <StatsHub
      sub={sub}
      section={route.section}
      onSubChange={(s) => navigate({ tab: 'career', sub: s })}
      players={players}
      onOpenPlayer={setSelectedPlayer}
      onPrefetch={prefetchStatsSub}
    >
      {sub === 'players' && (
        <div className="container space-y-10 py-6 sm:py-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-pixel text-[10px] uppercase text-gold">League Hub · Players</p>
              <h1 className="font-display text-4xl font-extrabold italic uppercase leading-none sm:text-5xl">
                Stats <span className="text-gold">&amp;</span> Records
              </h1>
              <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {JUMPS.map((j) => (
                  <a
                    key={j.id}
                    href={buildHash({ tab: 'career', sub: 'players', section: j.id })}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      navigate({ tab: 'career', sub: 'players', section: j.id }, { replace: true });
                      // Same section clicked twice: the route doesn't change, so scroll directly.
                      if (route.section === j.id) document.getElementById(j.id)?.scrollIntoView({ block: 'start' });
                    }}
                    className="font-semibold text-muted-foreground underline-offset-4 hover:text-gold hover:underline"
                  >
                    {j.label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="lamp">Players <b><CountUp value={book.playerCount} /></b></span>
              <span className="lamp">Records <b><CountUp value={book.boards.size} /></b></span>
              <span className="lamp">Chasing <b><CountUp value={Math.min(book.pace.length, 6)} /></b></span>
            </div>
          </header>

          <StatsPulse data={careerData} book={book} onSelect={setSelectedPlayer} />

          {headline.length > 0 && <RecordStrip headline={headline} onSelect={setSelectedPlayer} />}

          {/* Analytics Lab, Landscape, Hidden Gems, League Shape: their own chunk (stats/hub/lazyViews) */}
          <Suspense fallback={<ViewLoading label="advanced stats" tall={false} />}>
            <PlayersInsights data={careerData} onSelect={setSelectedPlayer} />
          </Suspense>

          <RecordBook leaders={leaders} pace={book.pace} onSelect={setSelectedPlayer} />

          <PositionLeaders boards={book.boards} data={careerData} onSelect={setSelectedPlayer} />

          <StatTables data={careerData} />
        </div>
      )}

      <Suspense fallback={<ViewLoading label={sub} />}>
      {sub === 'teams' && <TeamRankingsTab />}

      {/* Graph Builder full page (src/components/stats/graph); the URL's gx / gy / pos… are the chart. */}
      {sub === 'graphs' && <GraphsPage data={careerData} onSelect={setSelectedPlayer} />}

      {sub === 'h2h' && (
        <div className="container py-6 sm:py-8">
          <HeadToHead data={careerData} onSelect={setSelectedPlayer} />
        </div>
      )}

      {/* Deep Dive (src/components/stats/comps): one player, full width. The hash's ?p= is the player (none = empty state). */}
      {sub === 'deepdive' && (
        <div className="container py-6 sm:py-8">
          <PlayerDeepDive
            data={careerData}
            onSelect={setSelectedPlayer}
            initialPlayerKey={route.p}
            onPlayerChange={(key) => navigate({ tab: 'career', sub: 'deepdive', p: key }, { replace: true })}
          />
        </div>
      )}
      </Suspense>

      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </StatsHub>
  );
};

export default CareerTab;
