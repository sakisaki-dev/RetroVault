import { useMemo, useState } from 'react';
import { Radar } from 'lucide-react';
import type { LeagueData, Player, Position } from '@/types/player';
import { POSITIONS, SIM_MIN_GAMES, leaguePlayers } from '@/config/advanced';
import { playerSkillGrades, skillTraits, type SkillGrade } from '@/config/skillGrades';
import { POSITION_NAMES } from '@/utils/playerMeta';
import TeamLogo from '../../brand/TeamLogo';
import ChartFrame from '../analytics/ChartFrame';
import Chips from '../analytics/Chips';
import CompRadar from '../comps/CompRadar';
import { VIZ, fmtNum, ordinal } from '../analytics/viz';
import { keyOf } from '../records';

const TOP = 3;
/** Line style per series, matching CompRadar (first solid, the rest dashed), so identity is not colour alone. */
const DASH = ['', '6 4', '6 4'];

interface Leader {
  player: Player;
  traits: SkillGrade[];
  color: string;
}

const Swatch = ({ color, dashed }: { color: string; dashed: boolean }) => (
  <svg width="22" height="10" aria-hidden="true" className="shrink-0">
    <line x1="1" y1="5" x2="21" y2="5" stroke={color} strokeWidth={3} strokeDasharray={dashed ? '5 3' : undefined} />
  </svg>
);

/** The top three careers (Career Legacy) at a position overlaid on the play-style hexagon. */
const LeaderRadar = ({ data, onSelect }: { data: LeagueData; onSelect: (p: Player) => void }) => {
  const players = useMemo(() => leaguePlayers(data), [data]);
  const positions = useMemo(() => POSITIONS.filter((pos) => skillTraits(pos).length >= 3 && players.some((p) => p.position === pos)), [players]);
  const [position, setPosition] = useState<Position>(positions[0] ?? 'QB');
  const [axis, setAxis] = useState<number | null>(null);

  const leaders: Leader[] = useMemo(
    () =>
      players
        .filter((p) => p.position === position && p.games >= SIM_MIN_GAMES)
        .sort((a, b) => b.careerLegacy - a.careerLegacy || a.name.localeCompare(b.name))
        .slice(0, TOP)
        .map((p, i) => ({ player: p, traits: playerSkillGrades(players, p).traits, color: VIZ.series[i] })),
    [players, position],
  );

  const traits = skillTraits(position);
  const labels = traits.map((t) => t.name);
  const ok = traits.map((_, i) => leaders.some((l) => Number.isFinite(l.traits[i]?.percentile)));
  const pctOf = (g: SkillGrade | undefined) => (g && Number.isFinite(g.percentile) ? g.percentile : null);
  const describe = (i: number) =>
    `${labels[i]}: ` + leaders.map((l) => `${l.player.name} ${l.traits[i]?.display ?? '—'}${pctOf(l.traits[i]) != null ? ` (${ordinal(pctOf(l.traits[i]) as number)} percentile)` : ''}`).join('; ');

  if (positions.length === 0) return null;
  const active = axis != null && axis < traits.length ? axis : null;

  return (
    <ChartFrame
      title="How the greats play"
      icon={<Radar className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`The top ${TOP} ${POSITION_NAMES[position].toLowerCase()}s by Career Legacy on the play-style hexagon. Each axis is a percentile among ${position}s (min ${SIM_MIN_GAMES} games), outward is better. Focus or hover an axis for the numbers.`}
      controls={
        <Chips
          label="Position for the style radar"
          value={position}
          onChange={(p) => {
            setPosition(p);
            setAxis(null);
          }}
          options={positions.map((p) => ({ value: p, label: p, title: POSITION_NAMES[p] }))}
        />
      }
      chart={
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div onMouseLeave={() => setAxis(null)} className="min-w-0 px-6 sm:px-10">
            <CompRadar
              labels={labels}
              axisOk={ok}
              series={leaders.map((l) => ({ label: l.player.name, color: l.color, values: l.traits.map(pctOf) }))}
              className="mx-auto block h-auto w-full max-w-[460px]"
              ariaLabel={`Style hexagon of the top ${TOP} ${position}s. Focus an axis for each player's value.`}
              activeAxis={active}
              onAxis={setAxis}
              axisDescription={describe}
            />
          </div>
          <div className="space-y-3">
            <ol className="space-y-1.5" aria-label="Players on the radar">
              {leaders.map((l, i) => (
                <li key={keyOf(l.player)}>
                  <button
                    type="button"
                    onClick={() => onSelect(l.player)}
                    className="flex w-full items-center gap-2 rounded-md border border-line bg-night/50 px-2 py-1.5 text-left hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <Swatch color={l.color} dashed={!!DASH[i]} />
                    {l.player.team && <TeamLogo team={l.player.team} size={18} decorative />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.player.name}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{fmtNum(l.player.careerLegacy, 0)} CL</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="min-h-[6.5rem] rounded-lg border border-line/70 bg-night/50 p-3 text-sm" aria-live="polite">
              {active != null ? (
                <>
                  <p className="font-display text-base font-bold uppercase text-gold">{labels[active]}</p>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">{traits[active].definition}</p>
                  <ul className="space-y-0.5">
                    {leaders.map((l) => (
                      <li key={keyOf(l.player)} className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{l.player.name}</span>
                        <span className="shrink-0 font-mono text-xs tabular-nums">
                          {l.traits[active]?.display ?? '—'}
                          {pctOf(l.traits[active]) != null && <span className="text-muted-foreground"> · {ordinal(pctOf(l.traits[active]) as number)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-muted-foreground">Hover, tap or focus an axis label to compare the three on that trait.</p>
              )}
            </div>
          </div>
        </div>
      }
      table={
        <div className="overflow-x-auto rounded-md border border-line/60">
          <table className="w-full text-sm">
            <caption className="sr-only">Style traits of the top {TOP} {position}s: value and percentile</caption>
            <thead className="bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-normal">Trait</th>
                {leaders.map((l) => (
                  <th key={keyOf(l.player)} scope="col" className="px-2 py-1.5 text-right font-normal normal-case">
                    {l.player.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {traits.map((t, i) => (
                <tr key={t.id} className="border-t border-line/40">
                  <th scope="row" className="px-2 py-1 text-left font-semibold">{t.name}</th>
                  {leaders.map((l) => (
                    <td key={keyOf(l.player)} className="px-2 py-1 text-right font-mono text-xs tabular-nums">
                      {l.traits[i]?.display ?? '—'}
                      {pctOf(l.traits[i]) != null && <span className="text-muted-foreground"> · {ordinal(pctOf(l.traits[i]) as number)}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
};

export default LeaderRadar;
