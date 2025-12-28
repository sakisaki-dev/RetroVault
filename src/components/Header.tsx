import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  return (
    <header className="glass-card border-b border-border/30 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Trophy className="w-8 h-8 text-primary" />
              <div className="absolute inset-0 blur-lg bg-primary/30" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wider glow-text">
                RETRO VAULT
              </h1>
              <p className="text-xs text-muted-foreground tracking-widest uppercase">
                League Analytics
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="bg-secondary/50 border border-border/30">
              <TabsTrigger 
                value="career" 
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium tracking-wide"
              >
                Career
              </TabsTrigger>
              <TabsTrigger 
                value="season"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium tracking-wide"
              >
                Season
              </TabsTrigger>
              <TabsTrigger 
                value="commentary"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-medium tracking-wide"
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
