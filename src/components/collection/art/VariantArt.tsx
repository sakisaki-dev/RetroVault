import type { ComponentType } from 'react';
import type { GamePlayer } from '@/config/ovr';
import type { Variant } from '@/config/cardTiers';
import type { OwnedAuto } from '@/utils/collection';
import { paletteFor, type ArtProps } from './shared';
import { uniformFor } from './sprite/uniforms';
import NumberArt from './NumberArt';
import JerseyArt from './JerseyArt';
import VintageArt from './VintageArt';
import LockerArt from './LockerArt';
import AutographCanvas from '../autograph/AutographCanvas';
import { isSampleAuto, useAutographFor, type AutographChoice } from '../autograph/sample';
import './art.css';

/** The art style behind each drawn card variant (the Autograph is its own canvas, AutoArt). */
const VARIANT_ART: Record<Exclude<Variant, 'auto'>, ComponentType<ArtProps>> = {
  number: NumberArt,
  jersey: JerseyArt,
  topps: VintageArt,
  locker: LockerArt,
};

interface VariantArtProps {
  variant: Variant;
  player: GamePlayer;
  number?: number | null;
  /** The card's finish (with the variant, decides the uniform roll) */
  finish?: string;
  /** Autograph variant: the autograph to show (a pull), or 'sample' (galleries); unset = his best owned one, else a sample */
  autograph?: AutographChoice;
}

const isFinish = (f: string | undefined): f is OwnedAuto['finish'] => f === 'base' || f === 'silver' || f === 'gold' || f === 'holo';

/** The Autograph variant's art: the signed autograph card itself, framed in the card's art window. */
const AutoArt = ({ player, number, finish, autograph }: Omit<VariantArtProps, 'variant'>) => {
  const auto = useAutographFor({ player, number: number ?? 0 }, isFinish(finish) ? finish : 'base', autograph);
  return (
    <span className="ra ra--auto">
      <AutographCanvas snap={auto.snap} roll={auto.roll} cacheKey={auto.id} label={`${auto.snap.name} autograph${isSampleAuto(auto) ? ' (sample)' : ''}`} />
    </span>
  );
};

/** A card's art for its variant, in the player's team palette. */
const VariantArt = ({ variant, player, number, finish, autograph }: VariantArtProps) => {
  if (variant === 'auto') return <AutoArt player={player} number={number} finish={finish} autograph={autograph} />;
  const Art = VARIANT_ART[variant];
  const uniform = uniformFor(player, variant, finish);
  return <Art player={player} number={number} pal={paletteFor(player, uniform)} uniform={uniform} />;
};

export default VariantArt;
