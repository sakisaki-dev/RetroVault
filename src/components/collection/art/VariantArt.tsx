import type { ComponentType } from 'react';
import type { GamePlayer } from '@/config/ovr';
import type { Variant } from '@/config/cardTiers';
import { paletteFor, type ArtProps } from './shared';
import { uniformFor } from './sprite/uniforms';
import NumberArt from './NumberArt';
import JerseyArt from './JerseyArt';
import VintageArt from './VintageArt';
import LockerArt from './LockerArt';
import PixelSpriteArt from './PixelSprite';
import './art.css';

/** The art style behind each card variant (the Art lab shows these plus the styles that never made it into packs). */
const VARIANT_ART: Record<Variant, ComponentType<ArtProps>> = {
  number: NumberArt,
  jersey: JerseyArt,
  topps: VintageArt,
  locker: LockerArt,
  sprite: PixelSpriteArt,
};

interface VariantArtProps {
  variant: Variant;
  player: GamePlayer;
  number?: number | null;
  /** The card's finish (with the variant, decides the uniform roll) */
  finish?: string;
}

/** A card's art for its variant, in the player's team palette. */
const VariantArt = ({ variant, player, number, finish }: VariantArtProps) => {
  const Art = VARIANT_ART[variant];
  const uniform = uniformFor(player, variant, finish);
  return <Art player={player} number={number} pal={paletteFor(player, uniform)} uniform={uniform} />;
};

export default VariantArt;
