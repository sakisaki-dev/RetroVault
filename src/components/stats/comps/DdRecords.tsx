import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { isDefensivePosition } from '@/config/stats';
import { AWARD_META } from '@/utils/playerMeta';
import { cardKey, finishLabel, tierFor, tierLabel, useCollection } from '@/utils/collection';
import { fmtNum } from '../analytics/viz';
import type { RecordBook } from '../records';

const RANK_LABEL = ['Record', '2nd', '3rd', '4th', '5th'];

/** Records held and top-5 ranks, the trophy shelf, and his collection card. */
const DdRecords = ({ player, book, ovr }: { player: Player; book: RecordBook; ovr: number | undefined }) => {
  const { cards } = useCollection();
  const ranks = [...book.boards.values()]
    .map((b) => ({ b, i: b.entries.findIndex((e) => e.player.name === player.name && e.player.position === player.position) }))
    .filter(({ i }) => i >= 0 && i < 5)
    .sort((x, y) => x.i - y.i || x.b.title.localeCompare(y.b.title));
  const pace = book.pace.filter((p) => p.player.name === player.name && p.player.position === player.position);
  const awards = AWARD_META[isDefensivePosition(player.position) ? 'defense' : 'offense'];
  const owned = cards[cardKey(player)];
  const tier = tierFor(player, ovr);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="glass-card space-y-2 p-3 sm:p-4">
        <h3 className="font-display text-base font-bold uppercase tracking-wide">Record book</h3>
        {ranks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No top-5 spots on the league&rsquo;s record boards yet.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {ranks.map(({ b, i }) => (
              <li key={b.id} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5', i === 0 ? 'border-gold/60 bg-gold/10' : 'border-line bg-panel')}>
                <span className={cn('w-14 shrink-0 font-pixel text-[9px] uppercase', i === 0 ? 'text-gold' : 'text-muted-foreground')}>{RANK_LABEL[i]}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={b.minLabel ? `${b.title} (${b.minLabel})` : b.title}>
                  {b.title}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-chalk">{fmtNum(b.entries[i].value, b.decimals)}</span>
              </li>
            ))}
          </ul>
        )}
        {pace.length > 0 && (
          <ul className="space-y-1 border-t border-line/70 pt-2 text-xs text-muted-foreground">
            {pace.map((p) => (
              <li key={p.recordName}>
                On pace for <b className="text-foreground">{p.recordName}</b>: {Math.round(p.percentToRecord)}% of {p.recordHolder.name}&rsquo;s {fmtNum(p.recordValue, 0)}, ~
                {fmtNum(p.seasonsToBreak, 1)} seasons away.
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="glass-card space-y-2 p-3 sm:p-4">
          <h3 className="font-display text-base font-bold uppercase tracking-wide">Trophy shelf</h3>
          <ul className="grid grid-cols-5 gap-1.5">
            {awards.map((a) => {
              const n = (player as unknown as Record<string, number>)[a.key] ?? 0;
              return (
                <li
                  key={a.key}
                  className={cn('flex flex-col items-center gap-1 rounded-lg border p-2 text-center', n > 0 ? 'border-line bg-panel' : 'border-line/50 opacity-40')}
                  title={`${a.long}: ${n}`}
                >
                  <a.Icon className="h-6 w-6" style={{ color: n > 0 ? `hsl(${a.hsl})` : undefined }} aria-hidden="true" />
                  <span className="font-display text-xl font-extrabold leading-none">{n}</span>
                  <span className="font-pixel text-[7px] uppercase text-muted-foreground">{a.label}</span>
                  <span className="sr-only">{a.long}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="glass-card flex items-center justify-between gap-2 p-3 sm:p-4">
          <div>
            <h3 className="font-display text-base font-bold uppercase tracking-wide">Your collection</h3>
            <p className="text-sm text-muted-foreground">{owned ? `Owned · best finish ${finishLabel(owned.best)}` : 'Not pulled yet'}</p>
          </div>
          <span className="lamp">
            Rarity <b>{tierLabel(tier)}</b>
          </span>
        </div>
      </div>
    </div>
  );
};

export default DdRecords;
