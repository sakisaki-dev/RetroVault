import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import CountUp from '@/components/brand/CountUp';
import TeamLogo from '@/components/brand/TeamLogo';
import { findNFLTeam } from '@/utils/nflTeams';
import { COACH_NAME_KEY, DEFAULT_COACH_NAME, type Resume } from '@/utils/frontOffice';
import { staggerStyle, teamVars, yearSpan } from './shared';

const readName = () => {
  try {
    return localStorage.getItem(COACH_NAME_KEY)?.trim() || DEFAULT_COACH_NAME;
  } catch {
    return DEFAULT_COACH_NAME;
  }
};

const writeName = (name: string) => {
  try {
    if (name === DEFAULT_COACH_NAME) localStorage.removeItem(COACH_NAME_KEY);
    else localStorage.setItem(COACH_NAME_KEY, name);
  } catch {
    /* storage unavailable: keep in memory */
  }
};

const CoachName = () => {
  const [name, setName] = useState(readName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const inputId = useId();

  useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (wasEditing.current) editRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === COACH_NAME_KEY && setName(readName());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    const next = draft.replace(/\s+/g, ' ').trim().slice(0, 40) || DEFAULT_COACH_NAME;
    setName(next);
    writeName(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Coach display name
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
          className="h-12 w-full min-w-0 max-w-[22rem] rounded-md border border-primary/60 bg-black/70 px-3 font-display text-3xl uppercase tracking-tight text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto"
        />
        <button type="submit" className="inline-flex h-10 items-center gap-1 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Check className="h-4 w-4" aria-hidden="true" /> Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex h-10 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" /> Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 id="fo-title" className="min-w-0 break-words font-display text-4xl uppercase leading-none tracking-tight text-foreground sm:text-5xl lg:text-6xl">
        <span className="sr-only">The Front Office: </span>
        {name}
      </h1>
      <button
        ref={editRef}
        type="button"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-black/40 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Edit coach name (currently ${name})`}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

interface CoachHeaderProps {
  resume: Resume;
  franchiseCount: number;
  stintCount: number;
}

const CoachHeader = ({ resume, franchiseCount, stintCount }: CoachHeaderProps) => {
  const club = findNFLTeam(resume.currentClub);
  const clubName = club?.fullName ?? resume.currentClub ?? 'No club';
  const { titleStreak: ts, appearanceStreak: as } = resume;

  const lamps = [
    {
      label: 'Super Bowl record',
      value: (
        <>
          <CountUp value={resume.wins} />
          <span className="px-0.5 text-muted-foreground">–</span>
          <CountUp value={resume.losses} />
        </>
      ),
      sub: `${Math.round(resume.winPct * 100)}% win rate`,
    },
    { label: 'Titles', value: <CountUp value={resume.wins} />, sub: `with ${resume.titleFranchises.length} franchises` },
    { label: 'Appearances', value: <CountUp value={resume.appearances} />, sub: resume.season ? `in ${resume.season} seasons` : 'Super Bowls' },
    {
      label: 'Title streak',
      value: <CountUp value={ts.length} />,
      sub: ts.start != null ? `${yearSpan(ts.start, ts.end!)} · longest` : 'longest',
    },
    {
      label: 'Straight Super Bowls',
      value: <CountUp value={as.length} />,
      sub: as.start != null ? `${yearSpan(as.start, as.end!)} · longest` : 'longest',
    },
    { label: 'Franchises', value: <CountUp value={franchiseCount} />, sub: `${stintCount} stints` },
  ];

  return (
    <section aria-labelledby="fo-title" className="fo-panel fo-hero stagger-in" style={{ ...teamVars(resume.currentClub), ...staggerStyle(0) }}>
      <div className="fo-hero__logo" aria-hidden="true">
        <TeamLogo team={club ?? resume.currentClub} size={300} decorative />
      </div>
      <div className="relative space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="lamp" aria-hidden="true">
                The Front Office
              </p>
              {resume.season != null && (
                <span className="lamp">
                  Season <b>Y{resume.season}</b>
                </span>
              )}
            </div>
            <CoachName />
            <div className="fo-plate">
              <span className="flex items-center gap-2.5 py-1.5 pl-4 pr-6">
                <TeamLogo team={club ?? resume.currentClub} size={36} decorative priority />
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Head coach &amp; general manager
                  </span>
                  <span className="block truncate font-display text-lg uppercase tracking-wide text-foreground">{clubName}</span>
                </span>
              </span>
            </div>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground md:text-right">
            {resume.firstYear != null && resume.season != null ? `Y${resume.firstYear}–Y${resume.season}. ` : ''}
            Every number here is computed from the league's Super Bowl history.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6" aria-label="Career scoreboard">
          {lamps.map((l, i) => (
            <li key={l.label} className="fo-lamp stagger-in" style={staggerStyle(i + 1)}>
              <span className="fo-lamp__label">{l.label}</span>
              <span className="fo-lamp__value">{l.value}</span>
              <span className="fo-lamp__sub">{l.sub}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default CoachHeader;
