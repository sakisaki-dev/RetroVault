import type { CSSProperties } from 'react';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import type { RivalryFile } from '@/utils/rivalryFiles';
import { clubStyle } from '@/components/stats/visual/clubTone';
import CoachSprite from '@/components/CoachSprite';
import TeamLogo from '@/components/brand/TeamLogo';
import { Figure } from '../Screensaver';
import './liveScenes.css';

/*
 * Rivalry night: a rivalry file (content.json rivalryFiles, lasting first then lapsed) on a split field in the two
 * clubs' colours: the coach's club on the left with Skura on the sideline, the rival on the right, each side's star
 * from the file, the series record, the longest streak, the biggest margin and the last meetings as results.
 */
export interface RivalryNightData { file: RivalryFile; a: Player | null; b: Player | null }

const Side = ({ club, star, p, right, sprites, coach }: { club: string; star?: RivalryFile['stars']['coach']; p: Player | null; right?: boolean; sprites: boolean; coach?: boolean }) => (
  <div className={`lv-rn__side ${right ? 'lv-rn__side--r' : ''}`}>
    <span className="lv-rn__logo" aria-hidden="true">
      <TeamLogo team={club} size={340} decorative />
    </span>
    <div className="lv-rn__men">
      {coach && sprites && (
        <span className="lv-rn__coach">
          <CoachSprite who="head" team={club} kind="figure" size="m" />
          <em>Skura</em>
        </span>
      )}
      {p && (
        <div className="lv-rn__man" style={clubStyle(p) as CSSProperties}>
          <Figure player={p} sprites={sprites} scale={1.6} mirror={right} action="stiffarm" />
          <span className="sv-line__name">{p.name.split(' ').slice(-1)[0]}</span>
          {star && <span className="sv-line__cl">{star.pos} · {Math.round(star.legacy).toLocaleString('en-US')}</span>}
        </div>
      )}
    </div>
    <h3 className="lv-rn__club">{club}</h3>
  </div>
);

const RivalryNightScene = ({ data, sprites }: { data: RivalryNightData; sprites: boolean }) => {
  const { file: f, a, b } = data;
  const ta = findNFLTeam(f.coachTeam);
  const tb = findNFLTeam(f.team);
  const last = f.meetings.slice(-6);
  const streakClub = f.streak.games > 0 ? findNFLTeam(f.streak.team)?.abbreviation ?? f.streak.team : null;
  const bigWinner = findNFLTeam(f.biggest.winner)?.abbreviation ?? f.biggest.winner;
  const style = {
    '--a': `hsl(${ta?.primaryColor ?? '220 60% 30%'})`,
    '--b': `hsl(${tb?.primaryColor ?? '0 60% 30%'})`,
  } as CSSProperties;
  return (
    <div className="lv-rn" style={style}>
      <span className="lv-rn__turf" aria-hidden="true" />
      <Side club={ta?.name ?? f.coachTeam} star={f.stars.coach} p={a} sprites={sprites} coach />
      <div className="lv-rn__mid">
        <p className="sv-kick">
          Rivalry night · {f.status === 'lasting' ? 'a lasting rivalry' : 'a past rivalry'} · {f.first}–{f.last}
        </p>
        <div className="lv-rn__board">
          <div className="lv-rn__score">
            <span>{ta?.abbreviation}</span>
            <b>{f.record.text}</b>
            <span>{tb?.abbreviation}</span>
          </div>
          <p>{f.games} meetings · {f.pointsFor}–{f.pointsAgainst} points</p>
        </div>
        <span className="lv-rn__vs">VS</span>
        <ul className="lv-rn__facts">
          {streakClub && (
            <li>
              <small>Longest streak</small>
              {streakClub} won {f.streak.games} straight{f.streak.from && f.streak.to ? `, ${f.streak.from.season}–${f.streak.to.season}` : ''}
            </li>
          )}
          {f.biggest.season && (
            <li>
              <small>Biggest margin</small>
              {bigWinner} {Math.max(f.biggest.for, f.biggest.against)}–{Math.min(f.biggest.for, f.biggest.against)}, {f.biggest.season} week {f.biggest.week}
            </li>
          )}
        </ul>
        <ol className="lv-rn__last" aria-label="Latest meetings">
          {last.map((m, i) => (
            <li key={`${m.season}-${m.week}-${i}`} className={`is-${m.result}`}>
              <b>{m.result}</b>
              <span>{m.for}–{m.against}</span>
              <small>{m.season}</small>
            </li>
          ))}
        </ol>
      </div>
      <Side club={tb?.name ?? f.team} star={f.stars.rival} p={b} right sprites={sprites} />
    </div>
  );
};

export default RivalryNightScene;
