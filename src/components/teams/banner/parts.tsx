import { useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import GameSprite, { type SpriteSize } from '@/components/GameSprite';
import TeamLogo from '@/components/brand/TeamLogo';
import { useGameSprites, type SpriteAction } from '@/utils/gameSprites';
import { useFieldArt } from '@/components/teamlab/fieldArt';
import { getReadableTextOn } from '@/utils/teamColors';
import type { BannerClub, BannerData } from './useBannerData';
import './banner.css';

/** CSS variables for the game's stadium art (crowd, stand front, turf) painted to a club; unset in the public build. */
export const useStadiumVars = (club: string, time: 'day' | 'night' = 'night'): CSSProperties => {
  const art = useFieldArt(club, time);
  return useMemo(
    () =>
      ({
        ...(art.crowd ? { '--bn-crowd': `url(${art.crowd})` } : {}),
        ...(art.turf ? { '--bn-turf': `url(${art.turf})` } : {}),
        ...(art.stands ? { '--bn-stands': `url(${art.stands})` } : {}),
      }) as CSSProperties,
    [art.crowd, art.turf, art.stands],
  );
};

/** A club's greatest player in its kit, or its logo where the private sprites aren't in the build. */
export const Figure = ({ club, action = 'idle', size = 's' }: { club: BannerClub; action?: SpriteAction; size?: SpriteSize }) => {
  const sprites = useGameSprites();
  if (!sprites || !club.star) return <TeamLogo team={club.team} size={size === 's' ? 44 : size === 'm' ? 72 : 96} decorative />;
  return <GameSprite player={club.star} team={club.team.name} kind="figure" size={size} action={action} />;
};

export const stars = (n: number) => (n <= 0 ? '' : n <= 3 ? '★'.repeat(n) : `★${n}`);

/** The page's counts, as quiet chips. */
export const Counts = ({ data, className }: { data: BannerData; className?: string }) => (
  <dl className={cn('bn-counts', className)}>
    {(
      [
        ['Franchises', data.totals.franchises],
        ['Super Bowls', data.totals.superBowls],
        ['Champions', data.totals.champions],
        ['Honoured', data.totals.honoured],
      ] as const
    ).map(([k, v]) => (
      <div key={k} className="bn-count">
        <dd>{v}</dd>
        <dt>{k}</dt>
      </div>
    ))}
  </dl>
);

/** Gold TEAMS lettering with its kicker. */
export const Wordmark = ({ data }: { data: BannerData }) => (
  <div className="bn-word">
    <span className="bn-kicker">League Hub · Ring of Honor · since Y{data.totals.since}</span>
    <h2 className="bn-title">Teams</h2>
  </div>
);

/** Two floodlight beams from the top corners. */
export const Beams = () => (
  <>
    <span className="bn-beam bn-beam--l" aria-hidden="true" />
    <span className="bn-beam bn-beam--r" aria-hidden="true" />
  </>
);

const lightness = (hsl: string) => Number(hsl.match(/(\d+(?:\.\d+)?)%\s*$/)?.[1] ?? 50);

/** A club's flat colour pair for a plate (a near-black primary hands over to its secondary). */
export const plateOf = (c: BannerClub) => {
  const t = c.team;
  const dark = lightness(t.primaryColor) <= 12;
  const fill = dark ? t.secondaryColor : t.primaryColor;
  const edge = dark ? t.primaryColor : t.secondaryColor;
  return { fill: `hsl(${fill})`, edge: `hsl(${edge})`, ink: getReadableTextOn(fill) };
};
