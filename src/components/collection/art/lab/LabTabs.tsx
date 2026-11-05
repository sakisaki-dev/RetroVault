import { memo, startTransition, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FINISHES, TIERS, VARIANTS, packOdds, tierLabel, type Finish, type Tier, type Variant } from '@/utils/collection';
import { NFL_TEAMS } from '@/utils/nflTeams';
import type { GamePlayer } from '@/config/ovr';
import CollectibleCard from '../../CollectibleCard';
import type { CardInfo } from '../../useCardPool';
import JerseyArt from '../JerseyArt';
import { paletteFor } from '../shared';
import { allAlternates, allEraKits, homeUniform, uniformFor, uniformLabel, type Uniform } from '../sprite/uniforms';
import { Cell } from './LabParts';
import { onGridKey, type PreviewItem } from './labStore';

const CARD_RATIO = '100 / 142';
const STANDARD = packOdds('standard');
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

interface TabProps {
  pick: CardInfo;
  league: CardInfo[];
  total: number;
}

/** One card, static (no live shimmer); `large` only in the preview pane (pointer tilt). */
const card = (info: CardInfo, tier: Tier, finish: Finish, variant: Variant, total: number, large = false, art?: ReactNode) => (
  <CollectibleCard
    owned
    large={large}
    player={info.player}
    tier={tier}
    finish={finish}
    variant={variant}
    ovr={info.ovr}
    number={info.number}
    stats={info.stats}
    setNo={info.setNo}
    setTotal={total}
    art={art}
  />
);

/** Team jersey art in a given uniform (the Uniforms tab). */
const jerseyArt = (player: GamePlayer, number: number | null | undefined, uniform: Uniform) => (
  <JerseyArt player={player} number={number} pal={paletteFor(player, uniform)} uniform={uniform} />
);

// ---------- Chips (tier toggle, position filter) ----------

interface ChipsProps<T extends string> {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}
const Chips = <T extends string>({ label, value, options, onChange }: ChipsProps<T>) => (
  <div className="lab-chips" role="radiogroup" aria-label={label}>
    <span className="lab-chips__label">{label}</span>
    {options.map((o) => (
      <button
        key={o.key}
        type="button"
        role="radio"
        aria-checked={value === o.key}
        className={cn('lab-chip', value === o.key && 'is-on')}
        onClick={() => startTransition(() => onChange(o.key))}
      >
        {o.label}
      </button>
    ))}
  </div>
);

// ---------- Combinations: 4 variants × 4 finishes ----------

export const CombosTab = memo(({ pick, total }: TabProps) => {
  const [tierSel, setTier] = useState<Tier | 'own'>('own');
  const tier = tierSel === 'own' ? pick.tier : tierSel;
  const rows = useMemo(
    () =>
      VARIANTS.map((v) => ({
        v,
        items: FINISHES.map(
          (f): PreviewItem => ({
            id: `combo|${pick.key}|${tier}|${v.key}|${f.key}`,
            title: `${pick.player.name} · ${v.label}`,
            facts: [['Variant', v.label], ['Finish', f.label], ['Tier', tierLabel(tier)], ['Uniform', uniformFor(pick.player, v.key, f.key).label]],
            base: 260,
            maxZoom: 3,
            render: () => card(pick, tier, f.key, v.key, total, true),
          }),
        ),
      })),
    [pick, tier, total],
  );
  return (
    <section aria-label="Combinations">
      <Chips<Tier | 'own'>
        label="Tier frame"
        value={tierSel}
        options={[{ key: 'own', label: `His tier (${tierLabel(pick.tier)})` }, ...TIERS.map((t) => ({ key: t.key, label: t.label }))]}
        onChange={setTier}
      />
      <div className="lab-mx-scroll">
        <div className="lab-mx" role="grid" aria-label={`${pick.player.name}: art variants by finish, ${tierLabel(tier)} frame`} data-grid onKeyDown={onGridKey}>
          <div role="row" className="lab-mx__row lab-mx__row--head">
            <span role="columnheader" className="lab-mx__corner">
              Variant \ Finish
            </span>
            {FINISHES.map((f) => (
              <span key={f.key} role="columnheader" className="lab-mx__col">
                {f.label}
              </span>
            ))}
          </div>
          {rows.map(({ v, items }, r) => (
            <div key={v.key} role="row" className="lab-mx__row">
              <span role="rowheader" className="lab-mx__rowhead">
                <span className={`lab-tag vbadge--${v.key}`}>{v.short}</span>
                <b>{v.label}</b>
                <small>{pct(STANDARD.variants[v.key])} of Standard pulls</small>
              </span>
              {items.map((it, c) => (
                <Cell key={it.id} item={it} first={r === 0 && c === 0} ratio={CARD_RATIO} role="gridcell">
                  {card(pick, tier, FINISHES[c].key, v.key, total)}
                </Cell>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
CombosTab.displayName = 'CombosTab';

// ---------- Uniforms ----------

const TEAMS = [...NFL_TEAMS].sort((a, b) => a.name.localeCompare(b.name));

/** A stand-in player on another team (same card data, so palettes follow the team). */
const onTeam = (info: CardInfo, team: string, name = `${team} model`): GamePlayer => ({ ...info.player, team, name });

export const UniformsTab = memo(({ pick, total }: TabProps) => {
  const [only, setOnly] = useState<'all' | 'alts' | 'era'>('all');
  const groups = useMemo(() => {
    const alts = allAlternates();
    const eras = allEraKits();
    return TEAMS.map((t) => {
      const player = onTeam(pick, t.name);
      const list = [homeUniform(t.name), ...alts.filter((a) => a.team === t.id).map((a) => a.u), ...eras.filter((a) => a.team === t.id).map((a) => a.u)];
      return {
        t,
        items: list.map((u) => ({
          u,
          player,
          item: {
            id: `uni|${t.id}|${u.id}`,
            title: `${t.name} · ${uniformLabel(u)}`,
            facts: [['Team', t.fullName], ['Uniform', uniformLabel(u)], ['Art', 'Team jersey'], ['Number', String(pick.number)]],
            base: 260,
            maxZoom: 3,
            render: () => card({ ...pick, player }, pick.tier, 'base', 'jersey', total, true, jerseyArt(player, pick.number, u)),
          } satisfies PreviewItem,
        })),
      };
    });
  }, [pick, total]);
  const shown =
    only === 'era'
      ? groups.flatMap((g) => {
          const items = g.items.filter((i) => i.u.era);
          return items.length ? [{ ...g, items }] : [];
        })
      : only === 'alts'
        ? groups.filter((g) => g.items.length > 1)
        : groups;
  return (
    <section aria-label="Uniforms">
      <Chips<'all' | 'alts' | 'era'>
        label="Teams"
        value={only}
        options={[
          { key: 'all', label: 'All 32' },
          { key: 'alts', label: 'With alternates' },
          { key: 'era', label: 'Era kits' },
        ]}
        onChange={setOnly}
      />
      <ul className="lab-tiles lab-tiles--cards" data-grid onKeyDown={onGridKey} aria-label="Uniforms by team">
        {shown.flatMap((g, gi) =>
          g.items.map(({ u, player, item }, i) => (
            <li key={item.id} className={cn(i > 0 && 'lab-alt')}>
              <Cell
                item={item}
                first={gi === 0 && i === 0}
                ratio={CARD_RATIO}
                caption={
                  <>
                    <b>{g.t.name}</b>
                    <span>{i === 0 ? 'Home' : uniformLabel(u)}</span>
                  </>
                }
              >
                {card({ ...pick, player }, pick.tier, 'base', 'jersey', total, false, jerseyArt(player, pick.number, u))}
              </Cell>
            </li>
          )),
        )}
      </ul>
    </section>
  );
});
UniformsTab.displayName = 'UniformsTab';
