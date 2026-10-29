import { flushSync } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { isLite } from '@/hooks/usePerfMode';
import { useDeferredStage } from '@/hooks/useDeferredStage';
import { ChevronLeft, ChevronRight, Crown, Hammer, Pin, PinOff, RotateCcw, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { findNFLTeam } from '@/utils/nflTeams';
import {
  FINISHES,
  VARIANTS,
  claimCard,
  claimCost,
  claimVariant,
  craftCost,
  craftUpgrade,
  displayOf,
  ownsCombo,
  packsToGo,
  setDisplay,
  type DisplayChoice,
  finishLabel,
  nextFinish,
  tierLabel,
  variantLabel,
  type Finish,
  type OwnedCard,
  type Tier,
  type Variant,
} from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import CardBack from './CardBack';
import { useFlipFaces } from './useFlipFaces';
import CardValue from './market/CardValue';
import { FINISH_ICON, FINISH_TEXT } from './rarityIcons';
import type { CardInfo } from './useCardPool';

export interface CardDetailTarget {
  info: CardInfo;
  /** Finish shown; defaults to the best owned */
  finish?: Finish;
  /** Art variant shown; defaults to the rarest owned */
  variant?: Variant;
  /** Tier shown (Card designs can show any tier); defaults to the player's */
  tier?: Tier;
  /** Card designs preview: no crafting, no ownership */
  preview?: boolean;
  /** On-screen box of the tapped card: the large card flies in from there */
  from?: DOMRect;
  /** Cards to step through with the arrows / ← → (the grid it was opened from) */
  list?: CardInfo[];
}

interface CardDetailProps {
  target: CardDetailTarget | null;
  entry?: OwnedCard;
  shards: number;
  /** Expected shards per Standard pack (for "about N packs to go") */
  shardsPerPack?: number;
  /** The player's display choice (variant × finish the card opens on) */
  display?: DisplayChoice;
  total: number;
  onClose: () => void;
  onPlayer?: (info: CardInfo) => void;
  /** Step to another card of target.list */
  onNavigate?: (info: CardInfo) => void;
}

const motionOk = () => {
  try {
    return !isLite() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Floating dust in the stadium light: [left %, size px, delay s, duration s]. */
const MOTES = [
  [6, 3, 0, 11],
  [14, 2, 3.2, 9],
  [22, 4, 6.1, 13],
  [31, 2, 1.4, 10],
  [39, 3, 7.5, 12],
  [47, 2, 4.4, 9],
  [55, 4, 2.2, 14],
  [63, 2, 8.3, 10],
  [70, 3, 0.8, 12],
  [78, 2, 5.6, 9],
  [86, 4, 3.9, 13],
  [93, 2, 6.8, 11],
] as const;

/** Last measured market panel height per card ('' = any card): the placeholder's size before it mounts */
const marketHeights = new Map<string, number>();

const UPGRADE_MS = 1500;
/** Next / previous: the outgoing card leaves in this many ms, the incoming one settles in NAV_IN_MS. */
const NAV_OUT_MS = 280;
const NAV_IN_MS = 440;
/** Close: the card flies back to its tile (or shrinks away) in this many ms; the panel fades faster. */
const EXIT_MS = 250;
const EXIT_PANEL_MS = 120;
const EXIT_FADE_MS = 120;
const EXIT_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** Horizontal swipe: past this distance (or a flick) it steps to the next card. */
const SWIPE_STEP = 64;
const SWIPE_FLICK = 0.5; // px per ms

type Dir = 1 | -1;
interface Outgoing {
  id: number;
  info: CardInfo;
  tier: Tier;
  variant: Variant;
  finish: Finish;
  dir: Dir;
  /** Where it was when it left (px): a swipe hands over the finger's offset, a click mid-slide the slide's */
  fromX: number;
}

/** translateX of an element's current transform plus its `translate` property (one style read). */
const currentX = (el: HTMLElement | null) => {
  if (!el) return 0;
  const cs = getComputedStyle(el);
  const m = cs.transform && cs.transform !== 'none' ? new DOMMatrixReadOnly(cs.transform).m41 : 0;
  const t = parseFloat(cs.translate) || 0;
  return m + t;
};

/** A fixed-position copy of the large card (its flipper) at `r`, above the dialog: what the open and close flights move. */
const ghostOf = (face: HTMLElement, r: DOMRect) => {
  const ghost = document.createElement('div');
  ghost.className = 'cd-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
  const copy = face.cloneNode(true) as HTMLElement;
  copy.style.visibility = '';
  copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  ghost.appendChild(copy);
  document.body.appendChild(ghost);
  return ghost;
};

/** The tile of this card, if it is on screen: the target of the close animation (null when off screen). */
const tileOf = (key: string): HTMLElement | null => {
  let sel = '';
  try {
    sel = `.fut[data-key="${CSS.escape(key)}"]`;
  } catch {
    return null;
  }
  // The swipe browser's current card (opened from there) wins over a binder tile hidden under it
  const target = document.querySelector<HTMLElement>(`[data-fly-target] ${sel}`);
  if (target?.getBoundingClientRect().width) return target;
  for (const el of document.querySelectorAll<HTMLElement>(sel)) {
    if (el.closest('.cd, [role="dialog"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
};

/**
 * Large card showcase: a team-colour stadium (spotlight, logo watermark, floating dust; gold rays for
 * Legendary), the card big and centred with pointer / device tilt and an idle sway, a flip to the card back
 * (career, awards, skill grades, career arc, set number), finish chips to preview each finish owned, "Set as display",
 * a shard claim and a one-tap upgrade (each with packs-to-go), "Open player card", and ← → (or a sideways swipe)
 * through the grid it came from: the old card slides out with a slight turn while the new one springs in, and the
 * info panel cross-fades. It grows from the tapped tile (FLIP) and, on every close (X, backdrop, Escape, swipe
 * down), flies back to it, or shrinks and fades when the tile is off screen. Reduced motion / performance mode: short
 * fades only.
 */
const CardDetail = ({ target, entry, shards, shardsPerPack = 0, display, total, onClose, onPlayer, onNavigate }: CardDetailProps) => {
  const [msg, setMsg] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState<Finish | null>(null);
  const [viewVariant, setViewVariant] = useState<Variant | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [out, setOut] = useState<Outgoing | null>(null);
  const [phase, setPhase] = useState<'open' | 'closing' | 'closed'>('open');
  const info = target?.info;
  const key = info?.key;
  const { face, backMounted } = useFlipFaces(flipped, key);
  const tier = target?.tier ?? info?.tier ?? 'common';
  // Opens on the target's variant / finish (Card designs), else the owner's display choice, else auto
  const shown = target?.preview ? null : displayOf(entry, display);
  const variant: Variant = viewVariant ?? target?.variant ?? (target?.preview ? 'jersey' : shown!.variant);
  const vEntry = entry?.variants[variant];
  const hasVariant = (v: Variant) => !!target?.preview || !!entry?.variants[v];
  const owned = (f: Finish) => !!target?.preview || !!vEntry?.counts[f] || vEntry?.best === f;
  const finish =
    view ?? (viewVariant ? vEntry?.best : undefined) ?? target?.finish ?? (shown && shown.variant === variant ? shown.finish : undefined) ?? vEntry?.best ?? 'base';
  const to = !target?.preview && vEntry ? nextFinish(vEntry.best) : null;
  const cost = to && info ? craftCost(to, info.tier, variant) : 0;
  const claimV = !target?.preview && info ? claimVariant(entry) : null;
  const claimPrice = info ? claimCost(info.tier) : 0;
  const isDisplay = !!shown?.pinned && shown.variant === variant && shown.finish === finish;
  const canPin = !target?.preview && ownsCombo(entry, variant, finish);
  const team = info ? findNFLTeam(info.player.team) : null;

  const list = target?.list ?? [];
  const idx = info ? list.findIndex((c) => c.key === info.key) : -1;
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  // New card: front side, its own finish, no message
  useEffect(() => {
    setFlipped(false);
    setView(null);
    setViewVariant(null);
    setMsg('');
    setUpgrading(false);
  }, [key]);

  useEffect(() => {
    if (!upgrading) return;
    const id = window.setTimeout(() => setUpgrading(false), UPGRADE_MS);
    return () => window.clearTimeout(id);
  }, [upgrading]);

  // Each open starts fresh; remember what had focus so closing can hand it back without scrolling the page
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = !!target;
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    // Reset during render, so a reopened dialog never starts in the closed phase (which has no open animation)
    setWasOpen(open);
    if (open) {
      setPhase('open');
      setOut(null);
    }
  }
  useEffect(() => {
    if (open) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);
  // The market panel (price history and chart) is the heaviest part of the view: it mounts once the first frame (the
  // dialog and the card) has been painted, into a placeholder of its size, so a tap opens the card at once and the
  // open flight (which measures the card after two frames) lands on the final layout
  const { stage: panelStage, late: panelLate } = useDeferredStage(open);
  const panelReady = panelStage >= 1;
  const marketRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const h = (marketRef.current?.firstElementChild as HTMLElement | null)?.offsetHeight;
    if (h && key) {
      marketHeights.set(key, h);
      marketHeights.set('', h);
    }
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  // The stage mounts a frame after open (the dialog portal), so it is tracked as state for the swipe effect
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const flyEl = useRef<HTMLDivElement | null>(null);
  const navIn = useRef<{ dir: Dir; fromX: number } | null>(null);
  const outSeq = useRef(0);

  // The large card mounts once per card (keyed). Three entrances: grow from the tapped tile (FLIP, with a spring at
  // the start), slide in from the side after next / previous, or (reduced motion) a short fade.
  const fromRef = useRef<DOMRect | undefined>(undefined);
  fromRef.current = target?.from;
  const flown = useRef<DOMRect | undefined>(undefined);
  const flyRef = useCallback((el: HTMLDivElement | null) => {
    flyEl.current = el;
    if (!el) return;
    const nav = navIn.current;
    navIn.current = null;
    if (typeof el.animate !== 'function') return;
    if (nav) {
      if (!motionOk()) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
        return;
      }
      const x0 = nav.fromX ? `${nav.fromX + nav.dir * 120}px` : `${nav.dir * 62}%`;
      // Slides in past its spot, then settles back (a small spring)
      el.animate(
        [
          { transform: `translateX(${x0}) rotate(${nav.dir * 6}deg) scale(0.94)`, opacity: 0, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
          { transform: `translateX(${-nav.dir * 2.5}%) rotate(${-nav.dir * 0.8}deg) scale(1.01)`, opacity: 1, offset: 0.62, easing: 'ease-in-out' },
          { transform: 'none', opacity: 1 },
        ],
        { duration: NAV_IN_MS },
      );
      return;
    }
    const from = fromRef.current;
    if (!from || flown.current === from || !motionOk()) return;
    flown.current = from;
    // The flight runs on a fixed-position copy above the dialog (never clipped by it, so the dialog's overflow and
    // scrollbar never change). The real card stays hidden in its place; the landing spot is measured only once layout
    // has settled (two frames: the dialog's bar, the panel and the fonts are in), and if anything still moved it by
    // the time the copy lands, the real card eases the last pixels from the copy's spot, so there is never a jump.
    const face = el.querySelector<HTMLElement>('.cd__flipper');
    if (!face) return;
    face.style.visibility = 'hidden';
    let ghost: HTMLDivElement | null = null;
    const show = () => {
      face.style.visibility = '';
      ghost?.remove();
    };
    const start = () => {
      if (!face.isConnected) return show();
      const r = face.getBoundingClientRect();
      if (!r.width) return show();
      const s = from.width / r.width;
      const dx = from.left + from.width / 2 - (r.left + r.width / 2);
      const dy = from.top + from.height / 2 - (r.top + r.height / 2);
      ghost = ghostOf(face, r);
      const a = ghost.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
          { transform: `translate(${dx}px, ${dy - 18}px) scale(${s * 1.12}) rotate(-2deg)`, offset: 0.16, easing: 'cubic-bezier(0.25, 1.15, 0.35, 1)' },
          { transform: 'none' },
        ],
        { duration: 620, fill: 'forwards' },
      );
      const land = () => {
        if (!face.isConnected) return show();
        const now = face.getBoundingClientRect();
        const ox = r.left - now.left;
        const oy = r.top - now.top;
        show();
        if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) face.animate([{ translate: `${ox}px ${oy}px` }, { translate: '0 0' }], { duration: 160, easing: 'ease-out' });
      };
      a.onfinish = land;
      a.oncancel = show;
    };
    const ready = (document as Document & { fonts?: FontFaceSet }).fonts?.status === 'loaded' ? Promise.resolve() : (document.fonts?.ready ?? Promise.resolve());
    void ready.then(() => requestAnimationFrame(() => requestAnimationFrame(start)));
  }, []);

  // The outgoing card (a copy of the old one) slides away in the travel direction, then unmounts
  const outRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || typeof el.animate !== 'function') return;
    const id = Number(el.dataset.out);
    const dir = Number(el.dataset.dir) as Dir;
    const fromX = Number(el.dataset.from) || 0;
    const a = el.animate(
      [
        { transform: `translateX(${fromX}px) rotate(${fromX / 40}deg)`, opacity: 1 },
        { transform: `translateX(calc(${fromX}px + ${-dir * 70}%)) rotate(${-dir * 9}deg) scale(0.92)`, opacity: 0 },
      ],
      { duration: NAV_OUT_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' },
    );
    const done = () => setOut((o) => (o?.id === id ? null : o));
    a.onfinish = done;
    a.oncancel = done;
  }, []);

  /**
   * Steps to another card of the list. Rapid steps never stack: each one replaces the outgoing copy with the card on
   * screen now (picked up from wherever its own entrance had got to) and the newest card slides in.
   */
  const go = (toInfo: CardInfo | null, dir: Dir, fromX = 0) => {
    if (!toInfo || !onNavigate || !info || phase !== 'open') return;
    if (motionOk()) {
      const x = fromX || currentX(flyEl.current);
      setOut({ id: ++outSeq.current, info, tier, variant, finish, dir, fromX: x });
      navIn.current = { dir, fromX: 0 };
      sideRef.current?.animate?.(
        [
          { opacity: 0, transform: `translateX(${dir * 18}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    } else {
      navIn.current = { dir, fromX: 0 };
      sideRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 140 });
    }
    onNavigate(toInfo);
  };
  const goRef = useRef(go);
  goRef.current = go;
  const navRef = useRef({ prev, next });
  navRef.current = { prev, next };

  // Touch: a sideways swipe on the card steps through the list. The axis locks on the first move: sideways is ours,
  // downward belongs to swipe-to-dismiss (useSwipeToDismiss), upward is scrolling.
  useEffect(() => {
    const el = stageEl;
    if (!el || !list.length) return;
    let sx = 0;
    let sy = 0;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    let state: 'idle' | 'pending' | 'drag' | 'off' = 'idle';
    const card = () => flyEl.current;
    const onStart = (e: TouchEvent) => {
      state = 'off';
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest('button:not(.fut__card), input, select, [data-no-swipe]')) return;
      sx = lastX = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      lastT = e.timeStamp;
      vel = 0;
      state = 'pending';
    };
    const onMove = (e: TouchEvent) => {
      if (state !== 'pending' && state !== 'drag') return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (state === 'pending') {
        if (Math.abs(dx) <= Math.abs(dy)) {
          state = 'off';
          return;
        }
        state = 'drag';
      }
      if (e.cancelable) e.preventDefault();
      if (e.timeStamp > lastT) vel = 0.7 * ((t.clientX - lastX) / (e.timeStamp - lastT)) + 0.3 * vel;
      lastX = t.clientX;
      lastT = e.timeStamp;
      const c = card();
      if (c && motionOk()) {
        // Resist past the ends of the list
        const { prev: p, next: n } = navRef.current;
        const edge = (dx > 0 && !p) || (dx < 0 && !n);
        const x = edge ? dx * 0.3 : dx;
        c.style.transition = 'none';
        c.style.translate = `${x}px 0`;
        c.style.rotate = `${x / 40}deg`;
      }
    };
    const onEnd = () => {
      if (state !== 'drag') {
        state = 'idle';
        return;
      }
      state = 'idle';
      const dx = lastX - sx;
      const { prev: p, next: n } = navRef.current;
      const dir: Dir = dx < 0 ? 1 : -1;
      const toInfo = dir === 1 ? n : p;
      const commit = !!toInfo && (Math.abs(dx) > SWIPE_STEP || (Math.abs(vel) > SWIPE_FLICK && Math.abs(dx) > 24));
      const c = card();
      if (commit) {
        if (c) {
          c.style.translate = '';
          c.style.rotate = '';
        }
        goRef.current(toInfo, dir, motionOk() ? dx : 0);
      } else if (c) {
        c.style.transition = 'translate 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), rotate 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
        c.style.translate = '';
        c.style.rotate = '';
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [stageEl, list.length]);

  /**
   * Every close (X, backdrop, Escape, swipe down) comes through here, one path. The tile and the large card are
   * measured once, before anything moves. A fixed-position copy of the large card (at its current tilt, sway and drag
   * offset) flies back into the tile, or shrinks to 0.92 and fades when the tile is off screen, while the info panel
   * fades out fast and the stage and backdrop fade with the flight. The real card is hidden under the copy and the tile
   * stays hidden until the copy lands; the copy, the tile and the dialog then swap in one frame (the dialog closes with
   * no exit animation of its own). Transform and opacity only. Reduced motion / performance mode: a 120 ms fade.
   */
  const close = () => {
    if (phase !== 'open') return;
    const box = contentRef.current;
    if (!box || typeof box.animate !== 'function') {
      onClose();
      return;
    }
    setPhase('closing');
    const overlay = box.previousElementSibling as HTMLElement | null;
    const finishWith = (cleanup?: () => void) => {
      let done = false;
      return () => {
        if (done) return;
        done = true;
        cleanup?.();
        // The 'closed' phase (no exit animation for the dialog or its backdrop) must be on screen before the dialog
        // closes: the caller may close it from a store (utils/slot.ts), whose update renders on its own, ahead of a
        // batched setState, and Radix would then wait forever for a backdrop animation that never ends
        flushSync(() => setPhase('closed'));
        onClose();
      };
    };
    if (!motionOk()) {
      const fade = { duration: EXIT_FADE_MS, easing: 'linear', fill: 'forwards' as const };
      overlay?.animate?.([{ opacity: 1 }, { opacity: 0 }], fade);
      const a = box.animate([{ opacity: 1 }, { opacity: 0 }], fade);
      const finish = finishWith();
      a.onfinish = finish;
      a.oncancel = finish;
      window.setTimeout(finish, EXIT_FADE_MS * 4);
      return;
    }

    // Measure everything once
    const face = flyEl.current?.querySelector<HTMLElement>('.cd__flipper') ?? null;
    const r = face?.getBoundingClientRect() ?? null;
    const tileEl = key ? tileOf(key) : null;
    const tile = tileEl?.getBoundingClientRect() ?? null;
    const sway = flyEl.current?.querySelector<HTMLElement>('.cd__sway') ?? null;
    const swayT = sway ? getComputedStyle(sway).transform : 'none';
    const tiltT = face?.querySelector<HTMLElement>('.fut__card') ? getComputedStyle(face.querySelector<HTMLElement>('.fut__card')!).transform : 'none';

    const ease = EXIT_EASE;
    const fadeFast = { duration: EXIT_PANEL_MS, easing: 'ease-out', fill: 'forwards' as const };
    box.querySelectorAll<HTMLElement>('.cd__side, .cd__nav, .cd__flip, .dlg-bar').forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], fadeFast));
    overlay?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, easing: ease, fill: 'forwards' });
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, easing: ease, fill: 'forwards' });

    let ghost: HTMLDivElement | null = null;
    let anim: Animation | null = null;
    if (face && r && r.width) {
      // The copy: same size and place as the large card, above the dialog, starting at its current sway and tilt
      ghost = ghostOf(face, r);
      const card = ghost.querySelector<HTMLElement>('.fut__card');
      if (card) card.style.transform = tiltT;
      face.style.visibility = 'hidden';
      if (tileEl) tileEl.style.opacity = '0';
      const start = swayT === 'none' ? '' : swayT;
      if (tile && tile.width) {
        const s = tile.width / r.width;
        const dx = tile.left + tile.width / 2 - (r.left + r.width / 2);
        const dy = tile.top + tile.height / 2 - (r.top + r.height / 2);
        anim = ghost.animate([{ transform: start || 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], { duration: EXIT_MS, easing: ease, fill: 'forwards' });
      } else {
        anim = ghost.animate(
          [
            { transform: start || 'none', opacity: 1 },
            { transform: 'scale(0.92)', opacity: 0 },
          ],
          { duration: EXIT_MS, easing: ease, fill: 'forwards' },
        );
      }
      // Level the copy's tilt during the flight, so it lands flat on the flat tile
      if (card && tiltT !== 'none') card.animate([{ transform: tiltT }, { transform: 'none' }], { duration: EXIT_MS, easing: ease, fill: 'forwards' });
    }
    const finish = finishWith(() => {
      ghost?.remove();
      if (tileEl) tileEl.style.opacity = '';
    });
    if (anim) {
      anim.onfinish = finish;
      anim.oncancel = finish;
    } else window.setTimeout(finish, EXIT_MS);
    // Safety net: never leave a half-closed dialog or a hidden tile behind
    window.setTimeout(finish, EXIT_MS * 4);
  };

  const craft = () => {
    if (!info || !to) return;
    const done = craftUpgrade(info.player, info.tier, variant);
    if (done) {
      setView(done);
      setFlipped(false);
      setUpgrading(motionOk());
      setMsg(`Upgraded to ${finishLabel(done)}!`);
    } else setMsg('Not enough shards.');
  };

  const claim = () => {
    if (!info) return;
    const v = claimCard(info.player, info.tier);
    if (v) {
      setViewVariant(v);
      setView('base');
      setFlipped(false);
      setMsg(`Claimed the ${variantLabel(v)} card!`);
    } else setMsg('Not enough shards.');
  };

  const pin = (on: boolean) => {
    if (!info) return;
    if (on ? setDisplay(info.player, { variant, finish }) : setDisplay(info.player, null))
      setMsg(on ? `${variantLabel(variant)} ${finishLabel(finish)} is now his display card.` : 'Display set back to auto (rarest art, best finish).');
  };

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea')) return;
    if (e.key === 'ArrowLeft' && prev && onNavigate) {
      e.preventDefault();
      go(prev, -1);
    } else if (e.key === 'ArrowRight' && next && onNavigate) {
      e.preventDefault();
      go(next, 1);
    }
  };

  const vars = (team ? { '--cd-a': `hsl(${team.primaryColor})`, '--cd-b': `hsl(${team.secondaryColor})` } : {}) as CSSProperties;
  const claimTogo = claimV ? packsToGo(claimPrice, shards, shardsPerPack) : null;
  const craftTogo = to ? packsToGo(cost, shards, shardsPerPack) : null;

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent
        ref={contentRef}
        className={cn(
          'cd max-h-[calc(var(--safe-h)-0.5rem)] max-w-5xl overflow-y-auto border-line bg-night p-0',
          `cd--${tier}`,
          upgrading && 'cd--upgrading',
          phase === 'closing' && 'cd--closing',
          phase === 'closed' && 'cd--exited',
        )}
        style={vars}
        overlayClassName={phase === 'closed' ? 'cd-overlay--exited' : undefined}
        swipeHandoff
        onKeyDown={onKey}
        onCloseAutoFocus={(e) => {
          // Hand focus back to the tile without scrolling the page (iOS jumps otherwise)
          e.preventDefault();
          const el = returnFocus.current;
          if (el?.isConnected) el.focus({ preventScroll: true });
        }}
      >
        {info && (
          <div className="cd__inner">
            <div className="cd__bg" aria-hidden="true">
              <span className="cd__wash" />
              {tier === 'legendary' && <span className="cd__rays" />}
              <span className="cd__spot" />
              <span className="cd__mark">{team ? <TeamLogo team={info.player.team} size={360} decorative /> : '★'}</span>
              <span className="cd__motes">
                {MOTES.map(([x, sz, d, dur], i) => (
                  <i key={i} style={{ left: `${x}%`, width: sz, height: sz, animationDelay: `${d}s`, animationDuration: `${dur}s` }} />
                ))}
              </span>
              <span className="cd__floor" />
            </div>

            <div className="cd__body">
              <div className="cd__stage" ref={setStageEl}>
                <button
                  type="button"
                  className="cd__nav cd__nav--prev"
                  onClick={() => go(prev, -1)}
                  disabled={!prev || !onNavigate}
                  aria-label={prev ? `Previous card: ${prev.player.name}` : 'Previous card'}
                  hidden={!list.length}
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                {out && (
                  <div className="cd__fly cd__fly--out" key={`out-${out.id}`} ref={outRef} data-out={out.id} data-dir={out.dir} data-from={out.fromX} aria-hidden="true">
                    <div className="cd__face">
                      <CollectibleCard
                        owned
                        large
                        player={out.info.player}
                        tier={out.tier}
                        finish={out.finish}
                        variant={out.variant}
                        ovr={out.info.ovr}
                        number={out.info.number}
                        stats={out.info.stats}
                        setNo={out.info.setNo}
                        setTotal={total}
                      />
                    </div>
                  </div>
                )}
                <div className="cd__fly" ref={flyRef} key={key}>
                  <div className="cd__sway">
                    <div className={cn('cd__flipper', flipped && 'is-flipped')} data-face={face}>
                      <div className="cd__face" aria-hidden={flipped}>
                        <CollectibleCard
                          owned
                          large
                          live
                          player={info.player}
                          tier={tier}
                          finish={finish}
                          variant={variant}
                          ovr={info.ovr}
                          number={info.number}
                          stats={info.stats}
                          setNo={info.setNo}
                          setTotal={total}
                          marks={entry?.marks}
                          pinned={isDisplay}
                        />
                        {upgrading && (
                          <span className="cd__up" aria-hidden="true">
                            <span className="cd__up-ring" />
                            <span className="cd__up-beam" />
                            <span className="cd__up-stamp">{finishLabel(finish)}!</span>
                          </span>
                        )}
                      </div>
                      <div className="cd__face cd__face--back" aria-hidden={!flipped}>
                        {backMounted && <CardBack info={info} tier={tier} total={total} variant={variant} finish={finish} />}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="cd__nav cd__nav--next"
                  onClick={() => go(next, 1)}
                  disabled={!next || !onNavigate}
                  aria-label={next ? `Next card: ${next.player.name}` : 'Next card'}
                  hidden={!list.length}
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
                <button type="button" className="cd__flip" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {flipped ? 'Show front' : 'Flip card'}
                </button>
              </div>

              <div className="cd__side" ref={sideRef}>
                <div>
                  <p className={cn('cd__kicker', `cd__kicker--${tier}`)}>
                    {tierLabel(tier)}
                    {list.length > 1 && idx >= 0 && (
                      <span className="ml-2 font-mono text-muted-foreground">
                        {idx + 1}/{list.length}
                      </span>
                    )}
                  </p>
                  <DialogTitle className="font-display text-4xl uppercase italic leading-none">{info.player.name}</DialogTitle>
                  <DialogDescription className="mt-1.5">
                    {variantLabel(variant)} · {finishLabel(finish)} · {POSITION_NAMES[info.player.position] ?? info.player.position} · {info.cardTeam} · OVR {info.ovr ?? '–'}
                  </DialogDescription>
                </div>

                <div>
                  <p className="cd__label" id="cd-variants">
                    {target?.preview ? 'Art variants' : `Your variants · ${VARIANTS.filter((v) => hasVariant(v.key)).length}/${VARIANTS.length}`}
                  </p>
                  <ul className="flex flex-wrap gap-1.5" aria-labelledby="cd-variants">
                    {VARIANTS.map((v) => {
                      const has = hasVariant(v.key);
                      const e = entry?.variants[v.key];
                      return (
                        <li key={v.key}>
                          <button
                            type="button"
                            className={cn('cd-chip cd-vchip', `cd-vchip--${v.key}`, variant === v.key && 'is-on')}
                            onClick={() => {
                              setViewVariant(v.key);
                              setView(null);
                              setFlipped(false);
                            }}
                            disabled={!has}
                            aria-pressed={variant === v.key}
                            title={has ? `Show the ${v.label} variant` : `${v.label} not owned yet`}
                          >
                            <i className={cn('vdot', `vdot--${v.key}`, has && 'is-owned')} aria-hidden="true" />
                            {v.short}
                            {e && !target?.preview && <span className="text-muted-foreground">· {finishLabel(e.best)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <p className="cd__label">{target?.preview ? 'Finishes' : `Your finishes · ${variantLabel(variant)}`}</p>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Preview a finish">
                    {FINISHES.map((f) => {
                      const Icon = FINISH_ICON[f.key];
                      const n = vEntry?.counts[f.key] ?? 0;
                      const has = owned(f.key);
                      return (
                        <li key={f.key}>
                          <button
                            type="button"
                            className={cn('cd-chip', `cd-chip--${f.key}`, finish === f.key && 'is-on')}
                            onClick={() => {
                              setView(f.key);
                              setFlipped(false);
                            }}
                            disabled={!has}
                            aria-pressed={finish === f.key}
                            title={has ? `Preview the ${f.label} finish` : `${f.label} not owned yet`}
                          >
                            <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[f.key])} aria-hidden="true" />
                            {f.label}
                            {n > 1 && <span className="font-mono text-muted-foreground">×{n}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {canPin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={cn('cd-pin', isDisplay && 'is-on')}
                      onClick={() => pin(true)}
                      aria-pressed={isDisplay}
                      disabled={isDisplay}
                      title="Show this variant and finish on his binder tile and when his card opens"
                    >
                      <Pin className="h-4 w-4" aria-hidden="true" />
                      {isDisplay ? 'Display card' : 'Set as display'}
                    </button>
                    {shown?.pinned && (
                      <button type="button" className="cd-pin cd-pin--reset" onClick={() => pin(false)}>
                        <PinOff className="h-4 w-4" aria-hidden="true" />
                        Reset to auto
                      </button>
                    )}
                  </div>
                )}

                {claimV && (
                  <button type="button" onClick={claim} disabled={claimPrice > shards} className="cd-craft cd-craft--claim">
                    <span className="cd-craft__icon">
                      <Crown className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-display text-xl font-extrabold uppercase italic leading-none">
                        {tier === 'legendary' ? 'Legend claim' : 'Claim'} · {variantLabel(claimV)}
                      </span>
                      <span className="mt-1 block text-xs opacity-80">
                        Base card · {claimPrice.toLocaleString()} shards · you have {shards.toLocaleString()}
                        {claimTogo && ` · ${claimTogo}`}
                      </span>
                      <span className="cd-craft__bar" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, (shards / Math.max(1, claimPrice)) * 100)}%` }} />
                      </span>
                    </span>
                  </button>
                )}

                {to && (
                  <button type="button" onClick={craft} disabled={cost > shards} className={cn('cd-craft', `cd-craft--${to}`)}>
                    <span className="cd-craft__icon">
                      <Hammer className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-display text-xl font-extrabold uppercase italic leading-none">Upgrade to {finishLabel(to)}</span>
                      <span className="mt-1 block text-xs opacity-80">
                        {variantLabel(variant)} · {cost.toLocaleString()} shards · you have {shards.toLocaleString()}
                        {craftTogo && ` · ${craftTogo}`}
                      </span>
                      <span className="cd-craft__bar" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, (shards / Math.max(1, cost)) * 100)}%` }} />
                      </span>
                    </span>
                  </button>
                )}

                {!target?.preview &&
                  (panelReady ? (
                    <div ref={marketRef} className={cn('contents', panelLate && 'cd-market--late')}>
                      <CardValue cardKey={info.key} name={info.player.name} finish={finish} variant={variant} ownedFinish={vEntry?.best} player={info.player} />
                    </div>
                  ) : (
                    <div className="cd-market-ph" style={{ minHeight: marketHeights.get(info.key) ?? marketHeights.get('') ?? 480 }} aria-hidden="true" />
                  ))}

                {onPlayer && (
                  <button type="button" onClick={() => onPlayer(info)} className="cd-btn">
                    <UserRound className="h-4 w-4" aria-hidden="true" /> Open player card
                  </button>
                )}
                <p className="text-sm font-semibold text-gold" role="status">
                  {msg}
                </p>
                {list.length > 1 && <p className="hidden text-xs text-muted-foreground sm:block">← → to browse cards</p>}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardDetail;
