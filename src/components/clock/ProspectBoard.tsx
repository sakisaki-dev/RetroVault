import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Player, Position } from '@/types/player';
import { TOP_PICKS_CEILING, draftBands, draftCeiling, growthSeasons, improveChance, prospectBoard, PROSPECT_MAX_AGE, starsOf, type ClockPlayer } from './clockModel';
import ClubStrip from '@/components/brand/ClubStrip';
import TeamLogo from '@/components/brand/TeamLogo';
import { ClockStage, LampBar, RatingBars, StarRow, clubVars, starText } from './clockParts';

/** The coach's record the next draft is built from (ClockPage works it out from coach.json and the save) */
export interface DraftInfo {
  /** "15-2" */
  record: string;
  /** "Y92" */
  season: string;
  pct: number;
  /** Set when the coach changed clubs: the rule reads the new club's offense + defense */
  clubChange?: string;
  /** This season so far (the save), for the next draft */
  now?: { record: string; pct: number; season: string };
}

interface Props {
  all: ClockPlayer[];
  onSelect: (p: Player) => void;
  draft?: DraftInfo | null;
}

const POS_ORDER: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The draft ceiling (docs/SAVE_INVENTORY.md 7.4) as one strip: the coach's win % against the best stars picks 5-50 can have */
const DraftStrip = ({ d }: { d: DraftInfo }) => {
  const cap = draftCeiling(d.pct);
  const bands = draftBands();
  const nowCap = d.now ? draftCeiling(d.now.pct) : null;
  return (
    <section className="clk-dstrip" aria-label="The draft ceiling">
      <p className="clk-dstrip__head">
        <span className="clk-dstrip__k">Draft ceiling</span>
        <span>{d.clubChange ? d.clubChange : `After ${d.record}`}, picks 5–50 top out at</span>
        <StarRow half={cap} px={2} />
      </p>
      <div
        className="clk-dstrip__meter"
        role="img"
        aria-label={`Best stars for picks 5 to 50 by the coach's win %: ${bands.map((b) => `${pct(b.from)} to ${pct(b.to)}: ${starText(b.stars)}`).join('; ')}. ${d.season} ${d.record}, ${pct(d.pct)}.`}
      >
        {bands.map((b) => (
          <span key={b.from} className={cn('clk-dstrip__band', b.stars === cap && 'is-on')} style={{ width: `${(b.to - b.from) * 100}%` }} aria-hidden="true">
            {b.stars / 2}★
          </span>
        ))}
        <i className="clk-dstrip__mark" style={{ left: `${d.pct * 100}%` }} title={`${d.season} ${d.record}`} aria-hidden="true" />
        {d.now && <i className="clk-dstrip__mark clk-dstrip__mark--now" style={{ left: `${d.now.pct * 100}%` }} title={`${d.now.season} so far ${d.now.record}`} aria-hidden="true" />}
      </div>
      <p className="clk-dstrip__note">
        Better seasons mean weaker classes; picks 1–4 can reach {TOP_PICKS_CEILING / 2}★.{d.now && nowCap !== null ? ` ${d.now.season} so far ${d.now.record}: ${nowCap / 2}★ if it holds.` : ''}
      </p>
    </section>
  );
};

const Row = ({ c, rank, onSelect }: { c: ClockPlayer; rank: number; onSelect: (p: Player) => void }) => {
  const st = starsOf(c);
  const inner = (
    <>
      <span className="clk-bs__mark" aria-hidden="true">
        <TeamLogo team={c.team} size={72} decorative />
      </span>
      <span className="clk-bs__rank">{rank}</span>
      <ClockStage c={c} size="row" action="celebrate" />
      <span className="clk-bs__who">
        <ClubStrip team={c.team} label={c.name} size="md" />
        <span className="clk-bs__sub">
          {c.pos} · AGE {c.age}
          {!c.player && ' · NO CARD YET'}
        </span>
      </span>
      <span className="clk-pstars" role="img" aria-label={`${starText(st.now)} now, potential ${starText(st.potential)}`}>
        <StarRow half={st.now} px={2} label="" />
        <span aria-hidden="true">›</span>
        <StarRow half={st.potential} px={2} label="" />
      </span>
      <span className="clk-plus" aria-label={`${c.room} rating points of room to grow`}>
        +{c.room}
      </span>
      <RatingBars c={c} className="clk-bars--mini" />
      <LampBar
        className="clk-bs__lamps clk-bs__lamps--pro"
        cells={[
          { label: 'GROWS', value: pct(improveChance(c.age)), tone: 'turf' },
          { label: 'SEASONS', value: growthSeasons(c.age).toFixed(1), tone: 'chalk' },
        ]}
      />
    </>
  );
  return (
    <li>
      {c.player ? (
        <button type="button" className="clk-bs clk-bs--pro" style={clubVars(c.team)} onClick={() => onSelect(c.player!)} aria-label={`${rank}. ${c.name}, ${c.pos}, ${c.team}, age ${c.age}. Open his card`}>
          {inner}
        </button>
      ) : (
        <div className="clk-bs clk-bs--pro" style={clubVars(c.team)}>
          {inner}
        </div>
      )}
    </li>
  );
};

const ProspectBoard = ({ all, onSelect, draft }: Props) => {
  const board = useMemo(() => prospectBoard(all), [all]);
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const positions = POS_ORDER.filter((p) => board.some((c) => c.pos === p));
  const list = pos === 'ALL' ? board : board.filter((c) => c.pos === pos);
  if (!board.length) return <p className="clk-empty">No players under 25 in the save.</p>;
  const top = board[0];
  const capped = board.filter((c) => c.room === 0).length;
  return (
    <div className="clk-stack">
      <p className="clk-takeaway">
        {board.length} players are {PROSPECT_MAX_AGE} or younger. {top.name} has the most room to grow (+{top.room} rating points to his ceilings)
        {capped ? `; ${capped} already sit at every ceiling` : ''}.
      </p>
      {draft && <DraftStrip d={draft} />}
      <div role="group" aria-label="Filter by position" className="clk-chips">
        {(['ALL', ...positions] as const).map((p) => (
          <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)} className={cn('clk-chip', pos === p && 'is-on')}>
            {p === 'ALL' ? 'All' : p}
          </button>
        ))}
      </div>
      <section aria-labelledby="clk-room">
        <h3 id="clk-room" className="clk-sb clk-sb--sticky">
          <span className="clk-sb__t">Room to grow</span>
          <span className="clk-sb__n">{list.length}</span>
          <span className="clk-sb__note">stars now › potential · bars: now and room to his ceiling</span>
        </h3>
        <ol className="clk-strips">
          {list.map((c) => (
            <Row key={c.key} c={c} rank={board.indexOf(c) + 1} onSelect={onSelect} />
          ))}
        </ol>
      </section>
    </div>
  );
};

export default ProspectBoard;
