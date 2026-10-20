import { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FINISHES, VARIANTS, finishLabel, variantLabel, type Finish, type Variant } from '@/utils/collection';
import { FINISH_MULTIPLIER, VARIANT_MULTIPLIER, cardPrice, fmtCoins, pctChange, priceSeries } from '@/utils/cardMarket';
import { useMarket } from '@/utils/useMarket';
import { isAlternate } from '../art/sprite/uniforms';
import PriceChart from './PriceChart';
import ChangeBadge from './ChangeBadge';
import './market.css';

interface CardValueProps {
  /** "POS:Name" */
  cardKey: string;
  name: string;
  /** Finish to price (the owned finish, or the one being previewed) */
  finish: Finish;
  /** Art variant to price (value × finish × variant) */
  variant: Variant;
  /** The owner's best finish in this variant, marked in the finish table */
  ownedFinish?: Finish;
  /** The card's player: an alternate-uniform roll (per variant × finish) adds ALT_VALUE_BONUS */
  player?: { name: string; team?: string };
}

/**
 * Market block for the card detail: value at this finish with its change since the last update, the price over
 * every data snapshot, OVR and skill history, and every finish's value. Self-contained (loads market.json).
 */
const CardValue = ({ cardKey, name, finish, variant, ownedFinish, player }: CardValueProps) => {
  const history = useMarket();
  const price = (value: number, f: Finish, v: Variant) => cardPrice(value, f, v, !!player && isAlternate(player, v, f));
  const series = useMemo(() => (history ? priceSeries(history, cardKey) : []), [history, cardKey]);
  if (!history) return <p className="mk-card__loading">Loading market…</p>;
  const last = series[series.length - 1];
  if (!last) return null;
  const latest = history[history.length - 1];
  const listedNow = latest.players[cardKey] != null;
  const prevSnap = history[history.length - 2];
  const change = listedNow && prevSnap ? pctChange(last.value, prevSnap.players[cardKey]?.value) : null;
  const allTime = series.length > 1 ? pctChange(last.value, series[0].value) : null;
  const points = series.map((p) => ({
    label: p.label,
    value: price(p.value, finish, variant),
    detail: `OVR ${p.ovr} · Skill ${p.skill ?? '–'} · Legacy ${fmtCoins(p.legacy)}`,
  }));
  const ovr = series.map((p) => ({ label: p.label, value: p.ovr }));
  const skill = series.filter((p) => p.skill != null).map((p) => ({ label: p.label, value: p.skill as number }));

  return (
    <section className="mk-card" aria-label="Market value">
      <div className="mk-card__head">
        <p className="cd__label">
          Market value · {variantLabel(variant)} · {finishLabel(finish)}
        </p>
        <p className="mk-card__price">
          <Coins className="h-5 w-5 text-gold" aria-hidden="true" />
          <span className="font-display text-3xl font-extrabold tabular-nums">{fmtCoins(price(last.value, finish, variant))}</span>
          <span className="text-xs text-muted-foreground">coins</span>
          <ChangeBadge change={change} label="since the last update" />
        </p>
        <p className="text-xs text-muted-foreground">
          {series.length > 1 && allTime != null ? (
            <>
              {series.length} updates · {allTime >= 0 ? 'up' : 'down'} {Math.abs(allTime * 100).toFixed(1)}% since {series[0].label}
            </>
          ) : (
            <>First listed {series[0].label}</>
          )}
        </p>
      </div>

      <PriceChart points={points} title={`${variantLabel(variant)} ${finishLabel(finish)} card price of ${name}`} format={fmtCoins} valueLabel="Coins" />

      <div className="mk-card__minis">
        <div>
          <p className="mk-card__mini-label">
            OVR <span className="tabular-nums text-foreground">{ovr.length > 1 && ovr[0].value !== last.ovr ? `${ovr[0].value} → ${last.ovr}` : last.ovr}</span>
          </p>
          <PriceChart mini points={ovr} title={`OVR history of ${name}`} />
        </div>
        <div>
          <p className="mk-card__mini-label">
            Skill{' '}
            <span className="tabular-nums text-foreground">
              {skill.length > 1 && skill[0].value !== skill[skill.length - 1].value ? `${skill[0].value} → ${skill[skill.length - 1].value}` : (last.skill ?? '–')}
            </span>
          </p>
          {skill.length > 0 && <PriceChart mini points={skill} title={`Skill rating history of ${name}`} />}
        </div>
      </div>

      <table className="mk-finishes">
        <caption className="sr-only">Value by finish, {variantLabel(variant)} variant</caption>
        <thead>
          <tr>
            {FINISHES.map((f) => (
              <th key={f.key} scope="col" className={cn(f.key === finish && 'is-on')}>
                {f.label}
                <span className="mk-finishes__mult"> ×{FINISH_MULTIPLIER[f.key]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {FINISHES.map((f) => (
              <td key={f.key} className={cn(f.key === finish && 'is-on')}>
                {fmtCoins(price(last.value, f.key, variant))}
                {f.key === ownedFinish && <span className="mk-finishes__own">yours</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table className="mk-finishes mk-variants">
        <caption className="sr-only">Value by art variant, {finishLabel(finish)} finish</caption>
        <thead>
          <tr>
            {VARIANTS.map((v) => (
              <th key={v.key} scope="col" className={cn(v.key === variant && 'is-on')}>
                {v.short}
                <span className="mk-finishes__mult"> ×{VARIANT_MULTIPLIER[v.key]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {VARIANTS.map((v) => (
              <td key={v.key} className={cn(v.key === variant && 'is-on')}>
                {fmtCoins(price(last.value, finish, v.key))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
};

export default CardValue;
