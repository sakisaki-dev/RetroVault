import { useMemo, useState, type ComponentType } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { VARIANTS, packOdds, tierLabel, type Finish, type Tier, type Variant } from '@/utils/collection';
import CollectibleCard from '../CollectibleCard';
import type { CardInfo } from '../useCardPool';
import { artSamples, type ArtSample } from './artSamples';
import type { ArtProps } from './shared';
import StadiumArt from './StadiumArt';
import HelmetArt from './HelmetArt';
import ActionArt from './ActionArt';
import JerseyBackArt from './JerseyBackArt';
import { useSpriteTable } from './sprite/faces';
import PixelSpriteArt, { PixelHelmet } from './PixelSprite';
import { NFL_TEAMS } from '@/utils/nflTeams';
import { CELEBRATIONS, POSITION_POSES, SIGNATURES } from './sprite/poses';
import { paletteFor } from './shared';
import './art.css';

interface ArtStyle {
  key: string;
  name: string;
  pitch: string;
  /** Row tag: the variant's short name, or "Lab" for styles not in packs */
  tag: string;
  /** Pack variant this style is (cards then render through CollectibleCard's variant) */
  variant?: Variant;
  Art?: ComponentType<ArtProps>;
}

const STANDARD = packOdds('standard');
const PITCH: Record<Variant, string> = {
  number: 'A giant chrome-extruded number over refractor rays and halftone.',
  jersey: "His team's game jersey: real sleeve stripes or yoke, contrast collar, logo patch, TV numbers, fabric shading.",
  topps: 'A cream photo window, duotone bust in helmet and team-striped pads, a pennant and the team crest.',
  locker: 'His stall: nameplate, team helmet with its stripe and decal on the shelf, game jersey on a hanger.',
  sprite: 'A Retro Bowl sprite with his locked look (skin, hair, beard, gear), team helmet decal, stripe, facemask and pants stripe.',
};

const STYLES: ArtStyle[] = [
  ...VARIANTS.map((v) => ({
    key: v.key,
    name: v.label,
    tag: v.short,
    variant: v.key,
    pitch: `${PITCH[v.key]} ${(STANDARD.variants[v.key] * 100).toFixed(1)}% of Standard pulls.`,
  })),
  { key: 'stadium', name: 'Under the lights', tag: 'Lab', pitch: 'Not in packs. The sprite on a night field: light towers, flashbulbs, team logo on the turf.', Art: StadiumArt },
  { key: 'helmet', name: 'Helmet hero', tag: 'Lab', pitch: 'Not in packs. One big glossy 3/4 helmet with the team stripe, decal and facemask.', Art: HelmetArt },
  { key: 'action', name: 'Action pictogram', tag: 'Lab', pitch: 'Not in packs. A position pose with speed streaks.', Art: ActionArt },
  { key: 'back', name: 'Jersey back', tag: 'Lab', pitch: 'Not in packs. Surname arched over the big number, on a hanger with folds.', Art: JerseyBackArt },
];

/** Sprite looks first in the lab: the owner's key players, then everyone else with a locked look. */
const KEY_LOOKS = ['Sherman Brandson', 'Rondale Ikarras', 'Wayne Wilson', 'Michael Wilson', 'Ty Lock', 'Jaylen Conklin', 'Kane Van Oxley', 'Dylan Hyatt', 'Jason Macleone'];

/** Each sample shows a different finish, so every style is seen under every treatment. */
const FINISH_FOR: Record<Tier, Finish> = { legendary: 'holo', epic: 'gold', rare: 'silver', common: 'base' };

interface ArtLabProps {
  open: boolean;
  onClose: () => void;
  cards: CardInfo[];
  total: number;
}

interface Big {
  style: ArtStyle;
  sample: ArtSample;
}

const card = (style: ArtStyle, s: ArtSample, total: number, large: boolean, onOpen?: () => void) => {
  const { Art } = style;
  const i = s.info;
  return (
    <CollectibleCard
      owned
      large={large}
      live={large}
      player={i.player}
      tier={s.tier}
      finish={FINISH_FOR[s.tier]}
      variant={style.variant}
      ovr={i.ovr}
      number={i.number}
      stats={i.stats}
      setNo={i.setNo}
      setTotal={total}
      art={Art ? <Art player={i.player} number={i.number} pal={paletteFor(i.player)} /> : undefined}
      onOpen={onOpen}
    />
  );
};

/**
 * Art lab (read-only): alternative card-art styles side by side. Rows are styles (the current jersey first),
 * columns are four sample players across tiers, positions and team colours. Click a card to see it large.
 * Nothing here changes the art used in the binder or packs.
 */
const ArtLab = ({ open, onClose, cards, total }: ArtLabProps) => {
  const samples = useMemo(() => artSamples(cards), [cards]);
  const table = useSpriteTable();
  const looks = useMemo<ArtSample[]>(() => {
    if (!table) return [];
    const names = Object.keys(table).sort((a, b) => {
      const ia = KEY_LOOKS.indexOf(a);
      const ib = KEY_LOOKS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return names.flatMap((n) => {
      const info = cards.find((c) => c.player.name === n);
      return info ? [{ key: info.key, label: `${tierLabel(info.tier)} ${info.player.position}`, tier: info.tier, info }] : [];
    });
  }, [table, cards]);
  // Poses strip: one sample player per position (best OVR), every pose; celebrations and signatures after
  const poseRows = useMemo(() => {
    const league = cards.filter((c) => !c.player.isRealLegend);
    const best = (pos: string) => league.filter((c) => c.player.position === pos).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0))[0];
    const rows = Object.entries(POSITION_POSES).flatMap(([pos, poses]) => {
      const c = best(pos);
      return c ? [{ key: pos, title: `${pos} · ${c.player.name}`, items: poses.map((p) => ({ ...p, info: c })) }] : [];
    });
    const wilson = league.find((c) => c.player.name === 'Wayne Wilson') ?? best('QB');
    if (wilson) rows.push({ key: 'cel', title: `Celebrations (any position) · ${wilson.player.name}`, items: CELEBRATIONS.map((p) => ({ ...p, info: wilson })) });
    const SIG_PLAYER: Record<string, string> = { 'sig-praise': 'Rondale Ikarras', 'sig-cold': 'Jason Macleone' };
    const sig = SIGNATURES.flatMap((p) => {
      const c = league.find((x) => x.player.name === SIG_PLAYER[p.key]);
      return c ? [{ ...p, label: `${p.label} (${c.player.name})`, info: c }] : [];
    });
    if (sig.length) rows.push({ key: 'sig', title: 'Signature (owner-requested, locked in sprites.json)', items: sig });
    return rows;
  }, [cards]);
  const [big, setBig] = useState<Big | null>(null);
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto border-line bg-night p-3 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="font-display text-2xl uppercase italic">
              Art <span className="text-gold">lab</span>
            </DialogTitle>
            <DialogDescription>
              The five art variants pulled from packs (rarest last), then styles that stay in the lab, on four sample players.
              Below: every locked Retro Bowl sprite look. Preview only; nothing is added.
            </DialogDescription>
          </div>
          {!samples.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading cards…</p>
          ) : (
            <div className="ral" role="table" aria-label="Card art styles by sample player">
              <div role="row" className="ral__cards ral__cols">
                {samples.map((s) => (
                  <span key={s.key} role="columnheader" className="ral__col">
                    {s.label}
                    <b>{s.info.player.name.split(' ').slice(-1)[0]}</b>
                  </span>
                ))}
              </div>
              {STYLES.map((st) => (
                <div key={st.key} role="row" className="ral__row">
                  <div role="rowheader" className="ral__label">
                    <span className={`ral__idx${st.variant ? ` vbadge--${st.variant}` : ''}`}>{st.tag}</span>
                    <span className="min-w-0">
                      <b>{st.name}</b>
                      <span>{st.pitch}</span>
                    </span>
                  </div>
                  <div className="ral__cards">
                    {samples.map((s) => (
                      <div key={s.key} role="cell" className="min-w-0">
                        {card(st, s, total, false, () => setBig({ style: st, sample: s }))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="ral__row">
                <div className="ral__label">
                  <span className="ral__idx vbadge--sprite">Helmets</span>
                  <span className="min-w-0">
                    <b>Helmets</b>
                    <span>All 32 clubs, low-res: shell, crown stripe, facemask and logo (src/components/collection/art/helmets.ts).</span>
                  </span>
                </div>
                <ul className="ral__helmets" aria-label="Team helmets">
                  {[...NFL_TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                    <li key={t.id}>
                      <PixelHelmet team={t.name} />
                      <span>{t.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {poseRows.length > 0 && (
                <div className="ral__row">
                  <div className="ral__label">
                    <span className="ral__idx vbadge--sprite">Poses</span>
                    <span className="min-w-0">
                      <b>Poses</b>
                      <span>Every sprite pose by position. Each player gets one from his name; lock one with "pose" in data/y80/sprites.json (the key under each).</span>
                    </span>
                  </div>
                  {poseRows.map((r) => (
                    <div key={r.key} className="ral__poses">
                      <p className="ral__poses-title">{r.title}</p>
                      <ul className="ral__pose-list" aria-label={r.title}>
                        {r.items.map((p) => (
                          <li key={p.key} className="ral__pose">
                            <span className="ral__pose-art">
                              <PixelSpriteArt player={p.info.player} number={p.info.number} pal={paletteFor(p.info.player)} pose={p.key} />
                            </span>
                            <span className="ral__pose-name">{p.label}</span>
                            <code className="ral__pose-key">{p.key}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {looks.length > 0 && (
                <div className="ral__row">
                  <div className="ral__label">
                    <span className="ral__idx vbadge--sprite">Looks</span>
                    <span className="min-w-0">
                      <b>Sprite looks</b>
                      <span>Locked from the game's portraits (data/y80/sprites.json): skin, hair, beard, gear, build.</span>
                    </span>
                  </div>
                  <ul className="ral__looks" aria-label="Locked sprite looks">
                    {looks.map((s) => (
                      <li key={s.key} className="min-w-0">
                        {card(STYLES.find((x) => x.key === 'sprite')!, s, total, false, () => setBig({ style: STYLES.find((x) => x.key === 'sprite')!, sample: s }))}
                        <span className="ral__look-name">{s.info.player.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!big} onOpenChange={(o) => !o && setBig(null)}>
        <DialogContent className="max-h-[94vh] max-w-md overflow-y-auto border-line bg-night p-4 sm:p-6">
          <DialogTitle className="font-display text-xl uppercase italic">{big?.style.name}</DialogTitle>
          <DialogDescription>{big ? `${big.sample.info.player.name} · ${big.sample.label}. ${big.style.pitch}` : ''}</DialogDescription>
          {big && <div className="ral__big">{card(big.style, big.sample, total, true)}</div>}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ArtLab;
