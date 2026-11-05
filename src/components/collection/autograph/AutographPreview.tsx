import { useMemo, useState } from 'react';
import { Dices, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rollAutograph, type RollOverrides } from '@/config/autographs';
import { useLeagueContent } from '@/utils/leagueContent';
import type { CardInfo } from '../useCardPool';
import AutographCanvas from './AutographCanvas';
import AutographDetails from './AutographDetails';
import { freezeFor } from './freeze';

interface AutographPreviewProps {
  /** The card pool (useCardPool().cards) */
  cards: CardInfo[];
  /** Show this player ("POS:Name" or his card); without one it starts on a random card and offers "Another player" */
  player?: CardInfo | string;
  /** Start from this roll seed (same seed, same autograph) */
  seed?: number;
  /** Force a parallel, era or pen (anything left out is rolled like a pack) */
  overrides?: RollOverrides;
  /** Show the readout (parallel, pen, value…) beside the card */
  details?: boolean;
  className?: string;
}

/**
 * A sample autograph for any player, rolled exactly like a pack pull, with "Roll another". Self-contained: it reads the
 * card pool and league content, never the stored collection, and adds nothing to it (for the Art lab to embed).
 */
const AutographPreview = ({ cards, player, seed: seed0 = 1, overrides, details = true, className }: AutographPreviewProps) => {
  const { content } = useLeagueContent();
  const [seed, setSeed] = useState(seed0);
  const [pick, setPick] = useState(() => Math.floor(Math.random() * 1e6));
  const fixed = typeof player === 'string' ? cards.find((c) => c.key === player) : player;
  const info = fixed ?? (cards.length ? cards[pick % cards.length] : undefined);
  const players = useMemo(() => cards.map((c) => c.player), [cards]);
  const snap = useMemo(() => (info ? freezeFor(info, content, players) : null), [info, content, players]);
  const roll = useMemo(() => (snap ? rollAutograph(snap, seed, overrides) : null), [snap, seed, overrides]);

  if (!info || !snap || !roll) return <p className="text-sm text-muted-foreground">No players to sign yet.</p>;
  return (
    <div className={cn('grid gap-4', details && 'sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:items-start', className)}>
      <div className="grid gap-3">
        <AutographCanvas key={`${snap.name}:${seed}`} snap={snap} roll={roll} write label={`Sample autograph: ${snap.name}`} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold px-4 text-sm font-semibold text-night hover:brightness-110"
          >
            <Dices className="h-4 w-4" aria-hidden="true" /> Roll another
          </button>
          {!fixed && cards.length > 1 && (
            <button
              type="button"
              onClick={() => setPick((p) => p + 1 + Math.floor(Math.random() * (cards.length - 1)))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-panel px-4 text-sm font-semibold hover:border-gold/60"
            >
              <Users className="h-4 w-4" aria-hidden="true" /> Another player
            </button>
          )}
        </div>
      </div>
      {details && (
        <div className="min-w-0">
          <p className="font-display text-2xl font-extrabold uppercase italic leading-none">{snap.name}</p>
          <p className="mb-2 mt-1 text-xs text-muted-foreground">Sample pull · seed {seed} · nothing is added to the binder</p>
          <AutographDetails snap={snap} roll={roll} />
        </div>
      )}
    </div>
  );
};

export default AutographPreview;
