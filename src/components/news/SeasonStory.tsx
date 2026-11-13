import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Clock, CornerDownRight, Newspaper, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import {
  matchPlayerByName,
  storyEntryOf,
  useSeasonStory,
  type SeasonStory,
  type SeasonStoryIndexEntry,
  type StoryArticle,
  type StoryKind,
  type StoryStat,
} from '@/utils/leagueContent';
import { getTeamColors } from '@/utils/teamColors';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DidYouKnowDeck } from './DidYouKnow';
import { HotTakesDesk } from './HotTakes';
import './story.css';

/**
 * Season Story: the AI-authored news package for each completed season (data/y80/stories.json, written only by a
 * story.set upload; scripts/story_check.py checks every figure against the data). Shown on the Timeline in the
 * "What changed" area as a sports-media feed: a season masthead, the lead story as a hero card, a feed of
 * features (kind label, headline, dek, a stat callout, player chips), a Quick hits rail, and a reading sheet with
 * the full article, its figures and their sources. Earlier seasons stay browsable through the season switcher.
 *
 * Below the feed: the season's Did you know deck (DidYouKnow.tsx) and its Hot Takes (HotTakes.tsx, the fourth AI lane),
 * both following the season switcher.
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

/** Team colours of an article's main team, as CSS vars for the card */
const teamVars = (team?: string): CSSProperties | undefined => {
  const c = getTeamColors(team);
  return c ? ({ '--tc': `hsl(${c.primary})`, '--tc2': `hsl(${c.secondary})` } as CSSProperties) : undefined;
};

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

interface ChipProps {
  names: string[];
  players: Player[];
  onPlayer: (p: Player) => void;
  max?: number;
}

const PlayerChips = ({ names, players, onPlayer, max }: ChipProps) => {
  const shown = max ? names.slice(0, max) : names;
  const more = names.length - shown.length;
  if (!names.length) return null;
  return (
    <ul className="ss-chips" aria-label="Players in this story">
      {shown.map((n) => {
        const p = matchPlayerByName(n, players);
        return (
          <li key={n}>
            {p ? (
              <button type="button" className="ss-chip" onClick={() => onPlayer(p)} aria-label={`Open ${p.name}'s card`}>
                <span className="ss-chip__pos">{p.position}</span>
                {p.name}
              </button>
            ) : (
              <span className="ss-chip ss-chip--plain">{n}</span>
            )}
          </li>
        );
      })}
      {more > 0 && (
        <li>
          <span className="ss-chip ss-chip--plain">+{more}</span>
        </li>
      )}
    </ul>
  );
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

interface ReaderProps {
  open: { story: SeasonStory; article: StoryArticle } | null;
  index: SeasonStoryIndexEntry[];
  players: Player[];
  onPlayer: (p: Player) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}

/** The reading sheet: the full article with comfortable typography, its figures, chips and links */
const Reader = ({ open, index, players, onPlayer, onOpen, onClose }: ReaderProps) => {
  const a = open?.article;
  const season = open?.story.season;
  const related = (a?.related ?? []).map((id) => findRef(index, id)).filter((x): x is NonNullable<typeof x> => !!x);
  const quick = a?.kind === 'quickhits';
  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="ss-reader w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(var(--safe-h,100dvh)-1rem)] overflow-y-auto overflow-x-hidden gap-0 p-0"
        style={teamVars(a?.teams[0])}
      >
        {a && season && (
          // Radix labels the dialog with its own DialogTitle id (an id of our own here would hide the title from its check)
          <article className="ss-reader__inner">
            <div className="ss-reader__band" aria-hidden="true" />
            <header className="ss-reader__head">
              <p className="ss-reader__kicker">
                <KindLabel kind={a.kind} />
                <span>The {season} Season</span>
              </p>
              <DialogTitle className="ss-reader__title">
                {a.headline}
              </DialogTitle>
              <DialogDescription className="ss-reader__dek">{a.dek}</DialogDescription>
              <p className="ss-byline">
                <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> {BYLINE}
                <span aria-hidden="true">·</span>
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {readTime(a)}
              </p>
            </header>
            {related
              .filter((r) => r.season !== season)
              .map((r) => (
                <button key={r.article.id} type="button" className="ss-continued" onClick={() => onOpen(r.article.id)}>
                  <CornerDownRight className="h-4 w-4" aria-hidden="true" />
                  Continued from {r.season}: <b>{r.article.headline}</b>
                </button>
              ))}
            {!quick && <StatCallouts stats={a.stats} max={4} />}
            <div className="ss-reader__body">
              {quick ? (
                <ol className="ss-reader__hits">
                  {a.body.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              ) : (
                a.body.map((p, i) => <p key={i}>{p}</p>)
              )}
            </div>
            {(a.players.length > 0 || a.teams.length > 0) && (
              <section className="ss-reader__tags" aria-label="In this story">
                <h3 className="ss-reader__h">In this story</h3>
                <PlayerChips names={a.players} players={players} onPlayer={onPlayer} />
                {a.teams.length > 0 && (
                  <ul className="ss-teams" aria-label="Teams">
                    {a.teams.map((t) => (
                      <li key={t} className="ss-team" style={teamVars(t)}>
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {related.filter((r) => r.season === season).length > 0 && (
              <section className="ss-reader__tags" aria-label="Related stories">
                <h3 className="ss-reader__h">Read next</h3>
                {related
                  .filter((r) => r.season === season)
                  .map((r) => (
                    <button key={r.article.id} type="button" className="ss-next" onClick={() => onOpen(r.article.id)}>
                      <KindLabel kind={r.article.kind} />
                      <span className="ss-next__title">{r.article.headline}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
              </section>
            )}
            {a.stats.length > 0 && (
              <details className="ss-sources">
                <summary>Figures and sources ({a.stats.length})</summary>
                <ul>
                  {a.stats.map((s) => (
                    <li key={s.label}>
                      <b>{s.value}</b> {s.label}
                      <code>{s.source}</code>
                    </li>
                  ))}
                </ul>
                <p>Every figure is checked against the league data when the story is published (scripts/story_check.py).</p>
              </details>
            )}
          </article>
        )}
      </DialogContent>
    </Dialog>
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

      {lead && (
        <article className="ss-lead stagger-in" style={{ ...teamVars(lead.teams[0]), '--i': 0 } as CSSProperties}>
          <button type="button" className="ss-cover" onClick={() => setOpenId(lead.id)} aria-label={`Read: ${lead.headline}`} />
          <div className="ss-lead__text">
            <KindLabel kind="lead" />
            <h3 className="ss-lead__title">{lead.headline}</h3>
            <p className="ss-lead__dek">{lead.dek}</p>
            <p className="ss-byline">
              <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> {BYLINE}
              <span aria-hidden="true">·</span>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {readTime(lead)}
            </p>
            <span className="ss-read" aria-hidden="true">
              Read the story <ChevronRight className="h-4 w-4" />
            </span>
          </div>
          <StatCallouts stats={lead.stats} max={3} />
        </article>
      )}

      {hits && (
        <section className="ss-hits" aria-labelledby="ss-hits-title">
          <h3 id="ss-hits-title" className="ss-hits__title">
            <Zap className="h-4 w-4" aria-hidden="true" /> Quick hits
          </h3>
          <ol className="ss-hits__rail">
            {hits.body.map((line, i) => (
              <li key={line} className="ss-hit">
                <span className="ss-hit__n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <DidYouKnowDeck key={story.season} facts={story.didYouKnow} season={story.season} players={players} onPlayer={onPlayer} />

      <ul className="ss-feed" aria-label={`${story.season} stories`}>
        {feed.map((a, i) => {
          const c = callout(a);
          const prior = a.related.map((id) => findRef(index, id)).find((r) => r && r.season !== story.season);
          return (
            <li key={a.id} className="ss-card stagger-in" style={{ ...teamVars(a.teams[0]), '--i': i + 1 } as CSSProperties}>
              <button type="button" className="ss-cover" onClick={() => setOpenId(a.id)} aria-label={`Read: ${a.headline}`} />
              <KindLabel kind={a.kind} />
              <h3 className="ss-card__title">{a.headline}</h3>
              <p className="ss-card__dek">{a.dek}</p>
              {c && (
                <p className="ss-card__stat">
                  <b>{c.value}</b> <span>{c.label}</span>
                </p>
              )}
              {prior && (
                <button type="button" className="ss-continued ss-continued--card" onClick={() => openArticle(prior.article.id)}>
                  <CornerDownRight className="h-4 w-4" aria-hidden="true" /> Continued from {prior.season}
                </button>
              )}
              <div className="ss-card__foot">
                <PlayerChips names={a.players} players={players} onPlayer={onPlayer} max={3} />
                <span className="ss-card__time">{readTime(a)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <HotTakesDesk season={story.season} players={players} onPlayer={onPlayer} />

      <Reader open={open} index={index} players={players} onPlayer={onPlayer} onOpen={openArticle} onClose={() => setOpenId(null)} />
    </section>
  );
};
