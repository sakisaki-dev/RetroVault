import type { CSSProperties } from 'react';
import { History, IdCard, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import type { FamilyTie, PlayerCardExtras, RealNflCareer } from '@/utils/playerExtras';
import type { Player } from '@/types/player';

// Secondary info from player-extras.json; never merged into career totals.

const EXTRA_LABELS: Record<string, string> = {
  games: 'GP', att: 'ATT', cmp: 'CMP', pass_yds: 'PASS YDS', pass_td: 'PASS TD', int: 'INT',
  rush_att: 'CAR', rush_yds: 'RUSH YDS', rush_td: 'RUSH TD', rec: 'REC', yds: 'YDS', td: 'TD',
  rec_yds: 'REC YDS', rec_td: 'REC TD', fum: 'FUM', fumbles: 'FUM', ret_yds: 'RET YDS', ret_td: 'RET TD',
  ret_long: 'RET LNG', tackles: 'TKL', sacks: 'SACK', forced_fumbles: 'FF', pass_long: 'PASS LNG',
  rush_long: 'RUSH LNG', long_run: 'LONG RUN', rec_long: 'REC LNG', rush_fum: 'RUSH FUM', sacks_taken: 'SACKED',
  xp_level: 'XP LVL',
};

const EXTRA_TITLES: Record<string, string> = {
  games: 'Games played', att: 'Pass attempts', cmp: 'Completions', pass_yds: 'Passing yards', pass_td: 'Passing touchdowns',
  int: 'Interceptions', rush_att: 'Carries', rush_yds: 'Rushing yards', rush_td: 'Rushing touchdowns', rec: 'Receptions',
  yds: 'Receiving yards', td: 'Receiving touchdowns', rec_yds: 'Receiving yards', rec_td: 'Receiving touchdowns',
  fum: 'Fumbles', fumbles: 'Fumbles', ret_yds: 'Return yards', ret_td: 'Return touchdowns', ret_long: 'Longest return',
  tackles: 'Tackles', sacks: 'Sacks', forced_fumbles: 'Forced fumbles', pass_long: 'Longest pass', rush_long: 'Longest run',
  long_run: 'Longest run', rec_long: 'Longest reception', rush_fum: 'Rushing fumbles', sacks_taken: 'Times sacked',
  xp_level: 'Experience level',
};

const humanize = (k: string) => k.replace(/_/g, ' ').toUpperCase();
const extraLabel = (k: string) => EXTRA_LABELS[k] ?? humanize(k);
const extraTitle = (k: string) => EXTRA_TITLES[k] ?? k.replace(/_/g, ' ');

/** Text card fields shown as label/value rows rather than numbers. */
const CARD_TEXT_FIELDS: { key: string; label: string }[] = [
  { key: 'age', label: 'Age' },
  { key: 'team', label: 'Card team' },
  { key: 'former_team', label: 'Former team' },
  { key: 'legacy_team', label: 'Legacy team' },
  { key: 'retired_team', label: 'Retired with' },
  { key: 'contract', label: 'Contract' },
  { key: 'trade_value', label: 'Trade value' },
  { key: 'weakest_attribute', label: 'Weakest attribute' },
];
const CARD_SKIP = new Set(['rating', 'potential', 'hof_flag', 'hof_ingame', 'note', ...CARD_TEXT_FIELDS.map((f) => f.key)]);

const balancedCols = (n: number, max: number) => (n <= max ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / max)));

const ExtraNumbers = ({ entries, label }: { entries: [string, number][]; label: string }) => (
  <dl
    className="pc-statgrid"
    style={{ '--cols': balancedCols(entries.length, 6), '--cols-sm': balancedCols(entries.length, 3) } as CSSProperties}
    aria-label={label}
  >
    {entries.map(([k, v]) => (
      <div key={k} className="flex flex-col-reverse px-2 py-1.5 text-center" title={extraTitle(k)}>
        <dt className="mt-0.5 font-pixel text-[8px] uppercase text-muted-foreground">
          <span aria-hidden="true">{extraLabel(k)}</span>
          <span className="sr-only">{extraTitle(k)}</span>
        </dt>
        <dd className="font-mono text-sm font-semibold tabular-nums text-secondary-foreground">{formatDecimal(v, Number.isInteger(v) ? 0 : 1)}</dd>
      </div>
    ))}
  </dl>
);

/** "5 stars" / "4.5" -> star row with the text for assistive tech. */
const StarRating = ({ value }: { value: string | number }) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return <span>{String(value)}</span>;
  const full = Math.floor(n);
  const half = n - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5 text-gold">
      {Array.from({ length: full }, (_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
      ))}
      {half && <Star className="h-3.5 w-3.5 fill-current opacity-50" aria-hidden="true" />}
      <span className="sr-only">{n} out of 5 stars</span>
    </span>
  );
};

const numericEntries = (rec: Record<string, unknown>, skip: Set<string> = new Set()) =>
  Object.entries(rec).filter((e): e is [string, number] => !skip.has(e[0]) && typeof e[1] === 'number' && Number.isFinite(e[1]));

export const RealCareerPanel = ({ career }: { career: RealNflCareer }) => (
  <section className="pc-panel p-3" aria-label="Real NFL career before the league">
    <h4 className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <History className="h-3.5 w-3.5 text-[color:var(--tc-accent)]" aria-hidden="true" />
      Before the league · real NFL career
      {career.years && <span className="lamp ml-auto">{String(career.years)}</span>}
    </h4>
    <ExtraNumbers entries={numericEntries(career, new Set(['years']))} label="Real NFL career totals" />
    <p className="mt-2 text-[11px] text-muted-foreground">Shown for context only; not included in league career totals.</p>
  </section>
);

export const PlayerCardPanel = ({ card }: { card: PlayerCardExtras }) => {
  const texts = CARD_TEXT_FIELDS.filter((f) => card[f.key] != null && card[f.key] !== '');
  const nums = numericEntries(card, CARD_SKIP);
  const note = typeof card.note === 'string' ? card.note : null;
  return (
    <section className="pc-panel p-3" aria-label="Player card">
      <h4 className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <IdCard className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        Player card
        {card.hof_flag === true && <span className="lamp ml-auto">HOF track</span>}
      </h4>
      {(card.rating != null || card.potential != null) && (
        <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {card.rating != null && (
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Rating</dt>
              <dd>
                <StarRating value={card.rating as string | number} />
              </dd>
            </div>
          )}
          {card.potential != null && (
            <div className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">Potential</dt>
              <dd>
                <StarRating value={card.potential as string | number} />
              </dd>
            </div>
          )}
        </dl>
      )}
      {texts.length > 0 && (
        <dl className="mb-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {texts.map((f) => (
            <div key={f.key} className="flex justify-between gap-2 border-b border-border/30 py-0.5">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-medium text-secondary-foreground first-letter:uppercase">{String(card[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="mb-2 border-l-2 border-[color:var(--tc-accent)] pl-2 text-xs italic text-secondary-foreground">{note}</p>}
      {nums.length > 0 && <ExtraNumbers entries={nums} label="Card stats" />}
    </section>
  );
};

export const FamilyChips = ({
  ties,
  findByName,
  onSelect,
}: {
  ties: FamilyTie[];
  findByName: (name: string) => Player | null;
  onSelect: (p: Player) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1.5 text-xs">
    <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    <span className="sr-only">Family:</span>
    {ties.map((tie) => {
      const target = findByName(tie.name);
      const text = (
        <>
          <span className="text-muted-foreground">{tie.label}</span> <span className="font-semibold">{tie.name}</span>
        </>
      );
      return target ? (
        <button
          key={`${tie.label}:${tie.name}`}
          type="button"
          onClick={() => onSelect(target)}
          className={cn(
            'rounded-full border border-line bg-panel-2 px-2.5 py-1 hover:border-[color:var(--tc-accent)] hover:text-[color:var(--tc-accent)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tc-accent)]',
          )}
        >
          {text}
        </button>
      ) : (
        <span key={`${tie.label}:${tie.name}`} className="rounded-full border border-line/60 px-2.5 py-1">
          {text}
        </span>
      );
    })}
  </div>
);
