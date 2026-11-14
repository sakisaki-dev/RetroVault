import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Star, StarHalf } from 'lucide-react';
import GameSprite from '@/components/GameSprite';
import ClubStrip from '@/components/brand/ClubStrip';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { useGameSprites } from '@/utils/gameSprites';
import { usePhone } from '@/hooks/usePhone';
import type { CapRow, OfficeState } from '@/utils/clubOffice';
import { Desk, Lamp, PickToken } from './board';

/** Half-stars (1 to 10) as five stars. */
export const Stars = ({ half, className }: { half: number; className?: string }) => {
  const full = Math.floor(half / 2);
  const hasHalf = half % 2 === 1;
  return (
    <span className={cn('fo-stars', className)} role="img" aria-label={`${half / 2} stars`}>
      {Array.from({ length: 5 }, (_, i) =>
        i < full ? (
          <Star key={i} className="fo-stars__on" aria-hidden="true" />
        ) : i === full && hasHalf ? (
          <span key={i} className="fo-stars__half" aria-hidden="true">
            <Star className="fo-stars__off" />
            <StarHalf className="fo-stars__on" />
          </span>
        ) : (
          <Star key={i} className="fo-stars__off" aria-hidden="true" />
        ),
      )}
    </span>
  );
};

type SortKey = 'salary' | 'stars' | 'age' | 'contract' | 'gap' | 'pos';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'salary', label: 'Salary' },
  { key: 'gap', label: 'Value' },
  { key: 'stars', label: 'Stars' },
  { key: 'age', label: 'Age' },
  { key: 'contract', label: 'Contract' },
  { key: 'pos', label: 'Position' },
];
const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'DB'];
const sortValue = (r: CapRow, k: SortKey): number => {
  switch (k) {
    case 'salary':
      return r.p.salary;
    case 'stars':
      return r.stars * 100 + r.ceiling;
    case 'age':
      return r.p.age;
    case 'contract':
      return r.p.contract;
    case 'gap':
      return r.pay.gap;
    case 'pos':
      return POS_ORDER.indexOf(r.spos);
  }
};
/** First click on a column sorts its natural way: highest salary, best stars, most underpaid, then youngest… */
const DEFAULT_DESC: Record<SortKey, boolean> = { salary: true, stars: true, age: false, contract: true, gap: false, pos: false };

const PAY_LABEL = { underpaid: 'Underpaid', fair: 'Fair deal', overpaid: 'Overpaid' } as const;

interface CapSheetProps {
  state: OfficeState;
  rows: CapRow[];
  playerFor: (r: CapRow) => Player | undefined;
  onPlayerSelect: (p: Player) => void;
}

/** A player's head and shoulders: his game sprite, or his position on a club-colour plate when this machine has none. */
const Bust = ({ player, r, team, size }: { player?: Player; r: CapRow; team: string; size: 's' | 'm' }) => {
  const sprites = useGameSprites();
  return sprites && player ? (
    <GameSprite player={player} team={team} kind="bust" size={size} />
  ) : (
    <span className={cn('fo-bust-fallback', size === 'm' && 'is-m')}>{r.spos}</span>
  );
};

const CapSheet = ({ state, rows, playerFor, onPlayerSelect }: CapSheetProps) => {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'salary', desc: true });
  const phone = usePhone();
  const cap = state.settings.salary_cap;
  const base = state.settings.salary_cap_base;
  const payroll = rows.reduce((a, r) => a + r.p.salary, 0);
  const room = cap - payroll;
  const priced = rows.reduce((a, r) => a + r.price, 0);

  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => dir * (sortValue(a, sort.key) - sortValue(b, sort.key)) || b.p.salary - a.p.salary || a.name.localeCompare(b.name));
  }, [rows, sort]);
  const bySalary = useMemo(() => [...rows].sort((a, b) => b.p.salary - a.p.salary), [rows]);

  const pick = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: DEFAULT_DESC[key] }));
  const SortIcon = sort.desc ? ArrowDown : ArrowUp;
  const head = (key: SortKey, label: string) => (
    <button type="button" onClick={() => pick(key)} className={cn('fo-cap__th', sort.key === key && 'is-on')} aria-label={`Sort by ${label}`}>
      {label}
      {sort.key === key && <SortIcon className="h-3 w-3" aria-hidden="true" />}
    </button>
  );
  const allFirst = rows.every((r) => r.trade === rows[0]?.trade);

  return (
    <Desk
      team={state.club}
      id="fo-capsheet"
      title="Cap sheet"
      chip={
        <Lamp>
          <b>{payroll}</b>/{cap}
        </Lamp>
      }
      caption={
        <>
          <span className={cn('font-semibold', room >= 0 ? 'text-accent' : 'text-flag')}>{room >= 0 ? `${room} room` : `${-room} over`}</span>
          {base != null && base !== cap && ` · cap ${base} base + ${cap - base} boost`} · the game&apos;s formula prices this roster at {priced}
          {priced !== payroll && ` (${priced > payroll ? `${priced - payroll} more` : `${payroll - priced} less`} than paid)`}
      <details className="fo-howto fo-howto--inline">
        <summary className="link-chip text-xs text-sky">How the tags work</summary>
        <ul className="fo-fine mt-2 list-disc space-y-1 pl-4">
          <li>
            <b className="text-foreground">Stars</b> are the game&apos;s own: round(10 × (speed + strength + skill + stamina) ÷ the position&apos;s total), in half stars
            (QB 37, RB 34, WR 34, TE 33, OL 35, DL 35, LB 33, CB 33, S 33). The arrow is his ceiling, from the rating caps.
          </li>
          <li>
            <b className="text-foreground">Fair salary</b> is the game&apos;s salary formula: stars × position pay (QB 1.66, WR 1.1, RB and DL 1.0, TE and LB 0.9, OL and
            CB 0.8, S 0.75) × 3 × an age factor (0.6 at 21; 0.85, 0.75, 0.65, 0.55 with under 5, 4, 3, 2 years to his max age). Salaries are fixed at signing;
            within max(1, 10% of the price) is a fair deal.
          </li>
          <li>
            <b className="text-foreground">Pick</b> is his trade value: the pick the game offers when the coach trades him away, a 1st at 4 stars or more, a 2nd at 2
            to 3.5, else a 3rd{allFirst ? ' (every key player here fetches a 1st)' : ''}. The game warns before trading a player signed this season.
          </li>
          <li>
            <b className="text-foreground">Deal</b>: years left as the save stores them; nobody plays at his max age (35, QB 40, plus delays). An expiring deal re-prices with
            the same formula a year older: 1 year within 3 of his max age, else 2 to 3.
          </li>
        </ul>
      </details>
        </>
      }
    >
      {/* The payroll as a shelf: each player stands on his salary, width = salary, the room hatched */}
      <div className="fo-payroll-wrap">
        <ol className="fo-payroll" aria-label={`Payroll ${payroll} of a ${cap} cap`} style={{ minWidth: phone ? `${Math.max(rows.length * 56 + 40, 320)}px` : undefined }}>
          {bySalary.map((r) => {
            const player = playerFor(r);
            return (
              <li key={r.key} style={{ flexGrow: r.p.salary }} title={`${r.name}, ${r.spos}: ${r.p.salary}`}>
                <button type="button" className="fo-payroll__who" onClick={() => player && onPlayerSelect(player)} disabled={!player} aria-label={`${r.name}, salary ${r.p.salary}. Open player card`}>
                  <span className="fo-payroll__bust">
                    <Bust player={player} r={r} team={state.club} size={phone ? 's' : 'm'} />
                  </span>
                  <span className="fo-payroll__plate">
                    <b>{r.p.salary}</b>
                    <i>{r.name.split(' ').slice(-1)[0].replace(/^(II|III|Jr\.?)$/, r.name.split(' ').slice(-2, -1)[0])}</i>
                  </span>
                </button>
              </li>
            );
          })}
          {room > 0 && (
            <li className="fo-payroll__room" style={{ flexGrow: room }} title={`${room} room under the cap`}>
              <span className="fo-payroll__plate">
                <b>{room}</b>
                <i>Room</i>
              </span>
            </li>
          )}
        </ol>
      </div>

      {/* Sort chips on phones; the table head sorts on wider screens */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none md:hidden" role="group" aria-label="Sort the cap sheet">
        {SORTS.map((s) => (
          <button key={s.key} type="button" onClick={() => pick(s.key)} className={cn('fo-sortchip', sort.key === s.key && 'is-on')} aria-pressed={sort.key === s.key}>
            {s.label}
            {sort.key === s.key && <SortIcon className="h-3 w-3" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="fo-cap" role="table" aria-label={`${state.club} cap sheet`}>
        <div className="fo-cap__head" role="row">
          <span role="columnheader">{head('pos', 'Player')}</span>
          <span role="columnheader">{head('age', 'Age')}</span>
          <span role="columnheader">{head('stars', 'Stars')}</span>
          <span role="columnheader">{head('salary', 'Salary')}</span>
          <span role="columnheader">{head('contract', 'Deal')}</span>
          <span role="columnheader">{head('gap', 'Fair salary')}</span>
          <span role="columnheader" className="fo-cap__th" title="The pick the game offers if he is traded away">
            Pick
          </span>
        </div>
        {sorted.map((r) => {
          const player = playerFor(r);
          const grow = r.ceiling - r.stars;
          return (
            <div key={r.key} className="fo-cap__row" role="row">
              <div role="cell" className="fo-cap__who">
                <span className="fo-cap__face" aria-hidden="true">
                  <Bust player={player} r={r} team={state.club} size="s" />
                </span>
                <div className="min-w-0">
                  <ClubStrip
                    team={state.club}
                    label={r.name}
                    size="sm"
                    onClick={player ? () => onPlayerSelect(player) : undefined}
                    ariaLabel={`${r.name}, ${r.spos}. Open player card`}
                    className="fo-cap__strip"
                  />
                  <p className="fo-cap__meta">
                    <b>{r.spos}</b>
                    {r.p.signed_year != null && <span title="The season the coach last signed, re-signed or traded for him (a re-signing resets it)">Signed Y{r.p.signed_year}</span>}
                    <span className="md:hidden">
                      {r.p.age} · {r.finalSeason === state.season ? 'final season' : `thru Y${r.finalSeason}`}
                    </span>
                  </p>
                </div>
                <span className="fo-cap__pick md:hidden">
                  <PickToken round={r.trade} title={`Trade value: a ${r.trade === 1 ? '1st' : r.trade === 2 ? '2nd' : '3rd'}-round pick`} />
                </span>
              </div>
              <div role="cell" className="fo-cap__cell fo-cap__age">
                <span className="tabular-nums">{r.p.age}</span>
                <span className="fo-cap__sub">{r.finalSeason === state.season ? 'Final season' : `Thru Y${r.finalSeason}`}</span>
              </div>
              <div role="cell" className="fo-cap__cell" data-label="Stars">
                <span className="flex items-center gap-1" title={grow > 0 ? `Ceiling ${r.ceiling / 2} stars` : 'At his ceiling'}>
                  <Stars half={r.stars} />
                  {grow > 0 && <span className="font-pixel text-[9px] text-sky">→{r.ceiling / 2}</span>}
                </span>
              </div>
              <div role="cell" className="fo-cap__cell" data-label="Salary">
                <span className="fo-cap__salary">{r.p.salary}</span>
                <span className="fo-cap__sub">{Math.round((r.p.salary / cap) * 100)}% of cap</span>
              </div>
              <div role="cell" className="fo-cap__cell" data-label="Deal">
                <span className="tabular-nums">{r.p.contract} yr{r.p.contract === 1 ? '' : 's'}</span>
                <span className="fo-cap__sub" title="Years left as the save stores them (likely)">
                  {r.nextPrice != null ? `Re-prices at ${r.nextPrice}` : 'Likely'}
                </span>
              </div>
              <div role="cell" className="fo-cap__cell" data-label="Fair">
                <span className={cn('fo-tag', `fo-tag--${r.pay.tag}`)}>
                  {PAY_LABEL[r.pay.tag]}
                  {r.pay.gap !== 0 && <b className="tabular-nums">{r.pay.gap > 0 ? `+${r.pay.gap}` : r.pay.gap}</b>}
                </span>
                <span className="fo-cap__sub">Price {r.price}</span>
              </div>
              <div role="cell" className="fo-cap__cell fo-cap__pickcell">
                <PickToken round={r.trade} title={`Trade value: a ${r.trade === 1 ? '1st' : r.trade === 2 ? '2nd' : '3rd'}-round pick${r.signedNow ? ' (signed this season: the game warns before trading him)' : ''}`} />
              </div>
            </div>
          );
        })}
      </div>

    </Desk>
  );
};

export default CapSheet;
