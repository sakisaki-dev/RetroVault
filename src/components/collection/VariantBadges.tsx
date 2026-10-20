import { cn } from '@/lib/utils';
import { VARIANTS, type OwnedCard } from '@/utils/collection';

/**
 * A binder tile's art variants: one small badge per variant, filled when owned and hollow when missing, rarest last.
 * Static (no animation), so a full binder stays idle.
 */
const VariantBadges = ({ entry }: { entry?: OwnedCard }) => {
  const have = VARIANTS.filter((v) => entry?.variants[v.key]);
  return (
    <p className="vbadges" aria-label={`Variants: ${have.length} of ${VARIANTS.length}${have.length ? ` (${have.map((v) => v.label).join(', ')})` : ''}`}>
      {VARIANTS.map((v) => {
        const owned = !!entry?.variants[v.key];
        return (
          <span key={v.key} className={cn('vbadge', `vbadge--${v.key}`, owned && 'is-owned')} title={`${v.label}: ${owned ? 'owned' : 'missing'}`} aria-hidden="true">
            {v.short[0]}
          </span>
        );
      })}
    </p>
  );
};

export default VariantBadges;
