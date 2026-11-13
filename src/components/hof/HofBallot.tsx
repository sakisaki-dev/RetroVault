import type { HofCase } from '@/utils/hallOfFame';
import { findNFLTeam } from '@/utils/nflTeams';
import TeamLogo from '../brand/TeamLogo';
import { ScoreGauge } from './hofParts';
import { clubColors } from './hofUtils';

export interface BallotRow {
  entry: HofCase & { since?: string; yearsOnBallot?: number };
  club: string;
  /** Opens his player card; omitted when he isn't in the league sheet */
  onOpen?: () => void;
}

const Row = ({ row, bar, note }: { row: BallotRow; bar: number; note: string }) => {
  const { entry, club } = row;
  const team = findNFLTeam(club);
  const ink = clubColors(team).ink;
  const over = entry.score >= bar;
  const body = (
    <>
      <span className="flex items-center gap-2">
        <TeamLogo team={team ?? club} size={22} decorative />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold uppercase leading-tight" style={{ color: ink }}>
            {entry.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {entry.pos} · {note}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block font-display text-2xl font-extrabold italic leading-none tabular-nums ${over ? 'text-gold' : 'text-chalk'}`}>{entry.score}</span>
          <span className="block font-pixel text-[8px] uppercase text-muted-foreground">{over ? 'Over the bar' : `${bar - entry.score} short`}</span>
        </span>
      </span>
      <ScoreGauge score={entry.score} bar={bar} label={`${entry.name}: Hall of Fame Score ${entry.score}, bar ${bar}`} className="mt-2" />
    </>
  );
  const cls = 'block w-full rounded-lg border border-line bg-card p-3 text-left';
  return row.onOpen ? (
    <button type="button" onClick={row.onOpen} className={`${cls} transition-colors hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold`} aria-label={`${entry.name}, score ${entry.score} against the bar of ${bar}. ${note}. Open player card`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

const Heading = ({ id, kicker, title, sub }: { id: string; kicker: string; title: string; sub: string }) => (
  <div className="mb-3">
    <p className="font-pixel text-[10px] uppercase tracking-widest text-gold/90">{kicker}</p>
    <h2 id={id} className="font-display text-2xl font-extrabold uppercase italic text-chalk sm:text-3xl">
      {title}
    </h2>
    <p className="text-sm text-muted-foreground">{sub}</p>
  </div>
);

/** The Ballot (eligible retirees waiting and near misses), then Future Hall of Famers (the active watch list). */
const HofBallot = ({ ballot, near, watch, bar, cap, season }: { ballot: BallotRow[]; near: BallotRow[]; watch: BallotRow[]; bar: number; cap: number; season?: string }) => (
  <div className="mb-10 grid gap-8 lg:grid-cols-2">
    <section aria-labelledby="hof-ballot-title">
      <Heading
        id="hof-ballot-title"
        kicker={season ? `The ballot · ${season}` : 'The ballot'}
        title="Waiting at the door"
        sub={`Retired players over the bar wait here when a class is full (at most ${cap} a year), highest score first.`}
      />
      {ballot.length ? (
        <ul className="space-y-2">
          {ballot.map((r) => (
            <li key={r.entry.key}>
              <Row
                row={r}
                bar={bar}
                note={`on the ballot since ${r.entry.since ?? r.entry.frozenSeason}${r.entry.yearsOnBallot ? ` · ${r.entry.yearsOnBallot} year${r.entry.yearsOnBallot === 1 ? '' : 's'}` : ''}`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted-foreground">Nobody is waiting: every retired player over the bar is in.</p>
      )}

      {near.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 font-pixel text-[10px] uppercase tracking-widest text-muted-foreground">Near misses</h3>
          <ul className="space-y-2">
            {near.map((r) => (
              <li key={r.entry.key}>
                <Row row={r} bar={bar} note={`case closed ${r.entry.frozenSeason}`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>

    <section aria-labelledby="hof-future-title">
      <Heading id="hof-future-title" kicker="The watch" title="Future Hall of Famers" sub={`Their Hall of Fame Score today. Eligible when they retire; ${bar} and over is on track.`} />
      {watch.length ? (
        <ul className="space-y-2">
          {watch.map((r) => (
            <li key={r.entry.key}>
              <Row row={r} bar={bar} note={r.entry.score >= bar ? 'on track · eligible when he retires' : 'eligible when he retires'} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted-foreground">No active player is within reach of the bar yet.</p>
      )}
    </section>
  </div>
);

export default HofBallot;
