import { createElement, useCallback, useEffect, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode, type RefCallback } from 'react';
import CountUp from '@/components/brand/CountUp';
import { isLite } from '@/hooks/usePerfMode';
import '@/hooks/motion.css';
import { reducedMotion } from '@/utils/motion';

/**
 * Scroll-in motion, once. The container is "wait" while its mo-* children are held back and "go" after it first
 * scrolls into view (one shared IntersectionObserver). Reduced motion and lite mode never hold anything back.
 */
const motionOk = () => {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return false;
  try {
    if (reducedMotion()) return false;
  } catch {
    /* no matchMedia */
  }
  return !isLite();
};

let io: IntersectionObserver | null = null;
const shared = () =>
  (io ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        // a tall block (a long list) never shows 6% of itself in a phone's window: a slice of 60px is enough
        if (!e.isIntersecting || (e.intersectionRatio < 0.06 && e.intersectionRect.height < 60)) return;
        const t = e.target as HTMLElement;
        t.dataset.mo = 'go';
        io?.unobserve(t);
      }),
    { threshold: [0, 0.002, 0.02, 0.06], rootMargin: '0px 0px -24px 0px' },
  ));

/** A callback ref: the element waits, then goes once when it is on screen. */
export const useReveal = <T extends HTMLElement>(skipFold = false): RefCallback<T> =>
  useCallback((el: T | null) => {
    if (!el || !motionOk()) return;
    // skipFold: a block already on screen when it mounts stays as it is (no blank flash); the rest wait for the scroll
    if (skipFold && el.getBoundingClientRect().top < window.innerHeight - 24) return;
    el.dataset.mo = 'wait';
    shared().observe(el);
  }, [skipFold]);

type RevealProps<T extends ElementType> = { as?: T; className?: string; style?: CSSProperties; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, 'className' | 'style' | 'children'>;

/** A wrapper element (div by default) that reveals its mo-* children when scrolled into view. */
export const Reveal = <T extends ElementType = 'div'>({ as, ...rest }: RevealProps<T>) => {
  const ref = useReveal<HTMLElement>();
  return createElement((as ?? 'div') as ElementType, { ref, ...rest });
};

/**
 * Reveal a page's sections without editing each one: every direct child of a `<section aria-labelledby>` (or of any `data-mo-stack` element) under the
 * ref'd element (heading block, chip bar, panel, grid) waits and rises in, once, as it scrolls into view, staggered
 * by its place (capped). Sections already inside a Reveal keep that Reveal's motion; later children (a tab's panel,
 * a lazy chunk) are picked up as they mount. Motion off (reduced motion, lite mode) leaves everything as is.
 */
/** Fine units first (a section's heading, chips, panels), then a page container's other blocks (hero, tab bar). */
const FINE = 'section[aria-labelledby] > *, [data-mo-stack] > *';
const COARSE = '.container > *';
/** Page-open cascade: the first window after a page mounts, blocks on screen play in order, top to bottom. */
const OPEN_MS = 900;
const OPEN_CAP = 9;

export const useAutoReveal = <T extends HTMLElement>(): RefCallback<T> =>
  useCallback((root: T | null) => {
    if (!root || !motionOk()) return;
    let opened = performance.now();
    // a route inside the tab (a club, a school, a game, a player) opens like a page too: what it mounts cascades in
    const reopen = () => {
      if (root.isConnected) opened = performance.now();
      else ['rv:page', 'popstate'].forEach((t) => window.removeEventListener(t, reopen));
    };
    ['rv:page', 'popstate'].forEach((t) => window.addEventListener(t, reopen));
    let rank = 0;
    const held: HTMLElement[] = [];
    const booting = () => !!document.getElementById('rv-boot') && !(window as { __rvBootLifted?: boolean }).__rvBootLifted;
    if (booting()) {
      const lift = () => {
        window.removeEventListener('rv:boot-lift', lift);
        opened = performance.now();
        held.splice(0).forEach((el) => (el.dataset.mo = 'go'));
      };
      window.addEventListener('rv:boot-lift', lift);
      setTimeout(lift, 8000); // the loader never lifted (an error path): never leave the page hidden
    }
    const skip = (el: HTMLElement) => !!el.dataset.mo || !!el.closest('[data-mo], [data-no-mo]');
    const scan = () => {
      // owner: "everything just goes into the page" (the Game page has its own entrance). While the page is opening,
      // what is on screen cascades in top to bottom, as the Game page's header does; later blocks (below the fold,
      // a lazy chunk, a fetched file) wait and rise as they scroll in
      const opening = booting() || performance.now() - opened < OPEN_MS;
      const fold = window.innerHeight - 24;
      const picked: HTMLElement[] = [];
      root.querySelectorAll<HTMLElement>(FINE).forEach((el) => !skip(el) && (el.dataset.mo = 'pick', picked.push(el)));
      root.querySelectorAll<HTMLElement>(COARSE).forEach((el) => {
        if (skip(el) || el.querySelector('[data-mo]') || !el.getClientRects().length) return;
        el.dataset.mo = 'pick';
        picked.push(el);
      });
      const tops = new Map(picked.map((el) => [el, el.getBoundingClientRect().top]));
      picked.sort((a, b) => tops.get(a)! - tops.get(b)!);
      for (const el of picked) {
        el.classList.add('mo-auto');
        if (tops.get(el)! < fold) {
          if (!opening) {
            el.dataset.mo = 'seen'; // a block that lands on screen after the page opened: shown as is, no pop
            el.classList.remove('mo-auto');
            continue;
          }
          el.style.setProperty('--i', String(Math.min(rank++, OPEN_CAP)));
          // first open: the vault loader (index.html) still covers the page; the cascade plays as it dissolves
          if (booting()) {
            el.dataset.mo = 'wait';
            held.push(el);
          } else el.dataset.mo = 'go';
          continue;
        }
        el.style.setProperty('--i', String(Math.min(Array.prototype.indexOf.call(el.parentElement?.children ?? [], el), 4)));
        el.dataset.mo = 'wait';
        shared().observe(el);
      }
    };
    scan();
    let frame = 0;
    const mo = new MutationObserver((list) => {
      if (!root.isConnected) return mo.disconnect();
      if (frame || !list.some((m) => Array.prototype.some.call(m.addedNodes, (n: Node) => n.nodeType === 1))) return;
      frame = requestAnimationFrame(() => ((frame = 0), scan()));
    });
    mo.observe(root, { childList: true, subtree: true });
  }, []);

/** `--i` for a stagger. */
export const stag = (i: number, gap?: number): CSSProperties => ({ ['--i' as string]: i, ...(gap ? { ['--mo-gap' as string]: `${gap}ms` } : {}) });

/**
 * A figure that counts up from 0 the first time it is on screen. The final text holds the width (no layout shift) and
 * is what a screen reader and a reduced-motion viewer get.
 */
export const ViewCount = ({ value, decimals = 0, prefix = '', suffix = '', duration = 700, className }: { value: number; decimals?: number; prefix?: string; suffix?: string; duration?: number; className?: string }) => {
  const [ready] = useState(motionOk);
  const [seen, setSeen] = useState(false);
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!el || !ready) return;
    const o = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setSeen(true), o.disconnect()), { threshold: 0.2 });
    o.observe(el);
    return () => o.disconnect();
  }, [el, ready]);
  const final = `${prefix}${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  if (!ready) return <span className={className}>{final}</span>;
  return (
    <span ref={setEl} className={`mo-count ${className ?? ''}`} data-live={seen ? '1' : '0'} aria-label={final}>
      <span className="mo-count__size" aria-hidden={seen}>{final}</span>
      {seen && (
        <span className="mo-count__live" aria-hidden>
          {prefix}<CountUp value={value} decimals={decimals} duration={duration} />{suffix}
        </span>
      )}
    </span>
  );
};
