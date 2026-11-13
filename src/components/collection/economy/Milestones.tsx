import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CollectionState } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { MILESTONES, activeCosmetic, setCosmetic, type CosmeticKind } from '@/utils/economy';

interface MilestonesProps {
  state: CollectionState;
  /** Portfolio value now (coins), null while the market loads */
  value: number | null;
}

const KIND_LABEL: Record<CosmeticKind, string> = { binder: 'Binder skin', pack: 'Pack opening' };
const short = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}K`);

/**
 * Portfolio milestones: the collection's market value crossing each line unlocks a cosmetic for good (it stays
 * unlocked if the value later drops). Unlocked ones can be switched on, one binder skin and one pack theme at a time.
 */
const Milestones = ({ state, value }: MilestonesProps) => {
  const unlocked = new Set(state.unlocks ?? []);
  const next = MILESTONES.find((m) => !unlocked.has(m.id));
  const active = { binder: activeCosmetic(state, 'binder'), pack: activeCosmetic(state, 'pack') };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="ec-kicker">Portfolio value</p>
          <p className="font-display text-3xl font-extrabold tabular-nums">{value == null ? '…' : fmtCoins(value)}</p>
        </div>
        {next && value != null && (
          <p className="text-xs text-muted-foreground">
            {fmtCoins(Math.max(0, next.at - value))} to the {short(next.at)} milestone
          </p>
        )}
      </div>
      <ol className="ec-ladder">
        {MILESTONES.map((m) => {
          const open = unlocked.has(m.id);
          const on = active[m.cosmetic.kind] === m.cosmetic.id;
          const share = value == null ? 0 : Math.min(1, value / m.at);
          return (
            <li key={m.id} className={cn('ec-rung', open && 'is-open')}>
              <span className={cn('ec-swatch', `ec-swatch--${m.cosmetic.id}`)} aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="ec-kicker">
                  {short(m.at)} · {KIND_LABEL[m.cosmetic.kind]}
                </p>
                <p className="font-bold leading-tight">{m.cosmetic.label}</p>
                <p className="text-xs text-muted-foreground">{m.cosmetic.blurb}</p>
                {open ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      className={cn('ec-btn ec-btn--sm', on ? 'ec-btn--ghost' : 'ec-btn--gold')}
                      aria-pressed={on}
                      onClick={() => setCosmetic(m.cosmetic.kind, on ? null : m.cosmetic.id)}
                    >
                      {on ? 'In use · switch off' : 'Use it'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="ec-meter flex-1" role="progressbar" aria-label={`${m.cosmetic.label}: ${Math.round(share * 100)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
                      <i style={{ width: `${share * 100}%` }} />
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{Math.round(share * 100)}%</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default Milestones;
