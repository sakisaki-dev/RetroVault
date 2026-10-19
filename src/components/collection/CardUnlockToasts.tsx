import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CHANGE_EVENT, rarityLabel, rarityRank, registerToastListener, type CollectionChange } from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import { useCardPool, type CardInfo } from './useCardPool';

/**
 * Toast with the mini card for the best new card (plus "+N more"). Only the first mounted instance
 * shows toasts; while none is mounted, unlockCard falls back to a plain text toast.
 */
const owners: object[] = [];

const useCardUnlockToasts = () => {
  const { byKey, describe } = useCardPool();
  const lookup = useRef({ byKey, describe });
  lookup.current = { byKey, describe };

  useEffect(() => {
    const unregister = registerToastListener();
    const me = {};
    owners.push(me);
    const onChange = (e: Event) => {
      if (owners[0] !== me) return;
      const change = (e as CustomEvent<CollectionChange>).detail;
      if (!change || change.silent || !change.added.length) return;
      const { byKey: map, describe: info } = lookup.current;
      const cards: CardInfo[] = change.added.map((p) => map.get(`${p.position}:${p.name}`) ?? info(p));
      const best = [...cards].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || (b.ovr ?? 0) - (a.ovr ?? 0))[0];
      const more = cards.length - 1;
      toast.custom(
        () => (
          <div className="flex w-[min(340px,calc(100vw-32px))] flex-col gap-2 rounded-xl border border-line bg-card p-3 text-foreground shadow-elevated" role="status">
            <p className="font-pixel text-[10px] uppercase tracking-wider text-gold">
              {cards.length === 1 ? 'New card' : `${cards.length} new cards`} · {change.reason}
            </p>
            <CollectibleCard
              mini
              owned
              player={best.player}
              rarity={best.rarity}
              ovr={best.ovr}
              number={best.number}
              retiredBy={best.retiredBy}
              setNo={best.setNo || undefined}
              setTotal={map.size || undefined}
            />
            <p className="text-xs text-muted-foreground">
              {rarityLabel(best.rarity)}
              {more > 0 ? ` · +${more} more` : ''} · added to your Collection
            </p>
          </div>
        ),
        { duration: 4500 },
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

/** Mount once inside LeagueProvider to get card toasts when the Arcade unlocks cards. */
const CardUnlockToasts = () => {
  useCardUnlockToasts();
  return null;
};

export default CardUnlockToasts;
