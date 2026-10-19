import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import type { Player } from '@/types/player';
import { legacyMix, type LegacyMix as Mix } from '@/config/advanced';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import PositionBadge from '../../PositionBadge';
import ChartFrame from './ChartFrame';
import Chips from './Chips';
import { VIZ, fmtNum } from './viz';
import { keyOf } from '../records';

const TOP = 15;

const PARTS = [
  { key: 'talent', label: 'Talent', note: '6.8 × True Talent', color: VIZ.series[0] },
  { key: 'awards', label: 'Awards', note: '4 × award points', color: VIZ.series[1] },
  { key: 'longevity', label: 'Longevity', note: '2 × games', color: VIZ.series[2] },
] as const;

type Mode = 'abs' | 'share';

const pct = (part: number, m: Mix) => (m.total > 0 ? (part / m.total) * 100 : 0);

/** Career Legacy split into talent, awards and longevity for the top 15 careers. */
const LegacyMix = ({ players, onSelect }: { players: Player[]; onSelect: (p: Player) => void }) => {
  const [mode, setMode] = useState<Mode>('abs');
  const rows = useMemo(
    () =>
      [...players]
        .filter((p) => p.careerLegacy > 0)
        .sort((a, b) => b.careerLegacy - a.careerLegacy)
        .slice(0, TOP)
        .map((p) => ({ player: p, mix: legacyMix(p) })),
    [players],
  );
  const max = Math.max(...rows.map((r) => r.mix.total), 1);

  const summary = (p: Player, m: Mix) =>
    `${p.name}: Career Legacy ${fmtNum(m.total, 0)}. ` +
    PARTS.map((part) => `${part.label} ${fmtNum(m[part.key], 0)} (${fmtNum(pct(m[part.key], m), 0)}%)`).join(', ');

  return (
    <ChartFrame
      title="Legacy composition"
      icon={<Layers className="h-4 w-4 text-gold" aria-hidden="true" />}
      description={`Where the top ${TOP} Career Legacy scores come from. Career Legacy = 4·TT + 4·Dominance + 2·G, and Dominance = 0.7·TT + award points, so it splits exactly into talent, awards and longevity.`}
      controls={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chips
            label="Bar scale"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'abs' as Mode, label: 'Points' },
              { value: 'share' as Mode, label: 'Share %' },
            ]}
          />
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary-foreground" aria-label="Legend">
            {PARTS.map((p) => (
              <li key={p.key} className="inline-flex items-center gap-1.5" title={p.note}>
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                {p.label}
              </li>
            ))}
          </ul>
        </div>
      }
      chart={
        <ol className="space-y-1.5" aria-label={`Top ${TOP} Career Legacy, split by source`}>
          {rows.map(({ player, mix }) => {
            const width = mode === 'abs' ? (mix.total / max) * 100 : 100;
            return (
              <li key={keyOf(player)}>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect(player)}
                      aria-label={`${summary(player, mix)}. Open player`}
                      className="grid w-full grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-panel-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:grid-cols-[minmax(0,10rem)_1fr]"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <PositionBadge position={player.position} className="hidden min-w-[2rem] px-1 py-0 text-[9px] sm:inline-flex" />
                        <span className="truncate text-xs font-semibold sm:text-sm">{player.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="flex h-3.5 gap-[2px]" style={{ width: `${width}%` }} aria-hidden="true">
                          {PARTS.filter((part) => mix[part.key] > 0).map((part, i, shown) => (
                            <span
                              key={part.key}
                              className={i === shown.length - 1 ? 'rounded-r-[4px]' : undefined}
                              style={{ flex: `${Math.max(mix[part.key], 0)} 1 0px`, background: part.color, minWidth: 2 }}
                            />
                          ))}
                        </span>
                        {mode === 'abs' && (
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-secondary-foreground">{fmtNum(mix.total / 1000, 1)}k</span>
                        )}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="border-line bg-popover text-xs">
                    <p className="font-semibold">
                      {player.name} · {fmtNum(mix.total, 0)}
                    </p>
                    {PARTS.map((part) => (
                      <p key={part.key} className="mt-0.5 flex items-center gap-1.5 font-mono tabular-nums text-secondary-foreground">
                        <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: part.color }} />
                        {part.label} {fmtNum(mix[part.key], 0)} ({fmtNum(pct(mix[part.key], mix), 0)}%)
                      </p>
                    ))}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      }
      table={
        <div className="relative overflow-x-auto rounded-md border border-line/60">
          <table className="w-full text-sm">
            <caption className="sr-only">Career Legacy by source, top {TOP}</caption>
            <thead className="bg-panel-2 text-left font-pixel text-[9px] uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-normal">Player</th>
                {PARTS.map((p) => (
                  <th key={p.key} scope="col" className="px-2 py-1.5 text-right font-normal">
                    {p.label}
                  </th>
                ))}
                <th scope="col" className="px-2 py-1.5 text-right font-normal">Legacy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ player, mix }) => (
                <tr key={keyOf(player)} className="border-t border-line/40">
                  <th scope="row" className="px-2 py-1 text-left font-semibold">
                    <button type="button" onClick={() => onSelect(player)} className="hover:text-gold">
                      {player.name}
                    </button>
                  </th>
                  {PARTS.map((p) => (
                    <td key={p.key} className="px-2 py-1 text-right font-mono tabular-nums">
                      {fmtNum(mix[p.key], 0)} <span className="text-muted-foreground">({fmtNum(pct(mix[p.key], mix), 0)}%)</span>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono font-bold tabular-nums">{fmtNum(mix.total, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
};

export default LegacyMix;
