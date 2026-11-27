import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findNFLTeam } from '@/utils/nflTeams';
import './spriteNameToast.css';

/*
 * Hover / focus name toast for every player sprite drawn as a figure in a scene or banner (owner: "for the season
 * banner and for any banner really where a player is displayed, if I hover over them have a small toast above them
 * show the player name").
 *
 * ONE DELEGATED LAYER, mounted once (pages/Index.tsx). GameSprite and CoachSprite mark their box with
 * `data-hover-name` (+ `-pos`, `-club`); sprites are pointer-events: none, so the layer hit-tests the pointer against
 * those boxes itself (one rAF-throttled pass per mouse move). It renders in a portal with position: fixed, so no
 * overflow:hidden banner clips it, nothing shifts, and there is only ever one toast. Mouse and pen only: a touch
 * never gets a hover state (taps keep opening the card). Keyboard: focusing an element that contains a marked sprite
 * shows his name. Excluded: the arcade games (a name would give the answer) and the screensaver (no pointer use).
 */
const SEL = '[data-hover-name]';
const SKIP = '.arcade, [aria-label^="Screensaver"]';
const MODAL = '[role="dialog"], [data-radix-popper-content-wrapper]';

interface Shown { name: string; pos: string; club: string; x: number; y: number; key: number }

const clubColor = (club?: string): string => {
  const t = findNFLTeam(club);
  if (!t) return '#d4a537';
  const [h, s, l] = t.primaryColor.split(/\s+/).map((v) => parseFloat(v));
  return `hsl(${h} ${s}% ${Math.max(l, 42)}%)`;
};

/** Where his head is: a figure's box is 64 units with the body in the middle band; a bust fills its box. */
const hitRect = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  if (el.classList.contains('overflow-hidden')) return { l: r.left, r: r.right, t: r.top, b: r.bottom, top: r.top };
  return { l: r.left + r.width * 0.27, r: r.right - r.width * 0.27, t: r.top + r.height * 0.1, b: r.bottom - r.height * 0.05, top: r.top + r.height * 0.1 };
};

const SpriteNameToast = () => {
  const [shown, setShown] = useState<Shown | null>(null);
  const cur = useRef<HTMLElement | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    let raf = 0;
    let px = 0;
    let py = 0;
    let focused: HTMLElement | null = null;

    const show = (el: HTMLElement | null) => {
      if (el === cur.current) return;
      cur.current = el;
      if (!el) return setShown(null);
      const h = hitRect(el);
      setShown({ name: el.dataset.hoverName ?? '', pos: el.dataset.hoverPos ?? '', club: el.dataset.hoverClub ?? '', x: (h.l + h.r) / 2, y: h.top, key: ++seq.current });
    };

    const pick = () => {
      raf = 0;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      const under = document.elementFromPoint(px, py);
      const modal = under?.closest(MODAL) ?? null;
      document.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
        const h = hitRect(el);
        if (px < h.l || px > h.r || py < h.t || py > h.b) return;
        if (el.closest(SKIP) || el.closest(MODAL) !== modal) return;
        const d = Math.abs(px - (h.l + h.r) / 2);
        if (d <= bestD) { best = el; bestD = d; }
      });
      show(best);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(pick);
    };
    const clear = () => { if (raf) cancelAnimationFrame(raf); raf = 0; show(focused); };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.matches?.(':focus-visible')) return;
      const el = t.matches(SEL) ? t : t.querySelector<HTMLElement>(SEL);
      focused = el && !el.closest(SKIP) ? el : null;
      show(focused);
    };
    const onFocusOut = () => { focused = null; show(null); };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', clear, { passive: true });
    document.documentElement.addEventListener('mouseleave', clear);
    window.addEventListener('scroll', clear, { passive: true, capture: true });
    window.addEventListener('blur', clear);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', clear);
      document.documentElement.removeEventListener('mouseleave', clear);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('blur', clear);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // his box left the page (a scene changed): the toast goes with it
  useEffect(() => {
    if (!shown) return;
    const id = window.setInterval(() => {
      if (cur.current && !cur.current.isConnected) { cur.current = null; setShown(null); }
    }, 400);
    return () => window.clearInterval(id);
  }, [shown]);

  if (!shown) return null;
  return createPortal(
    <div key={shown.key} className="sprite-toast" role="status" style={{ left: shown.x, top: shown.y, ['--st-club' as string]: clubColor(shown.club) }}>
      {shown.pos && <span className="sprite-toast__pos">{shown.pos}</span>}
      <span className="sprite-toast__name">{shown.name}</span>
    </div>,
    document.body,
  );
};

export default SpriteNameToast;
