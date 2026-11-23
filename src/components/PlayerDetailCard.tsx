import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Activity, BarChart3, Gauge, Layers, LayoutDashboard, Milestone, Pencil, Radar, Trophy, Users } from 'lucide-react';
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
import { ADV_METRICS, awardPoints, buildContext, evaluateMetric } from '@/config/advanced';
import { leagueScore } from '@/config/ovr';
import { useSkillRatings } from '@/utils/useSkillRatings';
import { useJerseyNumbers } from '@/utils/jerseys';
import { useLeagueContent } from '@/utils/leagueContent';
import TeamBadge from './brand/TeamBadge';
import TeamLogo from './brand/TeamLogo';
import CountUp from './brand/CountUp';
import ProPlayerBanner from './brand/ProPlayerBanner';
import { overallRating } from './brand/ProPlayerBanner.utils';
import { useGamePool } from '@/utils/useOfficialOvr';
import PlayerEditDialog from './PlayerEditDialog';
import { getFamilyTies, normalizeName, signatureTeamOf, usePlayerExtras } from '@/utils/playerExtras';
import PositionGlyph from './player/PositionGlyph';
import StitchedJersey from './player/StitchedJersey';
import CareerArc from './player/CareerArc';
import AdvancedPanel from './player/AdvancedPanel';
import CompsPanel from './player/CompsPanel';
import CareerGraphsPreview from './stats/comps/graphs/CareerGraphsPreview';
import { FamilyChips, PlayerCardPanel, RealCareerPanel } from './player/ExtrasPanels';
import { buildCareerArc } from './player/arcData';
import { careerRates, careerTotals, headlineStats, type StatItem } from './player/statLines';
import { teamThemeVars } from './player/teamTheme';
import { bannerStats } from './hof/hofUtils';
import GameSprite from './GameSprite';
import TributeButton from './tribute/TributeButton';
import ShareImageButton from './share/ShareImageButton';
import PlayerSharePoster from './share/PlayerSharePoster';
import { shareFileName } from '@/utils/shareImage';
import { useLegendPhoto } from './player/useLegendPhoto';
import { useDeferredStage } from '@/hooks/useDeferredStage';
import './player/playerCard.css';
import PixelLoader from '@/components/ui/PixelLoader';
import { RetiredHangers, RetiredStrip } from './teams/RetiredBadge';

// The collectible art (card faces, kits, autograph canvas) loads only when the Card designs tab is opened
const CardDesignsPanel = lazy(() => import('./player/CardDesignsPanel'));

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
  { id: 'cards', label: 'Card designs', Icon: Layers },
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
  const { ovrMap: officialOvr, careerOvrMap, ovrBasis } = useGamePool();
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
  // Value / Game board at his position, so the card can show the rate beside the career totals
  const valueBoard = useMemo(() => {
    const metric = ADV_METRICS.find((m) => m.id === 'scorePerGame');
    return player && metric ? evaluateMetric(leaguePool, metric, player.position, buildContext(leaguePool)) : null;
  }, [leaguePool, player]);
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
  // team, where he was best known. A retired player's ID strip says what each club is when they differ: "Best known
  // with" (the signature team, shown big), "Retired with" (his last stop, from the game's Hall of Fame screen, the same
  // club the career arc ends on) and "Club of record" (the league sheet's team, which jersey numbers and the rafters use).
  const team = findNFLTeam(signatureTeamOf(extras, player));
  const latestTeam = findNFLTeam(player.team);
  // The private Retro Bowl sprite (this Mac only) gets its own stage in the header; real NFL legends never have one
  const retiredWith = findNFLTeam(typeof card?.retired_team === 'string' ? card.retired_team : undefined);
  const isRetired = player.status === 'Retired';
  const otherClubs = isRetired && team
    ? [
        retiredWith && retiredWith.id !== team.id ? { label: 'Retired with', club: retiredWith } : null,
        latestTeam && latestTeam.id !== team.id && latestTeam.id !== retiredWith?.id ? { label: 'Club of record', club: latestTeam } : null,
      ].filter((x): x is { label: string; club: NonNullable<typeof team> } => !!x)
    : [];
  const theme = teamThemeVars(team);
  const jerseyNumber = numberFor(player);
  const ovr = overallRating(player, officialOvr);
  // SZN (this season, active players) beside CAR (career); a retired player shows CAR only
  const car = careerOvrMap.get(`${player.position}:${player.name}`) ?? null;
  const seasonShown = ovrBasis.get(`${player.position}:${player.name}`) === 'season' && ovr != null;
  const score = leagueScore(player);
  const valueRow = valueBoard?.rows.find((r) => r.player.name === player.name) ?? null;
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
    { key: 'ovr', label: seasonShown ? 'SZN' : 'CAR', title: seasonShown ? 'Season OVR (62–99): this season ranked within the position among players who played it' : 'Career OVR (62–99), League Score rank within the position', value: ovr, decimals: 0 },
    ...(seasonShown && car != null ? [{ key: 'car', label: 'CAR', title: 'Career OVR (62–99): the whole career ranked within the position', value: car, decimals: 0 }] : []),
    ...(skill ? [{ key: 'skill', label: `Skill · ${skill.grade.grade}`, title: 'Skill rating: per-game skills graded against the position, ignores career length and awards', value: skill.rating, decimals: 0 }] : []),
    { key: 'score', label: 'League Score', title: 'Production + awards (the input to OVR)', value: score, decimals: 0 },
    ...(player.games > 0
      ? [
          {
            key: 'perGame',
            label: valueRow ? `Value/G · #${valueRow.rank} ${player.position}` : 'Value / Game',
            title: valueRow
              ? `League Score per game: ${valueRow.rank} of ${valueBoard?.rows.length} ${player.position}s (min 16 games), the rate beside the career totals`
              : 'League Score per game: the rate beside the career totals',
            value: score / player.games,
            decimals: 2,
          },
        ]
      : []),
    ...(rated ? [{ key: 'legacy', label: 'Career Legacy', title: '4·True Talent + 4·Dominance + 2·Games', value: player.careerLegacy, decimals: 0 }] : []),
    { key: 'rings', label: 'Rings', title: 'Championship rings', value: player.rings, decimals: 0 },
    { key: 'games', label: 'Games', title: 'Games played', value: player.games, decimals: 0 },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={scrollRef}
        phoneSheet
        swipeRight
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
            ovrLabel={seasonShown ? 'SZN' : 'CAR'}
            ovrAlt={seasonShown && car != null ? { label: 'CAR', value: car } : null}
            hallOfFamer={hof}
            // the hanging banner (RetiredHangers below) carries the retired number in the hero
            retiredBy={null}
            eyebrow={`${posName}${team ? ` · ${team.conference} ${team.division}` : ''}`}
            nameAs={DialogTitle}
            photoUrl={photo?.url}
            photoCredit={photo ? [photo.author, photo.license].filter(Boolean).join(' · ') || 'Wikimedia Commons' : null}
            photoHref={photo?.page}
            // leaves room for the Deep Dive and close buttons, which sit over the banner's top right
            topRight={<span className="w-20 shrink-0 sm:w-24" aria-hidden="true" />}
            figure={player.isRealLegend ? null : <GameSprite player={player} team={team?.name ?? player.team} kind="figure" size="l" showKit />}
            stats={player.isRealLegend ? undefined : bannerStats(player)}
            className="rounded-none [&_.ppb\_\_field]:rounded-none"
          />
          {/* His retired number hangs from the top edge, one banner per club that retired it (tap: their rafters) */}
          <RetiredHangers player={player} onLeave={onClose} className="pc-hangers" />
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
            {/* His Player Tribute, when one has been written (it opens over the card; closing it comes back here) */}
            {!player.isRealLegend && (
              <TributeButton
                playerKey={`${player.position}:${player.name}`}
                className="h-8 border border-gold/60 bg-black/55 px-2.5 text-sm text-gold hover:bg-black/70"
              />
            )}
            {/* A picture of the card for the share sheet: banner, sprite, OVR, key numbers, rings and awards */}
            <ShareImageButton
              look="overlay"
              className="h-8 min-h-0 max-sm:px-2 max-sm:[&>span]:sr-only"
              shareKey={`${player.position}:${player.name}:${ovr}:${player.games}:${player.rings}:${team?.id ?? ''}:${jerseyNumber ?? ''}`}
              fileName={shareFileName(player.name)}
              title={`${player.name} · Retro Vault`}
              poster={() => (
                <PlayerSharePoster player={player} team={team} number={jerseyNumber} ovr={ovr} hallOfFamer={hof} retiredBy={retired?.teamLabel ?? null} />
              )}
            />
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

          {/* ID tiles under one steel truss (owner, 2026-11-17: the position, number and club "fit this enlarged space", the
              retired banners on the same line): position, number, club and, for a retired number, its rafters slice */}
          <div className={cn('pc-ids', retired && 'pc-ids--retired')}>
            <span className="pc-ids__truss" aria-hidden="true" />
            <div className="pc-tile">
              <span className="pc-tile__icon pc-tile__icon--pos">
                <PositionGlyph position={player.position} />
              </span>
              <span className="pc-tile__k">Position</span>
              <span className="pc-tile__v">{posName}</span>
            </div>
            <div className="pc-tile">
              <StitchedJersey number={jerseyNumber} primary={theme.p} secondary={theme.s} retired={!!retired} className="pc-tile__jersey" />
              <span className="pc-tile__k">Number</span>
              <span className="pc-tile__v pc-tile__v--num">#{jerseyNumber}</span>
            </div>
            <div className="pc-tile pc-tile--club">
              {team ? (
                <>
                  <span className="pc-logo-puck pc-tile__puck">
                    <TeamLogo team={team} size={40} decorative />
                  </span>
                  <span className="pc-tile__k">{otherClubs.length > 0 ? 'Best known with' : 'Club'}</span>
                  <span className="pc-tile__v">{team.fullName}</span>
                  <span className="pc-tile__sub">
                    {team.conference} {team.division}
                  </span>
                  {otherClubs.map((o) => (
                    <span key={o.label} className="pc-tile__sub">
                      {o.label}: {o.club.name}
                    </span>
                  ))}
                </>
              ) : player.team ? (
                <TeamBadge team={player.team} size="sm" />
              ) : (
                <span className="pc-tile__v">No team</span>
              )}
            </div>
            <RetiredStrip player={player} onLeave={onClose} className="pc-ids__retired" />
            {formerName && <p className="pc-ids__former">Formerly known as {formerName}</p>}
          </div>
        </header>

        <TabsPrimitive.Root value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <div className="pc-tabs">
            <TabsPrimitive.List className="pc-tablist" aria-label={`${player.name} sections`}>
              {TABS.filter(({ id }) => id !== 'cards' || !player.isRealLegend).map(({ id, label, Icon }) => (
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
            <AdvancedPanel player={player} players={leaguePool} onSelect={setJumpTo} />
            <CareerGraphsPreview player={player} onNavigate={onClose} />
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

          {/* ---------- Card designs (league players only: real NFL legends are not collectible) ---------- */}
          {!player.isRealLegend && (
            <TabsPrimitive.Content value="cards" className="rv-view-in p-4 focus-visible:outline-none sm:p-6">
              <section aria-labelledby={`${headingId}-cards`}>
                <SectionTitle icon={Layers} id={`${headingId}-cards`}>
                  Card designs
                </SectionTitle>
                <Suspense fallback={<PixelLoader size="sm" label="Cards" what="cards" minHeight={220} />}>
                  <CardDesignsPanel player={player} />
                </Suspense>
              </section>
            </TabsPrimitive.Content>
          )}
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
