import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PACKS, finishLabel, tierLabel, type PackCard, type PackType } from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import type { CardInfo } from './useCardPool';

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

type Stage = 'sealed' | 'tearing' | 'reveal';

const SUB: Record<PackType, string> = {
  standard: '3 cards',
  premium: '4 cards · Gold+ inside',
  elite: '5 cards · Epic+ inside',
  perfect: '5 cards · 3 chase slots',
};

interface PackOpeningProps {
  /** Pack being opened (null keeps the dialog closed) */
  type: PackType | null;
  onClose: () => void;
  /** Rolls and stores one pack of `type` (null when none is left) */
  onTear: (type: PackType) => PackCard[] | null;
  describe: (c: PackCard) => CardInfo;
  total: number;
  /** Unopened packs of this type (live count) */
  remaining: number;
  /** Provenance of the next Perfect Season pack */
  provenance?: string;
}

/** Card label for the reveal stamp. */
const badgeOf = (c: PackCard) => (c.isNew ? 'New' : c.upgrade ? 'Upgrade' : c.duplicate ? `Dupe +${c.shards}` : 'New finish');

/**
 * Reward pack: a foil pack (colors per type) you tear open, then the cards flip one at a time with a
 * glow in their finish color. A Holo card charges up before it flips and lands with a burst; the
 * Perfect Season pack opens with a trophy and confetti and flips its three chase cards last. With
 * reduced motion everything is shown face up right away.
 */
const PackOpening = ({ type, onClose, onTear, describe, total, remaining, provenance }: PackOpeningProps) => {
  const [stage, setStage] = useState<Stage>('sealed');
  const [pack, setPack] = useState<PackCard[]>([]);
  const [flipped, setFlipped] = useState(0);
  const [charging, setCharging] = useState(-1);
  const [shownType, setShownType] = useState<PackType>('standard');
  const [mark, setMark] = useState<string | undefined>();
  const doneRef = useRef<HTMLButtonElement>(null);
  const open = type != null;
  const t = type ?? shownType;
  const spec = PACKS[t];

  const reset = () => {
    setStage('sealed');
    setPack([]);
    setFlipped(0);
    setCharging(-1);
  };

  useEffect(() => {
    if (type) setShownType(type);
    if (!open) reset();
  }, [open, type]);

  useEffect(() => {
    if (stage !== 'tearing') return;
    const id = window.setTimeout(() => setStage('reveal'), t === 'perfect' ? 1500 : 1050);
    return () => window.clearTimeout(id);
  }, [stage, t]);

  // Flip schedule: plain cards every 750ms; Holo (and every chase card) charges first.
  useEffect(() => {
    if (stage !== 'reveal' || flipped >= pack.length) return;
    const c = pack[flipped];
    const suspense = c.finish === 'holo' || c.slot === 'chase';
    if (suspense && charging !== flipped) {
      const id = window.setTimeout(() => setCharging(flipped), flipped === 0 ? 250 : 650);
      return () => window.clearTimeout(id);
    }
    const delay = suspense ? (c.finish === 'holo' ? 1500 : 900) : flipped === 0 ? 250 : 750;
    const id = window.setTimeout(() => setFlipped((n) => n + 1), delay);
    return () => window.clearTimeout(id);
  }, [stage, flipped, pack, charging]);

  const allOpen = stage === 'reveal' && flipped >= pack.length && pack.length > 0;
  useEffect(() => {
    if (allOpen) doneRef.current?.focus();
  }, [allOpen]);

  const tear = () => {
    if (stage !== 'sealed' || !type) return;
    const label = provenance;
    const cards = onTear(type);
    if (!cards) {
      onClose();
      return;
    }
    setMark(label);
    setPack(cards);
    if (reducedMotion()) {
      setFlipped(cards.length);
      setStage('reveal');
    } else {
      setStage('tearing');
    }
  };

  const fresh = pack.filter((c) => c.isNew).length;
  const holos = pack.filter((c) => c.finish === 'holo').length;
  const dupeShards = pack.reduce((s, c) => s + c.shards, 0);
  // `remaining` is live, so once torn it already excludes the pack on screen
  const more = remaining;

  const summary = () => {
    const parts = [`${fresh} new player${fresh === 1 ? '' : 's'}`];
    if (holos) parts.push(`${holos} Holo${holos === 1 ? '' : 's'}`);
    if (dupeShards) parts.push(`+${dupeShards} shards from duplicates`);
    return `${parts.join(' · ')}.`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn('pk-dialog max-h-[92vh] max-w-5xl overflow-y-auto border-line bg-night', `pk-dialog--${t}`)}>
        <DialogTitle className="font-display text-2xl uppercase italic">
          {t === 'perfect' ? (
            <>
              Perfect <span className="text-gold">Season</span> pack
            </>
          ) : (
            <>
              {spec.label.replace(' Pack', '')} <span className="text-gold">pack</span>
            </>
          )}
        </DialogTitle>
        <DialogDescription>
          {stage === 'sealed'
            ? `${spec.guarantee}${t === 'perfect' && provenance ? ` Earned: ${provenance}.` : ''}`
            : allOpen
              ? summary()
              : 'Opening…'}
        </DialogDescription>

        {stage !== 'reveal' ? (
          <div className="pk-stage">
            <button
              type="button"
              className={cn('pk-pack', `pk-pack--${t}`, stage === 'tearing' && 'pk-pack--tearing')}
              onClick={tear}
              disabled={stage !== 'sealed'}
              aria-label={`Tear open the ${spec.label}`}
              autoFocus
            >
              <span className="pk-pack__strip" aria-hidden="true" />
              <span className="pk-pack__crimp pk-pack__crimp--top" aria-hidden="true" />
              <span className="pk-pack__tear" aria-hidden="true" />
              <span className="pk-pack__label" aria-hidden="true">
                <span className="pk-pack__sub">Retro Vault</span>
                {t === 'perfect' ? (
                  <>
                    <Trophy className="h-8 w-8" />
                    <span className="pk-pack__title pk-pack__title--big">18–0</span>
                    <span className="pk-pack__sub">Perfect season</span>
                  </>
                ) : (
                  <span className="pk-pack__title">
                    {spec.label.replace(' Pack', '')}
                    <br />
                    Pack
                  </span>
                )}
                <span className="pk-pack__sub">{SUB[t]}</span>
                <span className="pk-pack__sub" style={{ marginTop: 14 }}>
                  Tap to tear
                </span>
              </span>
              <span className="pk-pack__crimp pk-pack__crimp--bottom" aria-hidden="true" />
            </button>
            {t === 'perfect' && stage === 'tearing' && (
              <span className="pk-burst" aria-hidden="true">
                {Array.from({ length: 18 }, (_, i) => (
                  <i key={i} style={{ '--i': i } as CSSProperties} />
                ))}
              </span>
            )}
          </div>
        ) : (
          <>
            {t === 'perfect' && mark && (
              <p className="pk-provenance">
                <Trophy className="h-4 w-4" aria-hidden="true" /> {mark}
              </p>
            )}
            <ol className="pk-cards" style={{ '--pk-n': pack.length } as CSSProperties} aria-label="Cards in this pack">
              {pack.map((c, i) => {
                const info = describe(c);
                const shown = i < flipped;
                const holo = c.finish === 'holo';
                return (
                  <li
                    key={`${info.key}-${i}`}
                    className={cn(
                      'pk-flip',
                      shown && 'pk-flip--open',
                      charging === i && !shown && 'pk-flip--charging',
                      holo && shown && 'pk-flip--holo',
                      c.slot === 'chase' && 'pk-flip--chase',
                    )}
                  >
                    {c.slot === 'chase' && <span className="pk-chase">Chase</span>}
                    <div className="pk-flip__inner">
                      <div className="pk-flip__face" aria-hidden={!shown}>
                        <CollectibleCard
                          owned
                          player={info.player}
                          tier={c.tier}
                          finish={c.finish}
                          ovr={info.ovr}
                          number={info.number}
                          retiredBy={info.retiredBy}
                          setNo={info.setNo}
                          setTotal={total}
                          badge={badgeOf(c)}
                          marks={c.mark ? [c.mark] : undefined}
                        />
                      </div>
                      <div className="pk-flip__face pk-flip__back" aria-hidden="true">
                        <span>{t === 'perfect' ? '18–0' : 'RV'}</span>
                      </div>
                    </div>
                    {holo && shown && (
                      <span className="pk-holo-hit" aria-hidden="true">
                        <Sparkles className="h-3.5 w-3.5" /> Holo
                      </span>
                    )}
                    {shown && (
                      <p className="sr-only" role="status">
                        {holo ? 'Holo pull! ' : ''}
                        {info.player.name}, {tierLabel(c.tier)} player, {finishLabel(c.finish)} finish, {badgeOf(c)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              {allOpen && more > 0 && (
                <Button variant="outline" onClick={reset}>
                  Open another ({more} left)
                </Button>
              )}
              <Button ref={doneRef} onClick={onClose} disabled={!allOpen}>
                {allOpen ? 'Add to binder' : 'Revealing…'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PackOpening;
