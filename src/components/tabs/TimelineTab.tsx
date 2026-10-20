import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, Flame, GitBranch, Loader2, Trophy } from 'lucide-react';
import { useLeague } from '@/context/LeagueContext';
import type { Player } from '@/types/player';
import { useLeagueContent } from '@/utils/leagueContent';
import PlayerDetailCard from '@/components/PlayerDetailCard';
import { buildTimelineModel, eraForYear, type PlacedEra } from '@/components/timeline/timelineModel';
import { HorizontalTrack, VerticalTrack } from '@/components/timeline/EraTrack';
import EraDetail from '@/components/timeline/EraDetail';
import Scorebug from '@/components/timeline/Scorebug';
import FranchiseTitlesTable from '@/components/timeline/FranchiseTitlesTable';
import CoverageControl from '@/components/timeline/CoverageControl';
import Storylines from '@/components/timeline/Storylines';
import { MarkerGlyph, type MarkerKind } from '@/components/timeline/SuperBowlMarker';

const DETAIL_ID = 'timeline-era-detail';
const MOBILE_DETAIL_ID = 'timeline-era-detail-mobile';

const LEGEND: { kind: MarkerKind; label: string }[] = [
  { kind: 'won', label: 'Won (your team color)' },
  { kind: 'lost', label: 'Lost' },
  { kind: 'out', label: 'Not in it' },
  { kind: 'unknown', label: 'Not captured' },
  { kind: 'pending', label: 'Not yet played' },
];

const TimelineTab = () => {
  const { content, loading, source } = useLeagueContent();
  const { getAllPlayers } = useLeague();
  const players = useMemo(() => getAllPlayers(), [getAllPlayers]);

  const model = useMemo(() => (content ? buildTimelineModel(content) : null), [content]);
  const [selectedEraId, setSelectedEraId] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Drop a selection that no longer exists after a content upload.
  useEffect(() => {
    if (model && selectedEraId && !model.eras.some((e) => e.era.id === selectedEraId)) setSelectedEraId(null);
  }, [model, selectedEraId]);

  const lastPlayedYear = useMemo(
    () => (model ? [...model.years].reverse().find((s) => s.sb && s.sb.winner)?.year ?? null : null),
    [model],
  );
  const shownYear = activeYear ?? lastPlayedYear;
  const shownSlot = model && shownYear !== null ? model.years.find((s) => s.year === shownYear) ?? null : null;

  const selectEra = useCallback((id: string | null) => {
    setSelectedEraId(id);
  }, []);

  // On desktop, bring the detail panel into view when an era opens.
  useEffect(() => {
    if (!selectedEraId || !detailRef.current) return;
    if (window.matchMedia?.('(min-width: 768px)').matches) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedEraId]);

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-24 text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading league history…
      </div>
    );
  }

  if (!content || !model || (!content.eras.length && !content.superBowls.length)) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <CalendarRange className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
        <h2 className="font-display text-3xl font-bold uppercase">No league history yet</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Run <code>npm run rebuild</code> to generate the league history from the data.
        </p>
      </div>
    );
  }

  const { stats } = model;
  const selected = model.eras.find((e) => e.era.id === selectedEraId) ?? null;
  const renderDetail = (placed: PlacedEra, id = DETAIL_ID) => (
    <EraDetail
      id={id}
      placed={placed}
      content={content}
      model={model}
      players={players}
      onPlayerSelect={setSelectedPlayer}
      onClose={() => setSelectedEraId(null)}
    />
  );
  const shownEra = shownYear !== null ? eraForYear(model, shownYear) : null;

  const statTiles = [
    { label: 'Titles', value: stats.titles, sub: `${stats.appearances} appearances`, icon: Trophy },
    { label: 'Super Bowl record', value: `${stats.titles}–${stats.losses}`, sub: `missed ${stats.missed}`, icon: Flame },
    {
      label: 'Longest title streak',
      value: stats.longestTitleStreak.length,
      sub: stats.longestTitleStreak.length ? `Y${stats.longestTitleStreak.start}–${stats.longestTitleStreak.end}` : '—',
      icon: Trophy,
    },
    {
      label: 'Straight appearances',
      value: stats.longestAppearanceStreak.length,
      sub: stats.longestAppearanceStreak.length
        ? `Y${stats.longestAppearanceStreak.start}–${stats.longestAppearanceStreak.end}, ${stats.longestAppearanceStreak.won}–${stats.longestAppearanceStreak.lost}`
        : '—',
      icon: GitBranch,
    },
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      {/* Masthead */}
      <header className="relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-r from-primary/15 via-background to-[hsl(45_100%_55%/0.12)] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              {content.season ? `Through season ${content.season}` : 'League history'}
              {source === 'uploaded' ? ' · custom coverage' : ''}
            </p>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              {content.title ?? 'The Eras'}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Y{model.firstYear} to Y{model.lastYear}, era by era. Bands are tinted by the franchise you ran; every dot is a Super Bowl.
              Select an era for its story, key players and rival.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[560px]">
            {statTiles.map((t) => (
              <div key={t.label} className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
                <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <t.icon className="h-3 w-3" aria-hidden />
                  {t.label}
                </dt>
                <dd className="font-display text-2xl font-bold tabular-nums leading-tight">{t.value}</dd>
                <dd className="truncate text-[11px] text-muted-foreground">{t.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* Timeline */}
      <section aria-labelledby="timeline-heading" className="space-y-3 rounded-xl border border-border/40 bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="timeline-heading" className="font-display text-lg font-bold uppercase tracking-wide">
            Eras timeline
          </h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
            {LEGEND.map((l) => (
              <li key={l.kind} className="flex items-center gap-1.5">
                <span className="flex h-3 w-3 items-center justify-center">
                  <MarkerGlyph kind={l.kind} color={l.kind === 'won' ? '264 73% 40%' : null} />
                </span>
                {l.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden md:block">
          <Scorebug slot={shownSlot} eraName={shownEra?.era.name} season={content.season} />
        </div>

        <div className="hidden md:block">
          <HorizontalTrack
            model={model}
            season={content.season}
            selectedEraId={selectedEraId}
            activeYear={activeYear}
            detailId={DETAIL_ID}
            onSelectEra={selectEra}
            onActiveYear={setActiveYear}
          />
        </div>

        <div className="md:hidden">
          <VerticalTrack
            model={model}
            season={content.season}
            selectedEraId={selectedEraId}
            activeYear={activeYear}
            detailId={MOBILE_DETAIL_ID}
            onSelectEra={selectEra}
            onActiveYear={setActiveYear}
            renderDetail={(placed) => renderDetail(placed, MOBILE_DETAIL_ID)}
          />
          {/* Sticky readout so tapped chips always show their result */}
          <div className="sticky bottom-3 z-10 mt-3">
            <div className="rounded-lg bg-background/95 shadow-lg backdrop-blur">
              <Scorebug slot={shownSlot} eraName={shownEra?.era.name} season={content.season} />
            </div>
          </div>
        </div>
      </section>

      {selected && (
        <div ref={detailRef} className="hidden scroll-mt-24 md:block">
          {renderDetail(selected)}
        </div>
      )}

      <FranchiseTitlesTable superBowls={content.superBowls} />

      {content.lineages.length > 0 && (
        <section aria-labelledby="lineage-heading" className="grid gap-4 lg:grid-cols-2">
          <h2 id="lineage-heading" className="sr-only">
            Lineages
          </h2>
          {content.lineages.map((l) => (
            <div key={l.id} className="rounded-xl border border-border/40 bg-card p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{l.label} lineage</h3>
              <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
                {l.chain.map((c, i) => (
                  <li key={i} className="flex items-center gap-1">
                    {i > 0 && (
                      <span aria-hidden className="text-muted-foreground/60">
                        →
                      </span>
                    )}
                    <span className="rounded-md bg-secondary/50 px-2 py-1">{c}</span>
                  </li>
                ))}
              </ol>
              {l.note && <p className="mt-3 text-xs text-muted-foreground">{l.note}</p>}
            </div>
          ))}
        </section>
      )}

      <Storylines storylines={content.storylines} edition={content.edition} players={players} onPlayerSelect={setSelectedPlayer} />

      {/* League history is generated from the data on every rebuild (scripts/build_league_content.py). */}
      <footer className="flex justify-end border-t border-border/30 pt-4">
        <CoverageControl source={source} season={content.season} storyCount={content.eras?.length ?? 0} />
      </footer>

      <PlayerDetailCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
};

export default TimelineTab;
