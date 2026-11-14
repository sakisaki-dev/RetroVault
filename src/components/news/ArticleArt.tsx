import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import { useJerseyNumbers } from '@/utils/jerseys';
import { bannerTeamOf } from '@/utils/playerExtras';
import { matchPlayerByName, type ArticleArtHint, type StoryKind } from '@/utils/leagueContent';
import { useGameSprites, type SpriteAction } from '@/utils/gameSprites';
import { useLiveSeason, type LiveSeason } from '@/utils/seasonLive';
import TeamLogo from '../brand/TeamLogo';
import GameSprite, { type SpriteSize } from '../GameSprite';
import './article-art.css';

/**
 * Article art drawn with the owner's private Retro Bowl sprites (this Mac only): every story, hot take and Did you know
 * gets a little scene built from its players and clubs. Without the sprites it renders nothing and the callers keep
 * today's club art and logos, so the public build is unchanged.
 *
 * Scenes (owner: "use the sprites in the news articles … VS or the turf weather snow etc, full creative liberty"):
 *   vs         two players squared up on a field split into their clubs' colours, the logos behind, a VS badge
 *   turf       one player on a yard-line field, his number big behind him, the club logo in a corner
 *   weather    the turf scene under his club's stadium sky: snow, rain, a dome, or clear
 *   podium     the top three on steps (quick hits)
 *   lineup     up to five players in a row (where are they now, quick hits)
 *   spotlight  one player under a cone tinted by the take's heat (Hot Takes)
 * A rule picks the scene from the article's kind, players and clubs (sceneFor); an article may override it with its
 * optional `art` hint (data/y80/stories.json, hot_takes.json; checked by scripts/story_check.py). Poses carry meaning:
 * celebrate (milestone, rise, the winner of a lead), stiffarm (a chase), run (a feature in motion), idle, and a "fall"
 * story is drawn in grey. Sprites never cover text: the scenes hold no text but the VS badge.
 */

export type Scene = 'vs' | 'turf' | 'weather' | 'podium' | 'lineup' | 'spotlight';
export type SkyKind = 'snow' | 'rain' | 'dome' | 'clear';

export interface SceneInput {
  kind?: StoryKind | 'take' | 'fact';
  players: string[];
  teams: string[];
  art?: ArticleArtHint;
  /** Hot take heat 1-3 */
  heat?: number;
}

interface Resolved {
  scene: Scene;
  cast: { p: Player; club: string }[];
  clubs: string[];
  sky: SkyKind;
  action: SpriteAction;
  grey: boolean;
}

/** A club's stadium sky from the save (save_state clubs): a roof, else snow or rain when its figures are high. */
export const skyOf = (live: LiveSeason | null | undefined, club: string | undefined): SkyKind => {
  const id = findNFLTeam(club)?.id;
  const c = id && live ? Object.entries(live.clubs).find(([name]) => findNFLTeam(name)?.id === id)?.[1] : undefined;
  if (!c || c.rainfall === undefined) return 'clear';
  if ((c.roof ?? 0) > 0) return 'dome';
  if ((c.snowfall ?? 0) >= 50) return 'snow';
  if ((c.rainfall ?? 0) >= 55) return 'rain';
  return 'clear';
};

const ACTION: Partial<Record<NonNullable<SceneInput['kind']>, SpriteAction>> = {
  lead: 'celebrate',
  milestone: 'celebrate',
  rise: 'celebrate',
  chase: 'stiffarm',
  feature: 'run',
};

/** The rule: which scene, cast and sky an article gets when it carries no `art` hint (or only part of one). */
export const sceneFor = (a: SceneInput, players: Player[], live: LiveSeason | null | undefined): Resolved | null => {
  const names = a.art?.players?.length ? a.art.players : a.players;
  const cast = names
    .map((n) => matchPlayerByName(n, players))
    .filter((p): p is Player => !!p && !p.isRealLegend)
    .map((p) => ({ p, club: bannerTeamOf(p) }));
  const clubs = (a.art?.teams?.length ? a.art.teams : a.teams).filter((t) => !!findNFLTeam(t));
  const kind = a.kind;
  let scene: Scene | undefined = a.art?.scene;
  if (!scene) {
    if (kind === 'take') scene = 'spotlight';
    else if (kind === 'quickhits') scene = cast.length >= 3 ? 'podium' : 'lineup';
    else if (kind === 'wherenow') scene = 'lineup';
    else if ((kind === 'lead' || kind === 'rivalry' || kind === 'trade') && clubs.length >= 2) scene = 'vs';
    else scene = 'turf';
  }
  // a VS needs a man on each side: the first named player of each club, else the club's logo stands alone
  let castFor = cast;
  if (scene === 'vs') {
    const sideOf = (club: string) => cast.find((c) => findNFLTeam(c.club)?.id === findNFLTeam(club)?.id);
    const a1 = clubs[0] ? sideOf(clubs[0]) : cast[0];
    const a2 = clubs[1] ? sideOf(clubs[1]) : cast.find((c) => c !== a1);
    castFor = [a1, a2].filter((c): c is { p: Player; club: string } => !!c);
    if (clubs.length < 2 && castFor.length < 2) scene = 'turf';
  }
  if (scene !== 'vs' && !cast.length) return null;
  const main = castFor[0]?.club ?? clubs[0];
  const sky: SkyKind = a.art?.weather ?? (scene === 'weather' || scene === 'turf' ? skyOf(live, main) : 'clear');
  return {
    scene,
    cast: scene === 'turf' || scene === 'weather' || scene === 'spotlight' ? castFor.slice(0, 1) : scene === 'podium' ? castFor.slice(0, 3) : castFor.slice(0, 5),
    clubs: clubs.length ? clubs : castFor.map((c) => c.club),
    sky,
    action: (kind ? ACTION[kind] : undefined) ?? 'idle',
    grey: kind === 'fall',
  };
};

const clubVars = (a?: string, b?: string): CSSProperties => {
  const t1 = findNFLTeam(a);
  const t2 = findNFLTeam(b) ?? t1;
  return {
    '--na-c1': t1 ? `hsl(${t1.primaryColor})` : 'hsl(226 33% 28%)',
    '--na-c1b': t1 ? `hsl(${t1.secondaryColor})` : 'hsl(226 33% 40%)',
    '--na-c2': t2 ? `hsl(${t2.primaryColor})` : 'hsl(226 33% 28%)',
  } as CSSProperties;
};

const Sky = ({ sky }: { sky: SkyKind }) =>
  sky === 'clear' ? null : <span className={cn('na-sky', `na-sky--${sky}`)} aria-hidden="true" />;

interface Props extends SceneInput {
  players: string[];
  league: Player[];
  /** thumb (story list), side (a column thumbnail: takes, facts), card (a strip), hero (the reading sheet's header) */
  variant?: 'thumb' | 'side' | 'card' | 'hero';
  className?: string;
  /** Shown instead when there is no scene (no sprites on this machine, or nobody to draw): today's club art */
  fallback?: ReactNode;
}

const SIZE: Record<NonNullable<Props['variant']>, SpriteSize> = { thumb: 's', side: 'm', card: 'm', hero: 'l' };

/** The scene for one article, or null without sprites (callers keep their club art). */
const ArticleArt = ({ league, variant = 'card', className, fallback = null, ...input }: Props) => {
  const sprites = useGameSprites();
  const live = useLiveSeason();
  const { numberFor } = useJerseyNumbers();
  const r = useMemo(() => (sprites ? sceneFor(input, league, live) : null), [sprites, input, league, live]);
  if (!sprites || !r) return <>{fallback}</>;
  const size = SIZE[variant];
  const small = variant === 'hero' ? 'm' : 's';
  const label = `${r.scene === 'vs' ? 'Face-off' : 'Scene'}: ${r.cast.map((c) => c.p.name).join(', ')}`;
  const root = cn('na', `na--${variant}`, `na--${r.scene}`, r.grey && 'na--grey', r.scene === 'spotlight' && `na--heat${input.heat ?? 1}`, className);

  if (r.scene === 'vs') {
    const [a, b] = r.cast;
    return (
      <div className={root} style={clubVars(r.clubs[0] ?? a?.club, r.clubs[1] ?? b?.club)} role="img" aria-label={label}>
        <span className="na-half na-half--a" aria-hidden="true">
          <TeamLogo team={r.clubs[0] ?? a?.club} size={variant === 'hero' ? 120 : 64} decorative className="na-logo" />
        </span>
        <span className="na-half na-half--b" aria-hidden="true">
          <TeamLogo team={r.clubs[1] ?? b?.club} size={variant === 'hero' ? 120 : 64} decorative className="na-logo" />
        </span>
        <span className="na-turfline" aria-hidden="true" />
        <span className="na-slot na-slot--a">{a && <GameSprite player={a.p} team={a.club} kind="figure" size={size} action={input.kind === 'lead' ? 'celebrate' : 'idle'} />}</span>
        <span className="na-vs" aria-hidden="true">
          VS
        </span>
        <span className="na-slot na-slot--b">{b && <GameSprite player={b.p} team={b.club} kind="figure" size={size} />}</span>
      </div>
    );
  }

  if (r.scene === 'podium' || r.scene === 'lineup') {
    const order = r.scene === 'podium' && r.cast.length === 3 ? [r.cast[1], r.cast[0], r.cast[2]] : r.cast;
    return (
      <div className={root} style={clubVars(r.cast[0]?.club)} role="img" aria-label={label}>
        <span className="na-field" aria-hidden="true" />
        <div className="na-row">
          {order.map((c, i) => (
            <span key={c.p.name} className={cn('na-slot', r.scene === 'podium' && `na-step na-step--${order.length === 3 ? [2, 1, 3][i] : i + 1}`)}>
              <GameSprite player={c.p} team={c.club} kind="figure" size={small} action={r.scene === 'podium' && c === r.cast[0] ? 'celebrate' : 'idle'} />
            </span>
          ))}
        </div>
      </div>
    );
  }

  const c = r.cast[0];
  return (
    <div className={root} style={clubVars(c.club)} role="img" aria-label={label}>
      <span className="na-field" aria-hidden="true" />
      {r.scene === 'spotlight' ? <span className="na-cone" aria-hidden="true" /> : <span className="na-num" aria-hidden="true">{numberFor(c.p) ?? ''}</span>}
      <TeamLogo team={c.club} size={variant === 'hero' ? 44 : variant === 'side' ? 22 : 28} decorative className="na-corner" />
      <Sky sky={r.sky} />
      <span className="na-slot na-slot--solo">
        <GameSprite player={c.p} team={c.club} kind="figure" size={size} action={r.action} />
      </span>
    </div>
  );
};

export default ArticleArt;
