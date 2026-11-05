import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { identity, type AutographRoll, type AutographSnapshot } from '@/config/autographs';
import { autographFontsReady, loadAutographFonts } from './fonts';
import { compose, renderAutograph, renderLayers, CARD_H, CARD_W } from './render';
import './autograph.css';

interface AutographCanvasProps {
  snap: AutographSnapshot;
  roll: AutographRoll;
  /** Cache key (the autograph id); omit for previews that change every roll */
  cacheKey?: string;
  /** Write the signature in, left to right, once the card is on screen (the pack reveal) */
  write?: boolean;
  /** Delay before the writing starts, and how long it takes */
  writeDelayMs?: number;
  writeMs?: number;
  className?: string;
  label?: string;
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * One autograph card on a canvas, drawn at its displayed size × devicePixelRatio (capped at 2). It renders only once it
 * scrolls near the viewport, waits for his signature font (fonts.ts) before drawing, and reuses the cached render for
 * the same autograph and size. `write` plays the signature writing itself across the card (reduced motion: drawn whole).
 */
const AutographCanvas = ({ snap, roll, cacheKey, write = false, writeDelayMs = 0, writeMs = 1300, className, label }: AutographCanvasProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const family = identity(snap.name).hand.font;
  const [fontsOk, setFontsOk] = useState(() => autographFontsReady(family));

  // On screen (or close to it), and its displayed width
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '200px' });
    io.observe(el);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      io.disconnect();
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible || fontsOk) return;
    let live = true;
    loadAutographFonts(family, snap.name + (roll.inscription ?? '') + (snap.nickname ?? '')).then(() => live && setFontsOk(true));
    return () => {
      live = false;
    };
  }, [visible, fontsOk, family, snap.name, snap.nickname, roll.inscription]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !visible || !fontsOk || width <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Bucket the width so small resizes reuse the cached render
    const pw = Math.max(60, Math.ceil((width * dpr) / 20) * 20);
    const ph = Math.round((pw * CARD_H) / CARD_W);
    if (el.width !== pw || el.height !== ph) {
      el.width = pw;
      el.height = ph;
    }
    const ctx = el.getContext('2d');
    if (!ctx) return;
    if (!write || reducedMotion()) {
      const card = renderAutograph(snap, roll, pw, cacheKey);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(card, 0, 0);
      return;
    }
    const layers = renderLayers(snap, roll, pw);
    compose(ctx, layers, 0);
    let raf = 0;
    const t0 = performance.now() + writeDelayMs;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / writeMs));
      compose(ctx, layers, 1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible, fontsOk, width, snap, roll, cacheKey, write, writeDelayMs, writeMs]);

  return (
    <canvas
      ref={ref}
      className={cn('block aspect-[5/7] h-auto w-full rounded-[clamp(6px,5.2%,14px)] bg-panel', className)}
      role="img"
      aria-label={label ?? `${snap.name} autograph`}
    />
  );
};

export default AutographCanvas;
