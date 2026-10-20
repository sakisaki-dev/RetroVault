import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { isLite } from '@/hooks/usePerfMode';
import { Repeat, Sparkles, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PACKS, finishLabel, tierLabel, variantLabel, type PackCard, type PackType, type Tier } from '@/utils/collection';
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

type Stage = 'sealed' | 'tearing' | 'fan';

/** Short line under the pack art. */
const PACK_SUB: Record<PackType, string> = {
  standard: '3 cards',
  premium: '4 cards · Gold+ inside',
  elite: '5 cards · Epic+ inside',
  perfect: '5 cards · 3 chase slots',
  holo: '5 Holos · 2+ Legendary',
  exchange: 'League cards for your legends',
};

const FLASH_MS: Record<Tier, number> = { common: 380, rare: 480, epic: 620, legendary: 900 };

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

/** Card label for the reveal stamp. */
const badgeOf = (c: PackCard) => (c.isNew ? 'New' : c.newVariant ? 'New art' : c.upgrade ? 'Upgrade' : c.duplicate ? `Dupe +${c.shards}` : 'New finish');

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

/**
 * Reward pack as an event: the foil pack tears open, the cards fan out face down (weakest first, the best card
 * last) and you flip each one. Each flip flashes the card's tier first; commons and rares then flip in about a
 * second, while Epic+ pulls and every holo get a FUT-style walkout (Walkout.tsx, timings in walkout.ts). A holo
 * walks out like any card of its tier and only turns holo after the flip. Tap the walkout to advance a beat;
 * Skip jumps to the end (a holo still gets its twist); "Reveal all" flips every remaining card at once. With
 * reduced motion the flips are instant and a walkout is a short cross-fade that still reveals the holo last.
 */
const PackOpening = ({ type, onClose, onTear, describe, total, remaining, provenance, preview = false }: PackOpeningProps) => {
  const [stage, setStage] = useState<Stage>('sealed');
  const [pack, setPack] = useState<PackCard[]>([]);
  const [open, setOpen] = useState<boolean[]>([]);
  const [flash, setFlash] = useState(-1);
  const [walk, setWalk] = useState<WalkState | null>(null);
  const [shownType, setShownType] = useState<PackType>('standard');
  const [mark, setMark] = useState<string | undefined>();
  const doneRef = useRef<HTMLButtonElement>(null);
  const isOpen = type != null;
  const t = type ?? shownType;
  const spec = PACKS[t];

  const reset = () => {
    setStage('sealed');
    setPack([]);
    setOpen([]);
    setFlash(-1);
    setWalk(null);
  };

  useEffect(() => {
    if (type) setShownType(type);
    if (!isOpen) reset();
  }, [isOpen, type]);

  useEffect(() => {
    if (stage !== 'tearing') return;
    const id = window.setTimeout(() => setStage('fan'), t === 'perfect' || t === 'holo' ? 1400 : 1050);
    return () => window.clearTimeout(id);
  }, [stage, t]);

  // Rarity flash, then flip (or walk out)
  useEffect(() => {
    if (flash < 0) return;
    const c = pack[flash];
    if (!c) return;
    const id = window.setTimeout(() => {
      setFlash(-1);
      if (needsWalkout(c)) setWalk({ i: flash, step: 0, beats: walkoutBeats(c, reducedMotion()) });
      else setOpen((o) => o.map((v, j) => v || j === flash));
    }, FLASH_MS[c.tier]);
    return () => window.clearTimeout(id);
  }, [flash, pack]);

  // Walkout beats: each one holds for its own time, then the next starts (tap advances early)
  useEffect(() => {
    const ms = walk?.beats[walk.step]?.ms ?? 0;
    if (!walk || ms <= 0) return;
    const id = window.setTimeout(() => setWalk((w) => (w ? { ...w, step: Math.min(w.step + 1, w.beats.length - 1) } : w)), ms);
    return () => window.clearTimeout(id);
  }, [walk]);

  const allOpen = stage === 'fan' && pack.length > 0 && open.every(Boolean);
  useEffect(() => {
    if (allOpen && !walk) doneRef.current?.focus();
  }, [allOpen, walk]);

  const tear = () => {
    if (stage !== 'sealed' || !type) return;
    const label = provenance;
    const cards = onTear(type);
    if (!cards) {
      onClose();
      return;
    }
    const ordered = bestLast(cards, (c) => describe(c).ovr);
    setMark(label);
    setPack(ordered);
    setOpen(ordered.map(() => false));
    setStage(reducedMotion() ? 'fan' : 'tearing');
  };

  const reveal = (i: number) => {
    if (open[i] || flash >= 0 || walk) return;
    setFlash(i);
  };
  const revealAll = () => {
    setFlash(-1);
    setWalk(null);
    setOpen(pack.map(() => true));
  };
  const endWalk = () => {
    if (!walk) return;
    const i = walk.i;
    setWalk(null);
    setOpen((o) => o.map((v, j) => v || j === i));
  };
  const advance = () => setWalk((w) => (w ? { ...w, step: Math.min(w.step + 1, w.beats.length - 1) } : w));
  const skip = () =>
    setWalk((w) => {
      if (!w) return w;
      return { ...w, step: skipStep(w.beats, w.step) };
    });
  const othersHidden = walk ? open.some((v, j) => !v && j !== walk.i) : false;

  const fresh = pack.filter((c) => c.isNew).length;
  const holos = pack.filter((c) => c.finish === 'holo').length;
  const legends = pack.filter((c) => c.tier === 'legendary').length;
  const sprites = pack.filter((c) => c.variant === 'sprite').length;
  const dupeShards = pack.reduce((s, c) => s + c.shards, 0);

  const summary = () => {
    if (preview) return 'Preview only. Nothing was added to your binder.';
    const parts = [`${fresh} new`];
    if (legends) parts.push(`${legends} Legendary`);
    if (holos) parts.push(`${holos} Holo`);
    if (sprites) parts.push(`${sprites} Sprite`);
    if (dupeShards) parts.push(`+${dupeShards} shards`);
    return parts.join(' · ');
  };

  const walking = walk ? pack[walk.i] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          'pk-dialog content-start border-line bg-night p-4 sm:p-6',
          // A walkout takes the whole screen, like FUT
          walk ? 'h-[100dvh] max-h-[100dvh] max-w-none overflow-hidden border-0 sm:rounded-none' : 'max-h-[94vh] min-h-[min(620px,94vh)] max-w-5xl overflow-y-auto',
          `pk-dialog--${t}`,
        )}
      >
        <DialogTitle className="pr-8 font-display text-2xl uppercase italic">
          {preview && <span className="mr-2 text-muted-foreground">Preview ·</span>}
          {packTitle(t)} <span className="text-gold">pack</span>
        </DialogTitle>
        <DialogDescription className="-mt-2">
          {stage === 'sealed'
            ? `${PACK_SUB[t]}${t === 'perfect' && provenance ? ` · ${provenance}` : ''}`
            : allOpen
              ? summary()
              : 'Tap a card to flip it.'}
        </DialogDescription>

        {stage !== 'fan' ? (
          <div className="pk-stage">
            <button
              type="button"
              className={cn('pk-pack', `pk-pack--${t}`, stage === 'tearing' && 'pk-pack--tearing')}
              onClick={tear}
              disabled={stage !== 'sealed'}
              aria-label={`Tear open the ${spec.label}`}
              autoFocus
            >
              <PackArt type={t} />
            </button>
            {stage === 'sealed' && <p className="pk-hint">Tap to tear</p>}
            {(t === 'perfect' || t === 'holo') && stage === 'tearing' && (
              <span className={cn('pk-burst', t === 'holo' && 'pk-burst--holo')} aria-hidden="true">
                {Array.from({ length: 18 }, (_, i) => (
                  <i key={i} style={{ '--i': i } as CSSProperties} />
                ))}
              </span>
            )}
          </div>
        ) : (
          <>
            {t === 'perfect' && mark && !preview && (
              <p className="pk-provenance">
                <Trophy className="h-4 w-4" aria-hidden="true" /> {mark}
              </p>
            )}
            <ol className="pk-fan" style={{ '--pk-n': pack.length } as CSSProperties} aria-label="Cards in this pack">
              {pack.map((c, i) => {
                const info = describe(c);
                const shown = open[i];
                const holo = c.finish === 'holo';
                const mid = (pack.length - 1) / 2;
                return (
                  <li
                    key={`${info.key}-${i}`}
                    className={cn(
                      'pk-flip',
                      `pk-flip--${c.tier}`,
                      shown && 'pk-flip--open',
                      flash === i && 'pk-flip--flash',
                      holo && shown && 'pk-flip--holo',
                      shown && c.variant === 'sprite' && 'pk-flip--sprite',
                    )}
                    style={{ '--i': i, '--off': i - mid } as CSSProperties}
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
                          badge={preview ? undefined : badgeOf(c)}
                          marks={c.mark ? [c.mark] : undefined}
                        />
                      </div>
                      <button
                        type="button"
                        className="pk-flip__face pk-flip__back"
                        onClick={() => reveal(i)}
                        disabled={shown}
                        tabIndex={shown ? -1 : 0}
                        aria-hidden={shown}
                        aria-label={`Flip card ${i + 1} of ${pack.length}`}
                      >
                        <span className="pk-back__shape">
                          <span className="pk-back__logo">{t === 'perfect' ? '18–0' : 'RV'}</span>
                        </span>
                      </button>
                    </div>
                    {holo && shown && (
                      <span className="pk-holo-hit" aria-hidden="true">
                        <Sparkles className="h-3.5 w-3.5" /> Holo
                      </span>
                    )}
                    {shown && (
                      <p className="sr-only" role="status">
                        {info.player.name}, {variantLabel(c.variant)} variant, {tierLabel(c.tier)} tier, {finishLabel(c.finish)} finish, OVR{' '}
                        {info.ovr ?? 'unknown'}
                        {preview ? '' : `, ${badgeOf(c)}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!allOpen && (
                <Button variant="outline" onClick={revealAll}>
                  Reveal all
                </Button>
              )}
              {allOpen && !preview && remaining > 0 && (
                <Button variant="outline" onClick={reset}>
                  Open another ({remaining} left)
                </Button>
              )}
              {allOpen && preview && (
                <Button variant="outline" onClick={reset}>
                  Replay
                </Button>
              )}
              <Button ref={doneRef} onClick={onClose} disabled={!allOpen}>
                {preview ? 'Close' : 'Add to binder'}
              </Button>
            </div>
          </>
        )}
        {walk && walking && (
          <Walkout
            card={walking}
            info={describe(walking)}
            total={total}
            beats={walk.beats}
            step={walk.step}
            reduced={reducedMotion()}
            badge={preview ? undefined : badgeOf(walking)}
            onAdvance={advance}
            onSkip={skip}
            onDone={endWalk}
            onRevealAll={othersHidden ? revealAll : undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PackOpening;
