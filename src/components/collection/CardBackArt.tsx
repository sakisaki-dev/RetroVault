import { useId, type CSSProperties } from 'react';
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
 * finish for every back (economy.ts MILESTONES, kind 'back'): Field holo, Jumbotron, Wax pack or Black ice, when switched
 * on. Every finish is still the same for every card. `finish` forces one (the Milestones previews).
 */
const WORDS: Record<string, [string, string]> = {
  field: ['Retro', 'Vault'],
  led: ['Now entering', 'The vault'],
  wax: ['Series 26', 'Vault Gum Co.'],
  ice: ['Retro Vault', 'Black ice'],
};
const SUB: Record<string, string> = { field: 'Holo', led: '', wax: 'Wax', ice: 'Ice' };
/** The Jumbotron's R and V on a 5 x 7 LED board (12 wide) */
const LED_R = ['1110', '1001', '1001', '1110', '1010', '1001', '1001'];
const LED_V = ['10001', '10001', '10001', '10001', '01010', '01010', '00100'];
const LED_COLS = 12;
const LED_DOTS = LED_R.flatMap((r, y) => [...('0' + r + '0' + LED_V[y] + '0')].map((c) => c === '1'));

const CardBackArt = ({ mark = 'RV', finish: forced }: { mark?: string; finish?: string }) => {
  const clip = `pkb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { state } = useCollection();
  const finish = forced ?? activeCosmetic(state, 'back');
  const words = (finish && WORDS[finish]) || ['Retro Vault', 'Retro Vault'];
  const led = finish === 'led' && mark === 'RV';
  return (
    <span className={cn('pk-back__shape', finish && `pk-back--${finish}`)}>
      <span className="pk-back__word pk-back__word--top">{words[0]}</span>
      <span className="pk-back__diamond" aria-hidden="true" />
      <span className="pk-back__mark">
        {led ? (
          <span className="pk-back__led" aria-hidden="true" style={{ ['--cols' as string]: LED_COLS }}>
            {LED_DOTS.map((on, i) => (
              <i key={i} className={on ? 'on' : undefined} style={on ? ({ '--k': (i * 7) % 11 } as CSSProperties) : undefined} />
            ))}
          </span>
        ) : (
          <span className="pk-back__logo">{mark}</span>
        )}
        <span className="pk-back__sub">{(finish && SUB[finish]) ?? 'Chrome'}</span>
      </span>
      <span className="pk-back__word pk-back__word--bottom">{words[1]}</span>
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
