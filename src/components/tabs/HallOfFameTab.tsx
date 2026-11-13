import { useCallback, useMemo, useState } from 'react';
import { Clapperboard, Crown } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { useJerseyNumbers } from '@/utils/jerseys';
import { legacyTeamOf, signatureTeamOf, usePlayerExtras } from '@/utils/playerExtras';
import { useLeagueContent } from '@/utils/leagueContent';
import { useCurrentClub } from '@/utils/club';
import { hofClassLabel, useHallOfFame, type HofCase, type HofMember, type RingOfHonorEntry } from '@/utils/hallOfFame';
import { playCeremony } from '@/utils/hallOfFameWatch';
import ProPlayerBanner from '../brand/ProPlayerBanner';
import PlayerDetailCard from '../PlayerDetailCard';
import HofGallery, { type GalleryItem } from '../hof/HofGallery';
import HofPlaque from '../hof/HofPlaque';
import HofBallot, { type BallotRow } from '../hof/HofBallot';
import RingsOfHonor from '../hof/RingsOfHonor';
import { BallotBadge, ScoreMedal } from '../hof/hofParts';
import { cn } from '@/lib/utils';

const keyOf = (p: Pick<Player, 'name' | 'position'>) => `${p.position}:${p.name}`;
const shortClass = (label: string, season: string) => (/inaugural/i.test(label) ? 'Inaugural' : season);

/**
 * The Hall of Fame (public/data/league/halloffame.json, scripts/hall_of_fame.py): header with the class timeline,
 * the newest class, the gallery of busts, the plaque, the ballot and watch list, and the clubs' Rings of Honor.
 */
const HallOfFameTab = () => {
  const { careerData, getAllPlayers, dataVersion } = useLeague();
  const { data: hof, loading } = useHallOfFame();
  const { content } = useLeagueContent();
  const extras = usePlayerExtras();
  const { index: jerseys, numberFor } = useJerseyNumbers();
  const currentClub = useCurrentClub();

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [cardPlayer, setCardPlayer] = useState<Player | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);

  const players = useMemo(() => {
    const m = new Map<string, Player>();
    getAllPlayers().forEach((p) => !p.isRealLegend && m.set(keyOf(p), p));
    return m;
    // dataVersion: a new league load is a new player list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllPlayers, dataVersion]);

  const clubOf = useCallback(
    (key: string, name: string, active = false) => {
      const p = players.get(key) ?? { name, team: '' };
      return active ? signatureTeamOf(extras, p) : legacyTeamOf(extras, p);
    },
    [players, extras],
  );

  const items = useMemo((): GalleryItem[] => {
    if (!hof) return [];
    const order = new Map(hof.classes.map((c, i) => [c.season, i]));
    return hof.members.map((m) => {
      const player = players.get(m.key);
      return {
        member: m,
        player,
        club: clubOf(m.key, m.name),
        number: player ? numberFor(player) : null,
        classOrder: order.get(m.classSeason) ?? 0,
      };
    });
  }, [hof, players, clubOf, numberFor]);
  const byKey = useMemo(() => new Map(items.map((i) => [i.member.key, i])), [items]);

  // The plaque closes first: the ceremony is its own full-screen layer
  const replay = useCallback((m: HofMember) => {
    setOpenKey(null);
    playCeremony({ entries: [{ key: m.key, variant: 'hof' }], classLabel: hofClassLabel(m.class) });
  }, []);
  const openCard = useCallback((p: Player) => {
    setOpenKey(null);
    setCardPlayer(p);
  }, []);

  const ballotRows = useCallback(
    (list: (HofCase & { since?: string; yearsOnBallot?: number })[], active = false): BallotRow[] =>
      list.map((entry) => {
        const p = players.get(entry.key);
        return { entry, club: clubOf(entry.key, entry.name, active), onOpen: p ? () => setCardPlayer(p) : undefined };
      }),
    [players, clubOf],
  );

  const openRing = useCallback(
    (e: RingOfHonorEntry) => {
      const key = `${e.pos}:${e.name}`;
      if (byKey.has(key)) setOpenKey(key);
      else {
        const p = players.get(key);
        if (p) setCardPlayer(p);
      }
    },
    [byKey, players],
  );

  if (!careerData) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Crown className="mb-4 h-16 w-16 text-amber-400" />
        <h2 className="font-display text-3xl font-bold text-amber-400">HALL OF FAME</h2>
        <p className="mt-2 text-muted-foreground">Upload league data to view inductees</p>
      </div>
    );
  }

  if (!hof) {
    return (
      <div className="container py-16 text-center text-muted-foreground" aria-live="polite">
        {loading ? 'Opening the Hall…' : 'The Hall of Fame file could not be loaded.'}
      </div>
    );
  }

  const latest = hof.classes.at(-1);
  const latestMembers = (latest?.members ?? [])
    .map((name) => items.find((i) => i.member.name === name))
    .filter((i): i is GalleryItem => !!i);
  const activeClass = classFilter ? hof.classes.find((c) => c.season === classFilter) : undefined;
  const open = openKey ? byKey.get(openKey) : undefined;
  const nickname = open ? open.player?.nickname || content?.playerNotes.find((n) => n.name === open.member.name)?.nickname || undefined : undefined;

  return (
    <div className="container overflow-x-hidden py-6 sm:py-8">
      {/* 1. Header */}
      <header className="relative mb-6 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-card to-card p-4 sm:p-6">
        <p className="font-pixel text-[10px] uppercase tracking-widest text-gold">The Hall</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-4xl font-extrabold uppercase italic text-chalk sm:text-5xl" style={{ textShadow: '3px 3px 0 #000' }}>
            Hall of <span className="text-gold">Fame</span>
          </h1>
          <span className="font-display text-xl font-bold tabular-nums text-gold">{hof.members.length} members</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          <span className="mr-1.5 inline-block rounded-sm bg-gold px-1.5 py-0.5 font-pixel text-[9px] uppercase text-night">Bar {hof.bar}</span>
          Retired players with a Hall of Fame Score of {hof.bar}, at most {hof.cap} a class
        </p>

        <nav aria-label="Classes" className="mt-4">
          <ol className="relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
            {hof.classes.map((c) => {
              const on = classFilter === c.season;
              return (
                <li key={c.season} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setClassFilter(on ? null : c.season)}
                    aria-label={`${c.label}: ${c.members.length} member${c.members.length === 1 ? '' : 's'}. ${on ? 'Show every class' : 'Show only this class'}`}
                    className={cn(
                      'flex min-h-[40px] flex-col items-start justify-center rounded-md border px-2.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                      on ? 'border-gold bg-gold text-night' : 'border-line bg-background/60 text-chalk hover:border-gold/60',
                    )}
                  >
                    <span className="font-display text-sm font-bold uppercase leading-none">{shortClass(c.label, c.season)}</span>
                    <span className={cn('font-pixel text-[8px] uppercase leading-none', on ? 'text-night/75' : 'text-muted-foreground')}>
                      {c.members.length} in
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {/* 2. Newest class */}
      {latest && latestMembers.length > 0 && (
        <section aria-labelledby="hof-class-title" className="mb-8 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-pixel text-[10px] uppercase tracking-widest text-gold/90">Newest enshrinees</p>
              <h2 id="hof-class-title" className="font-display text-3xl font-extrabold uppercase italic text-chalk">
                {latest.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                playCeremony({ entries: latestMembers.map((i) => ({ key: i.member.key, variant: 'hof' as const })), classLabel: hofClassLabel(latest.label) })
              }
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-4 font-bold text-night shadow-glow transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
              Watch the ceremony
            </button>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {latestMembers.map((i) => (
              <li key={i.member.key}>
                <button
                  type="button"
                  onClick={() => setOpenKey(i.member.key)}
                  className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  aria-label={`${i.member.name}, Hall of Fame Score ${i.member.score}${i.member.firstBallot ? ', first ballot' : i.member.veteran ? ', veteran' : ''}. Open plaque`}
                >
                  <ProPlayerBanner size="compact" name={i.member.name} position={i.member.pos} team={i.club} number={i.number} hallOfFamer interactive />
                  <span className="mt-1.5 flex items-center gap-2 px-1">
                    <ScoreMedal score={i.member.score} size="sm" />
                    <BallotBadge firstBallot={i.member.firstBallot} veteran={i.member.veteran} />
                    <span className="truncate text-xs text-muted-foreground">
                      {i.member.records.length ? `Held the ${i.member.records.join(' and ').toLowerCase()} record` : `${i.member.rings} ring${i.member.rings === 1 ? '' : 's'}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. The gallery */}
      <HofGallery
        items={items}
        extras={extras}
        classFilter={classFilter}
        classLabel={activeClass?.label ?? null}
        onClearClass={() => setClassFilter(null)}
        onOpen={setOpenKey}
      />

      {/* 5. The ballot and the watch list */}
      <HofBallot
        ballot={ballotRows(hof.ballot)}
        near={ballotRows(hof.near)}
        watch={ballotRows(hof.watch, true)}
        bar={hof.bar}
        cap={hof.cap}
        season={hof.season}
      />

      {/* 6. Rings of Honor */}
      <RingsOfHonor rings={hof.ringOfHonor} defaultClub={currentClub} onOpen={openRing} />

      {/* 4. The plaque */}
      <HofPlaque
        member={open?.member ?? null}
        player={open?.player}
        number={open?.number ?? null}
        club={open?.club ?? ''}
        extras={extras}
        jerseys={jerseys}
        nickname={nickname}
        speech={open ? content?.speeches?.[open.member.name] : undefined}
        onClose={() => setOpenKey(null)}
        onReplay={replay}
        onOpenCard={openCard}
      />
      <PlayerDetailCard player={cardPlayer} onClose={() => setCardPlayer(null)} />
    </div>
  );
};

export default HallOfFameTab;
