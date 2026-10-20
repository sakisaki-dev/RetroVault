import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { PACKS, finishLabel, tierLabel, type PackCard, type PackType, type Tier } from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import type { CardInfo } from './useCardPool';

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
};

/** Walkout steps: lights, OVR, position, team, then the card. */
const WALK_STEPS = [1000, 900, 800, 900] as const;
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
const badgeOf = (c: PackCard) => (c.isNew ? 'New' : c.upgrade ? 'Upgrade' : c.duplicate ? `Dupe +${c.shards}` : 'New finish');

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

interface WalkoutProps {
  card: PackCard;
  info: CardInfo;
  total: number;
  step: number;
  onSkip: () => void;
  onDone: () => void;
}

/** FUT-style walkout for a Legendary pull: lights, team-colour sweep, then OVR, position, team and the card. */
const Walkout = ({ card, info, total, step, onSkip, onDone }: WalkoutProps) => {
  const team = findNFLTeam(info.player.team);
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (step >= WALK_STEPS.length) doneRef.current?.focus();
  }, [step]);
  const style = (team ? { '--wk-a': `hsl(${team.primaryColor})`, '--wk-b': `hsl(${team.secondaryColor})` } : {}) as CSSProperties;
  return (
    <div className={cn('wk', `wk--s${Math.min(step, WALK_STEPS.length)}`)} style={style} role="dialog" aria-label="Legendary walkout">
      <span className="wk__beam wk__beam--l" aria-hidden="true" />
      <span className="wk__beam wk__beam--r" aria-hidden="true" />
      <span className="wk__sweep" aria-hidden="true" />
      <span className="wk__flare" aria-hidden="true" />
      <div className="wk__clues" aria-live="polite">
        {step >= 1 && <span className="wk__ovr">{info.ovr ?? '–'}</span>}
        {step >= 2 && <span className="wk__pos">{POSITION_NAMES[info.player.position] ?? info.player.position}</span>}
        {step >= 3 && (
          <span className="wk__team">
            {team ? <TeamLogo team={info.player.team} size={64} decorative /> : <span className="text-4xl">★</span>}
            <span>{team?.name ?? (info.player.isRealLegend ? 'NFL Legend' : info.franchise)}</span>
          </span>
        )}
      </div>
      {step >= WALK_STEPS.length && (
        <div className="wk__card">
          <CollectibleCard
            owned
            live
            large
            player={info.player}
            tier={card.tier}
            finish={card.finish}
            ovr={info.ovr}
            number={info.number}
            stats={info.stats}
            setNo={info.setNo}
            setTotal={total}
            badge={badgeOf(card)}
          />
          <p className="sr-only" role="status">
            Legendary! {info.player.name}, {finishLabel(card.finish)} finish
          </p>
        </div>
      )}
      <div className="wk__actions">
        {step < WALK_STEPS.length ? (
          <Button variant="outline" size="sm" onClick={onSkip}>
            Skip
          </Button>
        ) : (
          <Button ref={doneRef} onClick={onDone}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Reward pack as an event: the foil pack tears open, the cards fan out face down and you flip each one. Each
 * flip flashes the card's rarity first; a Legendary pull gets a walkout (lights, team-colour sweep, then OVR,
 * position, team and the player). Holo cards land with a prismatic shine. "Reveal all" flips the rest at once,
 * Skip jumps past a walkout. With reduced motion the cards are face up right away and there is no walkout.
 */
const PackOpening = ({ type, onClose, onTear, describe, total, remaining, provenance, preview = false }: PackOpeningProps) => {
  const [stage, setStage] = useState<Stage>('sealed');
  const [pack, setPack] = useState<PackCard[]>([]);
  const [open, setOpen] = useState<boolean[]>([]);
  const [flash, setFlash] = useState(-1);
  const [walk, setWalk] = useState<{ i: number; step: number } | null>(null);
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
      if (c.tier === 'legendary' && !reducedMotion()) setWalk({ i: flash, step: 0 });
      else setOpen((o) => o.map((v, j) => v || j === flash));
    }, FLASH_MS[c.tier]);
    return () => window.clearTimeout(id);
  }, [flash, pack]);

  // Walkout steps
  useEffect(() => {
    if (!walk || walk.step >= WALK_STEPS.length) return;
    const id = window.setTimeout(() => setWalk((w) => (w ? { ...w, step: w.step + 1 } : w)), WALK_STEPS[walk.step]);
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
    setMark(label);
    setPack(cards);
    if (reducedMotion()) {
      setOpen(cards.map(() => true));
      setStage('fan');
    } else {
      setOpen(cards.map(() => false));
      setStage('tearing');
    }
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

  const fresh = pack.filter((c) => c.isNew).length;
  const holos = pack.filter((c) => c.finish === 'holo').length;
  const legends = pack.filter((c) => c.tier === 'legendary').length;
  const dupeShards = pack.reduce((s, c) => s + c.shards, 0);

  const summary = () => {
    if (preview) return 'Preview only. Nothing was added to your binder.';
    const parts = [`${fresh} new`];
    if (legends) parts.push(`${legends} Legendary`);
    if (holos) parts.push(`${holos} Holo`);
    if (dupeShards) parts.push(`+${dupeShards} shards`);
    return parts.join(' · ');
  };

  const walking = walk ? pack[walk.i] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          'pk-dialog max-h-[94vh] min-h-[min(620px,94vh)] max-w-5xl content-start border-line bg-night p-4 sm:p-6',
          walk ? 'overflow-hidden' : 'overflow-y-auto',
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
                        {info.player.name}, {tierLabel(c.tier)} {finishLabel(c.finish)}, OVR {info.ovr ?? 'unknown'}
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
            step={walk.step}
            onSkip={() => setWalk((w) => (w ? { ...w, step: WALK_STEPS.length } : w))}
            onDone={endWalk}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PackOpening;
