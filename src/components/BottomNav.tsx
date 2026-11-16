import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Building2,
  Flag,
  CalendarRange,
  ChartScatter,
  Crown,
  Gamepad2,
  Gauge,
  Gem,
  Hourglass,
  Landmark,
  Layers,
  Briefcase,
  MoreHorizontal,
  Package,
  Radar,
  Radio,
  Shield,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { setPerfSetting, suggestLite, usePerfMode, type PerfSetting } from '@/hooks/usePerfMode';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { Route, StatsSub } from '@/components/stats/hub/hashRoute';
import { reducedMotion } from '@/utils/motion';

/*
 * Phone navigation (below 640px; the top nav takes over from there): a fixed bottom tab bar with the four main
 * tabs and a "More" sheet for Season, Team Lab, Timeline, Front Office and the performance-mode switch. It publishes its
 * height as --bottom-nav-h so the page, toasts and docked sheets clear it (index.css).
 *
 * Gestures (touch or pen; a mouse or keyboard gets the plain buttons):
 * - Press and slide across the bar: the tab under the finger lifts (.bnav__item[data-hover]); release switches to it.
 * - Slide onto More: its menu pops up above the bar while the finger is down; slide up onto an item and release.
 * - Hold a tab HOLD_MS: that tab's sections pop up above it (Stats sub-tabs, Collection and Hall of Fame sections).
 * - Release anywhere else cancels. A plain tap is an ordinary click (the button's own handler), as before.
 * The pointer is captured once a slide or hold begins; every rectangle is measured once (the tabs at the press, a
 * menu's items when it opens), so a move only compares numbers and sets state when the target under the finger
 * changes. The menus are a pointer shortcut (aria-hidden): keyboard and VoiceOver keep the tabs, the More sheet and
 * each page's own section links.
 */
const MAIN = [
  { value: 'games', label: 'Arcade', Icon: Gamepad2 },
  { value: 'career', label: 'Stats', Icon: BarChart3 },
  { value: 'collection', label: 'Collection', Icon: Layers },
  { value: 'hof', label: 'Hall of Fame', short: 'HOF', Icon: Crown },
] as const;
/**
 * Each tab's own colour (owner: "everything is green and yellow which is kinda odd so maybe diff colors for each"): the
 * pill under the current tab, the lifted puck and finger bubble while sliding, and that tab's hold menu wear it. The
 * More menu's items each wear their own page's colour.
 */
const TAB_COLOR: Record<string, string> = {
  games: '#ff5d6c',
  career: '#4fb3ff',
  collection: '#b58cff',
  hof: '#f1c35c',
  more: '#3fd0b4',
  season: '#ff9a3c',
  lab: '#5fd28a',
  timeline: '#4fb3ff',
  office: '#f1c35c',
};
const colorOf = (id: string | null | undefined) => (id && TAB_COLOR[id]) || '#f1c35c';
const MORE = [
  { value: 'season', label: 'Season', blurb: 'Live standings, leaders and the award race', Icon: Radio },
  { value: 'lab', label: 'Team Lab', blurb: 'Build a lineup and get a scouting report', Icon: Users },
  { value: 'timeline', label: 'Timeline', blurb: 'Eras, storylines and what changed', Icon: CalendarRange },
  { value: 'office', label: 'Front Office', blurb: "The coach's record, seasons and rivals", Icon: Briefcase },
] as const;

interface Section {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Stats sub-tab to open */
  sub?: StatsSub;
  /** Element id to scroll to on the tab's page */
  anchor?: string;
}
/** Hold-a-tab sections (the Arcade has no fixed sections: its games are one page) */
const SECTIONS: Record<string, { title: string; items: Section[] }> = {
  career: {
    title: 'Stats',
    items: [
      { id: 'players', label: 'Players', Icon: Users, sub: 'players' },
      { id: 'teams', label: 'Teams', Icon: Building2, sub: 'teams' },
      { id: 'graphs', label: 'Graphs', Icon: ChartScatter, sub: 'graphs' },
      { id: 'h2h', label: 'Head-to-Head', Icon: Swords, sub: 'h2h' },
      { id: 'deepdive', label: 'Deep Dive', Icon: Radar, sub: 'deepdive' },
      { id: 'clock', label: 'The Clock', Icon: Hourglass, sub: 'clock' },
    ],
  },
  collection: {
    title: 'Collection',
    items: [
      { id: 'packs', label: 'Packs', Icon: Package, anchor: 'col-title' },
      { id: 'best', label: 'Best pulls', Icon: Sparkles, anchor: 'col-best' },
      { id: 'market', label: 'Market', Icon: TrendingUp, anchor: 'col-market' },
      { id: 'exchange', label: 'Exchange', Icon: ArrowLeftRight, anchor: 'col-exchange' },
      { id: 'binder', label: 'Binder', Icon: BookOpen, anchor: 'col-binder' },
    ],
  },
  hof: {
    title: 'Hall of Fame',
    items: [
      { id: 'class', label: 'Newest class', Icon: Star, anchor: 'hof-class-title' },
      { id: 'legends', label: "Legends' Row", Icon: Crown, anchor: 'hof-legends-title' },
      { id: 'gallery', label: 'Every bust', Icon: Landmark, anchor: 'hof-gallery-title' },
      { id: 'ballot', label: 'The ballot', Icon: Gem, anchor: 'hof-ballot-title' },
      { id: 'future', label: 'Future HOF', Icon: TrendingUp, anchor: 'hof-future-title' },
      { id: 'rafters', label: 'The Rafters', Icon: Flag, anchor: 'hof-rafters-title' },
      { id: 'rings', label: 'Rings of Honor', Icon: Shield, anchor: 'hof-rings-title' },
    ],
  },
};

const HOLD_MS = 450;
/** Space between a menu and the bar (px); index.css .bnav-pop uses the same */
const MENU_GAP = 12;
/** Movement before a press becomes a slide (px) */
const SLOP = 10;

type Menu = { kind: 'more' } | { kind: 'sections'; tab: string };
/** A menu on screen: which, and the centre of its tab (px), where it is anchored */
type Shown = Menu & { cx: number };
type Rect = { l: number; r: number; t: number; b: number };

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

/** Scroll to a section once its page has rendered it (a tab switch renders as a transition, lazily) */
const scrollToSection = (id: string) => {
  const t0 = performance.now();
  const tick = () => {
    const el = document.getElementById(id);
    if (!el) {
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
      return;
    }
    // One read: where it is, less the sticky header
    const header = parseFloat(document.documentElement.style.getPropertyValue('--site-header-h')) || 56;
    const y = el.getBoundingClientRect().top + window.scrollY - header - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  requestAnimationFrame(tick);
};

const BottomNav = ({ activeTab, onTabChange, onRoute }: { activeTab: string; onTabChange: (tab: string) => void; onRoute?: (to: Route) => void }) => {
  const ref = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  // Gesture state the bar draws: what is under the finger, and which menu is up
  const [hover, setHover] = useState<string | null>(null);
  const [menu, setMenu] = useState<Shown | null>(null);
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

  const goSection = (tab: string, s: Section) => {
    if (s.sub) {
      if (onRoute) onRoute({ tab: 'career', sub: s.sub });
      else onTabChange(tab);
      return;
    }
    if (tab !== activeTab) onTabChange(tab);
    if (s.anchor) scrollToSection(s.anchor);
  };

  // ---------- Gestures ----------
  const g = useRef({
    id: -1,
    sx: 0,
    sy: 0,
    sliding: false,
    tabs: [] as Rect[],
    barTop: 0,
    items: [] as { id: string; r: Rect }[],
    hover: null as string | null,
    menu: null as Menu | null,
    hold: 0,
    suppressClick: false,
  });
  const tabIds = [...MAIN.map((m) => m.value), 'more'] as string[];

  const setHoverIf = (h: string | null) => {
    if (g.current.hover === h) return;
    g.current.hover = h;
    if (h?.startsWith('tab:')) ref.current?.style.setProperty('--hc', colorOf(h.slice(4)));
    setHover(h);
  };
  const openMenu = (m: Menu | null) => {
    const cur = g.current.menu;
    if (cur === m || (cur && m && cur.kind === m.kind && (cur.kind === 'more' || (m.kind === 'sections' && cur.tab === m.tab)))) return;
    g.current.menu = m;
    g.current.items = [];
    const r = m ? g.current.tabs[m.kind === 'more' ? tabIds.length - 1 : tabIds.indexOf(m.tab)] : undefined;
    setMenu(m ? { ...m, cx: r ? (r.l + r.r) / 2 : window.innerWidth / 2 } : null);
  };
  const clearHold = () => {
    if (g.current.hold) window.clearTimeout(g.current.hold);
    g.current.hold = 0;
  };
  const capture = () => {
    const ul = listRef.current;
    try {
      if (ul && g.current.id >= 0 && !ul.hasPointerCapture(g.current.id)) ul.setPointerCapture(g.current.id);
    } catch {
      /* the pointer is gone */
    }
  };
  // Holding still on a tab with sections (or on More) pops its menu
  const armHold = (tab: string | null) => {
    clearHold();
    if (!tab || (!SECTIONS[tab] && tab !== 'more')) return;
    g.current.hold = window.setTimeout(() => {
      g.current.hold = 0;
      g.current.sliding = true;
      capture();
      setHoverIf(`tab:${tab}`);
      openMenu(tab === 'more' ? { kind: 'more' } : { kind: 'sections', tab });
    }, HOLD_MS);
  };
  const reset = () => {
    clearHold();
    if (bubbleRef.current) delete bubbleRef.current.dataset.on;
    g.current.id = -1;
    g.current.sliding = false;
    setHoverIf(null);
    openMenu(null);
  };

  // A menu's items are measured once, when it has rendered: from layout offsets (its pop-in scale must not skew them),
  // the box being fixed MENU_GAP above the bar
  useLayoutEffect(() => {
    if (!menu) return;
    const box = menuRef.current;
    if (!box) return;
    const top = g.current.barTop - MENU_GAP - box.offsetHeight;
    const l = box.offsetLeft - 10;
    const r = box.offsetLeft + box.offsetWidth + 10;
    g.current.items = Array.from(box.querySelectorAll<HTMLElement>('[data-target]')).map((el) => {
      let y = el.offsetTop;
      for (let p = el.offsetParent as HTMLElement | null; p && p !== box; p = p.offsetParent as HTMLElement | null) y += p.offsetTop;
      return { id: el.dataset.target!, r: { l, r, t: top + y - 2, b: top + y + el.offsetHeight + 2 } };
    });
  }, [menu]);

  const hitTest = (x: number, y: number): string | null => {
    const s = g.current;
    for (const it of s.items) if (x >= it.r.l && x <= it.r.r && y >= it.r.t && y <= it.r.b) return it.id;
    if (y >= s.barTop - 6) {
      const i = s.tabs.findIndex((r) => x >= r.l && x < r.r);
      if (i >= 0) return `tab:${tabIds[i]}`;
    }
    return null;
  };

  const onPointerDown = (e: RPointerEvent<HTMLUListElement>) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || e.button !== 0) return;
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!btn) return;
    const s = g.current;
    s.id = e.pointerId;
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.sliding = false;
    s.suppressClick = false;
    // One measure per press
    const lis = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    s.tabs = lis.map((li) => {
      const r = li.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom };
    });
    s.barTop = s.tabs[0]?.t ?? window.innerHeight - 60;
    armHold(btn.dataset.tab!);
  };

  // The bubble under the finger: moved straight from pointer events (no React state), shown while sliding along the bar
  const moveBubble = (x: number, y: number) => {
    const b = bubbleRef.current;
    if (!b) return;
    const onBar = y >= g.current.barTop - 6;
    if (!onBar) {
      delete b.dataset.on;
      return;
    }
    const navLeft = dockRef.current?.getBoundingClientRect().left ?? 0;
    b.style.transform = `translate3d(${x - navLeft - b.offsetWidth / 2}px, 0, 0) scale(1)`;
    b.dataset.on = '';
  };

  const onPointerMove = (e: RPointerEvent<HTMLUListElement>) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    if (!s.sliding) {
      if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < SLOP) return;
      s.sliding = true;
      capture();
    }
    moveBubble(e.clientX, e.clientY);
    const h = hitTest(e.clientX, e.clientY);
    if (h === s.hover) return;
    if (h?.startsWith('tab:')) {
      const tab = h.slice(4);
      if (tab === 'more') {
        clearHold();
        openMenu({ kind: 'more' });
      } else {
        // A different tab: its menu (if any) needs its own hold
        if (s.menu && !(s.menu.kind === 'sections' && s.menu.tab === tab)) openMenu(null);
        armHold(tab);
      }
    } else if (!h) clearHold();
    setHoverIf(h);
  };

  const onPointerUp = (e: RPointerEvent<HTMLUListElement>) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    clearHold();
    if (!s.sliding) {
      // A plain tap: the button's own click does the rest
      s.id = -1;
      return;
    }
    s.suppressClick = true;
    window.setTimeout(() => {
      s.suppressClick = false;
    }, 0);
    const h = hitTest(e.clientX, e.clientY);
    const m = s.menu;
    reset();
    if (!h) return;
    const [kind, a, b] = h.split(':');
    if (kind === 'tab') {
      if (a === 'more') setMore(true);
      else go(a);
    } else if (kind === 'more') go(a);
    else if (kind === 'sec' && m?.kind === 'sections') {
      const sec = SECTIONS[a]?.items.find((x) => x.id === b);
      if (sec) goSection(a, sec);
    }
  };

  const onClickGuard = (fn: () => void) => () => {
    if (g.current.suppressClick) return;
    fn();
  };

  useEffect(() => () => clearHold(), []);

  // The menu: over its tab (sections) or the More tab, kept inside the screen
  const MENU_W = 228;
  const vw = typeof window === 'undefined' ? 390 : window.innerWidth;
  const menuLeft = menu ? Math.min(vw - MENU_W - 10, Math.max(10, menu.cx - MENU_W / 2)) : 10;
  const caretX = menu ? menu.cx - menuLeft : MENU_W / 2;
  const items =
    menu?.kind === 'more'
      ? MORE.map((m) => ({ target: `more:${m.value}`, label: m.label, Icon: m.Icon, on: activeTab === m.value, color: colorOf(m.value) }))
      : menu?.kind === 'sections'
        ? SECTIONS[menu.tab].items.map((s) => ({ target: `sec:${menu.tab}:${s.id}`, label: s.label, Icon: s.Icon, on: false, color: colorOf(menu.tab) }))
        : [];
  const menuTitle = menu?.kind === 'more' ? 'More' : menu ? SECTIONS[menu.tab].title : '';
  const menuVars = {
    left: menuLeft,
    width: MENU_W,
    bottom: `calc(var(--bottom-nav-h, 0px) + ${MENU_GAP}px)`,
    '--bn-caret': `${caretX}px`,
    '--mc': colorOf(menu?.kind === 'more' ? 'more' : menu?.tab),
    '--mc2': colorOf(menu?.kind === 'more' ? 'more' : menu?.tab),
  } as CSSProperties;

  const activeIdx = inMore ? MAIN.length : Math.max(0, MAIN.findIndex((m) => m.value === activeTab));
  const activeColor = colorOf(inMore ? inMore.value : activeTab);
  return (
    <>
      {/* While the bar is tucked: a tap at the bottom edge brings it back instead of reaching the page underneath */}
      <div
        className="bnav-reveal sm:hidden"
        aria-hidden="true"
        onPointerDown={(e) => {
          e.preventDefault();
          delete document.documentElement.dataset.chrome;
        }}
      />
      <nav ref={ref} aria-label="Primary" className="bnav sm:hidden" data-gesture={hover ? 'true' : undefined}>
        {/* The dock: a floating capsule in the widget's gold rim; the pill under the current tab slides between tabs */}
        <div ref={dockRef} className="bnav__dock" style={{ '--ai': activeIdx, '--ac': activeColor } as CSSProperties}>
        <span className="bnav__pill" aria-hidden="true" />
        <span ref={bubbleRef} className="bnav__bubble" aria-hidden="true" />
        <ul
          ref={listRef}
          className="grid grid-cols-5"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={reset}
          onContextMenu={(e) => e.preventDefault()}
        >
          {MAIN.map(({ value, label, Icon, ...rest }) => {
            const on = activeTab === value;
            return (
              <li key={value}>
                <button
                  type="button"
                  data-tab={value}
                  onClick={onClickGuard(() => go(value))}
                  aria-current={on ? 'page' : undefined}
                  aria-label={label}
                  className="bnav__item"
                  style={{ '--tc': colorOf(value) } as CSSProperties}
                  data-on={on}
                  data-hover={hover === `tab:${value}` || undefined}
                  data-anchor={(menu?.kind === 'sections' && menu.tab === value) || undefined}
                >
                  <span className="bnav__puck" aria-hidden="true">
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <span className="bnav__label">{'short' in rest ? rest.short : label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              data-tab="more"
              onClick={onClickGuard(() => setMore(true))}
              aria-haspopup="dialog"
              aria-expanded={more}
              aria-current={inMore ? 'page' : undefined}
              className="bnav__item"
              style={{ '--tc': colorOf(inMore ? inMore.value : 'more') } as CSSProperties}
              data-on={!!inMore}
              data-hover={hover === 'tab:more' || undefined}
              data-anchor={menu?.kind === 'more' || undefined}
            >
              <span className="bnav__puck" aria-hidden="true">
                {inMore ? <inMore.Icon className="h-[22px] w-[22px]" /> : <MoreHorizontal className="h-[22px] w-[22px]" />}
              </span>
              <span className="bnav__label">{inMore ? inMore.label.replace('Front Office', 'Office') : 'More'}</span>
            </button>
          </li>
        </ul>
        </div>
      </nav>

      {menu && (
        <div ref={menuRef} className="bnav-pop sm:hidden" style={menuVars} aria-hidden="true" data-reduced={reducedMotion() || undefined}>
          <p className="bnav-pop__kicker">
            <span>{menuTitle}</span>
            <span className="bnav-pop__hint">{menu.kind === 'more' ? 'Slide up' : 'Jump to'}</span>
          </p>
          <ul className="bnav-pop__list">
            {items.map(({ target, label, Icon, on, color }, i) => (
              <li
                key={target}
                data-target={target}
                className="bnav-pop__item"
                data-hover={hover === target || undefined}
                data-on={on || undefined}
                style={{ '--i': items.length - 1 - i, '--ic': color } as CSSProperties}
              >
                <span className="bnav-pop__icon">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="bnav-pop__label">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="rounded-t-2xl border-line bg-popover px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
        >
          <SheetTitle className="flex min-h-[44px] items-center pr-14 font-display text-xl font-extrabold uppercase italic">More</SheetTitle>
          <SheetDescription className="sr-only">Season, Team Lab, Timeline, Front Office and settings</SheetDescription>
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
