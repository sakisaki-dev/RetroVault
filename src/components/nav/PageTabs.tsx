import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import './pageTabs.css';

/*
 * The page-level tab bar (the Stats hub's design, owner: "i like the design of this navbar ... mirror the one in fantasy
 * and others to look like this for a unified navbar look"): a sticky dark bar, icon + label tabs (short labels and no
 * icons on phones), one gold pill that slides to the chosen tab (and leans toward the next one while a swipe is in
 * progress: src/utils/swipeSlide.ts moves `.pt__thumb`). Used by Stats, Fantasy, College, News and the team sheet.
 * Small card-level filters keep ArcadeToggle / Choice.
 */
export interface PageTab<T extends string> {
  value: T;
  label: string;
  /** The phone label (defaults to `label`) */
  short?: string;
  Icon?: LucideIcon;
  title?: string;
  /** Renders a link (the Stats hub's hash routes); otherwise a button */
  href?: string;
}

interface TabsProps<T extends string> {
  tabs: readonly PageTab<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  onPrefetch?: (v: T) => void;
  className?: string;
}

export const PageTabs = <T extends string>({ tabs, value, onChange, label, onPrefetch, className }: TabsProps<T>) => {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const thumb = useRef<HTMLSpanElement | null>(null);
  const nav = useRef<HTMLElement | null>(null);
  const placed = useRef(false);
  const cur = Math.max(0, tabs.findIndex((t) => t.value === value));
  useLayoutEffect(() => {
    const place = () => {
      const b = refs.current[cur];
      const th = thumb.current;
      if (!b || !th) return;
      if (!placed.current) th.style.transition = 'none'; // no slide in from the left edge on mount
      th.style.width = `${b.offsetWidth}px`;
      th.style.height = `${b.offsetHeight}px`;
      th.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
      th.style.opacity = '1';
      if (!placed.current) {
        void th.offsetWidth;
        th.style.transition = '';
        placed.current = true;
      }
    };
    place();
    if (typeof ResizeObserver === 'undefined' || !nav.current) return;
    const ro = new ResizeObserver(place);
    ro.observe(nav.current);
    return () => ro.disconnect();
  }, [cur, tabs.length]);
  return (
    <nav ref={nav} aria-label={label} data-swipe-nav className={cn('pt min-w-0 flex-1', className)}>
      <span ref={thumb} className="pt__thumb" aria-hidden="true" />
      <ul className="relative flex items-stretch gap-1 max-sm:gap-0.5">
        {tabs.map((t, i) => {
          const active = i === cur;
          const cls = cn(
            'pt__tab group relative flex h-10 w-full items-center justify-center gap-1 rounded-md px-2 font-display text-[15px] font-bold uppercase tracking-wide max-sm:h-11 max-sm:px-1 sm:gap-1.5 sm:px-3 sm:text-base',
            active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-panel-2 hover:text-chalk',
          );
          const kids: ReactNode = (
            <>
              {t.Icon && <t.Icon className={cn('h-4 w-4 shrink-0 max-sm:hidden', active ? 'text-primary-foreground' : 'text-gold/80 group-hover:text-gold')} aria-hidden="true" />}
              <span className="sm:hidden">{t.short ?? t.label}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </>
          );
          return (
            <li key={t.value} className="min-w-0 flex-1">
              {t.href ? (
                <a
                  ref={(el) => { refs.current[i] = el; }}
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  title={t.title}
                  aria-label={t.label}
                  onPointerEnter={() => onPrefetch?.(t.value)}
                  onFocus={() => onPrefetch?.(t.value)}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    onChange(t.value);
                  }}
                  className={cls}
                >
                  {kids}
                </a>
              ) : (
                <button
                  ref={(el) => { refs.current[i] = el; }}
                  type="button"
                  aria-pressed={active}
                  aria-current={active ? 'true' : undefined}
                  title={t.title}
                  aria-label={t.label}
                  onPointerEnter={() => onPrefetch?.(t.value)}
                  onFocus={() => onPrefetch?.(t.value)}
                  onClick={() => onChange(t.value)}
                  className={cls}
                >
                  {kids}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

/** The bar chrome around the tabs: sticky under the site header, the same dark panel and rule as the Stats hub's */
export const PageTabBar = ({ children, barRef, className, top = 'var(--site-header-h, 0px)' }: { children: ReactNode; barRef?: RefObject<HTMLDivElement | null>; className?: string; top?: string }) => (
  <div ref={barRef} data-chrome-bar className={cn('chrome-hide-bar sticky z-40 border-b border-line/70 bg-night', className)} style={{ top }}>
    <div className="container flex items-center gap-3 py-1.5">{children}</div>
  </div>
);

export default PageTabs;
