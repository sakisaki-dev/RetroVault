import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChartScatter, Gauge, Medal, Milestone, Users } from 'lucide-react';
import type { LeagueData, Player, Position } from '@/types/player';
import {
  POSITIONS,
  SIM_MIN_GAMES,
  buildContext,
  evaluatePosition,
  hasSimilarityData,
  leaguePlayers,
  similarPlayers,
  type AdvContext,
  type SimilarityMode,
} from '@/config/advanced';
import { playerSkillGrades } from '@/config/skillGrades';
import { useGamePool } from '@/utils/useOfficialOvr';
import { cn } from '@/lib/utils';
import Chips from '../analytics/Chips';
import { usePrefersReducedMotion } from '../analytics/viz';
import { buildRecordBook, keyOf } from '../records';
import CompMap from './CompMap';
import DdAdvanced from './DdAdvanced';
import DdCareer, { type PosStat } from './DdCareer';
import DdEmpty from './DdEmpty';
import DdHero from './DdHero';
import DdRecords from './DdRecords';
import DdSkills from './DdSkills';
import DdWhoPlays from './DdWhoPlays';
import DdRealComps from './DdRealComps';
import { DdSection } from './ddParts';
import { MIN_RADAR_AXES, buildPositionModel, buildSimilarityMap, type PositionModel, type SimilarityMap } from './compModel';
import { onCompFinderRequest, openInHeadToHead, takeCompFinderRequest } from './compFinderLink';
import './deepDive.css';

type Select = (p: Player) => void;

export interface PlayerDeepDiveProps {
  /** League data (the Stats tab's careerData). Real legends are never included. */
  data?: LeagueData | null;
  /** Or the league players directly (used when `data` is not given). */
  players?: Player[];
  /** Open the full player card (dialog). */
  onSelect: Select;
  /** Player key "POS:Name" to show first (e.g. from the #stats/deepdive?p= hash). A pending openInCompFinder request wins. */
  initialPlayerKey?: string;
  /** Called with the key whenever the user picks a different player (keep the hash in sync). */
  onPlayerChange?: (key: string) => void;
  /** Head-to-Head hand-off; defaults to openInHeadToHead (event 'retrovault:open-head-to-head'). */
  onCompare?: (a: Player, b: Player) => void;
}

const SECTIONS = [
  { id: 'dd-ratings', label: 'Skill ratings', short: 'Ratings', icon: Gauge },
  { id: 'dd-who', label: 'Who plays like him', short: 'Comps', icon: Users },
  { id: 'dd-map', label: 'Neighbourhood', short: 'Map', icon: ChartScatter },
  { id: 'dd-advanced', label: 'Advanced profile', short: 'Advanced', icon: Activity },
  { id: 'dd-career', label: 'Career & legacy', short: 'Career', icon: Milestone },
  { id: 'dd-records', label: 'Records & awards', short: 'Records', icon: Medal },
] as const;

const useMedia = (query: string) => {
  const [on, setOn] = useState(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return on;
};

// Per-league caches (weakly keyed, so a new league drops them): all-pairs maps per model + mode, metric boards per context + position.
const MAP_CACHE = new WeakMap<PositionModel, Map<SimilarityMode, SimilarityMap>>();
const cachedMap = (model: PositionModel, mode: SimilarityMode) => {
  let byMode = MAP_CACHE.get(model);
  if (!byMode) MAP_CACHE.set(model, (byMode = new Map()));
  let m = byMode.get(mode);
  if (!m) byMode.set(mode, (m = buildSimilarityMap(model, mode)));
  return m;
};
const BOARD_CACHE = new WeakMap<AdvContext, Map<Position, ReturnType<typeof evaluatePosition>>>();
const cachedBoards = (players: Player[], position: Position, ctx: AdvContext) => {
  let byPos = BOARD_CACHE.get(ctx);
  if (!byPos) BOARD_CACHE.set(ctx, (byPos = new Map()));
  let b = byPos.get(position);
  if (!b) byPos.set(position, (b = evaluatePosition(players, position, ctx)));
  return b;
};

/** Mid-rank percentile of `v` in `vals` (0–100). */
const pctIn = (vals: number[], v: number) => {
  if (!vals.length || !Number.isFinite(v)) return null;
  let below = 0;
  let eq = 0;
  vals.forEach((x) => {
    if (x < v) below++;
    else if (x === v) eq++;
  });
  return (100 * (below + eq / 2)) / vals.length;
};

/**
 * Player Deep Dive: a one-player scouting report. Hero banner and navigation, skill grades (config/skillGrades),
 * the style hexagon, every advanced metric, his neighbourhood on the per-position similarity map, comps, the career
 * arc and legacy, and records / awards / collection. Heavy work (position models, all-pairs maps, metric boards,
 * record book) is memoised per league / position, never per render.
 */
const PlayerDeepDive = ({ data, players: playersProp, onSelect, initialPlayerKey, onPlayerChange, onCompare }: PlayerDeepDiveProps) => {
  const players = useMemo(() => (data ? leaguePlayers(data) : (playersProp ?? []).filter((p) => !p.isRealLegend)), [data, playersProp]);
  const { ovrMap, legends } = useGamePool();
  const wide = useMedia('(min-width: 768px)');
  const reduced = usePrefersReducedMotion();
  const sorted = useMemo(() => [...players].sort((a, b) => b.careerLegacy - a.careerLegacy), [players]);
  const byKey = useMemo(() => new Map(players.map((p) => [keyOf(p), p])), [players]);

  // ---------- Selection ----------
  const [selKey, setSelKey] = useState(() => {
    const pending = takeCompFinderRequest();
    return pending ?? initialPlayerKey ?? '';
  });
  // No default player: without a key (link, request or pick) the page shows the search-first empty state.
  const player = byKey.get(selKey);
  const topRef = useRef<HTMLDivElement | null>(null);

  const choose = useCallback(
    (key: string, opts: { scroll?: boolean } = {}) => {
      if (!byKey.has(key)) return;
      setSelKey(key);
      onPlayerChange?.(key);
      if (opts.scroll !== false) {
        window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
      }
    },
    [byKey, onPlayerChange, reduced],
  );

  useEffect(() => {
    if (initialPlayerKey && byKey.has(initialPlayerKey)) setSelKey(initialPlayerKey);
  }, [initialPlayerKey, byKey]);

  // Open requests from elsewhere (player card, hub search, Map page) while mounted.
  useEffect(
    () =>
      onCompFinderRequest(() => {
        const key = takeCompFinderRequest();
        if (key) choose(key);
      }),
    [choose],
  );

  // ---------- Memoised league / position computations ----------
  const models = useMemo(() => new Map(POSITIONS.map((pos) => [pos, buildPositionModel(players, pos)] as const)), [players]);
  const ctx = useMemo(() => buildContext(players), [players]);
  const book = useMemo(() => buildRecordBook(data ?? null), [data]);
  const posValues = useMemo(() => {
    const m = new Map<Position, { dom: number[]; tt: number[]; tpg: number[] }>();
    POSITIONS.forEach((pos) => {
      const at = players.filter((p) => p.position === pos && p.games > 0);
      m.set(pos, { dom: at.map((p) => p.dominance), tt: at.map((p) => p.trueTalent), tpg: at.map((p) => p.tpg) });
    });
    return m;
  }, [players]);

  // Similarity mode shared by the comp list and the neighbourhood map.
  const [mapMode, setMapMode] = useState<SimilarityMode>('style');

  const position = player?.position ?? 'QB';
  const model = models.get(position)!;
  const boards = useMemo(() => cachedBoards(players, position, ctx), [players, position, ctx]);
  const simMap = useMemo(() => (model && model.axes >= MIN_RADAR_AXES && model.pool.length >= 3 ? cachedMap(model, mapMode) : null), [model, mapMode]);

  const grades = useMemo(() => (player ? playerSkillGrades(players, player) : null), [players, player]);
  // Comps: top 10 in each mode (cards show 3 per mode, the numbered list 10 in the chosen mode, the map 5).
  const compSets = useMemo(
    () => (player ? (['style', 'level'] as const).map((mode) => ({ mode, comps: similarPlayers(players, player, 10, mode).filter((c) => c.similarity > 0) })) : []),
    [players, player],
  );
  const topSets = useMemo(() => compSets.map((s) => ({ mode: s.mode, comps: s.comps.slice(0, 3) })), [compSets]);
  // Style needs 4+ shared rates; positions with fewer (OL) fall back to closest overall.
  const listMode: SimilarityMode = model && model.features.length < 4 ? 'level' : mapMode;
  const listComps = compSets.find((s) => s.mode === listMode)?.comps ?? [];
  const [overlayKey, setOverlayKey] = useState('');
  const overlay = listComps.find((c) => keyOf(c.player) === overlayKey) ?? listComps[0];
  const mapComps = listComps.slice(0, 5);

  // Prev / next at the position, by official OVR (then legacy).
  const ladder = useMemo(
    () =>
      players
        .filter((p) => p.position === position)
        .sort((a, b) => (ovrMap.get(keyOf(b)) ?? 0) - (ovrMap.get(keyOf(a)) ?? 0) || b.careerLegacy - a.careerLegacy || a.name.localeCompare(b.name)),
    [players, position, ovrMap],
  );

  // ---------- Section index (scroll-spy) ----------
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [player]);
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
  };

  const random = () => {
    const pool = sorted.filter((p) => p !== player && p.games >= SIM_MIN_GAMES);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) choose(keyOf(pick));
  };

  if (!sorted.length) {
    return <p className="glass-card p-6 text-center text-muted-foreground">No league players to scout yet.</p>;
  }
  if (!player || !model) {
    return (
      <div ref={topRef} id="deep-dive" className="scroll-mt-28 py-4 sm:py-8">
        <DdEmpty options={sorted} onChoose={(k) => choose(k, { scroll: false })} onRandom={random} />
      </div>
    );
  }

  const idx = ladder.findIndex((p) => p === player);
  const prev = idx > 0 ? ladder[idx - 1] : null;
  const next = idx >= 0 && idx < ladder.length - 1 ? ladder[idx + 1] : null;
  const ovr = ovrMap.get(keyOf(player));
  const insufficient = !hasSimilarityData(player);
  const compare = onCompare ?? openInHeadToHead;
  const vals = posValues.get(position)!;
  const posStats: PosStat[] = [
    { key: 'tt', label: 'True Talent', title: 'Position-normalized production score', value: player.trueTalent, decimals: 0, pct: pctIn(vals.tt, player.trueTalent) },
    { key: 'dom', label: 'Dominance', title: '0.7 × True Talent + award points', value: player.dominance, decimals: 0, pct: pctIn(vals.dom, player.dominance) },
    { key: 'tpg', label: 'TPG', title: 'True Talent per game', value: player.tpg, decimals: 2, pct: pctIn(vals.tpg, player.tpg) },
  ];

  const nav = (
    <nav aria-label="Deep Dive sections">
      <ul className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible">
        {SECTIONS.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  jump(s.id);
                }}
                aria-current={on ? 'location' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 font-display text-sm font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                  on ? 'bg-gold text-night' : 'text-muted-foreground hover:bg-panel-2 hover:text-foreground',
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="lg:hidden">{s.short}</span>
                <span className="hidden lg:inline">{s.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div ref={topRef} className="scroll-mt-28 space-y-5" id="deep-dive">
      <DdHero
        key={`hero-${keyOf(player)}`}
        player={player}
        options={sorted}
        ovr={ovr}
        wide={wide}
        onChoose={(k) => choose(k, { scroll: false })}
        onRandom={random}
        prev={prev}
        next={next}
        onOpenCard={() => onSelect(player)}
      />

      {/* Mobile: sticky section chips */}
      <div className="dd-chips sticky z-20 -mx-4 border-y border-line/60 bg-background/90 px-4 py-1.5 backdrop-blur lg:hidden">{nav}</div>

      <div className="grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="dd-sticky sticky space-y-3">
            <p className="font-pixel text-[9px] uppercase text-gold">Scouting report</p>
            {nav}
          </div>
        </aside>

        <div key={keyOf(player)} className="min-w-0 space-y-8">
          <DdSection id="dd-ratings" index={0} title="Skill ratings" icon={Gauge} kicker={`Letter grades by percentile among ${player.position}s with ${SIM_MIN_GAMES}+ games (S = top 8%). Same grades as Build-a-Legend.`}>
            {grades && <DdSkills player={player} ovr={ovr} traits={grades.traits} overall={grades.overall} />}
          </DdSection>

          <DdSection id="dd-who" index={1} title="Who plays like him" icon={Users} kicker="His closest comps by play style and overall, his style hexagon with any comp overlaid, and the full ranked list.">
            <DdWhoPlays
              player={player}
              model={model}
              mode={listMode}
              onMode={setMapMode}
              comps={listComps}
              topSets={topSets}
              overlay={overlay}
              onOverlay={setOverlayKey}
              ovrMap={ovrMap}
              insufficient={insufficient}
              onDive={(p) => choose(keyOf(p))}
              onCompare={compare}
            />
            <DdRealComps league={players} legends={legends} player={player} ovrMap={ovrMap} onSelect={onSelect} />
          </DdSection>

          <DdSection
            id="dd-map"
            index={2}
            title="Neighbourhood"
            icon={ChartScatter}
            kicker="Zoomed in on him among every league player at his position. Closer = plays more alike."
          >
            {simMap && !insufficient ? (
              <div className="glass-card space-y-2 p-3 sm:p-4">
                <Chips
                  label="Map distance"
                  value={mapMode}
                  onChange={setMapMode}
                  options={[
                    { value: 'style', label: 'Plays like' },
                    { value: 'level', label: 'Closest overall' },
                  ]}
                />
                <CompMap
                  map={simMap}
                  ovrMap={ovrMap}
                  selectedKey={keyOf(player)}
                  topComps={mapComps}
                  overlayKey={overlay ? keyOf(overlay.player) : ''}
                  onPick={(p) => choose(keyOf(p))}
                  wide={wide}
                  focusZoom={wide ? 1.8 : 1.6}
                />
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-semibold hover:text-foreground">How this map works</summary>
                  <p className="mt-1.5">
                    Every league {player.position} is placed by classical multidimensional scaling of the {mapMode === 'style' ? 'style (shape correlation)' : 'level + style'} distance between
                    each pair, using the same z-scored rates as the comps ({model.features.map((f) => f.label).join(', ')}). The two axes keep {Math.round(simMap.explained * 100)}% of the
                    spread; they have no units. Dot size = official OVR, gold ring = Hall of Famer, faded = under {SIM_MIN_GAMES} games, grey lines join nearest neighbours, gold lines run
                    to his top 5 comps. Drag to pan, pinch or use the buttons to zoom; Tab through dots and press Enter to dive into a player.
                  </p>
                </details>
              </div>
            ) : (
              <p className="glass-card p-4 text-sm text-muted-foreground">
                {insufficient
                  ? `Not enough of ${player.name}'s rates are on record to place him on the map.`
                  : `${player.position}s have ${model.features.length === 1 ? `a single style rate (${model.features[0].label})` : 'too few style rates'}, so there is no 2-D map for this position.`}
              </p>
            )}
          </DdSection>

          <DdSection id="dd-advanced" index={3} title="Advanced profile" icon={Activity} kicker="Every advanced metric for his position: percentile, + index (100 = average qualifier) and rank among qualifiers.">
            <DdAdvanced player={player} boards={boards} />
          </DdSection>

          <DdSection id="dd-career" index={4} title="Career & legacy" icon={Milestone}>
            <DdCareer player={player} posStats={posStats} />
          </DdSection>

          <DdSection id="dd-records" index={5} title="Records & awards" icon={Medal}>
            <DdRecords player={player} book={book} ovr={ovr} />
          </DdSection>
        </div>
      </div>
    </div>
  );
};

export default PlayerDeepDive;
