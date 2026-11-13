import { useCallback, useMemo, useState, type CSSProperties } from 'react';
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
import HofLegends from '../hof/HofLegends';
import { Laurel, MedalCoin, RibbonBanner } from '../hof/hofParts';
import { roman } from '../hof/hofUtils';

const keyOf = (p: Pick<Player, 'name' | 'position'>) => `${p.position}:${p.name}`;
const shortClass = (label: string, season: string) => (/inaugural/i.test(label) ? 'Inaugural' : season);

// Gold confetti for the newest class's reveal: fixed positions, one short fall (hof.css .hof-confetti)
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${(i % 11) * 90 + 500}ms`,
  dx: `${((i * 53) % 60) - 30}px`,
  r: `${(i % 2 ? 1 : -1) * (360 + ((i * 47) % 360))}deg`,
  color: ['#ffe08a', '#f1bd3c', '#fff6cf', '#d39a24', '#ffffff'][i % 5],
  wide: i % 3 === 0,
}));

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

  const nickOf = useMemo(() => new Map((content?.playerNotes ?? []).filter((n) => n.nickname).map((n) => [n.name, n.nickname as string])), [content]);

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
        nickname: player?.nickname || nickOf.get(m.name) || undefined,
      };
    });
  }, [hof, players, clubOf, numberFor, nickOf]);
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
  const nickname = open?.nickname;

  return (
    <div className="container overflow-x-hidden py-6 sm:py-8">
      {/* 1. Header */}
      <header className="hof-hall mb-8 px-12 pb-5 pt-6 text-center sm:px-20 sm:pb-6 sm:pt-8">
        <span aria-hidden="true" className="hof-rays" />
        <span aria-hidden="true" className="hof-arch" />
        <span aria-hidden="true" className="hof-column hof-column--l" />
        <span aria-hidden="true" className="hof-column hof-column--r" />

        <span className="relative mx-auto grid h-14 w-14 place-items-center" aria-hidden="true">
          <Laurel size={56} color="hsl(43 90% 62%)" className="absolute inset-0" />
          <Crown className="relative h-5 w-5 text-gold" strokeWidth={2.2} />
        </span>
        <p className="mt-1 font-pixel text-[10px] uppercase tracking-[0.3em] text-gold">The Hall</p>
        <h1
          className="mt-1 font-display text-[42px] font-extrabold uppercase italic leading-[0.95] text-chalk sm:text-6xl"
          style={{ textShadow: '3px 3px 0 #000' }}
        >
          Hall of{' '}
          <span className="hof-metal-text pr-1" style={{ textShadow: 'none' }}>
            Fame
          </span>
        </h1>
        <p className="hof-inscription mt-3 text-[13px] sm:text-base" aria-label={`${hof.members.length} members enshrined`}>
          <span aria-hidden="true">
            {roman(hof.members.length)} <span className="text-gold/70">·</span> {hof.members.length} enshrined
          </span>
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
          <span className="mr-1.5 inline-block rounded-sm bg-gold px-1.5 py-0.5 align-middle font-pixel text-[9px] uppercase text-night">Bar {hof.bar}</span>
          Retired players with a Hall of Fame Score of {hof.bar}, at most {hof.cap} a class
        </p>

        <nav aria-label="Classes" className="hof-floor -mx-12 -mb-5 mt-5 px-3 pb-3 pt-3.5 sm:-mx-20 sm:-mb-6 sm:px-6">
          <ol className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 pt-0.5 scrollbar-none sm:justify-center">
            {hof.classes.map((c) => {
              const on = classFilter === c.season;
              return (
                <li key={c.season} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setClassFilter(on ? null : c.season)}
                    aria-label={`${c.label}: ${c.members.length} member${c.members.length === 1 ? '' : 's'}. ${on ? 'Show every class' : 'Show only this class'}`}
                    className="hof-tag"
                  >
                    <span className="font-display text-sm font-extrabold uppercase leading-none">{shortClass(c.label, c.season)}</span>
                    <span className="mt-0.5 font-pixel text-[8px] uppercase leading-none opacity-80">{c.members.length} in</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {/* 2. Newest class */}
      {latest && latestMembers.length > 0 && (
        <section aria-labelledby="hof-class-title" className="hof-debut mb-10 pb-5 pt-5 sm:pb-6">
          <span aria-hidden="true" className="hof-debut__spot" />
          <span aria-hidden="true" className="hof-curtain hof-curtain--l" />
          <span aria-hidden="true" className="hof-curtain hof-curtain--r" />
          <span aria-hidden="true" className="hof-confetti">
            {CONFETTI.map((c, i) => (
              <i
                key={i}
                style={
                  {
                    left: c.left,
                    background: c.color,
                    animationDelay: c.delay,
                    width: c.wide ? 8 : 5,
                    height: c.wide ? 4 : 9,
                    '--dx': c.dx,
                    '--r': c.r,
                  } as CSSProperties
                }
              />
            ))}
          </span>

          <div className="text-center">
            <p className="font-pixel text-[10px] uppercase tracking-[0.25em] text-gold/90">Newest enshrinees</p>
            <h2 id="hof-class-title" className="mt-1 font-display text-3xl font-extrabold uppercase italic leading-none text-chalk sm:text-4xl" style={{ textShadow: '2px 2px 0 #000' }}>
              {latest.label}
            </h2>
          </div>
          <ul className={`mx-auto mt-4 grid gap-4 ${latestMembers.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'max-w-md'}`}>
            {latestMembers.map((i) => (
              <li key={i.member.key}>
                <button
                  type="button"
                  onClick={() => setOpenKey(i.member.key)}
                  className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  aria-label={`${i.member.name}, Hall of Fame Score ${i.member.score}${i.member.firstBallot ? ', first ballot' : i.member.veteran ? ', veteran' : ''}. Open plaque`}
                >
                  <span className="relative block rounded-xl p-[3px] shadow-glow" style={{ background: 'linear-gradient(135deg, #fff1b8, #e3a92b 30%, #fff3c2 50%, #c88a17 75%, #8f5d0c)' }}>
                    <ProPlayerBanner size="compact" name={i.member.name} position={i.member.pos} team={i.club} number={i.number} hallOfFamer interactive />
                  </span>
                  <span className="mt-3 flex items-center gap-3 px-1">
                    <MedalCoin score={i.member.score} size={46} />
                    <span className="min-w-0 flex-1">
                      <RibbonBanner firstBallot={i.member.firstBallot} veteran={i.member.veteran} />
                      <span className="mt-1 block text-sm text-chalk/85">
                        {i.member.records.length ? `Held the ${i.member.records.join(' and ').toLowerCase()} record` : `${i.member.rings} ring${i.member.rings === 1 ? '' : 's'}`}
                        {i.nickname ? <span className="text-gold"> · &ldquo;{i.nickname}&rdquo;</span> : null}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() =>
                playCeremony({ entries: latestMembers.map((i) => ({ key: i.member.key, variant: 'hof' as const })), classLabel: hofClassLabel(latest.label) })
              }
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 px-5 font-bold text-night shadow-glow ring-1 ring-amber-200/60 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
              Watch the ceremony
            </button>
          </div>
        </section>
      )}

      {/* Legends' Row */}
      <HofLegends items={items} onOpen={setOpenKey} />

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
