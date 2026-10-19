import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Loader2 } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { useLeagueContent } from '@/utils/leagueContent';
import { useJerseyNumbers } from '@/utils/jerseys';
import {
  buildAchievements,
  buildCabinet,
  buildNemeses,
  buildResume,
  buildStints,
  readArcadeBests,
  type ArcadeBests,
} from '@/utils/frontOffice';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import CoachHeader from '@/components/frontoffice/CoachHeader';
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
  const [selected, setSelected] = useState<Player | null>(null);

  const model = useMemo(() => {
    if (!content) return null;
    const resume = buildResume(content);
    return {
      resume,
      stints: buildStints(content, resume, players),
      shelves: buildCabinet(resume),
      nemeses: buildNemeses(resume),
    };
  }, [content, players]);

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

  const { resume, stints, shelves, nemeses } = model;

  return (
    <div className="container mx-auto space-y-8 px-4 py-6 sm:space-y-10 sm:py-8">
      <CoachHeader resume={resume} franchiseCount={resume.franchises.length} stintCount={stints.length} />
      <TrophyCabinet shelves={shelves} />
      <FranchiseHistory stints={stints} onPlayerSelect={setSelected} numberFor={numberFor} />
      <Achievements items={achievements} />
      {(content.rivalries.length > 0 || nemeses.length > 0) && (
        <RivalsPanel rivalries={content.rivalries} nemeses={nemeses} resume={resume} />
      )}
      <PlayerDetailCard player={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default FrontOfficeTab;
