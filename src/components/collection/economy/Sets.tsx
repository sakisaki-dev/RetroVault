import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import { PACKS, type CollectionState } from '@/utils/collection';
import { fmtCoins } from '@/utils/cardMarket';
import { claimSet, setProgress, setReward, type CollectionSet, type SetKind } from '@/utils/economy';
import type { CardInfo } from '../useCardPool';

interface SetsProps {
  sets: CollectionSet[];
  state: CollectionState;
  byKey: Map<string, CardInfo>;
  /** Base card value now per card key (for the bonus) */
  values: Record<string, number>;
  onOpenCard: (info: CardInfo) => void;
}

const KINDS: { key: SetKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hof', label: 'Hall of Fame' },
  { key: 'champion', label: 'Champions' },
  { key: 'club', label: 'Club rosters' },
];
const PAGE = 9;

/**
 * Set bonuses: every club's active roster, every Super Bowl champion of the coach's and every Hall of Fame class.
 * Ready-to-claim sets first, then the closest to done. Owning every member's card (any art or finish) unlocks the
 * one-time bonus (coins plus a pack); the cards stay in the binder.
 */
const Sets = ({ sets, state, byKey, values, onOpenCard }: SetsProps) => {
  const [kind, setKind] = useState<SetKind | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const claimed = useMemo(() => new Set(state.setsClaimed ?? []), [state.setsClaimed]);
  // The bonus is priced from the market: no claim until it has loaded
  const pricesReady = Object.keys(values).length > 0;
  const rows = useMemo(
    () =>
      sets
        .filter((s) => kind === 'all' || s.kind === kind)
        .map((s) => ({ s, p: setProgress(s, state.cards), r: setReward(s, values), claimed: claimed.has(s.id) }))
        .sort((a, b) => {
          const ra = a.p.done && !a.claimed ? 0 : a.claimed ? 2 : 1;
          const rb = b.p.done && !b.claimed ? 0 : b.claimed ? 2 : 1;
          return ra - rb || b.p.have / b.p.total - a.p.have / a.p.total || a.p.total - b.p.total;
        }),
    [sets, kind, state.cards, values, claimed],
  );
  const ready = rows.filter((x) => x.p.done && !x.claimed).length;
  const doneCount = sets.filter((s) => claimed.has(s.id)).length;

  const claim = (s: CollectionSet, r: ReturnType<typeof setReward>) => {
    if (claimSet(s, r)) toast.success(`Set bonus: ${s.title}`, { description: `+${fmtCoins(r.coins)} coins and a ${PACKS[r.pack].label}.` });
    else toast('That set is not complete yet.');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="ec-filters" role="group" aria-label="Set type">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={cn('cd-chip', kind === k.key && 'is-on')}
              style={{ ['--cd-tier' as string]: 'hsl(var(--gold))' }}
              aria-pressed={kind === k.key}
              onClick={() => {
                setKind(k.key);
                setLimit(PAGE);
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {doneCount} of {sets.length} claimed{ready ? ` · ${ready} ready` : ''}
        </p>
      </div>
      <ul className="ec-sets" aria-label="Sets">
        {rows.slice(0, limit).map(({ s, p, r, claimed: was }) => {
          const team = s.team ? findNFLTeam(s.team) : null;
          const isOpen = open === s.id;
          return (
            <li
              key={s.id}
              className={cn('ec-set', p.done && !was && 'is-ready', was && 'is-claimed')}
              style={team ? ({ ['--t1' as string]: team.primaryColor, ['--t2' as string]: team.secondaryColor } as React.CSSProperties) : undefined}
            >
              {team && (
                <span className="ec-set__logo" aria-hidden="true">
                  <TeamLogo team={team} size={96} decorative />
                </span>
              )}
              <p className="ec-kicker flex items-center gap-1.5">
                {s.kind === 'hof' && <Trophy className="h-3 w-3 text-gold" aria-hidden="true" />}
                {s.sub}
              </p>
              <h3 className="ec-set__title mt-1">{s.title}</h3>
              <div className="mt-2 flex items-center gap-2">
                <span className="ec-bar flex-1" role="progressbar" aria-label={`${s.title}: ${p.have} of ${p.total} cards`} aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.have}>
                  <i style={{ width: `${(p.have / Math.max(1, p.total)) * 100}%` }} />
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {p.have}/{p.total}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="ec-reward">
                  <span className="ec-coin ec-coin--sm" aria-hidden="true" />+{pricesReady ? fmtCoins(r.coins) : '…'}
                </span>
                <span className="ec-reward">+ {PACKS[r.pack].label.replace(/ Pack$/, '')} pack</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {was ? (
                  <span className="ec-stamp">Claimed</span>
                ) : p.done ? (
                  <button type="button" className="ec-btn ec-btn--gold ec-btn--sm" onClick={() => claim(s, r)} disabled={!pricesReady}>
                    {pricesReady ? 'Claim bonus' : 'Loading prices…'}
                  </button>
                ) : null}
                <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                  {isOpen ? 'Hide players' : p.done ? 'Players' : `${p.total - p.have} missing`}
                </button>
              </div>
              {isOpen && (
                <ul className="ec-members" aria-label={`${s.title} players`}>
                  {[...s.members]
                    .sort((a, b) => Number(!!state.cards[a]) - Number(!!state.cards[b]))
                    .map((k) => {
                      const info = byKey.get(k);
                      const have = !!state.cards[k];
                      return (
                        <li key={k}>
                          {have && info ? (
                            <button type="button" className="ec-member is-owned" onClick={() => onOpenCard(info)}>
                              <i aria-hidden="true" />
                              {info.player.name}
                            </button>
                          ) : (
                            <span className="ec-member" title="Not in your binder yet">
                              <i aria-hidden="true" />
                              {info?.player.name ?? k.slice(k.indexOf(':') + 1)}
                              <span className="sr-only"> (missing)</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > limit && (
        <div className="mt-3 flex justify-center">
          <button type="button" className="ec-btn ec-btn--ghost ec-btn--sm" onClick={() => setLimit((l) => l + PAGE * 2)}>
            Show more sets ({rows.length - limit})
          </button>
        </div>
      )}
    </div>
  );
};

export default Sets;
