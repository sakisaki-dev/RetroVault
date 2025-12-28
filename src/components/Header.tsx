import { useRef, useEffect, useState } from 'react';
import { Calendar, Trash2, X } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import { cn } from '@/lib/utils';
import { loadSeasonHistory, saveSeasonHistory } from '@/utils/seasonHistory';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Retro pixel-style football icon - colorful
const RetroFootballIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-10 h-10 drop-shadow-lg">
    <ellipse cx="16" cy="16" rx="14" ry="10" fill="#8B4513" />
    <ellipse cx="16" cy="13" rx="11" ry="6" fill="#A0522D" opacity="0.6" />
    <ellipse cx="16" cy="19" rx="10" ry="5" fill="#5D2E0C" opacity="0.4" />
    <rect x="15" y="7" width="2" height="18" rx="1" fill="white" />
    <rect x="11" y="10" width="10" height="1.5" rx="0.5" fill="white" />
    <rect x="11" y="14" width="10" height="1.5" rx="0.5" fill="white" />
    <rect x="11" y="18" width="10" height="1.5" rx="0.5" fill="white" />
    <ellipse cx="16" cy="16" rx="13" ry="9" stroke="#6B3410" strokeWidth="1" fill="none" opacity="0.5" />
  </svg>
);

const tabs = [
  { value: 'career', label: 'Career' },
  { value: 'season', label: 'Season' },
  { value: 'teams', label: 'Teams' },
  { value: 'hof', label: 'Hall of Fame' },
  { value: 'records', label: 'Records' },
  { value: 'compare', label: 'Compare' },
  { value: 'commentary', label: 'Commentary' },
];

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const { currentSeason } = useLeague();
  const navRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [seasons, setSeasons] = useState<string[]>([]);

  useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = tabs.findIndex((t) => t.value === activeTab);
      const activeButton = tabsRef.current[activeIndex];
      const navEl = navRef.current;

      if (!activeButton || !navEl) return;

      const buttonRect = activeButton.getBoundingClientRect();
      const navRect = navEl.getBoundingClientRect();

      setIndicatorStyle({
        left: buttonRect.left - navRect.left,
        width: buttonRect.width,
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeTab]);

  // Load unique seasons from history
  useEffect(() => {
    const history = loadSeasonHistory();
    const allSeasons = new Set<string>();
    Object.values(history).forEach((snapshots) => {
      snapshots.forEach((s) => allSeasons.add(s.season));
    });
    setSeasons(Array.from(allSeasons).sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    }));
  }, []);

  const handleDeleteSeason = (seasonToDelete: string) => {
    const history = loadSeasonHistory();
    // Remove this season from all players
    Object.keys(history).forEach((key) => {
      history[key] = history[key].filter((s) => s.season !== seasonToDelete);
      if (history[key].length === 0) {
        delete history[key];
      }
    });
    saveSeasonHistory(history);
    setSeasons((prev) => prev.filter((s) => s !== seasonToDelete));
    toast.success(`Deleted season ${seasonToDelete} data`);
  };

  const handleTabClick = (value: string) => {
    if (value === activeTab) return;
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 420);
    onTabChange(value);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/20">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-20">
          {/* Logo */}
          <div className="flex items-center gap-3 justify-self-start">
            <RetroFootballIcon />
            <div>
              <span className="font-display text-2xl font-bold tracking-tight text-foreground">
                Retro Vault
              </span>
              <p className="text-xs text-muted-foreground tracking-wide">League Analytics</p>
            </div>
          </div>

          {/* Navigation with fluid indicator (centered) */}
          <div
            ref={navRef}
            className="relative justify-self-center bg-secondary/50 backdrop-blur-sm border border-border/20 p-1.5 rounded-full"
          >
            {/* Fluid animated indicator - solid black */}
            <div
              className="absolute top-1.5 bottom-1.5 rounded-full bg-background shadow-sm"
              style={{
                left: `${indicatorStyle.left}px`,
                width: `${indicatorStyle.width}px`,
                transform: isAnimating ? 'scaleX(1.06) scaleY(0.92)' : 'scaleX(1) scaleY(1)',
                transformOrigin: 'center',
                transition: isAnimating
                  ? 'left 420ms cubic-bezier(0.4, 0, 0.2, 1), width 420ms cubic-bezier(0.4, 0, 0.2, 1), transform 420ms cubic-bezier(0.4, 0, 0.2, 1)'
                  : 'left 320ms cubic-bezier(0.4, 0, 0.2, 1), width 320ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />

            {/* Tab buttons */}
            <div className="relative flex gap-0">
              {tabs.map((tab, index) => (
                <button
                  key={tab.value}
                  ref={(el) => (tabsRef.current[index] = el)}
                  onClick={() => handleTabClick(tab.value)}
                  className={cn(
                    "relative z-10 rounded-full px-5 py-2 text-sm font-medium whitespace-nowrap flex items-center justify-center transition-colors duration-200",
                    activeTab === tab.value ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Season indicator with delete toggle */}
          <div className="justify-self-end">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-3 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 cursor-pointer transition-colors hover:bg-accent/20">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground">Season</span>
                  <span className="font-display text-lg font-bold text-accent">{currentSeason}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-3 border-b border-border">
                  <h4 className="font-medium text-sm text-foreground">Delete Season Data</h4>
                  <p className="text-xs text-muted-foreground mt-1">Remove faulty season data</p>
                </div>
                <ScrollArea className="max-h-64">
                  {seasons.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No season history recorded
                    </div>
                  ) : (
                    <div className="p-2">
                      {seasons.map((season) => (
                        <div
                          key={season}
                          className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-secondary/50"
                        >
                          <span className="text-sm font-medium">{season}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteSeason(season)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
