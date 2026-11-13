import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Award, Layers, Repeat2, ScrollText, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIERS, type AutographFreezer, type CollectionState, type PackType, type Tier, type TierPool } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { checkMilestones, collectionSets, editionBounties, bountiesDone, setProgress } from '@/utils/economy';
import { useMarket } from '@/utils/useMarket';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import type { LeagueContent } from '@/utils/leagueContent';
import type { CardInfo } from '../useCardPool';
import { allCopies, portfolioValue } from './copies';
import Shop from './Shop';
import Sets from './Sets';
import TradeUp from './TradeUp';
import Bounties from './Bounties';
import Milestones from './Milestones';
import './economy.css';

type Tab = 'shop' | 'sets' | 'trade' | 'bounties' | 'milestones';

interface ExchangeProps {
  cards: CardInfo[];
  byKey: Map<string, CardInfo>;
  tierPool: TierPool;
  state: CollectionState;
  content: LeagueContent | null;
  freeze: AutographFreezer;
  onOpenPack: (t: PackType) => void;
  onOpenCard: (info: CardInfo) => void;
}

/** The coin balance chip (header of the Exchange; it pops when the balance changes). */
export const CoinBalance = ({ coins }: { coins: number }) => (
  <span className="ec-balance" aria-label={`${fmtCoins(coins)} coins`}>
    <span className="ec-coin" aria-hidden="true" />
    <span key={coins} className="ec-balance__n is-bump">
      {fmtCoins(coins)}
    </span>
    <span className="text-xs text-muted-foreground">coins</span>
  </span>
);

/**
 * The Exchange: where coins are spent and earned (src/utils/economy.ts). Tabs: the pack shop, set bonuses, trade-up,
 * the edition's bounty board and portfolio milestones, plus the latest coin movements. Selling single cards lives in
 * the card detail and "Sell duplicates" in the binder header.
 */
const Exchange = ({ cards, byKey, tierPool, state, content, freeze, onOpenPack, onOpenCard }: ExchangeProps) => {
  const [tab, setTab] = useState<Tab>('shop');
  const history = useMarket();
  const extras = usePlayerExtras();
  const latest = history?.length ? history[history.length - 1] : undefined;
  const prev = history && history.length > 1 ? history[history.length - 2] : undefined;

  const values = useMemo(() => Object.fromEntries(Object.entries(latest?.players ?? {}).map(([k, p]) => [k, p.value])) as Record<string, number>, [latest]);
  const meanValue = useMemo(() => {
    if (!latest) return null;
    const sums = Object.fromEntries(TIERS.map((t) => [t.key, [0, 0]])) as Record<Tier, [number, number]>;
    cards.forEach((c) => {
      const v = latest.players[c.key]?.value;
      if (v == null) return;
      sums[c.tier][0] += v;
      sums[c.tier][1] += 1;
    });
    return Object.fromEntries(TIERS.map((t) => [t.key, sums[t.key][1] ? sums[t.key][0] / sums[t.key][1] : 0])) as Record<Tier, number>;
  }, [cards, latest]);
  const change = useCallback(
    (key: string) => {
      const a = latest?.players[key]?.value;
      const b = prev?.players[key]?.value;
      return a != null && b ? (a - b) / b : null;
    },
    [latest, prev],
  );

  const copies = useMemo(() => allCopies(byKey, state.cards, state.autos, latest), [byKey, state.cards, state.autos, latest]);
  const value = useMemo(() => (latest ? portfolioValue(state.cards, state.autos, byKey, latest) : null), [state.cards, state.autos, byKey, latest]);

  // Milestones: record every line the portfolio has crossed (never removes one)
  useEffect(() => {
    if (value == null || !cards.length) return;
    checkMilestones(value).forEach((m) => toast.success(`Milestone: ${m.cosmetic.label} unlocked`, { description: 'Switch it on under Exchange · Milestones.' }));
  }, [value, cards.length]);

  const sets = useMemo(
    () =>
      collectionSets({
        // Stints are keyed by normalized name (playerExtras.ts)
        cards: cards.map((c) => ({ key: c.key, name: normalizeName(c.player.name), currentTeam: c.currentTeam, active: c.player.status === 'Active' })),
        superBowls: content?.superBowls ?? [],
        stints: extras.stints,
        hofClasses: content?.hofClasses ?? [],
      }),
    [cards, content, extras.stints],
  );
  const setsReady = useMemo(() => sets.filter((s) => !state.setsClaimed?.includes(s.id) && setProgress(s, state.cards).done).length, [sets, state.setsClaimed, state.cards]);

  const seed = content?.edition?.seed ?? 0;
  const bounties = useMemo(() => {
    if (!content?.edition) return [];
    const clubs = [...new Set(cards.map((c) => c.franchise).filter((f) => f !== 'Free agents'))].sort();
    const risers = Object.keys(latest?.players ?? {}).filter((k) => (change(k) ?? 0) >= 0.05).length;
    return editionBounties(seed, { clubs, risers });
  }, [content?.edition, seed, cards, latest, change]);
  const bountiesOpen = bounties.length - bountiesDone(state, seed).filter((id) => bounties.some((b) => b.id === id)).length;

  const TABS: { key: Tab; label: string; icon: typeof Store; badge?: number }[] = [
    { key: 'shop', label: 'Shop', icon: Store },
    { key: 'sets', label: 'Sets', icon: Layers, badge: setsReady },
    { key: 'trade', label: 'Trade-up', icon: Repeat2 },
    { key: 'bounties', label: 'Bounties', icon: ScrollText, badge: bountiesOpen },
    { key: 'milestones', label: 'Milestones', icon: Award },
  ];

  return (
    <section id="col-exchange" aria-labelledby="col-exchange-title" className="ec scroll-mt-20">
      <div className="ec__head">
        <div>
          <p className="ec-kicker">Coins in, cards out</p>
          <h2 id="col-exchange-title" className="section-title">
            Exchange
          </h2>
        </div>
        <CoinBalance coins={state.coins} />
      </div>

      <div className="ec-tabs" role="tablist" aria-label="Exchange">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`ec-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`ec-panel-${t.key}`}
            className="ec-tab"
            onClick={() => setTab(t.key)}
          >
            <t.icon className="h-4 w-4" aria-hidden="true" />
            {t.label}
            {!!t.badge && <span className="ec-tab__dot">{t.badge}</span>}
          </button>
        ))}
      </div>

      <div className="ec-panel" role="tabpanel" id={`ec-panel-${tab}`} aria-labelledby={`ec-tab-${tab}`}>
        {tab === 'shop' && <Shop coins={state.coins} meanValue={meanValue} onOpenPack={onOpenPack} />}
        {tab === 'sets' && <Sets sets={sets} state={state} byKey={byKey} values={values} onOpenCard={onOpenCard} />}
        {tab === 'trade' && <TradeUp copies={copies} tierPool={tierPool} byKey={byKey} total={cards.length} freeze={freeze} meanValue={meanValue} onOpenCard={onOpenCard} />}
        {tab === 'bounties' &&
          (bounties.length ? (
            <Bounties bounties={bounties} seed={seed} editionLabel={content?.edition?.label} state={state} copies={copies} change={change} />
          ) : (
            <p className="text-sm text-muted-foreground">The bounty board loads with the league data.</p>
          ))}
        {tab === 'milestones' && <Milestones state={state} value={value} />}
      </div>

      {!!state.coinLog?.length && (
        <details className="ec-log">
          <summary className="ec-kicker">Recent coins · {state.coinLog.length}</summary>
          <ul className="mt-2">
            {state.coinLog.slice(0, 12).map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className="min-w-0 truncate">{e.text}</span>
                <span className={cn('shrink-0 font-mono tabular-nums', e.amount >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                  {e.amount >= 0 ? '+' : '−'}
                  {fmtCoins(Math.abs(e.amount))}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

export default Exchange;
