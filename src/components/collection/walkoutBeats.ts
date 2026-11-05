import { finishRank, tierRank, variantRank, type PackCard, type Tier } from '@/utils/collection';

/**
 * FUT-style walkout timeline. Each beat is one stage of the reveal and how long it holds before the next one
 * starts on its own (tap advances early). The holo twist is appended only for holo cards, after the flip, so
 * everything before it looks exactly like a normal walkout of that tier. An Autograph-variant card gets one more beat
 * after that: AUTOGRAPH, then his signature writing itself across the autograph card.
 */
export type WkStage = 'tunnel' | 'flares' | 'sweep' | 'logo' | 'pos' | 'ovr' | 'walk' | 'flip' | 'twist' | 'auto' | 'final';

export interface WkBeat {
  stage: WkStage;
  /** Hold before auto-advancing; 0 = wait for the player (final) */
  ms: number;
}

/**
 * Build-up per tier class, in stage order tunnel → walk: tightened to about 4.9 s (decoys and non-Legendary holos)
 * and 5.9 s (Legendary), since the pack's own tell has already built the moment.
 */
const BUILD: Record<'epic' | 'legendary', [WkStage, number][]> = {
  epic: [
    ['tunnel', 600],
    ['flares', 700],
    ['sweep', 600],
    ['logo', 650],
    ['pos', 600],
    ['ovr', 900],
    ['walk', 800],
  ],
  legendary: [
    ['tunnel', 800],
    ['flares', 900],
    ['sweep', 700],
    ['logo', 750],
    ['pos', 650],
    ['ovr', 1100],
    ['walk', 1000],
  ],
};

/** Flip hold: the card sits face up (still looking non-holo) for one beat before a holo twist. */
const FLIP_MS = 900;
const FLIP_HOLD_HOLO_MS = 1100;
/** Twist: flash, shockwave, shatter, stamp, shake and the slow 360° spin. */
export const TWIST_MS: Record<'normal' | 'legendary', number> = { normal: 3200, legendary: 3800 };
/** Autograph beat: the AUTOGRAPH kicker (AUTO_WRITE_DELAY_MS), the signature writing (AUTO_WRITE_MS), then a hold. */
export const AUTO_WRITE_DELAY_MS = 700;
export const AUTO_WRITE_MS = 1500;
const AUTO_MS = AUTO_WRITE_DELAY_MS + AUTO_WRITE_MS + 1100;
const AUTO_REDUCED_MS = 1400;

/**
 * Who walks out: every Legendary, every Holo and every Autograph (all rare), plus decoys. Decoys: about one in five other cards
 * walks out too, so a walkout doesn't give a Legendary or a holo away. Decided once per card object (stable across
 * re-renders). With reduced motion there are no decoys (needsWalkout(c, true)).
 */
const DECOY_RATE = 0.2;
const decoys = new WeakMap<PackCard, boolean>();
const isDecoy = (c: PackCard) => {
  if (!decoys.has(c)) decoys.set(c, Math.random() < DECOY_RATE);
  return decoys.get(c)!;
};

/** The Autograph variant (its autograph rides along as `auto`; previews attach a sample). */
export const isAuto = (c: Pick<PackCard, 'variant'>) => c.variant === 'auto';
export const isChase = (c: PackCard) => c.tier === 'legendary' || c.finish === 'holo';
export const needsWalkout = (c: PackCard, reduced = false) => isChase(c) || isAuto(c) || (!reduced && isDecoy(c));

const buildFor = (tier: Tier) => BUILD[tier === 'legendary' ? 'legendary' : 'epic'];

export const walkoutBeats = (c: PackCard, reduced: boolean): WkBeat[] => {
  const holo = c.finish === 'holo';
  const twist: WkBeat[] = holo ? [{ stage: 'twist', ms: reduced ? 900 : TWIST_MS[c.tier === 'legendary' ? 'legendary' : 'normal'] }] : [];
  const auto: WkBeat[] = isAuto(c) ? [{ stage: 'auto', ms: reduced ? AUTO_REDUCED_MS : AUTO_MS }] : [];
  if (reduced) return [{ stage: 'flip', ms: holo ? 1200 : 600 }, ...twist, ...auto, { stage: 'final', ms: 0 }];
  return [
    ...buildFor(c.tier).map(([stage, ms]) => ({ stage, ms })),
    { stage: 'flip', ms: holo || isAuto(c) ? FLIP_HOLD_HOLO_MS : FLIP_MS },
    ...twist,
    ...auto,
    { stage: 'final', ms: 0 },
  ];
};

/**
 * Step that Skip jumps to from `step`: the next special beat still ahead (a holo's twist, then an autograph), so the
 * reveal stays last; with none left, final.
 */
export const skipStep = (beats: WkBeat[], step: number) => {
  const t = beats.findIndex((b, i) => i > step && (b.stage === 'twist' || b.stage === 'auto'));
  return t >= 0 ? t : beats.length - 1;
};

/** Pack order for the reveal: weakest first, the best card last (an autograph, then tier, then finish, then OVR). */
export const bestLast = <C extends PackCard>(cards: C[], ovrOf: (c: C) => number | null) =>
  cards
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        Number(isAuto(a.c)) - Number(isAuto(b.c)) ||
        tierRank(a.c.tier) - tierRank(b.c.tier) ||
        finishRank(a.c.finish) - finishRank(b.c.finish) ||
        variantRank(a.c.variant) - variantRank(b.c.variant) ||
        (ovrOf(a.c) ?? 0) - (ovrOf(b.c) ?? 0) ||
        a.i - b.i,
    )
    .map((x) => x.c);
