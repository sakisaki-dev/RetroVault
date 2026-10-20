import { useMemo, useState } from 'react';
import { Gem, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OwnedCard } from '@/utils/collection';
import { marketIndex, marketMovers, marketNews, pctChange, priceSeries, type MarketHistory } from '@/utils/cardMarket';
import { useMarket } from '@/utils/useMarket';
import type { CardInfo } from '../useCardPool';
import { Board, IndexHeader, NewsChips, Ticker } from './MarketParts';
import type { MarketRow } from './marketRows';
import Heatmap from './Heatmap';
import Portfolio from './Portfolio';
import './market.css';

type Period = 'last' | 'all';

interface MarketViewProps {
  byKey: Map<string, CardInfo>;
  owned: Record<string, OwnedCard>;
  onOpen: (info: CardInfo, list: CardInfo[]) => void;
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
const LIST = 5;
const TICKER = 16;
const HEAT = 70;

/** Every card in the latest snapshot with his value, change over the period and value history. */
const allRows = (history: MarketHistory, period: Period, byKey: Map<string, CardInfo>): MarketRow[] => {
  const latest = history[history.length - 1];
  const moves = new Map(marketMovers(history, period).map((m) => [m.key, m]));
  return Object.entries(latest.players).flatMap(([key, p]) => {
    const info = byKey.get(key);
    if (!info) return [];
    const m = moves.get(key);
    return [{ key, value: p.value, before: m?.before ?? p.value, change: m?.change ?? 0, info, spark: priceSeries(history, key).map((x) => x.value) }];
  });
};

/**
 * Card market on the Collection page, a trading floor: "market open" header with the RVX index, an LED ticker tape
 * of the biggest movers, generated news, gainers / losers leaderboards and the most valuable cards as rich tiles,
 * a value heatmap by position, and the owner's portfolio. Filters: since the last update or all time, position,
 * name search. Prices come from public/data/market.json; any player opens his card.
 */
const MarketView = ({ byKey, owned, onOpen }: MarketViewProps) => {
  const history = useMarket();
  const [period, setPeriod] = useState<Period>('last');
  const [pos, setPos] = useState<string>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => (history?.length ? allRows(history, period, byKey) : []), [history, period, byKey]);
  const index = useMemo(() => (history ? marketIndex(history) : []), [history]);
  const news = useMemo(() => (history ? marketNews(history, 8) : []), [history]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => rows.filter((r) => (pos === 'all' || r.info.player.position === pos) && (!q || r.info.player.name.toLowerCase().includes(q))),
    [rows, pos, q],
  );
  const moving = useMemo(() => filtered.filter((r) => Math.abs(r.change) >= 0.0005), [filtered]);
  const ticker = useMemo(() => [...moving].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, TICKER), [moving]);
  const gainers = useMemo(() => moving.filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, LIST), [moving]);
  const losers = useMemo(() => moving.filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, LIST), [moving]);
  const valuable = useMemo(() => [...filtered].sort((a, b) => b.value - a.value).slice(0, LIST), [filtered]);
  const heat = useMemo(() => [...filtered].sort((a, b) => b.value - a.value).slice(0, HEAT), [filtered]);

  if (!history) return <p className="text-sm text-muted-foreground">Loading market…</p>;
  const latest = history[history.length - 1];
  if (!latest) return null;
  const prev = history[history.length - 2];
  const sinceLabel = period === 'last' ? (prev ? `since ${prev.label}` : 'first update') : `since ${history[0].label}`;
  const idxNow = index[index.length - 1]?.value ?? 1000;
  const idxBefore = period === 'last' ? index[index.length - 2]?.value : index[0]?.value;
  const open = (r: MarketRow, list: MarketRow[]) =>
    onOpen(
      r.info,
      list.map((x) => x.info),
    );
  const filterNote = pos !== 'all' || q ? ` (${filtered.length} match${filtered.length === 1 ? '' : 'es'})` : '';

  return (
    <div className="mk space-y-3">
      <IndexHeader index={index} latest={latest.label} sinceLabel={sinceLabel} change={pctChange(idxNow, idxBefore)} cards={Object.keys(latest.players).length} />

      <Ticker rows={ticker} label={`Ticker: biggest movers ${sinceLabel}`} onOpen={(r) => open(r, ticker)} />

      <NewsChips
        news={news}
        onOpen={(n) => {
          const info = byKey.get(n.key);
          if (info) onOpen(info, [info]);
        }}
      />

      <div className="mk-filters" role="group" aria-label="Market filters">
        <div className="mk-seg" role="group" aria-label="Change since">
          <button type="button" aria-pressed={period === 'last'} onClick={() => setPeriod('last')}>
            Last update
          </button>
          <button type="button" aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>
            All time
          </button>
        </div>
        <div className="mk-pos" role="group" aria-label="Position">
          {['all', ...POSITIONS].map((p) => (
            <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)} className={cn(pos === p && 'is-on')}>
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
        <label className="mk-search">
          <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search players</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players" />
        </label>
        <span className="sr-only" aria-live="polite">
          {filterNote}
        </span>
      </div>

      <div className="mk-grid">
        <Board
          title={`Top gainers${filterNote}`}
          icon={<TrendingUp className="h-4 w-4 text-turf" aria-hidden="true" />}
          rows={gainers}
          bars
          onOpen={open}
          empty={`No gainers ${sinceLabel}.`}
          className="mk-board--up"
        />
        <Board
          title="Top losers"
          icon={<TrendingDown className="h-4 w-4 text-flag" aria-hidden="true" />}
          rows={losers}
          bars
          onOpen={open}
          empty={`No losers ${sinceLabel}.`}
          className="mk-board--down"
        />
        <Board title="Most valuable" icon={<Gem className="h-4 w-4 text-gold" aria-hidden="true" />} rows={valuable} onOpen={open} empty="No cards match." />
      </div>

      <div className="mk-grid mk-grid--wide">
        <div className="mk-board">
          <h3 className="mk-list__title">Heatmap</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Top {Math.min(HEAT, heat.length)} cards by value. Size is value, colour is change {sinceLabel} (▲ green, ▼ red).
          </p>
          {heat.length ? <Heatmap rows={heat} onOpen={(r) => open(r, heat)} /> : <p className="mk-list__empty">No cards match.</p>}
        </div>
        <Portfolio history={history} owned={owned} byKey={byKey} period={period} sinceLabel={sinceLabel} onOpen={onOpen} />
      </div>
    </div>
  );
};

export default MarketView;
