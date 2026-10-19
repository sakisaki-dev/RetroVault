import { useCallback, useMemo, useState } from 'react';
import { useLeague } from '@/context/LeagueContext';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { useLeagueContent } from '@/utils/leagueContent';
import { usePlayerExtras } from '@/utils/playerExtras';
import { overallRating } from '@/components/brand/ProPlayerBanner.utils';
import { resolveTeam } from '@/components/brand/TeamLogo';
import {
  hofKey,
  useCeremonyRequests,
  useHallOfFameWatch,
  type CeremonyRequest,
} from '@/utils/hallOfFameWatch';
import InductionCeremony, { type CeremonyInductee } from './InductionCeremony';
import { buildSpeechFacts, getInductionSpeech } from './speech';

/**
 * Mount once (pages/Index.tsx). Watches league data for new Hall of Famers / retired numbers and
 * plays ceremonies, and plays any ceremony requested with `playCeremony()` (e.g. HOF tab replays).
 */
const CeremonyHost = () => {
  const { careerData, getAllPlayers, dataVersion } = useLeague();
  const { index: jerseyIndex, numberFor, retiredInfo } = useJerseyNumbers();
  const officialOvr = useOfficialOvr();
  const { content, loading: contentLoading } = useLeagueContent();
  const extras = usePlayerExtras();
  const [request, setRequest] = useState<CeremonyRequest | null>(null);
  const [requestId, setRequestId] = useState(0);

  const players = useMemo(() => getAllPlayers(), [getAllPlayers]);
  const season = content?.season ?? careerData?.metadata?.season ?? null;

  const onCeremony = useCallback((r: CeremonyRequest) => {
    // The newest request replaces any ceremony in progress (and restarts it from the top)
    setRequest(r);
    setRequestId((id) => id + 1);
  }, []);

  useHallOfFameWatch({
    players,
    jerseys: jerseyIndex,
    ready: !!careerData && !contentLoading,
    version: `${dataVersion}:${players.length}`,
    season,
    onCeremony,
  });
  useCeremonyRequests(onCeremony);

  const inductees = useMemo((): CeremonyInductee[] => {
    if (!request) return [];
    const byKey = new Map(players.map((p) => [hofKey(p), p]));
    return request.entries.flatMap((entry, i) => {
      const player = byKey.get(entry.key);
      if (!player) return [];
      const retired = retiredInfo(player);
      const facts = buildSpeechFacts(player, {
        content,
        extras,
        teamName: resolveTeam(player.team)?.fullName ?? player.team ?? null,
        retired: retired ? { number: retired.number, teamLabel: retired.teamLabel } : null,
      });
      return [
        {
          key: entry.key,
          player,
          variant: entry.variant,
          number: numberFor(player),
          ovr: overallRating(player, officialOvr),
          retired,
          speech: getInductionSpeech(facts, content, { offset: i, variant: entry.variant }),
        },
      ];
    });
  }, [request, players, retiredInfo, numberFor, officialOvr, content, extras]);

  if (!request || !inductees.length) return null;

  return (
    <InductionCeremony
      key={requestId}
      inductees={inductees}
      classLabel={request.classLabel ?? (season ? `Class of ${season}` : 'Hall of Fame')}
      onClose={() => setRequest(null)}
    />
  );
};

export default CeremonyHost;
