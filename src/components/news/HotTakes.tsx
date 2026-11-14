import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ChevronRight, Flame, Newspaper } from 'lucide-react';
import type { Player } from '@/types/player';
import { useHotTakes, type HotTake, type TakeHeat } from '@/utils/leagueContent';
import TeamLogo from '@/components/brand/TeamLogo';
import { mainClubOf, teamVars } from './clubArt';
import './news-art.css';
import { ClubChips } from './ClubChips';
import { SourcedFigure } from './SourcedFigure';
import { FeatureSheet, type SheetPiece } from './FeatureSheet';
import ArticleArt from './ArticleArt';
import './takes.css';

/**
 * Hot Takes: the fourth AI-authored lane (data/y80/hot_takes.json, written only by a takes.set upload;
 * scripts/story_check.py checks every figure like the Season Story's). Shown on the Timeline under the Season Story,
 * for the season its switcher shows; a season without takes falls back to the latest season that has them.
 * public/data/league/takes.json (every season, newest first) loads once, on demand (useHotTakes).
 *
 * Laid out as an opinion column: each take is a numbered entry in its subject's club colours (edge and logo; the take's
 * first team, else its first player's best-known club) with a small heat meter (1-3 pixel flames), the take as
 * its headline, the dek, the first figure as an inline number (its source on hover or tap), player chips in club
 * colours. The argument opens in the reading sheet (FeatureSheet.tsx): the heat, the subject's club header, the body,
 * the figures as a box score with their sources, and previous / next take. openHotTake(id) opens one from anywhere.
 */

const HEAT_LABEL: Record<TakeHeat, string> = { 1: 'Warm', 2: 'Hot', 3: 'Scorching' };

/** A 7 x 9 pixel flame, one rect per lit pixel (rows top to bottom) */
const FLAME = ['...#...', '...##..', '..###..', '.####..', '.#####.', '###.###', '##...##', '##...##', '.#####.'];
const CORE = ['.......', '.......', '.......', '.......', '...#...', '...#...', '..###..', '..###..', '.......'];
const pixels = (rows: string[]) => rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? [x, y] : null)).filter((p): p is number[] => !!p));
const FLAME_PX = pixels(FLAME);
const CORE_PX = pixels(CORE);

const PixelFlame = ({ lit, big }: { lit: boolean; big?: boolean }) => (
  <svg className="ht-flame" data-lit={lit || undefined} viewBox="0 0 7 9" width={big ? 28 : 9} height={big ? 36 : 12} shapeRendering="crispEdges" aria-hidden="true">
    {FLAME_PX.map(([x, y]) => (
      <rect key={`f${x}-${y}`} x={x} y={y} width="1" height="1" className="ht-flame__outer" />
    ))}
    {lit && CORE_PX.map(([x, y]) => <rect key={`c${x}-${y}`} x={x} y={y} width="1" height="1" className="ht-flame__core" />)}
  </svg>
);

export const HeatMeter = ({ heat, big }: { heat: TakeHeat; big?: boolean }) => (
  <span className={big ? 'ht-heat ht-heat--big' : 'ht-heat'} data-heat={heat} role="img" aria-label={`Heat ${heat} of 3: ${HEAT_LABEL[heat]}`}>
    <span className="ht-heat__flames">
      {[1, 2, 3].map((n) => (
        <PixelFlame key={n} lit={n <= heat} big={big} />
      ))}
    </span>
    <span className="ht-heat__label">{HEAT_LABEL[heat]}</span>
  </span>
);

const TakeCard = ({ take, players, onPlayer, index, onOpen }: { take: HotTake; players: Player[]; onPlayer: (p: Player) => void; index: number; onOpen: (id: string) => void }) => {
  const lead = take.stats[0];
  const club = mainClubOf(take, players);
  return (
    <li className="ht-item stagger-in" data-heat={take.heat} style={{ ...teamVars(club), '--i': index } as CSSProperties}>
      <button type="button" className="ss-cover" onClick={() => onOpen(take.id)} aria-label={`Read the argument: ${take.headline}`} />
      <div className="ht-item__main">
        {/* an opinion column's kicker: the number and the heat on one line */}
        <p className="ht-item__kicker">
          <span className="ht-item__n">{String(index + 1).padStart(2, '0')}</span>
          <HeatMeter heat={take.heat} />
        </p>
        <h4 className="ht-item__title">{take.headline}</h4>
        <p className="ht-item__dek">{take.dek}</p>
        <div className="ht-item__foot">
          {lead && <SourcedFigure stat={lead} className="ht-item__fig" />}
          <ClubChips names={take.players} teams={take.teams} players={players} onPlayer={onPlayer} max={1} label="Players in this take" />
        </div>
        <span className="ht-read" aria-hidden="true">
          Read the argument <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      {/* the art as a column thumbnail: his scene where the sprites exist, the club's logo tile otherwise */}
      <ArticleArt
        variant="side"
        kind="take"
        heat={take.heat}
        players={take.players}
        teams={take.teams}
        art={take.art}
        league={players}
        className="ht-item__art"
        fallback={
          club ? (
            <span className="ht-item__art ht-item__tile" aria-hidden="true">
              <TeamLogo team={club} size={56} decorative className="ht-item__logo" />
            </span>
          ) : null
        }
      />
    </li>
  );
};

/** Pending "open this take" request (set before the Timeline mounts, read when it does), like openSeasonStory */
let pending: string | null = null;
const OPEN_EVENT = 'rv:open-take';
export const openHotTake = (id: string) => {
  pending = id;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
};

const takeWords = (t: HotTake) => [t.dek, ...t.body].join(' ').split(/\s+/).filter(Boolean).length;

interface Props {
  /** The season the Season Story shows ("Y90") */
  season: string;
  players: Player[];
  onPlayer: (p: Player) => void;
}

export const HotTakesDesk = ({ season, players, onPlayer }: Props) => {
  const { seasons, loading, failed } = useHotTakes();
  const exact = seasons.find((s) => s.season === season);
  const shown = exact ?? seasons[0];
  const [openId, setOpenId] = useState<string | null>(null);
  const onOpen = useCallback((id: string) => setOpenId(id), []);
  // Requests from elsewhere (openHotTake): one made before this mounted, and any made while it is mounted
  useEffect(() => {
    if (pending) {
      setOpenId(pending);
      pending = null;
    }
    const on = (e: Event) => {
      pending = null;
      setOpenId(String((e as CustomEvent).detail));
    };
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);
  // the open take's season (any season, so a deep link works whichever season the story desk shows)
  const openSeason = openId ? seasons.find((s) => s.takes.some((t) => t.id === openId)) : undefined;
  const openAt = openSeason ? openSeason.takes.findIndex((t) => t.id === openId) : -1;
  const openTake = openSeason?.takes[openAt];
  const piece: SheetPiece | null =
    openSeason && openTake
      ? {
          id: openTake.id,
          kicker: (
            <>
              <HeatMeter heat={openTake.heat} big />
              <span>
                Hot Take No. {String(openAt + 1).padStart(2, '0')} · {openSeason.season}
              </span>
            </>
          ),
          headline: openTake.headline,
          dek: openTake.dek,
          byline: (
            <>
              <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> Opinion · Retro Vault Desk
              <span aria-hidden="true">·</span> {Math.max(1, Math.ceil(takeWords(openTake) / 200))} min read
            </>
          ),
          body: openTake.body,
          stats: openTake.stats,
          players: openTake.players,
          teams: openTake.teams,
          hero: { teams: [mainClubOf(openTake, players)].filter(Boolean), mode: 'one' },
          scene: { kind: 'take', heat: openTake.heat, players: openTake.players, teams: openTake.teams, art: openTake.art },
          position: `Take ${openAt + 1} of ${openSeason.takes.length}`,
          sourcesNote: 'Every figure is checked against the league data when the takes are published.',
          className: `fs--take fs--heat-${openTake.heat}`,
        }
      : null;
  const link = (t: HotTake | undefined, label: string) => (t ? { headline: t.headline, label, onGo: () => setOpenId(t.id) } : null);
  if (!loading && !shown && !failed) return null; // no takes in any season yet: nothing to show
  return (
    <section className="ht" aria-labelledby="ht-title" aria-busy={loading || undefined}>
      <header className="ht-mast">
        <p className="ht-mast__kicker">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Opinion · Retro Vault Desk
        </p>
        <h3 id="ht-title" className="ht-mast__title">
          Hot Takes{shown ? <span className="ht-mast__season"> · {shown.season}</span> : null}
        </h3>
        {shown?.intro && <p className="ht-mast__intro">{shown.intro}</p>}
        {shown && !exact && (
          <p className="ht-mast__note">
            No hot takes for {season} yet. Showing {shown.season}.
          </p>
        )}
      </header>
      {loading ? (
        <p className="ht-empty" role="status">
          <span className="ss-loading__dot" aria-hidden="true" /> Heating up the takes…
        </p>
      ) : !shown ? (
        <p className="ht-empty" role="status">
          The hot takes could not be loaded. Try again in a moment.
        </p>
      ) : (
        <ol className="ht-list" aria-label={`${shown.season} hot takes`}>
          {shown.takes.map((t, i) => (
            <TakeCard key={t.id} take={t} players={players} onPlayer={onPlayer} index={i} onOpen={onOpen} />
          ))}
        </ol>
      )}
      <FeatureSheet
        piece={piece}
        onClose={() => setOpenId(null)}
        prev={link(openSeason?.takes[openAt - 1], 'Previous take')}
        next={link(openSeason?.takes[openAt + 1], 'Next take')}
        players={players}
        onPlayer={onPlayer}
      />
      <p className="ht-foot">Every figure is checked against the league data when the takes are published. Tap a number for its source.</p>
    </section>
  );
};
