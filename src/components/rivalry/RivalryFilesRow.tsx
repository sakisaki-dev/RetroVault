import { useMemo, type CSSProperties } from 'react';
import { ChevronRight, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import { useLeagueContent } from '@/utils/leagueContent';
import { openRivalryFile, prefetchRivalryFile, rivalryFilesOf, type RivalryFile } from '@/utils/rivalryFiles';
import { clubVars } from './clubVars';
import './rivalry.css';

const LAST_N = 6;

/** One file as a card: the two clubs squared up, the series record, meetings and span, the latest results */
const FileCard = ({ file, i, past }: { file: RivalryFile; i: number; past?: boolean }) => {
  const coach = findNFLTeam(file.coachTeam);
  const rival = findNFLTeam(file.team);
  const last = file.meetings.slice(-LAST_N);
  return (
    <li className="rf-card-wrap stagger-in" style={{ '--i': i } as CSSProperties}>
      <button
        type="button"
        className={cn('rf-card', past && 'rf-card--past')}
        style={{ ...clubVars(file.coachTeam, 'rf-a'), ...clubVars(file.team, 'rf-b') }}
        onClick={() => openRivalryFile(file.id)}
        onPointerEnter={prefetchRivalryFile}
        onFocus={prefetchRivalryFile}
        aria-label={`Rivalry file: ${coach?.name ?? file.coachTeam} vs ${rival?.name ?? file.team}, ${file.record.text} in ${file.games} meetings, ${file.first} to ${file.last}. Open`}
      >
        <span className="rf-card__face" aria-hidden="true">
          <span className="rf-card__half rf-card__half--a">
            <TeamLogo team={coach ?? file.coachTeam} size={44} decorative />
          </span>
          <span className="rf-card__half rf-card__half--b">
            <TeamLogo team={rival ?? file.team} size={44} decorative />
          </span>
          <span className="rf-card__rec">
            <small>{past ? 'Past' : 'Series'}</small>
            {file.record.text}
          </span>
        </span>
        <span className="rf-card__body" aria-hidden="true">
          <span className="rf-card__title">
            {coach?.name ?? file.coachTeam} <i>vs</i> {rival?.name ?? file.team}
          </span>
          <span className="rf-card__meta">
            {file.games} meetings · {file.first}–{file.last} · {file.streak.games}-game streak
          </span>
          <span className="rf-card__pips">
            {last.map((m) => (
              <i key={`${m.season}-${m.week}`} className={cn('rf-pip', m.result === 'W' ? 'rf-pip--a' : m.result === 'L' ? 'rf-pip--b' : 'rf-pip--t')} />
            ))}
            <span className="rf-card__open">
              Open file <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </span>
        </span>
      </button>
    </li>
  );
};

/**
 * Timeline news area (beside the Season Story): the lasting rivalries' files as a row of cards, each opening the full
 * file as a phone sheet (RivalryHost). Lapsed rivalries fold under Past rivalries, still reachable. Nothing shows when
 * there is no lasting or past rivalry.
 */
const RivalryFilesRow = () => {
  const { content } = useLeagueContent();
  const files = useMemo(() => rivalryFilesOf(content), [content]);
  const lasting = files.filter((f) => f.status === 'lasting');
  const past = files.filter((f) => f.status === 'lapsed');
  if (!files.length) return null;
  return (
    <section className="rf-row" aria-labelledby="rf-row-title">
      <header className="rf-row__head">
        <h3 id="rf-row-title" className="rf-row__title">
          <Swords className="h-4 w-4" aria-hidden="true" /> Rivalry files
        </h3>
        <p className="rf-row__sub">Clubs met at least 6 times, twice a season in 3 seasons, and still meeting.</p>
      </header>
      {lasting.length > 0 ? (
        <ul className="rf-row__list" data-no-swipe-x>
          {lasting.map((f, i) => (
            <FileCard key={f.id} file={f} i={i} />
          ))}
        </ul>
      ) : (
        <p className="rf-row__empty">No rivalry is lasting right now.</p>
      )}
      {past.length > 0 && (
        <details className="rf-row__past">
          <summary>Past rivalries ({past.length})</summary>
          <ul className="rf-row__list" data-no-swipe-x>
            {past.map((f, i) => (
              <FileCard key={f.id} file={f} i={i} past />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

export default RivalryFilesRow;

/** A club strip that opens a rivalry file (Front Office rivals, the Season Story feed) */
export const RivalryFileStrip = ({ file, className, label }: { file: RivalryFile; className?: string; label?: string }) => {
  const rival = findNFLTeam(file.team);
  return (
    <button
      type="button"
      className={cn('rf-strip', className)}
      style={clubVars(file.team, 'rf-b')}
      onClick={(e) => {
        e.stopPropagation();
        openRivalryFile(file.id);
      }}
      onPointerEnter={prefetchRivalryFile}
      onFocus={prefetchRivalryFile}
    >
      <TeamLogo team={rival ?? file.team} size={22} decorative />
      <span className="rf-strip__text">
        {label ?? (file.status === 'lapsed' ? 'Past rivalry file' : 'Rivalry file')}
        <small>
          {file.record.text} · {file.games} meetings
        </small>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </button>
  );
};
