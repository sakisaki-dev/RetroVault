import { useEffect } from 'react';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHANGE_EVENT, PACKS, registerToastListener, type CollectionChange } from '@/utils/collection';
import './collection.css';

/**
 * Toasts "Pack earned: Premium Pack (League Grid 9/9)" with a mini foil pack in that pack's colors.
 * Only the first mounted instance shows toasts; while none is mounted, awardPack falls back to a
 * plain text toast. (Name kept from v1, when games unlocked cards directly.)
 */
const owners: object[] = [];

const useCardUnlockToasts = () => {
  useEffect(() => {
    const unregister = registerToastListener();
    const me = {};
    owners.push(me);
    const onChange = (e: Event) => {
      if (owners[0] !== me) return;
      const change = (e as CustomEvent<CollectionChange>).detail;
      if (!change || change.kind !== 'earned') return;
      const spec = PACKS[change.type];
      toast.custom(
        () => (
          <div
            className="flex w-[min(340px,calc(100vw-32px))] items-center gap-3 rounded-xl border border-line bg-card p-3 text-foreground shadow-elevated"
            role="status"
          >
            <span className={cn('pk-mini', `pk-pack--${change.type}`)} aria-hidden="true">
              {change.type === 'perfect' ? <Trophy className="h-4 w-4" /> : spec.size}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block font-pixel text-[10px] uppercase tracking-wider text-gold">Pack earned</span>
              <span className="block font-display text-lg uppercase leading-tight">{spec.label}</span>
              <span className="block text-xs text-muted-foreground">
                {change.reason}
                {change.label ? ` · ${change.label}` : ''} · open it in Collection
              </span>
            </span>
          </div>
        ),
        { duration: 5000 },
      );
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      unregister();
      owners.splice(owners.indexOf(me), 1);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);
};

/** Mount once to get pack-earned toasts from the Arcade. */
const CardUnlockToasts = () => {
  useCardUnlockToasts();
  return null;
};

export default CardUnlockToasts;
