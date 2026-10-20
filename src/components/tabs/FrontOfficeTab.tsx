import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Loader2 } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { useLeagueContent } from '@/utils/leagueContent';
import { editionRotate } from '@/utils/edition';
import { useJerseyNumbers } from '@/utils/jerseys';
import {
  buildAchievements,
  buildCabinet,
  buildCoachFacts,
  buildNemeses,
  buildResume,
  buildStints,
  readArcadeBests,
  seasonRows,
  type ArcadeBests,
} from '@/utils/frontOffice';
import { usePlayerExtras } from '@/utils/playerExtras';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import CoachHeader from '@/components/frontoffice/CoachHeader';
import AdvancedStats from '@/components/frontoffice/AdvancedStats';
import SeasonLog from '@/components/frontoffice/SeasonLog';
import SyncPanel from '@/components/frontoffice/SyncPanel';
import { buildCoachAnalytics } from '@/utils/coachAnalytics';
import FranchiseHistory from '@/components/frontoffice/FranchiseHistory';
import TrophyCabinet from '@/components/frontoffice/TrophyCabinet';
import Achievements from '@/components/frontoffice/Achievements';
import RivalsPanel from '@/components/frontoffice/RivalsPanel';
import '@/components/frontoffice/frontoffice.css';

/** Arcade bests live in localStorage; re-read when another tab writes or this window regains focus. */
const useArcadeBests = (): ArcadeBests => {
  const [bests, setBests] = useState(readArcadeBests);
  useEffect(() => {
    const refresh = () => setBests(readArcadeBests());
    const onStorage = (e: StorageEvent) => (!e.key || e.key.startsWith('retroVault:games:')) && refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return bests;
};

const FrontOfficeTab = () => {
  const { content, loading } = useLeagueContent();
  const { getAllPlayers } = useLeague();
  const players = useMemo(() => getAllPlayers(), [getAllPlayers]);
  const { numberFor } = useJerseyNumbers();
  const arcade = useArcadeBests();
  const extras = usePlayerExtras();
  const [selected, setSelected] = useState<Player | null>(null);

  const model = useMemo(() => {
    if (!content) return null;
    const resume = buildResume(content);
    const rows = seasonRows(content);
    const stints = buildStints(content, resume, players, extras.stints);
    return {
      resume,
      rows,
      seasonByYear: new Map(rows.map((r) => [r.year, r])),
      facts: buildCoachFacts(rows),
      analytics: buildCoachAnalytics(rows, stints, content.coach),
      stints,
      shelves: buildCabinet(resume),
      nemeses: buildNemeses(resume),
    };
  }, [content, players, extras.stints]);

  const achievements = useMemo(
    () => (content && model ? buildAchievements(content, model.resume, players, arcade) : []),
    [content, model, players, arcade],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading the front office…
      </div>
    );
  }

  if (!content || !model || !model.resume.appearances) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <Briefcase className="h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold uppercase">The Front Office is empty</h1>
        <p className="text-sm text-muted-foreground">
          Load league history (Super Bowls with your results) on the Timeline tab to build your coaching résumé.
        </p>
      </div>
    );
  }

  const { resume, rows, seasonByYear, facts, analytics, stints, shelves, nemeses } = model;
  const coach = content.coach;
  const franchiseCount = rows.length ? new Set(stints.map((s) => s.team)).size : resume.franchises.length;

  return (
    <div className="container mx-auto space-y-8 px-4 py-6 sm:space-y-10 sm:py-8">
      <CoachHeader resume={resume} franchiseCount={franchiseCount} stintCount={stints.length} coach={coach} facts={facts} />
      <TrophyCabinet shelves={shelves} seasonByYear={rows.length ? seasonByYear : undefined} />
      {coach && facts && analytics && <AdvancedStats analytics={analytics} facts={facts} coach={coach} rows={rows} />}
      <FranchiseHistory stints={stints} onPlayerSelect={setSelected} numberFor={numberFor} />
      <Achievements items={achievements} />
      {(content.rivalries.length > 0 || nemeses.length > 0) && (
        <RivalsPanel rivalries={editionRotate(content.rivalries, content.edition, 'fo-rivals')} nemeses={nemeses} resume={resume} />
      )}
      {rows.length > 0 && <SeasonLog rows={rows} games={resume.games} />}

      <SyncPanel />
      <PlayerDetailCard player={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default FrontOfficeTab;
