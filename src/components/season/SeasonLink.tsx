import { ChevronRight } from 'lucide-react';
import { useHubRoute } from '@/components/stats/hub/hashRoute';
import { SEASON_WEEKS, recordText, useLiveSeason } from '@/utils/seasonLive';
import { useSchedule, latestScheduleSeason } from '@/utils/schedule';
import TeamLogo from '@/components/timeline/TeamLogo';
import { color } from './seasonGamesUi';
import './season.css';

/**
 * The Timeline's pointer to the Season page, which is the home of the season data (standings, power rankings, game
 * logs, league leaders, award races, head-to-head and game records). Its line comes from the data.
 */
const SeasonLink = () => {
  const { navigate } = useHubRoute();
  const live = useLiveSeason();
  const schedule = useSchedule();
  const last = schedule ? latestScheduleSeason(schedule) : null;
  const club = live?.club ?? last?.coachTeam;
  const c = live ? live.clubs[live.club] : null;
  const line = live
    ? `Y${live.season} live, week ${Math.min(live.week, SEASON_WEEKS)} of ${SEASON_WEEKS}${c ? ` · ${live.club} ${recordText(c)}` : ''}`
    : last
      ? `${last.season} final · ${last.coachTeam} ${last.coachRecord.record}`
      : 'Standings, game logs and records';
  return (
    <button type="button" className="season-link" style={club ? { ['--club' as string]: color(club) } : undefined} onClick={() => navigate({ tab: 'season' })}>
      {club && <TeamLogo team={club} decorative className="season-link__logo" />}
      <span className="min-w-0">
        <span className="season-link__k block">{line}</span>
        <span className="season-link__t block">The season page</span>
        <span className="season-link__d block">Standings and power rankings, game logs, league leaders, the award race, head-to-head and game records.</span>
      </span>
      <ChevronRight className="season-link__go h-6 w-6" aria-hidden />
    </button>
  );
};

export default SeasonLink;
