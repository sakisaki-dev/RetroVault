import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Activity, BarChart3, Gauge, LayoutDashboard, Milestone, Pencil, Radar, Trophy, Users } from 'lucide-react';
import { openInCompFinder } from './stats/comps/compFinderLink';
import type { Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { useLeague } from '@/context/LeagueContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { findNFLTeam } from '@/utils/nflTeams';
import { formatDecimal, getMetricTier, getTierBgColor, getTierColor, getTierLabel } from '@/utils/metricColors';
import { AWARD_META, POSITION_NAMES } from '@/utils/playerMeta';
import { AWARD_POINTS, getLegacyTier, isDefensivePosition, isHallOfFamer } from '@/config/stats';
import { awardPoints } from '@/config/advanced';
import { leagueScore } from '@/config/ovr';
import { useSkillRatings } from '@/utils/useSkillRatings';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useLeagueContent } from '@/utils/leagueContent';
import TeamBadge from './brand/TeamBadge';
import TeamLogo from './brand/TeamLogo';
import CountUp from './brand/CountUp';
import ProPlayerBanner from './brand/ProPlayerBanner';
import { overallRating } from './brand/ProPlayerBanner.utils';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import PlayerEditDialog from './PlayerEditDialog';
import { getFamilyTies, normalizeName, signatureTeamOf, usePlayerExtras } from '@/utils/playerExtras';
import PositionGlyph from './player/PositionGlyph';
import StitchedJersey from './player/StitchedJersey';
import CareerArc from './player/CareerArc';
import AdvancedPanel from './player/AdvancedPanel';
import CompsPanel from './player/CompsPanel';
import { FamilyChips, PlayerCardPanel, RealCareerPanel } from './player/ExtrasPanels';
import { buildCareerArc } from './player/arcData';
import { careerRates, careerTotals, headlineStats, type StatItem } from './player/statLines';
import { teamThemeVars } from './player/teamTheme';
import { useLegendPhoto } from './player/useLegendPhoto';
import { useDeferredStage } from '@/hooks/useDeferredStage';
import './player/playerCard.css';

interface PlayerDetailCardProps {
  player: Player | null;
  onClose: () => void;
}

const fmt = (v: number | null, decimals = 0) => (v == null || !Number.isFinite(v) ? '—' : formatDecimal(v, decimals));

/** Columns that split `n` tiles into even rows (6 → 3+3, 7 → 4+3) with at most `max` per row. */
const balancedCols = (n: number, max: number) => (n <= max ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / max)));
const gridVars = (n: number, max = 5, maxSm = 3) => ({ '--cols': balancedCols(n, max), '--cols-sm': balancedCols(n, maxSm) }) as CSSProperties;

const StatGrid = ({ items, label }: { items: StatItem[]; label: string }) => (
  <dl className="pc-statgrid pc-enter" style={gridVars(items.length)} aria-label={label}>
    {items.map((s) => (
      <div key={s.key} className="flex flex-col-reverse px-2 py-2.5 text-center" title={s.title}>
        <dt className="mt-1 font-pixel text-[9px] uppercase text-muted-foreground">
          <span aria-hidden="true">{s.label}</span>
          <span className="sr-only">{s.title}</span>
        </dt>
        <dd className="font-display text-2xl font-bold leading-none tabular-nums text-chalk">
          {s.value == null ? '—' : <CountUp value={s.value} decimals={s.decimals ?? 0} duration={600} />}
          {s.value != null && s.suffix}
        </dd>
      </div>
    ))}
  </dl>
);

const SectionTitle = ({ icon: Icon, children, id }: { icon: typeof Trophy; children: string; id: string }) => (
  <h3 id={id} className="pc-title">
    <Icon className="h-4 w-4" aria-hidden="true" />
    {children}
  </h3>
);

const TABS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'stats', label: 'Career stats', Icon: BarChart3 },
  { id: 'advanced', label: 'Advanced', Icon: Gauge },
  { id: 'awards', label: 'Awards', Icon: Trophy },
  { id: 'comps', label: 'Comps', Icon: Users },
] as const;
type TabId = (typeof TABS)[number]['id'];

/*
 * Shell-first open. The tap's task renders the frame, the banner, the tabs and the headline numbers; the career arc
 * and the extras (the heaviest part: a popover per ring, a logo per stop) mount right after the first frame, into a
 * placeholder that holds their space. The placeholder never makes anything move: either it starts below the fold
 * (phones: always), or the arc is sure to fill what is visible of it, or its exact height is known from an earlier
 * open of this player at this width. Otherwise everything renders at once, as before.
 */
const reserved = new Map<string, number>();
/** Height the arc is sure to take (px): a stop, ring or honour card plus the key line; the key line alone when bare */
const arcFloor = (arc: { stints: unknown[]; legend: boolean; hallOfFame: unknown; retired: unknown; undatedRings: number }) =>
  arc.stints.length || arc.legend || arc.hallOfFame || arc.retired || arc.undatedRings ? ARC_FLOOR : 16;
const ARC_FLOOR = 110;

const RATING_CHIPS = [
  { key: 'trueTalent', label: 'True Talent' },
  { key: 'dominance', label: 'Dominance' },
  { key: 'careerLegacy', label: 'Legacy' },
  { key: 'tpg', label: 'TPG' },
] as const;

/** Immersive, team-themed player page: broadcast banner, tabs for every stat, advanced metrics, career arc and comps. */
const PlayerDetailCard = ({ player: selectedProp, onClose }: PlayerDetailCardProps) => {
  const { getAllPlayers, legends } = useLeague();
  const officialOvr = useOfficialOvr();
  const skillMap = useSkillRatings();
  const extras = usePlayerExtras();
  const { content } = useLeagueContent();
  const { numberFor, retiredInfo } = useJerseyNumbers();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Following a family-tie chip or a comp swaps the shown player without closing the dialog
  const [jumpTo, setJumpTo] = useState<Player | null>(null);
  // A new player from outside clears the jump during render (an effect would render the old one first, then again)
  const [lastProp, setLastProp] = useState(selectedProp);
  // The last player shown stays rendered after the caller clears its prop, so the dialog plays its close animation
  // (instead of vanishing); it is let go when that exit ends (onAnimationEnd below)
  const [held, setHeld] = useState(selectedProp);
  if (selectedProp !== lastProp) {
    setLastProp(selectedProp);
    if (selectedProp) {
      if (jumpTo) setJumpTo(null);
      setHeld(selectedProp);
    }
  }
  const open = !!selectedProp;
  const shownProp = selectedProp ?? held;
  const selected = shownProp ? jumpTo ?? shownProp : null;
  const { stage, late, finish } = useDeferredStage(!!selectedProp);

  // Re-resolve from the league so the page reflects edits; keep a caller-provided team (e.g. local overrides).
  const player = useMemo(() => {
    if (!selected) return null;
    if (selected.isRealLegend) return selected;
    const live = getAllPlayers().find((p) => p.position === selected.position && p.name === selected.name);
    return live ? ({ ...live, team: live.team || selected.team } as Player) : selected;
  }, [selected, getAllPlayers]);

  const leaguePool = useMemo(() => getAllPlayers().filter((p) => !p.isRealLegend), [getAllPlayers]);
  const photo = useLegendPhoto(player);

  // Where focus was when the card opened (the tapped card). iOS Safari doesn't focus buttons on tap, so Radix's
  // default "return focus" lands on <body> and jumps the page to the top; we restore it ourselves without scrolling.
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (selectedProp) {
      const el = document.activeElement;
      returnFocus.current = el instanceof HTMLElement && el !== document.body ? el : null;
    }
  }, [selectedProp]);

  // New player: back to the overview (during render, so a reopened card never renders the last tab it showed first),
  // scrolled to the top
  const playerId = player ? `${player.position}:${player.name}` : '';
  const [tabFor, setTabFor] = useState(playerId);
  if (playerId !== tabFor) {
    setTabFor(playerId);
    if (tab !== 'overview') setTab('overview');
  }
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [playerId]);

  const nameKey = player ? normalizeName(player.name) : '';
  const card = extras.cards[nameKey];
  const careerStints = extras.stints[nameKey];
  const retired = player ? retiredInfo(player) : undefined;
  const hofTier = player ? getLegacyTier(player.careerLegacy) : null;

  const arc = useMemo(
    () => (player ? buildCareerArc({ player, content, card, retired, hofTier: hofTier?.label ?? null, stints: careerStints }) : null),
    [player, content, card, retired, hofTier, careerStints],
  );

  const reserveKey = `${playerId}|${typeof window === 'undefined' ? 0 : window.innerWidth}`;
  const showRest = stage >= 1 || tab !== 'overview';
  // Both checks run as the element attaches (in the commit, before the paint), measured in layout pixels: the dialog
  // is mid open animation (scaled), so screen distances are divided back by its scale.
  const layoutGap = (box: HTMLElement, from: number, to: number) => ((to - from) * box.offsetHeight) / (box.getBoundingClientRect().height || 1);
  // The placeholder stays only where its size can't move anything (see `reserved`); otherwise everything renders now
  const placeholderRef = (el: HTMLDivElement | null) => {
    const box = el?.closest<HTMLElement>('[role="dialog"]');
    if (!el || !box || !arc || reserved.get(reserveKey) != null) return;
    const visible = box.clientHeight - layoutGap(box, box.getBoundingClientRect().top, el.getBoundingClientRect().top);
    if (visible > arcFloor(arc)) finish();
  };
  // Once filled: remember the exact height the arc and extras took (to the panel's padding), for the next open
  const filledRef = (el: HTMLDivElement | null) => {
    const panel = el?.closest<HTMLElement>('[role="tabpanel"]');
    const box = el?.closest<HTMLElement>('[role="dialog"]');
    if (!el || !panel || !box) return;
    const pad = parseFloat(getComputedStyle(panel).paddingBottom) || 0;
    reserved.set(reserveKey, Math.max(0, Math.round(layoutGap(box, el.getBoundingClientRect().top, panel.getBoundingClientRect().bottom) - pad)));
  };

  const findByName = (name: string) => {
    const key = normalizeName(name);
    return [...getAllPlayers(), ...legends].find((p) => normalizeName(p.name) === key) ?? null;
  };

  if (!player || !arc) return null;

  const realCareer = extras.realNflCareer[nameKey];
  const formerName = extras.formerNames[nameKey];
  const familyTies = getFamilyTies(extras, player.name);

  // Banner identity (colours, logo, jersey): an active player wears his current team; a retired one his signature
  // team, where he was best known. For a retired player the latest club is still named in the ID strip when it differs.
  const team = findNFLTeam(signatureTeamOf(extras, player));
  const latestTeam = findNFLTeam(player.team);
  const theme = teamThemeVars(team);
  const jerseyNumber = numberFor(player);
  const ovr = overallRating(player, officialOvr);
  const score = leagueScore(player);
  const skill = skillMap.get(`${player.position}:${player.name}`) ?? null;
  const isDefense = isDefensivePosition(player.position);
  const hof = isHallOfFamer(player);
  const rated = player.trueTalent > 0;
  const awards = AWARD_META[isDefense ? 'defense' : 'offense'];
  const headingId = `pdc-${player.position}-${player.name.replace(/\W+/g, '-')}`;
  const posName = POSITION_NAMES[player.position];
  const headline = headlineStats(player);
  const totals = careerTotals(player);
  const rates = careerRates(player);
  const points = awardPoints(player);

  const scoreboard = [
    { key: 'ovr', label: 'OVR', title: 'Official overall rating (62–99), League Score rank within the position', value: ovr, decimals: 0 },
    ...(skill ? [{ key: 'skill', label: `Skill · ${skill.grade.grade}`, title: 'Skill rating: per-game skills graded against the position, ignores career length and awards', value: skill.rating, decimals: 0 }] : []),
    { key: 'score', label: 'League Score', title: 'Production + awards (the input to OVR)', value: score, decimals: 0 },
    ...(rated ? [{ key: 'legacy', label: 'Career Legacy', title: '4·True Talent + 4·Dominance + 2·Games', value: player.careerLegacy, decimals: 0 }] : []),
    { key: 'rings', label: 'Rings', title: 'Championship rings', value: player.rings, decimals: 0 },
    { key: 'games', label: 'Games', title: 'Games played', value: player.games, decimals: 0 },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={scrollRef}
        onAnimationEnd={(e) => {
          // The exit is over: drop the held player (Radix unmounts the content on the same event)
          if (!open && e.target === e.currentTarget) {
            setHeld(null);
            setJumpTo(null);
          }
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          const el = returnFocus.current;
          if (el?.isConnected) el.focus({ preventScroll: true });
        }}
        className={cn(
          'pc-root grid-cols-[minmax(0,1fr)] w-[calc(100vw-1rem)] max-w-4xl max-h-[calc(var(--safe-h)-1rem)] overflow-y-auto overflow-x-hidden gap-0 border-line p-0',
          hof && 'pc-root--hof',
          // The close button stays readable on any team color
          '[&_.dlg-x]:border-white/20 [&_.dlg-x]:bg-black/55 [&_.dlg-x]:text-white',
        )}
        style={{
          ...theme.vars,
          background: `radial-gradient(90% 420px at 100% 0%, hsl(${theme.s} / 0.14), transparent 70%), linear-gradient(180deg, hsl(${theme.p} / 0.34) 0px, hsl(${theme.p} / 0.12) 520px, transparent 900px), hsl(var(--card))`,
        }}
      >
        {team && (
          <span className="pc-watermark" aria-hidden="true">
            <TeamLogo team={team} size={440} decorative />
          </span>
        )}

        {/* Broadcast banner */}
        <header className="relative">
          <ProPlayerBanner
            size="hero"
            name={player.name}
            position={player.position}
            team={team ?? player.team}
            number={jerseyNumber}
            ovr={ovr}
            hallOfFamer={hof}
            retiredBy={retired?.teamLabel ?? null}
            eyebrow={`${posName}${team ? ` · ${team.conference} ${team.division}` : ''}`}
            nameAs={DialogTitle}
            photoUrl={photo?.url}
            photoCredit={photo ? [photo.author, photo.license].filter(Boolean).join(' · ') || 'Wikimedia Commons' : null}
            photoHref={photo?.page}
            topRight={<span className="w-20 shrink-0 sm:w-24" aria-hidden="true" />}
            className="rounded-none [&_.ppb\_\_field]:rounded-none"
          />
          <DialogDescription className="sr-only">
            Career profile for {player.name}
            {player.nickname ? `, known as ${player.nickname}` : ''}: overview, career stats, advanced metrics, awards and similar careers.
            {retired ? ` Number ${retired.number} retired by the ${retired.teamLabel}.` : ''}
          </DialogDescription>

          <div className="absolute right-14 top-3 z-10 flex gap-1.5">
            {/* Every league player's card links to his Deep Dive (real NFL players have none) */}
            {!player.isRealLegend && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  openInCompFinder(player);
                }}
                className="h-8 gap-1.5 bg-gold px-2.5 font-display font-bold uppercase text-black hover:bg-gold/90"
              >
                <Radar className="h-3.5 w-3.5" aria-hidden="true" />
                Deep Dive
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setIsEditOpen(true)}
              className="h-8 gap-1.5 border border-black/20 bg-black/55 px-2.5 text-white hover:bg-black/70"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Edit</span>
              <span className="sr-only sm:hidden">Edit player</span>
            </Button>
          </div>

          {player.nickname && (
            <p className="pc-lowerthird">
              <span className="pc-lowerthird__tag">A.K.A.</span>
              <span className="pc-lowerthird__stripe" aria-hidden="true" />
              <span className="pc-lowerthird__text">&ldquo;{player.nickname}&rdquo;</span>
            </p>
          )}

          {/* ID strip: position glyph, stitched jersey, franchise */}
          <div className="pc-idstrip flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-chalk">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-[color:var(--tc-accent)] ring-1 ring-[color:var(--tc-accent)]/40">
                <PositionGlyph position={player.position} />
              </span>
              {posName}
            </span>
            <span className="inline-flex items-center gap-2">
              <StitchedJersey number={jerseyNumber} primary={theme.p} secondary={theme.s} retired={!!retired} className="h-11" />
              <span className="leading-tight">
                <span className="block font-pixel text-[9px] uppercase text-muted-foreground">Number</span>
                <span className="font-display text-lg font-bold text-chalk">#{jerseyNumber}</span>
                {retired && <span className="ml-1.5 text-[11px] font-bold uppercase tracking-wide text-gold">Retired</span>}
              </span>
            </span>
            {team ? (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-chalk">
                <span className="pc-logo-puck">
                  <TeamLogo team={team} size={26} decorative />
                </span>
                <span className="leading-tight">
                  {team.fullName}
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {team.conference} {team.division}
                  </span>
                  {player.status === 'Retired' && latestTeam && latestTeam.id !== team.id && (
                    <span className="block text-[11px] font-normal text-muted-foreground">Latest club: {latestTeam.name}</span>
                  )}
                </span>
              </span>
            ) : player.team ? (
              <TeamBadge team={player.team} size="sm" />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">No team</span>
            )}
            {formerName && <span className="text-xs text-muted-foreground">Formerly known as {formerName}</span>}
          </div>
        </header>

        <TabsPrimitive.Root value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <div className="pc-tabs">
            <TabsPrimitive.List className="pc-tablist" aria-label={`${player.name} sections`}>
              {TABS.map(({ id, label, Icon }) => (
                <TabsPrimitive.Trigger key={id} value={id} className="pc-tab">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>
          </div>

          {/* ---------- Overview ---------- */}
          <TabsPrimitive.Content value="overview" className="rv-view-in space-y-6 p-4 focus-visible:outline-none sm:p-6">
            <section aria-labelledby={`${headingId}-board`}>
              <h3 id={`${headingId}-board`} className="sr-only">
                Headline numbers
              </h3>
              <dl
                className="grid grid-cols-2 gap-2 sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
                style={{ '--n': scoreboard.length } as CSSProperties}
              >
                {scoreboard.map((s, i) => (
                  <div
                    key={s.key}
                    className={cn(
                      'pc-score pc-enter flex flex-col-reverse items-center px-2 py-3 text-center',
                      // Phones: OVR gets its own row; an odd tile left over at the end spans the row too
                      i === 0 && 'col-span-2 sm:col-span-1',
                      scoreboard.length % 2 === 0 && i === scoreboard.length - 1 && 'col-span-2 sm:col-span-1',
                    )}
                    style={{ '--i': i } as CSSProperties}
                    title={s.title}
                  >
                    <dt className="mt-1.5 font-pixel text-[9px] uppercase text-muted-foreground">{s.label}</dt>
                    <dd className={cn('font-display font-bold leading-none tabular-nums', i === 0 ? 'text-5xl text-[color:var(--tc-accent)]' : 'text-3xl text-chalk')}>
                      {s.value == null ? '—' : <CountUp value={s.value} decimals={s.decimals} />}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby={`${headingId}-headline`}>
              <SectionTitle icon={Activity} id={`${headingId}-headline`}>
                Career at a glance
              </SectionTitle>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {headline.map((s, i) => (
                  <div key={s.key} className="pc-tile pc-enter flex flex-col-reverse p-3" style={{ '--i': i + 3 } as CSSProperties} title={s.title}>
                    <dt className="mt-1 text-xs text-muted-foreground">{s.label}</dt>
                    <dd className="font-display text-3xl font-bold leading-none tabular-nums text-chalk">
                      {s.value == null ? '—' : <CountUp value={s.value} decimals={s.decimals ?? 0} />}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Rating tiers">
                {rated &&
                  RATING_CHIPS.map((c) => {
                    const tier = getMetricTier(player[c.key] ?? 0, c.key);
                    return (
                      <li
                        key={c.key}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                        style={{ borderColor: getTierBgColor(tier, 0.6), background: getTierBgColor(tier, 0.12) }}
                      >
                        <span className="text-muted-foreground">{c.label}</span>
                        <b className="uppercase tracking-wide" style={{ color: getTierColor(tier) }}>
                          {getTierLabel(tier, c.key)}
                        </b>
                      </li>
                    );
                  })}
                {hofTier && (
                  <li className="pc-gold-chip">
                    <Trophy className="h-3 w-3" aria-hidden="true" />
                    Hall of Fame · {hofTier.label}
                  </li>
                )}
                {!rated && (
                  <li className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted-foreground">
                    Imported legend · real NFL stats
                  </li>
                )}
              </ul>
            </section>

            <section aria-labelledby={`${headingId}-arc`}>
              <SectionTitle icon={Milestone} id={`${headingId}-arc`}>
                Career arc
              </SectionTitle>
              {showRest ? (
                <div ref={filledRef} className={cn(late && 'pc-fill')}>
                  <CareerArc arc={arc} headingId={`${headingId}-arc`} />
                </div>
              ) : (
                // Holds the arc's and the extras' space until they mount (a frame after the card opens)
                <div ref={placeholderRef} className="pc-defer" style={{ minHeight: reserved.get(reserveKey) ?? 480 }} aria-busy="true" />
              )}
            </section>

            {showRest && (realCareer || card || familyTies.length > 0) && (
              <section className={cn('space-y-2', late && 'pc-fill')} aria-label="More about this player">
                {realCareer && <RealCareerPanel career={realCareer} />}
                {card && <PlayerCardPanel card={card} />}
                {familyTies.length > 0 && <FamilyChips ties={familyTies} findByName={findByName} onSelect={setJumpTo} />}
              </section>
            )}
          </TabsPrimitive.Content>

          {/* ---------- Career stats ---------- */}
          <TabsPrimitive.Content value="stats" className="rv-view-in space-y-6 p-4 focus-visible:outline-none sm:p-6">
            <section aria-labelledby={`${headingId}-career`}>
              <SectionTitle icon={BarChart3} id={`${headingId}-career`}>
                Career totals
              </SectionTitle>
              <StatGrid items={totals} label="Career totals" />
            </section>
            {rates.length > 0 && (
              <section aria-labelledby={`${headingId}-rates`}>
                <SectionTitle icon={Activity} id={`${headingId}-rates`}>
                  Rates &amp; per game
                </SectionTitle>
                <StatGrid items={rates} label="Per-game and efficiency rates" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Computed from career totals. "/16G" is per 16 games played; a dash means there is nothing to divide by.
                </p>
              </section>
            )}
          </TabsPrimitive.Content>

          {/* ---------- Advanced ---------- */}
          <TabsPrimitive.Content value="advanced" className="rv-view-in p-4 focus-visible:outline-none sm:p-6">
            <h3 className="sr-only">Advanced metrics</h3>
            <AdvancedPanel player={player} players={leaguePool} />
          </TabsPrimitive.Content>

          {/* ---------- Awards ---------- */}
          <TabsPrimitive.Content value="awards" className="rv-view-in space-y-5 p-4 focus-visible:outline-none sm:p-6">
            <section aria-labelledby={`${headingId}-awards`}>
              <SectionTitle icon={Trophy} id={`${headingId}-awards`}>
                Trophy case
              </SectionTitle>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {awards.map(({ key, label, long, Icon, hsl }, i) => {
                  const n = player[key] ?? 0;
                  const has = n > 0;
                  return (
                    <li
                      key={key}
                      className={cn('pc-tile pc-enter flex flex-col items-center px-2 py-3 text-center', !has && 'opacity-55', i === 0 && 'col-span-2 sm:col-span-1')}
                      style={{
                        '--i': i,
                        boxShadow: has ? `inset 0 2px 0 hsl(${hsl}), inset 0 0 24px hsl(${hsl} / 0.14)` : undefined,
                      } as CSSProperties}
                      title={long}
                    >
                      <Icon className="h-6 w-6" style={{ color: has ? `hsl(${hsl})` : undefined }} aria-hidden="true" />
                      <span className="mt-1.5 font-display text-3xl font-bold leading-none tabular-nums">
                        <CountUp value={n} />
                      </span>
                      <span className="mt-1 text-xs font-semibold leading-tight text-chalk">{long}</span>
                      <span className="font-pixel text-[8px] uppercase text-muted-foreground" aria-hidden="true">
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Award points in Dominance: <b className="font-mono text-chalk">{fmt(points)}</b> (ring {AWARD_POINTS.ring}, MVP {AWARD_POINTS.mvp},{' '}
                {isDefense ? `DPOY ${AWARD_POINTS.dpoy}` : `OPOY ${AWARD_POINTS.opoy}`}, SB MVP {AWARD_POINTS.sbmvp}).
              </p>
            </section>
            {(hofTier || retired) && (
              <section aria-labelledby={`${headingId}-honors`}>
                <SectionTitle icon={Milestone} id={`${headingId}-honors`}>
                  Honors
                </SectionTitle>
                <ul className="flex flex-wrap gap-2">
                  {hofTier && (
                    <li className="pc-honor">
                      <Trophy className="h-8 w-8" aria-hidden="true" />
                      <span>
                        <span className="block font-display text-lg font-bold uppercase">Hall of Fame</span>
                        <span className="font-pixel text-[9px] uppercase">{hofTier.label} tier</span>
                      </span>
                    </li>
                  )}
                  {retired && (
                    <li className="pc-honor">
                      <StitchedJersey number={retired.number} primary={theme.p} secondary={theme.s} retired className="h-12" />
                      <span>
                        <span className="block font-display text-lg font-bold uppercase">#{retired.number} retired</span>
                        <span className="text-xs text-muted-foreground">By the {retired.teamLabel}</span>
                      </span>
                    </li>
                  )}
                </ul>
              </section>
            )}
          </TabsPrimitive.Content>

          {/* ---------- Comps ---------- */}
          <TabsPrimitive.Content value="comps" className="rv-view-in p-4 focus-visible:outline-none sm:p-6">
            <section aria-labelledby={`${headingId}-comps`}>
              <SectionTitle icon={Users} id={`${headingId}-comps`}>
                Similar careers
              </SectionTitle>
              <CompsPanel player={player} players={leaguePool} numberFor={numberFor} onSelect={setJumpTo} onNavigate={onClose} />
            </section>
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </DialogContent>

      <PlayerEditDialog
        player={isEditOpen ? player : null}
        onClose={() => setIsEditOpen(false)}
        // PlayerEditDialog refreshes league data itself
        onSave={() => setIsEditOpen(false)}
        onDelete={() => {
          setIsEditOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
};

export default PlayerDetailCard;
