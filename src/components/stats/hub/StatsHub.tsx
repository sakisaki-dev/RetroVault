import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Building2, ChartScatter, Radar, Swords, Users } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import PlayerSearchSelect from '../../PlayerSearchSelect';
import { openInCompFinder } from '../comps/compFinderLink';
import { usePrefersReducedMotion } from '../analytics/viz';
import { keyOf } from '../records';
import { buildHash, type StatsSub } from './hashRoute';

const SUB_TABS: { id: StatsSub; label: string; short: string; Icon: typeof Users; blurb: string }[] = [
  { id: 'players', label: 'Players', short: 'Players', Icon: Users, blurb: 'Records, full stat tables, advanced analytics and leaders' },
  { id: 'teams', label: 'Teams', short: 'Teams', Icon: Building2, blurb: 'Every franchise and its roster' },
  { id: 'graphs', label: 'Graphs', short: 'Graphs', Icon: ChartScatter, blurb: 'Graph Builder: any stat against any stat' },
  { id: 'h2h', label: 'Head-to-Head', short: 'H2H', Icon: Swords, blurb: 'Any two players, every stat' },
  { id: 'deepdive', label: 'Deep Dive', short: 'Dive', Icon: Radar, blurb: 'One player, every angle: style, comps and more' },
];

interface Props {
  sub: StatsSub;
  section?: string;
  onSubChange: (sub: StatsSub) => void;
  players: Player[];
  onOpenPlayer: (p: Player) => void;
  children: ReactNode;
}

const px = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Stats hub shell: a sticky sub-nav (Players / Teams / Graphs / Head-to-Head / Deep Dive) with a global player
 * search, pinned right under the site header. Content below sees `--site-header-h` as header + sub-nav, so
 * sticky bars inside a sub-tab (e.g. the Head-to-Head scoreboard) sit under both.
 */
const StatsHub = ({ sub, section, onSubChange, players, onOpenPlayer, children }: Props) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<{ header: number; bar: number }>({ header: 0, bar: 0 });
  const reduced = usePrefersReducedMotion();
  const sorted = useMemo(() => [...players].sort((a, b) => b.careerLegacy - a.careerLegacy), [players]);

  // Track the site header height (published by Header on <html>) and our own bar height.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      const header = px(getComputedStyle(root).getPropertyValue('--site-header-h'));
      const bar = barRef.current?.offsetHeight ?? 0;
      setOffset((o) => (o.header === header && o.bar === bar ? o : { header, bar }));
    };
    measure();
    const mo = new MutationObserver(measure);
    mo.observe(root, { attributes: true, attributeFilter: ['style'] });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (barRef.current) ro?.observe(barRef.current);
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, []);

  // In-page jumps (and other agents' scrollIntoView calls) land below both sticky bars.
  const total = offset.header + offset.bar;
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = `${total + 8}px`;
    return () => {
      root.style.scrollPaddingTop = prev;
    };
  }, [total]);

  // Sub-tab switch: bring the top of the new panel into view (if we had scrolled past it); sections scroll to themselves.
  const first = useRef(true);
  useEffect(() => {
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    const id = window.requestAnimationFrame(() => {
      if (section) {
        const el = document.getElementById(section);
        if (el) {
          el.scrollIntoView({ behavior, block: 'start' });
          return;
        }
      }
      if (first.current) return;
      const top = (rootRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - offset.header;
      if (window.scrollY > top + 4) window.scrollTo({ top, behavior });
    });
    first.current = false;
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, section]);

  const tabs = (
    <nav aria-label="Stats sections" className="min-w-0 flex-1">
      <ul className="flex items-stretch gap-1 overflow-x-auto scrollbar-none">
        {SUB_TABS.map(({ id, label, short, Icon, blurb }) => {
          const active = id === sub;
          return (
            <li key={id} className="shrink-0">
              <a
                href={buildHash({ tab: 'career', sub: id })}
                aria-current={active ? 'page' : undefined}
                title={blurb}
                aria-label={label}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onSubChange(id);
                }}
                className={cn(
                  'group relative flex h-10 items-center gap-1 rounded-md px-2 font-display text-[15px] font-bold uppercase tracking-wide transition-colors sm:gap-1.5 sm:px-3 sm:text-base',
                  active ? 'bg-gold text-primary-foreground shadow-[0_0_18px_hsl(var(--gold)/0.35)]' : 'text-muted-foreground hover:bg-panel-2 hover:text-chalk',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : 'text-gold/80 group-hover:text-gold')} aria-hidden="true" />
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  // One control: on Deep Dive the pick loads there; anywhere else it opens the player's card (Deep Dive is one click from the card).
  const search = (
    <div className="min-w-0 [&_[role=combobox]]:h-10">
      <PlayerSearchSelect showOvr
        players={sorted}
        value=""
        onValueChange={(key) => {
          const p = sorted.find((x) => keyOf(x) === key);
          if (!p) return;
          if (sub === 'deepdive') openInCompFinder(p);
          else onOpenPlayer(p);
        }}
        placeholder={sub === 'deepdive' ? 'Deep Dive on a player…' : 'Find a player…'}
        ariaLabel={sub === 'deepdive' ? 'Load a player in the Deep Dive' : "Open a player's card"}
      />
    </div>
  );

  return (
    <div ref={rootRef} style={{ ['--stats-bar-h' as string]: `${offset.bar}px` }}>
      <div
        ref={barRef}
        className="sticky z-40 border-b border-line/70 bg-night/90 backdrop-blur-md supports-[backdrop-filter]:bg-night/75"
        style={{ top: 'var(--site-header-h, 0px)' }}
      >
        <div className="container flex items-center gap-3 py-1.5">
          <span className="hidden shrink-0 font-pixel text-[10px] uppercase text-gold xl:inline" aria-hidden="true">
            Stats
          </span>
          {tabs}
          <div className="hidden w-[min(380px,36vw)] shrink-0 md:block">{search}</div>
        </div>
      </div>
      {/* Phones: the search scrolls with the page so the pinned bar stays one row tall. */}
      <div className="container pt-3 md:hidden">{search}</div>

      <div style={total ? { ['--site-header-h' as string]: `${total}px` } : undefined}>{children}</div>
    </div>
  );
};

export default StatsHub;
