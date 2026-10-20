import { useMemo, useState, type ComponentType } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Finish, Tier } from '@/utils/collection';
import CollectibleCard from '../CollectibleCard';
import type { CardInfo } from '../useCardPool';
import { artSamples, type ArtSample } from './artSamples';
import { paletteFor, type ArtProps } from './shared';
import PixelSpriteArt from './PixelSprite';
import StadiumArt from './StadiumArt';
import HelmetArt from './HelmetArt';
import ActionArt from './ActionArt';
import JerseyBackArt from './JerseyBackArt';
import NumberArt from './NumberArt';
import VintageArt from './VintageArt';
import LockerArt from './LockerArt';
import './art.css';

interface ArtStyle {
  key: string;
  name: string;
  pitch: string;
  /** Undefined = the card's own default art (the current team jersey) */
  Art?: ComponentType<ArtProps>;
}

const STYLES: ArtStyle[] = [
  { key: 'jersey', name: 'Team jersey (current)', pitch: 'The baseline: a front jersey in team colours with the chest number.' },
  { key: 'pixel', name: 'Retro Bowl sprite', pitch: 'A chunky pixel player in full uniform, posed by position. The most on-brand option.', Art: PixelSpriteArt },
  { key: 'stadium', name: 'Under the lights', pitch: 'The same sprite on a night field: light towers, flashbulbs in the stand, team logo on the turf.', Art: StadiumArt },
  { key: 'helmet', name: 'Helmet hero', pitch: 'One big glossy 3/4 helmet with the stripe, facemask and number on the side.', Art: HelmetArt },
  { key: 'action', name: 'Action pictogram', pitch: 'A position pose (throw, cut, layout catch, punch, tackle) with speed streaks.', Art: ActionArt },
  { key: 'back', name: 'Jersey back', pitch: 'The fan-jersey view: surname arched over the big number, on a hanger with folds.', Art: JerseyBackArt },
  { key: 'number', name: 'Prizm number', pitch: 'A giant chrome-extruded number over refractor rays and halftone.', Art: NumberArt },
  { key: 'vintage', name: '70s trading card', pitch: 'A cream photo window, duotone halftone bust in helmet and pads, and a team pennant.', Art: VintageArt },
  { key: 'locker', name: 'Locker stall', pitch: 'His stall: nameplate, helmet on the shelf, game jersey on a hanger under a downlight.', Art: LockerArt },
];

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
              Card-art ideas for league players, side by side. Preview only: the binder and packs still use the jersey.
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
              {STYLES.map((st, n) => (
                <div key={st.key} role="row" className="ral__row">
                  <div role="rowheader" className="ral__label">
                    <span className="ral__idx">{n === 0 ? 'Now' : n}</span>
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
