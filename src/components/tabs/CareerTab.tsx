import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import PlayerDetailCard from '../PlayerDetailCard';
import CountUp from '../brand/CountUp';
import RecordBook, { RecordStrip } from '../stats/RecordBook';
import AnalyticsLab from '../stats/analytics/AnalyticsLab';
import HeadToHead from '../stats/HeadToHead';
import PositionLeaders from '../stats/PositionLeaders';
import StatTables from '../stats/StatTables';
import { HEADLINE_IDS, LEADER_IDS, buildRecordBook, pickBoards } from '../stats/records';

const JUMPS = [
  { href: '#record-book', label: 'Records' },
  { href: '#head-to-head', label: 'Head-to-Head' },
  { href: '#analytics', label: 'Analytics Lab' },
  { href: '#efficiency', label: 'Efficiency' },
  { href: '#leaders', label: 'Leaders' },
  { href: '#tables', label: 'Full Tables' },
];

/** Stats hub: a compact record strip, the Head-to-Head comparison, then the Analytics Lab, then leaders and the raw career tables. */
const CareerTab = () => {
  const { careerData, isLoading } = useLeague();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const book = useMemo(() => buildRecordBook(careerData), [careerData]);

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
    <div className="container space-y-10 py-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-pixel text-[10px] uppercase text-gold">League Hub</p>
          <h1 className="font-display text-4xl font-extrabold italic uppercase leading-none sm:text-5xl">
            Stats <span className="text-gold">&amp;</span> Records
          </h1>
          <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {JUMPS.map((j) => (
              <a key={j.href} href={j.href} className="font-semibold text-muted-foreground underline-offset-4 hover:text-gold hover:underline">
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

      {headline.length > 0 && <RecordStrip headline={headline} onSelect={setSelectedPlayer} />}

      <HeadToHead data={careerData} onSelect={setSelectedPlayer} />

      <AnalyticsLab data={careerData} onSelect={setSelectedPlayer} />

      <RecordBook leaders={leaders} pace={book.pace} onSelect={setSelectedPlayer} />

      <PositionLeaders boards={book.boards} onSelect={setSelectedPlayer} />

      <StatTables data={careerData} />

      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
};

export default CareerTab;
