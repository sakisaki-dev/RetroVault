import { useMemo, useState } from 'react';
import type { RingOfHonorEntry } from '@/utils/hallOfFame';
import { NFL_TEAMS, findNFLTeam } from '@/utils/nflTeams';
import TeamLogo from '../brand/TeamLogo';
import { clubColors, fmt } from './hofUtils';
import { cn } from '@/lib/utils';

/** Rings of Honor: pick a club, see its ring (Hall of Famers first, in gold), in the club's colours. */
const RingsOfHonor = ({
  rings,
  defaultClub,
  onOpen,
}: {
  rings: Record<string, RingOfHonorEntry[]>;
  defaultClub?: string | null;
  /** Opens a ring member (a Hall of Famer's plaque, else his player card) */
  onOpen: (e: RingOfHonorEntry) => void;
}) => {
  // Every club, keyed by its nickname as the data uses it
  const byTeam = useMemo(() => {
    const m = new Map<string, RingOfHonorEntry[]>();
    Object.entries(rings).forEach(([club, list]) => {
      const t = findNFLTeam(club);
      if (t) m.set(t.id, list);
    });
    return m;
  }, [rings]);
  const teams = useMemo(() => [...NFL_TEAMS].sort((a, b) => a.name.localeCompare(b.name)), []);
  const initial = useMemo(() => {
    const own = findNFLTeam(defaultClub);
    if (own && byTeam.has(own.id)) return own.id;
    return teams.find((t) => byTeam.has(t.id))?.id ?? teams[0]?.id;
  }, [defaultClub, byTeam, teams]);
  const [picked, setPicked] = useState<string | null>(null);
  const teamId = picked ?? initial;
  const team = teams.find((t) => t.id === teamId) ?? null;
  const list = (teamId && byTeam.get(teamId)) || [];
  const c = clubColors(team);

  return (
    <section aria-labelledby="hof-rings-title" className="mb-10">
      <p className="font-pixel text-[10px] uppercase tracking-widest text-gold/90">Every club</p>
      <h2 id="hof-rings-title" className="font-display text-2xl font-extrabold uppercase italic text-chalk sm:text-3xl">
        Rings of Honor
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">Each club's Hall of Famers, plus the retired players it is best known for by Career Legacy or rings won there.</p>

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-2 pt-2 scrollbar-none" role="group" aria-label="Pick a club">
        {teams.map((t) => {
          const on = t.id === teamId;
          const n = byTeam.get(t.id)?.length ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              aria-label={`${t.fullName}: ${n ? `${n} in the ring` : 'no ring yet'}`}
              onClick={() => setPicked(t.id)}
              className={cn(
                'relative grid h-12 w-12 shrink-0 place-items-center rounded-lg border bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                on ? 'border-gold bg-gold/10' : 'border-line hover:border-chalk/40',
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

      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: `hsl(${c.primary} / 0.7)`, background: `linear-gradient(160deg, hsl(${c.primary} / 0.28), hsl(var(--card)) 45%)` }}
      >
        <div className="flex items-center gap-3 px-3 py-3 sm:px-4" style={{ boxShadow: `inset 0 -3px 0 hsl(${c.secondary} / 0.8)` }}>
          <TeamLogo team={team} size={40} decorative />
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-extrabold uppercase italic text-chalk">{team?.fullName ?? 'Club'}</h3>
            <p className="font-pixel text-[9px] uppercase text-muted-foreground">
              {list.length ? `${list.length} in the ring · ${list.filter((e) => e.hof).length} Hall of Famer${list.filter((e) => e.hof).length === 1 ? '' : 's'}` : 'No ring yet'}
            </p>
          </div>
        </div>
        {list.length ? (
          <ol className="divide-y divide-line/60">
            {list.map((e) => (
              <li key={`${e.pos}:${e.name}`}>
                <button
                  type="button"
                  onClick={() => onOpen(e)}
                  className="flex min-h-[48px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold sm:px-4"
                  aria-label={`${e.name}, ${e.pos}${e.hof ? ', Hall of Famer' : `, ${e.why}`}, Career Legacy ${fmt(e.careerLegacy)}. Open`}
                >
                  <span
                    aria-hidden="true"
                    className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full font-pixel text-[8px]', e.hof ? 'text-night' : 'text-chalk')}
                    style={e.hof ? { background: 'radial-gradient(circle at 32% 28%, hsl(45 100% 86%), hsl(43 100% 62%) 50%, hsl(36 90% 40%))' } : { background: `hsl(${c.primary})`, boxShadow: `inset 0 0 0 2px hsl(${c.secondary})` }}
                  >
                    {e.pos}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-display text-lg font-bold uppercase leading-tight', e.hof ? 'text-gold' : 'text-chalk')}>{e.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {e.hof ? 'Hall of Famer' : e.why === 'Career Legacy' ? `Career Legacy ${fmt(e.careerLegacy)}` : e.why}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmt(e.careerLegacy)}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">The {team?.name ?? 'club'} have no Ring of Honor yet: no Hall of Famer, and no retired player reached the ring's bar with them.</p>
        )}
      </div>
    </section>
  );
};

export default RingsOfHonor;
