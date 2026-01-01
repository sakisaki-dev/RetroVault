import { getTeamColors } from '@/utils/teamColors';
import { findNFLTeam } from '@/utils/nflTeams';

interface TeamBannerProps {
  team?: string;
  className?: string;
  showLogo?: boolean;
}

const TeamBanner = ({ team, className = '', showLogo = false }: TeamBannerProps) => {
  const colors = getTeamColors(team);
  const nflTeam = findNFLTeam(team);
  
  if (!colors || !team) return null;
  
  return (
    <>
      <div 
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${className}`}
        style={{ 
          background: `linear-gradient(180deg, hsl(${colors.primary}) 0%, hsl(${colors.secondary}) 100%)`,
        }}
      />
      {showLogo && nflTeam && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none">
          <img 
            src={nflTeam.logoUrl} 
            alt={nflTeam.fullName} 
            className="w-8 h-8 object-contain"
          />
        </div>
      )}
    </>
  );
};

export default TeamBanner;
