import { memo, useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import type { HofMember } from '@/utils/hallOfFame';
import { normalizeName, type IndexedExtras } from '@/utils/playerExtras';
import { findNFLTeam } from '@/utils/nflTeams';
import TeamLogo from '../brand/TeamLogo';
import { splitPlayerName } from '../brand/ProPlayerBanner.utils';
import { FrameCrest, HallHeading, MedalCoin } from './hofParts';
import { POSITIONS, clubFill, tierClass, tierOf, yearsOf } from './hofUtils';
import { cn } from '@/lib/utils';
import GameSprite from '../GameSprite';

export interface GalleryItem {
  member: HofMember;
  player?: Player;
  club: string;
  number: number | null;
  /** classes index (0 = inaugural), for the class sort */
  classOrder: number;
  nickname?: string;
}

type SortKey = 'score' | 'class' | 'name';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'class', label: 'Class' },
  { key: 'name', label: 'Name' },
];

const chip = (on: boolean) =>
  cn(
    'inline-flex min-h-[36px] shrink-0 items-center rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
    on ? 'border-gold bg-gold/15 text-gold' : 'border-line bg-card text-muted-foreground hover:text-chalk',
  );

const GalleryTile = memo(function GalleryTile({ item, years, index, onOpen }: { item: GalleryItem; years: string | null; index: number; onOpen: (key: string) => void }) {
  const { member, club, number } = item;
  const { first, last } = splitPlayerName(member.name);
  const team = findNFLTeam(club);
  const tier = tierOf(member.score);
  return (
    <button
      type="button"
      onClick={() => onOpen(member.key)}
      aria-label={`${member.name}, ${member.pos}${team ? `, ${team.fullName}` : ''}, Hall of Fame Score ${member.score}${member.firstBallot ? ', first ballot' : member.veteran ? ', veteran' : ''}. Open plaque`}
      className={cn('hof-bust', tierClass(member.score))}
      style={{ ['--i' as string]: index }}
    >
      <FrameCrest score={member.score} />
      <span className="hof-face flex flex-col justify-end p-2.5 pb-2" style={clubFill(team)}>
        {tier === 'diamond' && <span aria-hidden="true" className="hof-foil" />}
        <span aria-hidden="true" className="hof-deboss">
          {number ?? ''}
        </span>
        {(member.firstBallot || member.veteran) && (
          <span aria-hidden="true" className={cn('hof-sash', !member.firstBallot && 'hof-sash--silver')}>
            {member.firstBallot ? 'First ballot' : 'Veteran'}
          </span>
        )}
        <MedalCoin score={member.score} size={32} className="!absolute right-2 top-2.5" />
        <GameSprite
          player={{ name: member.name, position: member.pos, team: item.player?.team, spriteSkin: item.player?.spriteSkin }}
          team={club}
          kind="face"
          scale={2}
          className="hof-sprite !absolute left-1/2 top-1.5 -translate-x-1/2"
        />

        <span className="block truncate text-[11px] font-semibold leading-tight text-white/85" style={{ textShadow: '0 1px 2px hsl(228 60% 3% / 0.8)' }}>
          {first}
        </span>
        <span className="hof-metal-text block truncate pr-0.5 font-display text-[23px] font-extrabold uppercase italic leading-[1.05]">{last}</span>
        <span className="mt-1 flex items-center gap-1.5 border-t pt-1" style={{ borderColor: 'hsl(var(--hof-glow) / 0.3)' }}>
          <TeamLogo team={team ?? club} size={15} decorative backed />
          <span className="font-pixel text-[9px] uppercase leading-none">
            {member.pos}
            {number != null ? ` · #${number}` : ''}
          </span>
          {years && <span className="ml-auto truncate text-[10px] font-semibold leading-none text-white/75">{years}</span>}
        </span>
        <span aria-hidden="true" className="hof-sheen" />
      </span>
    </button>
  );
});

/** The Gallery: compact club-coloured bust tiles, filters for wing, club and sort. */
const HofGallery = ({
  items,
  extras,
  classFilter,
  classLabel,
  onClearClass,
  onOpen,
}: {
  items: GalleryItem[];
  extras: IndexedExtras;
  classFilter: string | null;
  classLabel: string | null;
  onClearClass: () => void;
  onOpen: (key: string) => void;
}) => {
  const [pos, setPos] = useState<string | null>(null);
  const [club, setClub] = useState('');
  const [sort, setSort] = useState<SortKey>('score');

  const positions = useMemo(() => POSITIONS.filter((p) => items.some((i) => i.member.pos === p)), [items]);
  const clubs = useMemo(() => [...new Set(items.map((i) => i.club).filter(Boolean))].sort(), [items]);

  const shown = useMemo(() => {
    const list = items.filter(
      (i) => (!classFilter || i.member.classSeason === classFilter) && (!pos || i.member.pos === pos) && (!club || i.club === club),
    );
    const byScore = (a: GalleryItem, b: GalleryItem) => b.member.score - a.member.score || b.member.careerLegacy - a.member.careerLegacy;
    return [...list].sort((a, b) =>
      sort === 'name'
        ? splitPlayerName(a.member.name).last.localeCompare(splitPlayerName(b.member.name).last)
        : sort === 'class'
          ? b.classOrder - a.classOrder || byScore(a, b)
          : byScore(a, b),
    );
  }, [items, classFilter, pos, club, sort]);

  return (
    <section aria-labelledby="hof-gallery-title" className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <HallHeading id="hof-gallery-title" kicker="The gallery" title="Every bust" className="mb-0" />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shown.length} of {items.length}
          {classLabel ? ` · ${classLabel}` : ''}
        </p>
      </div>

      <div className="mb-3 space-y-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none" role="group" aria-label="Filter by position">
          <button type="button" className={chip(!pos)} aria-pressed={!pos} onClick={() => setPos(null)}>
            All
          </button>
          {positions.map((p) => (
            <button key={p} type="button" className={chip(pos === p)} aria-pressed={pos === p} onClick={() => setPos(pos === p ? null : p)}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none">
            <span className="font-pixel text-[9px] uppercase text-muted-foreground">Club</span>
            <select
              value={club}
              onChange={(e) => setClub(e.target.value)}
              className="min-h-[36px] min-w-0 flex-1 rounded-md border border-line bg-card px-2 text-base text-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:w-48 sm:flex-none sm:text-sm"
            >
              <option value="">All clubs</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {findNFLTeam(c)?.fullName ?? c}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-full border border-line bg-card p-0.5" role="group" aria-label="Sort">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  'min-h-[32px] rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                  sort === s.key ? 'bg-gold text-night' : 'text-muted-foreground hover:text-chalk',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {classLabel && (
            <button type="button" onClick={onClearClass} className={chip(true)} aria-label={`Clear the class filter (${classLabel})`}>
              {classLabel} <span aria-hidden="true" className="ml-1.5">×</span>
            </button>
          )}
        </div>
      </div>

      {shown.length ? (
        <ul className="grid grid-cols-2 gap-x-2.5 gap-y-4 pt-1 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-5 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((item, i) => (
            <li key={item.member.key} className="hof-reveal min-w-0" style={{ ['--i' as string]: Math.min(i, 20) }}>
              <GalleryTile item={item} index={i % 9} years={yearsOf(extras.stints[normalizeName(item.member.name)])} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted-foreground">No Hall of Famers match these filters.</p>
      )}
    </section>
  );
};

export default HofGallery;
