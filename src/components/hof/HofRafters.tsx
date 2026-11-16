import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { NFL_TEAMS, findNFLTeam } from '@/utils/nflTeams';
import { useRafters, type RafterBanner } from '@/utils/rafters';
import type { RingOfHonorEntry } from '@/utils/hallOfFame';
import { RAFTERS_ANCHOR, RAFTERS_EVENT, takeRaftersRequest } from '@/utils/raftersLink';
import { reducedMotion } from '@/utils/motion';
import TeamLogo from '../brand/TeamLogo';
import RaftersScene from '../teams/RaftersScene';
import { HallHeading } from './hofParts';

const scrollToMe = () =>
  window.setTimeout(() => {
    const el = document.getElementById(RAFTERS_ANCHOR);
    if (!el) return;
    const header = parseFloat(document.documentElement.style.getPropertyValue('--site-header-h')) || 56;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - 12), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, 120);

/**
 * The Hall of Fame tab's Rafters: every club's retired numbers as the rafters scene, one club at a time, with club chips
 * to walk between them (a badge counts each club's banners). Opens on the club a player card asked for
 * (openRafters, utils/raftersLink), else the coach's club when it hangs any, else the first club that does.
 */
const HofRafters = ({ defaultClub, onOpen, onRing }: { defaultClub?: string | null; onOpen: (b: RafterBanner) => void; onRing: (e: RingOfHonorEntry) => void }) => {
  const { bannersFor, ringFor } = useRafters();
  const teams = useMemo(() => [...NFL_TEAMS].sort((a, b) => a.name.localeCompare(b.name)), []);
  const counts = useMemo(() => new Map(teams.map((t) => [t.id, bannersFor(t.id).length])), [teams, bannersFor]);
  const initial = useMemo(() => {
    const own = findNFLTeam(defaultClub);
    if (own && counts.get(own.id)) return own.id;
    return teams.find((t) => counts.get(t.id))?.id ?? teams[0]?.id;
  }, [defaultClub, counts, teams]);
  const [picked, setPicked] = useState<string | null>(null);

  // A request from a player card: one made before this mounted, and any made while it is mounted
  useEffect(() => {
    const first = takeRaftersRequest();
    if (first) {
      setPicked(first);
      scrollToMe();
    }
    const on = (e: Event) => {
      takeRaftersRequest();
      setPicked(String((e as CustomEvent).detail));
      scrollToMe();
    };
    window.addEventListener(RAFTERS_EVENT, on);
    return () => window.removeEventListener(RAFTERS_EVENT, on);
  }, []);

  const teamId = picked ?? initial;
  const team = teams.find((t) => t.id === teamId) ?? null;
  const banners = useMemo(() => bannersFor(teamId), [bannersFor, teamId]);
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  // keep the picked club's chip in view (a request from a player card can pick one far down the row)
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>(`[data-club="${teamId}"]`);
    if (row && chip) row.scrollLeft = Math.max(0, chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2);
  }, [teamId]);

  return (
    <section aria-labelledby={RAFTERS_ANCHOR} className="mb-10 scroll-mt-24">
      <HallHeading
        id={RAFTERS_ANCHOR}
        kicker="Every club"
        title="The Rafters"
        sub={`${total} retired numbers across ${[...counts.values()].filter(Boolean).length} clubs. Pick a club to look up at its banners.`}
      />
      <div ref={chips} className="relative -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-2 pt-2 scrollbar-none" role="group" aria-label="Pick a club" data-no-swipe-x>
        {teams.map((t) => {
          const on = t.id === teamId;
          const n = counts.get(t.id) ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              data-club={t.id}
              aria-pressed={on}
              aria-label={`${t.fullName}: ${n ? `${n} retired number${n === 1 ? '' : 's'}` : 'none retired yet'}`}
              onClick={() => setPicked(t.id)}
              className={cn(
                'relative grid h-12 w-12 shrink-0 place-items-center rounded-lg border bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                on ? 'border-gold bg-gold/10 shadow-[0_0_0_1px_hsl(var(--gold)/0.5),0_0_14px_hsl(var(--gold)/0.35)]' : 'border-line hover:border-chalk/40',
                !n && !on && 'opacity-45',
              )}
            >
              <TeamLogo team={t} size={30} decorative />
              {n > 0 && (
                <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-night px-1 font-mono text-[10px] leading-[18px] text-chalk ring-1 ring-line">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <RaftersScene key={teamId} team={team} banners={banners} ring={ringFor(team)} onOpen={onOpen} onRing={onRing} headingId="hof-rafters-club" />
    </section>
  );
};

export default HofRafters;
