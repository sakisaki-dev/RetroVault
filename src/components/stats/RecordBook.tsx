import { useState } from 'react';
import { Crown, Gauge } from 'lucide-react';
import { efficiencyTakeaway, recordsTakeaway } from './takeaways';
import SectionIntro from './SectionIntro';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import FitName from './FitName';
import TeamLogo from '../brand/TeamLogo';
import CountUp from '../brand/CountUp';
import { GROUP_META, type PaceEntry, type RecordBoardData } from './records';
import { GRID_ITEM, gridVars } from './grid';
import MarginStrip from './visual/MarginStrip';
import { marginText } from './visual/chartKit';
import ChaseChart from './visual/ChaseChart';
import { getTeamTextColor } from '@/utils/teamColors';
import { matchPlayerByName } from '@/utils/leagueContent';
import { CLUB_RECORD_FOR, SEASON_GROUP, entryName, useClubRecords, type ClubRecordRow } from './clubRecords';

const fmt = (v: number, decimals: number) => formatDecimal(v, decimals);

type Select = (p: Player) => void;

// ---------- Compact record strip (top of the page) ----------

/** The club's own mark for this record (the in-game board, Skura's club only): beaten league-wide, or still the best. */
const ClubLine = ({ row }: { row?: ClubRecordRow }) => {
  if (!row || !row.league) return null;
  const who = entryName({ name: row.club.name, player: row.club.holder });
  const best = !row.broken;
  return (
    <span className="flex min-w-0 items-center gap-1.5 border-t border-line/60 pt-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
      <span className={cn('shrink-0 rounded px-1 font-pixel text-[7px] uppercase', best ? 'bg-gold/15 text-gold' : 'bg-flag/20 text-flag')}>
        {best ? 'Club best' : 'Club'}
      </span>
      <span className="truncate">
        {best ? `${who} ${row.club.year}` : `${row.club.mark} · ${who} ${row.club.year}`}
      </span>
    </span>
  );
};

const inkOf = (team?: string | null) => getTeamTextColor(team) ?? undefined;

const RecordChip = ({ data, index, onSelect, club }: { data: RecordBoardData; index: number; onSelect: Select; club?: ClubRecordRow }) => {
  const top = data.entries[0];
  const second = data.entries[1];
  const margin = marginText(data);
  const hsl = GROUP_META[data.group].hsl;
  return (
    <li className={cn(GRID_ITEM, 'stagger-in')} style={{ ['--i' as string]: index }}>
      <button
        type="button"
        onClick={() => onSelect(top.player)}
        aria-label={`${data.title} record: ${fmt(top.value, data.decimals)} by ${top.player.name}${margin ? `, ${margin}${second ? ` (${second.player.name})` : ''}` : ''}. Open player`}
        className="hover-lift flex h-full w-full flex-col gap-1 rounded-lg border border-line bg-panel px-3 py-2.5 text-left"
        style={{ boxShadow: `inset 0 2px 0 hsl(${hsl})` }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-xs font-bold uppercase tracking-wider" style={{ color: `hsl(${hsl})` }}>
            {data.title}
          </span>
          <Crown className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
        </span>
        <CountUp value={top.value} decimals={data.decimals} className="font-display text-2xl font-extrabold leading-none text-chalk sm:text-3xl" />
        <span className="flex min-w-0 items-center gap-1.5">
          {top.player.team && <TeamLogo team={top.player.team} size={16} decorative backed />}
          <span className="line-clamp-2 text-xs font-semibold leading-tight" style={{ color: inkOf(top.player.team) ?? 'hsl(var(--secondary-foreground))' }}>
            {top.player.name}
          </span>
        </span>
        {margin && (
          <span className="mt-auto block space-y-0.5 pt-1">
            <MarginStrip board={data} />
            <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">{margin}</span>
          </span>
        )}
        <ClubLine row={club} />
      </button>
    </li>
  );
};

/** A single-season record (from the record board file) in the same chip as the career records. */
const SeasonChip = ({ row, index, players, onSelect }: { row: ClubRecordRow; index: number; players: Player[]; onSelect: Select }) => {
  const L = row.league!;
  const top = L.top[0];
  const next = L.top.find((e, i) => i > 0);
  const hsl = GROUP_META[SEASON_GROUP(row.record)].hsl;
  const name = entryName(top);
  const player = matchPlayerByName(name, players);
  const gap = next ? L.value - next.value : 0;
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-display text-xs font-bold uppercase tracking-wider" style={{ color: `hsl(${hsl})` }}>
          {row.short}
        </span>
        <Crown className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
      </span>
      <CountUp value={L.value} decimals={0} className="font-display text-2xl font-extrabold leading-none text-chalk sm:text-3xl" />
      <span className="flex min-w-0 items-center gap-1.5">
        {top.team && <TeamLogo team={top.team} size={16} decorative backed />}
        <span className="line-clamp-2 text-xs font-semibold leading-tight" style={{ color: inkOf(top.team) ?? 'hsl(var(--secondary-foreground))' }}>
          {name}
        </span>
        {top.season && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{top.season}</span>}
      </span>
      {next && (
        <span className="mt-auto block pt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
          {gap > 0 ? `+${gap.toLocaleString()} over #2` : 'Tied for the lead'} ({entryName(next)}
          {next.season ? ` ${next.season}` : ''})
        </span>
      )}
      <ClubLine row={row} />
    </>
  );
  const cls = 'hover-lift flex h-full w-full flex-col gap-1 rounded-lg border border-line bg-panel px-3 py-2.5 text-left';
  return (
    <li className={cn(GRID_ITEM, 'stagger-in')} style={{ ['--i' as string]: index }}>
      {player ? (
        <button type="button" onClick={() => onSelect(player)} aria-label={`${row.record}: ${L.mark} by ${name}. Open player`} className={cls} style={{ boxShadow: `inset 0 2px 0 hsl(${hsl})` }}>
          {body}
        </button>
      ) : (
        <div className={cls} style={{ boxShadow: `inset 0 2px 0 hsl(${hsl})` }}>
          {body}
        </div>
      )}
    </li>
  );
};

/** The headline records: career (the league's best career card, with the club's own mark under it) or season. */
export const RecordStrip = ({ headline, players, onSelect }: { headline: RecordBoardData[]; players: Player[]; onSelect: Select }) => {
  const [scope, setScope] = useState<'career' | 'season'>('career');
  const clubFile = useClubRecords();
  const rows = clubFile?.records ?? [];
  const byRecord = new Map(rows.map((r) => [r.record, r]));
  const seasons = rows.filter((r) => r.scope === 'season' && r.league);
  const beaten = rows.filter((r) => r.league && r.broken).length;
  const tracked = rows.filter((r) => r.league).length;
  const chip = (on: boolean) =>
    cn('rounded-full border px-3 py-1 font-display text-xs font-bold uppercase tracking-wide', on ? 'border-gold bg-gold text-night' : 'border-line bg-night/60 text-secondary-foreground');
  return (
    <section id="record-book" aria-labelledby="record-book-title" className="scroll-mt-20 space-y-3">
      <h2 id="record-book-title" className="section-title text-2xl">
        <Crown className="h-5 w-5 text-gold" aria-hidden="true" />
        Record Book
      </h2>
      <SectionIntro
        id="record-book"
        takeaway={
          scope === 'career' || !tracked
            ? recordsTakeaway(headline)
            : `${beaten} of ${tracked} club records have been beaten somewhere in the league.`
        }
      >
        The league&apos;s best career and single-season marks. Under each, the club line is the game&apos;s own record board, which only counts
        games played for Skura&apos;s club: gold when it is still the best anywhere, red when someone in the league has beaten it. Career strips run
        from #5 to the record. Seasons cover every season since {clubFile?.seasonsFrom ?? 'the first snapshot'} for the players tracked then.
      </SectionIntro>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Career or season records">
        <button type="button" className={chip(scope === 'career')} aria-pressed={scope === 'career'} onClick={() => setScope('career')}>
          Career
        </button>
        {seasons.length > 0 && (
          <button type="button" className={chip(scope === 'season')} aria-pressed={scope === 'season'} onClick={() => setScope('season')}>
            Season
          </button>
        )}
      </div>
      {scope === 'career' ? (
        <ul className="flex flex-wrap gap-2 sm:gap-3" style={gridVars(headline.length, { base: 2, sm: 3, lg: 5, xl: 9 })}>
          {headline.map((b, i) => (
            <RecordChip key={b.id} data={b} index={i} onSelect={onSelect} club={CLUB_RECORD_FOR[b.id] ? byRecord.get(CLUB_RECORD_FOR[b.id]) : undefined} />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-wrap gap-2 sm:gap-3" style={gridVars(seasons.length, { base: 2, sm: 3, lg: 5 })}>
          {seasons.map((r, i) => (
            <SeasonChip key={r.record} row={r} index={i} players={players} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  );
};

// ---------- Efficiency leader tile ----------

const LeaderTile = ({ data, onSelect }: { data: RecordBoardData; onSelect: Select }) => {
  const top = data.entries[0];
  const margin = marginText(data);
  const hsl = GROUP_META[data.group].hsl;
  return (
    <li className={GRID_ITEM}>
      <button
        type="button"
        onClick={() => onSelect(top.player)}
        aria-label={`${data.title}: ${top.player.name}, ${fmt(top.value, data.decimals)}${data.minLabel ? ` (${data.minLabel})` : ''}${margin ? `, ${margin}` : ''}. Open player`}
        className="hover-lift relative flex h-full w-full flex-col gap-1 overflow-hidden rounded-lg border border-line bg-panel p-3 text-left"
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: `hsl(${hsl})` }} />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{data.title}</span>
        <span className="font-display text-3xl font-extrabold leading-none tabular-nums" style={{ color: `hsl(${hsl})` }}>
          {fmt(top.value, data.decimals)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {top.player.team && <TeamLogo team={top.player.team} size={18} decorative backed />}
          <span className="truncate text-sm font-semibold text-foreground"><FitName name={top.player.name} /></span>
        </span>
        {margin && (
          <span className="mt-auto block space-y-0.5 pt-1.5">
            <MarginStrip board={data} />
            <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">{margin}</span>
          </span>
        )}
        {data.minLabel && <span className={cn('pt-1 font-pixel text-[8px] uppercase text-muted-foreground', !margin && 'mt-auto')}>{data.minLabel}</span>}
      </button>
    </li>
  );
};

// ---------- Pace tracker: see visual/ChaseChart ----------

// ---------- Section ----------

interface RecordBookProps {
  leaders: RecordBoardData[];
  pace: PaceEntry[];
  onSelect: Select;
}

/** Efficiency leaders (rate records) and the pace tracker. The headline records live in RecordStrip. */
const RecordBook = ({ leaders, pace, onSelect }: RecordBookProps) => {
  const chasing = pace.slice(0, 6);
  if (leaders.length === 0 && chasing.length === 0) return null;
  return (
    <section id="efficiency" aria-labelledby="efficiency-title" className="scroll-mt-20 space-y-8">
      {leaders.length > 0 && (
        <div className="space-y-3">
          <h2 id="efficiency-title" className="section-title text-2xl">
            <Gauge className="h-5 w-5 text-gold" aria-hidden="true" />
            Efficiency Leaders
          </h2>
          <SectionIntro id="efficiency" takeaway={efficiencyTakeaway(leaders)}>
            Quality over quantity. Rate stats only count players with a full sample. The strip under each mark shows the top five, with the
            leader's margin over #2 in gold.
          </SectionIntro>
          <ul className="flex flex-wrap gap-3" style={gridVars(leaders.length, { base: 2, sm: 3, lg: 5 })}>
            {leaders.map((b) => (
              <LeaderTile key={b.id} data={b} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      )}

      {chasing.length > 0 && <ChaseChart pace={chasing} onSelect={onSelect} />}
    </section>
  );
};

export default RecordBook;
