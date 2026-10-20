import { useCallback, useState } from 'react';
import type { Player } from '@/types/player';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import PositionBadge from '../PositionBadge';
import PlayerDetailCard from '../PlayerDetailCard';
import TeamLogo from '../brand/TeamLogo';
import { TierMetric } from '../tables/cells';
import { getReadableTextOn } from '@/utils/teamColors';
import { useJerseyNumbers, type RetiredNumber } from '@/utils/jerseys';
import { matchPlayerByName, useLeagueContent } from '@/utils/leagueContent';
import RetiredRafters from './RetiredRafters';
import { POSITION_LABELS, groupByPosition, type FranchiseStop, type TeamSummary } from './teamStats';

/** Franchise legends shown on the team page */
const LEGENDS_SHOWN = 8;

const stopYears = (l: FranchiseStop) => {
  if (l.approx) return 'Years unknown';
  if (l.from > 80) return `Joins for Y${l.from}`;
  return l.from === l.to ? `Y${l.from}` : `Y${l.from}–${l.to}`;
};

interface TeamSheetProps {
  summary: TeamSummary | null;
  onClose: () => void;
}

/** Team page: colored header + roster grouped by position. */
const TeamSheet = ({ summary, onClose }: TeamSheetProps) => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const t = summary?.team ?? null;
  const primary = t?.primaryColor ?? '226 33% 30%';
  const secondary = t?.secondaryColor ?? '226 33% 20%';
  const fg = getReadableTextOn(primary);
  const groups = summary ? groupByPosition(summary.players) : [];
  const { numberFor, retiredFor, retiredInfo } = useJerseyNumbers();
  const { content } = useLeagueContent();
  const retired = summary ? retiredFor(t?.id ?? summary.label) : [];

  /** Years from the league notes ("Waller–Finney era · Y15–30" -> "Y15–30"), when known. */
  const yearsFor = useCallback(
    (r: RetiredNumber) => {
      const note = content?.playerNotes && matchPlayerByName(r.name, content.playerNotes);
      return note?.era?.match(/~?Y\d+(?:\s*[–-]\s*Y?\d+)?/)?.[0];
    },
    [content],
  );
  const openRetired = (r: RetiredNumber) => {
    const p = summary?.players.find((x) => `${x.position}:${x.name}` === r.playerKey);
    if (p) setSelectedPlayer(p);
  };

  return (
    <>
      <Sheet open={!!summary} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto border-l border-line">
          {summary && (
            <>
              <SheetHeader
                className="relative overflow-hidden p-5 pr-12 text-left space-y-0"
                style={{
                  background: `linear-gradient(120deg, hsl(${primary}) 0%, hsl(${primary}) 60%, hsl(${secondary}) 130%)`,
                  color: fg,
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 -bottom-6 font-display text-[7rem] font-extrabold italic leading-none opacity-15"
                >
                  {t?.abbreviation}
                </span>
                <div className="relative flex items-center gap-4">
                  <span className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-lg">
                    <TeamLogo team={t ?? summary.label} size={56} decorative priority />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                      {t ? `${t.conference} ${t.division}` : 'Custom team'}
                    </p>
                    <SheetTitle className="font-display text-3xl sm:text-4xl font-extrabold uppercase leading-none" style={{ color: fg }}>
                      {summary.label}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-sm" style={{ color: fg, opacity: 0.85 }}>
                      {summary.players.length} players · {summary.hallOfFamers} Hall of Famers
                    </SheetDescription>
                  </div>
                </div>
                <dl className="relative mt-4 grid grid-cols-4 gap-2 rounded-lg bg-black/35 p-2.5 text-center text-white">
                  {[
                    ['Σ Legacy', summary.totalLegacy.toLocaleString()],
                    ['Avg', summary.avgLegacy.toLocaleString()],
                    ['Rings', summary.rings],
                    ['MVPs', summary.mvps],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex flex-col-reverse">
                      <dt className="mt-1 font-pixel text-[9px] uppercase opacity-80">{k}</dt>
                      <dd className="font-display text-xl sm:text-2xl font-bold leading-none tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </SheetHeader>

              <div className="p-4 sm:p-5 space-y-5">
                <RetiredRafters team={t} retired={retired} yearsFor={yearsFor} onSelect={openRetired} />
                {summary.legends.length > 0 && (
                  <section aria-labelledby="franchise-legends">
                    <h3 id="franchise-legends" className="section-title text-base mb-1">
                      Notable players
                      <span className="font-pixel text-[9px] text-muted-foreground">{summary.legends.length}</span>
                    </h3>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Everyone whose career ran through {t?.name ?? summary.label}, from reconstructed career stints. Years are approximate.
                    </p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {summary.legends.slice(0, LEGENDS_SHOWN).map((l) => (
                        <li key={`${l.player.position}:${l.player.name}`}>
                          <button
                            type="button"
                            onClick={() => setSelectedPlayer(l.player)}
                            className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-left hover:border-line"
                          >
                            <PositionBadge position={l.player.position} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold hover:text-gold">{l.player.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {stopYears(l)}
                                {l.rings.length > 0 && ` · ${l.rings.length} ${l.rings.length === 1 ? 'ring' : 'rings'} here`}
                                {(l.confidence === 'likely' || l.confidence === 'ambiguous') && !l.approx && ' · Likely'}
                              </span>
                            </span>
                            <TierMetric value={l.player.careerLegacy} metric="careerLegacy" format="number" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {groups.map(({ position, players }) => (
                  <section key={position} aria-labelledby={`roster-${position}`}>
                    <h3 id={`roster-${position}`} className="section-title text-base mb-2">
                      <PositionBadge position={position} />
                      {POSITION_LABELS[position]}
                      <span className="font-pixel text-[9px] text-muted-foreground">{players.length}</span>
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="stats-table">
                        <thead>
                          <tr>
                            <th scope="col" className="num w-10"><abbr title="Jersey number" className="no-underline">#</abbr></th>
                            <th scope="col" className="sticky-col">Player</th>
                            <th scope="col">Pos</th>
                            <th scope="col" className="num"><abbr title="Games played" className="no-underline">GP</abbr></th>
                            <th scope="col" className="num">Rings</th>
                            <th scope="col" className="num">Legacy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map((p) => {
                            const ret = retiredInfo(p);
                            return (
                            <tr key={`${p.name}-${p.position}`}>
                              <td className="num">
                                <span
                                  className={ret ? 'inline-flex min-w-[2rem] justify-center rounded px-1 font-display text-base font-extrabold italic tabular-nums text-night' : 'font-display text-base font-bold italic tabular-nums text-chalk'}
                                  style={ret ? { background: 'linear-gradient(135deg, #f6dc8a, #b8892b 55%, #f3d277)' } : undefined}
                                  title={ret ? `Retired by the ${ret.teamLabel}` : undefined}
                                >
                                  {numberFor(p)}
                                </span>
                                {ret && <span className="sr-only"> (retired)</span>}
                              </td>
                              <td className="sticky-col max-w-[10rem] sm:max-w-none">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayer(p)}
                                  className="flex flex-col items-start text-left max-w-full rounded"
                                >
                                  <span className="font-semibold truncate max-w-full hover:text-gold">{p.name}</span>
                                  {p.nickname && (
                                    <span className="text-xs italic text-muted-foreground truncate max-w-full">"{p.nickname}"</span>
                                  )}
                                </button>
                              </td>
                              <td className="font-display font-bold">{p.position}</td>
                              <td className="num font-mono">{p.games}</td>
                              <td className="num font-mono">{p.rings}</td>
                              <td className="num">
                                <TierMetric value={p.careerLegacy} metric="careerLegacy" format="number" />
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </>
  );
};

export default TeamSheet;
