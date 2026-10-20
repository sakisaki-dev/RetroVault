import { useState } from 'react';
import { Hammer, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { FINISHES, craftCost, craftUpgrade, finishLabel, nextFinish, tierLabel, type Finish, type OwnedCard, type Tier } from '@/utils/collection';
import CollectibleCard from './CollectibleCard';
import { FINISH_ICON, FINISH_TEXT } from './rarityIcons';
import type { CardInfo } from './useCardPool';

export interface CardDetailTarget {
  info: CardInfo;
  /** Finish shown; defaults to the best owned */
  finish?: Finish;
  /** Tier shown (Card designs can show any tier); defaults to the player's */
  tier?: Tier;
  /** Card designs preview: no crafting, no ownership */
  preview?: boolean;
}

interface CardDetailProps {
  target: CardDetailTarget | null;
  entry?: OwnedCard;
  shards: number;
  total: number;
  onClose: () => void;
  onPlayer?: (info: CardInfo) => void;
}

/** Large tilt view of one card: face-stat legend, finishes owned, and a one-tap finish upgrade. */
const CardDetail = ({ target, entry, shards, total, onClose, onPlayer }: CardDetailProps) => {
  const [msg, setMsg] = useState('');
  const info = target?.info;
  const finish = target?.finish ?? entry?.best ?? 'base';
  const tier = target?.tier ?? info?.tier ?? 'common';
  const to = !target?.preview && entry ? nextFinish(entry.best) : null;
  const cost = to && info ? craftCost(to, info.tier) : 0;

  const craft = () => {
    if (!info || !to) return;
    const done = craftUpgrade(info.player, info.tier);
    setMsg(done ? `Upgraded to ${finishLabel(done)}.` : 'Not enough shards.');
  };

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          setMsg('');
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto border-line bg-night p-4 sm:p-6">
        {info && (
          <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,320px)_1fr]">
            <div className="mx-auto w-full max-w-[300px] pt-3">
              <CollectibleCard
                owned
                large
                live
                player={info.player}
                tier={tier}
                finish={finish}
                ovr={info.ovr}
                number={info.number}
                stats={info.stats}
                setNo={info.setNo}
                setTotal={total}
                marks={entry?.marks}
              />
            </div>
            <div className="min-w-0 space-y-4">
              <div>
                <DialogTitle className="font-display text-3xl uppercase italic leading-none">{info.player.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {tierLabel(tier)} · {finishLabel(finish)} · {POSITION_NAMES[info.player.position] ?? info.player.position} · {info.franchise}
                </DialogDescription>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {info.stats.map((s) => (
                  <div key={s.code} className="flex items-baseline gap-2" title={s.name}>
                    <dt className="w-9 shrink-0 font-display font-bold">{s.code}</dt>
                    <dd className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{s.name.replace(/ \(.*\)$/, '')}</dd>
                    <dd className="font-mono font-bold tabular-nums">{s.value ?? '–'}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">Stats are 0–99 from the player&apos;s percentile at his position (league scale).</p>
              {!target?.preview && entry && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Finishes owned">
                  {FINISHES.map((f) => {
                    const Icon = FINISH_ICON[f.key];
                    const n = entry.counts[f.key] ?? 0;
                    return (
                      <li
                        key={f.key}
                        className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs', n ? 'border-line bg-panel' : 'border-line/50 opacity-40')}
                      >
                        <Icon className={cn('h-3.5 w-3.5', FINISH_TEXT[f.key])} aria-hidden="true" />
                        {f.label}
                        {n > 1 && <span className="font-mono text-muted-foreground">×{n}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {to && (
                  <button
                    type="button"
                    onClick={craft}
                    disabled={cost > shards}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sky-300/60 px-3 text-sm font-bold text-sky-200 transition hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Hammer className="h-4 w-4" aria-hidden="true" />
                    {finishLabel(to)} · {cost.toLocaleString()} shards
                  </button>
                )}
                {onPlayer && (
                  <button
                    type="button"
                    onClick={() => onPlayer(info)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold hover:border-gold/60"
                  >
                    <UserRound className="h-4 w-4" aria-hidden="true" /> Player page
                  </button>
                )}
              </div>
              <p className="text-xs text-gold" role="status">
                {msg}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardDetail;
