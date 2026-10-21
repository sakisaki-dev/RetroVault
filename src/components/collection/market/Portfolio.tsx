import { useMemo } from 'react';
import { Briefcase, PackageOpen } from 'lucide-react';
import { TIERS, VARIANTS, finishLabel, ownedVariants, tierLabel, variantShort, type Finish, type OwnedCard, type Tier, type Variant } from '@/utils/collection';
import { cardPrice, fmtCoins, pctChange, portfolioSeries, valueAt, type Holding as Owned, type MarketHistory } from '@/utils/cardMarket';
import type { CardInfo } from '../useCardPool';
import { uniformKind } from '../art/sprite/uniforms';
import PriceChart from './PriceChart';
import ChangeBadge from './ChangeBadge';

const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'LB', 'DB', 'DL'];
/** Allocation bar segments: one hue family per bar, stepped light → dark, every segment labelled in the legend. */
/** Tier colours match the card frames (collection.css .fut--<tier>) */
const TIER_FILL: Record<Tier, string> = { common: 'hsl(22 45% 48%)', rare: 'hsl(208 45% 55%)', epic: 'hsl(268 60% 62%)', legendary: 'hsl(22 90% 55%)' };
const POS_FILL = POS_ORDER.map((_, i) => `hsl(199 ${60 + i * 3}% ${78 - i * 7}%)`);

/** Variant allocation colours: one warm-to-violet ramp, rarest darkest. */
const VARIANT_FILL: Record<Variant, string> = { number: 'hsl(43 70% 72%)', jersey: 'hsl(30 70% 60%)', topps: 'hsl(12 60% 52%)', locker: 'hsl(330 45% 45%)', sprite: 'hsl(280 55% 40%)' };

interface Holding {
  info: CardInfo;
  finish: Finish;
  variant: Variant;
  now: number;
  paid: number | null;
  gain: number | null;
}

interface PortfolioProps {
  history: MarketHistory;
  owned: Record<string, OwnedCard>;
  byKey: Map<string, CardInfo>;
  period: 'last' | 'all';
  sinceLabel: string;
  onOpen: (info: CardInfo, list: CardInfo[]) => void;
}

const AllocBar = ({ title, parts }: { title: string; parts: { label: string; value: number; color: string }[] }) => {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <p className="mk-card__mini-label">{title}</p>
      <div className="mk-alloc" role="img" aria-label={`${title}: ${shown.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}`}>
        {shown.map((p) => (
          <i key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mk-alloc__legend" aria-hidden="true">
        {shown.map((p) => (
          <li key={p.label}>
            <i style={{ background: p.color }} />
            {p.label} <span className="tabular-nums">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const HoldingLine = ({ h, label, onOpen }: { h: Holding; label: string; onOpen: () => void }) => (
  <button type="button" className="mk-hold" onClick={onOpen}>
    <span className="mk-hold__label">{label}</span>
    <span className="mk-hold__name">{h.info.player.name}</span>
    <span className="mk-hold__meta">
      {variantShort(h.variant)} · {finishLabel(h.finish)} · {fmtCoins(h.now)}
    </span>
    <ChangeBadge change={h.gain} label="since pulled" />
  </button>
);

/**
 * The owner's cards as a portfolio: value at each card's best finish over every data update, unrealized gain since
 * each card was pulled (its value in the snapshot current at the first pull), best and worst holdings, and
 * allocation by tier and position. Empty: an invitation to open packs.
 */
const Portfolio = ({ history, owned, byKey, period, sinceLabel, onOpen }: PortfolioProps) => {
  const latest = history[history.length - 1];
  // Every (player, variant) owned is one holding, at that variant's best finish
  const items = useMemo<Owned[]>(
    () =>
      Object.entries(owned).flatMap(([key, c]) =>
        ownedVariants(c).map((variant) => {
          const finish = c.variants[variant]!.best;
          const player = byKey.get(key)?.player;
          return { key, variant, finish, alt: player ? uniformKind(player, variant, finish) : false };
        }),
      ),
    [owned, byKey],
  );
  const series = useMemo(() => portfolioSeries(history, items), [history, items]);
  const holdings = useMemo<Holding[]>(
    () =>
      items.flatMap(({ key, variant, finish, alt }) => {
        const info = byKey.get(key);
        const p = latest?.players[key];
        if (!info || !p) return [];
        const now = cardPrice(p.value, finish, variant, alt);
        const base = valueAt(history, key, owned[key].variants[variant]!.first || Date.now());
        const paid = base != null ? cardPrice(base, finish, variant, alt) : null;
        return [{ info, finish, variant, now, paid, gain: pctChange(now, paid) }];
      }),
    [items, owned, byKey, latest, history],
  );

  if (!holdings.length) {
    return (
      <div className="mk-port mk-port--empty">
        <PackageOpen className="h-8 w-8 text-gold" aria-hidden="true" />
        <p className="font-display text-2xl font-extrabold uppercase italic leading-none">Start your portfolio</p>
        <p className="text-sm text-muted-foreground">Every card you pull is tracked here: its value, and what it has gained since you pulled it.</p>
        <button
          type="button"
          className="mk-cta"
          onClick={() => document.querySelector('.col-shelf, #col-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        >
          Open a pack
        </button>
      </div>
    );
  }

  const now = series[series.length - 1]?.value ?? 0;
  const before = period === 'last' ? series[series.length - 2]?.value : series.find((p) => p.value > 0)?.value;
  const paid = holdings.reduce((a, h) => a + (h.paid ?? h.now), 0);
  const gain = pctChange(now, paid);
  const ranked = [...holdings].filter((h) => h.gain != null).sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0));
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
  const top = [...holdings].sort((a, b) => b.now - a.now)[0];
  const list = [...new Map(holdings.map((h) => [h.info.key, h.info])).values()];

  const byTier = TIERS.map((t) => ({ label: tierLabel(t.key), value: holdings.filter((h) => h.info.tier === t.key).reduce((a, h) => a + h.now, 0), color: TIER_FILL[t.key] }));
  const byVariant = VARIANTS.map((v) => ({ label: v.short, value: holdings.filter((h) => h.variant === v.key).reduce((a, h) => a + h.now, 0), color: VARIANT_FILL[v.key] }));
  const byPos = POS_ORDER.map((pos, i) => ({ label: pos, value: holdings.filter((h) => h.info.player.position === pos).reduce((a, h) => a + h.now, 0), color: POS_FILL[i] }));

  return (
    <div className="mk-port">
      <h3 className="mk-list__title">
        <Briefcase className="h-4 w-4 text-gold" aria-hidden="true" />
        Your portfolio
      </h3>
      <p className="mk-card__price">
        <span className="font-display text-4xl font-extrabold tabular-nums leading-none">{fmtCoins(now)}</span>
        <span className="text-xs text-muted-foreground">coins</span>
        <ChangeBadge change={pctChange(now, before)} label={sinceLabel} />
      </p>
      <p className="text-xs text-muted-foreground">
        {holdings.length} card{holdings.length === 1 ? '' : 's'} (player × variant) at their best finish ·{' '}
        <span className="text-foreground">
          {gain != null && gain >= 0 ? '+' : '−'}
          {fmtCoins(Math.abs(now - paid))}
        </span>{' '}
        unrealized since pulled <ChangeBadge change={gain} label="since pulled" />
      </p>
      {series.length > 1 && <PriceChart points={series.map((p) => ({ label: p.label, value: p.value }))} title="Your portfolio value" format={fmtCoins} valueLabel="Coins" />}
      <div className="mk-hold__grid">
        {top && <HoldingLine h={top} label="Top card" onOpen={() => onOpen(top.info, list)} />}
        {best && <HoldingLine h={best} label="Best since pulled" onOpen={() => onOpen(best.info, list)} />}
        {worst && worst !== best && <HoldingLine h={worst} label="Worst since pulled" onOpen={() => onOpen(worst.info, list)} />}
      </div>
      <AllocBar title="Allocation by tier" parts={byTier} />
      <AllocBar title="Allocation by variant" parts={byVariant} />
      <AllocBar title="Allocation by position" parts={byPos} />
    </div>
  );
};

export default Portfolio;
