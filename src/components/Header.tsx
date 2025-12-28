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
    <header className="glass-card border-b border-border/30 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Trophy className="w-8 h-8 text-primary" />
              <div className="absolute inset-0 blur-lg bg-primary/30" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-wider glow-text">
                RETRO VAULT
              </h1>
              <p className="text-xs text-muted-foreground tracking-widest uppercase">
                League Analytics
              </p>
            </div>
          </div>

          {/* Season Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30">
            <Calendar className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Season</span>
            <span className="font-display text-xl text-accent font-bold">{currentSeason}</span>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="bg-secondary/50 border border-border/30 flex-wrap h-auto">
              <TabsTrigger 
                value="career" 
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium"
              >
                Career
              </TabsTrigger>
              <TabsTrigger 
                value="season"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium"
              >
                Season
              </TabsTrigger>
              <TabsTrigger 
                value="teams"
                className="data-[state=active]:bg-accent/20 data-[state=active]:text-accent font-medium"
              >
                Teams
              </TabsTrigger>
              <TabsTrigger 
                value="hof"
                className="data-[state=active]:bg-chart-4/20 data-[state=active]:text-chart-4 font-medium"
              >
                Hall of Fame
              </TabsTrigger>
              <TabsTrigger 
                value="records"
                className="data-[state=active]:bg-accent/20 data-[state=active]:text-accent font-medium"
              >
                Records
              </TabsTrigger>
              <TabsTrigger 
                value="commentary"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium"
              >
                Commentary
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </header>
  );
};

export default Header;
