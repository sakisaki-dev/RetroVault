import { useRef, useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import { cn } from '@/lib/utils';

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
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const activeIndex = tabs.findIndex(t => t.value === activeTab);
    const activeButton = tabsRef.current[activeIndex];
    
    if (activeButton) {
      const { offsetLeft, offsetWidth } = activeButton;
      setIndicatorStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [activeTab]);

  const handleTabClick = (value: string) => {
    if (value !== activeTab) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 400);
      onTabChange(value);
    }
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/20">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <RetroFootballIcon />
            <div>
              <span className="font-display text-2xl font-bold tracking-tight text-foreground">
                Retro Vault
              </span>
              <p className="text-xs text-muted-foreground tracking-wide">League Analytics</p>
            </div>
          </div>

          {/* Navigation with fluid indicator */}
          <div className="relative bg-secondary/50 backdrop-blur-sm border border-border/20 p-1.5 rounded-full">
            {/* Fluid animated indicator */}
            <div
              className={cn(
                "absolute top-1.5 h-[calc(100%-12px)] bg-background rounded-full shadow-md transition-all ease-out",
                isAnimating ? "duration-400" : "duration-300"
              )}
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
                transform: isAnimating ? 'scaleX(1.1) scaleY(0.95)' : 'scaleX(1) scaleY(1)',
              }}
            >
              {/* Water droplet effect layers */}
              <div 
                className={cn(
                  "absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent transition-opacity duration-200",
                  isAnimating ? "opacity-100" : "opacity-50"
                )}
              />
              <div 
                className={cn(
                  "absolute -inset-0.5 rounded-full transition-all duration-300",
                  isAnimating 
                    ? "bg-primary/5 blur-sm scale-110" 
                    : "bg-transparent blur-0 scale-100"
                )}
              />
            </div>

            {/* Tab buttons */}
            <div className="relative flex gap-1">
              {tabs.map((tab, index) => (
                <button
                  key={tab.value}
                  ref={el => tabsRef.current[index] = el}
                  onClick={() => handleTabClick(tab.value)}
                  className={cn(
                    "relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200",
                    activeTab === tab.value 
                      ? "text-foreground" 
                      : "text-muted-foreground hover:text-foreground/70"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Season indicator */}
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
