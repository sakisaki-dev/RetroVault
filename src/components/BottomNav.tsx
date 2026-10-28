import { useEffect, useRef, useState } from 'react';
import { BarChart3, CalendarRange, Crown, Gamepad2, Gauge, Layers, Briefcase, MoreHorizontal, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setPerfSetting, suggestLite, usePerfMode, type PerfSetting } from '@/hooks/usePerfMode';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

/*
 * Phone navigation (below 640px; the top nav takes over from there): a fixed bottom tab bar with the four main
 * tabs and a "More" sheet for Team Lab, Timeline, Front Office and the performance-mode switch. It publishes its
 * height as --bottom-nav-h so the page, toasts and docked sheets clear it (index.css).
 */
const MAIN = [
  { value: 'games', label: 'Arcade', Icon: Gamepad2 },
  { value: 'career', label: 'Stats', Icon: BarChart3 },
  { value: 'collection', label: 'Collection', Icon: Layers },
  { value: 'hof', label: 'Hall of Fame', short: 'HOF', Icon: Crown },
] as const;
const MORE = [
  { value: 'lab', label: 'Team Lab', blurb: 'Build a lineup and get a scouting report', Icon: Users },
  { value: 'timeline', label: 'Timeline', blurb: 'Eras, storylines and what changed', Icon: CalendarRange },
  { value: 'office', label: 'Front Office', blurb: "The coach's record, seasons and rivals", Icon: Briefcase },
] as const;

const PerfRow = () => {
  const { setting, lite } = usePerfMode();
  const opts: { v: PerfSetting; label: string }[] = [
    { v: 'auto', label: `Auto (${suggestLite() ? 'on' : 'off'})` },
    { v: 'on', label: 'On' },
    { v: 'off', label: 'Off' },
  ];
  return (
    <div className="rounded-lg border border-line/70 p-3">
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <Gauge className={cn('h-5 w-5', lite ? 'text-turf' : 'text-muted-foreground')} aria-hidden="true" />
        Performance mode
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">Turns off card shimmer, glare and long walkouts.</p>
      <div role="group" aria-label="Performance mode" className="mt-2 grid grid-cols-3 gap-1.5">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={setting === o.v}
            onClick={() => setPerfSetting(o.v)}
            className={cn(
              'h-11 rounded-md border text-sm font-semibold',
              setting === o.v ? 'border-gold bg-gold text-night' : 'border-line bg-night/60 text-secondary-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const BottomNav = ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [more, setMore] = useState(false);
  const inMore = MORE.find((m) => m.value === activeTab);

  // Publish the bar's height (0 when hidden above the phone breakpoint)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--bottom-nav-h', `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--bottom-nav-h');
    };
  }, []);

  const go = (tab: string) => {
    setMore(false);
    if (tab === activeTab) window.scrollTo({ top: 0, behavior: 'smooth' });
    else onTabChange(tab);
  };

  return (
    <>
      <nav ref={ref} aria-label="Primary" className="bnav sm:hidden">
        <ul className="grid grid-cols-5">
          {MAIN.map(({ value, label, Icon, ...rest }) => {
            const on = activeTab === value;
            return (
              <li key={value}>
                <button type="button" onClick={() => go(value)} aria-current={on ? 'page' : undefined} aria-label={label} className="bnav__item" data-on={on}>
                  <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
                  <span>{'short' in rest ? rest.short : label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-haspopup="dialog"
              aria-expanded={more}
              aria-current={inMore ? 'page' : undefined}
              className="bnav__item"
              data-on={!!inMore}
            >
              {inMore ? <inMore.Icon className="h-[22px] w-[22px]" aria-hidden="true" /> : <MoreHorizontal className="h-[22px] w-[22px]" aria-hidden="true" />}
              <span>{inMore ? inMore.label.replace('Front Office', 'Office') : 'More'}</span>
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="rounded-t-2xl border-line bg-popover px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
        >
          <SheetTitle className="flex min-h-[44px] items-center pr-14 font-display text-xl font-extrabold uppercase italic">More</SheetTitle>
          <SheetDescription className="sr-only">Team Lab, Timeline, Front Office and settings</SheetDescription>
          <ul className="mt-2 space-y-2">
            {MORE.map(({ value, label, blurb, Icon }) => (
              <li key={value}>
                <button
                  type="button"
                  onClick={() => go(value)}
                  aria-current={activeTab === value ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[60px] w-full items-center gap-3 rounded-lg border px-3 text-left',
                    activeTab === value ? 'border-gold/70 bg-gold/10' : 'border-line/70 bg-night/50',
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-bold uppercase leading-tight tracking-wide">{label}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{blurb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <PerfRow />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BottomNav;
