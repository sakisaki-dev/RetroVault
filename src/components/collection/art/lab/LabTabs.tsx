import { memo, startTransition, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FINISHES, TIERS, VARIANTS, packOdds, tierLabel, type Finish, type Tier, type Variant } from '@/utils/collection';
import { NFL_TEAMS } from '@/utils/nflTeams';
import type { GamePlayer } from '@/config/ovr';
import CollectibleCard from '../../CollectibleCard';
import type { CardInfo } from '../../useCardPool';
import PixelSpriteArt, { PixelHead, PixelHelmet, type HeadView } from '../PixelSprite';
import { paletteFor } from '../shared';
import { SKIN_TONES, lookFor, useSpriteTable } from '../sprite/faces';
import { allAlternates, allEraKits, homeUniform, uniformFor, uniformLabel, type Uniform } from '../sprite/uniforms';
import { CELEBRATIONS, POSITION_POSES, SIGNATURES, poseKeyFor, poseLabel } from '../sprite/poses';
import { Cell } from './LabParts';
import { onGridKey, type PreviewItem } from './labStore';

const CARD_RATIO = '100 / 142';
const SPRITE_RATIO = '58 / 64';
const STANDARD = packOdds('standard');
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

type SpriteTable = ReturnType<typeof useSpriteTable>;

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

const spriteArt = (player: GamePlayer, number: number | null | undefined, pose?: string, uniform?: Uniform) => (
  <PixelSpriteArt player={player} number={number} pal={paletteFor(player, uniform)} pose={pose} uniform={uniform} />
);

/** Pose name and uniform for a card's facts. */
const spriteFacts = (info: CardInfo, table: SpriteTable, variant: Variant, finish: Finish): [string, string][] => {
  const out: [string, string][] = [];
  if (variant === 'sprite') out.push(['Pose', poseLabel(poseKeyFor(info.player.name, info.player.position, lookFor(info.player, table).pose))]);
  out.push(['Uniform', uniformFor(info.player, variant, finish).label]);
  return out;
};

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

// ---------- Combinations: 5 variants × 4 finishes ----------

export const CombosTab = memo(({ pick, total }: TabProps) => {
  const table = useSpriteTable();
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
            facts: [['Variant', v.label], ['Finish', f.label], ['Tier', tierLabel(tier)], ...spriteFacts(pick, table, v.key, f.key)],
            base: 260,
            maxZoom: 3,
            render: () => card(pick, tier, f.key, v.key, total, true),
          }),
        ),
      })),
    [pick, tier, table, total],
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

// ---------- Poses ----------

const POSITIONS = Object.keys(POSITION_POSES);
type PoseFilter = string;

interface PoseRow {
  key: string;
  title: string;
  items: { key: string; label: string; info: CardInfo }[];
}

export const PosesTab = memo(({ pick, league, total }: TabProps) => {
  const table = useSpriteTable();
  const [filter, setFilter] = useState<PoseFilter>(POSITION_POSES[pick.player.position] ? pick.player.position : 'all');
  const rows = useMemo<PoseRow[]>(() => {
    const best = (pos: string) => (pick.player.position === pos ? pick : league.filter((c) => c.player.position === pos).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0))[0]);
    const out: PoseRow[] = POSITIONS.flatMap((pos) => {
      const c = best(pos);
      return c ? [{ key: pos, title: `${pos} poses · on ${c.player.name}`, items: POSITION_POSES[pos].map((p) => ({ ...p, info: c })) }] : [];
    });
    out.push({ key: 'cel', title: `Celebrations (any position) · on ${pick.player.name}`, items: CELEBRATIONS.map((p) => ({ ...p, info: pick })) });
    // Signatures: on the player whose locked look uses them
    const sig = SIGNATURES.flatMap((p) => {
      const name = table ? Object.keys(table).find((n) => table[n]?.pose === p.key) : undefined;
      const c = (name && league.find((x) => x.player.name === name)) || pick;
      return [{ ...p, label: name ? `${p.label} (${c.player.name})` : p.label, info: c }];
    });
    out.push({ key: 'sig', title: 'Signatures (owner-requested, locked in sprites.json)', items: sig });
    return out;
  }, [pick, league, table]);
  const shown = filter === 'all' ? rows : rows.filter((r) => r.key === filter);
  return (
    <section aria-label="Poses">
      <Chips
        label="Show"
        value={filter}
        options={[{ key: 'all', label: 'All' }, ...POSITIONS.map((p) => ({ key: p, label: p })), { key: 'cel', label: 'Celebrations' }, { key: 'sig', label: 'Signatures' }]}
        onChange={setFilter}
      />
      {shown.map((r) => (
        <div key={r.key} className="lab-block">
          <h4 className="lab-block__title">{r.title}</h4>
          <ul className="lab-tiles lab-tiles--cards" data-grid onKeyDown={onGridKey} aria-label={r.title}>
            {r.items.map((p, i) => {
              const item: PreviewItem = {
                id: `pose|${r.key}|${p.key}|${p.info.key}`,
                title: `${p.label}`,
                facts: [['Pose', `${p.label} (${p.key})`], ['Player', p.info.player.name], ['Variant', 'Retro Bowl sprite'], ['Tier', tierLabel(p.info.tier)], ['Uniform', 'Home']],
                base: 260,
                maxZoom: 3,
                render: () => card(p.info, p.info.tier, 'base', 'sprite', total, true, spriteArt(p.info.player, p.info.number, p.key, homeUniform(p.info.player.team))),
              };
              return (
                <li key={p.key}>
                  <Cell
                    item={item}
                    first={i === 0}
                    ratio={CARD_RATIO}
                    caption={
                      <>
                        <b>{p.label}</b>
                        <code>{p.key}</code>
                      </>
                    }
                  >
                    {card(p.info, p.info.tier, 'base', 'sprite', total, false, spriteArt(p.info.player, p.info.number, p.key, homeUniform(p.info.player.team)))}
                  </Cell>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
});
PosesTab.displayName = 'PosesTab';

// ---------- Helmets ----------

const VIEWS: { key: HeadView; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'tq', label: 'Three-quarter' },
  { key: 'side', label: 'Side' },
];
const TEAMS = [...NFL_TEAMS].sort((a, b) => a.name.localeCompare(b.name));

/** A stand-in player on another team (same card data, so palettes and helmets follow the team). */
const onTeam = (info: CardInfo, team: string, name = `${team} model`): GamePlayer => ({ ...info.player, team, name, spriteSkin: undefined });

const Heads = ({ player, uniform, size }: { player: GamePlayer; uniform?: Uniform; size: 'tile' | 'big' }) => {
  const look = lookFor(player, null);
  const pal = paletteFor(player, uniform);
  return (
    <span className={cn('lab-heads', size === 'big' && 'lab-heads--big')}>
      {VIEWS.map((v) => (
        <span key={v.key} className="lab-heads__view">
          <PixelHead player={player} look={look} pal={pal} view={v.key} uniform={uniform} label={`${player.team} helmet, ${v.label.toLowerCase()} view`} className="lab-head" />
          <small>{v.label}</small>
        </span>
      ))}
    </span>
  );
};

export const HelmetsTab = memo(({ pick }: TabProps) => {
  const items = useMemo(
    () =>
      TEAMS.map((t) => {
        const player = onTeam(pick, t.name);
        const item: PreviewItem = {
          id: `helmet|${t.id}`,
          title: `${t.fullName} helmet`,
          facts: [['Team', t.fullName], ['Views', 'Front · three-quarter · side'], ['Uniform', 'Home']],
          base: 300,
          maxZoom: 4,
          render: () => (
            <span className="lab-pv-helmet">
              <Heads player={player} size="big" />
              <PixelHelmet team={t.name} className="lab-mini" />
            </span>
          ),
        };
        return { t, player, item };
      }),
    [pick],
  );
  return (
    <section aria-label="Helmets">
      <p className="lab-note">All 32 clubs: shell, crown stripe, facemask and decal, seen from the front, three-quarter and side.</p>
      <ul className="lab-tiles lab-tiles--helmets" data-grid onKeyDown={onGridKey} aria-label="Team helmets">
        {items.map(({ t, player, item }, i) => (
          <li key={t.id}>
            <Cell item={item} first={i === 0} ratio="3 / 1.15" caption={<b>{t.name}</b>}>
              <Heads player={player} size="tile" />
            </Cell>
          </li>
        ))}
      </ul>
    </section>
  );
});
HelmetsTab.displayName = 'HelmetsTab';

// ---------- Uniforms ----------

export const UniformsTab = memo(({ pick }: TabProps) => {
  const [only, setOnly] = useState<'all' | 'alts' | 'era'>('all');
  const pose = POSITION_POSES[pick.player.position]?.[0]?.key ?? POSITION_POSES.WR?.[0]?.key;
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
            facts: [['Team', t.fullName], ['Uniform', uniformLabel(u)], ['Pose', pose ? poseLabel(pose) : '–'], ['Number', String(pick.number)]],
            base: 200,
            maxZoom: 5,
            render: () => <span className="lab-sprite">{spriteArt(player, pick.number, pose, u)}</span>,
          } satisfies PreviewItem,
        })),
      };
    });
  }, [pick, pose]);
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
      <ul className="lab-tiles lab-tiles--uniforms" data-grid onKeyDown={onGridKey} aria-label="Uniforms by team">
        {shown.flatMap((g, gi) =>
          g.items.map(({ u, player, item }, i) => (
            <li key={item.id} className={cn(i > 0 && 'lab-alt')}>
              <Cell
                item={item}
                first={gi === 0 && i === 0}
                ratio={SPRITE_RATIO}
                caption={
                  <>
                    <b>{g.t.name}</b>
                    <span>{i === 0 ? 'Home' : uniformLabel(u)}</span>
                  </>
                }
              >
                <span className="lab-sprite">{spriteArt(player, pick.number, pose, u)}</span>
              </Cell>
            </li>
          )),
        )}
      </ul>
    </section>
  );
});
UniformsTab.displayName = 'UniformsTab';

// ---------- Faces ----------

/** Owner's key players first in the looks gallery. */
const KEY_LOOKS = ['Sherman Brandson', 'Rondale Ikarras', 'Wayne Wilson', 'Michael Wilson', 'Ty Lock', 'Jaylen Conklin', 'Kane Van Oxley', 'Dylan Hyatt', 'Jason Macleone'];
const FACE_POSE = CELEBRATIONS.find((p) => p.key === 'sig-crossed')?.key;

export const FacesTab = memo(({ pick, league, total }: TabProps) => {
  const table = useSpriteTable();
  const looks = useMemo(() => {
    if (!table) return [];
    const rank = (n: string) => (KEY_LOOKS.includes(n) ? KEY_LOOKS.indexOf(n) : 99);
    return Object.keys(table)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .flatMap((n) => {
        const info = league.find((c) => c.player.name === n);
        if (!info) return [];
        const look = lookFor(info.player, table);
        const item: PreviewItem = {
          id: `look|${info.key}`,
          title: `${n} · locked look`,
          facts: [
            ['Skin', look.skin],
            ['Hair', `${look.hair.style}, ${look.hair.color}`],
            ['Facial hair', look.facial],
            ['Build', `${look.build}${look.height === 'tall' ? ', tall' : ''}`],
            ['Pose', poseLabel(poseKeyFor(n, info.player.position, look.pose))],
            ...(look.accessories.length ? [['Gear', look.accessories.join(', ')] as [string, string]] : []),
          ],
          base: 260,
          maxZoom: 3,
          render: () => card(info, info.tier, 'base', 'sprite', total, true),
        };
        return [{ info, item }];
      });
  }, [table, league, total]);
  const tones = useMemo(
    () =>
      SKIN_TONES.map((s) => {
        const player: GamePlayer = { ...pick.player, name: `Generic ${s.label}`, spriteSkin: s.key };
        const item: PreviewItem = {
          id: `tone|${s.key}|${pick.player.team}`,
          title: `Generic character · ${s.label}`,
          facts: [['Skin', s.label], ['Look', 'Standard (short cut, no facial hair, normal build)'], ['Pose', FACE_POSE ? poseLabel(FACE_POSE) : '–'], ['Uniform', 'Home']],
          base: 200,
          maxZoom: 5,
          render: () => <span className="lab-sprite">{spriteArt(player, pick.number, FACE_POSE)}</span>,
        };
        return { s, player, item };
      }),
    [pick],
  );
  return (
    <section aria-label="Faces">
      <div className="lab-block">
        <h4 className="lab-block__title">Locked looks · from the game's portraits (data/y80/sprites.json)</h4>
        {!table ? (
          <p className="lab-note">Loading looks…</p>
        ) : (
          <ul className="lab-tiles lab-tiles--cards" data-grid onKeyDown={onGridKey} aria-label="Locked sprite looks">
            {looks.map(({ info, item }, i) => (
              <li key={info.key}>
                <Cell item={item} first={i === 0} ratio={CARD_RATIO} caption={<b>{info.player.name}</b>}>
                  {card(info, info.tier, 'base', 'sprite', total)}
                </Cell>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="lab-block">
        <h4 className="lab-block__title">Generic character · skin tones (everyone without a locked look)</h4>
        <ul className="lab-tiles lab-tiles--uniforms" data-grid onKeyDown={onGridKey} aria-label="Generic skin tones">
          {tones.map(({ s, player, item }, i) => (
            <li key={s.key}>
              <Cell
                item={item}
                first={i === 0}
                ratio={SPRITE_RATIO}
                caption={
                  <>
                    <i className="lab-swatch" style={{ background: s.color }} aria-hidden="true" />
                    <b>{s.label}</b>
                  </>
                }
              >
                <span className="lab-sprite">{spriteArt(player, pick.number, FACE_POSE)}</span>
              </Cell>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
FacesTab.displayName = 'FacesTab';
