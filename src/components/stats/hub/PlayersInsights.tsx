import type { LeagueData, Player } from '@/types/player';
import AnalyticsLab from '../analytics/AnalyticsLab';
import HiddenGems from '../HiddenGems';
import LeagueGallery from '../visual/LeagueGallery';
import LeagueShape from '../visual/LeagueShape';

interface Props {
  data: LeagueData;
  onSelect: (p: Player) => void;
}

/**
 * The heavy middle of the Players sub-tab (Analytics Lab, Landscape, Hidden Gems, League Shape), split into its own
 * chunk so the record strip, records, leaders and tables paint first on phones (see CareerTab).
 */
const PlayersInsights = ({ data, onSelect }: Props) => (
  <>
    <AnalyticsLab data={data} onSelect={onSelect} />
    <LeagueGallery data={data} onSelect={onSelect} />
    <HiddenGems data={data} onSelect={onSelect} />
    <LeagueShape data={data} onSelect={onSelect} />
  </>
);

export default PlayersInsights;
