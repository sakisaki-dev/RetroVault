import { useEffect, useMemo, useState } from 'react';
import type { Player } from '@/types/player';
import PixelLoader from '@/components/ui/PixelLoader';
import { useCareerSeasons } from '@/utils/careerSeasons';
import { useLeagueContent } from '@/utils/leagueContent';
import { useHallOfFame } from '@/utils/hallOfFame';
import { normalizeName, usePlayerExtras } from '@/utils/playerExtras';
import { useSaveState } from '@/components/clock/saveData';
import { useClubRecords } from '../../clubRecords';
import { usePrefersReducedMotion } from '../../analytics/viz';
import { buildLeague } from './careerModel';
import { buildCareer } from './careerStory';
import { graphMetrics, yLabel } from './graphKit';
import CareerHero from './CareerHero';
import { HeatStrip, TrophyShelf } from './Strips';
import RaceChart from './RaceChart';
import { PeakChart, VolumeRate } from './Bars';
import CompareOverlay from './CompareOverlay';
import { BestSeasons, ClubSplits } from './Extras';
import './careerGraphs.css';

/**
 * The Deep Dive's career graphs (lazy-loaded): the timeline hero with its season cursor, then the trophy shelf, the
 * percentile heat strip, the cumulative race, peak vs longevity, volume vs efficiency and the comparison overlay. One
 * season cursor is shared: tapping a season in any graph moves it everywhere.
 */
const DdGraphs = ({ player, players, wide }: { player: Player; players: Player[]; wide: boolean }) => {
  const file = useCareerSeasons();
  const save = useSaveState();
  const { content } = useLeagueContent();
  const { data: hof } = useHallOfFame();
  const records = useClubRecords();
  const extras = usePlayerExtras();
  const reduced = usePrefersReducedMotion();
  const ready = file !== undefined && save !== undefined;
  const league = useMemo(() => (ready && file ? buildLeague(file, save ?? null) : null), [ready, file, save]);
  const career = useMemo(
    () =>
      league
        ? buildCareer({
            player,
            league,
            stints: extras.stints[normalizeName(player.name)],
            superBowls: content?.superBowls ?? [],
            records: records?.records ?? [],
            hof,
            save: save ?? null,
          })
        : null,
    [league, player, extras, content, records, hof, save],
  );
  const metrics = useMemo(() => {
    const all = graphMetrics(player.position);
    return career?.hasSeasons ? all : all.filter((m) => m.group === 'Card');
  }, [player.position, career]);
  const [idx, setIdx] = useState(-1);
  const [metricId, setMetricId] = useState<string | null>(null);
  // SZN (this season's rating) leads for an active player, OVR (the career rating) for a retiree
  const defaultMetric = player.status === 'Active' ? 'szn' : 'car';
  useEffect(() => setIdx(-1), [player]);
  // the cursor starts on his latest season with a season line (a retiree's idle seasons after it are still there to scrub)
  const lastLine = career ? career.points.reduce((k, p, i) => (p.box ? i : k), career.points.length - 1) : 0;
  const at = career ? (idx < 0 || idx >= career.points.length ? lastLine : idx) : 0;

  if (!ready) return <PixelLoader label="Charting" what="the career graphs" minHeight={wide ? 420 : 520} />;
  if (!file) return <p className="glass-card p-4 text-sm text-muted-foreground">The season-by-season file isn&rsquo;t built yet (npm run rebuild writes it).</p>;
  if (!career) return <p className="glass-card p-4 text-sm text-muted-foreground">{player.name} has no season-end snapshots on record, so there is nothing to chart yet.</p>;
  const pts = career.points;
  const span = `${yLabel(pts[0].year)}–${yLabel(pts[pts.length - 1].year)}`;
  return (
    <div className="space-y-3 rv-load-in">
      {!career.hasSeasons && (
        <p className="cg-note">
          {player.name} {player.status === 'Retired' ? 'retired before the season-end records begin' : 'has no season line yet'} ({span} recorded): his card, Career Legacy and Hall of Fame standing are charted, but there are no
          single seasons to break down.
        </p>
      )}
      <CareerHero player={player} career={career} metrics={metrics} metricId={metrics.some((m) => m.id === (metricId ?? defaultMetric)) ? (metricId ?? defaultMetric) : metrics[0].id} onMetric={setMetricId} idx={at} onIdx={setIdx} wide={wide} reduced={reduced} />
      <div className="cg-grid">
        <TrophyShelf player={player} career={career} idx={at} onIdx={setIdx} wide={wide} />
        {career.hasSeasons && <HeatStrip player={player} career={career} idx={at} onIdx={setIdx} wide={wide} />}
        <RaceChart player={player} career={career} league={league!} idx={at} onIdx={setIdx} />
        {career.hasSeasons && <PeakChart player={player} career={career} idx={at} onIdx={setIdx} />}
        {career.hasSeasons && <VolumeRate player={player} career={career} idx={at} onIdx={setIdx} />}
        {career.hasSeasons && <ClubSplits player={player} career={career} />}
        {career.hasSeasons && <BestSeasons player={player} career={career} onIdx={setIdx} />}
        <CompareOverlay player={player} players={players} career={career} league={league!} metrics={metrics} idx={at} />
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold hover:text-foreground">How these graphs are built</summary>
        <p className="mt-1.5">
          Single seasons are not stored. Each season is the change in his career totals between two consecutive season-end market snapshots ({span} for him), so the
          first recorded season has no season line, a change of more than 21 games (an import correction) is left out, and seasons under 8 games are flagged and kept out
          of the percentile pools. The snapshots keep yards, touchdowns, catches, interceptions, tackles, sacks, forced fumbles and blocks, not attempts, carries or
          fumbles, so rates that need those (Y/A, Cmp%, Y/C) exist only for a season the live save covers. Percentiles rank a season among every {player.position} with 8+
          games that season. SZN (the season rating) and OVR (the career rating at that season end), card value, Career Legacy (and its rank) are the snapshot&rsquo;s own numbers; Career Legacy re-scales with the league each upload. The
          Hall of Fame Score is the ballot&rsquo;s rule applied to each season end. Career years before the records are estimated at 17 games a season.
        </p>
      </details>
    </div>
  );
};

export default DdGraphs;
