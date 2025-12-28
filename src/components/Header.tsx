import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Calendar } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const { currentSeason } = useLeague();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/20">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo - with subtle glow */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl opacity-50" />
            </div>
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
