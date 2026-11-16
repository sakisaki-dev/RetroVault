import { ChevronRight, Flame, Newspaper } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/brand/TeamLogo';
import GameSprite from '@/components/GameSprite';
import { findNFLTeam } from '@/utils/nflTeams';
import { clubVars } from './clubVars';
import { peekKeyProps } from '@/components/peek/peekProps';
import { meetingLabel, type RivalryFile, type RivalryPaper, type RivalryStar } from '@/utils/rivalryFiles';
import './rivalry.css';

const Side = ({ club, star, kicker, side, players, onPlayer }: { club: string; star?: RivalryStar; kicker: string; side: 'l' | 'r'; players: Map<string, Player>; onPlayer?: (p: Player) => void }) => {
  const team = findNFLTeam(club);
  const p = star ? players.get(star.key) : undefined;
  return (
    <div className={cn('rf-side', `rf-side--${side}`)}>
      <span className="rf-side__abbr" aria-hidden="true">
        {team?.abbreviation ?? club.slice(0, 3).toUpperCase()}
      </span>
      <span className="rf-side__figure" aria-hidden="true">
        {p && <GameSprite player={p} team={club} kind="figure" size="l" className="rf-side__sprite" />}
        <span className="rf-side__logo">
          <TeamLogo team={team ?? club} size={84} decorative />
        </span>
      </span>
      <div className="rf-side__label">
        {star && (
          <button type="button" className="rf-star" onClick={() => p && onPlayer?.(p)} disabled={!p || !onPlayer} {...peekKeyProps(star.key)} aria-label={`${star.name}, ${star.pos}, ${club} star by Career Legacy. Open player`}>
            <span aria-hidden="true">★</span> {star.name}
          </button>
        )}
        <span className="rf-side__kicker">{kicker}</span>
        <span className="rf-side__club">{team?.name ?? club}</span>
      </div>
    </div>
  );
};

const Heat = ({ heat }: { heat: number }) => (
  <span className="rf-heat" aria-label={`Heat ${heat} of 3`}>
    {Array.from({ length: 3 }, (_, i) => (
      <Flame key={i} className={cn('h-3 w-3', i < heat ? 'text-orange-400' : 'text-white/20')} aria-hidden="true" />
    ))}
  </span>
);

interface Props {
  file: RivalryFile;
  players: Map<string, Player>;
  onPlayer?: (p: Player) => void;
  onPaper?: (p: RivalryPaper) => void;
  /** id of the title element (the sheet labels itself with it) */
  titleId?: string;
}

/**
 * One rivalry file (content.json rivalryFiles; scripts/build_league_content.py, rules only): the face-off hero with
 * each side's star, the series numbers, every meeting as a score tile in the winner's colours (the biggest margin
 * ringed in gold), the templated "story so far" lines, and the Season Story articles and Hot Takes that name the rival.
 */
const RivalryFileView = ({ file, players, onPlayer, onPaper, titleId }: Props) => {
  const coach = findNFLTeam(file.coachTeam);
  const rival = findNFLTeam(file.team);
  const coachName = coach?.name ?? file.coachTeam;
  const rivalName = rival?.name ?? file.team;
  const span = file.first === file.last ? file.first : `${file.first}–${file.last}`;
  const streakInk = file.streak.side === 'coach' ? 'var(--rf-a-ink)' : 'var(--rf-b-ink)';
  return (
    <article className="rf" style={{ ...clubVars(file.coachTeam, 'rf-a'), ...clubVars(file.team, 'rf-b') }} aria-labelledby={titleId}>
      {titleId && (
        <h2 id={titleId} className="sr-only">
          Rivalry file: {coachName} vs {rivalName}, {file.record.text} in {file.games} meetings
        </h2>
      )}
      {/* Face-off hero */}
      <div className="rf-hero">
        <Side club={file.coachTeam} star={file.stars.coach} kicker="Skura's club" side="l" players={players} onPlayer={onPlayer} />
        <Side club={file.team} star={file.stars.rival} kicker={[rival?.conference ?? file.conference, rival?.division ?? file.division].filter(Boolean).join(' ') || 'The rival'} side="r" players={players} onPlayer={onPlayer} />
        <div className="rf-badge">
          <span className="rf-badge__kicker">{file.status === 'lapsed' ? `Past rivalry · ${span}` : `The series · ${span}`}</span>
          <span className="rf-badge__rec">{file.record.text}</span>
        </div>
      </div>

      {/* The numbers */}
      <dl className="rf-nums">
        <div className="rf-num">
          <dd>{file.games}</dd>
          <dt>Meetings</dt>
        </div>
        <div className="rf-num">
          <dd style={{ color: 'var(--rf-a-ink)' }}>{file.pointsFor.toLocaleString()}</dd>
          <dt>{coachName} pts</dt>
        </div>
        <div className="rf-num">
          <dd style={{ color: 'var(--rf-b-ink)' }}>{file.pointsAgainst.toLocaleString()}</dd>
          <dt>{rivalName} pts</dt>
        </div>
        <div className="rf-num">
          <dd className="text-gold">{file.streak.games}</dd>
          <dt>
            Longest streak <span style={{ color: streakInk }}>{findNFLTeam(file.streak.team)?.abbreviation ?? file.streak.team}</span>
          </dt>
        </div>
      </dl>

      {/* Every meeting */}
      <section className="rf-panel" aria-labelledby={`${file.id}-meet`}>
        <h3 id={`${file.id}-meet`} className="rf-rubric">
          Every meeting
        </h3>
        <ol className="rf-tiles">
          {file.meetings.map((m) => {
            const winner = m.result === 'W' ? m.coachTeam : m.result === 'L' ? file.team : null;
            return (
              <li
                key={`${m.season}-${m.week}`}
                className={cn('rf-tile', m.result === 'W' && 'rf-tile--a', m.result === 'L' && 'rf-tile--b', m.result === 'T' && 'rf-tile--t', m.biggest && 'rf-tile--big')}
                style={m.coachTeam !== file.coachTeam && m.result === 'W' ? clubVars(m.coachTeam, 'rf-a') : undefined}
                title={`${meetingLabel(m)}: ${m.coachTeam} ${m.for}, ${rivalName} ${m.against}${m.biggest ? ' (biggest margin)' : ''}`}
              >
                <b>
                  {m.for}-{m.against}
                </b>
                <span>
                  {m.season}
                  {m.playoff ? ' · P' : ''}
                </span>
                <span className="sr-only">
                  , {meetingLabel(m)}, {winner ? `${winner} win` : 'tie'}
                  {m.biggest ? ', biggest margin' : ''}
                </span>
              </li>
            );
          })}
        </ol>
        <ul className="rf-legend" aria-label="Key">
          <li>
            <i className="rf-sw rf-sw--a" /> {coachName} win
          </li>
          <li>
            <i className="rf-sw rf-sw--b" /> {rivalName} win
          </li>
          {file.record.t > 0 && (
            <li>
              <i className="rf-sw rf-sw--t" /> Tie
            </li>
          )}
          <li>
            <i className="rf-sw rf-sw--big" /> Biggest margin
          </li>
          {file.meetings.some((m) => m.playoff) && <li>P: playoffs</li>}
        </ul>
      </section>

      {/* The story so far */}
      {file.story.length > 0 && (
        <section className="rf-panel rf-story" aria-labelledby={`${file.id}-story`}>
          <h3 id={`${file.id}-story`} className="rf-rubric rf-rubric--gold">
            The story so far
          </h3>
          <ul>
            {file.story.map((line, i) => (
              <li key={i}>
                {line.map((part, j) =>
                  'b' in part ? (
                    <b key={j} className={cn('rf-tone', part.tone && `rf-tone--${part.tone}`)}>
                      {part.b}
                    </b>
                  ) : (
                    <span key={j}>{part.t}</span>
                  ),
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* In the papers */}
      {file.papers.length > 0 && (
        <section className="rf-panel rf-papers" aria-labelledby={`${file.id}-papers`}>
          <h3 id={`${file.id}-papers`} className="rf-rubric">
            In the papers
          </h3>
          <ul>
            {file.papers.map((p) => (
              <li key={p.id}>
                <button type="button" className="rf-paper" onClick={() => onPaper?.(p)} disabled={!onPaper}>
                  <span className="rf-paper__kicker">
                    {p.type === 'story' ? <Newspaper className="h-3 w-3" aria-hidden="true" /> : <Heat heat={p.heat ?? 1} />}
                    {p.season} {p.type === 'story' ? `Season Story${p.kind === 'rivalry' ? ' · Rivalry' : p.kind === 'lead' ? ' · Lead' : ''}` : 'Hot Take'}
                  </span>
                  <span className="rf-paper__title">{p.headline}</span>
                  <ChevronRight className="rf-paper__go h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
};

export default RivalryFileView;
