import {
  FINISHES,
  VARIANTS,
  bestParallel,
  finishLabel,
  ownedVariants,
  prizmInfo,
  prizmSerial,
  variantLabel,
  type Finish,
  type OwnedAuto,
  type OwnedCard,
  type PrizmCopy,
  type Variant,
} from '@/utils/collection';
import { autographPrice, cardPrice, holdingPrice, parallelMultiplier, type MarketSnapshot } from '@/utils/cardMarket';
import { autographValue, parallelOf, serialStr } from '@/config/autographs';
import type { CopyFacts, CopyRef } from '@/utils/economy';
import { bestKit, ownedKits } from '../kits';
import { kitName } from '../art/sprite/uniforms';
import type { CardInfo } from '../useCardPool';

/**
 * Every owned copy of a card as something that can be handed over (sold, traded up, turned in for a bounty), with its
 * market price now. Kits and Prizm parallels are stored separately per variant × finish, so copies pair them best with
 * best: copy 0 of a variant × finish wears the best kit and the rarest parallel (the one a binder shows and "Sell
 * duplicates" keeps), the next copy the next best, and so on. Autographs are one copy each, by their own roll.
 */
export interface OwnedCopy {
  ref: CopyRef;
  info: CardInfo;
  variant: Variant;
  finish: Finish;
  /** Stored kit id and its kind (cards but the Autograph) */
  kit?: string;
  kitKind: 'home' | 'alt' | 'era';
  kitLabel?: string;
  prizm?: PrizmCopy;
  auto?: OwnedAuto;
  /** Market price now, in coins */
  price: number;
  /** Position within its variant × finish, best first (0 = the copy a binder shows) */
  rank: number;
  /** Copies of this variant × finish */
  of: number;
  /** Copies of this player in all */
  playerTotal: number;
  /** "Prizm number · Gold · Throwback · Red 12/199" */
  label: string;
  /** Unique within the binder */
  id: string;
}

const describe = (variant: Variant, finish: Finish, kitKind: string, kitLabel: string | undefined, prizm?: PrizmCopy, auto?: OwnedAuto) =>
  [
    variantLabel(variant),
    finishLabel(finish),
    kitKind !== 'home' && kitLabel ? kitLabel : null,
    prizm ? `${prizmInfo(prizm.c).label} ${prizmSerial(prizm)}` : null,
    auto ? `${parallelOf(auto.roll.parallel).label} ${serialStr(auto.roll)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** Every copy of one player's card, best first within each variant × finish. `value`: his base card value now. */
export const copiesOf = (info: CardInfo, card: OwnedCard | undefined, autos: OwnedAuto[], value: number): OwnedCopy[] => {
  if (!card) return [];
  const out: OwnedCopy[] = [];
  VARIANTS.forEach(({ key: variant }) => {
    const v = card.variants[variant];
    if (!v) return;
    FINISHES.forEach(({ key: finish }) => {
      const n = v.counts[finish] ?? 0;
      if (!n) return;
      if (variant === 'auto') {
        const mine = autos
          .filter((a) => a.key === info.key && a.finish === finish)
          .map((a) => ({ a, mult: autographValue(a.roll).total }))
          .sort((x, y) => y.mult - x.mult);
        mine.forEach(({ a, mult }, i) =>
          out.push({
            ref: { kind: 'auto', key: info.key, id: a.id },
            info,
            variant,
            finish,
            kitKind: 'home',
            auto: a,
            price: autographPrice(value, mult, finish),
            rank: i,
            of: mine.length,
            playerTotal: 0,
            label: describe(variant, finish, 'home', undefined, undefined, a),
            id: `${info.key}|auto|${a.id}`,
          }),
        );
        return;
      }
      // Kits best first, one entry per copy (padded with home if the store holds fewer)
      const kits = ownedKits(card, info.player, variant, finish).flatMap((k) => Array.from({ length: k.count }, () => k));
      // Parallels rarest first, padded with plain copies
      const pars: (PrizmCopy | undefined)[] = [...(v.prizm?.[finish] ?? [])].sort((a, b) => parallelMultiplier(b) - parallelMultiplier(a) || a.n - b.n);
      for (let i = 0; i < n; i++) {
        const k = kits[i];
        const prizm = variant === 'number' ? pars[i] : undefined;
        const kind = k?.kind ?? 'home';
        const kitLabel = k ? kitName(k.uniform) : undefined;
        out.push({
          ref: { kind: 'card', key: info.key, variant, finish, kit: k?.id ?? 'home', ...(prizm ? { prizm } : {}) },
          info,
          variant,
          finish,
          kit: k?.id,
          kitKind: kind,
          kitLabel,
          ...(prizm ? { prizm } : {}),
          price: cardPrice(value, finish, variant, kind, prizm),
          rank: i,
          of: n,
          playerTotal: 0,
          label: describe(variant, finish, kind, kitLabel, prizm),
          id: `${info.key}|${variant}|${finish}|${i}`,
        });
      }
    });
  });
  out.forEach((c) => (c.playerTotal = out.length));
  return out;
};

/** Every copy in the binder. */
export const allCopies = (byKey: Map<string, CardInfo>, owned: Record<string, OwnedCard>, autos: OwnedAuto[], latest: MarketSnapshot | undefined): OwnedCopy[] =>
  Object.entries(owned).flatMap(([key, card]) => {
    const info = byKey.get(key);
    const value = latest?.players[key]?.value;
    return info && value != null ? copiesOf(info, card, autos, value) : [];
  });

/** Facts a bounty tests (economy.ts CopyFacts). */
export const factsOf = (c: OwnedCopy, change: number | null): CopyFacts => ({
  key: c.info.key,
  position: c.info.player.position,
  tier: c.info.tier,
  franchise: c.info.franchise,
  variant: c.variant,
  finish: c.finish,
  kitKind: c.kitKind,
  ...(c.prizm ? { prizm: c.prizm } : {}),
  change,
});

/**
 * What handing these copies over takes from the binder: the variant × finish combos left with no copy, and the
 * players left with no card at all (they leave the binder).
 */
export const consumes = (picked: OwnedCopy[]) => {
  const combos = new Map<string, { c: OwnedCopy; n: number }>();
  const players = new Map<string, { c: OwnedCopy; n: number }>();
  picked.forEach((c) => {
    const ck = `${c.info.key}|${c.variant}|${c.finish}`;
    combos.set(ck, { c, n: (combos.get(ck)?.n ?? 0) + 1 });
    players.set(c.info.key, { c, n: (players.get(c.info.key)?.n ?? 0) + 1 });
  });
  return {
    lastCombos: [...combos.values()].filter((x) => x.n >= x.c.of).map((x) => x.c),
    leaving: [...players.values()].filter((x) => x.n >= x.c.playerTotal).map((x) => x.c),
  };
};

/**
 * Copies "Sell duplicates" would sell: every copy beyond the first (best) of each variant × finish. With `keepUnique`,
 * a copy is also kept when it is the first of its kit or parallel colour in that variant × finish, and autographs
 * (each one unique) are kept.
 */
export const duplicateCopies = (copies: OwnedCopy[], keepUnique: boolean): OwnedCopy[] => {
  const seenKit = new Set<string>();
  const seenPar = new Set<string>();
  return copies.filter((c) => {
    const combo = `${c.info.key}|${c.variant}|${c.finish}`;
    const kitKey = `${combo}|${c.kitLabel ?? c.kit ?? 'home'}`;
    const parKey = `${combo}|${c.prizm?.c ?? 'plain'}`;
    const newKit = !seenKit.has(kitKey);
    const newPar = !seenPar.has(parKey);
    seenKit.add(kitKey);
    seenPar.add(parKey);
    if (c.rank === 0) return false;
    if (!keepUnique) return true;
    if (c.variant === 'auto') return false;
    return !newKit && !newPar;
  });
};

/**
 * Portfolio value now: every (player, variant) owned at its best finish, in the best kit and parallel owned there, and
 * every autograph by its own roll (the Portfolio panel's rule, src/components/collection/market/Portfolio.tsx).
 */
export const portfolioValue = (owned: Record<string, OwnedCard>, autos: OwnedAuto[], byKey: Map<string, CardInfo>, latest: MarketSnapshot | undefined): number => {
  if (!latest) return 0;
  let sum = 0;
  Object.entries(owned).forEach(([key, c]) => {
    const p = latest.players[key];
    if (!p) return;
    const player = byKey.get(key)?.player;
    ownedVariants(c)
      .filter((v) => v !== 'auto')
      .forEach((variant) => {
        const finish = c.variants[variant]!.best;
        const prizm = bestParallel(c, variant, finish);
        sum += holdingPrice(p.value, { key, variant, finish, alt: player ? (bestKit(c, player, variant, finish)?.kind ?? 'home') : false, ...(prizm ? { prizm } : {}) });
      });
  });
  autos.forEach((a) => {
    const p = latest.players[a.key];
    if (p) sum += autographPrice(p.value, autographValue(a.roll).total, a.finish);
  });
  return sum;
};
