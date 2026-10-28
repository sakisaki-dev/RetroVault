import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import PlayerCardLayer from '../player/PlayerCardLayer';
import { useNewSlot } from '@/utils/slot';
import CountUp from '../brand/CountUp';
import RecordBook, { RecordStrip } from '../stats/RecordBook';
import PositionLeaders from '../stats/PositionLeaders';
import StatTables from '../stats/StatTables';
import StatsPulse from '../stats/visual/StatsPulse';
import { HEADLINE_IDS, LEADER_IDS, buildRecordBook, pickBoards } from '../stats/records';
import StatsHub from '../stats/hub/StatsHub';
import { GraphsPage, HeadToHead, PlayerDeepDive, PlayersInsights, TeamRankingsTab, ViewLoading, prefetchStatsSub } from '../stats/hub/lazyViews';
import { buildHash, useHubRoute, type StatsSub } from '../stats/hub/hashRoute';
import { reducedMotion } from '@/utils/motion';
import { usePhone } from '@/hooks/usePhone';
import { cn } from '@/lib/utils';

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

/** Phones: which jump section is in view (the last one whose top has passed under the sticky bars) */
const useSpy = (on: boolean) => {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const line = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + 110;
      // The section whose top most recently passed the line (DOM order differs from the chip order)
      let cur: string | null = null;
      let best = -Infinity;
      for (const j of JUMPS) {
        const top = document.getElementById(j.id)?.getBoundingClientRect().top;
        if (top != null && top <= line && top > best) {
          best = top;
          cur = j.id;
        }
      }
      setId(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [on]);
  return id;
};

/**
 * Stats hub. A sticky sub-nav switches between Players (record strip, records, efficiency, leaders, full tables, Analytics Lab),
 * Teams, Graphs (the Graph Builder), Head-to-Head and Deep Dive (one player, full width). The sub-tab lives in the
 * URL hash (see stats/hub/hashRoute.ts).
 */
const CareerTab = () => {
  const { careerData, isLoading, getAllPlayers } = useLeague();
  const { route, navigate } = useHubRoute();
  // The open player card lives in a slot: opening it re-renders the card only, not the whole hub behind it
  const cardSlot = useNewSlot<Player | null>(null);
  const setSelectedPlayer = cardSlot.set;
  const sub: StatsSub = route.sub ?? 'players';
  const phone = usePhone();
  const spied = useSpy(phone && sub === 'players');
  const jumpRow = useRef<HTMLDivElement | null>(null);
  // Keep the section in view centred in the chip row
  useEffect(() => {
    if (!spied) return;
    const chip = jumpRow.current?.querySelector<HTMLElement>(`[data-jump="${spied}"]`);
    const row = jumpRow.current;
    if (chip && row) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [spied]);

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
      {/* Each sub-tab cross-fades in with a short rise (.rv-view-in). The switch is a transition (hashRoute), and the
          Suspense below stays mounted, so the old sub-tab stays up until a lazy one has loaded. */}
      {sub === 'players' && (
        <div className="rv-view-in container space-y-10 py-6 sm:py-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-pixel text-[10px] uppercase text-gold">League Hub · Players</p>
              <h1 className="font-display text-4xl font-extrabold italic uppercase leading-none sm:text-5xl">
                Stats <span className="text-gold">&amp;</span> Records
              </h1>
              <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm max-sm:hidden">
                {JUMPS.map((j) => (
                  <a
                    key={j.id}
                    href={buildHash({ tab: 'career', sub: 'players', section: j.id })}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      navigate({ tab: 'career', sub: 'players', section: j.id }, { replace: true });
                      // Same section clicked twice: the route doesn't change, so scroll directly.
                      if (route.section === j.id) document.getElementById(j.id)?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
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

          {/* Phones: the page's sections as a sticky, finger-scrolled chip row that follows the scroll */}
          {phone && (
            <nav aria-label="On this page" className="sticky z-30 -mx-4 !mt-4 border-b border-line/70 bg-night py-2" style={{ top: 'var(--site-header-h, 0px)' }}>
              <div ref={jumpRow} className="flex gap-1.5 overflow-x-auto px-4 scrollbar-none">
                {JUMPS.map((j) => (
                  <a
                    key={j.id}
                    data-jump={j.id}
                    href={buildHash({ tab: 'career', sub: 'players', section: j.id })}
                    aria-current={spied === j.id ? 'location' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate({ tab: 'career', sub: 'players', section: j.id }, { replace: true });
                      if (route.section === j.id) document.getElementById(j.id)?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
                    }}
                    className={cn(
                      'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors',
                      spied === j.id ? 'border-gold bg-gold text-night' : 'border-line bg-night/60 text-secondary-foreground',
                    )}
                  >
                    {j.label}
                  </a>
                ))}
              </div>
            </nav>
          )}

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
      <div key={sub} className={sub === 'players' ? undefined : 'rv-view-in'}>
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
      </div>
      </Suspense>

      <PlayerCardLayer slot={cardSlot} />
    </StatsHub>
  );
};

export default CareerTab;
