import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import ClubStrip from '@/components/brand/ClubStrip';
import TeamLogo from '@/components/brand/TeamLogo';
import { formatNumber } from '@/utils/metricColors';
import { useJerseyNumbers } from '@/utils/jerseys';
import { usePhone } from '@/hooks/usePhone';
import type { Player, Position } from '@/types/player';
import { careerLine, farewellTour, liveGames, type ClockPlayer } from './clockModel';
import { ClockPips, ClockStage, LampBar, Medals, clubVars } from './clockParts';

interface Props {
  all: ClockPlayer[];
  season: number;
  week: number;
  onSelect: (p: Player) => void;
}

const POS_ORDER: Position[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = (v: number) => formatNumber(Math.round(v));
const SHORT: Record<string, string> = { Games: 'GP', 'Pass yds': 'PASS YDS', 'Pass TD': 'PASS TD', 'Rush yds': 'RUSH YDS', 'Rush TD': 'RUSH TD', 'Rec yds': 'REC YDS', 'Rec TD': 'REC TD', Blocks: 'BLK', Tackles: 'TKL', Sacks: 'SCK', INT: 'INT', Legacy: 'LEGACY' };

/** Games, his position's two defining totals (live: league career + this season so far) and Career Legacy */
const lampsOf = (c: ClockPlayer) => {
  const line = careerLine(c.player!, c.season);
  return [{ label: 'Games', value: liveGames(c) }, ...line, { label: 'Legacy', value: c.legacy }].map((x) => ({
    label: SHORT[x.label] ?? x.label.toUpperCase(),
    value: fmt(x.value),
    tone: x.label === 'Legacy' ? ('gold' as const) : ('chalk' as const),
  }));
};

/** The last lap: the three best careers on their way out, as the site's pedestal banners with the numbers inside */
const LastLap = ({ list, season, onSelect }: { list: ClockPlayer[]; season: number; onSelect: (p: Player) => void }) => {
  const { numberFor } = useJerseyNumbers();
  const phone = usePhone();
  return (
    <section aria-labelledby="clk-lastlap">
      <h3 id="clk-lastlap" className="clk-sb">
        <span className="clk-sb__t">The last lap</span>
        <span className="clk-sb__note">the best careers on their way out</span>
      </h3>
      <ol className="clk-lap">
        {list.map((c, i) => (
          <li key={c.key} className="clk-lap__item" style={clubVars(c.team)}>
            <button type="button" className="clk-lap__btn" onClick={() => onSelect(c.player!)} aria-label={`No. ${i + 1}, ${c.name}, ${c.pos}, ${c.team}, age ${c.age}, ${c.left === 0 ? 'final season' : 'one more season'}. Open his card`}>
              <ProPlayerBanner
                size={phone ? 'compact' : 'card'}
                name={c.name}
                position={c.pos}
                team={c.team}
                number={numberFor(c.player!) ?? null}
                eyebrow={
                  <span className="clk-lap__eye">
                    No. {i + 1} · Age {c.age}
                    <ClockPips c={c} season={season} />
                    <Medals p={c.player!} />
                  </span>
                }
                topRight={<LampBar cells={lampsOf(c)} className="clk-lamps--grid" />}
                interactive
              />
            </button>
            {phone && (
              <div className="clk-lap__phone">
                <ClockPips c={c} season={season} />
                <LampBar cells={lampsOf(c)} />
                <Medals p={c.player!} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};

/** One player as a club-colour broadcast strip */
const Row = ({ c, rank, season, onSelect }: { c: ClockPlayer; rank: number; season: number; onSelect: (p: Player) => void }) => (
  <li>
    <button type="button" className="clk-bs" style={clubVars(c.team)} onClick={() => onSelect(c.player!)} aria-label={`${rank}. ${c.name}, ${c.pos}, ${c.team}, age ${c.age}. Open his card`}>
      <span className="clk-bs__mark" aria-hidden="true">
        <TeamLogo team={c.team} size={72} decorative />
      </span>
      <span className="clk-bs__rank">{rank}</span>
      <ClockStage c={c} size="row" action="run" />
      <span className="clk-bs__who">
        <ClubStrip team={c.team} label={c.name} size="md" />
        <span className="clk-bs__sub">
          {c.pos} · AGE {c.age}
        </span>
      </span>
      <ClockPips c={c} season={season} className="clk-bs__clock" />
      <LampBar cells={lampsOf(c)} className="clk-bs__lamps" />
      <Medals p={c.player!} className="clk-bs__medals" />
    </button>
  </li>
);

const GroupRows = ({ id, title, note, rows, season, onSelect }: { id: string; title: string; note: string; rows: { c: ClockPlayer; rank: number }[]; season: number; onSelect: (p: Player) => void }) => {
  if (!rows.length) return null;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="clk-sb clk-sb--sticky">
        <span className="clk-sb__t">{title}</span>
        <span className="clk-sb__n">{rows.length}</span>
        <span className="clk-sb__note">{note}</span>
      </h3>
      <ol className="clk-strips">
        {rows.map(({ c, rank }) => (
          <Row key={c.key} c={c} rank={rank} season={season} onSelect={onSelect} />
        ))}
      </ol>
    </section>
  );
};

const FarewellTour = ({ all, season, week, onSelect }: Props) => {
  const tour = useMemo(() => farewellTour(all), [all]);
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  if (!tour.length) return <p className="clk-empty">Nobody in the league is within two seasons of retirement.</p>;
  const final = tour.filter((c) => c.left === 0);
  const one = tour.filter((c) => c.left === 1);
  const top = tour.slice(0, 3);
  const topKeys = new Set(top.map((c) => c.key));
  const rings = final.reduce((n, c) => n + (c.player?.rings ?? 0), 0);
  const positions = POS_ORDER.filter((p) => tour.some((c) => c.pos === p));
  // ranks stay the player's place in his whole group, also when a position filter is on
  const ranked = (group: ClockPlayer[]) => {
    const start = top.filter((c) => group.includes(c)).length + 1;
    return group
      .filter((c) => !topKeys.has(c.key))
      .map((c, i) => ({ c, rank: start + i }))
      .filter((x) => pos === 'ALL' || x.c.pos === pos);
  };
  return (
    <div className="clk-stack">
      <p className="clk-takeaway">
        {plural(final.length, 'player')} in {final.length === 1 ? 'his' : 'their'} final season ({plural(rings, 'ring')} between them), {one.length} more with one season left. Totals include Y{season} through
        week {week}.
      </p>
      <LastLap list={top} season={season} onSelect={onSelect} />
      <div role="group" aria-label="Filter by position" className="clk-chips">
        {(['ALL', ...positions] as const).map((p) => (
          <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)} className={cn('clk-chip', pos === p && 'is-on')}>
            {p === 'ALL' ? 'All' : p}
          </button>
        ))}
      </div>
      <GroupRows id="clk-final" title="Final season" note={`ends Y${season}`} rows={ranked(final)} season={season} onSelect={onSelect} />
      <GroupRows id="clk-one" title="One more season" note={`ends Y${season + 1}`} rows={ranked(one)} season={season} onSelect={onSelect} />
    </div>
  );
};

export default FarewellTour;
