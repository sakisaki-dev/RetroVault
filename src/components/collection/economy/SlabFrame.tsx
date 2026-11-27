import { cn } from '@/lib/utils';
import './rewards.css';

/** The graded case drawn over a card: clear glass with the red RV GRADING label (the Graded slab reward). */
const SlabFrame = ({ big = false }: { big?: boolean }) => (
  <span className={cn('rw-slab', big && 'rw-slab--big')} aria-hidden="true">
    <span className="rw-slab__lab">
      <span>
        RV GRADING
        <br />
        GEM MINT
      </span>
      <b>10</b>
    </span>
  </span>
);

export default SlabFrame;
