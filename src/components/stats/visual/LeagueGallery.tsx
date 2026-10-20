import { useMemo, useState } from 'react';
import { GalleryHorizontalEnd } from 'lucide-react';
import type { LeagueData, Player, Position } from '@/types/player';
import { POSITIONS, buildContext, leaguePlayers } from '@/config/advanced';
import { playerKey } from '@/config/ovr';
import { isHallOfFamer } from '@/config/stats';
import { gradeFor, tierFor } from '@/config/skillGrades';
import { POSITION_NAMES } from '@/utils/playerMeta';
import { useOfficialOvr } from '@/utils/useOfficialOvr';
import { useSkillRatings } from '@/utils/useSkillRatings';
import ChartFrame from '../analytics/ChartFrame';
import Chips from '../analytics/Chips';
import TierBoard, { type Tier } from './TierBoard';
import StatStrips, { StatStripsTable } from './StatStrips';

type View = 'tiers' | 'strips';
type TierBy = 'skill' | 'ovr';

const VIEWS: { id: View; label: string }[] = [
  { id: 'tiers', label: 'Tier list' },
  { id: 'strips', label: 'Stat strips' },
];

const LETTERS = ['S', 'A', 'B', 'C', 'D', 'F'];

/** Official OVR back onto the percentile scale (inverse of ovrFromPercentile's curve), so OVR tiers use the same letters. */
const pctFromOvr = (ovr: number) => 100 * Math.min(1, Math.max(0, (ovr - 62) / 37)) ** (1 / 0.85);

const buildTiers = (players: Player[], by: TierBy, ovrMap: Map<string, number>, skillMap: ReturnType<typeof useSkillRatings>): Tier[] => {
  const buckets = new Map<string, Tier>(LETTERS.map((l) => [l, { letter: l, label: '', entries: [] }]));
  players.forEach((p) => {
    const ovr = ovrMap.get(playerKey(p));
    const skill = skillMap.get(playerKey(p));
    const value = by === 'skill' ? skill?.rating : ovr;
    const grade = by === 'skill' ? skill?.grade : ovr != null ? gradeFor(pctFromOvr(ovr)) : null;
    if (value == null || !grade) return;
    buckets.get(grade.grade[0])?.entries.push({ player: p, value });
  });
  return LETTERS.map((l) => {
    const t = buckets.get(l)!;
    const step = gradeFor(l === 'S' ? 95 : l === 'F' ? 0 : [80, 60, 40, 15][LETTERS.indexOf(l) - 1]);
    return { ...t, label: step ? tierFor(step) : '', entries: t.entries.sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name)) };
  });
};

/** League Landscape gallery: per-position graphics (tier list, stat strips) in one card, picked by tabs. */
const LeagueGallery = ({ data, onSelect }: { data: LeagueData; onSelect: (p: Player) => void }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const ctx = useMemo(() => buildContext(players), [players]);
  const ovrMap = useOfficialOvr();
  const skillMap = useSkillRatings();
  const positions = POSITIONS.filter((pos) => players.some((p) => p.position === pos));
  const [position, setPosition] = useState<Position>(positions[0] ?? 'QB');
  const [view, setView] = useState<View>('tiers');
  const [tierBy, setTierBy] = useState<TierBy>('skill');

  const atPos = useMemo(() => players.filter((p) => p.position === position), [players, position]);
  const tiers = useMemo(() => buildTiers(atPos, tierBy, ovrMap, skillMap), [atPos, tierBy, ovrMap, skillMap]);
  const name = POSITION_NAMES[position];

  const tierSummary = tiers
    .filter((t) => t.entries.length)
    .map((t) => `${t.letter}: ${t.entries.map((e) => e.player.name).join(', ')}`)
    .join('. ');

  return (
    <section id="landscape" aria-labelledby="landscape-title" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 id="landscape-title" className="section-title text-2xl">
          <GalleryHorizontalEnd className="h-5 w-5 text-gold" aria-hidden="true" />
          League Landscape
        </h2>
        <p className="text-sm text-muted-foreground">Position-by-position graphics: a tier list and every rate stat as a strip. Pick a position, then a graphic. For any other comparison, open the Graph Builder in the Lab.</p>
      </div>

      <div className="glass-card flex flex-col gap-2 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        <Chips label="Landscape position" value={position} onChange={setPosition} options={positions.map((p) => ({ value: p, label: p, title: POSITION_NAMES[p] }))} />
        <Chips label="Landscape graphic" value={view} onChange={setView} options={VIEWS.map((v) => ({ value: v.id, label: v.label }))} />
      </div>

      {view === 'tiers' && (
        <ChartFrame
          poster
          title={`${position} tier list`}
          description={`Every league ${name.toLowerCase()} graded S to F by ${tierBy === 'skill' ? 'skill rating (per-game skills vs the position)' : 'official OVR (career production and awards), on the same letter curve'}. Gold ring and star: Hall of Famer.`}
          controls={
            <Chips
              label="Tier by"
              value={tierBy}
              onChange={setTierBy}
              options={[
                { value: 'skill' as TierBy, label: 'Skill rating' },
                { value: 'ovr' as TierBy, label: 'Official OVR' },
              ]}
            />
          }
          chart={
            <>
              <p className="sr-only">{tierSummary}.</p>
              <TierBoard tiers={tiers} onSelect={onSelect} />
            </>
          }
          table={
            <div className="relative max-h-[440px] overflow-auto rounded-md border border-line/60">
              <table className="w-full text-sm">
                <caption className="sr-only">{position} tier list</caption>
                <thead className="sticky top-0 bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2 py-1.5 font-normal">Tier</th>
                    <th scope="col" className="px-2 py-1.5 font-normal">Player</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-normal">{tierBy === 'skill' ? 'Skill' : 'OVR'}</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.flatMap((t) =>
                    t.entries.map((e) => (
                      <tr key={`${t.letter}:${e.player.name}`} className="border-t border-line/40">
                        <td className="px-2 py-1 font-display font-bold">{t.letter}</td>
                        <td className="px-2 py-1">
                          <button type="button" onClick={() => onSelect(e.player)} className="font-semibold hover:text-gold">
                            {e.player.name}
                          </button>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {e.player.team ?? ''}
                            {isHallOfFamer(e.player) ? ' · HOF' : ''}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums">{e.value}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          }
        />
      )}

      {view === 'strips' && (
        <ChartFrame
          poster
          title={`${position} stat strips`}
          description={`Every ${name.toLowerCase()} rate stat as a beeswarm: one dot per qualifier in team colour (gold ring = Hall of Famer), the dashed line is the position average, the best two are named above and the worst below.`}
          chart={<StatStrips players={players} ctx={ctx} position={position} onSelect={onSelect} />}
          table={<StatStripsTable players={players} ctx={ctx} position={position} onSelect={onSelect} />}
        />
      )}
    </section>
  );
};

export default LeagueGallery;
