import { findNFLTeam } from '@/utils/nflTeams';
import TeamLogo from './brand/TeamLogo';

interface TeamBannerProps {
  team?: string;
  className?: string;
  showLogo?: boolean;
}

/** Thin team-colored stripe for the left edge of a card, with an optional faint logo watermark. */
const TeamBanner = ({ team, className = '', showLogo = false }: TeamBannerProps) => {
  const nflTeam = findNFLTeam(team);
  if (!nflTeam) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${className}`}
        style={{
          background: `linear-gradient(180deg, hsl(${nflTeam.primaryColor}) 0%, hsl(${nflTeam.secondaryColor}) 100%)`,
        }}
      />
      {showLogo && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none" aria-hidden="true">
          <TeamLogo team={nflTeam} size={32} decorative />
        </div>
      )}
    </>
  );
};

export default TeamBanner;
