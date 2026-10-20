import { useId } from 'react';
import JerseyGarment from './JerseyGarment';
import { logoFor, teamStyleFor } from './teamStyle';
import type { ArtProps } from './shared';

/** Variant "Team jersey": his current team's game jersey, front on, with the team's trim, patch and TV numbers. */
const JerseyArt = ({ player, number, pal }: ArtProps) => {
  const id = `tj${useId().replace(/:/g, '')}`;
  return (
    <svg className="ra ra--jersey" viewBox="0 0 120 110" aria-hidden="true" focusable="false">
      <JerseyGarment pal={pal} style={teamStyleFor(player)} number={number} logo={logoFor(player)} id={id} />
    </svg>
  );
};

export default JerseyArt;
