import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { rarityLabel, type PackCard } from '@/utils/collection';
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

interface PackOpeningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rolls and unlocks today's pack (null when it is already opened) */
  onTear: () => PackCard[] | null;
  describe: (c: PackCard) => CardInfo;
  total: number;
}

/**
 * Daily pack: a foil pack you tear open, then the three cards flip one at a time with a glow in their
 * rarity color. With reduced motion the cards are shown face up right away.
 */
const PackOpening = ({ open, onOpenChange, onTear, describe, total }: PackOpeningProps) => {
  const [stage, setStage] = useState<Stage>('sealed');
  const [pack, setPack] = useState<PackCard[]>([]);
  const [flipped, setFlipped] = useState(0);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) return;
    setStage('sealed');
    setPack([]);
    setFlipped(0);
  }, [open]);

  useEffect(() => {
    if (stage !== 'tearing') return;
    const id = window.setTimeout(() => setStage('reveal'), 1050);
    return () => window.clearTimeout(id);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'reveal' || flipped >= pack.length) return;
    const id = window.setTimeout(() => setFlipped((n) => n + 1), flipped === 0 ? 250 : 750);
    return () => window.clearTimeout(id);
  }, [stage, flipped, pack.length]);

  useEffect(() => {
    if (stage === 'reveal' && flipped >= pack.length && pack.length) doneRef.current?.focus();
  }, [stage, flipped, pack.length]);

  const tear = () => {
    if (stage !== 'sealed') return;
    const cards = onTear();
    if (!cards) {
      onOpenChange(false);
      return;
    }
    setPack(cards);
    if (reducedMotion()) {
      setFlipped(cards.length);
      setStage('reveal');
    } else {
      setStage('tearing');
    }
  };

  const allOpen = stage === 'reveal' && flipped >= pack.length;
  const fresh = pack.filter((c) => !c.duplicate).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-line bg-night">
        <DialogTitle className="font-display text-2xl uppercase italic">
          Daily <span className="text-gold">pack</span>
        </DialogTitle>
        <DialogDescription>
          {stage === 'sealed'
            ? 'Three cards, one pack a day. Rarer cards are rarer pulls.'
            : allOpen
              ? `${fresh} new card${fresh === 1 ? '' : 's'}${fresh < pack.length ? `, ${pack.length - fresh} already in your binder` : ''}.`
              : 'Opening…'}
        </DialogDescription>

        {stage !== 'reveal' ? (
          <div className="pk-stage">
            <button
              type="button"
              className={cn('pk-pack', stage === 'tearing' && 'pk-pack--tearing')}
              onClick={tear}
              disabled={stage !== 'sealed'}
              aria-label="Tear open today's pack"
              autoFocus
            >
              <span className="pk-pack__strip" aria-hidden="true" />
              <span className="pk-pack__crimp pk-pack__crimp--top" aria-hidden="true" />
              <span className="pk-pack__tear" aria-hidden="true" />
              <span className="pk-pack__label" aria-hidden="true">
                <span className="pk-pack__sub">Retro Vault</span>
                <span className="pk-pack__title">
                  Card
                  <br />
                  Pack
                </span>
                <span className="pk-pack__sub">3 cards · daily</span>
                <span className="pk-pack__sub" style={{ marginTop: 18 }}>
                  Tap to tear
                </span>
              </span>
              <span className="pk-pack__crimp pk-pack__crimp--bottom" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <ol className="pk-cards" aria-label="Cards in this pack">
              {pack.map((c, i) => {
                const info = describe(c);
                const shown = i < flipped;
                return (
                  <li key={info.key} className={cn('pk-flip', shown && 'pk-flip--open')}>
                    <div className="pk-flip__inner">
                      <div className="pk-flip__face" aria-hidden={!shown}>
                        <CollectibleCard
                          owned
                          player={info.player}
                          rarity={info.rarity}
                          ovr={info.ovr}
                          number={info.number}
                          retiredBy={info.retiredBy}
                          setNo={info.setNo}
                          setTotal={total}
                          badge={c.duplicate ? 'Dupe' : 'New'}
                        />
                      </div>
                      <div className="pk-flip__face pk-flip__back" aria-hidden="true">
                        <span>RV</span>
                      </div>
                    </div>
                    {shown && (
                      <p className="sr-only" role="status">
                        {info.player.name}, {rarityLabel(info.rarity)}
                        {c.duplicate ? ', already owned' : ', new'}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 flex justify-end">
              <Button ref={doneRef} onClick={() => onOpenChange(false)} disabled={!allOpen}>
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
