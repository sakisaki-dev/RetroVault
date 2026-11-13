import type { CSSProperties } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import TeamLogo from '@/components/brand/TeamLogo';
import ProPlayerBanner from '@/components/brand/ProPlayerBanner';
import { matchPlayerByName, type StoryKind } from '@/utils/leagueContent';
import { NFL_TEAMS } from '@/utils/nflTeams';
import { bannerTeamOf } from '@/utils/playerExtras';
import { getTeamColors } from '@/utils/teamColors';
import { useJerseyNumbers } from '@/utils/jerseys';

/**
 * Club identity for the news desk (Season Story, Hot Takes, the reading sheet): club colours as CSS vars, the real
 * team logos (TeamLogo, ESPN's marks) as thumbnails and hero art, and the featured players as ProPlayerBanner rows.
 * Presentation only: every club comes from the article's own teams, or a named player's best-known club
 * (bannerTeamOf: his club while active, where he was best known once retired).
 */

/** A club's colours as CSS vars: --tc (primary), --tc2 (secondary) */
export const teamVars = (team?: string | null): CSSProperties | undefined => {
  const c = getTeamColors(team);
  return c ? ({ '--tc': `hsl(${c.primary})`, '--tc2': `hsl(${c.secondary})` } as CSSProperties) : undefined;
};

/** A named player's best-known club ('' when the name isn't a league player) */
export const clubOfName = (name: string, players: Player[]): string => {
  const p = matchPlayerByName(name, players);
  return p ? bannerTeamOf(p) : '';
};

/** The club a story or take is about: its first team, else its first player's club */
export const mainClubOf = (item: { teams: string[]; players: string[] }, players: Player[]): string =>
  item.teams[0] || item.players.map((n) => clubOfName(n, players)).find(Boolean) || '';

/** Two clubs face each other on rivalry stories, and a trade shows the two clubs it moved players between */
export const pairOf = (kind: StoryKind | undefined, teams: string[]): [string, string] | null =>
  (kind === 'rivalry' || kind === 'trade') && teams.length >= 2 ? [teams[0], teams[1]] : null;

/** The first club named in a line of text (quick hits), by nickname */
const TEAM_RES = NFL_TEAMS.map((t) => ({ name: t.name, re: new RegExp(`\\b${t.name}\\b`) }));
export const firstClubIn = (text: string): string | null => {
  let best: { name: string; at: number } | null = null;
  for (const t of TEAM_RES) {
    const m = t.re.exec(text);
    if (m && (!best || m.index < best.at)) best = { name: t.name, at: m.index };
  }
  return best?.name ?? null;
};

interface ThumbProps {
  kind?: StoryKind;
  teams: string[];
  /** The main club when the story has no teams (its first player's club) */
  club: string;
  className?: string;
}

/**
 * A story's "photo" thumbnail: a field in the main club's colours with its logo; a rivalry shows both clubs' logos
 * facing off (VS), a trade the two clubs with a swap mark between them.
 */
export const StoryThumb = ({ kind, teams, club, className }: ThumbProps) => {
  const pair = pairOf(kind, teams);
  if (!club && !pair) return null;
  return (
    <span className={cn('nz-thumb', pair && 'nz-thumb--pair', className)} style={teamVars(pair ? pair[0] : club)} aria-hidden="true">
      {pair ? (
        <>
          <span className="nz-thumb__half" style={teamVars(pair[0])}>
            <TeamLogo team={pair[0]} size={40} decorative backed />
          </span>
          <span className="nz-thumb__mid">{kind === 'trade' ? <ArrowLeftRight className="h-3.5 w-3.5" /> : 'VS'}</span>
          <span className="nz-thumb__half" style={teamVars(pair[1])}>
            <TeamLogo team={pair[1]} size={40} decorative backed />
          </span>
        </>
      ) : (
        <TeamLogo team={club} size={44} decorative backed />
      )}
    </span>
  );
};

/**
 * Hero art: one club's big logo, lit, or two clubs facing off (VS for a rivalry or a title game, a swap mark for a
 * trade). Sized by the container (.nz-hero-art in news-art.css).
 */
export const HeroLogos = ({ teams, mode }: { teams: string[]; mode: 'one' | 'vs' | 'trade' }) => {
  if (!teams[0]) return null;
  if (mode === 'one' || !teams[1])
    return (
      <span className="nz-hero-art" aria-hidden="true">
        <span className="nz-hero-art__logo">
          <TeamLogo team={teams[0]} size={240} decorative priority />
        </span>
      </span>
    );
  return (
    <span className="nz-hero-art nz-hero-art--pair" aria-hidden="true">
      <span className="nz-hero-art__logo" style={teamVars(teams[0])}>
        <TeamLogo team={teams[0]} size={240} decorative priority />
      </span>
      <span className="nz-hero-art__mid">{mode === 'trade' ? <ArrowLeftRight className="h-6 w-6" /> : 'VS'}</span>
      <span className="nz-hero-art__logo" style={teamVars(teams[1])}>
        <TeamLogo team={teams[1]} size={240} decorative priority />
      </span>
    </span>
  );
};

interface BannersProps {
  names: string[];
  players: Player[];
  onPlayer: (p: Player) => void;
  max?: number;
  className?: string;
  label?: string;
}

/** The featured players as compact ProPlayerBanners (club colours, jersey number), each opening his card */
export const PlayerBanners = ({ names, players, onPlayer, max = 3, className, label = 'Featured players' }: BannersProps) => {
  const { numberFor } = useJerseyNumbers();
  const shown = names
    .map((n) => matchPlayerByName(n, players))
    .filter((p): p is Player => !!p)
    .slice(0, max);
  if (!shown.length) return null;
  return (
    <ul className={cn('nz-banners', className)} aria-label={label}>
      {shown.map((p) => (
        <li key={p.name}>
          <button type="button" className="nz-banner" onClick={() => onPlayer(p)} aria-label={`Open ${p.name}'s card`}>
            <ProPlayerBanner size="compact" name={p.name} position={p.position} team={bannerTeamOf(p)} number={numberFor(p)} interactive />
          </button>
        </li>
      ))}
    </ul>
  );
};
