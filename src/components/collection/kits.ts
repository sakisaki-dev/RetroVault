import type { Player } from '@/types/player';
import { LEGACY_KIT, displayOf, ownsCombo, shownParallel, type DisplayChoice, type Finish, type KitSource, type OwnedCard, type Variant } from '@/utils/collection';
import { KIT_RANK, kindOf, kitUniform, kitsOf, type KitKind, type Uniform } from './art/sprite/uniforms';

/**
 * The kit chase, wired to the uniform tables: the pack code's KitSource, and what an owned card's kits resolve to.
 * Kept out of src/utils/collection.ts (main bundle) so the uniform tables load with the Collection only.
 */

/** Kits for the pack rolls (rollPack / openPack): a club's alternates and era kit, and the old fixed roll. */
export const KIT_SOURCE: KitSource = {
  of: (team) => {
    const k = kitsOf(team);
    return { alts: k.alts.map((u) => u.id), ...(k.era ? { era: k.era.id } : {}) };
  },
  legacy: (player: Player, variant: Variant, finish: Finish) => kitUniform(player, LEGACY_KIT, variant, finish).id,
};

/** A club's kit ids (for kitChance). */
export const clubKits = (team: string | undefined) => KIT_SOURCE.of(team);

/** One kit owned in a variant × finish, resolved on the card's player. */
export interface OwnedKit {
  /** Stored kit id (pass it to CollectibleCard `kit` / kitUniform) */
  id: string;
  uniform: Uniform;
  kind: KitKind;
  count: number;
}

/**
 * Kits owned in one variant × finish, resolved on the card's player (his card team), best first: era kit, then
 * alternates, then home. Stored ids that resolve to the same uniform (a legacy card that wore home, and a home pull)
 * are merged. Empty for the Autograph (its art is the signed card) and for combos not owned.
 */
export const ownedKits = (card: OwnedCard | undefined, player: { name: string; team?: string }, variant: Variant, finish: Finish): OwnedKit[] => {
  const v = card?.variants[variant];
  if (!v || variant === 'auto' || !ownsCombo(card, variant, finish)) return [];
  const stored = v.kits?.[finish];
  const entries: [string, number][] = stored && Object.keys(stored).length ? Object.entries(stored) : [[LEGACY_KIT, v.counts[finish] ?? 1]];
  const byUniform = new Map<string, OwnedKit>();
  entries.forEach(([id, count]) => {
    const uniform = kitUniform(player, id, variant, finish);
    const hit = byUniform.get(uniform.id);
    if (hit) hit.count += count;
    // A concrete id rather than the legacy sentinel, so a pinned kit keeps matching after the next pull resolves it
    else byUniform.set(uniform.id, { id: id === LEGACY_KIT ? uniform.id : id, uniform, kind: kindOf(uniform), count });
  });
  return [...byUniform.values()].sort((a, b) => KIT_RANK[b.kind] - KIT_RANK[a.kind] || a.uniform.label.localeCompare(b.uniform.label));
};

/** The best kit owned in one variant × finish (era > alternate > home); undefined for the Autograph or none owned. */
export const bestKit = (card: OwnedCard | undefined, player: { name: string; team?: string }, variant: Variant, finish: Finish): OwnedKit | undefined =>
  ownedKits(card, player, variant, finish)[0];

/**
 * displayOf plus the kit and the Prizm parallel: the display choice's kit (and parallel) when he still owns it in that
 * variant × finish, else the best kit (and the rarest parallel) owned there.
 */
export const displayWithKit = (card: OwnedCard | undefined, choice: DisplayChoice | undefined, player: { name: string; team?: string }) => {
  const d = displayOf(card, choice);
  const kits = ownedKits(card, player, d.variant, d.finish);
  const chosen = d.pinned && choice?.kit ? kits.find((k) => k.id === choice.kit || k.uniform.id === choice.kit) : undefined;
  const kit = (chosen ?? kits[0])?.id;
  const prizm = shownParallel(card, d.variant, d.finish, d.pinned ? choice?.parallel : undefined);
  return { ...d, ...(kit ? { kit } : {}), ...(prizm ? { prizm } : {}) };
};
