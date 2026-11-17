import { useCurrentClub } from '@/utils/club';
import { useFieldArt } from '@/components/teamlab/fieldArt';

/**
 * A strip of the stadium's crowd between two Stats sections (the game's crowd art painted to the current club; CSS dots
 * in the public build), so the page below the opener still sits in the stadium. Decorative.
 */
const CrowdDivider = () => {
  const club = useCurrentClub() ?? 'Eagles';
  const art = useFieldArt(club, 'night');
  return (
    <div className={art.crowd ? 'crowd-div crowd-div--art' : 'crowd-div'} style={art.crowd ? { backgroundImage: `url(${art.crowd})` } : undefined} aria-hidden="true">
      <span className="crowd-div__rail" />
    </div>
  );
};

export default CrowdDivider;
