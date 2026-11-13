import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Clock, CornerDownRight, Newspaper, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import {
  storyEntryOf,
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
import './news-art.css';
import './story.css';

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

const KindLabel = ({ kind }: { kind: StoryKind }) => <span className={cn('ss-kind', `ss-kind--${kind}`)}>{KIND_LABEL[kind]}</span>;

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

/** One story in the front page's lists: kind and read time, headline, dek, one stat badge, chips */
const StoryItem = ({ a, i, season, index, players, onPlayer, onRead, onOpen }: ItemProps) => {
  const c = callout(a);
  const prior = a.related.map((id) => findRef(index, id)).find((r) => r && r.season !== season);
  const club = mainClubOf(a, players);
  return (
    <li className="ss-item stagger-in" style={{ ...teamVars(club), '--i': i } as CSSProperties}>
      <button type="button" className="ss-cover" onClick={() => onRead(a.id)} aria-label={`Read: ${a.headline}`} />
      <div className="ss-item__head">
        <div className="ss-item__headtext">
          <p className="ss-item__meta">
            <KindLabel kind={a.kind} />
            <span className="ss-item__time">{readTime(a)}</span>
          </p>
          <h4 className="ss-item__title">{a.headline}</h4>
        </div>
        <StoryThumb kind={a.kind} teams={a.teams} club={club} />
      </div>
      <p className="ss-item__dek">{a.dek}</p>
      {c && <StatBadges stats={[c]} />}
      {(a.players.length > 0 || prior) && (
        <div className="ss-item__foot">
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
      <section id="season-story" className="ss scroll-mt-24" aria-labelledby="ss-title" aria-busy={loading || undefined}>
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
        <p className="ss-loading" role="status">
          {loading ? (
            <>
              <span className="ss-loading__dot" aria-hidden="true" /> Loading the {entry.season} stories ({entry.articleCount})…
            </>
          ) : (
            `The ${entry.season} stories could not be loaded. Try again in a moment.`
          )}
        </p>
        <HotTakesDesk season={entry.season} players={players} onPlayer={onPlayer} />
      </section>
    );
  }
  const lead = story.articles.find((a) => a.kind === 'lead');
  const hits = story.articles.find((a) => a.kind === 'quickhits');
  const feed = story.articles.filter((a) => a !== lead && a !== hits);
  const top = feed.slice(0, 3);
  const leadHero = lead ? heroOf(lead, players) : null;
  const more = feed.slice(3);
  const itemProps = { season: story.season, index, players, onPlayer, onRead: setOpenId, onOpen: openArticle };

  return (
    <section id="season-story" className="ss scroll-mt-24" aria-labelledby="ss-title">
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

      <div className="ss-front">
        {lead && (
          <article className="ss-lead stagger-in" style={{ ...teamVars(leadHero?.teams[0]), '--i': 0 } as CSSProperties}>
            <button type="button" className="ss-cover" onClick={() => setOpenId(lead.id)} aria-label={`Read: ${lead.headline}`} />
            <div className={cn('ss-lead__art', leadHero && leadHero.mode !== 'one' && 'ss-lead__art--pair')} title={lead.stats[0]?.source ? `Source: ${lead.stats[0].source}` : undefined}>
              {leadHero && <HeroLogos teams={leadHero.teams} mode={leadHero.mode} />}
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

        {top.length > 0 && (
          <section className="ss-top" aria-labelledby="ss-top-title">
            <h3 id="ss-top-title" className="ss-rubric">
              Top stories
            </h3>
            <ul className="ss-list ss-list--top">
              {top.map((a, i) => (
                <StoryItem key={a.id} a={a} i={i + 1} {...itemProps} />
              ))}
            </ul>
          </section>
        )}

        <div className="ss-dyk">
          <DidYouKnowDeck key={story.season} facts={story.didYouKnow} season={story.season} players={players} onPlayer={onPlayer} />
        </div>

        {more.length > 0 && (
          <section className="ss-more" aria-labelledby="ss-more-title">
            <h3 id="ss-more-title" className="ss-rubric">
              More from {story.season}
            </h3>
            <ul className="ss-list ss-list--more">
              {more.map((a, i) => (
                <StoryItem key={a.id} a={a} i={i + 4} {...itemProps} />
              ))}
            </ul>
          </section>
        )}

        {hits && (
          <section className="ss-hits" aria-labelledby="ss-hits-title">
            <h3 id="ss-hits-title" className="ss-rubric ss-rubric--gold">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Quick hits
            </h3>
            <ol className="ss-hits__list">
              {hits.body.map((line, i) => {
                const club = firstClubIn(line);
                return (
                  <li key={line} className="ss-hit" style={teamVars(club)}>
                    <span className="ss-hit__n" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {club && <TeamLogo team={club} size={20} decorative className="ss-hit__logo" />}
                    <span>{line}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>

      <HotTakesDesk season={story.season} players={players} onPlayer={onPlayer} />

      <Reader open={open} index={index} players={players} onPlayer={onPlayer} onOpen={openArticle} onClose={() => setOpenId(null)} />
    </section>
  );
};
