import { useMemo, type CSSProperties } from 'react';
import type { LeagueData, Player } from '@/types/player';
import { leaguePlayers } from '@/config/advanced';
import { playerKey } from '@/config/ovr';
import { isHallOfFamer } from '@/config/stats';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { useCurrentClub } from '@/utils/club';
import { useLeagueContent, latestSeasonYear } from '@/utils/leagueContent';
import { useGameSprites } from '@/utils/gameSprites';
import { useFieldArt } from '@/components/teamlab/fieldArt';
import { peekProps } from '@/components/peek/peekProps';
import { fmtNum } from '../analytics/viz';
import type { RecordBoardData, RecordBook } from '../records';
import GameSprite from '../../GameSprite';
import TeamLogo from '../../brand/TeamLogo';
import CountUp from '../../brand/CountUp';
import { clubStyle } from './clubTone';
import './statsStadium.css';

/*
 * The Stats › Players opener (owner, 2026-11-17: "change this part to be more immersive", the header and headline cards):
 * a night stadium. The jumbotron carries the page title and the league's counts (players, Hall of Famers, 90+ OVR,
 * records) on LED panels; under it the league's greatest (top Career Legacy, the best in the middle) stand on the turf
 * in their club kits, each under a plate with his headline record or his Career Legacy (tap: his card, hold: the quick look); the closest record chase runs on a side scoreboard. The
 * stands, crowd and turf are the game's own art painted to the current club (useFieldArt); the public build draws
 * CSS stands and turf and club logos for the players.
 */

interface Holder {
  player: Player;
  boards: RecordBoardData[];
}

const ELITE_OVR = 90;
const LINEUP = 9;

const StatsStadium = ({ data, book, headline, onSelect }: { data: LeagueData; book: RecordBook; headline: RecordBoardData[]; onSelect: (p: Player) => void }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const ovrMap = useOfficialOvr();
  const club = useCurrentClub() ?? 'Eagles';
  const { content } = useLeagueContent();
  const season = latestSeasonYear(content);
  const art = useFieldArt(club, 'night');
  const sprites = useGameSprites();

  const hof = useMemo(() => players.filter(isHallOfFamer).length, [players]);
  const elite = useMemo(() => players.filter((p) => (ovrMap.get(playerKey(p)) ?? 0) >= ELITE_OVR).length, [players, ovrMap]);

  // the league's greatest on the turf (owner: "add more since these 5 are not the greatest"): the top Career Legacy
  // players, the best in the middle; each plate names his headline record when he holds one, else his Career Legacy
  const holders = useMemo(() => {
    const recs = new Map<string, RecordBoardData[]>();
    headline.forEach((b) => {
      const p = b.entries[0]?.player;
      if (!p) return;
      const k = playerKey(p);
      recs.set(k, [...(recs.get(k) ?? []), b]);
    });
    const top = [...players].sort((a, b) => b.careerLegacy - a.careerLegacy).slice(0, LINEUP);
    const ranked: Holder[] = top.map((p) => ({ player: p, boards: recs.get(playerKey(p)) ?? [] }));
    // the best in the middle, the rest fanning out to either side
    const out: Holder[] = [];
    ranked.forEach((h, i) => (i % 2 ? out.push(h) : out.unshift(h)));
    return { list: out, best: ranked[0] ? playerKey(ranked[0].player) : '' };
  }, [headline, players]);
  const chase = book.pace[0];

  const stageStyle = {
    ...(art.stands ? { '--ss-stands': `url(${art.stands})` } : {}),
    ...(art.crowd ? { '--ss-crowd': `url(${art.crowd})` } : {}),
    ...(art.turf ? { '--ss-turf': `url(${art.turf})` } : {}),
  } as CSSProperties;

  return (
    <section className={`ss ${art.turf ? 'ss--art' : ''}`} style={stageStyle} aria-labelledby="stats-title">
      <span className="ss__sky" aria-hidden="true" />
      <span className="ss__lights" aria-hidden="true" />
      <span className="ss__stands" aria-hidden="true" />
      <span className="ss__crowd" aria-hidden="true" />
      <span className="ss__turf" aria-hidden="true" />

      {/* The jumbotron: the page title and the league's counts */}
      <div className="ss__tron">
        <p className="ss__kick">League Hub · Players{season ? ` · Y${season}` : ''}</p>
        <h1 id="stats-title" className="ss__title">
          Stats <span>&amp;</span> Records
        </h1>
        <dl className="ss__leds">
          <div>
            <dt>Players</dt>
            <dd>
              <CountUp value={players.length} />
            </dd>
          </div>
          <div>
            <dt>Hall of Famers</dt>
            <dd>
              <CountUp value={hof} />
            </dd>
          </div>
          <div>
            <dt>{ELITE_OVR}+ OVR</dt>
            <dd>{ovrMap.size ? <CountUp value={elite} /> : '–'}</dd>
          </div>
          <div>
            <dt>Records</dt>
            <dd>
              <CountUp value={book.boards.size} />
            </dd>
          </div>
        </dl>
      </div>

      {/* The closest record chase, on its own scoreboard */}
      {chase && (
        <button type="button" className="ss__chase" style={clubStyle(chase.player)} {...peekProps(chase.player)} onClick={() => onSelect(chase.player)}>
          <span className="ss__chase-k">Live chase</span>
          <span className="ss__chase-name">{chase.player.name}</span>
          <span className="ss__chase-rec">{chase.recordName}</span>
          <span className="ss__chase-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, chase.percentToRecord)}%` }} />
          </span>
          <span className="ss__chase-num">
            <b>{Math.floor(chase.percentToRecord)}%</b> of {fmtNum(chase.recordValue, 0)} · ETA {chase.seasonsToBreak} {chase.seasonsToBreak === 1 ? 'season' : 'seasons'}
          </span>
        </button>
      )}

      {/* The record holders on the turf */}
      <ul className="ss__lineup" aria-label="The league's greatest, by Career Legacy">
        {holders.list.map((h, i) => {
          const b = h.boards[0];
          const best = playerKey(h.player) === holders.best;
          return (
            <li key={playerKey(h.player)} className={best ? 'ss__man ss__man--best' : 'ss__man'} style={{ ...clubStyle(h.player), '--i': i } as CSSProperties}>
              <button
                type="button"
                className="ss__man-hit"
                {...peekProps(h.player)}
                onClick={() => onSelect(h.player)}
                aria-label={`${h.player.name}, Career Legacy ${fmtNum(h.player.careerLegacy, 0)}${h.boards.length ? `, holds the ${h.boards.map((x) => x.title).join(', ')} record` : ''}. Open player`}
              >
                <span className="ss__plate" aria-hidden="true">
                  {b ? (
                    <>
                      <span className="ss__plate-k">{b.short}</span>
                      <span className="ss__plate-v">{fmtNum(b.entries[0].value, b.decimals)}</span>
                      {h.boards.length > 1 && <span className="ss__plate-more">+{h.boards.length - 1}</span>}
                    </>
                  ) : (
                    <>
                      <span className="ss__plate-k">Legacy</span>
                      <span className="ss__plate-v">{fmtNum(h.player.careerLegacy, 0)}</span>
                    </>
                  )}
                </span>
                <span className="ss__fig" aria-hidden="true">
                  <span className="ss__shadow" />
                  {sprites && !h.player.isRealLegend ? (
                    <GameSprite player={h.player} kind="figure" size="m" action={best ? 'celebrate' : 'idle'} className="ss__sprite" />
                  ) : (
                    <span className="ss__logo">
                      <TeamLogo team={h.player.team} size={56} decorative />
                    </span>
                  )}
                </span>
                <span className="ss__name">{h.player.name.split(' ').slice(-1)[0]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default StatsStadium;
