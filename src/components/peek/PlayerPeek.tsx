import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, IdCard, Radar, Star, Swords } from 'lucide-react';
import type { Player } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { isHallOfFamer } from '@/config/stats';
import { ovrLabelOf, useOfficialOvr } from '@/utils/useOfficialOvr';
import { useSkillRatings } from '@/utils/useSkillRatings';
import { useJerseyNumbers } from '@/utils/jerseys';
import { bannerTeamOf } from '@/utils/playerExtras';
import { findNFLTeam } from '@/utils/nflTeams';
import { getReadableTextOn } from '@/utils/teamColors';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { readRecent } from '@/utils/playerSearch';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { headlineStats } from '@/components/player/statLines';
import { warmPlayerCard } from '@/components/player/warmPlayerCard';
import { openInCompFinder, openInHeadToHead, prefillHeadToHead } from '@/components/stats/comps/compFinderLink';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import GameSprite from '@/components/GameSprite';
import InLeague from '@/components/InLeague';
import TeamLogo from '@/components/brand/TeamLogo';
import { PEEK_ACTION_EVENT } from './peekProps';
import './playerPeek.css';

/*
 * Quick look ("peek"): press and hold any player (about 450 ms) for a compact preview card by the finger, with
 * Open card, Deep Dive, Head-to-Head and Compare under it.
 *
 * ONE PROVIDER, DELEGATED. <PlayerPeekLayer /> (mounted once, in Index) listens on the document for presses on
 * anything marked `data-player-key="POS:Name"`, so a call site is one spread: <tr {...peekProps(player)}>.
 *
 *   hold 450 ms, moving under 10 px     the card opens near the finger (a move cancels it: scrolling stays free)
 *   keep the finger down and slide      the action under the finger lights up; release on it to run it
 *   release anywhere else               the card stays open for taps; a tap outside or a swipe down closes it
 *   right-click (desktop), the menu key the card opens; plain clicks are unchanged everywhere
 *
 * A long press never also fires the element's click (the click that follows is swallowed). While the finger is down
 * on an open card, the page doesn't scroll (a non-passive touchmove on the pressed element only, for that gesture).
 * Nothing re-renders per move but the hovered action (its own tiny store); the action rects are read once, when the
 * card is placed. Skipped: inside the arcade's live game (.hall-game: a peek would give answers away), inside other
 * dialogs (the player card is already open there) unless they opt in with data-peek-ok, and under [data-no-peek].
 *
 * PEEK-THROUGH. Art that never takes taps (a sprite with pointer-events: none over a story's cover button) marks itself
 * data-peek-through: when the pressed element has no player of its own, the nearest such mark under the finger within
 * a few ancestors counts, so the hold finds him while a tap still lands on whatever is underneath.
 */

const HOLD_MS = 450;
const SLOP = 10;
const SKIP = '.hall-game, [data-no-peek], input, textarea, select, [contenteditable="true"]';
/** How many ancestors up a press looks for peek-through art under the finger */
const THROUGH_DEPTH = 4;

/** (x, y) falls outside what a clipping ancestor (overflow other than visible) shows of the mark, up to `top` */
const clipped = (m: Element, top: Element, x: number, y: number) => {
  for (let c = m.parentElement; c && c !== top.parentElement; c = c.parentElement) {
    if (getComputedStyle(c).overflow === 'visible') continue;
    const r = c.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true;
  }
  return false;
};

/** The peek-through mark under (x, y) nearest the press, in the pressed element's own neighbourhood */
const throughAt = (n: Element, x: number, y: number): HTMLElement | null => {
  let a: Element | null = n;
  for (let i = 0; a && i < THROUGH_DEPTH; a = a.parentElement, i++) {
    const marks = a.querySelectorAll<HTMLElement>('[data-peek-through][data-player-key]');
    if (!marks.length) continue;
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    marks.forEach((m) => {
      const r = m.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom || m.closest(SKIP) || clipped(m, a!, x, y)) return;
      const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    });
    return best;
  }
  return null;
};

// ---------- Store (outside React: the gesture never re-renders anything until the card opens) ----------

type ActionId = 'card' | 'dive' | 'h2h' | 'compare';
interface PeekState {
  key: string;
  x: number;
  y: number;
  /** The finger is still down from the long press (press-slide-release is live) */
  held: boolean;
  /** Opened from the keyboard: focus the first action */
  keyboard?: boolean;
}

const makeStore = <T,>(initial: T) => {
  let v = initial;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n: T) => {
      if (n === v) return;
      v = n;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
};

const peek = makeStore<PeekState | null>(null);
const hover = makeStore<ActionId | null>(null);
/** Rects of the action buttons in viewport px, read once when the card is placed */
let actionRects: { id: ActionId; l: number; t: number; r: number; b: number }[] = [];
/** Recently peeked players, newest first (the Compare action's default opponent) */
const peeked: string[] = [];
/** Runs an action of the open card (set by the card): a press-slide-release lands here */
let invoke: ((id: ActionId) => void) | null = null;

const closePeek = () => {
  hover.set(null);
  peek.set(null);
};

const hit = (x: number, y: number): ActionId | null => actionRects.find((a) => x >= a.l && x <= a.r && y >= a.t && y <= a.b)?.id ?? null;

const haptic = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not supported */
  }
};

// ---------- Layer ----------

const PlayerPeekLayer = () => {
  const { getAllPlayers, dataVersion } = useLeague();
  const byKey = useMemo(() => {
    const m = new Map<string, Player>();
    getAllPlayers().forEach((p) => !p.isRealLegend && m.set(`${p.position}:${p.name}`, p));
    return m;
    // dataVersion bumps after edits and uploads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllPlayers, dataVersion]);
  const byKeyRef = useRef(byKey);
  byKeyRef.current = byKey;
  const state = useSyncExternalStore(peek.subscribe, peek.get, peek.get);
  // The data hooks mount on the first peek and stay (no cost at page load)
  const [armed, setArmed] = useState(false);
  const [card, setCard] = useState<Player | null>(null);
  const run = useRef<(id: ActionId, p: Player, other: Player | null) => void>(() => undefined);
  run.current = (id, p, other) => {
    closePeek();
    window.dispatchEvent(new CustomEvent(PEEK_ACTION_EVENT, { detail: { id, key: `${p.position}:${p.name}` } }));
    if (id === 'card') setCard(p);
    else if (id === 'dive') openInCompFinder(p);
    else if (id === 'h2h') prefillHeadToHead(p);
    else if (other) openInHeadToHead(p, other);
  };

  useEffect(() => {
    if (state && !armed) setArmed(true);
  }, [state, armed]);

  // The gesture: delegated, capture phase, passive except for the one pressed element while it is held
  useEffect(() => {
    let timer = 0;
    let start: { x: number; y: number; id: number; el: HTMLElement; key: string } | null = null;
    let swallowClick = false;
    let lastX = 0;
    let lastY = 0;
    let lost = false;

    // While the card is held open, the finger's slide belongs to it: no page scroll, and no sheet or dialog under it
    // starts a swipe-to-dismiss drag (their listeners sit above the pressed element)
    const blockScroll = (e: TouchEvent) => {
      if (!peek.get()?.held) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    };
    const detach = () => {
      start?.el.removeEventListener('touchmove', blockScroll);
    };
    const cancel = () => {
      window.clearTimeout(timer);
      timer = 0;
      detach();
      start = null;
      lost = false;
    };
    const target = (t: EventTarget | null, x: number, y: number): { el: HTMLElement; key: string } | null => {
      const n = t instanceof Element ? t : null;
      if (!n || n.closest(SKIP)) return null;
      const el = n.closest<HTMLElement>('[data-player-key]') ?? throughAt(n, x, y);
      if (!el) return null;
      const dlg = el.closest('[role="dialog"], [role="alertdialog"]');
      if (dlg && !dlg.closest('[data-peek-ok]')) return null;
      const key = el.dataset.playerKey ?? '';
      return byKeyRef.current.has(key) ? { el, key } : null;
    };
    const open = (key: string, x: number, y: number, held: boolean, keyboard = false) => {
      hover.set(null);
      actionRects = [];
      peek.set({ key, x, y, held, keyboard });
      warmPlayerCard(byKeyRef.current.get(key));
    };

    const onDown = (e: PointerEvent) => {
      swallowClick = false;
      if (peek.get()?.held) return;
      if (e.button !== 0) return;
      const t = target(e.target, e.clientX, e.clientY);
      if (!t) return;
      cancel();
      start = { x: e.clientX, y: e.clientY, id: e.pointerId, ...t };
      lastX = e.clientX;
      lastY = e.clientY;
      if (e.pointerType !== 'mouse') t.el.addEventListener('touchmove', blockScroll, { passive: false });
      timer = window.setTimeout(() => {
        timer = 0;
        if (!start) return;
        swallowClick = true;
        haptic();
        open(start.key, lastX, lastY, true);
      }, HOLD_MS);
    };
    const onMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (timer) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancel();
        return;
      }
      if (peek.get()?.held) hover.set(hit(e.clientX, e.clientY));
    };
    // Release: on an action runs it; anywhere else leaves the card open for taps
    const release = (x: number, y: number) => {
      const s = peek.get();
      if (timer || !s?.held) {
        cancel();
        return;
      }
      const id = hit(x, y);
      cancel();
      if (id && invoke) invoke(id);
      else {
        hover.set(null);
        peek.set({ ...s, held: false });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (start && e.pointerId === start.id) release(e.clientX, e.clientY);
    };
    // The browser took the touch for a scroll after all (it can't always be blocked in time): keep following the
    // finger through touch events, which keep coming, until it lifts
    const onCancel = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (timer || !peek.get()?.held || e.pointerType !== 'touch') {
        const s = peek.get();
        cancel();
        if (s?.held) peek.set({ ...s, held: false });
        return;
      }
      lost = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (lost && t && peek.get()?.held) hover.set(hit(t.clientX, t.clientY));
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!lost || !start || !t) return;
      lost = false;
      release(t.clientX, t.clientY);
    };
    // The click that ends a long press never reaches the element
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      // Wherever it lands (the element, the backdrop now under the finger, an action already run on release)
      e.preventDefault();
      e.stopPropagation();
    };
    const onContext = (e: MouseEvent) => {
      const t = target(e.target, e.clientX, e.clientY);
      if (!t) return;
      e.preventDefault();
      // A touch hold opens through the timer (Android also fires contextmenu then)
      if (start) return;
      let { clientX: x, clientY: y } = e;
      const keyboard = x === 0 && y === 0;
      if (keyboard) {
        const r = t.el.getBoundingClientRect();
        x = r.left + Math.min(r.width / 2, 120);
        y = r.top + r.height / 2;
      }
      open(t.key, x, y, false, keyboard);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && peek.get()) {
        e.stopPropagation();
        closePeek();
      }
    };
    const onScroll = () => {
      // A page scroll (not one we blocked) moves the anchor away: close a card that is no longer held
      if (peek.get() && !peek.get()?.held) closePeek();
    };

    // A press on the card is not a press outside an open dialog or sheet underneath (Radix listens on the document
    // and would close it); stopped at <body>, after React's own listener there has seen it
    const shield = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.pk-root')) e.stopPropagation();
    };
    document.body.addEventListener('pointerdown', shield);

    const opt = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', onDown, opt);
    window.addEventListener('pointermove', onMove, opt);
    window.addEventListener('pointerup', onUp, opt);
    window.addEventListener('pointercancel', onCancel, opt);
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onContext, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchmove', onTouchMove, opt);
    window.addEventListener('touchend', onTouchEnd, opt);
    window.addEventListener('touchcancel', onTouchEnd, opt);
    return () => {
      cancel();
      document.body.removeEventListener('pointerdown', shield);
      window.removeEventListener('pointerdown', onDown, opt);
      window.removeEventListener('pointermove', onMove, opt);
      window.removeEventListener('pointerup', onUp, opt);
      window.removeEventListener('pointercancel', onCancel, opt);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('contextmenu', onContext, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchmove', onTouchMove, opt);
      window.removeEventListener('touchend', onTouchEnd, opt);
      window.removeEventListener('touchcancel', onTouchEnd, opt);
    };
  }, []);

  const player = state ? byKey.get(state.key) ?? null : null;

  return (
    <>
      {armed && player && state && <PeekCard player={player} state={state} byKey={byKey} run={run} />}
      <PlayerDetailCard player={card} onClose={() => setCard(null)} />
    </>
  );
};

// ---------- Card ----------

const ACTIONS: { id: ActionId; label: string; Icon: typeof IdCard }[] = [
  { id: 'card', label: 'Open card', Icon: IdCard },
  { id: 'dive', label: 'Deep Dive', Icon: Radar },
  { id: 'h2h', label: 'Head-to-Head', Icon: Swords },
  { id: 'compare', label: 'Compare', Icon: ArrowLeftRight },
];

const fmt = (v: number | null, d = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));

/** Compare's default opponent: the last other player peeked or searched, else his closest peer by Career Legacy */
const compareTarget = (p: Player, byKey: Map<string, Player>): Player | null => {
  const self = `${p.position}:${p.name}`;
  for (const k of [...peeked, ...readRecent()]) {
    const o = k !== self ? byKey.get(k) : undefined;
    if (o) return o;
  }
  let best: Player | null = null;
  byKey.forEach((o) => {
    if (o === p || o.position !== p.position) return;
    if (!best || Math.abs(o.careerLegacy - p.careerLegacy) < Math.abs(best.careerLegacy - p.careerLegacy)) best = o;
  });
  return best;
};

const lastName = (name: string) => {
  const i = name.indexOf(' ');
  return i < 0 ? name : name.slice(i + 1);
};

const PeekCard = ({
  player: p,
  state,
  byKey,
  run,
}: {
  player: Player;
  state: PeekState;
  byKey: Map<string, Player>;
  run: { current: (id: ActionId, p: Player, other: Player | null) => void };
}) => {
  const ovr = useOfficialOvr().get(`${p.position}:${p.name}`);
  const grade = useSkillRatings().get(`${p.position}:${p.name}`)?.grade;
  const { numberFor } = useJerseyNumbers();
  const club = bannerTeamOf(p);
  const team = findNFLTeam(club);
  const other = useMemo(() => compareTarget(p, byKey), [p, byKey]);
  const stats = headlineStats(p).slice(0, 4);
  const hof = isHallOfFamer(p);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const [below, setBelow] = useState(false);
  const swipeRef = useSwipeToDismiss<HTMLDivElement>({ onDismiss: closePeek, backdrop: () => backdropRef.current });

  useEffect(() => {
    invoke = (id) => run.current(id, p, other);
    return () => {
      invoke = null;
    };
  }, [p, other, run]);

  // Remember him for the next Compare (after this card picked its own opponent)
  useEffect(() => {
    const k = `${p.position}:${p.name}`;
    return () => {
      const i = peeked.indexOf(k);
      if (i >= 0) peeked.splice(i, 1);
      peeked.unshift(k);
      peeked.length = Math.min(peeked.length, 6);
    };
  }, [p]);

  // Place it once, by the finger: above it when there is room (the actions end near the finger), else below it with
  // the actions first. Clamped to the visual viewport (the keyboard may be up). Then read the action rects once.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const vv = window.visualViewport;
    const top0 = vv?.offsetTop ?? 0;
    const left0 = vv?.offsetLeft ?? 0;
    const vw = vv?.width ?? window.innerWidth;
    const vh = vv?.height ?? window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pad = 12;
    const gap = 18;
    const fx = state.x - left0;
    const fy = state.y - top0;
    let y: number;
    let flip = false;
    if (fy - gap - h >= pad) y = fy - gap - h;
    else if (fy + gap + h <= vh - pad) {
      y = fy + gap;
      flip = true;
    } else y = Math.max(pad, Math.min(vh - pad - h, fy - h / 2));
    const x = Math.max(pad, Math.min(vw - pad - w, fx - w / 2));
    el.style.left = `${Math.round(x + left0)}px`;
    el.style.top = `${Math.round(y + top0)}px`;
    el.style.setProperty('--pk-ox', `${Math.round(fx - x)}px`);
    el.style.setProperty('--pk-oy', `${Math.round(fy - y)}px`);
    setBelow(flip);
  }, [state.x, state.y]);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const L = parseFloat(el.style.left) || 0;
    const T = parseFloat(el.style.top) || 0;
    actionRects = [...el.querySelectorAll<HTMLElement>('.pk-act')].map((b) => {
      let l = 0;
      let t = 0;
      for (let n: HTMLElement | null = b; n && n !== el; n = n.offsetParent as HTMLElement | null) {
        l += n.offsetLeft;
        t += n.offsetTop;
      }
      // A little slack around each button: a finger is not a cursor
      return { id: b.dataset.act as ActionId, l: L + l - 4, t: T + t - 4, r: L + l + b.offsetWidth + 4, b: T + t + b.offsetHeight + 4 };
    });
    if (state.keyboard) el.querySelector<HTMLButtonElement>('.pk-act')?.focus();
  }, [below, state.keyboard]);

  const vars = {
    '--pk-1': team ? `hsl(${team.primaryColor})` : 'hsl(var(--line))',
    '--pk-2': team ? `hsl(${team.secondaryColor})` : 'hsl(var(--muted-foreground))',
    '--pk-fg': team ? getReadableTextOn(team.primaryColor) : 'hsl(var(--chalk))',
  } as CSSProperties;
  const i = p.name.indexOf(' ');
  const first = i < 0 ? '' : p.name.slice(0, i);

  return createPortal(
    <div className="pk-root" data-held={state.held ? '' : undefined}>
      <div ref={backdropRef} className="pk-backdrop" onClick={closePeek} aria-hidden="true" />
      <div
        ref={(n) => {
          cardRef.current = n;
          swipeRef(n);
        }}
        role="dialog"
        aria-modal="false"
        aria-label={`Quick look: ${p.name}`}
        className={below ? 'pk-card pk-card--below' : 'pk-card'}
        style={vars}
      >
        <div className="pk-anim">
          <div className="pk-head">
            <div className="pk-preview" data-swipe-handle>
              <span className="pk-logo" aria-hidden="true">
                {club && <TeamLogo team={club} size={120} decorative />}
              </span>
              <span className="pk-figure" aria-hidden="true">
                <span className="pk-floor" />
                <GameSprite player={p} kind="figure" size="m" />
              </span>
              <div className="pk-id">
                <span className="pk-kicker">
                  {p.position} · #{numberFor(p)}
                  {team ? ` · ${team.abbreviation}` : ''}
                </span>
                {first && <span className="pk-first">{first}</span>}
                <span className="pk-last">{lastName(p.name)}</span>
                <span className="pk-tags">
                  <InLeague player={p} />
                  {hof && (
                    <span className="pk-hof">
                      <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                      HOF
                    </span>
                  )}
                  {!team && <span className="pk-fa">Free agent</span>}
                </span>
              </div>
              <div className="pk-rate">
                {ovr != null && (
                  <span className="pk-ovr">
                    <b>{ovr}</b>
                    <i>{ovrLabelOf(p)}</i>
                  </span>
                )}
                {grade && (
                  <span className="pk-grade" style={{ background: grade.color }} title="Skill grade">
                    {grade.grade}
                  </span>
                )}
              </div>
            </div>
            <dl className="pk-stats" aria-label={`${POSITION_NAMES[p.position]} career numbers`}>
              {stats.map((s) => (
                <div key={s.key} title={s.title}>
                  <dt>{s.label}</dt>
                  <dd>
                    {fmt(s.value, s.decimals)}
                    {s.suffix ?? ''}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <PeekActions onRun={(id) => run.current(id, p, other)} compareLabel={other ? `vs ${lastName(other.name)}` : 'Compare'} />
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** The four actions: the only part that re-renders while a finger slides over them */
const PeekActions = memo(({ onRun, compareLabel }: { onRun: (id: ActionId) => void; compareLabel: string }) => {
  const hot = useSyncExternalStore(hover.subscribe, hover.get, hover.get);
  useEffect(() => {
    if (hot) haptic();
  }, [hot]);
  return (
    <div className="pk-actions" role="group" aria-label="Actions">
      {ACTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="pk-act"
          data-act={id}
          data-hot={hot === id ? '' : undefined}
          data-no-press
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onRun(id)}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          <span>{id === 'compare' ? compareLabel : label}</span>
        </button>
      ))}
    </div>
  );
});
PeekActions.displayName = 'PeekActions';

export default PlayerPeekLayer;
