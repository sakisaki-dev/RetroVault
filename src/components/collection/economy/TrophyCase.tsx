import { useMemo } from 'react';
import { MILESTONES, caseUnlocked } from '@/utils/economy';
import type { CollectionState } from '@/utils/collection';
import { displayName } from '@/utils/displayName';
import CollectibleCard from '../CollectibleCard';
import { displayWithKit } from '../kits';
import PixelCup from '@/components/frontoffice/PixelCup';
import type { TopCard } from './useRewards';
import './rewards.css';

const BANDS = ['140 45% 32%', '215 70% 45%', '38 85% 52%', '0 70% 46%', '270 50% 48%', '190 70% 40%', '330 60% 50%', '45 90% 55%'];

/** Cups for the milestones reached, one each (band colour by order). */
export const caseCups = (state: CollectionState) => MILESTONES.filter((m) => state.unlocks?.includes(m.id));

/**
 * The Trophy case (8M reward): a glass case with the three most valuable owned cards on the top shelf and a pixel cup
 * for every milestone reached below.
 */
const TrophyCase = ({ state, top, total, onOpen, preview = false }: { state: CollectionState; top: TopCard[]; total: number; onOpen?: (c: TopCard['info']) => void; preview?: boolean }) => {
  const cups = useMemo(() => caseCups(state), [state]);
  if (!preview && !caseUnlocked(state)) return null;
  return (
    <section className="rw-case" aria-label="Trophy case">
      <p className="rw-case__k mb-2">Trophy case</p>
      <div className="rw-case__row">
        {top.map((t) => {
          const entry = state.cards[t.info.key];
          const d = entry ? displayWithKit(entry, state.display?.[t.info.key], t.info.player) : undefined;
          return (
            <div key={t.info.key} className="rw-case__card" title={displayName(t.info.player.name)}>
              <CollectibleCard
                owned
                player={t.info.player}
                tier={t.info.tier}
                finish={d?.finish ?? 'base'}
                variant={d?.variant}
                kit={d?.kit}
                prizm={d?.prizm}
                ovr={t.info.ovr}
                number={t.info.number}
                stats={t.info.stats}
                setNo={t.info.setNo}
                setTotal={total}
                marks={entry?.marks}
                onOpen={onOpen ? () => onOpen(t.info) : undefined}
              />
            </div>
          );
        })}
        {!top.length && <p className="py-6 text-xs" style={{ color: '#e9d7aa' }}>Your three most valuable cards stand here.</p>}
      </div>
      <div className="rw-case__row">
        {cups.map((m, i) => (
          <div key={m.id} className="rw-case__cup" title={m.label}>
            <PixelCup band={BANDS[i % BANDS.length]} />
            <span>{m.at >= 1_000_000 ? `${m.at / 1_000_000}M` : `${m.at / 1000}K`}</span>
          </div>
        ))}
        {!cups.length && <p className="py-3 text-xs" style={{ color: '#e9d7aa' }}>A cup for every milestone reached.</p>}
      </div>
    </section>
  );
};

export default TrophyCase;
