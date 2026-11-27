import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { MILESTONES, caseUnlocked } from '@/utils/economy';
import type { CollectionState } from '@/utils/collection';
import { isLite } from '@/hooks/usePerfMode';
import { reducedMotion } from '@/utils/motion';
import CollectibleCard from '../CollectibleCard';
import { displayWithKit } from '../kits';
import PixelCup from '@/components/frontoffice/PixelCup';
import type { TopCard } from './useRewards';
import './rewards.css';

const BANDS = ['140 45% 32%', '215 70% 45%', '38 85% 52%', '0 70% 46%', '270 50% 48%', '190 70% 40%', '330 60% 50%', '45 90% 55%'];
const KEY = 'retroVault:trophyCaseOpen';
/** Cups per shelf: two shelves, each spaced evenly (13 milestones → 7 + 6, never a lone cup on a row). */
const CUPS_TOP = Math.ceil(MILESTONES.length / 2);
const short = (at: number) => (at >= 1_000_000 ? `${at / 1_000_000}M` : `${at / 1000}K`);

/** Cups for the milestones reached, one each (band colour by order). */
export const caseCups = (state: CollectionState) => MILESTONES.filter((m) => state.unlocks?.includes(m.id));

/**
 * The Trophy case (8M reward): a glass cabinet, closed behind a toggle (owner: "looks a little empty"). Opening it
 * plays the doors sliding apart, the bay lamps warming up, the three most valuable cards rising onto their plinths and
 * a cup dropping onto the lower shelf for every milestone reached (the ones still ahead stand as dim outlines), then a
 * glint across the glass. The open state is remembered on this device; reduced motion and lite mode just show it.
 */
const TrophyCase = ({ state, top, total, onOpen, preview = false }: { state: CollectionState; top: TopCard[]; total: number; onOpen?: (c: TopCard['info']) => void; preview?: boolean }) => {
  const cups = useMemo(() => caseCups(state), [state]);
  const reduce = reducedMotion();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const [play, setPlay] = useState(0);
  if (!preview && !caseUnlocked(state)) return null;
  const won = new Set(cups.map((m) => m.id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !reduce && !isLite()) setPlay((n) => n + 1);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* storage blocked: the choice lasts this visit */
    }
  };
  const bays = [0, 1, 2].map((i) => top[i]);
  return (
    <section className="rw-case" aria-label="Trophy case" data-open={open || undefined}>
      <button type="button" className="rw-case__bar" aria-expanded={open} onClick={toggle}>
        <PixelCup band="45 90% 55%" className="rw-case__badge" />
        <span className="rw-case__k">Trophy case</span>
        <span className="rw-case__n">{cups.length}/{MILESTONES.length}</span>
        <span className="rw-case__go">{open ? 'Close' : 'Open'} <ChevronDown className="h-3.5 w-3.5" aria-hidden /></span>
      </button>
      {open && (
        <div key={play} className="rw-case__body" data-play={play ? '1' : undefined}>
          {play > 0 && (
            <div className="rw-case__doors" aria-hidden>
              <i />
              <i />
            </div>
          )}
          <div className="rw-case__shelf rw-case__shelf--cards">
            {bays.map((t, i) => {
              const entry = t ? state.cards[t.info.key] : undefined;
              const d = t && entry ? displayWithKit(entry, state.display?.[t.info.key], t.info.player) : undefined;
              return (
                <div key={t?.info.key ?? `empty-${i}`} className="rw-case__bay" style={{ '--i': i } as CSSProperties} title={t ? t.info.player.name : undefined}>
                  <span className="rw-case__lamp" aria-hidden />
                  {t ? (
                    <div className="rw-case__card">
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
                  ) : (
                    <div className="rw-case__card rw-case__card--empty" aria-hidden />
                  )}
                  <span className="rw-case__plinth" aria-hidden>{i === 0 ? '1st' : i === 1 ? '2nd' : '3rd'}</span>
                </div>
              );
            })}
          </div>
          {[MILESTONES.slice(0, CUPS_TOP), MILESTONES.slice(CUPS_TOP)].map((row, r) => (
            <div key={r} className="rw-case__shelf rw-case__shelf--cups">
              {row.map((m, j) => {
                const i = r * CUPS_TOP + j;
                const has = won.has(m.id);
                return (
                  <div key={m.id} className="rw-case__cup" data-won={has || undefined} style={{ '--i': i } as CSSProperties} title={has ? m.label : `${m.label}: at ${short(m.at)}`}>
                    <PixelCup band={has ? BANDS[cups.indexOf(m) % BANDS.length] : '0 0% 30%'} spark={has ? i : undefined} />
                    <span>{short(m.at)}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {play > 0 && <span className="rw-case__glint" aria-hidden />}
        </div>
      )}
    </section>
  );
};

export default TrophyCase;
