import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Clock, CornerDownRight, Newspaper, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import {
  matchPlayerByName,
  storyEntryOf,
  useLeagueContent,
  useSeasonStory,
  type SeasonStory,
  type SeasonStoryIndexEntry,
  type StoryArticle,
  type StoryKind,
  type StoryStat,
} from '@/utils/leagueContent';
import { FeatureSheet, type SheetPiece } from './FeatureSheet';
import { DidYouKnowDeck } from './DidYouKnow';
import { HotTakesDesk } from './HotTakes';
import { ClubChips } from './ClubChips';
import { HeroLogos, PlayerBanners, StoryThumb, firstClubIn, mainClubOf, pairOf, teamVars } from './clubArt';
import TeamLogo from '@/components/brand/TeamLogo';
import TeamPhoto from './TeamPhoto';
import ArticleArt from './ArticleArt';
import GameSprite from '@/components/GameSprite';
import { useReveal } from '@/components/motion/Reveal';
import { peekProps } from '@/components/peek/peekProps';
import { bannerTeamOf } from '@/utils/playerExtras';
import { getTeamTextColor } from '@/utils/teamColors';
import { FillGrid } from './FillGrid';
import { Rubric } from './Rubric';
import './news-art.css';
import './story.css';
import './newsFeed.css';
import PixelLoader from '@/components/ui/PixelLoader';
import { RivalryFileStrip } from '@/components/rivalry/RivalryFilesRow';
import { rivalryFilesOf } from '@/utils/rivalryFiles';

/**
 * Season Story: the AI-authored news package for each completed season (data/y80/stories.json, written only by a
 * story.set upload; scripts/story_check.py checks every figure against the data). Shown on the Timeline in the
 * "What changed" area as a sports front page: a newspaper-flag masthead with the season switcher, the lead story as a
 * hero (its first figure as the big "photo" number in club colours), Top stories (the next three) as a compact list,
 * the Did you know rail (DidYouKnow.tsx), More stories in a two-column list, and Quick hits as a numbered brief list.
 * From 1024px the lead sits beside Top stories and Did you know and Quick hits form the sidebar. Story items carry
 * one small stat badge; the reading sheet holds the full article, its figures and their sources.
 *
 * Below the front page: the season's Hot Takes (HotTakes.tsx, the fourth AI lane), following the season switcher.
 *
 * openSeasonStory(id) opens an article from anywhere (the Arcade ticker uses it after switching to the Timeline).
 *
 * content.json carries only the story index (seasonStoryIndex); each season's full story is its own file, loaded when
 * that season is shown (useSeasonStory). A deep link finds its season in the index, switches to it, and the reading
 * sheet opens once the season's file is in. "Continued from" and "Read next" links read their headlines from the index.
 */

export const KIND_LABEL: Record<StoryKind, string> = {
  lead: 'Lead story',
  feature: 'Feature',
  trade: 'Trade',
  rise: 'Rising',
  fall: 'Falling',
  rivalry: 'Rivalry',
  chase: 'Record watch',
  milestone: 'Milestone',
  wherenow: 'Where are they now',
  quickhits: 'Quick hits',
};

/** One accent per article kind (the card's top stripe and the section's rule) */
export const KIND_ACCENT: Record<StoryKind, string> = {
  lead: '#ffc83d', feature: '#2dd4bf', trade: '#5cc8ff', rise: '#3ddc84', fall: '#ff5a61', rivalry: '#ff9f43', chase: '#ffc83d',
  milestone: '#f5a524', wherenow: '#b69cff', quickhits: '#ffc83d',
};
/** The feed's sections, in reading order: which kinds each holds (an unlisted kind falls into More) */
const GROUPS: { id: string; label: string; kinds: StoryKind[] }[] = [
  { id: 'features', label: 'Features', kinds: ['feature'] },
  { id: 'trades', label: 'Trades', kinds: ['trade'] },
  { id: 'movers', label: 'Risers and fallers', kinds: ['rise', 'fall'] },
  { id: 'rivalries', label: 'Rivalries', kinds: ['rivalry'] },
  { id: 'records', label: 'Records and milestones', kinds: ['chase', 'milestone'] },
  { id: 'wherenow', label: 'Where are they now', kinds: ['wherenow'] },
];

const BYLINE = 'Retro Vault Desk';
const words = (a: StoryArticle) => [a.dek, ...a.body].join(' ').split(/\s+/).filter(Boolean).length;
export const readTime = (a: StoryArticle) => `${Math.max(1, Math.ceil(words(a) / 200))} min read`;

/** Pending "open this article" request (set before the Timeline mounts, read when it does) */
let pending: string | null = null;
const OPEN_EVENT = 'rv:open-story';
export const openSeasonStory = (id: string) => {
  pending = id;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
};

/** An article's season and index row (id, kind, headline), from the story index */
const findRef = (index: SeasonStoryIndexEntry[], id: string) => {
  const entry = storyEntryOf(index, id);
  const article = entry?.articles.find((x) => x.id === id);
  return entry && article ? { season: entry.season, article } : null;
};

/** The figure to blow up on a card: the first stat */
const callout = (a: StoryArticle): StoryStat | undefined => a.stats[0];

/** Hero art for an article: a rivalry or a title game shows two clubs facing off, a trade its two clubs, else one */
const heroOf = (a: StoryArticle, players: Player[]): { teams: string[]; mode: 'one' | 'vs' | 'trade' } => {
  const pair = pairOf(a.kind, a.teams);
  if (pair) return { teams: pair, mode: a.kind === 'trade' ? 'trade' : 'vs' };
  if (a.kind === 'lead' && a.teams.length >= 2 && /^Super Bowl/.test(a.stats[0]?.label ?? '')) return { teams: a.teams.slice(0, 2), mode: 'vs' };
  return { teams: [mainClubOf(a, players)].filter(Boolean), mode: 'one' };
};

const KindLabel = ({ kind }: { kind: StoryKind }) => <span className={cn('ss-kind en-kind', `ss-kind--${kind}`)}>{KIND_LABEL[kind]}</span>;

const StatCallouts = ({ stats, max }: { stats: StoryStat[]; max?: number }) => {
  const shown = max ? stats.slice(0, max) : stats;
  if (!shown.length) return null;
  return (
    <dl className="ss-callouts" data-n={shown.length}>
      {shown.map((s) => (
        <div key={s.label} className="ss-callout" title={s.source ? `Source: ${s.source}` : undefined}>
          <dd className="ss-callout__value">{s.value}</dd>
          <dt className="ss-callout__label">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
};

/** Small inline stat badges (value + label; the source on hover) */
const StatBadges = ({ stats }: { stats: StoryStat[] }) =>
  stats.length ? (
    <ul className="ss-badges" aria-label="Key figures">
      {stats.map((s) => (
        <li key={s.label} className="ss-badge" title={s.source ? `Source: ${s.source}` : undefined}>
          <b>{s.value}</b> <span>{s.label}</span>
        </li>
      ))}
    </ul>
  ) : null;

interface ItemProps {
  a: StoryArticle;
  i: number;
  season: string;
  index: SeasonStoryIndexEntry[];
  players: Player[];
  onPlayer: (p: Player) => void;
  onRead: (id: string) => void;
  onOpen: (id: string) => void;
}

/** A rivalry article about a club with a rivalry file links to the file (the first such club it names) */
const useRivalryFileOf = (a: StoryArticle) => {
  const { content } = useLeagueContent();
  return useMemo(() => {
    if (a.kind !== 'rivalry') return undefined;
    const files = rivalryFilesOf(content);
    return a.teams.map((t) => files.find((f) => f.team === t)).find(Boolean);
  }, [a, content]);
};

/** One story in the front page's lists: kind and read time, headline, dek, one stat badge, chips */
interface Cell {
  style: CSSProperties;
  wide: boolean;
}
const StoryItem = ({ a, i, season, index, players, onPlayer, onRead, onOpen, cell }: ItemProps & { cell?: Cell }) => {
  const reveal = useReveal<HTMLLIElement>();
  const c = callout(a);
  const file = useRivalryFileOf(a);
  const prior = a.related.map((id) => findRef(index, id)).find((r) => r && r.season !== season);
  const club = mainClubOf(a, players);
  return (
    <li ref={reveal} className={cn('ss-item mo-auto en-card', cell?.wide && 'en-card--wide')} data-kind={a.kind} style={{ ...teamVars(club), '--k': KIND_ACCENT[a.kind], '--i': Math.min(i, 5), ...cell?.style } as CSSProperties}>
      <button type="button" className="ss-cover" onClick={() => onRead(a.id)} aria-label={`Read: ${a.headline}`} />
      <div className="ss-item__head">
        <div className="ss-item__headtext">
          <p className="ss-item__meta">
            <KindLabel kind={a.kind} />
            <span className="ss-item__time">{readTime(a)}</span>
          </p>
          <h4 className="ss-item__title">{a.headline}</h4>
        </div>
        <ArticleArt variant="thumb" kind={a.kind} players={a.players} teams={a.teams} art={a.art} league={players} fallback={<StoryThumb kind={a.kind} teams={a.teams} club={club} />} />
      </div>
      <p className="ss-item__dek">{a.dek}</p>
      {c && <StatBadges stats={[c]} />}
      {(a.players.length > 0 || prior || file) && (
        <div className="ss-item__foot">
          {file && <RivalryFileStrip file={file} label="Open the rivalry file" />}
          <ClubChips names={a.players} players={players} onPlayer={onPlayer} max={2} label="Players in this story" />
          {prior && (
            <button type="button" className="ss-continued ss-continued--inline" onClick={() => onOpen(prior.article.id)}>
              <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" /> Continued from {prior.season}
            </button>
          )}
        </div>
      )}
    </li>
  );
};

interface ReaderProps {
  open: { story: SeasonStory; article: StoryArticle } | null;
  index: SeasonStoryIndexEntry[];
  players: Player[];
  onPlayer: (p: Player) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}

/** A season's articles in reading order: the lead, the feed, quick hits last */
const readingOrder = (story: SeasonStory) => {
  const lead = story.articles.filter((a) => a.kind === 'lead');
  const hits = story.articles.filter((a) => a.kind === 'quickhits');
  return [...lead, ...story.articles.filter((a) => a.kind !== 'lead' && a.kind !== 'quickhits'), ...hits];
};

/**
 * The reading sheet (FeatureSheet.tsx): the article as a magazine feature, with "Continued from" cards above the body,
 * Read next below it, and previous / next through the season's articles.
 */
const Reader = ({ open, index, players, onPlayer, onOpen, onClose }: ReaderProps) => {
  const a = open?.article;
  const story = open?.story;
  const season = story?.season;
  if (!a || !story || !season) return <FeatureSheet piece={null} onClose={onClose} players={players} onPlayer={onPlayer} />;
  const related = a.related.map((id) => findRef(index, id)).filter((x): x is NonNullable<typeof x> => !!x);
  const order = readingOrder(story);
  const at = order.findIndex((x) => x.id === a.id);
  const link = (x: StoryArticle | undefined, label: string) => (x ? { headline: x.headline, label, onGo: () => onOpen(x.id) } : null);
  const earlier = related.filter((r) => r.season !== season);
  const sameSeason = related.filter((r) => r.season === season);
  const piece: SheetPiece = {
    id: a.id,
    kicker: (
      <>
        <KindLabel kind={a.kind} />
        <span>The {season} Season</span>
      </>
    ),
    headline: a.headline,
    dek: a.dek,
    byline: (
      <>
        <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> {BYLINE}
        <span aria-hidden="true">·</span>
        <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {readTime(a)}
      </>
    ),
    body: a.body,
    list: a.kind === 'quickhits',
    stats: a.stats,
    players: a.players,
    teams: a.teams,
    hero: heroOf(a, players),
    scene: { kind: a.kind, players: a.players, teams: a.teams, art: a.art },
    position: `Story ${at + 1} of ${order.length}`,
    sourcesNote: 'Every figure is checked against the league data when the story is published (scripts/story_check.py).',
    before: earlier.length ? (
      <div className="fs-cards">
        {earlier.map((r) => (
          <button key={r.article.id} type="button" className="nz-prev" onClick={() => onOpen(r.article.id)}>
            <CornerDownRight className="nz-prev__icon h-4 w-4" aria-hidden="true" />
            <span className="nz-prev__text">
              <span className="nz-prev__kicker">
                Continued from {r.season} · <KindLabel kind={r.article.kind} />
              </span>
              <span className="nz-prev__title">{r.article.headline}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    ) : undefined,
    after: sameSeason.length ? (
      <section className="ss-reader__tags" aria-label="Related stories">
        <h3 className="ss-reader__h">Read next</h3>
        {sameSeason.map((r) => (
          <button key={r.article.id} type="button" className="ss-next" onClick={() => onOpen(r.article.id)}>
            <KindLabel kind={r.article.kind} />
            <span className="ss-next__title">{r.article.headline}</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        ))}
      </section>
    ) : undefined,
  };
  return (
    <FeatureSheet
      piece={piece}
      onClose={onClose}
      prev={link(order[at - 1], 'Previous story')}
      next={link(order[at + 1], 'Next story')}
      players={players}
      onPlayer={onPlayer}
    />
  );
};

interface FrontProps {
  story: SeasonStory;
  index: SeasonStoryIndexEntry[];
  players: Player[];
  onPlayer: (p: Player) => void;
  onRead: (id: string) => void;
  onOpen: (id: string) => void;
  champion: string | null;
}

/**
 * The season's front page: the lead, then every other article in sections by kind (each a filled card grid, none
 * folded), with a sticky sidebar from 1024px (Top stories, Did you know, the players and clubs the season's articles
 * name). Picking a club in the sidebar narrows the sections to its stories.
 */
const Front = ({ story, index, players, onPlayer, onRead, onOpen, champion }: FrontProps) => {
  const [club, setClub] = useState<string>('all');
  const lead = story.articles.find((a) => a.kind === 'lead');
  const hits = story.articles.find((a) => a.kind === 'quickhits');
  const feed = useMemo(() => story.articles.filter((a) => a !== lead && a !== hits), [story, lead, hits]);
  const top = feed.slice(0, 3);
  const more = useMemo(() => feed.slice(3).filter((a) => club === 'all' || a.teams.includes(club)), [feed, club]);
  const leadHero = lead ? heroOf(lead, players) : null;
  const itemProps = { season: story.season, index, players, onPlayer, onRead, onOpen };

  // the players the season's articles name most (the lead and the feed), and the clubs they cover
  const trending = useMemo(() => {
    const c = new Map<string, { p: Player; n: number }>();
    [...(lead ? [lead] : []), ...feed].forEach((a) =>
      a.players.forEach((name) => {
        const p = matchPlayerByName(name, players);
        if (!p) return;
        const k = `${p.position}:${p.name}`;
        const e = c.get(k);
        if (e) e.n += 1;
        else c.set(k, { p, n: 1 });
      }),
    );
    return [...c.values()].sort((a, b) => b.n - a.n || b.p.careerLegacy - a.p.careerLegacy).slice(0, 8);
  }, [lead, feed, players]);
  const clubs = useMemo(() => {
    const c = new Map<string, number>();
    [...(lead ? [lead] : []), ...feed].forEach((a) => a.teams.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [lead, feed]);

  const groups = useMemo(() => {
    const listed = new Set(GROUPS.flatMap((g) => g.kinds));
    const all = [...GROUPS, { id: 'other', label: 'More', kinds: [] as StoryKind[] }];
    return all
      .map((g) => ({ ...g, items: more.filter((a) => (g.id === 'other' ? !listed.has(a.kind) : g.kinds.includes(a.kind))) }))
      .filter((g) => g.items.length);
  }, [more]);

  return (
    <div className="ss-front">
        {lead && (
          <article className="ss-lead stagger-in" style={{ ...teamVars(leadHero?.teams[0]), '--i': 0 } as CSSProperties}>
            <button type="button" className="ss-cover" onClick={() => onRead(lead.id)} aria-label={`Read: ${lead.headline}`} />
            <div className={cn('ss-lead__art', leadHero && leadHero.mode !== 'one' && 'ss-lead__art--pair')} title={lead.stats[0]?.source ? `Source: ${lead.stats[0].source}` : undefined}>
              <ArticleArt
                variant="hero"
                kind="lead"
                players={lead.players}
                teams={lead.teams}
                art={lead.art}
                league={players}
                className="ss-lead__scene"
                fallback={leadHero && <HeroLogos teams={leadHero.teams} mode={leadHero.mode} />}
              />
              {lead.stats[0] && (
                <p className="ss-lead__big">
                  <b>{lead.stats[0].value}</b>
                  <span>{lead.stats[0].label}</span>
                </p>
              )}
            </div>
            <div className="ss-lead__text">
              <KindLabel kind="lead" />
              <h3 className="ss-lead__title">{lead.headline}</h3>
              <p className="ss-lead__dek">{lead.dek}</p>
              <StatBadges stats={lead.stats.slice(1, 3)} />
              <PlayerBanners names={lead.players} players={players} onPlayer={onPlayer} max={3} className="nz-banners--lead" />
              {champion && <TeamPhoto season={story.season} winner={champion} players={players} featured={lead.players} />}
              <p className="ss-byline">
                <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> {BYLINE}
                <span aria-hidden="true">·</span>
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {readTime(lead)}
                <span className="ss-read" aria-hidden="true">
                  Read the story <ChevronRight className="h-4 w-4" />
                </span>
              </p>
            </div>
          </article>
        )}


      <aside className="ss-side">
        <div className="ss-side__in">
          {top.length > 0 && (
            <section className="ss-top en-mod" aria-labelledby="ss-top-title">
              <Rubric id="ss-top-title" kicker="Front page" count={top.length}>
                Top stories
              </Rubric>
              <FillGrid
                items={top}
                minW={230}
                max={3}
                gap={12}
                className="en-cards en-cards--top"
                render={(a, i, cell) => <StoryItem key={a.id} a={a} i={i + 1} cell={cell} {...itemProps} />}
              />
            </section>
          )}

          <div className="ss-dyk en-mod">
            <DidYouKnowDeck key={story.season} facts={story.didYouKnow} season={story.season} players={players} onPlayer={onPlayer} />
          </div>

          {trending.length >= 3 && (
            <section className="ss-trend en-mod" aria-labelledby="en-trend-title">
              <Rubric id="en-trend-title" kicker="In the stories" count={trending.length}>
                Players in the news
              </Rubric>
              <ol className="en-rank">
                {trending.map(({ p, n }, i) => {
                  const c = bannerTeamOf(p);
                  return (
                    <li key={`${p.position}:${p.name}`} style={{ ...teamVars(c), '--ink': getTeamTextColor(c) ?? 'var(--tc)' } as CSSProperties}>
                      <button type="button" className="en-rank__btn" {...peekProps(p)} onClick={() => onPlayer(p)} aria-label={`${p.name}, in ${n} stories. Open his card`}>
                        <span className="en-rank__n">{i + 1}</span>
                        <span className="en-trend__sprite" aria-hidden="true">
                          <GameSprite player={p} team={c} kind="bust" size="s" />
                        </span>
                        <span className="en-rank__name">{p.name}</span>
                        <span className="en-trend__n">{n} {n === 1 ? 'story' : 'stories'}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {clubs.length > 0 && (
            <section className="ss-around en-mod" aria-labelledby="en-around-title">
              <Rubric id="en-around-title" kicker="By club" count={clubs.length}>
                Around the league
              </Rubric>
              <FillGrid
                items={clubs}
                minW={64}
                max={4}
                gap={6}
                className="en-around"
                render={([t, n], _i, cell) => (
                  <li key={t} style={{ ...teamVars(t), ...cell.style }}>
                    <button type="button" className="en-around__btn" aria-pressed={club === t} onClick={() => setClub(club === t ? 'all' : t)} aria-label={`${t}, ${n} ${n === 1 ? 'story' : 'stories'}`} title={t}>
                      <TeamLogo team={t} size={26} decorative />
                      <b>{n}</b>
                    </button>
                  </li>
                )}
              />
            </section>
          )}
        </div>
      </aside>

      {(groups.length > 0 || club !== 'all') && (
        <div className="ss-more en-sections">
          {club !== 'all' && (
            <button type="button" className="en-filter" style={teamVars(club)} onClick={() => setClub('all')}>
              <TeamLogo team={club} size={16} decorative /> Stories naming the {club} · show all
            </button>
          )}
          {groups.length === 0 && <p className="ss-loading">No more stories name the {club} this season.</p>}
          {groups.map((g, gi) => (
            <section key={g.id} className="en-section" aria-labelledby={`en-sec-${g.id}`} style={{ ...(club !== 'all' ? teamVars(club) : {}), '--k': KIND_ACCENT[g.kinds[0] ?? 'feature'] } as CSSProperties}>
              <Rubric id={`en-sec-${g.id}`} kicker={club !== 'all' ? club : `Section ${String(gi + 1).padStart(2, '0')}`} count={g.items.length} club={club !== 'all' ? club : undefined} big>
                {g.label}
              </Rubric>
              <FillGrid
                items={g.items}
                minW={270}
                max={3}
                gap={14}
                className="en-cards"
                render={(a, i, cell) => <StoryItem key={a.id} a={a} i={i + 4} cell={cell} {...itemProps} />}
              />
            </section>
          ))}
        </div>
      )}

      {hits && (
        <section className="ss-hits en-section" aria-labelledby="ss-hits-title" style={{ '--k': 'var(--ss-gold)' } as CSSProperties}>
          <Rubric id="ss-hits-title" kicker="In brief" count={hits.body.length} icon={<Zap className="h-4 w-4" aria-hidden="true" />} big>
            Quick hits
          </Rubric>
          <FillGrid
            as="ol"
            items={hits.body}
            minW={300}
            max={2}
            gap={10}
            className="en-hits"
            render={(line, i, cell) => {
              const c = firstClubIn(line);
              return (
                <li key={line} className="ss-hit en-hit" style={{ ...teamVars(c), ...cell.style }}>
                  <span className="ss-hit__n" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {c && <TeamLogo team={c} size={20} decorative className="ss-hit__logo" />}
                  <span>{line}</span>
                </li>
              );
            }}
          />
        </section>
      )}
    </div>
  );
};

interface DeskProps {
  /** content.json's story index (oldest first); each season's full story loads when it is shown */
  index: SeasonStoryIndexEntry[];
  players: Player[];
  onPlayer: (p: Player) => void;
  /** Controlled season ("Y88"), shared with the Timeline's Season games; uncontrolled when left out */
  season?: string | null;
  onSeason?: (season: string) => void;
}

/** The Timeline news desk for one season at a time (latest first), with the season switcher */
export const SeasonStoryDesk = ({ index, players, onPlayer, season: controlled, onSeason }: DeskProps) => {
  const seasons = useMemo(() => [...index].reverse(), [index]);
  const [ownSeason, setOwnSeason] = useState<string | null>(null);
  const seasonId = controlled !== undefined ? controlled : ownSeason;
  const setSeasonId = useCallback(
    (id: string) => {
      setOwnSeason(id);
      onSeason?.(id);
    },
    [onSeason],
  );
  const entry = seasons.find((s) => s.season === seasonId) ?? seasons[0];
  const { story, loading } = useSeasonStory(entry);
  const superBowls = useLeagueContent().content?.superBowls ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  // a deep link waits here until its season's file is in
  const openArticleRow = openId && story ? story.articles.find((x) => x.id === openId) : undefined;
  const open = story && openArticleRow ? { story, article: openArticleRow } : null;

  const openArticle = useCallback(
    (id: string) => {
      const hit = storyEntryOf(index, id);
      if (!hit) return;
      setSeasonId(hit.season);
      setOpenId(id);
    },
    [index, setSeasonId],
  );

  // Requests from elsewhere (the Arcade ticker): one made before this mounted, and any made while it is mounted
  useEffect(() => {
    if (pending) {
      const id = pending;
      pending = null;
      openArticle(id);
    }
    const on = (e: Event) => {
      pending = null;
      openArticle(String((e as CustomEvent).detail));
    };
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, [openArticle]);

  if (!entry) return null;
  const switcher = (
    <div className="ss-seasons" role="group" aria-label="Season">
      {seasons.map((s) => (
        <button key={s.season} type="button" className="ss-season" aria-pressed={s.season === entry.season} onClick={() => setSeasonId(s.season)}>
          {s.season}
        </button>
      ))}
    </div>
  );
  if (!story) {
    // the season's file is loading (or failed): the masthead from the index, then a placeholder
    return (
      <section id="season-story" className="ss en scroll-mt-24" aria-labelledby="ss-title" aria-busy={loading || undefined}>
        <header className="ss-mast">
          <div className="ss-mast__text">
            <p className="ss-mast__kicker">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Season Story · {BYLINE}
            </p>
            <h2 id="ss-title" className="ss-mast__title">
              The {entry.season} Season
            </h2>
            {entry.tagline && <p className="ss-mast__tagline">{entry.tagline}</p>}
          </div>
          {switcher}
        </header>
        {loading ? (
          <PixelLoader label="Press" what={`the ${entry.season} stories`} minHeight={360} />
        ) : (
          <p className="ss-loading" role="status">
            The {entry.season} stories could not be loaded. Try again in a moment.
          </p>
        )}
        <HotTakesDesk season={entry.season} players={players} onPlayer={onPlayer} />
      </section>
    );
  }
  const leadArticle = story.articles.find((a) => a.kind === 'lead');
  const leadHero = leadArticle ? heroOf(leadArticle, players) : null;
  // The champions' team photo (private sprites only): a lead about the Super Bowl, and the season's winner
  const champion = leadArticle && leadHero?.mode === 'vs' ? superBowls.find((sb) => `Y${sb.year}` === story.season)?.winner ?? null : null;

  return (
    <section id="season-story" className="ss en scroll-mt-24" aria-labelledby="ss-title">
      <header className="ss-mast">
        <div className="ss-mast__text">
          <p className="ss-mast__kicker">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Season Story · {BYLINE}
          </p>
          <h2 id="ss-title" className="ss-mast__title">
            The {story.season} Season
          </h2>
          {story.tagline && <p className="ss-mast__tagline">{story.tagline}</p>}
        </div>
        {switcher}
      </header>

      <Front story={story} index={index} players={players} onPlayer={onPlayer} onRead={setOpenId} onOpen={openArticle} champion={champion} />

      <HotTakesDesk season={story.season} players={players} onPlayer={onPlayer} />

      <Reader open={open} index={index} players={players} onPlayer={onPlayer} onOpen={openArticle} onClose={() => setOpenId(null)} />
    </section>
  );
};
