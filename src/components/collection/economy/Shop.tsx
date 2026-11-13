import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PACKS, type PackType, type Tier } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { SELL_RATE, SHOP_PACKS, SHOP_PRICES, buyPack, expectedPackPrice } from '@/utils/economy';
import { PackArt } from '../PackOpening';

interface ShopProps {
  coins: number;
  /** Mean base card value per tier now (null while the market loads) */
  meanValue: Record<Tier, number> | null;
  onOpenPack: (t: PackType) => void;
}

/**
 * Pack shop: Standard, Premium, Elite and Holo Showcase packs for coins (Perfect Season and Legends Exchange stay
 * earned). Each shows what its cards sell back for on average at today's prices, so the price reads honestly.
 */
const Shop = ({ coins, meanValue, onOpenPack }: ShopProps) => {
  const buy = (t: (typeof SHOP_PACKS)[number]) => {
    if (!buyPack(t)) {
      toast(`Not enough coins for a ${PACKS[t].label}.`);
      return;
    }
    toast.success(`${PACKS[t].label} bought`, { description: 'It is on your pack shelf.', action: { label: 'Open', onClick: () => onOpenPack(t) } });
  };
  return (
    <div>
      <ul className="ec-shop" aria-label="Packs for sale">
        {SHOP_PACKS.map((t) => {
          const price = SHOP_PRICES[t];
          const back = meanValue ? expectedPackPrice(t, meanValue) * SELL_RATE : null;
          const short = price - coins;
          return (
            <li key={t} className="ec-shop__item">
              <span className={cn('pk-pack', `pk-pack--${t}`)} aria-hidden="true">
                <PackArt type={t} small />
              </span>
              <span className="text-sm font-bold">{PACKS[t].label.replace(/ Pack$/, '')}</span>
              <span className="ec-shop__price">
                <span className="ec-coin ec-coin--sm" aria-hidden="true" />
                {fmtCoins(price)}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {PACKS[t].size} cards{back != null ? ` · sell back about ${fmtCoins(back)} on average` : ''}
              </span>
              <button type="button" className="ec-btn ec-btn--gold ec-btn--sm" onClick={() => buy(t)} disabled={short > 0} aria-label={`Buy a ${PACKS[t].label} for ${fmtCoins(price)} coins`}>
                {short > 0 ? `${fmtCoins(short)} short` : 'Buy'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Bought packs go on your shelf and open like any other. Perfect Season packs are earned by going 18–0, never sold. Earn coins by selling cards
        to the market, set bonuses and bounties.
      </p>
    </div>
  );
};

export default Shop;
