import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import FileUpload from '../FileUpload';
import PlayerDetailCard from '../PlayerDetailCard';
import CountUp from '../brand/CountUp';
import RecordBook, { RecordStrip } from '../stats/RecordBook';
import AnalyticsLab from '../stats/analytics/AnalyticsLab';
import PositionLeaders from '../stats/PositionLeaders';
import StatTables from '../stats/StatTables';
import { HEADLINE_IDS, LEADER_IDS, buildRecordBook, pickBoards } from '../stats/records';

const JUMPS = [
  { href: '#record-book', label: 'Records' },
  { href: '#analytics', label: 'Analytics Lab' },
  { href: '#efficiency', label: 'Efficiency' },
  { href: '#leaders', label: 'Leaders' },
  { href: '#tables', label: 'Full Tables' },
];

/** Stats hub: a compact record strip, then the Analytics Lab, then leaders and the raw career tables. */
const CareerTab = () => {
  const { careerData, loadCareerData, isLoading } = useLeague();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const book = useMemo(() => buildRecordBook(careerData), [careerData]);

  if (!careerData) {
    return (
      <div className="container py-12">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <Trophy className="h-8 w-8 text-gold" aria-hidden="true" />
          </div>
          <h1 className="mb-4 font-display text-4xl font-extrabold italic uppercase">
            Welcome to Retro <span className="text-gold">Vault</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload your league CSV file to unlock the record book, advanced analytics, position leaders and every career stat line.
          </p>
        </div>
        <div className="mx-auto max-w-md">
          <FileUpload onFileLoad={(content) => loadCareerData(content)} label="Upload Career Data CSV" />
        </div>
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

      <AnalyticsLab data={careerData} onSelect={setSelectedPlayer} />

      <RecordBook leaders={leaders} pace={book.pace} onSelect={setSelectedPlayer} />

      <PositionLeaders boards={book.boards} onSelect={setSelectedPlayer} />

      <StatTables data={careerData} />

      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
};

export default CareerTab;
