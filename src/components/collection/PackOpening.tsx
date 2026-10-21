import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { isLite } from '@/hooks/usePerfMode';
import { Hammer, Repeat, Sparkles, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sfx } from '@/utils/sfx';
import { PACKS, PACK_SHARDS, finishLabel, finishRank, tierLabel, tierRank, variantLabel, type Finish, type PackCard, type PackType, type Tier } from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import Walkout from './Walkout';
import { bestLast, needsWalkout, skipStep, walkoutBeats, type WkBeat } from './walkoutBeats';
import type { CardInfo } from './useCardPool';

const reducedMotion = () => {
  try {
    return isLite() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * sealed   the pack on its stage (tap, Space or drag across the top to tear)
 * tearing  the top strip rips off with paper and foil bits
 * tell     the anticipation build: a light shaft in the best card's tier colour, plus its finish hint
 * reveal   cards dealt face down; each advance flips the next (best last), Legendary / Holo / decoys walk out
 * summary  the pack's cards in a grid, the best pull highlighted, shards gained, Add to binder / Open next pack
 */
type Phase = 'sealed' | 'tearing' | 'tell' | 'reveal' | 'summary';

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
/** Anticipation per best tier, plus extra for a Gold or Holo hint: it escalates only for rare pulls. */
const TELL_MS: Record<Tier, number> = { common: 520, rare: 720, epic: 1100, legendary: 1600 };
const TELL_FINISH_MS: Record<Finish, number> = { base: 0, silver: 120, gold: 260, holo: 600 };
/** Flip time: every card, and the best (last) card, which turns slowest. */
const FLIP_MS = 620;
const FLIP_BEST_MS = 1000;
/** After the last card lands, the summary follows on its own. */
const TO_SUMMARY_MS = 1300;
const SWIPE_STEP = 50;

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
}

/** What the reveal stamps on a card: NEW (new player), NEW ART (new variant), UPGRADE (better finish), or a dupe. */
const tagOf = (c: PackCard): 'new' | 'art' | 'up' | 'dupe' | 'finish' => (c.isNew ? 'new' : c.newVariant ? 'art' : c.upgrade ? 'up' : c.duplicate ? 'dupe' : 'finish');
const TAG_LABEL = { new: 'New', art: 'New art', up: 'Upgrade', dupe: 'Duplicate', finish: 'New finish' } as const;

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
/** Gold sparkle positions for the tell: [x %, y %, delay ms]. */
const SPARKLES = Array.from({ length: 12 }, (_, i) => [10 + ((i * 41) % 80), 18 + ((i * 29) % 60), (i * 70) % 420] as const);

/**
 * Reward pack as an event, FUT style. The pack sits on a stage glowing in its colour and bobs under the pointer; tap,
 * Space or a drag across the top tears it (the strip rips off with paper and foil bits). Then the tell: a light shaft
 * in the best card's tier colour (copper, steel, amethyst, ember) with its finish hint (a silver glint, gold sparkle,
 * a rainbow burst for Holo), longer only for rare pulls. The cards deal out face down; each advance (tap, Space,
 * Enter or a swipe) flips the next one with a light pop in its finish and a bounce, the best card last and slowest.
 * Legendary and Holo cards (and about one decoy in five) get the walkout instead. A duplicate's shards fly to the
 * counter; new cards get a NEW stamp, new art a NEW ART ribbon. The summary shows the pack in a grid with the best
 * pull highlighted. "Open all" (or Esc) skips to the summary at any time. Reduced motion / performance mode: straight
 * to the summary (the cards fade in), with a short walkout first for a Legendary or Holo. Animations are transform /
 * opacity only. Presentation only: odds and stored cards are untouched.
 */
const PackOpening = ({ type, onClose, onTear, describe, total, remaining, provenance, preview = false }: PackOpeningProps) => {
  const [phase, setPhase] = useState<Phase>('sealed');
  const [pack, setPack] = useState<PackCard[]>([]);
  const [open, setOpen] = useState<boolean[]>([]);
  const [walk, setWalk] = useState<WalkState | null>(null);
  const [shownType, setShownType] = useState<PackType>('standard');
  const [mark, setMark] = useState<string | undefined>();
  const [tally, setTally] = useState(0);
  const [tear, setTear] = useState(0);
  const doneRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const cardEls = useRef<(HTMLLIElement | null)[]>([]);
  const isOpen = type != null;
  const t = type ?? shownType;
  const spec = PACKS[t];
  const reduced = reducedMotion();

  const reset = useCallback(() => {
    setPhase('sealed');
    setPack([]);
    setOpen([]);
    setWalk(null);
    setTally(0);
    setTear(0);
    document.querySelectorAll('.pk-chip').forEach((n) => n.remove());
  }, []);

  useEffect(() => {
    if (type) setShownType(type);
    if (!isOpen) reset();
  }, [isOpen, type, reset]);

  const best = pack.length ? bestOf(pack) : null;
  const tellMs = best ? TELL_MS[best.tier] + TELL_FINISH_MS[best.finish] : 0;

  // tearing → tell → reveal on their own (a tap skips ahead)
  useEffect(() => {
    if (phase !== 'tearing' && phase !== 'tell') return;
    const id = window.setTimeout(
      () => {
        if (phase === 'tearing') {
          sfx('tell');
          setPhase('tell');
        } else {
          sfx('deal');
          setPhase('reveal');
        }
      },
      phase === 'tearing' ? TEAR_MS : tellMs,
    );
    return () => window.clearTimeout(id);
  }, [phase, tellMs]);

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
    window.setTimeout(() => {
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

  const startTear = (): PackCard[] | null => {
    if (phase !== 'sealed' || !type) return null;
    const label = provenance;
    const cards = onTear(type);
    if (!cards) {
      onClose();
      return null;
    }
    const ordered = bestLast(cards, (c) => describe(c).ovr);
    sfx('tear');
    setMark(label);
    setPack(ordered);
    setOpen(ordered.map(() => false));
    setTally(preview ? 0 : PACK_SHARDS[type] ?? 0);
    if (reducedMotion()) {
      // Straight to the summary; a Legendary or Holo still gets its short walkout first
      setOpen(ordered.map(() => true));
      setTally(ordered.reduce((s, c) => s + c.shards, 0) + (preview ? 0 : PACK_SHARDS[type] ?? 0));
      const chase = ordered.length - 1 - [...ordered].reverse().findIndex((c) => needsWalkout(c, true));
      if (chase < ordered.length) setWalk({ i: chase, step: 0, beats: walkoutBeats(ordered[chase], true) });
      setPhase('summary');
      return ordered;
    }
    setPhase('tearing');
    return ordered;
  };

  /** Flips the next face-down card (or starts its walkout). */
  const flipNext = () => {
    if (walk) return;
    const i = open.indexOf(false);
    if (i < 0) {
      setPhase('summary');
      return;
    }
    const c = pack[i];
    if (needsWalkout(c)) {
      sfx('walkout');
      setWalk({ i, step: 0, beats: walkoutBeats(c, false) });
      return;
    }
    const last = i === pack.length - 1;
    sfx(last ? 'flip-best' : 'flip');
    setOpen((o) => o.map((v, j) => v || j === i));
    flyShards(i, last ? FLIP_BEST_MS : FLIP_MS);
  };

  const endWalk = () => {
    if (!walk) return;
    const i = walk.i;
    setWalk(null);
    if (phase === 'summary') return;
    setOpen((o) => o.map((v, j) => v || j === i));
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
    setWalk(null);
    setOpen((o) => o.map(() => true));
    setTally(cards.reduce((n, c) => n + c.shards, 0) + (preview ? 0 : packBonus));
    document.querySelectorAll('.pk-chip').forEach((n) => n.remove());
    setPhase('summary');
  };

  const walkAdvance = () => setWalk((w) => (w ? { ...w, step: Math.min(w.step + 1, w.beats.length - 1) } : w));
  const walkSkip = () => setWalk((w) => (w ? { ...w, step: skipStep(w.beats, w.step) } : w));

  /** One step forward: tear, skip the tear or tell, flip the next card, or speed up a walkout. */
  const advance = () => {
    if (walk) {
      if (walk.step >= walk.beats.length - 1) endWalk();
      else walkAdvance();
      return;
    }
    if (phase === 'sealed') startTear();
    else if (phase === 'tearing') setPhase('tell');
    else if (phase === 'tell') setPhase('reveal');
    else if (phase === 'reveal') flipNext();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    e.preventDefault();
    advance();
  };

  // Drag across the top of the pack to tear it (a plain tap tears too)
  const drag = useRef<{ x: number; w: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const onPackDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (phase !== 'sealed') return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, w: r.width, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPackMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const k = Math.max(0, Math.min(1, (e.clientX - d.x) / (d.w * 0.8)));
    if (k > 0.04) d.moved = true;
    setTear(k);
  };
  const onPackUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      // The click that follows a drag is not a tap
      dragged.current = true;
      if (tear >= 0.5) startTear();
      else setTear(0);
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
  const sprites = pack.filter((c) => c.variant === 'sprite').length;
  const summaryLine = () => {
    if (preview) return 'Preview only. Nothing was added to your binder.';
    const parts = [`${fresh} new`];
    if (legends) parts.push(`${legends} Legendary`);
    if (holos) parts.push(`${holos} Holo`);
    if (sprites) parts.push(`${sprites} Sprite`);
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

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={contentRef}
        // The walkout is a full-screen show: no swipe (Skip ends it)
        swipeToClose={!walk}
        className={cn(
          'pk-dialog content-start border-line bg-night p-4 sm:p-6',
          // A walkout takes the whole screen, like FUT
          walk ? 'h-[100dvh] max-h-[100dvh] max-w-none overflow-hidden border-0 sm:rounded-none' : 'max-h-[calc(var(--safe-h)-1rem)] min-h-[min(620px,calc(var(--safe-h)-1rem))] max-w-5xl overflow-y-auto overflow-x-hidden',
          `pk-dialog--${t}`,
          `pk-phase--${phase}`,
          reduced && 'pk-rm',
        )}
        onKeyDown={onKey}
        onEscapeKeyDown={(e) => {
          // Esc skips: a walkout to its end, anything mid-pack to the summary; on the stage or summary it closes
          if (walk) {
            e.preventDefault();
            if (walk.step >= walk.beats.length - 1) endWalk();
            else walkSkip();
          } else if (phase === 'tearing' || phase === 'tell' || phase === 'reveal') {
            e.preventDefault();
            openAll();
          }
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 pr-12">
          <div className="min-w-0">
            <DialogTitle className="font-display text-2xl uppercase italic">
              {preview && <span className="mr-2 text-muted-foreground">Preview ·</span>}
              {packTitle(t)} <span className="text-gold">pack</span>
            </DialogTitle>
            <DialogDescription className="mt-1">{description}</DialogDescription>
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

        {(phase === 'sealed' || phase === 'tearing' || phase === 'tell') && (
          <div className={cn('pk-stage', `pk-stage--${t}`)} onClick={phase !== 'sealed' ? advance : undefined}>
            <span className="pk-stage__glow" aria-hidden="true" />
            {phase !== 'tell' && (
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
                }}
                disabled={phase !== 'sealed'}
                aria-label={`Tear open the ${spec.label}`}
                autoFocus
              >
                <PackArt type={t} />
              </button>
            )}
            {phase === 'sealed' && <p className="pk-hint">Tap or drag across the top to tear</p>}
            {phase === 'tearing' && (
              <span className="pk-bits" aria-hidden="true">
                {BITS.map(([x, dx, d], i) => (
                  <i key={i} style={{ left: `${x}%`, '--dx': `${dx}px`, animationDelay: `${d}ms` } as CSSProperties} />
                ))}
              </span>
            )}
            {phase === 'tell' && best && (
              <span
                className={cn('pk-tell', `pk-tell--${best.tier}`, `pk-tell--f-${best.finish}`)}
                style={{ '--tell-ms': `${tellMs}ms` } as CSSProperties}
                aria-hidden="true"
              >
                <span className="pk-tell__shaft" />
                <span className="pk-tell__shaft pk-tell__shaft--2" />
                {tierRank(best.tier) >= tierRank('epic') && <span className="pk-tell__shaft pk-tell__shaft--3" />}
                <span className="pk-tell__core" />
                {best.finish === 'silver' && <span className="pk-tell__glint" />}
                {best.finish === 'gold' && (
                  <span className="pk-tell__sparks">
                    {SPARKLES.map(([x, y, d], i) => (
                      <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                )}
                {best.finish === 'holo' && <span className="pk-tell__burst" />}
              </span>
            )}
            {phase === 'tell' && best && (
              <p className="sr-only" role="status">
                {finishRank(best.finish) >= finishRank('gold') || tierRank(best.tier) >= tierRank('epic') ? 'Something special in this pack…' : 'Opening…'}
              </p>
            )}
          </div>
        )}

        {phase === 'reveal' && (
          <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            {t === 'perfect' && mark && !preview && (
              <p className="pk-provenance">
                <Trophy className="h-4 w-4" aria-hidden="true" /> {mark}
              </p>
            )}
            <ol className="pk-fan" style={{ '--pk-n': pack.length } as CSSProperties} aria-label="Cards in this pack">
              {pack.map((c, i) => {
                const info = describe(c);
                const shown = open[i];
                const isBest = i === pack.length - 1;
                const tag = tagOf(c);
                const next = !shown && open.indexOf(false) === i;
                return (
                  <li
                    key={`${info.key}-${i}`}
                    ref={(el) => (cardEls.current[i] = el)}
                    className={cn('pk-flip', `pk-flip--${c.tier}`, `pk-flip--f-${c.finish}`, shown && 'pk-flip--open', isBest && 'pk-flip--best', c.variant === 'sprite' && shown && 'pk-flip--sprite')}
                    style={{ '--i': i, '--off': i - (pack.length - 1) / 2 } as CSSProperties}
                  >
                    <div className="pk-flip__inner">
                      <div className="pk-flip__face" aria-hidden={!shown}>
                        <CollectibleCard
                          owned
                          live={shown}
                          player={info.player}
                          tier={c.tier}
                          finish={c.finish}
                          variant={shown ? c.variant : undefined}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          flipNext();
                        }}
                        disabled={shown}
                        tabIndex={next ? 0 : -1}
                        aria-hidden={shown}
                        aria-label={next ? `Flip card ${i + 1} of ${pack.length}` : `Card ${i + 1} of ${pack.length}, face down`}
                      >
                        <span className="pk-back__shape">
                          <span className="pk-back__logo">{t === 'perfect' ? '18–0' : 'RV'}</span>
                        </span>
                      </button>
                    </div>
                    {shown && <span className="pk-flip__pop" aria-hidden="true" />}
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
                    {shown && (
                      <p className="sr-only" role="status">
                        {info.player.name}, {variantLabel(c.variant)} variant, {tierLabel(c.tier)} tier, {finishLabel(c.finish)} finish, OVR {info.ovr ?? 'unknown'}
                        {preview ? '' : `, ${TAG_LABEL[tag]}${c.duplicate ? `, plus ${c.shards} shards` : ''}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {phase === 'summary' && pack.length > 0 && (
          <div className="pk-sum">
            <ol className="pk-sum__grid" aria-label="Your pull">
              {[...pack].reverse().map((c, k) => {
                const info = describe(c);
                const tag = tagOf(c);
                return (
                  <li key={`${info.key}-${k}`} className={cn('pk-sum__card', k === 0 && 'pk-sum__card--best')} style={{ '--k': k } as CSSProperties}>
                    {k === 0 && <span className="pk-sum__best">Best pull</span>}
                    <CollectibleCard
                      owned
                      player={info.player}
                      tier={c.tier}
                      finish={c.finish}
                      variant={c.variant}
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
                  </li>
                );
              })}
            </ol>
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

        <div className="pk-actions">
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

        {walk && walking && (
          <Walkout
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
