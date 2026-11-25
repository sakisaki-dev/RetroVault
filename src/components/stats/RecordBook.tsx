import { useState } from 'react';
import { Crown, Gauge } from 'lucide-react';
import { efficiencyTakeaway, recordsTakeaway } from './takeaways';
import SectionIntro from './SectionIntro';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { formatDecimal } from '@/utils/metricColors';
import FitName from './FitName';
import TeamLogo from '../brand/TeamLogo';
import { bannerTeamOf } from '@/utils/playerExtras';
import { peekProps } from '../peek/peekProps';
import CountUp from '../brand/CountUp';
import { ClubWatermark, StageFigure } from './visual/ClubStage';
import { clubStyle } from './visual/clubTone';
import './visual/recordShelves.css';
import { GROUP_META, type PaceEntry, type RecordBoardData } from './records';
import { GRID_ITEM, gridVars } from './grid';
import MarginStrip from './visual/MarginStrip';
import { marginText } from './visual/chartKit';
import ChaseChart from './visual/ChaseChart';
import { matchPlayerByName } from '@/utils/leagueContent';
import { CLUB_RECORD_FOR, SEASON_GROUP, entryName, holderName, setInText, useClubRecords, type ClubRecordRow } from './clubRecords';

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
      <span className="truncate" title={row.club.exact != null ? `Exact: ${formatDecimal(row.club.exact, 2)}` : undefined}>
        {best ? `${who} ${row.club.year}` : `${row.club.mark} · ${who} ${row.club.year}`}
      </span>
    </span>
  );
};


/** "QB S. Brandson" -> "S. Brandson" */
const boardName = (s: string) => s.replace(/^[A-Z]{1,2} /, '');

// ---------- Record plaques on trophy shelves (owner, 2026-11-17: "the record book … look a little boring") ----------

/** One record as the shelves draw it, whatever its scope */
interface PlaqueItem {
  key: string;
  group: keyof typeof GROUP_META;
  title: string;
  value: number;
  decimals: number;
  unit?: string;
  holder: string;
  player: Player | null;
  team?: string | null;
  year?: string | null;
  /** "+1,013 over #2", "Set in week 17 against the Bills" */
  sub?: string | null;
  club?: ClubRecordRow;
  broken?: boolean;
}

/**
 * A record plaque: tinted in the holder's club colours, his sprite standing in its corner (stiff-arming where the
 * league broke the club's record, celebrating where it still leads), the mark, his name and one line of context, the
 * club's own mark under it. One fixed shape for career, season and game records.
 */
const Plaque = ({ item, index, onSelect }: { item: PlaqueItem; index: number; onSelect: Select }) => {
  // the club he is best known for (retired) or plays for (active): the banner team, the one his sprite and colours wear
  const club = (item.player && !item.player.isRealLegend ? bannerTeamOf(item.player) : '') || item.team;
  const body = (
    <>
      <ClubWatermark player={item.player} team={club} size={170} />
      {item.player && !item.player.isRealLegend && <StageFigure player={item.player} action={item.broken ? 'stiffarm' : 'celebrate'} />}
      <span className="rb-plaque__title">
        <span className="truncate">{item.title}</span>
      </span>
      <span className="rb-plaque__value">
        <Crown className="rb-plaque__crown" aria-hidden="true" />
        <CountUp value={item.value} decimals={item.decimals} />
        {item.unit && <small>{item.unit}</small>}
      </span>
      <span className="rb-plaque__holder">
        {club && <TeamLogo team={club} size={18} decorative backed />}
        <span className="truncate">
          {item.holder}
        </span>
        {item.year && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{item.year}</span>}
      </span>
      {item.sub && <span className={/over #2/.test(item.sub) ? 'rb-plaque__chip' : 'rb-plaque__sub'}>{item.sub}</span>}
      <ClubLine row={item.club} />
    </>
  );
  const cls = 'rb-plaque cs-card cs-flat cs-card--fig stagger-in';
  const style = { ...(item.player ? clubStyle(item.player) : {}), ['--i' as string]: index };
  return (
    <li className="min-w-0">
      {item.player ? (
        <button type="button" className={cls} style={style} onClick={() => onSelect(item.player!)} {...peekProps(item.player)} aria-label={`${item.title}: ${fmt(item.value, item.decimals)}${item.unit ?? ''} by ${item.holder}${item.sub ? `, ${item.sub}` : ''}. Open player`}>
          {body}
        </button>
      ) : (
        <div className={cls} style={style} role="group" aria-label={`${item.title}: ${fmt(item.value, item.decimals)} by ${item.holder}`}>
          {body}
        </div>
      )}
    </li>
  );
};

const SHELF_ORDER: (keyof typeof GROUP_META)[] = ['qb', 'rb', 'wr', 'te', 'ol', 'def', 'awards'];
const SHELF_LABEL: Partial<Record<keyof typeof GROUP_META, string>> = { qb: 'Passing', rb: 'Rushing', wr: 'Receiving', te: 'Tight ends', ol: 'Line', def: 'Defense', awards: 'Accolades' };

/** The plaques on trophy shelves, one shelf per unit (Passing, Rushing, Receiving, Defense, Accolades) */
const Shelves = ({ items, onSelect }: { items: PlaqueItem[]; onSelect: Select }) => {
  let n = 0;
  return (
    <div className="rb-wall">
      {SHELF_ORDER.map((g) => {
        const row = items.filter((x) => x.group === g);
        if (!row.length) return null;
        return (
          <section key={g} className="rb-shelf" style={{ ['--n' as string]: row.length }} aria-label={SHELF_LABEL[g] ?? GROUP_META[g].label}>
            <h3 className="rb-shelf__label" style={{ color: `hsl(${GROUP_META[g].hsl})` }}>
              {SHELF_LABEL[g] ?? GROUP_META[g].label}
            </h3>
            <ul className="rb-shelf__row">
              {row.map((it) => (
                <Plaque key={it.key} item={it} index={n++} onSelect={onSelect} />
              ))}
            </ul>
            <span className="rb-shelf__rail" aria-hidden="true" />
          </section>
        );
      })}
    </div>
  );
};

/** The headline records: career (the league's best career card, with the club's own mark under it) or season. */
export const RecordStrip = ({ headline, players, onSelect }: { headline: RecordBoardData[]; players: Player[]; onSelect: Select }) => {
  const [scope, setScope] = useState<'career' | 'season' | 'game'>('career');
  const clubFile = useClubRecords();
  const rows = clubFile?.records ?? [];
  const byRecord = new Map(rows.map((r) => [r.record, r]));
  const seasons = rows.filter((r) => r.scope === 'season' && r.league);
  // single games and long plays by league players (kicking and returns stay off: no kickers in the league data, and
  // returns are frozen at Y1-Y7 with kick-offs switched off)
  const games = rows.filter((r) => (r.scope === 'game' || r.scope === 'other') && !/field goal|FG|return/i.test(r.record));
  const beaten = rows.filter((r) => r.league && r.broken).length;
  const tracked = rows.filter((r) => r.league).length;
  // every record of the scope on the shelves
  const items: PlaqueItem[] =
    scope === 'career'
      ? headline.map((b) => {
          const top = b.entries[0];
          const club = CLUB_RECORD_FOR[b.id] ? byRecord.get(CLUB_RECORD_FOR[b.id]) : undefined;
          return {
            key: b.id,
            group: b.group,
            title: b.title,
            value: top.value,
            decimals: b.decimals,
            holder: top.player.name,
            player: top.player,
            team: top.player.team,
            sub: marginText(b),
            club,
            broken: !!club?.broken,
          };
        })
      : scope === 'season'
        ? seasons.map((r) => {
            const L = r.league!;
            const top = L.top[0];
            const next = L.top.find((_, i) => i > 0);
            const name = entryName(top);
            const gap = next ? L.value - next.value : 0;
            return {
              key: r.record,
              group: SEASON_GROUP(r.record),
              title: r.short,
              value: L.value,
              decimals: 0,
              holder: name,
              player: matchPlayerByName(name, players),
              team: top.team,
              year: top.season,
              sub: next ? `${gap > 0 ? `+${gap.toLocaleString()} over #2` : 'Tied for the lead'} (${entryName(next)}${next.season ? ` ${next.season}` : ''})` : null,
              club: r,
              broken: !!r.broken,
            };
          })
        : games.map((r) => {
            const c = r.club;
            const name = holderName(c);
            const player = matchPlayerByName(name, players);
            const exact = c.exact != null;
            const qb = c.qb && c.holder.includes('→') ? boardName(c.qb) : null;
            return {
              key: r.record,
              group: SEASON_GROUP(r.record),
              title: r.record,
              value: exact ? c.exact! : c.value ?? 0,
              decimals: exact ? 2 : 0,
              unit: /yds$/.test(c.mark) ? ' yds' : undefined,
              holder: player?.name ?? boardName(name),
              player,
              team: c.team,
              year: c.year,
              sub: [setInText(c), qb ? `QB ${qb}` : null].filter(Boolean).join(' · ') || null,
            };
          });
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
          scope === 'game'
            ? 'Single games and long plays from the club board, with the week and opponent each was set against.'
            : scope === 'career' || !tracked
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
        {games.length > 0 && (
          <button type="button" className={chip(scope === 'game')} aria-pressed={scope === 'game'} onClick={() => setScope('game')}>
            Game
          </button>
        )}
      </div>
      <Shelves items={items} onSelect={onSelect} />
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
        {...peekProps(top.player)}
        aria-label={`${data.title}: ${top.player.name}, ${fmt(top.value, data.decimals)}${data.minLabel ? ` (${data.minLabel})` : ''}${margin ? `, ${margin}` : ''}. Open player`}
        className="hover-lift cs-card cs-card--fig relative flex h-full w-full flex-col gap-1 overflow-hidden rounded-lg border border-line bg-panel p-3 text-left"
        style={clubStyle(top.player)}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: `hsl(${hsl})` }} />
        {!top.player.isRealLegend && <StageFigure player={top.player} action="run" />}
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
