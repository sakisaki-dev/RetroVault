import { Check } from 'lucide-react';
import { findNFLTeam } from '@/utils/nflTeams';
import { fmtCoins } from '@/utils/cardMarket';
import { tierLabel } from '@/utils/collection';
import type { OwnedCopy } from './copies';

interface CopyRowProps {
  copy: OwnedCopy;
  pressed?: boolean;
  onClick: () => void;
  /** Right-hand figure: coins this copy brings (sale, payout) or its value */
  coins: number;
  coinsLabel?: string;
  showTier?: boolean;
}

/** One owned copy as a selectable row: club stripe, name, art · finish · kit · parallel, spare or last-copy badge, coins. */
const CopyRow = ({ copy, pressed, onClick, coins, coinsLabel = 'value', showTier }: CopyRowProps) => {
  const team = findNFLTeam(copy.info.player.team);
  const spare = copy.of > 1;
  return (
    <button
      type="button"
      className="ec-copy"
      aria-pressed={pressed}
      onClick={onClick}
      style={team ? ({ ['--t1' as string]: team.primaryColor } as React.CSSProperties) : undefined}
    >
      <span className="ec-check" aria-hidden="true">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="ec-copy__name">{copy.info.player.name}</span>
        <span className="ec-copy__meta">
          {copy.info.player.position} · {copy.label}
        </span>
        <span className="ec-copy__tags">
          {showTier && <span className={`ec-badge ec-badge--tier-${copy.info.tier}`}>{tierLabel(copy.info.tier)}</span>}
          {spare ? <span className="ec-badge ec-badge--spare">Spare · {copy.of} copies</span> : <span className="ec-badge ec-badge--last">{copy.playerTotal <= 1 ? 'Only card' : 'Last copy'}</span>}
        </span>
      </span>
      <span className="ec-copy__price">
        <span className="block text-foreground">{fmtCoins(coins)}</span>
        <span className="block text-[10px] text-muted-foreground">{coinsLabel}</span>
      </span>
    </button>
  );
};

export default CopyRow;
