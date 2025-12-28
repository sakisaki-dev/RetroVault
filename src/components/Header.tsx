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
        <div className="flex items-center justify-between h-16">
          {/* Logo - minimal and modern */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-foreground">
              Retro Vault
            </span>
          </div>

          {/* Navigation - Apple style pill navigation */}
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="bg-secondary/40 backdrop-blur-sm border-0 p-1 rounded-full h-auto gap-0.5">
              <TabsTrigger 
                value="career" 
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Career
              </TabsTrigger>
              <TabsTrigger 
                value="season"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Season
              </TabsTrigger>
              <TabsTrigger 
                value="teams"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Teams
              </TabsTrigger>
              <TabsTrigger 
                value="hof"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Hall of Fame
              </TabsTrigger>
              <TabsTrigger 
                value="records"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Records
              </TabsTrigger>
              <TabsTrigger 
                value="commentary"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Commentary
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Season indicator - subtle and modern */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Season</span>
            <span className="font-semibold text-foreground">{currentSeason}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
