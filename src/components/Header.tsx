import { useEffect, useMemo, useRef } from 'react';
import { Gauge, Search } from 'lucide-react';
import { setPerfSetting, suggestLite, usePerfMode, type PerfSetting } from '@/hooks/usePerfMode';
import { cn } from '@/lib/utils';
import { openQuickSearch } from '@/components/QuickPlayerSearch';
import { useLeague } from '@/context/LeagueContext';
import { findNFLTeam } from '@/utils/nflTeams';
import { HOF_THRESHOLD } from '@/config/stats';
import BrandMark from '@/components/brand/BrandMark';
import CountUp from '@/components/brand/CountUp';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const NAV_TABS = [
  { value: 'games', label: 'Arcade' },
  { value: 'career', label: 'Stats' },
  { value: 'lab', label: 'Team Lab' },
  { value: 'hof', label: 'Hall of Fame' },
  { value: 'collection', label: 'Collection' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'office', label: 'Front Office' },
] as const;

/** Season tag (e.g. "Y80") from the title line of the saved league sheet, if present. */
const readSeasonTag = (): string | null => {
  try {
    const csv = localStorage.getItem('retroVault:careerCsv');
    if (!csv) return null;
    const firstLine = csv.slice(0, 300).split(/\r?\n/)[0] ?? '';
    const match = firstLine.match(/\bY\d{1,3}\b/i);
    return match ? match[0].toUpperCase() : null;
  } catch {
    return null;
  }
};

/** Header toggle for performance mode: cycles Auto → On → Off (persisted per viewer). */
const PerfToggle = () => {
  const { setting, lite } = usePerfMode();
  const next: Record<PerfSetting, PerfSetting> = { auto: 'on', on: 'off', off: 'auto' };
  const name = setting === 'auto' ? `Auto (${suggestLite() ? 'on' : 'off'})` : setting === 'on' ? 'On' : 'Off';
  return (
    <button
      type="button"
      onClick={() => setPerfSetting(next[setting])}
      aria-pressed={lite}
      aria-label={`Performance mode: ${name}. Turns off card tilt, shimmer, blur and long walkouts. Click to change.`}
      title={`Performance mode: ${name}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        lite ? 'border-turf/70 text-turf' : 'border-line text-muted-foreground hover:border-gold/60 hover:text-foreground',
      )}
    >
      <Gauge className="h-4 w-4" aria-hidden="true" />
      <span className="hidden xl:inline">{lite ? 'Lite' : 'Full'}</span>
      {setting === 'auto' && <span className="hidden font-mono text-[10px] xl:inline">auto</span>}
    </button>
  );
};

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const { careerData, getAllPlayers, dataVersion } = useLeague();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const headerRef = useRef<HTMLElement | null>(null);

  // Publish the sticky header's live height so other sticky bars can sit right below it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const set = () => document.documentElement.style.setProperty('--site-header-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const board = useMemo(() => {
    const players = getAllPlayers();
    const teams = new Set<string>();
    players.forEach((p) => {
      const raw = p.team?.trim();
      if (!raw) return;
      teams.add(findNFLTeam(raw)?.id ?? raw.toLowerCase());
    });
    return {
      season: readSeasonTag(),
      players: players.length,
      teams: teams.size,
      hof: players.filter((p) => p.careerLegacy >= HOF_THRESHOLD).length,
      rings: players.reduce((sum, p) => sum + (p.rings || 0), 0),
    };
    // dataVersion bumps after edits/uploads so the board stays in sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerData, getAllPlayers, dataVersion]);

  // Keep the active tab visible in the scrollable mobile nav
  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeTab]);

  const nav = (
    <nav aria-label="Primary" className="min-w-0">
      <ul className="flex items-stretch gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <li key={tab.value} className="shrink-0">
              <button
                ref={(el) => (tabRefs.current[tab.value] = el)}
                type="button"
                onClick={() => onTabChange(tab.value)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative h-11 px-3 sm:px-3.5 font-display text-[17px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors',
                  'after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t after:transition-colors',
                  isActive
                    ? 'text-chalk after:bg-gold'
                    : 'text-muted-foreground hover:text-chalk after:bg-transparent hover:after:bg-line',
                )}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const lamps = careerData
    ? [
        { k: 'Players', v: board.players },
        { k: 'Teams', v: board.teams },
        { k: 'HOF', v: board.hof },
        { k: 'Rings', v: board.rings },
      ]
    : [];

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-line/70 bg-night/90 backdrop-blur-md supports-[backdrop-filter]:bg-night/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Gold rule across the top, like a broadcast bug */}
      <div className="h-[3px] bg-gradient-to-r from-gold via-gold/70 to-turf" aria-hidden="true" />

      <div className="container">
        <div className="flex items-center gap-4 lg:gap-8 h-14 lg:h-16">
          <button
            type="button"
            onClick={() => onTabChange('career')}
            className="shrink-0 rounded-md"
            aria-label="Retro Vault home"
          >
            <BrandMark compact className="sm:hidden" />
            <BrandMark className="hidden sm:inline-flex" />
          </button>

          <div className="hidden lg:block flex-1 min-w-0 self-end">{nav}</div>

          <button
            type="button"
            onClick={openQuickSearch}
            aria-label="Look up a player (Command K)"
            className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-md border border-line bg-night/60 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:ml-0"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden xl:inline">Player</span>
            <kbd className="hidden rounded border border-line px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>

          <PerfToggle />

          {board.season && (
            <span className="lamp shrink-0" aria-label={`Season ${board.season}`}>
              Season <b>{board.season}</b>
            </span>
          )}
        </div>

        {/* Mobile / tablet nav: horizontal scroll */}
        <div className="lg:hidden -mt-1">{nav}</div>
      </div>

      {/* Scoreboard strip */}
      {lamps.length > 0 && (
        <div className="scoreboard-strip">
          <div className="container">
            <p
              className="flex items-center gap-x-3 overflow-x-auto scrollbar-none py-1.5 font-pixel text-[10px] uppercase text-muted-foreground whitespace-nowrap"
              aria-label="League summary"
            >
              {lamps.map((l, i) => (
                <span key={l.k} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true" className="text-line">·</span>}
                  <CountUp value={Number(l.v)} className="text-gold" />
                  <span>{l.k}</span>
                </span>
              ))}
              <span className="ml-auto pl-4 text-turf" aria-hidden="true">Ready</span>
            </p>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
