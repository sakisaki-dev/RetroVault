import type { CSSProperties, ReactNode } from 'react';
import { Award, Crown, Newspaper, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { fmtCoins, type MarketNews } from '@/utils/cardMarket';
import type { CardInfo } from '../useCardPool';
import PriceChart from './PriceChart';
import ChangeBadge from './ChangeBadge';
import { dirOf, type MarketRow } from './marketRows';

const teamVars = (info: CardInfo) => {
  const t = findNFLTeam(info.player.team);
  return (t ? { '--mk-team': `hsl(${t.primaryColor})`, '--mk-team2': `hsl(${t.secondaryColor})` } : {}) as CSSProperties;
};

// ---------- Index header ----------

export const IndexHeader = ({
  index,
  latest,
  sinceLabel,
  change,
  cards,
}: {
  index: { label: string; value: number }[];
  latest: string;
  sinceLabel: string;
  change: number | null;
  cards: number;
}) => {
  const now = index[index.length - 1]?.value ?? 1000;
  return (
    <div className="mk-head">
      <div className="mk-head__left">
        <p className="mk-open">
          <span className="mk-open__dot" aria-hidden="true" />
          Market open · updated {latest}
        </p>
        <p className="mk-head__sym">
          RVX <span className="mk-head__desc">Retro Vault index · {cards} cards</span>
        </p>
        <p className="mk-head__num">
          <span className="font-display text-5xl font-extrabold tabular-nums leading-none">{now.toFixed(1)}</span>
          <ChangeBadge change={change} label={sinceLabel} className="mk-badge--lg" />
          <span className="text-xs text-muted-foreground">{sinceLabel}</span>
        </p>
      </div>
      {index.length > 1 && (
        <PriceChart
          className="mk-head__chart"
          height={110}
          points={index.map((p) => ({ label: p.label, value: p.value }))}
          title="RVX index over every data update"
          format={(v) => v.toFixed(1)}
          valueLabel="RVX"
        />
      )}
    </div>
  );
};

// ---------- Ticker tape ----------

const TickerItem = ({ row, onOpen, copy }: { row: MarketRow; onOpen: () => void; copy?: boolean }) => (
  <li>
    <button type="button" className={cn('mk-tick', `mk-flash--${dirOf(row.change)}`)} onClick={onOpen} tabIndex={copy ? -1 : undefined}>
      <span className="mk-tick__pos">{row.info.player.position}</span>
      <span className="mk-tick__name">{row.info.player.name.split(' ').slice(-1)[0].toUpperCase()}</span>
      <span className="tabular-nums">{fmtCoins(row.value)}</span>
      <ChangeBadge change={row.change} />
    </button>
  </li>
);

/**
 * LED ticker tape. The second copy of the list only makes the marquee seamless: it is aria-hidden, unfocusable and
 * unselectable, so screen readers and copy-paste see each mover once. Pauses on hover/focus; static (scrollable)
 * with reduced motion.
 */
export const Ticker = ({ rows, label, onOpen }: { rows: MarketRow[]; label: string; onOpen: (r: MarketRow) => void }) =>
  rows.length ? (
    <section className="mk-ticker" aria-label={label}>
      <ul className="mk-ticker__track">
        {rows.map((r) => (
          <TickerItem key={r.key} row={r} onOpen={() => onOpen(r)} />
        ))}
      </ul>
      <ul className="mk-ticker__track mk-ticker__track--dup" aria-hidden="true">
        {rows.map((r) => (
          <TickerItem key={r.key} row={r} copy onOpen={() => onOpen(r)} />
        ))}
      </ul>
    </section>
  ) : null;

// ---------- News ----------

const NEWS_ICON = { hof: Award, legendary: Crown, ovr: TrendingUp, career: Newspaper, move: TrendingUp } as const;

export const NewsChips = ({ news, onOpen }: { news: MarketNews[]; onOpen: (n: MarketNews) => void }) =>
  news.length ? (
    <section aria-label="Market news">
      <ul className="mk-news">
        {news.map((n) => {
          const Icon = n.kind === 'move' && n.change < 0 ? TrendingDown : NEWS_ICON[n.kind];
          return (
            <li key={`${n.at}-${n.key}`}>
              <button type="button" className={cn('mk-news__chip', `mk-news__chip--${n.kind}`)} onClick={() => onOpen(n)}>
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="mk-news__text">{n.text}</span>
                <ChangeBadge change={n.change} />
                <span className="mk-news__when">{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  ) : null;

// ---------- Rich mover rows and boards ----------

export const MoverRow = ({ row, rank, maxAbs, onOpen }: { row: MarketRow; rank: number; maxAbs?: number; onOpen: () => void }) => {
  const dir = dirOf(row.change);
  return (
    <li>
      <button type="button" className={cn('mk-tile', `mk-tile--${dir}`)} style={teamVars(row.info)} onClick={onOpen}>
        <span className="mk-tile__rank" aria-hidden="true">
          {rank}
        </span>
        <span className="mk-tile__jersey" aria-hidden="true">
          <span className="mk-tile__num">{row.info.number}</span>
          <span className="mk-tile__pos">{row.info.player.position}</span>
        </span>
        <span className="mk-tile__who">
          <span className="mk-tile__name">{row.info.player.name}</span>
          <span className="mk-tile__meta">
            {row.info.franchise} · OVR {row.info.ovr ?? '–'}
          </span>
          {maxAbs != null && maxAbs > 0 && (
            <span className="mk-tile__bar" aria-hidden="true">
              <i style={{ width: `${Math.max(4, (Math.abs(row.change) / maxAbs) * 100)}%` }} />
            </span>
          )}
        </span>
        {row.spark.length > 1 && (
          <span className="mk-tile__spark">
            <PriceChart mini decorative height={28} points={row.spark.map((v, i) => ({ label: String(i), value: v }))} title="" />
          </span>
        )}
        <span className="mk-tile__val">
          <span className="tabular-nums">{fmtCoins(row.value)}</span>
          <ChangeBadge change={row.change} />
        </span>
      </button>
    </li>
  );
};

export const Board = ({
  title,
  icon,
  rows,
  bars,
  empty,
  onOpen,
  className,
}: {
  title: string;
  icon: ReactNode;
  rows: MarketRow[];
  bars?: boolean;
  empty: string;
  onOpen: (r: MarketRow, list: MarketRow[]) => void;
  className?: string;
}) => {
  const maxAbs = bars ? Math.max(0, ...rows.map((r) => Math.abs(r.change))) : undefined;
  return (
    <div className={cn('mk-board', className)}>
      <h3 className="mk-list__title">
        {icon}
        {title}
      </h3>
      {rows.length ? (
        <ol className="mk-board__list">
          {rows.map((r, i) => (
            <MoverRow key={r.key} row={r} rank={i + 1} maxAbs={maxAbs} onOpen={() => onOpen(r, rows)} />
          ))}
        </ol>
      ) : (
        <p className="mk-list__empty">{empty}</p>
      )}
    </div>
  );
};
