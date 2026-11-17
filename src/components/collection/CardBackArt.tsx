import { useId } from 'react';
import { cn } from '@/lib/utils';
import { useCollection } from '@/utils/collection';
import { activeCosmetic } from '@/utils/economy';

/** The card's shield (the same polygon as `--fut-clip`), in a 300 × 426 box */
const SHIELD = '0,36.2 18,17.9 51,12.8 81,2.6 219,2.6 249,12.8 282,17.9 300,36.2 300,362.1 270,387.7 198,406.4 150,426 102,406.4 30,387.7 0,362.1';

/**
 * The face-down side of every card (owner, 2026-11-17, picked from the card-back designs: "4", the chrome refractor):
 * white chrome with an etched diamond texture and a rainbow sweep, RETRO VAULT top and bottom, a navy diamond holding a
 * holographic RV. The rim is an SVG stroke of the shield clipped to itself, so it runs the same width all the way round
 * (a clip-path cuts an inset box-shadow at the angled corners). Identical for every card: nothing hints at a rarity
 * before the flip; only the pack type may change the mark (Perfect Season: "18–0"). A portfolio milestone unlocks a
 * finish for every back (economy.ts MILESTONES, kind 'back'): gold refractor or black chrome, when switched on.
 */
const CardBackArt = ({ mark = 'RV' }: { mark?: string }) => {
  const clip = `pkb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { state } = useCollection();
  const finish = activeCosmetic(state, 'back');
  return (
    <span className={cn('pk-back__shape', finish && `pk-back--${finish}`)}>
      <span className="pk-back__word pk-back__word--top">Retro Vault</span>
      <span className="pk-back__diamond" aria-hidden="true" />
      <span className="pk-back__mark">
        <span className="pk-back__logo">{mark}</span>
        <span className="pk-back__sub">{finish === 'gold' ? 'Gold' : finish === 'black' ? 'Black' : 'Chrome'}</span>
      </span>
      <span className="pk-back__word pk-back__word--bottom">Retro Vault</span>
      <svg className="pk-back__rim" viewBox="0 0 300 426" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <polygon points={SHIELD} />
          </clipPath>
        </defs>
        <polygon points={SHIELD} className="pk-back__rim-out" clipPath={`url(#${clip})`} />
        <polygon points={SHIELD} className="pk-back__rim-in" clipPath={`url(#${clip})`} />
      </svg>
    </span>
  );
};

export default CardBackArt;
