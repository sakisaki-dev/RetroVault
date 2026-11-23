import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { Hammer, Repeat, Signature, Sparkles, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sfx } from '@/utils/sfx';
import { useCurrentClub } from '@/utils/club';
import { PACKS, PACK_SHARDS, beginReveal, endReveal, finishLabel, finishRank, prizmInfo, prizmSerial, prizmStamp, tierLabel, tierRank, variantLabel, type Finish, type PackCard, type PackType, type Tier } from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import CardBackArt from './CardBackArt';
import Walkout from './Walkout';
import { bestLast, needsWalkout, skipStep, walkoutBeats, type WkBeat } from './walkoutBeats';
import type { CardInfo } from './useCardPool';
import AutographCanvas from './autograph/AutographCanvas';
import { autographValue, fmtMult, identity, parallelOf, serialStr } from '@/config/autographs';
import { loadAutographFonts } from './autograph/fonts';
import { useSampleAutos } from './autograph/sample';
import { kitStamp, kitUniform, type Uniform } from './art/sprite/uniforms';
import PackTunnel, { type BoardText, type TunnelHandle } from './tunnel/PackTunnel';
import type { TunnelGeo } from './tunnel/drawTunnel';
import './kits.css';

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * "Out of the tunnel" (owner approved the storyboard, 2026-11-16). The whole opening plays in a players' tunnel
 * (tunnel/PackTunnel.tsx), the stadium bright at its mouth:
 *
 * sealed   the pack hangs in the light at the tunnel's mouth; tap, Space or drag across the top to tear (the drag is
 *          the one the owner likes: the strip lifts with the finger, foil sparks fly off it, the pack shakes harder
 *          the better the pack type). The pack is rolled when the tear completes.
 * tearing  the strip flies off with paper and foil bits; cameras flash in the stands (more for better pack types).
 *          Nothing here depends on what was pulled: no beam, no tier-coloured light, no finish hint.
 * reveal   the cards land face down, big, on the tunnel floor (best last); a tap anywhere on the stage flips the next,
 *          a tap on a face-down card flips that one. The jumbotron keeps count of what has been turned ("2 OF 5 · RARE
 *          ON THE BOARD") and the crowd gets louder with each better card flipped. Legendary / Holo / autographs /
 *          throwbacks / Gold and Black Prizms / decoys walk out instead, in this same tunnel (Walkout.tsx, tunnel mode)
 * summary  the pack's cards in a grid, the best pull highlighted, shards gained, Add to binder / Open next pack
 */
type Phase = 'sealed' | 'tearing' | 'reveal' | 'summary';

/** Short line under the pack art. */
const PACK_SUB: Record<PackType, string> = {
  standard: '3 cards',
  premium: '4 cards · Silver+ inside',
  elite: '5 cards · Epic+ inside',
  perfect: '5 cards · 3 chase slots',
  holo: '5 cards · 1 Holo inside',
  exchange: 'League cards for your legends',
};

const TEAR_MS = 720;
/** Flip time: every card, and the best (last) card, which turns slowest. */
const FLIP_MS = 620;
const FLIP_BEST_MS = 1000;
/** The flip's curve (tunnel.css .pk-flip__inner) passes edge-on at this share of its time: the faces swap then. */
const FLIP_EDGE = 0.369;
/** After the last card lands, the summary follows on its own. */
const TO_SUMMARY_MS = 1300;
const SWIPE_STEP = 50;

/** Tier colours, shown only for what has already been flipped (the jumbotron's line, a walkout's board). */
export const TIER_LIGHT: Record<Tier, string> = {
  common: 'hsl(22 62% 56%)',
  rare: 'hsl(208 72% 66%)',
  epic: 'hsl(268 86% 70%)',
  legendary: 'hsl(26 100% 58%)',
};
/** Camera flashes when the pack rips, per pack type: better packs light the stands up more. */
const RIP_FLASHES: Record<PackType, number> = { standard: 3, premium: 6, elite: 9, perfect: 12, holo: 12, exchange: 8 };
/** Pack shake while it is being torn (px at a full rip), per pack. */
const SHAKE: Record<PackType, number> = { standard: 0.6, premium: 1.2, elite: 1.8, perfect: 2.4, holo: 2.4, exchange: 1.8 };
/** The crowd's baseline excitement once the pack is open, per pack. */
const PACK_LEVEL: Record<PackType, number> = { standard: 1, premium: 1, elite: 2, perfect: 2, holo: 2, exchange: 2 };

interface PackOpeningProps {
  /** Pack being opened (null keeps the dialog closed) */
  type: PackType | null;
  onClose: () => void;
  /** Rolls and stores one pack of `type` (null when none is left); a preview returns sample cards and stores nothing */
  onTear: (type: PackType) => PackCard[] | null;
  describe: (c: PackCard) => CardInfo;
  total: number;
  /** Unopened packs of this type (live count) */
  remaining: number;
  /** Provenance of the next Perfect Season pack */
  provenance?: string;
  /** Preview mode (Card designs): labelled as a preview, nothing is added */
  preview?: boolean;
  /** Pack-opening theme unlocked by a portfolio milestone (utils/economy.ts MILESTONES): adds pk-theme--<id> */
  theme?: string;
}

/**
 * What the reveal stamps on a card: NEW (new player), NEW ART (new variant), UPGRADE (better finish), NEW KIT (that
 * variant × finish owned, but not in this kit: it joins the binder, no shards), NEW PARALLEL (that Prizm finish owned,
 * but not in this colour parallel: no shards either), or a dupe.
 */
const tagOf = (c: PackCard): 'new' | 'art' | 'up' | 'kit' | 'par' | 'dupe' | 'finish' =>
  c.isNew ? 'new' : c.newVariant ? 'art' : c.upgrade ? 'up' : c.newKit ? 'kit' : c.newParallel ? 'par' : c.duplicate ? 'dupe' : 'finish';
const TAG_LABEL = { new: 'New', art: 'New art', up: 'Upgrade', kit: 'New kit', par: 'New parallel', dupe: 'Duplicate', finish: 'New finish' } as const;

/** The Prizm colour parallel a pulled card shows (Prizm number only). */
const parOf = (c: PackCard) => (c.variant === 'number' ? c.prizm : undefined);

/** The non-home kit a pulled card wears (null for home and the Autograph). */
const kitOf = (c: PackCard, info: CardInfo): Uniform | null => {
  if (c.variant === 'auto' || !c.kit || c.kit === 'home') return null;
  const u = kitUniform(info.player, c.kit, c.variant, c.finish);
  return u.id === 'home' ? null : u;
};

const packTitle = (t: PackType) => PACKS[t].label.replace(/ Pack$/, '');

/** Sealed foil pack art (also used on the Collection hero shelf). */
export const PackArt = ({ type, small = false }: { type: PackType; small?: boolean }) => (
  <>
    <span className="pk-pack__strip" aria-hidden="true" />
    <span className="pk-pack__crimp pk-pack__crimp--top" aria-hidden="true" />
    <span className="pk-pack__tear" aria-hidden="true" />
    <span className="pk-pack__label" aria-hidden="true">
      <span className="pk-pack__sub">Retro Vault</span>
      {type === 'perfect' ? (
        <>
          <Trophy className={small ? 'h-5 w-5' : 'h-8 w-8'} />
          <span className="pk-pack__title pk-pack__title--big">18–0</span>
        </>
      ) : type === 'exchange' ? (
        <>
          <Repeat className={small ? 'h-5 w-5' : 'h-8 w-8'} />
          <span className="pk-pack__title">
            Legends
            <br />
            Exchange
          </span>
        </>
      ) : type === 'holo' ? (
        <>
          <Sparkles className={small ? 'h-5 w-5' : 'h-8 w-8'} />
          <span className="pk-pack__title">
            Holo
            <br />
            Showcase
          </span>
        </>
      ) : (
        <span className="pk-pack__title">
          {packTitle(type)}
          <br />
          Pack
        </span>
      )}
      {!small && <span className="pk-pack__sub">{PACK_SUB[type]}</span>}
    </span>
    <span className="pk-pack__crimp pk-pack__crimp--bottom" aria-hidden="true" />
  </>
);

interface WalkState {
  /** Card index in the pack */
  i: number;
  step: number;
  beats: WkBeat[];
}

/** The pack's best card (it is revealed last). */
const bestOf = (pack: PackCard[]) => pack[pack.length - 1];

/** Paper and foil bits from the tear: [x %, drift px, delay ms]. */
const BITS = Array.from({ length: 16 }, (_, i) => [4 + ((i * 37) % 92), ((i * 53) % 140) - 70, (i % 5) * 28] as const);

/** The flip's bookkeeping per card: which face shows (switched edge-on) and whether it is mid-turn (data-turning). */
interface FlipFx {
  face: boolean[];
  turning: boolean[];
  /** Landed without a turn (after its walkout, Open all) */
  still: boolean[];
}
const NO_FX: FlipFx = { face: [], turning: [], still: [] };

/**
 * Card size on the tunnel floor: the pre-tunnel reveal's size on a phone (three across, wrapping to a second row), a
 * touch wider where the floor has room; on a desktop as large as fits the width and the floor's height. Flat, never
 * foreshortened, so the card and its hit area are the size they look.
 */
const floorLayout = (geo: (TunnelGeo & { cw: number; ch: number; sb: number }) | null, n: number) => {
  if (!geo || !n) return { w: 120, rows: 1 };
  const phone = geo.cw < 640;
  const perRow = phone ? Math.min(3, n) : n;
  const rows = Math.ceil(n / perRow);
  const gap = phone ? 8 : 16;
  const side = phone ? 12 : 32;
  const byW = (geo.cw - side * 2 - gap * (perRow - 1)) / perRow;
  // the floor: from just under the mouth to the actions bar (about 76 px, plus the home indicator on a phone)
  const floorTop = (geo.my + geo.mh) * geo.P + 6;
  const floorH = geo.ch - floorTop - (phone ? 72 : 84) - geo.sb;
  const byH = (floorH - 24 * (rows - 1) - 22) / rows / 1.42;
  return { w: Math.max(96, Math.floor(Math.min(byW, byH, 210))), rows };
};

/**
 * Reward pack as an event, FUT style, in a players' tunnel. The pack hangs in the light at the tunnel's mouth and bobs;
 * tap, Space or a drag across the top tears it (the strip rips off with paper and foil bits, sparks fly off the finger,
 * cameras flash in the stands). The
 * cards land face down on the tunnel floor; a tap anywhere on the stage (or Space, Enter, a swipe) flips the next one,
 * a tap on a face-down card flips that one, with a light pop in its finish, the best card last and slowest. Legendary and Holo cards, every card that
 * carries an autograph (revealed last, with its own AUTOGRAPH beat), and about one decoy in five walk out instead, in
 * the same tunnel. A duplicate's shards fly to the counter; new cards get a NEW stamp, new art a NEW ART ribbon, a kit
 * not owned yet a NEW KIT stamp. A non-home kit shows its own stamp under the card (ALT KIT · <label>, THROWBACK ·
 * <label>); throwbacks walk out with a THROWBACK beat. A Prizm colour parallel gets its stamp too (PRIZM RED /199 …); a
 * Gold /10 or Black 1/1 walks out with a PRIZM beat. The summary shows the pack in a grid with the best pull
 * highlighted. "Open all" (or Esc) skips to the summary at any time. Reduced motion: straight to the summary (the cards
 * fade in, the tunnel stands still, no shake or flashes), with a short walkout first for a Legendary or Holo.
 * Animations are transform / opacity only. Presentation only: odds and stored cards are untouched.
 */
const PackOpening = ({ type, onClose, onTear, describe, total, remaining, provenance, preview = false, theme }: PackOpeningProps) => {
  const [phase, setPhase] = useState<Phase>('sealed');
  const { attach: attachSamples } = useSampleAutos();
  const [pack, setPack] = useState<PackCard[]>([]);
  const [open, setOpen] = useState<boolean[]>([]);
  const openRef = useRef<boolean[]>([]);
  const walkRef = useRef(false);
  const [fx, setFx] = useState<FlipFx>(NO_FX);
  const [walk, setWalk] = useState<WalkState | null>(null);
  const [shownType, setShownType] = useState<PackType>('standard');
  const [mark, setMark] = useState<string | undefined>();
  const [tally, setTally] = useState(0);
  const [tear, setTear] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [geo, setGeo] = useState<(TunnelGeo & { cw: number; ch: number; st: number; sb: number }) | null>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const tunnelRef = useRef<TunnelHandle>(null);
  const sparksRef = useRef<HTMLSpanElement>(null);
  const cardEls = useRef<(HTMLLIElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  // The pack once rolled, and whether it is ripped: refs, so two pointer events in one frame never roll or rip twice
  const rolledRef = useRef<PackCard[] | null>(null);
  const rippedRef = useRef(false);
  const club = useCurrentClub();
  const isOpen = type != null;
  const t = type ?? shownType;
  const spec = PACKS[t];
  const reduced = reducedMotion();

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const reset = useCallback(() => {
    clearTimers();
    rolledRef.current = null;
    rippedRef.current = false;
    setPhase('sealed');
    setPack([]);
    setOpen([]);
    setFx(NO_FX);
    setWalk(null);
    setTally(0);
    setTear(0);
    setDragging(false);
    document.querySelectorAll('.pk-chip').forEach((n) => n.remove());
  }, []);

  useEffect(() => {
    if (type) setShownType(type);
    if (!isOpen) {
      // Closing mid-reveal counts as revealed
      endReveal();
      reset();
    }
  }, [isOpen, type, reset]);
  useEffect(
    () => () => {
      clearTimers();
      endReveal();
    },
    [],
  );

  openRef.current = open;
  walkRef.current = !!walk;
  const best = pack.length ? bestOf(pack) : null;

  // tearing → reveal on its own (a tap skips ahead)
  useEffect(() => {
    if (phase !== 'tearing') return;
    const id = window.setTimeout(() => {
      sfx('deal');
      setPhase('reveal');
    }, TEAR_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // The stands react: a volley of flashes when the pack rips (more for better pack types, never for the pull)
  useEffect(() => {
    if (phase === 'tearing') tunnelRef.current?.flash(RIP_FLASHES[t]);
    // t is fixed for the pack once it is torn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Walkout beats: each one holds for its own time, then the next starts (tap advances early)
  useEffect(() => {
    const ms = walk?.beats[walk.step]?.ms ?? 0;
    if (!walk || ms <= 0) return;
    const id = window.setTimeout(() => setWalk((w) => (w ? { ...w, step: Math.min(w.step + 1, w.beats.length - 1) } : w)), ms);
    return () => window.clearTimeout(id);
  }, [walk]);

  const allOpen = pack.length > 0 && open.every(Boolean);
  // The last card has landed: on to the summary
  useEffect(() => {
    if (phase !== 'reveal' || !allOpen || walk) return;
    const id = window.setTimeout(() => {
      sfx('summary');
      setPhase('summary');
    }, TO_SUMMARY_MS);
    return () => window.clearTimeout(id);
  }, [phase, allOpen, walk]);
  useEffect(() => {
    // The summary is the reveal: the Collection may show the pack's cards from here on
    if (phase === 'summary' && !walk) endReveal();
  }, [phase, walk]);
  useEffect(() => {
    if (phase === 'summary') doneRef.current?.focus({ preventScroll: true });
    // The pack button is gone once torn: keep focus in the dialog so Space / Enter keep advancing
    else if (phase !== 'sealed' && !contentRef.current?.contains(document.activeElement)) contentRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const packBonus = PACK_SHARDS[shownType] ?? 0;
  const packShards = pack.reduce((s, c) => s + c.shards, 0) + (pack.length && !preview ? packBonus : 0);

  /** A duplicate's shards fly from its card to the counter (a fixed chip above the dialog), then count up. */
  const flyShards = (i: number, delay: number) => {
    const c = pack[i];
    if (!c?.duplicate || !c.shards || preview) return;
    const from = cardEls.current[i]?.getBoundingClientRect();
    const to = counterRef.current?.getBoundingClientRect();
    if (reduced || !from || !to || typeof document.body.animate !== 'function') {
      setTally((n) => n + c.shards);
      return;
    }
    later(() => {
      const chip = document.createElement('span');
      chip.className = 'pk-chip';
      chip.textContent = `+${c.shards}`;
      chip.setAttribute('aria-hidden', 'true');
      chip.style.left = `${from.left + from.width / 2}px`;
      chip.style.top = `${from.top + from.height * 0.3}px`;
      document.body.appendChild(chip);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height * 0.3);
      const a = chip.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
          { transform: 'translate(-50%, calc(-50% - 26px)) scale(1.1)', opacity: 1, offset: 0.25 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7)`, opacity: 0.9 },
        ],
        { duration: 760, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'forwards' },
      );
      const land = () => {
        chip.remove();
        sfx('shard');
        setTally((n) => n + c.shards);
        counterRef.current?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
      };
      a.onfinish = land;
      a.oncancel = land;
    }, delay);
  };

  /**
   * Rolls the pack (once): hides its cards from the Collection behind until revealed, orders them best last and sets
   * them up face down. Called when the tear completes (a tap, or the drag past the end).
   */
  const roll = (): PackCard[] | null => {
    if (rolledRef.current) return rolledRef.current;
    if (!type) return null;
    // Hide this pack's cards from the Collection behind the dialog until they are revealed
    if (!preview) beginReveal();
    const torn = onTear(type);
    // A preview's Autograph-variant cards get a sample roll (a real pull always carries its own autograph)
    const cards = torn && attachSamples(torn, describe);
    if (!cards) {
      endReveal();
      onClose();
      return null;
    }
    const ordered = bestLast(cards, (c) => describe(c).ovr);
    rolledRef.current = ordered;
    // An autograph's signature font starts loading now, so it is ready by its reveal beat
    cards.forEach((c) => c.auto && void loadAutographFonts(identity(c.auto.snap.name).hand.font, c.auto.snap.name));
    setMark(provenance);
    setPack(ordered);
    setOpen(ordered.map(() => false));
    setFx({ face: ordered.map(() => false), turning: ordered.map(() => false), still: ordered.map(() => false) });
    setTally(preview ? 0 : PACK_SHARDS[type] ?? 0);
    return ordered;
  };

  /** Rips the pack open: rolls it, the strip flies. */
  const startTear = (): PackCard[] | null => {
    if (phase !== 'sealed' || !type || rippedRef.current) return null;
    const ordered = roll();
    if (!ordered) return null;
    rippedRef.current = true;
    sfx('tear');
    setDragging(false);
    if (reducedMotion()) {
      // Straight to the summary; a Legendary or Holo still gets its short walkout first
      setOpen(ordered.map(() => true));
      setFx({ face: ordered.map(() => true), turning: ordered.map(() => false), still: ordered.map(() => true) });
      setTally(ordered.reduce((s, c) => s + c.shards, 0) + (preview ? 0 : PACK_SHARDS[type] ?? 0));
      const chase = ordered.length - 1 - [...ordered].reverse().findIndex((c) => needsWalkout(c, true));
      if (chase < ordered.length) setWalk({ i: chase, step: 0, beats: walkoutBeats(ordered[chase], true) });
      setPhase('summary');
      return ordered;
    }
    setTear(1);
    setPhase('tearing');
    return ordered;
  };

  /** Turns card i face up on the floor: it stands up and flips; the faces swap edge-on (no iOS flicker). */
  const turnUp = (i: number, ms: number) => {
    openRef.current = openRef.current.map((v, j) => v || j === i);
    setOpen((o) => o.map((v, j) => v || j === i));
    setFx((f) => ({ ...f, turning: f.turning.map((v, j) => v || j === i) }));
    later(() => setFx((f) => ({ ...f, face: f.face.map((v, j) => v || j === i) })), Math.round(ms * FLIP_EDGE));
    later(() => setFx((f) => ({ ...f, turning: f.turning.map((v, j) => (j === i ? false : v)) })), ms + 40);
  };

  /**
   * Flips a face-down card (or starts its walkout): the one tapped (owner: "it doesn't allow me to pick a card to flip"),
   * else the next in order (a tap on the stage, Space, a swipe).
   */
  const flipNext = (pick?: number) => {
    if (walkRef.current) return;
    // openRef, not the render's state: two taps inside one frame never turn the same card twice
    const o = openRef.current;
    const i = pick != null && pick >= 0 && !o[pick] ? pick : o.indexOf(false);
    if (i < 0) {
      setPhase('summary');
      return;
    }
    const c = pack[i];
    if (needsWalkout(c)) {
      sfx('walkout');
      walkRef.current = true;
      setWalk({ i, step: 0, beats: walkoutBeats(c, false) });
      return;
    }
    const last = i === pack.length - 1;
    const ms = last ? FLIP_BEST_MS : FLIP_MS;
    sfx(last ? 'flip-best' : 'flip');
    turnUp(i, ms);
    // the stands answer the card as it lands: a few flashes for a Common, a wall of them for an Epic
    later(() => tunnelRef.current?.flash(1 + tierRank(c.tier) * 3 + (finishRank(c.finish) >= finishRank('gold') ? 3 : 0)), ms * 0.6);
    flyShards(i, ms);
  };

  const endWalk = () => {
    if (!walk) return;
    const i = walk.i;
    setWalk(null);
    if (phase === 'summary') return;
    setOpen((o) => o.map((v, j) => v || j === i));
    setFx((f) => ({ face: f.face.map((v, j) => v || j === i), turning: f.turning, still: f.still.map((v, j) => v || j === i) }));
    flyShards(i, 200);
  };

  /** Skip everything: every card face up, all shards counted, the summary. */
  const openAll = () => {
    let cards = pack;
    if (phase === 'sealed') {
      const torn = startTear();
      if (!torn || reducedMotion()) return;
      cards = torn;
    }
    clearTimers();
    setWalk(null);
    setOpen(cards.map(() => true));
    setFx({ face: cards.map(() => true), turning: cards.map(() => false), still: cards.map(() => true) });
    setTally(cards.reduce((n, c) => n + c.shards, 0) + (preview ? 0 : packBonus));
    document.querySelectorAll('.pk-chip').forEach((n) => n.remove());
    setPhase('summary');
  };

  /**
   * A tap anywhere on the reveal stage (the one handler: the floor covers the whole stage, so a tap never lands on a
   * layer that ignores it): on a face-down card it flips that card (owner: "it doesn't allow me to pick a card to
   * flip"), anywhere else the next in order. A tap on a face-up card or the gaps between cards flips the next too.
   */
  const onFloorTap = (e: MouseEvent<HTMLDivElement>) => {
    if (phase !== 'reveal') return;
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-i]');
    const pick = li ? Number(li.dataset.i) : undefined;
    if (walkRef.current) return;
    if (openRef.current.every(Boolean)) setPhase('summary');
    else flipNext(pick);
  };

  const walkAdvance = () => setWalk((w) => (w ? { ...w, step: Math.min(w.step + 1, w.beats.length - 1) } : w));
  const walkSkip = () => setWalk((w) => (w ? { ...w, step: skipStep(w.beats, w.step) } : w));

  /** One step forward: tear, skip the tear, flip the next card, or speed up a walkout. */
  const advance = () => {
    if (walk) {
      if (walk.step >= walk.beats.length - 1) endWalk();
      else walkAdvance();
      return;
    }
    if (phase === 'sealed') startTear();
    else if (phase === 'tearing') setPhase('reveal');
    else if (phase === 'reveal') flipNext();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    e.preventDefault();
    advance();
  };

  /** Foil sparks off the finger as it drags along the tear line (short-lived elements, removed when they land). */
  const sparkAt = (x: number) => {
    const box = sparksRef.current;
    if (!box || reduced || box.childElementCount > 26) return;
    for (let k = 0; k < 2; k++) {
      const s = document.createElement('i');
      s.style.left = `${x}px`;
      s.style.setProperty('--sx', `${Math.round((Math.random() - 0.3) * 70)}px`);
      s.style.setProperty('--sy', `${Math.round(-20 - Math.random() * 60)}px`);
      s.style.setProperty('--sh', `${Math.round(Math.random() * 360)}`);
      s.addEventListener('animationend', () => s.remove(), { once: true });
      box.appendChild(s);
    }
  };

  // Drag across the top of the pack to tear it (a plain tap tears too)
  const drag = useRef<{ x: number; w: number; left: number; moved: boolean; last: number } | null>(null);
  const dragged = useRef(false);
  const onPackDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (phase !== 'sealed') return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, w: r.width, left: r.left, moved: false, last: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPackMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || phase !== 'sealed') return;
    const k = Math.max(0, Math.min(1, (e.clientX - d.x) / (d.w * 0.8)));
    if (k > 0.04 && !d.moved) {
      d.moved = true;
      setDragging(true);
    }
    setTear(k);
    const now = performance.now();
    if (d.moved && now - d.last > 34) {
      d.last = now;
      sparkAt(Math.max(0, Math.min(d.w, e.clientX - d.left)));
    }
    if (k >= 0.98) {
      drag.current = null;
      dragged.current = true;
      startTear();
    }
  };
  const onPackUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      // The click that follows a drag is not a tap
      dragged.current = true;
      if (tear >= 0.5) startTear();
      else {
        setTear(0);
        setDragging(false);
      }
    }
  };
  const onPackClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    startTear();
  };

  // Touch: a sideways swipe on the reveal advances (vertical stays scrolling / swipe-to-close)
  const swipe = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    const p = e.touches[0];
    swipe.current = p ? { x: p.clientX, y: p.clientY, axis: null } : null;
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    const s = swipe.current;
    const p = e.touches[0];
    if (!s || !p || s.axis) return;
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    const p = e.changedTouches[0];
    if (!s || !p || s.axis !== 'x' || Math.abs(p.clientX - s.x) < SWIPE_STEP) return;
    advance();
  };

  const othersHidden = walk ? open.some((v, j) => !v && j !== walk.i) : false;
  const walking = walk ? pack[walk.i] : null;
  const fresh = pack.filter((c) => c.isNew).length;
  const holos = pack.filter((c) => c.finish === 'holo').length;
  const legends = pack.filter((c) => c.tier === 'legendary').length;
  const autos = pack.filter((c) => c.auto);
  const kits = pack.map((c) => kitOf(c, describe(c)));
  const throwbacks = kits.filter((u) => u?.era).length;
  const altKits = kits.filter((u) => u && !u.era).length;
  const parallels = pack.filter((c) => parOf(c)).length;
  const kitParts = () => [
    ...(throwbacks ? [`${throwbacks} throwback kit${throwbacks === 1 ? '' : 's'}`] : []),
    ...(altKits ? [`${altKits} alt kit${altKits === 1 ? '' : 's'}`] : []),
    ...(parallels ? [`${parallels} Prizm parallel${parallels === 1 ? '' : 's'}`] : []),
  ];
  const summaryLine = () => {
    if (preview) return ['Preview only. Nothing was added to your binder.', ...kitParts()].join(' · ');
    const parts = [`${fresh} new`];
    if (autos.length) parts.push(`${autos.length} autograph${autos.length === 1 ? '' : 's'}`);
    if (legends) parts.push(`${legends} Legendary`);
    if (holos) parts.push(`${holos} Holo`);
    parts.push(...kitParts());
    return parts.join(' · ');
  };
  const description =
    phase === 'sealed'
      ? `${PACK_SUB[t]}${t === 'perfect' && provenance ? ` · ${provenance}` : ''}`
      : phase === 'summary'
        ? summaryLine()
        : phase === 'reveal'
          ? 'Tap, swipe or press Space to flip the next card.'
          : 'Opening…';

  const showCounter = !preview && phase !== 'sealed';

  // ---- The tunnel: its light, the crowd's mood and the jumbotron ----
  const flippedUp = pack.filter((_, i) => open[i]);
  const bestUp = flippedUp.reduce<PackCard | null>((b, c) => (!b || tierRank(c.tier) > tierRank(b.tier) || (c.tier === b.tier && finishRank(c.finish) > finishRank(b.finish)) ? c : b), null);
  const walkStage = walk ? walk.beats[Math.min(walk.step, walk.beats.length - 1)].stage : null;
  const walkFlipped = !!walk && walk.beats.findIndex((b) => b.stage === 'flip') <= walk.step;
  // The tunnel's light is the stadium's own, never a tier's colour: what was pulled shows only once a card is turned.
  // How hard it floods follows the stage, not the pull.
  const surge = walking ? (walkFlipped ? 2 : 3) : phase === 'tearing' ? 2 : phase === 'reveal' && bestUp ? 1 : 0;
  const level = walking
    ? 4
    : phase === 'sealed'
      ? dragging
        ? 1
        : 0
      : phase === 'tearing'
        ? PACK_LEVEL[t]
        : phase === 'reveal'
          ? bestUp
            ? Math.min(4, tierRank(bestUp.tier) + 1 + (bestUp.finish === 'holo' ? 1 : 0))
            : 1
          : 1;
  // the stands get louder: a hook for a future crowd sound
  const lastLevel = useRef(0);
  useEffect(() => {
    if (level > lastLevel.current) sfx(level >= 4 ? 'roar' : 'crowd');
    lastLevel.current = level;
  }, [level]);
  const board: BoardText = useMemo(() => {
    if (walking) {
      if (walkFlipped) {
        const info = describe(walking);
        const surname = info.player.name.split(' ').slice(-1)[0];
        return { top: surname, bottom: `${info.ovr ?? '–'} CAR`, tone: TIER_LIGHT[walking.tier] };
      }
      // the tier shows only once the card turns
      return { top: 'Walkout', bottom: '• • •' };
    }
    if (phase === 'sealed') return dragging ? { top: 'Retro Vault', bottom: 'Tear it!' } : { top: 'Retro Vault', bottom: t === 'perfect' ? '18–0' : `${packTitle(t)} pack` };
    if (phase === 'tearing') return { top: 'Here we go', bottom: '• • •' };
    if (phase === 'reveal') {
      const n = flippedUp.length;
      if (!bestUp) return { top: `0 of ${pack.length}`, bottom: 'Flip a card' };
      const fin = bestUp.finish === 'base' ? '' : `${finishLabel(bestUp.finish)} `;
      return { top: `${n} of ${pack.length}`, bottom: `${fin}${tierLabel(bestUp.tier)} on the board`, tone: TIER_LIGHT[bestUp.tier] };
    }
    return { top: 'Full time', bottom: preview ? `${pack.length} cards` : `${fresh} new`, tone: best ? TIER_LIGHT[best.tier] : undefined };
    // describe is stable per pool; the rest is listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking, walkFlipped, walkStage, phase, dragging, t, flippedUp.length, bestUp, pack.length, preview, fresh, best]);
  // A walkout's card lands: the stadium erupts
  useEffect(() => {
    if (walkFlipped) tunnelRef.current?.flash(16);
  }, [walkFlipped]);

  const floor = floorLayout(geo, pack.length);
  const onGeo = useCallback((g: TunnelGeo & { cw: number; ch: number; st: number; sb: number }) => setGeo(g), []);
  const geoVars = geo
    ? ({
        '--tn-p': `${geo.P}px`,
        '--tn-mx': `${geo.mx * geo.P}px`,
        '--tn-my': `${geo.my * geo.P}px`,
        '--tn-mw': `${geo.mw * geo.P}px`,
        '--tn-mh': `${geo.mh * geo.P}px`,
        '--tn-vx': `${geo.vx * geo.P}px`,
        '--tn-ch': `${geo.ch}px`,
        '--tn-floor': `${(geo.my + geo.mh) * geo.P}px`,
        // the walkout's runner stands to the tunnel's scale (owner: "the tunnel is the reg height of a tunnel so size
        // the players accordingly"): a player about 1.9 m in a 3 m tunnel, so his figure (0.71 of the 192px box) about
        // 64% of the mouth's height
        '--wk-s': `${Math.max(0.6667, Math.min(2.4, (geo.mh * geo.P * 0.9) / 192)).toFixed(4)}`,
        '--pk-light': 'hsl(45 100% 88%)',
      } as CSSProperties)
    : ({ '--pk-light': 'hsl(45 100% 88%)' } as CSSProperties);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={contentRef}
        // The walkout is a full-screen show: no swipe (Skip ends it)
        swipeToClose={!walk}
        overlayClassName="pk-overlay"
        className={cn(
          'pk-dialog tn-dlg border-line bg-night p-0',
          `pk-dialog--${t}`,
          `pk-phase--${phase}`,
          walk && 'pk-walking',
          theme && `pk-theme--${theme}`,
          reduced && 'pk-rm',
        )}
        style={geoVars}
        onKeyDown={onKey}
        onEscapeKeyDown={(e) => {
          // Esc skips: a walkout to its end, anything mid-pack to the summary; on the stage or summary it closes
          if (walk) {
            e.preventDefault();
            if (walk.step >= walk.beats.length - 1) endWalk();
            else walkSkip();
          } else if (phase === 'tearing' || phase === 'reveal') {
            e.preventDefault();
            openAll();
          }
        }}
      >
        <PackTunnel ref={tunnelRef} type={t} club={club} surge={surge} level={level} board={board} reduced={reduced} theme={theme} onGeo={onGeo} />

        <div className="tn-ui">
          <div className="tn-head">
            <div className="min-w-0">
              <DialogTitle className="font-display text-2xl uppercase italic">
                {preview && <span className="mr-2 text-muted-foreground">Preview ·</span>}
                {packTitle(t)} <span className="text-gold">pack</span>
              </DialogTitle>
              <DialogDescription className="mt-0.5">{description}</DialogDescription>
            </div>
            {showCounter && (
              <span className="pk-counter" aria-live="polite">
                <Hammer className="h-4 w-4 text-sky-300" aria-hidden="true" />
                <span ref={counterRef} className="font-mono tabular-nums">
                  +{tally.toLocaleString()}
                </span>
                <span className="text-muted-foreground">shards</span>
              </span>
            )}
          </div>

          {(phase === 'sealed' || phase === 'tearing') && (
            <div className={cn('pk-stage tn-stage', `pk-stage--${t}`)} onClick={phase !== 'sealed' ? advance : undefined}>
              <div
                className={cn('tn-hang', dragging && 'tn-hang--drag', phase !== 'sealed' && 'tn-hang--ripped')}
                style={{ '--tear': tear, '--shk': `${SHAKE[t] * Math.max(0.25, tear)}px` } as CSSProperties}
              >
                <button
                  type="button"
                  className={cn('pk-pack', `pk-pack--${t}`, phase === 'tearing' && 'pk-pack--tearing')}
                  style={{ '--tear': tear } as CSSProperties}
                  onClick={onPackClick}
                  onPointerDown={onPackDown}
                  onPointerMove={onPackMove}
                  onPointerUp={onPackUp}
                  onPointerCancel={() => {
                    drag.current = null;
                    setTear(0);
                    setDragging(false);
                  }}
                  disabled={phase !== 'sealed'}
                  aria-label={`Tear open the ${spec.label}`}
                  autoFocus
                >
                  <PackArt type={t} />
                  <span className="tn-rim" aria-hidden="true" />
                </button>
                <span ref={sparksRef} className="tn-sparks" aria-hidden="true" />
                {phase === 'tearing' && (
                  <span className="pk-bits" aria-hidden="true">
                    {BITS.map(([x, dx, d], i) => (
                      <i key={i} style={{ left: `${x}%`, '--dx': `${dx}px`, animationDelay: `${d}ms` } as CSSProperties} />
                    ))}
                  </span>
                )}
              </div>
              {phase === 'sealed' && <p className="pk-hint tn-hint">Tap or drag across the top to tear</p>}
            </div>
          )}

          {phase === 'reveal' && (
            <div className="tn-floor" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onClick={onFloorTap}>
              {t === 'perfect' && mark && !preview && (
                <p className="pk-provenance">
                  <Trophy className="h-4 w-4" aria-hidden="true" /> {mark}
                </p>
              )}
              <ol className={cn('pk-fan tn-fan', floor.rows > 1 && 'tn-fan--rows')} style={{ '--pk-n': pack.length, '--pk-w': `${floor.w}px` } as CSSProperties} aria-label="Cards in this pack">
                {pack.map((c, i) => {
                  const info = describe(c);
                  const shown = open[i];
                  const isBest = i === pack.length - 1;
                  const tag = tagOf(c);
                  const next = !shown && open.indexOf(false) === i;
                  const faceUp = !!fx.face[i];
                  return (
                    <li
                      key={`${info.key}-${i}`}
                      ref={(el) => (cardEls.current[i] = el)}
                      className={cn(
                        'pk-flip',
                        `pk-flip--${c.tier}`,
                        `pk-flip--f-${c.finish}`,
                        shown && 'pk-flip--open',
                        isBest && 'pk-flip--best',
                        fx.still[i] && 'pk-flip--still',
                        walk?.i === i && 'pk-flip--away',
                      )}
                      data-i={i}
                      data-face={faceUp ? 'front' : 'back'}
                      data-turning={fx.turning[i] ? '' : undefined}
                      style={{ '--i': i, '--off': i - (pack.length - 1) / 2 } as CSSProperties}
                    >
                      <span className="pk-flip__shadow" aria-hidden="true" />
                      <div className="pk-flip__lie">
                        <div className="pk-flip__inner">
                          <div className="pk-flip__face" aria-hidden={!shown}>
                            <CollectibleCard
                              owned
                              live={shown && !fx.turning[i]}
                              player={info.player}
                              tier={c.tier}
                              finish={c.finish}
                              variant={shown ? c.variant : undefined}
                              kit={c.kit}
                              prizm={parOf(c)}
                              autograph={c.auto}
                              ovr={info.ovr}
                              number={info.number}
                              stats={info.stats}
                              setNo={info.setNo}
                              setTotal={total}
                              marks={c.mark ? [c.mark] : undefined}
                            />
                          </div>
                          <button
                            type="button"
                            className="pk-flip__face pk-flip__back"
                            disabled={shown}
                            tabIndex={shown ? -1 : 0}
                            data-next={next || undefined}
                            aria-hidden={shown}
                            aria-label={`Flip card ${i + 1} of ${pack.length}${next ? ' (next)' : ''}`}
                          >
                            <CardBackArt mark={t === 'perfect' ? '18–0' : 'RV'} />
                          </button>
                        </div>
                      </div>
                      {shown && !fx.still[i] && <span className="pk-flip__pop" aria-hidden="true" />}
                      {shown && !preview && tag !== 'dupe' && tag !== 'finish' && (
                        <span className={cn('pk-tag', `pk-tag--${tag}`)} aria-hidden="true">
                          {TAG_LABEL[tag]}
                        </span>
                      )}
                      {shown && c.finish === 'holo' && (
                        <span className="pk-holo-hit" aria-hidden="true">
                          <Sparkles className="h-3.5 w-3.5" /> Holo
                        </span>
                      )}
                      {shown && c.auto && (
                        <span className="pk-auto-hit" aria-hidden="true">
                          <Signature className="h-3.5 w-3.5" /> Autograph
                        </span>
                      )}
                      {shown && kits[i] && (
                        <span className={cn('pk-kit-hit', kits[i]!.era ? 'pk-kit-hit--era' : 'pk-kit-hit--alt')} aria-hidden="true">
                          <b>{kits[i]!.era ? 'Throwback' : 'Alt kit'}</b>
                          <span className="pk-kit-hit__label">{kits[i]!.label}</span>
                        </span>
                      )}
                      {shown && parOf(c) && (
                        <span className={cn('pk-par-hit', `pk-par-hit--${parOf(c)!.c}`, kits[i] && 'pk-par-hit--stacked')} aria-hidden="true">
                          {prizmStamp(parOf(c)!.c)}
                        </span>
                      )}
                      {shown && (
                        <p className="sr-only" role="status">
                          {info.player.name}, {variantLabel(c.variant)} variant, {tierLabel(c.tier)} tier, {finishLabel(c.finish)} finish
                          {kits[i] ? `, ${kits[i]!.era ? 'throwback' : 'alternate'} kit ${kits[i]!.label}` : ''}
                          {parOf(c) ? `, Prizm ${prizmInfo(parOf(c)!.c).label} parallel ${prizmSerial(parOf(c)!)}` : ''}, CAR {info.ovr ?? 'unknown'}
                          {preview ? '' : `, ${TAG_LABEL[tag]}${c.duplicate ? `, plus ${c.shards} shards` : ''}`}
                          {c.auto ? `, with an autograph: ${parallelOf(c.auto.roll.parallel).label} ${serialStr(c.auto.roll)}` : ''}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {phase === 'summary' && pack.length > 0 && (
            <div className="pk-sum tn-sum">
              <ol className="pk-sum__grid" aria-label="Your pull">
                {[...pack].reverse().map((c, k) => {
                  const info = describe(c);
                  const tag = tagOf(c);
                  const kit = kits[pack.length - 1 - k];
                  return (
                    <li key={`${info.key}-${k}`} className={cn('pk-sum__card', k === 0 && 'pk-sum__card--best')} style={{ '--k': k } as CSSProperties}>
                      {k === 0 && <span className="pk-sum__best">Best pull</span>}
                      <CollectibleCard
                        owned
                        player={info.player}
                        tier={c.tier}
                        finish={c.finish}
                        variant={c.variant}
                        kit={c.kit}
                        prizm={parOf(c)}
                        autograph={c.auto}
                        ovr={info.ovr}
                        number={info.number}
                        stats={info.stats}
                        setNo={info.setNo}
                        setTotal={total}
                        marks={c.mark ? [c.mark] : undefined}
                      />
                      {!preview && (
                        <span className={cn('pk-sum__tag', `pk-sum__tag--${tag}`)}>{tag === 'dupe' ? `+${c.shards} shards` : TAG_LABEL[tag]}</span>
                      )}
                      {kit && <span className={cn('pk-sum__kit', kit.era ? 'pk-sum__kit--era' : 'pk-sum__kit--alt')}>{kitStamp(kit)}</span>}
                      {parOf(c) && (
                        <span className={cn('pk-sum__kit', 'pk-sum__par', `pk-sum__par--${parOf(c)!.c}`)}>
                          {prizmStamp(parOf(c)!.c)}
                          {prizmInfo(parOf(c)!.c).run > 1 ? ` · ${prizmSerial(parOf(c)!)}` : ''}
                        </span>
                      )}
                      {c.auto && (
                        <span className="pk-auto-hit">
                          <Signature className="h-3.5 w-3.5" aria-hidden="true" /> Autograph
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {autos.length > 0 && (
                <section className="pk-autos" aria-label="Autographs in this pack">
                  <p className="inline-flex items-center gap-2 font-display text-xl font-extrabold uppercase italic text-gold">
                    <Signature className="h-5 w-5" aria-hidden="true" /> Autograph{autos.length === 1 ? '' : 's'} pulled
                  </p>
                  <ul>
                    {autos.map((c) => (
                      <li key={c.auto!.id}>
                        <AutographCanvas snap={c.auto!.snap} roll={c.auto!.roll} cacheKey={c.auto!.id} />
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{parallelOf(c.auto!.roll.parallel).label}</span> · {serialStr(c.auto!.roll)} ·{' '}
                          <span className="font-mono text-gold">{fmtMult(autographValue(c.auto!.roll).total)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    {preview
                      ? 'Sample rolls: a real Autograph card rolls its own parallel, ink and serial.'
                      : 'Each joins his binder as the Autograph variant, and Autographs in your Collection as its own numbered card.'}
                  </p>
                </section>
              )}
              {!preview && (
                <p className="pk-sum__shards">
                  <Hammer className="h-4 w-4 text-sky-300" aria-hidden="true" />
                  <span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">+{packShards.toLocaleString()}</span> shards ({packBonus} for the pack
                    {packShards > packBonus ? `, ${(packShards - packBonus).toLocaleString()} from duplicates` : ''})
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="pk-actions tn-actions">
            {phase !== 'summary' ? (
              <Button variant="outline" onClick={openAll} className="min-h-11">
                {phase === 'sealed' ? 'Open all' : 'Skip'}
              </Button>
            ) : (
              <>
                {!preview && remaining > 0 && (
                  <Button variant="outline" onClick={reset} className="min-h-11">
                    Open next pack ({remaining} left)
                  </Button>
                )}
                {preview && (
                  <Button variant="outline" onClick={reset} className="min-h-11">
                    Replay
                  </Button>
                )}
                <Button ref={doneRef} onClick={onClose} className="min-h-11">
                  {preview ? 'Close' : 'Add to binder'}
                </Button>
              </>
            )}
          </div>
        </div>

        {walk && walking && (
          <Walkout
            tunnel
            card={walking}
            info={describe(walking)}
            total={total}
            beats={walk.beats}
            step={walk.step}
            reduced={reduced}
            badge={preview ? undefined : TAG_LABEL[tagOf(walking)]}
            onAdvance={walkAdvance}
            onSkip={walkSkip}
            onDone={endWalk}
            onRevealAll={othersHidden ? openAll : undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PackOpening;
