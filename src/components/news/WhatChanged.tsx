import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowLeftRight,
  Award,
  ChevronRight,
  Flame,
  Milestone,
  Newspaper,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { useLeague } from '@/context/LeagueContext';
import { matchPlayerByName, useLeagueContent, type Edition, type Headline, type HeadlinesInfo, type HeadlineKind, type PlayerNote, type SeasonStory } from '@/utils/leagueContent';
import { editionShuffle } from '@/utils/edition';
import { getTeamColors } from '@/utils/teamColors';
import { useHubRoute } from '@/components/stats/hub/hashRoute';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import PositionBadge from '@/components/PositionBadge';
import './news.css';
import { reducedMotion } from '@/utils/motion';
import { SeasonStoryDesk, openSeasonStory } from './SeasonStory';

/**
 * "What changed": the generated headlines in content.json (scripts/build_league_content.py build_headlines(), rules
 * over the data diff of the latest update), shown as a compact ticker on the landing tab and a full list on the
 * Timeline. A headline about a player opens his card. The Spotlight beside the ticker rotates per edition
 * (utils/edition.ts), preferring players in the headlines.
 */

type Icon = LucideIcon;
const KIND: Record<HeadlineKind, { icon: Icon; label: string }> = {
  superbowl: { icon: Trophy, label: 'Super Bowl' },
  hof: { icon: Award, label: 'Hall of Fame' },
  record: { icon: Flame, label: 'Record' },
  trade: { icon: ArrowLeftRight, label: 'Trade' },
  'new-player': { icon: UserPlus, label: 'New player' },
  award: { icon: Star, label: 'Award' },
  milestone: { icon: Milestone, label: 'Milestone' },
  grade: { icon: Sparkles, label: 'Skill grade' },
  market: { icon: TrendingUp, label: 'Market' },
  chase: { icon: Target, label: 'Record chase' },
};
const iconFor = (h: Headline): Icon => (h.kind === 'market' && /−\d/.test(h.text) ? TrendingDown : KIND[h.kind].icon);
const tone = (h: Headline) => (h.kind === 'market' ? (/−\d/.test(h.text) ? 'down' : 'up') : h.kind);

export const scopeLabel = (info?: HeadlinesInfo) =>
  info?.scope === 'Last update' ? `Last update${info.label ? ` · ${info.label}` : ''}` : 'This update';

/** League players (no real NFL legends), for resolving headline names to cards. */
const useLeaguePlayers = () => {
  const { getAllPlayers } = useLeague();
  return useMemo(() => getAllPlayers().filter((p) => !p.isRealLegend), [getAllPlayers]);
};

interface HeadlineButtonProps {
  h: Headline;
  player?: Player;
  onPlayer: (p: Player) => void;
  copy?: boolean;
  className?: string;
}

const HeadlineItem = ({ h, player, onPlayer, copy, className }: HeadlineButtonProps) => {
  const Ico = iconFor(h);
  const body = (
    <>
      <Ico className="wc-item__icon" aria-hidden="true" />
      <span className="wc-item__text">{h.text}</span>
      {player && <ChevronRight className="wc-item__go" aria-hidden="true" />}
    </>
  );
  const cls = cn('wc-item', `wc-item--${tone(h)}`, className);
  return player ? (
    <button
      type="button"
      className={cls}
      onClick={() => onPlayer(player)}
      tabIndex={copy ? -1 : undefined}
      aria-label={copy ? undefined : `${h.text}. Open ${player.name}'s card`}
    >
      {body}
    </button>
  ) : (
    <span className={cls}>{body}</span>
  );
};

/**
 * Compact ticker. The second copy of the track only makes the marquee seamless (aria-hidden, unfocusable). Pauses on
 * hover / focus; with data-perf="lite" or reduced motion it is a static wrapped list (news.css).
 */
export const HeadlineTicker = ({
  headlines,
  info,
  players,
  onPlayer,
  onMore,
  title = 'What changed',
  story,
  onStory,
}: {
  headlines: Headline[];
  info?: HeadlinesInfo;
  players: Player[];
  onPlayer: (p: Player) => void;
  onMore?: () => void;
  title?: string;
  /** The latest Season Story: its lead is linked above the ticker */
  story?: SeasonStory;
  onStory?: (id: string) => void;
}) => {
  const items = headlines.slice(0, 10);
  if (!items.length) return null;
  const lead = story?.articles.find((a) => a.kind === 'lead');
  const find = (h: Headline) => (h.players[0] ? matchPlayerByName(h.players[0], players) : undefined);
  const track = (copy: boolean) => (
    <ul className={cn('wc-ticker__track', copy && 'wc-ticker__track--dup')} aria-hidden={copy || undefined}>
      {items.map((h) => (
        <li key={h.text}>
          <HeadlineItem h={h} player={find(h)} onPlayer={onPlayer} copy={copy} />
        </li>
      ))}
    </ul>
  );
  return (
    <section className="wc wc-strip" aria-labelledby="wc-strip-title">
      <div className="wc-strip__head">
        <h2 id="wc-strip-title" className="wc-strip__title">
          <Newspaper className="h-4 w-4" aria-hidden="true" /> {title}
        </h2>
        <span className="wc-strip__scope">{scopeLabel(info)}</span>
        {onMore && (
          <button type="button" className="wc-strip__more" onClick={onMore}>
            All headlines <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="wc-ticker" style={{ '--wc-dur': `${Math.max(24, items.length * 7)}s` } as CSSProperties}>
        {track(false)}
        {track(true)}
      </div>
      {lead && story && onStory && (
        <button type="button" className="wc-story-link" onClick={() => onStory(lead.id)}>
          <span className="wc-story-link__kick">{story.season} Season Story</span>
          <span className="wc-story-link__text">{lead.headline}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      )}
    </section>
  );
};

/** The full list (Timeline): every headline, heaviest first. */
export const HeadlineList = ({
  headlines,
  info,
  players,
  onPlayer,
  anchor = true,
}: {
  headlines: Headline[];
  info?: HeadlinesInfo;
  players: Player[];
  onPlayer: (p: Player) => void;
  /** Carry the #what-changed anchor (off when a wrapper carries it) */
  anchor?: boolean;
}) => {
  if (!headlines.length) return null;
  return (
    <section id={anchor ? 'what-changed' : undefined} className="wc wc-list scroll-mt-24" aria-labelledby="wc-list-title">
      <div className="wc-list__head">
        <h2 id="wc-list-title" className="font-display text-lg font-bold uppercase tracking-wide">
          What changed
        </h2>
        <p className="text-xs text-muted-foreground">
          {scopeLabel(info)}
          {info?.since && info.label ? ` · market snapshot ${info.since} → ${info.label}` : ''}
          {info?.scope === 'Last update' ? ' · the latest upload changed no stats, so these are from the update before it' : ''}
        </p>
      </div>
      <ul className="wc-list__grid">
        {headlines.map((h) => {
          const player = h.players[0] ? matchPlayerByName(h.players[0], players) : undefined;
          return (
            <li key={h.text}>
              <HeadlineItem h={h} player={player} onPlayer={onPlayer} className="wc-item--row" />
              <span className="sr-only">{KIND[h.kind].label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/**
 * Spotlight: three players for this edition. Players in the headlines come first (up to two), shuffled per
 * edition; the rest come from the top Career Legacy cards, shuffled per edition. Same picks for everyone until the
 * next update.
 */
export const pickSpotlight = (players: Player[], headlines: Headline[], edition: Edition | undefined, n = 3): Player[] => {
  const inNews = [...new Set(headlines.flatMap((h) => h.players.slice(0, 1)))]
    .map((name) => matchPlayerByName(name, players))
    .filter((p): p is Player => !!p);
  const picked = editionShuffle(inNews, edition, 'home-spotlight-news').slice(0, Math.min(2, n));
  const top = [...players]
    .sort((a, b) => (b.careerLegacy || 0) - (a.careerLegacy || 0) || a.name.localeCompare(b.name))
    .slice(0, 24)
    .filter((p) => !picked.includes(p));
  return [...picked, ...editionShuffle(top, edition, 'home-spotlight')].slice(0, n);
};

export const Spotlight = ({
  picks,
  headlines,
  notes,
  onPlayer,
}: {
  picks: Player[];
  headlines: Headline[];
  notes: PlayerNote[];
  onPlayer: (p: Player) => void;
}) => {
  if (!picks.length) return null;
  return (
    <section className="wc wc-spot" aria-labelledby="wc-spot-title">
      <h2 id="wc-spot-title" className="wc-spot__title">
        <Star className="h-4 w-4" aria-hidden="true" /> Spotlight
      </h2>
      <ul className="wc-spot__grid">
        {picks.map((p) => {
          const news = headlines.find((h) => h.players[0] === p.name);
          const note = notes.find((x) => x.name === p.name);
          const c = getTeamColors(p.team);
          return (
            <li key={`${p.position}:${p.name}`}>
              <button
                type="button"
                className="wc-spot__card"
                style={c ? ({ '--tc': `hsl(${c.primary})`, '--tc2': `hsl(${c.secondary})` } as CSSProperties) : undefined}
                onClick={() => onPlayer(p)}
                aria-label={`Open ${p.name}'s card`}
              >
                <span className="wc-spot__top">
                  <PositionBadge position={p.position} />
                  <span className="wc-spot__team">{p.team || 'Free agent'}</span>
                </span>
                <span className="wc-spot__name">{p.name}</span>
                <span className="wc-spot__legacy">
                  Career Legacy <b>{Math.round(p.careerLegacy || 0).toLocaleString('en-US')}</b>
                </span>
                <span className="wc-spot__line">{news?.text ?? note?.tag ?? note?.era ?? `${p.games} games, ${p.rings} rings`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** Landing block: the ticker plus the Spotlight, with the player card they open. */
export const HomeNews = () => {
  const { content } = useLeagueContent();
  const players = useLeaguePlayers();
  const { navigate } = useHubRoute();
  const [selected, setSelected] = useState<Player | null>(null);
  const headlines = useMemo(() => content?.headlines ?? [], [content]);
  const picks = useMemo(() => pickSpotlight(players, headlines, content?.edition), [players, headlines, content?.edition]);
  if (!content || (!headlines.length && !picks.length)) return null;
  return (
    <div className="wc-home">
      <HeadlineTicker
        headlines={headlines}
        info={content.headlinesInfo}
        players={players}
        onPlayer={setSelected}
        onMore={() => {
          navigate({ tab: 'timeline' });
          // the list sits under the Timeline masthead; wait for the lazy tab to mount
          window.setTimeout(() => document.getElementById('what-changed')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }), 400);
        }}
        story={content.seasonStories?.at(-1)}
        onStory={(id) => {
          // the Timeline's story desk opens it when it mounts (or right away if it already is)
          openSeasonStory(id);
          navigate({ tab: 'timeline' });
          window.setTimeout(() => document.getElementById('season-story')?.scrollIntoView({ block: 'start', behavior: 'auto' }), 400);
        }}
      />
      <Spotlight picks={picks} headlines={headlines} notes={content.playerNotes} onPlayer={setSelected} />
      <PlayerDetailCard player={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

/**
 * Timeline news block: the rule-based headlines as "The Wire" (a ticker, with the full list folded below) and the
 * Season Story desk (SeasonStory.tsx). Without a story it is the plain headline list, as before.
 */
export const TimelineNews = ({
  headlines,
  info,
  stories,
  onPlayer,
}: {
  headlines?: Headline[];
  info?: HeadlinesInfo;
  stories?: SeasonStory[];
  onPlayer: (p: Player) => void;
}) => {
  const players = useLeaguePlayers();
  if (!stories?.length) return <HeadlineList headlines={headlines ?? []} info={info} players={players} onPlayer={onPlayer} />;
  return (
    <div id="what-changed" className="wc-news scroll-mt-24">
      <HeadlineTicker headlines={headlines ?? []} info={info} players={players} onPlayer={onPlayer} title="The Wire" />
      <SeasonStoryDesk stories={stories} players={players} onPlayer={onPlayer} />
      {!!headlines?.length && (
        <details className="wc-wire-all">
          <summary>All wire items ({headlines.length})</summary>
          <HeadlineList headlines={headlines} info={info} players={players} onPlayer={onPlayer} anchor={false} />
        </details>
      )}
    </div>
  );
};

/** Timeline block: the full list with its own player card. */
export const WhatChangedList = ({ headlines, info, onPlayer }: { headlines?: Headline[]; info?: HeadlinesInfo; onPlayer: (p: Player) => void }) => {
  const players = useLeaguePlayers();
  return <HeadlineList headlines={headlines ?? []} info={info} players={players} onPlayer={onPlayer} />;
};
