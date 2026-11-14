import { useMemo } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { hofClassLabel } from '@/utils/hallOfFame';
import TeamLogo from '../brand/TeamLogo';
import { splitPlayerName } from '../brand/ProPlayerBanner.utils';
import type { GalleryItem } from './HofGallery';
import { FrameCrest, HallHeading, MedalCoin } from './hofParts';
import { POS_NAMES, clubFill, tierClass, tierOf } from './hofUtils';
import { cn } from '@/lib/utils';
import GameSprite from '../GameSprite';
import { statureScale, useGameSprites } from '@/utils/gameSprites';

/** Legends' Row: everyone with a perfect 100, else the top three by score, on lit plinths. */
const HofLegends = ({ items, onOpen }: { items: GalleryItem[]; onOpen: (key: string) => void }) => {
  const legends = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.member.score - a.member.score || b.member.careerLegacy - a.member.careerLegacy);
    const perfect = sorted.filter((i) => i.member.score >= 100);
    return perfect.length >= 3 ? perfect : sorted.slice(0, 3);
  }, [items]);
  // The private Retro Bowl bust (this Mac only) takes the space above the name; without it the layout is unchanged
  const sprites = useGameSprites();
  if (!legends.length) return null;
  const perfect = legends.every((l) => l.member.score >= 100);

  return (
    <section aria-labelledby="hof-legends-title" className="mb-10">
      <HallHeading
        id="hof-legends-title"
        kicker="Legends' Row"
        title={perfect ? 'The perfect hundreds' : 'The highest scores'}
        sub={perfect ? 'Every Hall of Famer with a perfect Hall of Fame Score of 100.' : 'The three highest Hall of Fame Scores in the Hall.'}
      />
      <ul className="grid gap-5 pt-2 md:grid-cols-3">
        {legends.map((item, i) => {
          const { member, club, number, nickname } = item;
          const { first, last } = splitPlayerName(member.name);
          const team = findNFLTeam(club);
          return (
            <li key={member.key} className="hof-reveal min-w-0" style={{ ['--i' as string]: i }}>
              <button
                type="button"
                onClick={() => onOpen(member.key)}
                className={cn('hof-legend', tierClass(member.score))}
                style={{ ['--i' as string]: i }}
                aria-label={`${member.name}${nickname ? `, ${nickname}` : ''}, ${member.pos}${team ? `, ${team.fullName}` : ''}, Hall of Fame Score ${member.score}, ${hofClassLabel(member.class)}. Open plaque`}
              >
                <FrameCrest score={member.score} />
                <span className="hof-face flex flex-col items-center" style={clubFill(team)}>
                  <span aria-hidden="true" className="hof-spot" />
                  {tierOf(member.score) === 'diamond' && <span aria-hidden="true" className="hof-foil" />}
                  <span aria-hidden="true" className="hof-deboss">
                    {number ?? ''}
                  </span>
                  <span className="!absolute left-3 top-3">
                    <TeamLogo team={team ?? club} size={30} decorative backed />
                  </span>
                  <MedalCoin score={member.score} size={44} className="!absolute right-3 top-3" />

                  {sprites && (
                    <span className="hof-legend__stage" aria-hidden="true" style={{ ['--hof-club' as string]: team ? `hsl(${team.primaryColor})` : 'hsl(var(--gold))' }}>
                      <span className="hof-stage__floor" />
                      <GameSprite
                        player={{ name: member.name, position: member.pos, team: item.player?.team, spriteSkin: item.player?.spriteSkin }}
                        team={club}
                        kind="figure"
                        size="l"
                        className="hof-sprite"
                        style={statureScale(sprites, member.name) !== 1 ? { transform: `scale(${4 / 3})`, transformOrigin: '50% calc(100% - 15px)' } : undefined}
                      />
                    </span>
                  )}
                  <span className={cn(sprites ? 'mt-0' : 'mt-[62px]', 'block')} />
                  <span className="block max-w-full truncate px-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/85" style={{ textShadow: '0 1px 3px hsl(228 60% 3% / 0.9)' }}>
                    {first}
                  </span>
                  <span className="hof-metal-text block max-w-full truncate px-4 font-display text-[44px] font-extrabold uppercase italic leading-[0.95]">
                    {last}
                  </span>
                  <span className="mt-0.5 block h-6 max-w-full truncate px-4 font-display text-lg italic text-gold" style={{ textShadow: '0 1px 3px hsl(228 60% 3% / 0.9)' }}>
                    {nickname ? `“${nickname}”` : ''}
                  </span>

                  <span className="hof-plinth block">
                    <span className="hof-engrave block truncate font-display text-[15px] font-bold uppercase tracking-[0.18em]">
                      {POS_NAMES[member.pos] ?? member.pos}
                      {number != null ? ` · #${number}` : ''}
                    </span>
                    <span className="hof-engrave block truncate font-pixel text-[8px] uppercase tracking-widest opacity-90">
                      {team?.fullName ?? club} · {hofClassLabel(member.class)}
                    </span>
                  </span>
                  <span aria-hidden="true" className="hof-sheen" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default HofLegends;
