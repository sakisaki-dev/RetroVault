import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { Trophy } from 'lucide-react';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import PlayerDetailCard from '../PlayerDetailCard';
import TeamLogo from '../brand/TeamLogo';
import ProPlayerBanner from '../brand/ProPlayerBanner';
import { getReadableTextOn, liftForDarkBg } from '@/utils/teamColors';
import { useJerseyNumbers, type RetiredNumber } from '@/utils/jerseys';
import { latestSeasonYear, matchPlayerByName, useLeagueContent } from '@/utils/leagueContent';
import type { CoachedSummary } from '@/utils/frontOffice';
import { isHallOfFamer } from '@/config/stats';
import RetiredRafters from './RetiredRafters';
import TitlesTimeline from './TitlesTimeline';
import PositionRadar from './PositionRadar';
import {
  POSITION_LABELS,
  franchiseLeaders,
  groupByPosition,
  positionStrength,
  tenureText,
  type FranchiseRecord,
  type FranchiseStop,
  type TeamSummary,
} from './teamStats';

/** Franchise legends shown before "Show all" */
const LEGENDS_SHOWN = 8;

type TabKey = 'overview' | 'legends' | 'roster' | 'leaders';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'legends', label: 'Legends' },
  { key: 'roster', label: 'Roster' },
  { key: 'leaders', label: 'Leaders' },
];

const stopYears = (l: FranchiseStop, last: number) => {
  if (l.approx) return null;
  if (last && l.from > last) return `Joins for Y${l.from}`;
  return l.from === l.to ? `Y${l.from}` : `Y${l.from}–${l.to}`;
};

const isHof = (p: Player) => isHallOfFamer(p);

interface TeamSheetProps {
  summary: TeamSummary | null;
  record?: FranchiseRecord;
  coached?: CoachedSummary;
  /** League players (no real NFL legends), for position percentiles */
  league: Player[];
  ovrFor: (p: Player) => number | null;
  onClose: () => void;
}

/** Franchise page: team-coloured hero, then Overview / Legends / Roster / Leaders tabs. */
const TeamSheet = ({ summary, record, coached, league, ovrFor, onClose }: TeamSheetProps) => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [tabState, setTabState] = useState<{ key: string; tab: TabKey; all: boolean }>({ key: '', tab: 'overview', all: false });
  const tab = tabState.key === summary?.key ? tabState.tab : 'overview';
  const showAll = tabState.key === summary?.key && tabState.all;
  const setTab = (next: TabKey) => setTabState({ key: summary?.key ?? '', tab: next, all: showAll });

  const t = summary?.team ?? null;
  const primary = t?.primaryColor ?? '226 33% 30%';
  const secondary = t && t.secondaryColor !== t.primaryColor ? t.secondaryColor : '226 33% 18%';
  const fg = getReadableTextOn(primary);
  const accent = liftForDarkBg(primary, 60);
  const { numberFor, retiredFor, retiredInfo } = useJerseyNumbers();
  const { content } = useLeagueContent();
  const lastSeason = latestSeasonYear(content);
  const retired = summary ? retiredFor(t?.id ?? summary.label) : [];
  const teamName = t?.name ?? summary?.label ?? '';

  // Current roster: active players only (status is internal and never shown)
  const roster = useMemo(() => (summary ? groupByPosition(summary.players.filter((p) => p.status !== 'Retired')) : []), [summary]);
  const rosterCount = roster.reduce((s, g) => s + g.players.length, 0);

  // Legends: every stint here, plus anyone whose sheet team is here but has no stint record
  const legends = useMemo(() => {
    if (!summary) return [];
    const seen = new Set(summary.legends.map((l) => l.player));
    const extra = summary.players.filter((p) => !seen.has(p)).map((player) => ({ player, years: null as string | null, rings: [] as number[] }));
    return [...summary.legends.map((l) => ({ player: l.player, years: stopYears(l, lastSeason), rings: l.rings })), ...extra].sort(
      (a, b) => (b.player.careerLegacy || 0) - (a.player.careerLegacy || 0),
    );
  }, [summary]);
  const leaders = useMemo(() => (summary ? franchiseLeaders(summary.franchisePlayers) : []), [summary]);
  const strength = useMemo(() => (summary ? positionStrength(summary.franchisePlayers, league) : []), [summary, league]);

  /** Years from the league notes ("Waller–Finney era · Y15–30" -> "Y15–30"), when known. */
  const yearsFor = useCallback(
    (r: RetiredNumber) => {
      const note = content?.playerNotes && matchPlayerByName(r.name, content.playerNotes);
      return note?.era?.match(/~?Y\d+(?:\s*[–-]\s*Y?\d+)?/)?.[0];
    },
    [content],
  );
  const openRetired = (r: RetiredNumber) => {
    const p = summary?.franchisePlayers.find((x) => `${x.position}:${x.name}` === r.playerKey);
    if (p) setSelectedPlayer(p);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((x) => x.key === tab);
    const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : -1;
    if (j < 0) return;
    e.preventDefault();
    setTab(TABS[j].key);
    document.getElementById(`team-tab-${TABS[j].key}`)?.focus();
  };

  const heroStats: [string, string | number][] = record
    ? [
        ['Titles', record.titles],
        ['SB apps', record.appearances],
        ['HOF', record.hof.length],
        ['Roster', rosterCount],
        ['Best OVR', record.bestOvr ?? '—'],
      ]
    : [];
  const sbChips = record
    ? [...record.titleYears.map((y) => ({ y, won: true })), ...record.lossYears.map((y) => ({ y, won: false }))].sort((a, b) => a.y - b.y)
    : [];
  const shownLegends = showAll ? legends : legends.slice(0, LEGENDS_SHOWN);

  return (
    <>
      <Sheet open={!!summary} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-y-auto overflow-x-hidden border-l border-line">
          {summary && (
            <>
              {/* Hero */}
              <SheetHeader
                className="relative overflow-hidden p-5 pr-12 pb-4 text-left space-y-0"
                style={{
                  background: `linear-gradient(125deg, hsl(${primary}) 0%, hsl(${primary}) 58%, hsl(${secondary}) 140%)`,
                  color: fg,
                }}
              >
                <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-10 opacity-[0.14]">
                  <TeamLogo team={t ?? summary.label} size={300} decorative />
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'repeating-linear-gradient(115deg, transparent 0 26px, hsl(0 0% 100% / 0.04) 26px 52px)' }}
                />
                <div className="relative flex items-center gap-4">
                  <span className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-lg ring-4 ring-black/15">
                    <TeamLogo team={t ?? summary.label} size={68} decorative priority />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-sm bg-black/45 px-1.5 py-1 font-pixel text-[8px] uppercase tracking-wider text-white">
                        {t ? `${t.conference} ${t.division}` : 'Custom team'}
                      </span>
                      {record && (
                        <span className="rounded-sm bg-black/75 px-1.5 py-1 font-pixel text-[8px] uppercase text-gold">Power #{record.powerRank}</span>
                      )}
                    </p>
                    <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.2em] opacity-85">{t?.city ?? 'League franchise'}</p>
                    <SheetTitle
                      className="font-display text-4xl sm:text-6xl font-extrabold italic uppercase leading-[0.9] break-words"
                      style={{ color: fg }}
                    >
                      {teamName}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      Franchise page for the {summary.label}: titles, legends, current roster and franchise leaders.
                    </SheetDescription>
                  </div>
                </div>

                {heroStats.length > 0 && (
                  <dl className="relative !mt-4 grid grid-cols-5 gap-1 rounded-lg bg-black/45 p-2 text-center text-white backdrop-blur-[2px]">
                    {heroStats.map(([k, v]) => (
                      <div key={k} className="flex min-w-0 flex-col-reverse">
                        <dt className="mt-1 truncate font-pixel text-[7px] sm:text-[8px] uppercase opacity-75">{k}</dt>
                        <dd className={cn('font-display text-xl sm:text-3xl font-extrabold leading-none tabular-nums', k === 'Titles' && Number(v) > 0 && 'text-gold')}>
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {sbChips.length > 0 && (
                  <ul className="relative !mt-3 flex flex-wrap gap-1" aria-label="Super Bowl appearances">
                    {sbChips.map(({ y, won }) => (
                      <li
                        key={`${y}-${won}`}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-pixel text-[8px] uppercase',
                          won ? 'bg-black/80 text-gold ring-1 ring-gold/70' : 'bg-black/35 text-white/85 ring-1 ring-white/30',
                        )}
                      >
                        {won ? <Trophy className="h-2.5 w-2.5 fill-gold" aria-hidden="true" /> : null}
                        Y{y}
                        <span className={won ? 'sr-only' : ''}>{won ? ' won' : ' L'}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {coached && (
                  <p className="relative !mt-3 inline-flex max-w-full items-center gap-1.5 rounded-md border border-gold/60 bg-black/65 px-2 py-1 text-xs text-white">
                    <span className="font-pixel text-[8px] uppercase text-gold shrink-0">Coached here</span>
                    <span className="min-w-0 truncate">
                      {tenureText(coached.stints)} · {coached.w}–{coached.l}
                      {coached.t ? `–${coached.t}` : ''} · {coached.titles} {coached.titles === 1 ? 'title' : 'titles'}
                    </span>
                  </p>
                )}
              </SheetHeader>

              {/* Tabs */}
              <div
                role="tablist"
                aria-label={`${teamName} sections`}
                className="sticky top-0 z-10 flex gap-1 overflow-x-auto scrollbar-none border-b border-border bg-background/95 px-3 backdrop-blur sm:px-5"
              >
                {TABS.map((x) => (
                  <button
                    key={x.key}
                    id={`team-tab-${x.key}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === x.key}
                    aria-controls={`team-panel-${x.key}`}
                    tabIndex={tab === x.key ? 0 : -1}
                    onClick={() => setTab(x.key)}
                    onKeyDown={onTabKey}
                    className={cn(
                      'relative shrink-0 px-3 py-3 font-display text-sm font-bold uppercase tracking-wide transition-colors',
                      tab === x.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {x.label}
                    {x.key === 'legends' && <span className="ml-1 font-pixel text-[8px] text-muted-foreground">{legends.length}</span>}
                    {x.key === 'roster' && <span className="ml-1 font-pixel text-[8px] text-muted-foreground">{rosterCount}</span>}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-[3px] rounded-t transition-opacity"
                      style={{ background: accent, opacity: tab === x.key ? 1 : 0 }}
                    />
                  </button>
                ))}
              </div>

              <div
                id={`team-panel-${tab}`}
                role="tabpanel"
                aria-labelledby={`team-tab-${tab}`}
                className="p-4 sm:p-5 space-y-6 min-w-0 animate-slide-in"
                key={`${summary.key}-${tab}`}
              >
                {tab === 'overview' && (
                  <>
                    {record && (
                      <section aria-labelledby="titles-timeline">
                        <h3 id="titles-timeline" className="section-title text-base mb-2">
                          Super Bowl history
                        </h3>
                        <TitlesTimeline
                          teamName={summary.label}
                          primary={primary}
                          titleYears={record.titleYears}
                          lossYears={record.lossYears}
                          coachedYears={coached?.years ?? []}
                          years={lastSeason || undefined}
                        />
                      </section>
                    )}
                    {legends.length > 0 && (
                      <section aria-labelledby="franchise-icons">
                        <h3 id="franchise-icons" className="section-title text-base mb-2">
                          Franchise icons
                        </h3>
                        <ul className="grid gap-2 sm:grid-cols-3">
                          {legends.slice(0, 3).map((l, i) => (
                            <li key={`${l.player.position}:${l.player.name}`} className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedPlayer(l.player)}
                                className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-secondary/30 p-2.5 text-left hover:border-line"
                                aria-label={`Number ${i + 1} franchise icon: ${l.player.name}, ${l.player.position}, ${Math.round(l.player.careerLegacy || 0).toLocaleString()} Career Legacy. Open player`}
                              >
                                <span className="font-display text-3xl font-extrabold italic leading-none text-gold" aria-hidden="true">
                                  {i + 1}
                                </span>
                                <span className="min-w-0" aria-hidden="true">
                                  <span className="block truncate font-display text-base font-bold uppercase leading-tight">{l.player.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {l.player.position}
                                    {l.years ? ` · ${l.years}` : ''} · {Math.round(l.player.careerLegacy || 0).toLocaleString()}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <RetiredRafters team={t} retired={retired} yearsFor={yearsFor} onSelect={openRetired} />
                    {summary.franchisePlayers.length > 0 && (
                      <section aria-labelledby="position-strength">
                        <h3 id="position-strength" className="section-title text-base mb-1">
                          All-time strength
                        </h3>
                        <p className="mb-3 text-xs text-muted-foreground">
                          Best player ever at each position here, as a league percentile of Career Legacy at that position.
                        </p>
                        <PositionRadar teamName={summary.label} primary={primary} rows={strength} onSelect={setSelectedPlayer} />
                      </section>
                    )}
                  </>
                )}

                {tab === 'legends' && (
                  <section aria-labelledby="franchise-legends">
                    <h3 id="franchise-legends" className="section-title text-base mb-1">
                      Notable players
                      <span className="font-pixel text-[9px] text-muted-foreground">{legends.length}</span>
                    </h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Everyone whose career ran through {teamName}, from reconstructed career stints. Years are approximate.
                    </p>
                    {legends.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No league players have played here yet.</p>
                    ) : (
                      <>
                        <ul className="grid gap-3 sm:grid-cols-2">
                          {shownLegends.map((l) => {
                            const ret = retiredInfo(l.player);
                            return (
                              <li key={`${l.player.position}:${l.player.name}`} className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayer(l.player)}
                                  className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left hover:border-line"
                                  aria-label={`${l.player.name}, ${l.player.position}${l.years ? `, here ${l.years}` : ''}${l.rings.length ? `, ${l.rings.length} ${l.rings.length === 1 ? 'ring' : 'rings'} here` : ''}, ${Math.round(l.player.careerLegacy || 0).toLocaleString()} Career Legacy. Open player`}
                                >
                                  <ProPlayerBanner
                                    size="card"
                                    name={l.player.name}
                                    position={l.player.position}
                                    team={t ?? summary.label}
                                    number={numberFor(l.player)}
                                    ovr={ovrFor(l.player)}
                                    hallOfFamer={isHof(l.player)}
                                    retiredBy={ret?.teamLabel ?? null}
                                    interactive
                                    className="rounded-b-none"
                                  />
                                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground" aria-hidden="true">
                                    {l.years && <span className="font-semibold text-foreground">{l.years}</span>}
                                    {l.rings.length > 0 && (
                                      <span className="inline-flex items-center gap-1 text-gold">
                                        <Trophy className="h-3 w-3" /> {l.rings.length} here
                                      </span>
                                    )}
                                    <span className="ml-auto font-mono tabular-nums">{Math.round(l.player.careerLegacy || 0).toLocaleString()} legacy</span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        {legends.length > LEGENDS_SHOWN && (
                          <button
                            type="button"
                            aria-expanded={showAll}
                            onClick={() => setTabState({ key: summary.key, tab: 'legends', all: !showAll })}
                            className="mt-3 w-full rounded-md border border-border py-2 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-line hover:text-foreground"
                          >
                            {showAll ? `Show top ${LEGENDS_SHOWN}` : `Show all ${legends.length}`}
                          </button>
                        )}
                      </>
                    )}
                  </section>
                )}

                {tab === 'roster' &&
                  (roster.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nobody from the league is on the {teamName} roster right now.</p>
                  ) : (
                    roster.map(({ position, players }) => (
                      <section key={position} aria-labelledby={`roster-${position}`}>
                        <h3 id={`roster-${position}`} className="section-title text-base mb-2">
                          {POSITION_LABELS[position]}
                          <span className="font-pixel text-[9px] text-muted-foreground">{players.length}</span>
                        </h3>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {players.map((p) => (
                            <li key={`${p.position}:${p.name}`} className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedPlayer(p)}
                                className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left hover:border-line"
                                aria-label={`${p.name}, ${p.position}, number ${numberFor(p)}: ${p.games} games, ${p.rings} ${p.rings === 1 ? 'ring' : 'rings'}, ${Math.round(p.careerLegacy || 0).toLocaleString()} Career Legacy. Open player`}
                              >
                                <ProPlayerBanner
                                  size="compact"
                                  name={p.name}
                                  position={p.position}
                                  team={t ?? summary.label}
                                  number={numberFor(p)}
                                  ovr={ovrFor(p)}
                                  hallOfFamer={isHof(p)}
                                  interactive
                                />
                                <span className="grid grid-cols-3 px-3 py-1.5 text-center text-xs" aria-hidden="true">
                                  <span><b className="font-mono tabular-nums">{p.games}</b> <span className="text-muted-foreground">GP</span></span>
                                  <span><b className="font-mono tabular-nums">{p.rings}</b> <span className="text-muted-foreground">{p.rings === 1 ? 'ring' : 'rings'}</span></span>
                                  <span><b className="font-mono tabular-nums">{Math.round(p.careerLegacy || 0).toLocaleString()}</b> <span className="text-muted-foreground">leg</span></span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))
                  ))}

                {tab === 'leaders' && (
                  <section aria-labelledby="franchise-leaders">
                    <h3 id="franchise-leaders" className="section-title text-base mb-1">
                      Franchise leaders
                    </h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Career totals of everyone who played for {teamName}. Single-season and per-team splits aren't tracked.
                    </p>
                    {leaders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No stats yet.</p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {leaders.map(({ stat, top }) => (
                          <li key={stat.key} className="min-w-0 rounded-lg border border-border bg-secondary/25 p-3">
                            <p className="font-pixel text-[8px] uppercase text-gold">{stat.label}</p>
                            <ol className="mt-1.5 space-y-1">
                              {top.map(({ player, value }, i) => (
                                <li key={`${player.position}:${player.name}`} className="flex min-w-0 items-baseline gap-2">
                                  <span className="w-3 shrink-0 font-pixel text-[8px] text-muted-foreground">{i + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPlayer(player)}
                                    className={cn(
                                      'min-w-0 flex-1 truncate text-left hover:text-gold',
                                      i === 0 ? 'font-display text-lg font-bold uppercase leading-tight' : 'text-sm',
                                    )}
                                  >
                                    {player.name}
                                    <span className="ml-1 text-xs font-normal normal-case text-muted-foreground">{player.position}</span>
                                  </button>
                                  <span
                                    className={cn('shrink-0 font-display font-extrabold tabular-nums', i === 0 ? 'text-xl' : 'text-sm text-muted-foreground')}
                                    style={i === 0 ? { color: accent } : undefined}
                                  >
                                    {value.toLocaleString()}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
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
