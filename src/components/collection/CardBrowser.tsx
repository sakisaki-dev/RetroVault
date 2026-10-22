import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, RotateCcw, X } from 'lucide-react';
import { isLite } from '@/hooks/usePerfMode';
import { cn } from '@/lib/utils';
import {
  FINISHES,
  VARIANTS,
  displayOf,
  finishLabel,
  ownsCombo,
  tierLabel,
  variantLabel,
  type DisplayChoice,
  type Finish,
  type OwnedCard,
  type Variant,
} from '@/utils/collection';
import { useSpriteTable, lookFor } from './art/sprite/faces';
import CollectibleCard from './CollectibleCard';
import CardBack from './CardBack';
import { FINISH_ICON, FINISH_TEXT } from './rarityIcons';
import type { CardInfo } from './useCardPool';

/*
 * Swipe browser: a full-screen carousel over the binder's current filter and sort (owned cards only). One large card
 * in the middle, the neighbours peeking at the edges with a slight 3D turn. Sideways drags move through the cards
 * with momentum and a spring snap; the axis locks on the first few pixels, so a vertical drag is never a step: up
 * opens the full CardDetail, down closes back to the binder (which never scrolled). Tap the card to flip it, tap a
 * neighbour to go to it. Variant dots under the card cycle the player's owned variant × finish combos (the display
 * choice first). Keys: ← → step, Space flips, Enter opens the details, Esc closes.
 *
 * Only five cards are mounted (the current one ± 2), so the next card's sprite bitmap is already built when it slides
 * in; custom sprite images and photos a few cards further out are fetched ahead. Every frame of motion writes only
 * `transform` / `opacity` on those five slots. Performance mode: no 3D turn or scale (a flat slide); reduced motion:
 * no slide either, the new card fades in.
 *
 * The cards come from the caller's `owned` (useCollection), so a pack being revealed stays hidden here too.
 */

interface CardBrowserProps {
  open: boolean;
  /** Owned cards in the binder's filter and sort */
  list: CardInfo[];
  owned: Record<string, OwnedCard>;
  display?: Record<string, DisplayChoice>;
  total: number;
  /** A dialog (CardDetail, the player card) is open on top: keys and gestures pause */
  covered?: boolean;
  /** Go straight to this card (CardDetail stepped to it) */
  focusKey?: string | null;
  onClose: () => void;
  onDetails: (info: CardInfo, variant: Variant, finish: Finish, from?: DOMRect) => void;
}

const SESSION_KEY = 'retroVault:browseKey';
const WINDOW = 2; // cards mounted either side of the current one
const PRELOAD = 4; // custom sprite images / photos fetched this far ahead
const TAP_MS = 450;
const LOCK_PX = 8;
const CLOSE_PX = 120;
const DETAILS_PX = 80;
const FLICK = 0.5; // px per ms
const MOMENTUM_S = 0.26; // how far a fling carries: velocity × this, in seconds
const SPRING_K = 210;
const SPRING_C = 2 * Math.sqrt(SPRING_K) * 0.9;

type Mode = 'full' | 'flat' | 'still';
const motionMode = (): Mode => {
  let reduce = false;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* no matchMedia */
  }
  if (reduce) return 'still';
  return isLite() ? 'flat' : 'full';
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const readSession = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};
const writeSession = (k: string) => {
  try {
    sessionStorage.setItem(SESSION_KEY, k);
  } catch {
    /* storage blocked: the position lasts this open only */
  }
};

/** Every variant × finish he owns, in variant order then finish order. */
const combosOf = (entry: OwnedCard | undefined) =>
  VARIANTS.flatMap((v) => FINISHES.filter((f) => ownsCombo(entry, v.key, f.key)).map((f) => ({ variant: v.key, finish: f.key })));

const CardBrowser = ({ open, list, owned, display, total, covered = false, focusKey, onClose, onDetails }: CardBrowserProps) => {
  const n = list.length;
  const table = useSpriteTable();
  // Current card (integer): decides which five are mounted. The float position lives in posRef.
  const [center, setCenter] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picks, setPicks] = useState<Record<string, { variant: Variant; finish: Finish }>>({});
  const [closing, setClosing] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<number, HTMLDivElement>());
  const posRef = useRef(0);
  const targetRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef(0);
  const spacingRef = useRef(260);
  const modeRef = useRef<Mode>('full');
  const centerRef = useRef(0);
  centerRef.current = center;
  const listRef = useRef(list);
  listRef.current = list;

  // ---------- Placement (transform / opacity on the mounted slots only) ----------
  const place = useCallback(() => {
    const pos = posRef.current;
    const sp = spacingRef.current;
    const mode = modeRef.current;
    slots.current.forEach((el, i) => {
      const p = i - pos;
      const a = Math.abs(p);
      let t: string;
      let o: number;
      if (mode === 'full') {
        const turn = clamp(-p, -1.4, 1.4) * 26;
        const s = 1 - Math.min(a, 2) * 0.13;
        t = `translate3d(${(p * sp).toFixed(2)}px,0,${(-Math.min(a, 2) * 60).toFixed(1)}px) rotateY(${turn.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        o = a > 1.4 ? Math.max(0, 1 - (a - 1.4) * 1.6) : 1;
      } else if (mode === 'flat') {
        const s = 1 - Math.min(a, 2) * 0.1;
        t = `translate3d(${(p * sp).toFixed(2)}px,0,0) scale(${s.toFixed(4)})`;
        o = a > 1.4 ? Math.max(0, 1 - (a - 1.4) * 1.6) : 1 - Math.min(a, 1) * 0.25;
      } else {
        t = `translate3d(${(p * sp).toFixed(2)}px,0,0)`;
        o = a < 0.5 ? 1 : a > 1.4 ? 0 : 0.45;
      }
      el.style.transform = t;
      el.style.opacity = String(o);
      el.style.zIndex = String(10 - Math.round(a * 2));
    });
  }, []);

  const settleCenter = useCallback(() => {
    const c = clamp(Math.round(posRef.current), 0, Math.max(0, listRef.current.length - 1));
    if (c !== centerRef.current) {
      centerRef.current = c;
      setCenter(c);
    }
  }, []);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  /** Spring to card `to`, starting at velocity v0 (cards per second). Reduced motion: jump, and fade the card in. */
  const animateTo = useCallback(
    (to: number, v0 = 0) => {
      const last = Math.max(0, listRef.current.length - 1);
      to = clamp(Math.round(to), 0, last);
      targetRef.current = to;
      stop();
      if (modeRef.current === 'still') {
        const moved = Math.round(posRef.current) !== to;
        posRef.current = to;
        velRef.current = 0;
        place();
        settleCenter();
        // No slide: the new card fades in
        if (moved) slots.current.get(to)?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
        return;
      }
      velRef.current = v0;
      let prev = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.032, (now - prev) / 1000);
        prev = now;
        const x = posRef.current - targetRef.current;
        const acc = -SPRING_K * x - SPRING_C * velRef.current;
        velRef.current += acc * dt;
        posRef.current += velRef.current * dt;
        if (Math.abs(posRef.current - targetRef.current) < 0.0015 && Math.abs(velRef.current) < 0.03) {
          posRef.current = targetRef.current;
          velRef.current = 0;
          rafRef.current = 0;
          place();
          settleCenter();
          return;
        }
        place();
        settleCenter();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [place, settleCenter],
  );

  // ---------- Open / close ----------
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      // Start on the remembered card when it is in this filter, else the first
      const remembered = readSession();
      const start = Math.max(0, list.findIndex((c) => c.key === (focusKey ?? remembered)));
      setCenter(start);
      setFlipped(false);
      setClosing(false);
    }
  }

  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    modeRef.current = motionMode();
    posRef.current = targetRef.current = centerRef.current;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // The binder stays exactly where it was: lock the page scroll and put it back on close
    const y = window.scrollY;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    rootRef.current?.focus({ preventScroll: true });
    // Entrance: a short rise and fade (transform / opacity on the stage; reduced motion: fade only)
    const mode = modeRef.current;
    rootRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: mode === 'still' ? 120 : 200, easing: 'ease-out' });
    if (mode !== 'still')
      stageRef.current?.animate?.([{ transform: 'translateY(36px) scale(0.94)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)' });
    return () => {
      stop();
      html.style.overflow = prevOverflow;
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
      const el = returnFocus.current;
      if (el?.isConnected) el.focus({ preventScroll: true });
    };
    // Runs once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(
    (fromY = 0) => {
      if (closing) return;
      const root = rootRef.current;
      const stage = stageRef.current;
      const mode = modeRef.current;
      if (!root || typeof root.animate !== 'function') return onClose();
      setClosing(true);
      stop();
      const ms = mode === 'still' ? 120 : 220;
      const a = root.animate([{ opacity: Number(root.style.opacity || 1) }, { opacity: 0 }], { duration: ms, easing: 'ease-in', fill: 'forwards' });
      if (mode !== 'still')
        stage?.animate?.([{ transform: `translateY(${fromY}px)` }, { transform: `translateY(${Math.max(fromY + 160, window.innerHeight * 0.45)}px) scale(0.9)` }], {
          duration: ms,
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
          fill: 'forwards',
        });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        onClose();
      };
      a.onfinish = finish;
      a.oncancel = finish;
      window.setTimeout(finish, ms * 4);
    },
    [closing, onClose],
  );

  // Reset styles left by the exit once fully closed
  useEffect(() => {
    if (open) return;
    setClosing(false);
  }, [open]);

  // ---------- Keep the position when the list or the requested card changes ----------
  const curKey = list[center]?.key;
  const lastKey = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!open || !n) return;
    // The list changed under us (an upgrade moved him in the sort): follow the same card
    const want = lastKey.current;
    if (want && list[centerRef.current]?.key !== want) {
      const i = list.findIndex((c) => c.key === want);
      const to = i >= 0 ? i : clamp(centerRef.current, 0, n - 1);
      stop();
      posRef.current = targetRef.current = to;
      centerRef.current = to;
      setCenter(to);
    }
  }, [list, n, open]);
  useEffect(() => {
    if (!open || !focusKey) return;
    const i = listRef.current.findIndex((c) => c.key === focusKey);
    if (i < 0 || i === centerRef.current) return;
    stop();
    posRef.current = targetRef.current = i;
    centerRef.current = i;
    setCenter(i);
  }, [focusKey, open]);
  useEffect(() => {
    if (!open || !curKey) return;
    lastKey.current = curKey;
    writeSession(curKey);
    setFlipped(false);
  }, [curKey, open]);

  // Slots mount / unmount with the window: place the new ones at once (before paint)
  useLayoutEffect(() => {
    if (open) place();
  });

  // Card spacing from the card's width (neighbours peek in from the edges)
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const w = parseFloat(getComputedStyle(stage).getPropertyValue('--cbw-w')) || stage.querySelector<HTMLElement>('.cbw__slot')?.offsetWidth || 300;
      const vw = stage.clientWidth || window.innerWidth;
      // Neighbour's near edge about 28px in from the screen edge on phones; further apart on wide screens
      spacingRef.current = Math.max(w * 0.78, Math.min(w * 1.08, vw / 2 - 28 + w * 0.43));
      place();
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, place]);

  // ---------- Preload custom sprite images and photos a few cards out ----------
  useEffect(() => {
    if (!open || !n) return;
    const urls: string[] = [];
    for (let i = center - PRELOAD; i <= center + PRELOAD; i++) {
      const c = list[i];
      if (!c) continue;
      const look = lookFor(c.player, table);
      if (look.image) urls.push(`${import.meta.env.BASE_URL}data/sprites/${look.image}`);
      const photo = (c.player as { photo?: { url?: string } }).photo?.url;
      if (c.player.isRealLegend && photo) urls.push(photo);
    }
    urls.forEach((u) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = u;
    });
  }, [open, n, center, list, table]);

  // ---------- Selected variant × finish per card ----------
  const comboOf = (c: CardInfo) => {
    const pick = picks[c.key];
    if (pick && ownsCombo(owned[c.key], pick.variant, pick.finish)) return pick;
    const d = displayOf(owned[c.key], display?.[c.key]);
    return { variant: d.variant, finish: d.finish };
  };

  const details = useCallback(() => {
    const c = listRef.current[centerRef.current];
    if (!c || closing) return;
    const face = slots.current.get(centerRef.current)?.querySelector<HTMLElement>('.fut');
    const combo = comboOf(c);
    onDetails(c, combo.variant, combo.finish, face?.getBoundingClientRect());
    // comboOf reads picks / owned / display from this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, onDetails, picks, owned, display]);
  const detailsRef = useRef(details);
  detailsRef.current = details;
  const closeRef = useRef(close);
  closeRef.current = close;

  // ---------- Gestures (pointer events: touch, pen and mouse drag alike) ----------
  useEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage || covered || closing) return;
    let id = -1;
    let sx = 0;
    let sy = 0;
    let st = 0;
    let startPos = 0;
    let axis: 'none' | 'x' | 'up' | 'down' = 'none';
    let samples: { t: number; x: number; y: number }[] = [];
    let dragY = 0;

    const setY = (y: number, animate: boolean) => {
      dragY = y;
      stage.style.transition = animate ? 'translate 0.4s cubic-bezier(0.34, 1.4, 0.64, 1)' : 'none';
      stage.style.translate = y ? `0 ${y}px` : '';
      const bg = bgRef.current;
      if (bg) {
        bg.style.transition = animate ? 'opacity 0.3s ease' : 'none';
        bg.style.opacity = y > 0 ? String(Math.max(0.2, 1 - y / (window.innerHeight * 0.7))) : '';
      }
    };
    const velocity = () => {
      const now = samples[samples.length - 1];
      const old = samples.find((s) => now.t - s.t < 100) ?? samples[0];
      const dt = now.t - old.t;
      return dt > 0 ? { vx: (now.x - old.x) / dt, vy: (now.y - old.y) / dt } : { vx: 0, vy: 0 };
    };

    const onDown = (e: PointerEvent) => {
      if (id !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if ((e.target as HTMLElement).closest('button, a, input, select')) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      st = e.timeStamp;
      // Catch a card in flight
      stop();
      startPos = posRef.current;
      axis = 'none';
      samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
      if (samples.length > 8) samples.shift();
      if (axis === 'none') {
        if (Math.hypot(dx, dy) < LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : dy < 0 ? 'up' : 'down';
        try {
          stage.setPointerCapture(id);
        } catch {
          /* already released */
        }
        stage.dataset.moving = '';
      }
      e.preventDefault();
      if (axis === 'x') {
        const last = listRef.current.length - 1;
        let p = startPos - dx / spacingRef.current;
        // Rubber band past the ends
        if (p < 0) p *= 0.3;
        else if (p > last) p = last + (p - last) * 0.3;
        posRef.current = p;
        place();
        settleCenter();
      } else if (modeRef.current !== 'still') {
        setY(axis === 'down' ? Math.max(0, dy) : Math.min(0, dy) * 0.45, false);
      }
    };
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (e.pointerId !== id) return;
      id = -1;
      delete stage.dataset.moving;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const { vx, vy } = velocity();
      if (axis === 'none') {
        if (cancelled || e.timeStamp - st > TAP_MS) return animateTo(targetRef.current);
        // A tap: the current card flips, a neighbour comes to the middle
        const slot = (e.target as HTMLElement).closest<HTMLElement>('.cbw__slot');
        const i = slot ? Number(slot.dataset.i) : NaN;
        if (Number.isNaN(i)) return animateTo(targetRef.current);
        if (i === centerRef.current) setFlipped((f) => !f);
        else animateTo(i);
        return;
      }
      if (axis === 'x') {
        const cardsPerS = -(vx * 1000) / spacingRef.current;
        const from = Math.round(startPos);
        let to = Math.round(posRef.current + (cancelled ? 0 : cardsPerS * MOMENTUM_S));
        // A flick always moves at least one card
        if (!cancelled && to === from && Math.abs(vx) > FLICK && Math.abs(dx) > 16) to = from + (vx < 0 ? 1 : -1);
        animateTo(to, cancelled ? 0 : cardsPerS);
        return;
      }
      if (axis === 'down' && !cancelled && (dy > CLOSE_PX || (vy > FLICK && dy > 40))) {
        closeRef.current(dragY);
        return;
      }
      if (axis === 'up' && !cancelled && (-dy > DETAILS_PX || (vy < -FLICK && dy < -30))) {
        setY(0, true);
        detailsRef.current();
        return;
      }
      setY(0, modeRef.current !== 'still');
    };
    const onUp = (e: PointerEvent) => end(e, false);
    const onCancel = (e: PointerEvent) => end(e, true);
    // Clicks after a drag never reach the cards
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove, { passive: false });
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onCancel);
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onCancel);
      stage.style.translate = '';
      stage.style.transition = '';
    };
  }, [open, covered, closing, place, settleCenter, animateTo]);

  // ---------- Keyboard ----------
  useEffect(() => {
    if (!open || covered || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      const onControl = !!t?.closest('button, a, input, select, textarea') && t !== rootRef.current;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        animateTo(targetRef.current + (e.key === 'ArrowRight' ? 1 : -1), velRef.current);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === ' ' && !onControl) {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'Enter' && !onControl) {
        e.preventDefault();
        detailsRef.current();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        animateTo(e.key === 'Home' ? 0 : listRef.current.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, covered, closing, animateTo]);

  const slotRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) slots.current.set(i, el);
    else slots.current.delete(i);
  };

  const mounted = useMemo(() => {
    const out: number[] = [];
    for (let i = Math.max(0, center - WINDOW); i <= Math.min(n - 1, center + WINDOW); i++) out.push(i);
    return out;
  }, [center, n]);

  if (!open || typeof document === 'undefined') return null;

  const cur = list[center];
  const entry = cur ? owned[cur.key] : undefined;
  const combo = cur ? comboOf(cur) : null;
  const combos = combosOf(entry);
  const FinishIcon = combo ? FINISH_ICON[combo.finish] : null;
  const pickCombo = (variant: Variant, finish: Finish) => {
    if (!cur) return;
    setPicks((p) => ({ ...p, [cur.key]: { variant, finish } }));
    setFlipped(false);
  };

  return createPortal(
    <div
      ref={rootRef}
      className={cn('cbw', closing && 'cbw--closing')}
      role="dialog"
      aria-modal="true"
      aria-label="Swipe through your cards"
      aria-describedby="cbw-help"
      tabIndex={-1}
      // While a dialog is open on top, this one is inert (React 18 passes the attribute through as a string)
      {...(covered ? { inert: '' } : {})}
    >
      <div className="cbw__bg" ref={bgRef} aria-hidden="true" />
      <p id="cbw-help" className="sr-only">
        Left and right arrows move between cards, Space flips the card, Enter opens its details, Escape closes.
      </p>
      <div className="cbw__top">
        <div className="cbw__progress" aria-live="polite">
          {n > 0 && (
            <>
              <span className="cbw__count">
                {center + 1} <span className="opacity-60">/ {n}</span>
              </span>
              <span className="cbw__bar" aria-hidden="true">
                <i style={{ transform: `scaleX(${n > 1 ? (center + 1) / n : 1})` } as CSSProperties} />
              </span>
            </>
          )}
        </div>
        <button type="button" className="cbw__x" onClick={() => close()} aria-label="Close and go back to the binder">
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {n === 0 ? (
        <div className="cbw__empty" role="status">
          <p className="font-display text-2xl uppercase italic">No cards to swipe</p>
          <p className="text-sm text-muted-foreground">None of your cards match this binder filter. Clear a filter or open a pack.</p>
          <button type="button" className="cbw__btn" onClick={() => close()}>
            Back to the binder
          </button>
        </div>
      ) : (
        <>
          <div className="cbw__stage" ref={stageRef}>
            {mounted.map((i) => {
              const c = list[i];
              const active = i === center;
              const k = comboOf(c);
              return (
                <div
                  key={c.key}
                  ref={slotRef(i)}
                  className={cn('cbw__slot', active && 'is-active')}
                  data-i={i}
                  data-fly-target={active ? '' : undefined}
                  aria-hidden={!active}
                >
                  <div className={cn('cd__flipper', active && flipped && 'is-flipped')}>
                    <div className="cd__face" aria-hidden={active && flipped}>
                      <CollectibleCard
                        owned
                        large={active}
                        live={active}
                        player={c.player}
                        tier={c.tier}
                        finish={k.finish}
                        variant={k.variant}
                        ovr={c.ovr}
                        number={c.number}
                        stats={c.stats}
                        setNo={c.setNo}
                        setTotal={total}
                        marks={owned[c.key]?.marks}
                      />
                    </div>
                    {active && (
                      <div className="cd__face cd__face--back" aria-hidden={!flipped}>
                        {flipped && <CardBack info={c} tier={c.tier} total={total} variant={k.variant} finish={k.finish} />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {cur && combo && (
            <div className="cbw__info">
              {combos.length > 1 && (
                <ul className="cbw__dots" aria-label={`${cur.player.name}'s variants and finishes`}>
                  {combos.map((x, j) => {
                    const on = x.variant === combo.variant && x.finish === combo.finish;
                    const groupStart = j > 0 && combos[j - 1].variant !== x.variant;
                    return (
                      <li key={`${x.variant}-${x.finish}`} className={cn(groupStart && 'cbw__dots-gap')}>
                        <button
                          type="button"
                          className={cn('cbw__dot', `cbw__dot--${x.finish}`, on && 'is-on')}
                          aria-pressed={on}
                          aria-label={`${variantLabel(x.variant)}, ${finishLabel(x.finish)}`}
                          title={`${variantLabel(x.variant)} · ${finishLabel(x.finish)}`}
                          onClick={() => pickCombo(x.variant, x.finish)}
                        >
                          <i aria-hidden="true">{VARIANTS.find((v) => v.key === x.variant)?.short[0]}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="cbw__name">{cur.player.name}</p>
              <p className="cbw__team">
                {cur.player.position} · {cur.cardTeam}
                {cur.ovr != null && <> · OVR {cur.ovr}</>}
              </p>
              <ul className="cbw__chips" aria-label="Card">
                <li className={cn('cbw__chip col-gem', `col-gem--${cur.tier}`)}>
                  <i aria-hidden="true" />
                  {tierLabel(cur.tier)}
                </li>
                <li className="cbw__chip">
                  {FinishIcon && <FinishIcon className={cn('h-3.5 w-3.5', FINISH_TEXT[combo.finish])} aria-hidden="true" />}
                  {finishLabel(combo.finish)}
                </li>
                <li className="cbw__chip">{variantLabel(combo.variant)}</li>
              </ul>
              <div className="cbw__actions">
                <button type="button" className="cbw__btn cbw__btn--ghost" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {flipped ? 'Front' : 'Flip'}
                </button>
                <button type="button" className="cbw__btn" onClick={details}>
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  Details
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
};

export default CardBrowser;
