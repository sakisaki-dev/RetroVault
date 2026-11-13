import { useMemo, useRef } from 'react';
import { Clapperboard, IdCard } from 'lucide-react';
import type { Player } from '@/types/player';
import type { HofMember } from '@/utils/hallOfFame';
import { hofClassLabel } from '@/utils/hallOfFame';
import { normalizeName, type IndexedExtras } from '@/utils/playerExtras';
import type { JerseyIndex, RetiredNumber } from '@/utils/jerseys';
import { findNFLTeam, getNFLTeamById } from '@/utils/nflTeams';
import { usePhone } from '@/hooks/usePhone';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import RetiredRafters from '../teams/RetiredRafters';
import TeamLogo from '../brand/TeamLogo';
import { BallotBadge, ScoreMedal } from './hofParts';
import { POS_NAMES, careerLine, clubColors, fmt, ordinal, yearsOf } from './hofUtils';

const PLAQUE_INK = 'hsl(43 70% 84%)';
const PLAQUE_MUTED = 'hsl(40 35% 66%)';

const ScorePart = ({ label, value, max, note }: { label: string; value: number; max: number; note: string }) => (
  <div>
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="font-semibold" style={{ color: PLAQUE_INK }}>
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums" style={{ color: PLAQUE_INK }}>
        {value} / {max}
      </span>
    </div>
    <div className="mt-1 h-2 rounded-full" style={{ background: 'hsl(30 30% 8% / 0.7)' }} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%`, background: 'linear-gradient(90deg, hsl(36 90% 42%), hsl(45 100% 70%))' }}
      />
    </div>
    <p className="mt-0.5 text-xs" style={{ color: PLAQUE_MUTED }}>
      {note}
    </p>
  </div>
);

/**
 * The plaque for one Hall of Famer: a bottom sheet on phones, a side panel on desktop (Radix dialog: focus trap,
 * Esc, swipe down and the close button all close it).
 */
const HofPlaque = ({
  member,
  player,
  number,
  club,
  extras,
  jerseys,
  nickname,
  speech,
  onClose,
  onReplay,
  onOpenCard,
}: {
  member: HofMember | null;
  player?: Player;
  number: number | null;
  club: string;
  extras: IndexedExtras;
  jerseys: JerseyIndex;
  nickname?: string;
  speech?: string;
  onClose: () => void;
  onReplay: (m: HofMember) => void;
  onOpenCard: (p: Player) => void;
}) => {
  const phone = usePhone();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stints = member ? extras.stints[normalizeName(member.name)] : undefined;

  // Every club that hangs his number (a Hall of Famer can be retired by more than one)
  const rafters = useMemo(() => {
    if (!member) return [];
    const out: { teamKey: string; label: string; list: RetiredNumber[] }[] = [];
    jerseys.retired.forEach((list, teamKey) => {
      const mine = list.filter((r) => r.playerKey === member.key);
      if (mine.length) out.push({ teamKey, label: mine[0].teamLabel, list: mine });
    });
    return out;
  }, [jerseys, member]);

  const paragraphs = (speech ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const team = findNFLTeam(club);
  const isDefense = member ? ['LB', 'DB', 'DL'].includes(member.pos) : false;
  const honours = member
    ? [
        { label: 'Rings', value: member.rings },
        { label: 'MVP', value: member.mvp },
        ...(isDefense ? [{ label: 'DPOY', value: member.dpoy }] : [{ label: 'OPOY', value: member.opoy }]),
        ...(isDefense && member.opoy ? [{ label: 'OPOY', value: member.opoy }] : []),
        ...(!isDefense && member.dpoy ? [{ label: 'DPOY', value: member.dpoy }] : []),
        { label: 'SB MVP', value: member.sbmvp },
      ]
    : [];
  const totalSeasons = (stints?.stints ?? []).reduce((n, s) => n + (s.to - s.from + 1), 0);

  return (
    <Sheet open={!!member} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={phone ? 'bottom' : 'right'}
        // Open on the plaque's name (read first, and the sheet stays at its top), not on the first button
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus({ preventScroll: true });
        }}
        className={
          phone
            ? 'max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-t-2xl border-line bg-popover px-3 pb-6 pt-8'
            : 'w-full overflow-y-auto overflow-x-hidden border-l border-line bg-popover p-5 sm:max-w-xl'
        }
      >
        {member && (
          // Clear of the close button and the grab handle (the dialog bar sits over the sheet's top padding)
          <div className="space-y-5 pt-12">
            {/* The plaque */}
            <article
              className="relative overflow-hidden rounded-xl p-[3px]"
              style={{ background: 'linear-gradient(145deg, hsl(45 100% 74%), hsl(36 85% 38%) 40%, hsl(43 95% 60%) 70%, hsl(30 80% 30%))' }}
            >
              <div
                className="relative rounded-[10px] px-4 pb-5 pt-4 sm:px-6"
                style={{
                  background: 'radial-gradient(120% 80% at 50% 0%, hsl(34 42% 26%), hsl(30 40% 14%) 60%, hsl(28 40% 9%))',
                  boxShadow: 'inset 0 0 0 1px hsl(43 80% 60% / 0.35), inset 0 2px 18px hsl(28 60% 3% / 0.7)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-pixel text-[9px] uppercase tracking-widest" style={{ color: PLAQUE_MUTED }}>
                      Hall of Fame · {hofClassLabel(member.class)}
                    </p>
                    <SheetTitle
                      ref={titleRef}
                      tabIndex={-1}
                      className="mt-1 font-display text-3xl font-extrabold uppercase leading-none tracking-wide focus:outline-none sm:text-4xl"
                      style={{ color: PLAQUE_INK, textShadow: '0 1px 0 hsl(28 60% 4%), 0 -1px 0 hsl(45 100% 80% / 0.25)' }}
                    >
                      {member.name}
                    </SheetTitle>
                    {nickname && (
                      <p className="mt-1 font-display text-lg italic" style={{ color: 'hsl(43 100% 66%)' }}>
                        &ldquo;{nickname}&rdquo;
                      </p>
                    )}
                    <SheetDescription className="mt-1 text-sm" style={{ color: PLAQUE_MUTED }}>
                        {POS_NAMES[member.pos] ?? member.pos}
                        {number != null ? ` · #${number}` : ''}
                        {team ? ` · ${team.fullName}` : ''}
                        {yearsOf(stints) ? ` · ${yearsOf(stints)}` : ''}
                      </SheetDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <BallotBadge firstBallot={member.firstBallot} veteran={member.veteran} />
                      {member.yearsOnBallot > 1 && (
                        <span className="text-xs" style={{ color: PLAQUE_MUTED }}>
                          {member.yearsOnBallot} years on the ballot
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ScoreMedal score={member.score} size="lg" />
                    <span className="font-pixel text-[8px] uppercase" style={{ color: PLAQUE_MUTED }}>
                      Score
                    </span>
                  </div>
                </div>

                {/* Clubs as a stint timeline */}
                {stints?.stints.length ? (
                  <section aria-label="Clubs" className="mt-4">
                    <div className="flex h-7 w-full overflow-hidden rounded-md ring-1 ring-black/40" aria-hidden="true">
                      {stints.stints.map((s, i) => {
                        const c = clubColors(s.team);
                        const len = s.to - s.from + 1;
                        return (
                          <span
                            key={`${s.team}-${s.from}-${i}`}
                            className="flex min-w-0 items-center justify-center overflow-hidden font-pixel text-[8px] uppercase"
                            style={{ width: `${(len / Math.max(1, totalSeasons)) * 100}%`, background: `hsl(${c.primary})`, color: 'white', boxShadow: `inset 0 -3px 0 hsl(${c.secondary})` }}
                          >
                            {len >= 3 ? c.team?.abbreviation ?? s.team.slice(0, 3) : ''}
                          </span>
                        );
                      })}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {stints.stints.map((s, i) => (
                        <li key={`${s.team}-${s.from}-${i}`} className="flex items-center gap-1">
                          <TeamLogo team={s.team} size={14} decorative />
                          <span className="font-semibold" style={{ color: clubColors(s.team).ink }}>
                            {s.team}
                          </span>
                          <span style={{ color: PLAQUE_MUTED }}>
                            {s.from === s.to ? `Y${s.from}` : `Y${s.from}–Y${s.to}`}
                            {s.rings.length ? ` · ${s.rings.length} ring${s.rings.length === 1 ? '' : 's'}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {/* Career line */}
                {player && (
                  <dl className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {careerLine(player).map((s) => (
                      <div key={s.label} className="flex flex-col-reverse rounded-md px-2 py-1.5 text-center" style={{ background: 'hsl(28 40% 6% / 0.55)' }}>
                        <dt className="font-pixel text-[8px] uppercase" style={{ color: PLAQUE_MUTED }}>
                          {s.label}
                        </dt>
                        <dd className="font-display text-lg font-bold tabular-nums" style={{ color: PLAQUE_INK }}>
                          {fmt(s.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {/* Honours */}
                <dl className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 border-y py-2" style={{ borderColor: 'hsl(43 70% 55% / 0.3)' }}>
                  {honours.map((h) => (
                    <div key={h.label} className="flex items-baseline gap-1">
                      <dd className="font-display text-xl font-extrabold tabular-nums" style={{ color: h.value ? 'hsl(43 100% 66%)' : PLAQUE_MUTED }}>
                        {h.value}
                      </dd>
                      <dt className="font-pixel text-[8px] uppercase" style={{ color: PLAQUE_MUTED }}>
                        {h.label}
                      </dt>
                    </div>
                  ))}
                </dl>

                {member.records.length > 0 && (
                  <div className="mt-3">
                    <p className="font-pixel text-[8px] uppercase tracking-widest" style={{ color: PLAQUE_MUTED }}>
                      League career records held when he retired
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {member.records.map((r) => (
                        <li key={r} className="rounded-sm px-2 py-0.5 text-xs font-bold text-night" style={{ background: 'linear-gradient(180deg, hsl(45 100% 74%), hsl(40 90% 52%))' }}>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Score breakdown */}
                <section aria-label="Hall of Fame Score" className="mt-4 space-y-2.5">
                  <ScorePart
                    label="Standing"
                    value={member.parts.standing}
                    max={60}
                    note={`${ordinal(member.rank)} ${member.pos} all-time by Career Legacy when he retired (${member.frozenSeason}, ${fmt(member.careerLegacy)})`}
                  />
                  <ScorePart label="Honours" value={member.parts.honours} max={24} note="MVPs, OPOY / DPOY, Super Bowl MVPs and rings" />
                  <ScorePart
                    label="Records"
                    value={member.parts.records}
                    max={Math.max(30, member.parts.records)}
                    note={member.records.length === 1 ? '+15 for one league career record' : member.records.length ? `+15 each for ${member.records.length} league career records` : 'No league career record when he retired'}
                  />
                  {member.parts.standing + member.parts.honours + member.parts.records > 100 && (
                    <p className="text-xs" style={{ color: PLAQUE_MUTED }}>
                      The score tops out at 100.
                    </p>
                  )}
                </section>
              </div>
            </article>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onReplay(member)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-3 font-bold text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Clapperboard className="h-4 w-4" aria-hidden="true" />
                Replay ceremony
              </button>
              <button
                type="button"
                disabled={!player}
                onClick={() => player && onOpenCard(player)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 font-semibold text-chalk hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <IdCard className="h-4 w-4" aria-hidden="true" />
                Player card
              </button>
            </div>

            {paragraphs.length > 0 && (
              <section aria-labelledby="hof-speech-title" className="rounded-xl border border-line bg-card p-4">
                <h3 id="hof-speech-title" className="font-pixel text-[10px] uppercase tracking-widest text-gold">
                  Induction speech
                </h3>
                <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-chalk/90">
                  {paragraphs.map((p, i) => (
                    <p key={i} className={i === 0 ? 'font-display text-lg font-semibold italic text-chalk' : undefined}>
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {rafters.map((r) => (
              <RetiredRafters
                key={r.teamKey}
                team={getNFLTeamById(r.teamKey)}
                retired={r.list}
                title={`Retired by the ${r.label}`}
                headingId={`hof-rafters-${r.teamKey}`}
              />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default HofPlaque;
