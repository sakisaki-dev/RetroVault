import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIERS, finishLabel, tierLabel, variantLabel, type AutographFreezer, type PackCard, type Tier, type TierPool } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { TRADE_UP_COUNT, nextTier, tradeUp } from '@/utils/economy';
import CollectibleCard from '../CollectibleCard';
import { KIT_SOURCE } from '../kits';
import type { CardInfo } from '../useCardPool';
import CopyRow from './CopyRow';
import { consumes, type OwnedCopy } from './copies';

interface TradeUpProps {
  copies: OwnedCopy[];
  tierPool: TierPool;
  byKey: Map<string, CardInfo>;
  total: number;
  freeze: AutographFreezer;
  meanValue: Record<Tier, number> | null;
  onOpenCard: (info: CardInfo) => void;
}

const FROM: Tier[] = TIERS.map((t) => t.key).filter((t) => nextTier(t));
const LIST = 24;

/**
 * Default hand-in: spare copies first (a variant × finish with another copy left), cheapest first, never taking a
 * combo's last copy while spares remain; then, only if needed, the cheapest of the rest.
 */
const autoPick = (cands: OwnedCopy[]): string[] => {
  const order = [...cands].sort((a, b) => a.price - b.price);
  const left = new Map<string, number>();
  order.forEach((c) => left.set(`${c.info.key}|${c.variant}|${c.finish}`, c.of));
  const picked: string[] = [];
  for (const c of order) {
    if (picked.length >= TRADE_UP_COUNT) break;
    const k = `${c.info.key}|${c.variant}|${c.finish}`;
    if ((left.get(k) ?? 0) > 1) {
      picked.push(c.id);
      left.set(k, left.get(k)! - 1);
    }
  }
  for (const c of order) {
    if (picked.length >= TRADE_UP_COUNT) break;
    if (!picked.includes(c.id)) picked.push(c.id);
  }
  return picked;
};

/**
 * Trade-up: TRADE_UP_COUNT (8) copies of one tier in, one random card of the next tier out (rolled like a Premium pack slot: finish,
 * art, kit and parallel). Spares are picked first; any pick that takes a card's last copy, or a player's only card,
 * is spelled out before the trade.
 */
const TradeUp = ({ copies, tierPool, byKey, total, freeze, meanValue, onOpenCard }: TradeUpProps) => {
  const [tier, setTier] = useState<Tier>('common');
  const [sel, setSel] = useState<string[] | null>(null);
  const [limit, setLimit] = useState(LIST);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<PackCard | null>(null);
  const up = nextTier(tier)!;
  const cands = useMemo(
    () => copies.filter((c) => c.info.tier === tier).sort((a, b) => Number(a.of <= 1) - Number(b.of <= 1) || a.price - b.price),
    [copies, tier],
  );
  // The picks follow the binder: a pick that is gone (sold, traded) drops out; untouched, the auto pick applies
  const auto = useMemo(() => autoPick(cands), [cands]);
  const ids = new Set(cands.map((c) => c.id));
  const picked = (sel ?? auto).filter((id) => ids.has(id));
  const chosen = cands.filter((c) => picked.includes(c.id));
  const { lastCombos, leaving } = consumes(chosen);
  const ready = chosen.length === TRADE_UP_COUNT && tierPool[up].length > 0;
  useEffect(() => {
    setSel(null);
    setConfirm(false);
    setLimit(LIST);
  }, [tier]);
  useEffect(() => setConfirm(false), [picked.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    const now = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < TRADE_UP_COUNT ? [...picked, id] : null;
    if (!now) {
      toast(`Pick ${TRADE_UP_COUNT}: tap a selected card to swap it out first.`);
      return;
    }
    setSel(now);
  };

  const trade = () => {
    if (!ready) return;
    if ((lastCombos.length || leaving.length) && !confirm) {
      setConfirm(true);
      return;
    }
    const pc = tradeUp(
      tier,
      chosen.map((c) => c.ref),
      tierPool,
      freeze,
      KIT_SOURCE,
    );
    setConfirm(false);
    setSel(null);
    if (!pc) {
      toast('Trade-up failed: a card is no longer in your binder.');
      return;
    }
    setResult(pc);
  };

  const handIn = chosen.reduce((a, c) => a + c.price, 0);
  const resultInfo = result ? byKey.get(`${result.player.position}:${result.player.name}`) : undefined;

  return (
    <div className="space-y-3">
      <div className="ec-filters" role="group" aria-label="Trade up from">
        {FROM.map((t) => {
          const n = copies.filter((c) => c.info.tier === t).length;
          return (
            <button key={t} type="button" className={cn('cd-chip', tier === t && 'is-on')} style={{ ['--cd-tier' as string]: 'hsl(var(--gold))' }} aria-pressed={tier === t} onClick={() => setTier(t)}>
              <span className={cn('col-dot', `col-gem--${t}`)} aria-hidden="true" />
              {tierLabel(t)} <ArrowRight className="h-3 w-3" aria-hidden="true" /> {tierLabel(nextTier(t)!)}
              <span className="font-mono text-muted-foreground">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="ec-slots" aria-label={`${chosen.length} of ${TRADE_UP_COUNT} picked`}>
          {Array.from({ length: TRADE_UP_COUNT }, (_, i) => (
            <span key={i} className={cn('ec-slot', chosen[i] && 'is-full')} aria-hidden="true">
              {chosen[i] ? chosen[i].info.player.position : i + 1}
            </span>
          ))}
          <ArrowRight className="mx-1 h-5 w-5 text-gold" aria-hidden="true" />
          <span className="ec-slot ec-slot--out" aria-hidden="true">
            ?
          </span>
        </div>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Hand in {TRADE_UP_COUNT} {tierLabel(tier)} cards (about {fmtCoins(handIn)} coins of cards) for one random {tierLabel(up)} player
          {meanValue ? `, worth about ${fmtCoins(meanValue[up])} at Base on average` : ''}. Its finish, art, kit and parallel roll like a Premium pack card.
        </p>
      </div>

      {(lastCombos.length > 0 || leaving.length > 0) && (
        <div className="ec-warn" role="alert">
          {leaving.length > 0 && (
            <p>
              <strong>Removes from your binder:</strong> {leaving.map((c) => c.info.player.name).join(', ')} (their only card).
            </p>
          )}
          {lastCombos.filter((c) => !leaving.includes(c)).length > 0 && (
            <p className={leaving.length ? 'mt-1' : ''}>
              <strong>Uses the last copy of:</strong>{' '}
              {lastCombos
                .filter((c) => !leaving.some((l) => l.info.key === c.info.key))
                .map((c) => `${c.info.player.name} ${variantLabel(c.variant)} ${finishLabel(c.finish)}`)
                .join(', ')}
              .
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={cn('ec-btn', confirm ? 'ec-btn--danger' : 'ec-btn--gold')} onClick={trade} disabled={!ready}>
          {confirm ? 'Yes, trade them in' : `Trade up ${chosen.length}/${TRADE_UP_COUNT}`}
        </button>
        {confirm && (
          <button type="button" className="ec-btn ec-btn--ghost" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        )}
        {sel && (
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => setSel(null)}>
            Reset picks
          </button>
        )}
        {cands.length < TRADE_UP_COUNT && <p className="text-xs text-muted-foreground">You need {TRADE_UP_COUNT - cands.length} more {tierLabel(tier)} cards.</p>}
      </div>

      {result && resultInfo && (
        <div className="ec-result" aria-live="polite">
          <p className="ec-kicker">Trade-up result</p>
          <div className="ec-result__card ec-pop" key={`${result.player.name}-${result.finish}-${result.variant}`}>
            <CollectibleCard
              owned
              player={resultInfo.player}
              tier={result.tier}
              finish={result.finish}
              variant={result.variant}
              kit={result.kit}
              prizm={result.prizm}
              autograph={result.auto}
              ovr={resultInfo.ovr}
              number={resultInfo.number}
              stats={resultInfo.stats}
              setNo={resultInfo.setNo}
              setTotal={total}
              onOpen={() => onOpenCard(resultInfo)}
            />
          </div>
          <p className="text-center text-sm">
            <strong>{result.player.name}</strong> · {variantLabel(result.variant)} {finishLabel(result.finish)}
            {result.isNew ? ' · New card!' : result.newVariant ? ' · New art' : result.duplicate ? ` · Duplicate, +${result.shards} shards` : ''}
          </p>
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => setResult(null)}>
            Done
          </button>
        </div>
      )}

      <div>
        <p className="ec-kicker mb-1.5">
          Your {tierLabel(tier)} cards · {cands.length} · spares first
        </p>
        {cands.length ? (
          <ul className="ec-copies">
            {cands.slice(0, limit).map((c) => (
              <li key={c.id}>
                <CopyRow copy={c} pressed={picked.includes(c.id)} onClick={() => toggle(c.id)} coins={c.price} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No {tierLabel(tier)} cards in your binder yet.</p>
        )}
        {cands.length > limit && (
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm mt-2" onClick={() => setLimit((l) => l + LIST * 2)}>
            Show more ({cands.length - limit})
          </button>
        )}
      </div>
    </div>
  );
};

export default TradeUp;
