import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Retro pixel-style football icon - colorful
const RetroFootballIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-10 h-10 drop-shadow-lg">
    {/* Football body - brown with gradient feel */}
    <ellipse cx="16" cy="16" rx="14" ry="10" fill="#8B4513" />
    {/* Highlight on football */}
    <ellipse cx="16" cy="13" rx="11" ry="6" fill="#A0522D" opacity="0.6" />
    {/* Dark shadow */}
    <ellipse cx="16" cy="19" rx="10" ry="5" fill="#5D2E0C" opacity="0.4" />
    {/* Center lace stripe */}
    <rect x="15" y="7" width="2" height="18" rx="1" fill="white" />
    {/* Horizontal laces */}
    <rect x="11" y="10" width="10" height="1.5" rx="0.5" fill="white" />
    <rect x="11" y="14" width="10" height="1.5" rx="0.5" fill="white" />
    <rect x="11" y="18" width="10" height="1.5" rx="0.5" fill="white" />
    {/* Stitching detail */}
    <ellipse cx="16" cy="16" rx="13" ry="9" stroke="#6B3410" strokeWidth="1" fill="none" opacity="0.5" />
  </svg>
);

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const { currentSeason } = useLeague();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/20">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo - retro football style */}
          <div className="flex items-center gap-3">
            <RetroFootballIcon />
            <div>
              <span className="font-display text-2xl font-bold tracking-tight text-foreground">
                Retro Vault
              </span>
              <p className="text-xs text-muted-foreground tracking-wide">League Analytics</p>
            </div>
          </div>

          {/* Navigation - Apple style pill navigation */}
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="bg-secondary/50 backdrop-blur-sm border border-border/20 p-1.5 rounded-full h-auto gap-1">
              <TabsTrigger 
                value="career" 
                className="rounded-full px-5 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
              >
                Career
              </TabsTrigger>
              <TabsTrigger 
                value="season"
                className="rounded-full px-5 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
              >
                Season
              </TabsTrigger>
              <TabsTrigger 
                value="teams"
                className="rounded-full px-5 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
              >
                Teams
              </TabsTrigger>
              <TabsTrigger 
                value="hof"
                className="rounded-full px-5 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
              >
                Hall of Fame
              </TabsTrigger>
              <TabsTrigger 
                value="records"
                className="rounded-full px-5 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
              >
                Records
              </TabsTrigger>
              <TabsTrigger 
                value="commentary"
                className="rounded-full px-5 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all"
              >
                Commentary
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Season indicator - with accent styling */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
            <Calendar className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Season</span>
            <span className="font-display text-lg font-bold text-accent">{currentSeason}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
