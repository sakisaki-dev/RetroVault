import { createElement, useCallback, useEffect, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode, type RefCallback } from 'react';
import CountUp from '@/components/brand/CountUp';
import { isLite } from '@/hooks/usePerfMode';
import '@/hooks/motion.css';

/**
 * Scroll-in motion, once. The container is "wait" while its mo-* children are held back and "go" after it first
 * scrolls into view (one shared IntersectionObserver). Reduced motion and lite mode never hold anything back.
 */
const motionOk = () => {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return false;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
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
export const useAutoReveal = <T extends HTMLElement>(): RefCallback<T> =>
  useCallback((root: T | null) => {
    if (!root || !motionOk()) return;
    let first = true;
    const scan = () => {
      // what is already on screen when the page opens is never held back (no blank flash on load); a section that
      // lands later (a lazy chunk, a fetched file) rises in as it arrives
      const fold = first ? window.innerHeight : -1;
      first = false;
      root.querySelectorAll<HTMLElement>('section[aria-labelledby] > *, [data-mo-stack] > *').forEach((el) => {
        if (el.dataset.mo || el.closest('[data-mo], [data-no-mo]')) return;
        if (fold > 0 && el.getBoundingClientRect().top < fold - 24) {
          el.dataset.mo = 'seen'; // on screen at load: never held back, never rescanned
          return;
        }
        el.classList.add('mo-auto');
        el.style.setProperty('--i', String(Math.min(Array.prototype.indexOf.call(el.parentElement?.children ?? [], el), 4)));
        el.dataset.mo = 'wait';
        shared().observe(el);
      });
    };
    scan();
    let frame = 0;
    new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), scan()));
    }).observe(root, { childList: true, subtree: true });
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
