import { useId } from 'react';
import JerseyGarment from './JerseyGarment';
import { logoFor, teamStyleFor } from './teamStyle';
import { homeUniform } from './sprite/uniforms';
import type { ArtProps } from './shared';

/** Variant "Team jersey": his team's game jersey (the card's uniform: home, or a rolled alternate), front on. */
const JerseyArt = ({ player, number, pal, uniform }: ArtProps) => {
  const id = `tj${useId().replace(/:/g, '')}`;
  const u = uniform ?? homeUniform(player.team);
  return (
    <svg className="ra ra--jersey" viewBox="0 0 120 110" aria-hidden="true" focusable="false">
      <JerseyGarment pal={pal} style={teamStyleFor(player, u)} number={number} logo={logoFor(player)} id={id} uniform={u} />
    </svg>
  );
};

export default JerseyArt;
