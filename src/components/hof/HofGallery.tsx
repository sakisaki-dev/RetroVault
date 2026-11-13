import { memo, useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import type { HofMember } from '@/utils/hallOfFame';
import { normalizeName, type IndexedExtras } from '@/utils/playerExtras';
import { findNFLTeam } from '@/utils/nflTeams';
import TeamLogo from '../brand/TeamLogo';
import { splitPlayerName } from '../brand/ProPlayerBanner.utils';
import { BallotBadge, ScoreMedal } from './hofParts';
import { POSITIONS, clubColors, clubFill, yearsOf } from './hofUtils';
import { cn } from '@/lib/utils';

export interface GalleryItem {
  member: HofMember;
  player?: Player;
  club: string;
  number: number | null;
  /** classes index (0 = inaugural), for the class sort */
  classOrder: number;
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

const GalleryTile = memo(function GalleryTile({ item, years, onOpen }: { item: GalleryItem; years: string | null; onOpen: (key: string) => void }) {
  const { member, club, number } = item;
  const { first, last } = splitPlayerName(member.name);
  const team = findNFLTeam(club);
  const c = clubColors(team);
  return (
    <button
      type="button"
      onClick={() => onOpen(member.key)}
      aria-label={`${member.name}, ${member.pos}${team ? `, ${team.fullName}` : ''}, Hall of Fame Score ${member.score}${member.firstBallot ? ', first ballot' : member.veteran ? ', veteran' : ''}. Open plaque`}
      className="group relative flex h-[132px] w-full flex-col justify-end overflow-hidden rounded-lg border border-gold/45 p-2.5 text-left text-white shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={clubFill(team)}
    >
      {/* club stripe and watermarks */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: `hsl(${c.secondary})` }} />
      <span aria-hidden="true" className="pointer-events-none absolute -right-1 top-1 font-display text-[64px] font-extrabold italic leading-none tabular-nums opacity-20">
        {number ?? ''}
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2.5 opacity-90">
        <TeamLogo team={team ?? club} size={22} decorative backed />
      </span>
      <ScoreMedal score={member.score} size="sm" className="absolute right-2 top-2.5" />

      <span className="relative block truncate text-[11px] font-semibold leading-tight opacity-85">{first}</span>
      <span className="relative block truncate font-display text-[22px] font-extrabold uppercase italic leading-[1.05]" style={{ textShadow: '2px 2px 0 hsl(228 60% 3% / 0.6)' }}>
        {last}
      </span>
      <span className="relative mt-1 flex items-center gap-1.5">
        <span className="font-pixel text-[9px] uppercase leading-none">
          {member.pos}
          {number != null ? ` · #${number}` : ''}
        </span>
        {years && <span className="truncate text-[10px] font-semibold leading-none opacity-80">{years}</span>}
      </span>
      {(member.firstBallot || member.veteran) && (
        <BallotBadge firstBallot={member.firstBallot} veteran={member.veteran} className="absolute right-2 top-[3.05rem]" />
      )}
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
        <div>
          <p className="font-pixel text-[10px] uppercase tracking-widest text-gold/90">The gallery</p>
          <h2 id="hof-gallery-title" className="font-display text-2xl font-extrabold uppercase italic text-chalk sm:text-3xl">
            Every bust
          </h2>
        </div>
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
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((item, i) => (
            <li key={item.member.key} className="stagger-in min-w-0" style={{ ['--i' as string]: Math.min(i, 20) }}>
              <GalleryTile item={item} years={yearsOf(extras.stints[normalizeName(item.member.name)])} onOpen={onOpen} />
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
